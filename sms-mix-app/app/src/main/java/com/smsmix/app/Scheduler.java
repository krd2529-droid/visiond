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
    interface Handoff { void send(SmsManager manager, JSONObject row, ArrayList<String> parts, ArrayList<PendingIntent> callbacks, ArrayList<PendingIntent> deliveries); }
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
        CampaignService.stop(c);
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
    static boolean alternating(JSONObject d) { return "alternate".equals(d.optString("simMode")); }
    private static boolean activeSim(Context c, int id, int slot) {
        if (c.checkSelfPermission(Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED)
            return false;
        SubscriptionManager subscriptions = c.getSystemService(SubscriptionManager.class);
        SubscriptionInfo active = subscriptions == null ? null : subscriptions.getActiveSubscriptionInfo(id);
        return active != null && active.getSimSlotIndex() == slot;
    }
    static void checkPermissions(Context c, JSONObject d) {
        int first = d.optInt("sim", -1);
        if (!alternating(d)) { checkPermissions(c, first); return; } // Existing one-SIM queues.
        if (c.checkSelfPermission(Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED
                || c.checkSelfPermission(Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED)
            throw new IllegalStateException("กรุณาอนุญาต SMS และการอ่านข้อมูลซิม");
        if (!exactAllowed(c)) throw new IllegalStateException("กรุณาเปิดสิทธิ์นาฬิกาปลุกและการช่วยเตือน");
        int second = d.optInt("alternateSim", -1);
        if (first < 0 || second < 0 || first == second)
            throw new IllegalStateException("ข้อมูล SIM 1 / SIM 2 ของคิวไม่ถูกต้อง");
        int fallback = d.optInt("fallbackSim", -1);
        if (fallback >= 0) {
            if (fallback != first && fallback != second || !activeSim(c, fallback, fallback == first ? 0 : 1))
                throw new IllegalStateException("ซิมที่ทำงานต่อไม่พร้อม หยุดคิวก่อนส่ง");
        } else if (!activeSim(c, first, 0) && !activeSim(c, second, 1))
            throw new IllegalStateException("SIM 1 และ SIM 2 ไม่พร้อมทั้งคู่ หยุดคิวก่อนส่ง");
    }
    static int simForRow(JSONObject d, JSONObject row, int index) {
        int first = d.optInt("sim", -1);
        if (!alternating(d)) return first;
        int expected = index % 2 == 0 ? first : d.optInt("alternateSim", -1);
        if (expected < 0 || row == null || row.optInt("sim", -1) != expected)
            throw new IllegalStateException("ข้อมูลลำดับซิมของคิวไม่ตรง หยุดเพื่อป้องกันการส่งผิดซิม");
        int fallback = d.optInt("fallbackSim", -1);
        return fallback >= 0 ? fallback : expected;
    }
    static void resume(Context c, JSONObject d) {
        LicenseClient.requireCurrent(c);
        synchronized (LOCK) {
        JSONObject fresh = Store.load(c);
        if (!d.optString("id").equals(fresh.optString("id"))) throw new IllegalStateException("คิวเปลี่ยน กรุณาตรวจพรีวิวใหม่");
        d = fresh;
        checkPermissions(c, d);
        recoverTimeout(c, d);
        if (Store.sending(d) >= 0) throw new IllegalStateException("กำลังรอผล SMS ปัจจุบัน");
        if (Store.pending(d) < 0) throw new IllegalStateException("ไม่มีเบอร์ค้างส่ง");
        Store.put(d, "running", true);
        Store.put(d, "note", "กำลังทำงาน");
        Store.save(c, d);
        try { CampaignService.start(c); alarm(c, d, Math.max(System.currentTimeMillis() + 1000, d.optLong("nextAt")), false); }
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
                    pauseLocked(c, latest, "ยืนยันสิทธิ์ออนไลน์ไม่ได้ คิวถูกหยุด กรุณาตรวจอินเทอร์เน็ตและคีย์");
            }
            return;
        }
        synchronized (LOCK) {
        d = Store.load(c);
        if (!id.equals(d.optString("id")) || !d.optBoolean("running") || Store.sending(d) >= 0) return;
        if (System.currentTimeMillis() < d.optLong("nextAt")) { alarm(c, d, d.optLong("nextAt"), false); return; }
        i = Store.pending(d);
        if (i < 0) { pauseLocked(c, d, "ครบรายการแล้ว"); return; }
        JSONObject row = Store.rows(d).optJSONObject(i);
        final int selectedSim;
        try {
            checkPermissions(c, d);
            selectedSim = simForRow(d, row, i);
        } catch (RuntimeException error) {
            pauseLocked(c, d, "หยุดคิว: " + error.getMessage());
            return;
        }
        if (alternating(d) && !activeSim(c, selectedSim, selectedSim == d.optInt("sim") ? 0 : 1)) {
            // Consume only the affected recipient, then persist the surviving SIM for later rows.
            int other = selectedSim == d.optInt("sim") ? d.optInt("alternateSim") : d.optInt("sim");
            if (d.optInt("fallbackSim", -1) >= 0 || !activeSim(c, other, other == d.optInt("sim") ? 0 : 1)) {
                pauseLocked(c, d, "ซิมที่ใช้ส่งไม่พร้อม และไม่มีซิมสำรองที่ใช้งานได้");
                return;
            }
            Store.put(row, "status", "SKIPPED");
            Store.put(row, "resultAt", System.currentTimeMillis());
            Store.put(row, "error", "ไม่ได้ส่ง: ซิมที่กำหนดไม่พร้อม/ถูกเปลี่ยน ไม่ส่งเบอร์นี้ซ้ำ");
            Store.put(d, "fallbackSim", other);
            Store.put(d, "fallbackAtIndex", i);
            int next = Store.pending(d);
            if (i % 2 == 0 && next == i + 1) Store.put(d, "nextAt", System.currentTimeMillis());
            else {
                JSONObject firstRow = i % 2 == 1 ? Store.rows(d).optJSONObject(i - 1) : null;
                boolean success = firstRow != null && "SENT".equals(firstRow.optString("status"));
                Store.put(d, "nextAt", System.currentTimeMillis() + (success
                        ? CampaignCore.delay(RANDOM) : (5 + RANDOM.nextInt(6)) * 60_000L));
            }
            Store.put(d, "note", "ข้ามเบอร์ที่ซิมไม่พร้อม — ทำต่อด้วยซิมที่ใช้งานได้ ไม่ส่งเบอร์เดิมซ้ำ");
            Store.save(c, d);
            if (next < 0) pauseLocked(c, d, "ครบรายการแล้ว");
            else alarm(c, d, Math.max(System.currentTimeMillis() + 1000, d.optLong("nextAt")), false);
            return;
        }
        SmsManager sm = sms(selectedSim);
        ArrayList<String> parts = sm.divideMessage(row.optString("body"));
        JSONArray results = new JSONArray();
        ArrayList<PendingIntent> callbacks = new ArrayList<>();
        ArrayList<PendingIntent> deliveries = new ArrayList<>();
        JSONArray deliveryParts = new JSONArray();
        for (int p = 0; p < parts.size(); p++) {
            results.put(0);
            deliveryParts.put(-1);
            Intent delivered = new Intent(c, DeliveredReceiver.class)
                    .setData(Uri.parse("smsmix://delivered/" + id + "/" + i + "/" + p))
                    .putExtra("id", id).putExtra("row", i).putExtra("part", p);
            deliveries.add(PendingIntent.getBroadcast(c, 0, delivered, PendingIntent.FLAG_UPDATE_CURRENT
                    | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0)));
            Intent result = new Intent(c, SentReceiver.class)
                    .setData(Uri.parse("smsmix://sent/" + id + "/" + i + "/" + p))
                    .putExtra("id", id).putExtra("row", i).putExtra("part", p);
            callbacks.add(PendingIntent.getBroadcast(c, 0, result,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        }
        long now = System.currentTimeMillis();
        Store.put(row, "status", "SENDING");
        if (alternating(d)) {
            Store.put(row, "usedSim", selectedSim);
            Store.put(row, "usedSimLabel", selectedSim == d.optInt("sim") ? "SIM 1" : "SIM 2");
        }
        Store.put(row, "parts", results);
        Store.put(row, "deliveryParts", deliveryParts);
        Store.put(row, "sentAt", now);
        Store.put(row, "deadline", now + 5 * 60_000L);
        // A round is SIM 1 followed by SIM 2 after its callback, then one delay.
        Store.put(d, "nextAt", alternating(d) && d.optInt("fallbackSim", -1) < 0 && i % 2 == 0
                ? now : now + CampaignCore.delay(RANDOM));
        Store.save(c, d); // Persist before telephony side effect, never automatically retry SENDING.
        try {
            alarm(c, d, row.optLong("deadline"), true);
            Handoff handoff = testHandoff;
            if (handoff != null) handoff.send(sm, row, parts, callbacks, deliveries);
            else if (parts.size() == 1)
                sm.sendTextMessage(row.optString("phone"), null, parts.get(0), callbacks.get(0), deliveries.get(0));
            else sm.sendMultipartTextMessage(row.optString("phone"), null, parts, callbacks, deliveries);
        } catch (RuntimeException e) {
            Store.put(row, "status", "UNKNOWN");
            Store.put(row, "resultAt", System.currentTimeMillis());
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
        if (code == SmsManager.RESULT_ERROR_NO_SERVICE) Store.put(row, "noService", true);
        boolean complete = true, ok = true;
        for (int n = 0; n < parts.length(); n++) {
            if (parts.optInt(n) == 0) complete = false;
            if (parts.optInt(n) != 1) ok = false;
        }
        Store.save(c, d);
        if (!complete) return;
        cancel(c, d, true);
        Store.put(row, "status", ok ? "SENT" : "FAILED");
        Store.put(row, "resultAt", System.currentTimeMillis());
        int next = Store.pending(d);
        boolean noServiceWithoutFallback = false;
        if (alternating(d)) {
            if (row.optBoolean("noService")) {
                int other = row.optInt("usedSim") == d.optInt("sim")
                        ? d.optInt("alternateSim") : d.optInt("sim");
                if (d.optInt("fallbackSim", -1) >= 0
                        || !activeSim(c, other, other == d.optInt("sim") ? 0 : 1))
                    noServiceWithoutFallback = true;
                else {
                    Store.put(d, "fallbackSim", other);
                    Store.put(d, "fallbackAtIndex", i);
                }
            }
            if (i % 2 == 0 && next == i + 1
                    && (d.optInt("fallbackSim", -1) < 0 || d.optInt("fallbackAtIndex", -1) == i)) {
                // Never overlap handoffs: only the completed result unlocks SIM 2.
                Store.put(d, "nextAt", System.currentTimeMillis());
                if (d.optBoolean("running")) Store.put(d, "note", "SIM 1 เสร็จแล้ว — ส่ง SIM 2 ต่อทันที ไม่ส่งเบอร์เดิมซ้ำ");
            } else {
                JSONObject first = i % 2 == 1 ? Store.rows(d).optJSONObject(i - 1) : null;
                boolean oneSucceeded = ok || first != null && "SENT".equals(first.optString("status"));
                boolean oneSimCadence = d.optInt("fallbackSim", -1) >= 0
                        && i > d.optInt("fallbackAtIndex", Integer.MAX_VALUE);
                long delay = oneSimCadence || oneSucceeded ? CampaignCore.delay(RANDOM)
                        : (5 + RANDOM.nextInt(6)) * 60_000L;
                Store.put(d, "nextAt", System.currentTimeMillis() + delay);
                if (d.optBoolean("running")) Store.put(d, "note", oneSimCadence
                        ? "ทำต่อด้วยซิมที่ใช้งานได้ — รอ 10–30 นาทีต่อเบอร์ ไม่ส่งเบอร์เดิมซ้ำ"
                        : oneSucceeded ? "จบรอบ SIM 1 / SIM 2 — รอ 10–30 นาที ก่อนรอบถัดไป"
                        : "ทั้งรอบส่งไม่สำเร็จ — รอ 5–10 นาที ไม่ส่งเบอร์เดิมซ้ำ");
            }
        } else if (!ok) {
            Store.put(d, "nextAt", System.currentTimeMillis() + (5 + RANDOM.nextInt(6)) * 60_000L);
            if (d.optBoolean("running")) Store.put(d, "note", "ส่งไม่สำเร็จ — รอ 5–10 นาทีแล้วส่งเบอร์ถัดไป ไม่ส่งเบอร์เดิมซ้ำ");
        } else if (d.optBoolean("running")) Store.put(d, "note", "ส่งสำเร็จ — รอส่งเบอร์ถัดไป");
        Store.save(c, d);
        SuccessLog.record(c, d);
        if (noServiceWithoutFallback) pauseLocked(c, d, "ซิมไม่มีสัญญาณและไม่มีซิมสำรองที่ใช้งานได้ — หยุดคิว");
        else if (Store.pending(d) < 0) pause(c, d, "ครบรายการแล้ว");
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
        Store.put(row, "resultAt", System.currentTimeMillis());
        pauseLocked(c, d, "ไม่ได้รับผล SMS ภายใน 5 นาที — หยุดคิวและไม่ส่งเบอร์นี้ซ้ำ");
    }
    static void bootPause(Context c) {
        synchronized (LOCK) {
            JSONObject d = Store.load(c);
            if (d.optString("id").isEmpty()) return;
            int i = Store.sending(d);
            if (i >= 0) {
                JSONObject row = Store.rows(d).optJSONObject(i);
                Store.put(row, "status", "UNKNOWN");
                Store.put(row, "resultAt", System.currentTimeMillis());
            }
            pauseLocked(c, d, "เครื่องรีสตาร์ต กรุณาเปิดแอปและกดทำต่อ");
        }
    }
    static void failClosed(Context c, RuntimeException error) {
        try { pause(c, Store.load(c), "หยุด: " + error.getMessage()); }
        catch (RuntimeException ignored) { /* Atomic store remains intact; do not send on storage failures. */ }
    }
}
