package com.smsmix.app;

import android.app.job.*;
import java.util.List;

public final class SuccessfulSendJob extends JobService {
    private volatile Thread worker;
    @Override public boolean onStartJob(JobParameters params) {
        worker = new Thread(() -> {
            boolean retry = true;
            try {
                for (int page=0;page<25;page++) {
                    List<SuccessfulSendOutbox.Entry> rows=SuccessfulSendOutbox.next(this);
                    if (rows.isEmpty()) { retry=false; break; }
                    if (!LicenseClient.uploadSuccessfulSends(this,SuccessfulSendOutbox.payload(rows))) break;
                    SuccessfulSendOutbox.acknowledge(this,rows);
                }
            } catch (RuntimeException ignored) { /* Keep durable rows for retry. */ }
            jobFinished(params,retry);
        },"vsms-success-report");
        worker.start();
        return true;
    }
    @Override public boolean onStopJob(JobParameters params) {
        Thread running=worker;
        if(running!=null) running.interrupt();
        return true;
    }
}
