package com.smsmix.app;
import android.content.*;
import android.telephony.SmsMessage;
import org.json.*;

public class DeliveredReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c,Intent intent){
        try {
            byte[] pdu=intent.getByteArrayExtra("pdu");
            String format=intent.getStringExtra("format");
            if(pdu==null || format==null)return; // Never infer receipt from an empty callback.
            SmsMessage message=SmsMessage.createFromPdu(pdu,format);
            if(message!=null && message.isStatusReportMessage())record(c,intent,message.getStatus());
        }catch(RuntimeException e){Scheduler.failClosed(c,e);}
    }
    static void record(Context c,Intent intent,int status){
        synchronized(Scheduler.LOCK){
        JSONObject d=Store.load(c);
        String id=intent.getStringExtra("id");
        int index=intent.getIntExtra("row",-1), part=intent.getIntExtra("part",-1);
        if(id==null || index<0)return;
        if(!d.optString("id").equals(id)){
            MessageHistory.recordDelivery(c,id,index,part,status);
            return;
        }
        JSONObject row=Store.rows(d).optJSONObject(index);
        if(row==null || !apply(row,part,status))return;
        Store.save(c,d);SuccessLog.record(c,d);MessageHistory.recordRow(c,d,index);
        }
    }
    static boolean apply(JSONObject row,int part,int status){
        String send=row.optString("status");
        if(!"SENDING".equals(send) && !"SENT".equals(send) && !"UNKNOWN".equals(send))return false;
        JSONArray parts=row.optJSONArray("deliveryParts");
        if(parts==null || part<0 || part>=parts.length() || parts.optInt(part)==0)return false;
        try{parts.put(part,status);}catch(JSONException e){throw new IllegalStateException(e);}
        boolean all=true;for(int n=0;n<parts.length();n++)if(parts.optInt(n)!=0)all=false;
        if(all)Store.put(row,"deliveredAt",System.currentTimeMillis());
        return true;
    }
}
