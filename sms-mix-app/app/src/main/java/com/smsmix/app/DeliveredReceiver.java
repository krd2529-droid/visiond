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
        if(!d.optString("id").equals(intent.getStringExtra("id")))return;
        JSONObject row=Store.rows(d).optJSONObject(intent.getIntExtra("row",-1));
        if(row==null)return;
        JSONArray parts=row.optJSONArray("deliveryParts");int p=intent.getIntExtra("part",-1);
        if(parts==null || p<0 || p>=parts.length() || parts.optInt(p)==0)return;
        try{parts.put(p,status);}catch(JSONException e){throw new IllegalStateException(e);}
        boolean all=true;for(int n=0;n<parts.length();n++)if(parts.optInt(n)!=0)all=false;
        if(all)Store.put(row,"deliveredAt",System.currentTimeMillis());
        Store.save(c,d);SuccessLog.record(c,d);
        }
    }
}
