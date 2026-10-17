package com.smsmix.app;
import android.content.*;
public class SendReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        PendingResult pending = goAsync();
        Context app = context.getApplicationContext();
        new Thread(() -> {
            try { Scheduler.tick(app, intent.getStringExtra("id"), intent.getBooleanExtra("timeout", false)); }
            catch (RuntimeException e) { Scheduler.failClosed(app, e); }
            finally { if (pending != null) pending.finish(); }
        }, "vsms-send-alarm").start();
    }
}
