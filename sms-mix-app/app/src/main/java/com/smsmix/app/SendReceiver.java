package com.smsmix.app;
import android.content.*;
public class SendReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        PendingResult result = goAsync();
        Context app = context.getApplicationContext();
        String id = intent.getStringExtra("id");
        boolean timeout = intent.getBooleanExtra("timeout", false);
        new Thread(() -> {
            try { Scheduler.tick(app, id, timeout); }
            catch (RuntimeException e) { Scheduler.failClosed(app, e); }
            finally { result.finish(); }
        }, "smsmix-entitlement-handoff").start();
    }
}
