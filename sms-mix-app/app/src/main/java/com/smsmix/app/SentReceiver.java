package com.smsmix.app;
import android.content.*;
public class SentReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        try { Scheduler.result(context, intent, getResultCode()); }
        catch (RuntimeException e) { Scheduler.failClosed(context, e); }
    }
}
