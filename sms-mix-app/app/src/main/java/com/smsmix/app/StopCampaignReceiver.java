package com.smsmix.app;
import android.content.*;
import org.json.JSONObject;
public class StopCampaignReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context,Intent intent){
        try{
            JSONObject d=Store.load(context);
            if(!d.optString("id").equals(intent.getStringExtra("id")))return;
            Scheduler.pause(context,d,"หยุดจากการแจ้งเตือน — ข้อความที่ส่งให้ระบบแล้วอาจยังส่งต่อจนเสร็จ");
        }catch(RuntimeException e){Scheduler.failClosed(context,e);}
    }
}
