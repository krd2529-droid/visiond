package com.smsmix.app;

import android.content.*;
import android.database.Cursor;
import android.database.sqlite.*;
import org.json.*;
import java.util.*;

/** App-private, indexed message history. One row is updated per SMS callback. */
final class MessageHistory extends SQLiteOpenHelper {
    private static boolean failNextRecordRowForTests;
    private static boolean failNextFinishReplacedForTests;
    static synchronized void failNextRecordRowForTests() { failNextRecordRowForTests = true; }
    static synchronized void failNextFinishReplacedForTests() { failNextFinishReplacedForTests = true; }
    private MessageHistory(Context c) { super(c, "message-history.db", null, 1); }
    @Override public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, campaign_id TEXT NOT NULL, row_index INTEGER NOT NULL, status TEXT NOT NULL, event_at INTEGER NOT NULL, payload TEXT NOT NULL, UNIQUE(campaign_id,row_index))");
        db.execSQL("CREATE INDEX messages_recent ON messages(event_at DESC,id DESC)");
        db.execSQL("CREATE INDEX messages_status_recent ON messages(status,event_at DESC,id DESC)");
        db.execSQL("CREATE TABLE meta (name TEXT PRIMARY KEY, value INTEGER NOT NULL DEFAULT 0)");
        db.execSQL("INSERT INTO meta(name,value) VALUES('revision',0)");
    }
    @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) { throw new IllegalStateException("Unsupported history schema"); }

    private static JSONObject copy(JSONObject row, String campaignId, int index) {
        JSONObject entry;
        try { entry = new JSONObject(row.toString()); }
        catch (JSONException e) { throw new IllegalStateException(e); }
        Store.put(entry, "campaignId", campaignId);
        Store.put(entry, "rowIndex", index);
        return entry;
    }
    private static long eventAt(JSONObject campaign, JSONObject row) {
        long value = row.optLong("resultAt");
        if (value <= 0) value = row.optLong("sentAt");
        if (value <= 0) value = campaign.optLong("createdAt");
        return value > 0 ? value : System.currentTimeMillis();
    }
    private static void upsert(SQLiteDatabase db, String campaignId, int index, JSONObject row, long at) {
        JSONObject entry = copy(row, campaignId, index);
        ContentValues values = new ContentValues();
        values.put("status", entry.optString("status"));
        values.put("payload", entry.toString());
        int changed = db.update("messages", values, "campaign_id=? AND row_index=?",
                new String[]{campaignId, Integer.toString(index)});
        if (changed == 0) {
            values.put("event_at", at); // Immutable ordering keeps keyset pages stable across callbacks.
            values.put("campaign_id", campaignId); values.put("row_index", index);
            db.insertOrThrow("messages", null, values);
        }
    }
    private static void bump(SQLiteDatabase db) { db.execSQL("UPDATE meta SET value=value+1 WHERE name='revision'"); }
    static synchronized long revision(Context c) {
        try (MessageHistory helper = new MessageHistory(c);
             Cursor cursor = helper.getReadableDatabase().rawQuery("SELECT value FROM meta WHERE name='revision'", null)) {
            return cursor.moveToFirst() ? cursor.getLong(0) : 0;
        }
    }
    static synchronized void recordRow(Context c, JSONObject campaign, int index) {
        if (failNextRecordRowForTests) {
            failNextRecordRowForTests = false;
            throw new IllegalStateException("synthetic history write failure");
        }
        JSONObject row = Store.rows(campaign).optJSONObject(index);
        String id = campaign.optString("id");
        if (row == null || id.isEmpty()) return;
        try (MessageHistory helper = new MessageHistory(c)) {
            SQLiteDatabase db = helper.getWritableDatabase();
            upsert(db, id, index, row, eventAt(campaign, row)); bump(db);
        }
    }
    static synchronized void recordCampaign(Context c, JSONObject campaign) {
        SuccessfulSendOutbox.reconcile(c, campaign);
        String id = campaign.optString("id");
        if (id.isEmpty()) return;
        try (MessageHistory helper = new MessageHistory(c)) {
            SQLiteDatabase db = helper.getWritableDatabase();
            db.beginTransaction();
            try {
                // The queue is authoritative. Reconcile attempted/terminal rows even
                // after initial indexing: a prior per-row archive write may have failed.
                String marker = "campaign:" + id;
                boolean indexed;
                try (Cursor found = db.rawQuery("SELECT 1 FROM meta WHERE name=?", new String[]{marker})) {
                    indexed = found.moveToFirst();
                }
                JSONArray rows = Store.rows(campaign);
                boolean changed = false;
                for (int i = 0; i < rows.length(); i++) {
                    JSONObject row = rows.optJSONObject(i);
                    if (row != null && (!indexed || !"PENDING".equals(row.optString("status")))) {
                        upsert(db, id, i, row, eventAt(campaign, row));
                        changed = true;
                    }
                }
                if (!indexed) {
                    ContentValues markerValue = new ContentValues(); markerValue.put("name", marker);
                    db.insertOrThrow("meta", null, markerValue);
                    changed = true;
                }
                if (changed) bump(db);
                db.setTransactionSuccessful();
            } finally { db.endTransaction(); }
        }
    }
    static synchronized void finishReplaced(Context c, String campaignId) {
        if (campaignId == null || campaignId.isEmpty()) return;
        if (failNextFinishReplacedForTests) {
            failNextFinishReplacedForTests = false;
            throw new IllegalStateException("synthetic replacement-history write failure");
        }
        try (MessageHistory helper = new MessageHistory(c)) {
            SQLiteDatabase db = helper.getWritableDatabase();
            db.beginTransaction();
            try (Cursor cursor = db.rawQuery("SELECT row_index,payload FROM messages WHERE campaign_id=? AND status='PENDING'",
                    new String[]{campaignId})) {
                boolean changed = false;
                while (cursor.moveToNext()) {
                    JSONObject row;
                    try { row = new JSONObject(cursor.getString(1)); }
                    catch (JSONException e) { throw new IllegalStateException(e); }
                    Store.put(row, "status", "CANCELLED");
                    Store.put(row, "error", "คิวถูกแทนที่ก่อนส่งข้อความนี้");
                    ContentValues values = new ContentValues();
                    values.put("status", "CANCELLED"); values.put("payload", row.toString());
                    db.update("messages", values, "campaign_id=? AND row_index=?",
                            new String[]{campaignId, Integer.toString(cursor.getInt(0))});
                    changed = true;
                }
                if (changed) bump(db);
                db.setTransactionSuccessful();
            } finally { db.endTransaction(); }
        }
    }
    static synchronized void reconcileReplacement(Context c, JSONObject current) {
        String previousId = current.optString("previousCampaignId");
        if (previousId.isEmpty()) return;
        if (previousId.equals(current.optString("id")))
            throw new IllegalStateException("ข้อมูลคิวก่อนหน้าไม่ถูกต้อง");
        finishReplaced(c, previousId);
    }
    static synchronized void recordDelivery(Context c, String campaignId, int index, int part, int status) {
        try (MessageHistory helper = new MessageHistory(c)) {
            SQLiteDatabase db = helper.getWritableDatabase();
            try (Cursor cursor = db.rawQuery("SELECT payload FROM messages WHERE campaign_id=? AND row_index=?",
                    new String[]{campaignId, Integer.toString(index)})) {
                if (!cursor.moveToFirst()) return;
                JSONObject row = new JSONObject(cursor.getString(0));
                if (!DeliveredReceiver.apply(row, part, status)) return;
                ContentValues values = new ContentValues(); values.put("payload", row.toString());
                db.update("messages", values, "campaign_id=? AND row_index=?",
                        new String[]{campaignId, Integer.toString(index)});
                bump(db);
            } catch (JSONException e) { throw new IllegalStateException(e); }
        }
    }
    private static void migrateLegacy(Context c, SQLiteDatabase db) {
        try (Cursor marker = db.rawQuery("SELECT 1 FROM meta WHERE name='legacy-success'", null)) {
            if (marker.moveToFirst()) return;
        }
        JSONObject old = SuccessLog.load(c);
        db.beginTransaction();
        try {
            Iterator<String> keys = old.keys();
            while (keys.hasNext()) {
                String key = keys.next(); int split = key.lastIndexOf(':');
                if (split < 1) continue;
                int index;
                try { index = Integer.parseInt(key.substring(split + 1)); }
                catch (NumberFormatException ignored) { continue; }
                String campaignId = key.substring(0, split);
                try (Cursor found = db.rawQuery("SELECT 1 FROM messages WHERE campaign_id=? AND row_index=?",
                        new String[]{campaignId, Integer.toString(index)})) {
                    if (found.moveToFirst()) continue;
                }
                JSONObject previous = old.optJSONObject(key);
                if (previous == null) continue;
                JSONObject row = Store.object();
                Store.put(row, "phone", previous.optString("phone"));
                Store.put(row, "status", "SENT");
                Store.put(row, "sentAt", previous.optLong("sentAt"));
                Store.put(row, "resultAt", previous.optLong("resultAt"));
                Store.put(row, "deliveredAt", previous.optLong("deliveredAt"));
                Store.put(row, "bodyUnavailable", true);
                upsert(db, campaignId, index, row, eventAt(Store.object(), row));
            }
            ContentValues markerValue = new ContentValues(); markerValue.put("name", "legacy-success");
            db.insertOrThrow("meta", null, markerValue);
            bump(db);
            db.setTransactionSuccessful();
        } finally { db.endTransaction(); }
    }
    static final class Page {
        final List<JSONObject> rows = new ArrayList<>();
        long nextAt; long nextId; boolean more;
    }
    static synchronized Page page(Context c, String status, long beforeAt, long beforeId) {
        try (MessageHistory helper = new MessageHistory(c)) {
            SQLiteDatabase db = helper.getWritableDatabase();
            migrateLegacy(c, db);
            String where = "1=1";
            ArrayList<String> args = new ArrayList<>();
            if (status != null && !status.isEmpty()) { where += " AND status=?"; args.add(status); }
            if (beforeAt > 0) {
                where += " AND (event_at<? OR (event_at=? AND id<?))";
                args.add(Long.toString(beforeAt)); args.add(Long.toString(beforeAt)); args.add(Long.toString(beforeId));
            }
            Page page = new Page();
            try (Cursor cursor = db.rawQuery("SELECT id,event_at,payload FROM messages WHERE " + where
                    + " ORDER BY event_at DESC,id DESC LIMIT 25", args.toArray(new String[0]))) {
                while (cursor.moveToNext()) {
                    if (page.rows.size() == 24) { page.more = true; break; }
                    try { page.rows.add(new JSONObject(cursor.getString(2))); }
                    catch (JSONException e) { throw new IllegalStateException("อ่านประวัติข้อความไม่ได้", e); }
                    page.nextId = cursor.getLong(0); page.nextAt = cursor.getLong(1);
                }
            }
            return page;
        }
    }
}
