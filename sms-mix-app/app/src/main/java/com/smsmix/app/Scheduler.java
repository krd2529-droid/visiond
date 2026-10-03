package com.smsmix.app;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.telephony.*;
import org.json.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

final class Scheduler {
    static final Random RANDOM = new java.security.SecureRandom();
    static final Object LOCK = new Object();
    private static final Set<String> CHECKING_QUEUES = ConcurrentHashMap.newKeySet();
    interface Handoff { void send(SmsManager manager, JSONObject row, ArrayList<String> parts, ArrayList<PendingIntent> callbacks); }
    private static volatile Handoff testHandoff;
    static void setHandoffForTests(Handoff handoff) { testHandoff = handoff; }
    static boolean exactAllowed(Context c) {
        return Build.VERSION.SDK_INT < 31 || c.getSystemService(AlarmManager.class).canScheduleExactAlarms();
    }
    static PendingIntent alarmIntent(Context c, String id, boolean timeout) {
        Intent intent = new Intent(c, SendReceiver.class)
                .setData(Uri.parse("smsmix://alarm/" + id + "/" + timeout))
                .putExtra("id", id).putExtra("timeout", timeout);
        return PendingIntent.getBroadcast(c, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    static void alarm(Context c, JSONObject d, long at, boolean timeout) {
        c.getSystemService(AlarmManager.class).setExactAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP, at, alarmIntent(c, d.optString("id"), timeout));
    }
    static void cancel(Context c, JSONObject d, boolean timeout) {
        c.getSystemService(AlarmManager.class).cancel(alarmIntent(c, d.optString("id"), timeout));
    }
    static void pause(Context c, JSONObject d, String note) {
        synchronized (LOCK) {
            JSONObject latest = Store.load(c);
            if (!d.optString("id").equals(latest.optString("id"))) return;
            pauseLocked(c, latest, note);
        }
    }
    private static void pauseLocked(Context c, JSONObject d, String note) {
        Store.put(d, "running", false);
        Store.put(d, "note", note);
        Store.save(c, d);
        cancel(c, d, false);
    }
    static void checkPermissions(Context c, int sim) {
        if (c.checkSelfPermission(Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED
                || c.checkSelfPermission(Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED)
            throw new IllegalStateException("กรุณาอนุญาต SMS และการอ่านข้อมูลซิม");
        if (!exactAllowed(c)) throw new IllegalStateException("กรุณาเปิดสิทธิ์นาฬิกาปลุกและการช่วยเตือน");
        SubscriptionManager sm = c.getSystemService(SubscriptionManager.class);
        if (sm == null || sm.getActiveSubscriptionInfo(sim) == null)
            throw new IllegalStateException("ไม่พบซิมที่เลือก กรุณาตรวจสอบซิมก่อน");
    }
    static void resume(Context c, JSONObject d) {
        LicenseClient.requireCurrent(c);
        synchronized (LOCK) {
            JSONObject fresh = Store.load(c);
            if (!d.optString("id").equals(fresh.optString("id"))) throw new IllegalStateException("คิวเปลี่ยน กรุณาตรวจพรีวิวใหม่");
            d = fresh;
            checkPermissions(c, d.optInt("sim", -1));
            recoverTimeoutLocked(c, d);
            if (Store.sending(d) >= 0) throw new IllegalStateException("กำลังรอผล SMS ปัจจุบัน");
            if (Store.pending(d) < 0) throw new IllegalStateException("ไม่มีเบอร์ค้างส่ง");
            Store.put(d, "running", true);
            Store.put(d, "note", "กำลังทำงาน");
            Store.save(c, d);
            try { alarm(c, d, Math.max(System.currentTimeMillis() + 1000, d.optLong("nextAt")), false); }
            catch (RuntimeException e) { pauseLocked(c, d, e.getMessage()); throw e; }
        }
    }
    static SmsManager sms(int sim) { return SmsManager.getSmsManagerForSubscriptionId(sim); }

    static void tick(Context c, String id, boolean timeout) {
        JSONObject d = Store.load(c);
        if (!id.equals(d.optString("id"))) return;
        if (timeout) { recoverTimeout(c, d); return; }
        if (!d.optBoolean("running") || Store.sending(d) >= 0) return;
        if (System.currentTimeMillis() < d.optLong("nextAt")) {
            synchronized (LOCK) {
                JSONObject latest = Store.load(c);
                if (id.equals(latest.optString("id")) && latest.optBoolean("running") && Store.sending(latest) < 0)
                    alarm(c, latest, latest.optLong("nextAt"), false);
            }
            return;
        }
        int i = Store.pending(d);
        if (i < 0) { pause(c, d, "ครบรายการแล้ว"); return; }
        if (!CHECKING_QUEUES.add(id)) return;
        try {
        if (!LicenseClient.checkCurrent(c, true)) {
            synchronized (LOCK) {
                JSONObject latest = Store.load(c);
                if (id.equals(latest.optString("id")) && latest.optBoolean("running") && Store.pending(latest) >= 0)
                    pauseLocked(c, latest, "ยืนยันสิทธิ์ออนไลน์ไม่ได้ คิวหยุดโดยไม่ส่งเบอร์ที่รออยู่");
            }
            return;
        }
        synchronized (LOCK) {
            d = Store.load(c);
            if (!id.equals(d.optString("id")) || !d.optBoolean("running") || Store.sending(d) >= 0) return;
            if (System.currentTimeMillis() < d.optLong("nextAt")) { alarm(c, d, d.optLong("nextAt"), false); return; }
            i = Store.pending(d);
            if (i < 0) { pauseLocked(c, d, "ครบรายการแล้ว"); return; }
            checkPermissions(c, d.optInt("sim", -1));
            SmsManager sm = sms(d.optInt("sim"));
            JSONObject row = Store.rows(d).optJSONObject(i);
            ArrayList<String> parts = sm.divideMessage(row.optString("body"));
            JSONArray results = new JSONArray();
            ArrayList<PendingIntent> callbacks = new ArrayList<>();
            for (int p = 0; p < parts.size(); p++) {
                results.put(0);
                Intent result = new Intent(c, SentReceiver.class)
                        .setData(Uri.parse("smsmix://sent/" + id + "/" + i + "/" + p))
                        .putExtra("id", id).putExtra("row", i).putExtra("part", p);
                callbacks.add(PendingIntent.getBroadcast(c, 0, result,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
            }
            long now = System.currentTimeMillis();
            Store.put(row, "status", "SENDING");
            Store.put(row, "parts", results);
            Store.put(row, "sentAt", now);
            Store.put(row, "deadline", now + 5 * 60_000L);
            Store.put(d, "nextAt", now + CampaignCore.delay(RANDOM));
            Store.save(c, d); // Persist before telephony side effect, never automatically retry SENDING.
            try {
                alarm(c, d, row.optLong("deadline"), true);
                Handoff handoff = testHandoff;
                if (handoff != null) handoff.send(sm, row, parts, callbacks);
                else if (parts.size() == 1)
                    sm.sendTextMessage(row.optString("phone"), null, parts.get(0), callbacks.get(0), null);
                else sm.sendMultipartTextMessage(row.optString("phone"), null, parts, callbacks, null);
            } catch (RuntimeException e) {
                Store.put(row, "status", "UNKNOWN");
                pauseLocked(c, d, "ไม่ทราบผลการส่ง: " + e.getMessage() + " — ไม่มีการส่งซ้ำอัตโนมัติ");
            }
        }
        } finally { CHECKING_QUEUES.remove(id); }
    }

    static void result(Context c, Intent intent, int code) {
        synchronized (LOCK) {
        JSONObject d = Store.load(c);
        if (!d.optString("id").equals(intent.getStringExtra("id"))) return;
        int i = intent.getIntExtra("row", -1), p = intent.getIntExtra("part", -1);
        JSONObject row = Store.rows(d).optJSONObject(i);
        if (row == null || !"SENDING".equals(row.optString("status"))) return;
        JSONArray parts = row.optJSONArray("parts");
        if (parts == null || p < 0 || p >= parts.length() || parts.optInt(p) != 0) return;
        try { parts.put(p, code == Activity.RESULT_OK ? 1 : -1); }
        catch (JSONException e) { throw new IllegalStateException(e); }
        if (code != Activity.RESULT_OK) Store.put(row, "error", "SMS result=" + code);
        boolean complete = true, ok = true;
        for (int n = 0; n < parts.length(); n++) {
            if (parts.optInt(n) == 0) complete = false;
            if (parts.optInt(n) != 1) ok = false;
        }
        Store.save(c, d);
        if (!complete) return;
        cancel(c, d, true);
        Store.put(row, "status", ok ? "SENT" : "FAILED");
        if (!ok) { pauseLocked(c, d, "ส่งไม่สำเร็จ/ไม่ครบทุกส่วน หยุดคิวเพื่อตรวจสอบ"); return; }
        Store.save(c, d);
        if (Store.pending(d) < 0) pauseLocked(c, d, "ครบรายการแล้ว");
        else if (d.optBoolean("running")) alarm(c, d, Math.max(System.currentTimeMillis() + 1000, d.optLong("nextAt")), false);
        }
    }

    static void recoverTimeout(Context c, JSONObject d) {
        synchronized (LOCK) {
            JSONObject latest = Store.load(c);
            if (!d.optString("id").equals(latest.optString("id"))) return;
            recoverTimeoutLocked(c, latest);
        }
    }
    private static void recoverTimeoutLocked(Context c, JSONObject d) {
        int i = Store.sending(d);
        if (i < 0) return;
        JSONObject row = Store.rows(d).optJSONObject(i);
        if (System.currentTimeMillis() < row.optLong("deadline")) return;
        Store.put(row, "status", "UNKNOWN");
        pauseLocked(c, d, "ไม่ได้รับผล SMS ภายใน 5 นาที — หยุดคิวและไม่ส่งเบอร์นี้ซ้ำ");
    }
    static void bootPause(Context c) {
        synchronized (LOCK) {
            JSONObject d = Store.load(c);
            if (d.optString("id").isEmpty()) return;
            int i = Store.sending(d);
            if (i >= 0) Store.put(Store.rows(d).optJSONObject(i), "status", "UNKNOWN");
            pauseLocked(c, d, "เครื่องรีสตาร์ต กรุณาเปิดแอปและกดทำต่อ");
        }
    }
    static void failClosed(Context c, RuntimeException error) {
        try { pause(c, Store.load(c), "หยุด: " + error.getMessage()); }
        catch (RuntimeException ignored) { /* Atomic store remains intact; do not send on storage failures. */ }
    }
}
