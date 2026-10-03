package com.smsmix.app;
import android.content.*;
import org.json.*;
public class BootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        try {
            Scheduler.bootPause(context);
        } catch (RuntimeException e) { Scheduler.failClosed(context, e); }
    }
}
