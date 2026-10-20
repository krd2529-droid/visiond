package com.smsmix.app;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;
import org.json.JSONObject;

/** Local, best-effort sender identity captured for the subscription actually handed to telephony. */
final class SenderIdentity {
    static String manualKey(int subscriptionId) { return "senderPhoneSubscription" + subscriptionId; }

    static void snapshot(Context context, JSONObject row, int subscriptionId) {
        Store.put(row, "usedSim", subscriptionId);
        SubscriptionInfo info = null;
        SubscriptionManager manager = context.getSystemService(SubscriptionManager.class);
        try {
            if (manager != null && context.checkSelfPermission(Manifest.permission.READ_PHONE_STATE)
                    == PackageManager.PERMISSION_GRANTED)
                info = manager.getActiveSubscriptionInfo(subscriptionId);
        } catch (RuntimeException ignored) { /* Sending must not depend on number lookup. */ }
        int slot = -1;
        try { if (info != null) slot = info.getSimSlotIndex(); }
        catch (RuntimeException ignored) { /* An unavailable label must not block sending. */ }
        Store.put(row, "usedSimLabel", slot >= 0 ? "SIM " + (slot + 1) : "ไม่ทราบซิมผู้ส่ง");
        String number = "";
        try {
            if (manager != null && info != null) {
                if (Build.VERSION.SDK_INT >= 33) {
                    if (context.checkSelfPermission(Manifest.permission.READ_PHONE_NUMBERS)
                            == PackageManager.PERMISSION_GRANTED)
                        number = manager.getPhoneNumber(subscriptionId);
                } else number = info.getNumber();
            }
        } catch (RuntimeException ignored) { /* Permission/telephony failures are optional. */ }
        number = number == null ? "" : number.trim();
        String source = number.isEmpty() ? "unknown" : "api";
        if (number.isEmpty() && slot >= 0) {
            number = context.getSharedPreferences("MainActivity", 0)
                    .getString(manualKey(subscriptionId), "").trim();
            if (!number.isEmpty()) source = "manual";
        }
        Store.put(row, "senderPhone", number);
        Store.put(row, "senderPhoneSource", source);
    }

    static String sim(JSONObject row) {
        String label = row.optString("usedSimLabel");
        return label.isEmpty() ? "ไม่ทราบซิมผู้ส่ง" : label;
    }
    static String phone(JSONObject row) {
        String number = row.optString("senderPhone");
        return number.isEmpty() ? "ไม่ทราบเบอร์ผู้ส่ง" : number;
    }
    static String source(JSONObject row) {
        if (row.optString("senderPhone").isEmpty()) return "unknown";
        return "manual".equals(row.optString("senderPhoneSource")) ? "ผู้ใช้ระบุ" : "ระบบรายงาน (อาจไม่ตรง)";
    }
    static String display(JSONObject row) {
        return sim(row) + " • เบอร์ผู้ส่ง: " + phone(row)
                + ("unknown".equals(source(row)) ? "" : " (" + source(row) + ")");
    }
}
