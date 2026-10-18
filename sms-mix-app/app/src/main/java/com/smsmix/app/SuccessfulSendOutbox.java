package com.smsmix.app;

import android.app.job.*;
import android.content.*;
import android.database.Cursor;
import android.database.sqlite.*;
import org.json.*;
import java.util.*;

/** Durable, app-private reports created only from terminal Android SENT results. */
final class SuccessfulSendOutbox extends SQLiteOpenHelper {
    private static final int JOB_ID = 7061;
    private SuccessfulSendOutbox(Context c) { super(c, "successful-send-outbox.db", null, 1); }
    @Override public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE pending (campaign_id TEXT NOT NULL,row_index INTEGER NOT NULL,phone TEXT NOT NULL,sent_at INTEGER NOT NULL,report_identity TEXT NOT NULL,acknowledged INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(campaign_id,row_index))");
        db.execSQL("CREATE INDEX pending_identity_unsent ON pending(report_identity,acknowledged)");
    }
    @Override public void onUpgrade(SQLiteDatabase db,int oldVersion,int newVersion) { throw new IllegalStateException("Unsupported outbox schema"); }

    static synchronized void record(Context c, JSONObject campaign, int index) {
        JSONObject row = Store.rows(campaign).optJSONObject(index);
        String campaignId = campaign.optString("id");
        if (row == null || !"SENT".equals(row.optString("status")) || campaignId.isEmpty()) return;
        long resultAt = row.optLong("resultAt");
        String phone = row.optString("phone");
        String identity = row.optString("reportIdentity");
        if (resultAt <= 0 || phone.isEmpty() || identity.isEmpty()) return;
        try (SuccessfulSendOutbox helper = new SuccessfulSendOutbox(c)) {
            helper.getWritableDatabase().execSQL("INSERT OR IGNORE INTO pending(campaign_id,row_index,phone,sent_at,report_identity) VALUES(?,?,?,?,?)",
                    new Object[]{campaignId,index,phone,resultAt,identity});
        }
        schedule(c);
    }
    static synchronized void reconcile(Context c, JSONObject campaign) {
        for (int i=0;i<Store.rows(campaign).length();i++) record(c,campaign,i);
        schedule(c);
    }
    static void schedule(Context c) {
        JobScheduler jobs = c.getSystemService(JobScheduler.class);
        if (jobs == null) return;
        JobInfo job = new JobInfo.Builder(JOB_ID,new ComponentName(c,SuccessfulSendJob.class))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setBackoffCriteria(30000,JobInfo.BACKOFF_POLICY_EXPONENTIAL)
                .setPersisted(true).build();
        jobs.schedule(job);
    }
    static final class Entry {
        final String campaignId,phone; final int rowIndex; final long sentAt;
        Entry(String campaignId,int rowIndex,String phone,long sentAt) {
            this.campaignId=campaignId;this.rowIndex=rowIndex;this.phone=phone;this.sentAt=sentAt;
        }
    }
    static synchronized List<Entry> next(Context c) {
        List<Entry> rows = new ArrayList<>();
        String identity = LicenseClient.reportIdentity(c);
        if (identity.isEmpty()) return rows;
        try (SuccessfulSendOutbox helper = new SuccessfulSendOutbox(c);
             Cursor cursor = helper.getReadableDatabase().rawQuery("SELECT campaign_id,row_index,phone,sent_at FROM pending WHERE report_identity=? AND acknowledged=0 ORDER BY rowid LIMIT 20",new String[]{identity})) {
            while(cursor.moveToNext()) rows.add(new Entry(cursor.getString(0),cursor.getInt(1),cursor.getString(2),cursor.getLong(3)));
        }
        return rows;
    }
    static synchronized void acknowledge(Context c,List<Entry> rows) {
        try (SuccessfulSendOutbox helper = new SuccessfulSendOutbox(c)) {
            SQLiteDatabase db=helper.getWritableDatabase(); db.beginTransaction();
            try {
                for (Entry row:rows) db.execSQL("UPDATE pending SET acknowledged=1 WHERE campaign_id=? AND row_index=?",
                        new Object[]{row.campaignId,row.rowIndex});
                db.setTransactionSuccessful();
            } finally { db.endTransaction(); }
        }
    }
    static JSONObject payload(List<Entry> rows) {
        JSONArray items=new JSONArray();
        for (Entry row:rows) {
            JSONObject item=Store.object();
            Store.put(item,"campaign_id",row.campaignId);Store.put(item,"row_index",row.rowIndex);
            Store.put(item,"phone",row.phone);Store.put(item,"sent_at",row.sentAt);items.put(item);
        }
        JSONObject result=Store.object();Store.put(result,"items",items);return result;
    }
}
