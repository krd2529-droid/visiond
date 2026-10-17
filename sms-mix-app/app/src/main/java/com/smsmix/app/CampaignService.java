package com.smsmix.app;
import android.app.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.os.*;
import org.json.*;
import java.text.DateFormat;
import java.util.Date;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class CampaignService extends Service {
    static final int NOTIFICATION=501;
    static final String CHANNEL="sms_campaign";
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final ExecutorService work=Executors.newSingleThreadExecutor();
    private final Runnable monitor=new Runnable(){
        public void run(){
            try {
                JSONObject d=Store.load(CampaignService.this);
                if(!d.optBoolean("running")){stopSelf();return;}
                Scheduler.recoverTimeout(CampaignService.this,d);
                d=Store.load(CampaignService.this);
                if(!d.optBoolean("running")){stopSelf();return;}
                // Fallback when awake; exact alarms remain responsible for waking from idle.
                if(Store.sending(d)<0 && System.currentTimeMillis()>=d.optLong("nextAt")){
                    String queueId=d.optString("id");
                    work.execute(()->{
                        try{Scheduler.tick(CampaignService.this,queueId,false);}
                        catch(RuntimeException e){Scheduler.failClosed(CampaignService.this,e);}
                    });
                }
                d=Store.load(CampaignService.this);
                if(!d.optBoolean("running")){stopSelf();return;}
                getSystemService(NotificationManager.class).notify(NOTIFICATION,notification(d));
                handler.postDelayed(this,30000);
            }catch(RuntimeException e){Scheduler.failClosed(CampaignService.this,e);stopSelf();}
        }
    };
    static void start(Context c){
        c.startForegroundService(new Intent(c,CampaignService.class));
    }
    static void stop(Context c){
        c.stopService(new Intent(c,CampaignService.class));
        c.getSystemService(NotificationManager.class).cancel(NOTIFICATION);
    }
    @Override public void onCreate(){
        super.onCreate();
        NotificationChannel channel=new NotificationChannel(CHANNEL,"คิวส่ง SMS",NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("แสดงเมื่อกำลังส่ง SMS ตามคิว พร้อมปุ่มหยุด");
        getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }
    Notification notification(JSONObject d){
        PendingIntent open=PendingIntent.getActivity(this,0,new Intent(this,SendStatusActivity.class),
                PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Intent stop=new Intent(this,StopCampaignReceiver.class).setData(android.net.Uri.parse("smsmix://stop/"+d.optString("id")))
                .putExtra("id",d.optString("id"));
        PendingIntent stopAction=PendingIntent.getBroadcast(this,0,stop,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        int sent=0;JSONArray rows=Store.rows(d);
        for(int i=0;i<rows.length();i++)if("SENT".equals(rows.optJSONObject(i).optString("status")))sent++;
        String text="ส่งสำเร็จ "+sent+" / "+rows.length()+" เบอร์";
        if(Store.sending(d)>=0)text+=" • กำลังรอผล SMS";
        else if(d.optLong("nextAt")>0)text+=" • ถัดไป "+DateFormat.getTimeInstance(DateFormat.SHORT).format(new Date(d.optLong("nextAt")));
        return new Notification.Builder(this,CHANNEL).setSmallIcon(R.drawable.ic_sms)
                .setContentTitle("VSMS กำลังทำงานเบื้องหลัง").setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setOngoing(true).setOnlyAlertOnce(true).setContentIntent(open)
                .setVisibility(Notification.VISIBILITY_PRIVATE)
                .addAction(new Notification.Action.Builder(null,"หยุดส่ง",stopAction).build()).build();
    }
    @Override public int onStartCommand(Intent intent,int flags,int startId){
        JSONObject d;
        try {d=Store.load(this);}catch(RuntimeException e){d=Store.object();}
        // Meet startForegroundService's deadline even if a stop raced with service creation.
        if(Build.VERSION.SDK_INT>=34)startForeground(NOTIFICATION,notification(d),ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        else startForeground(NOTIFICATION,notification(d));
        handler.removeCallbacks(monitor);
        if(!d.optBoolean("running")){stopSelf();return START_NOT_STICKY;}
        try {
            Scheduler.checkPermissions(this,d.optInt("sim",-1));
            Scheduler.recoverTimeout(this,d);
            if(!d.optBoolean("running")){stopSelf();return START_NOT_STICKY;}
            int sending=Store.sending(d);
            if(sending>=0)Scheduler.alarm(this,d,Store.rows(d).optJSONObject(sending).optLong("deadline"),true);
            else if(Store.pending(d)>=0)Scheduler.alarm(this,d,Math.max(System.currentTimeMillis()+1000,d.optLong("nextAt")),false);
            else {Scheduler.pause(this,d,"ครบรายการแล้ว");return START_NOT_STICKY;}
            handler.postDelayed(monitor,30000);
            return START_STICKY;
        }catch(RuntimeException e){Scheduler.failClosed(this,e);stopSelf();return START_NOT_STICKY;}
    }
    @Override public void onDestroy(){handler.removeCallbacks(monitor);work.shutdownNow();stopForeground(STOP_FOREGROUND_REMOVE);super.onDestroy();}
    @Override public IBinder onBind(Intent intent){return null;}
}
