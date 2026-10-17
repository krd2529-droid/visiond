package com.smsmix.app;

import android.content.Context;
import org.json.*;
import java.util.*;

final class CampaignFactory {
    static Set<String> history(JSONObject previous) {
        Set<String> used = new LinkedHashSet<>();
        if (previous.has("drawnPhones") && !(previous.opt("drawnPhones") instanceof JSONArray))
            throw new IllegalStateException("ประวัติการสุ่มเสียหาย หยุดเพื่อป้องกันเบอร์ซ้ำ");
        JSONArray saved = previous.optJSONArray("drawnPhones");
        if (saved != null) for (int i = 0; i < saved.length(); i++) {
            Object item = saved.opt(i);
            if (!(item instanceof String)) throw new IllegalStateException("ประวัติการสุ่มเสียหาย");
            used.add(CampaignCore.normalizePhone((String)item));
        }
        // Upgrade: all numbers still present in a v0.1.0 queue are reserved.
        JSONArray rows = Store.rows(previous);
        for (int i = 0; i < rows.length(); i++)
            used.add(CampaignCore.normalizePhone(rows.optJSONObject(i).optString("phone")));
        return used;
    }

    static synchronized JSONObject create(Context context, boolean rangeMode, List<String> imported,
            String first, String last, int count, List<String> captions, List<String> links,
            int sim, String simLabel, Random random) {
        JSONObject previous = Store.load(context);
        SuccessLog.record(context, previous);
        if (previous.optBoolean("running") || Store.sending(previous) >= 0)
            throw new IllegalStateException("หยุดคิวและรอผลข้อความปัจจุบันก่อนสร้างคิวใหม่");
        // Validate at commit as well as in the UI; no history changes on invalid input.
        CampaignCore.lines(String.join("\n", captions), false);
        CampaignCore.lines(String.join("\n", links), true);
        Set<String> used = history(previous);
        List<String> selected = rangeMode
                ? RecipientSampler.fromRange(first, last, used, count, random)
                : RecipientSampler.fromFile(imported, used, count, random);
        JSONObject data = Store.object();
        Store.put(data, "id", UUID.randomUUID().toString());
        Store.put(data, "sim", sim); Store.put(data, "simLabel", simLabel);
        Store.put(data, "running", false); Store.put(data, "note", "พร้อมตรวจพรีวิว");
        Store.put(data, "recipientMode", rangeMode ? "range" : "file");
        JSONArray rows = new JSONArray();
        for (String phone : selected) {
            JSONObject row = Store.object();
            Store.put(row, "phone", phone);
            Store.put(row, "body", CampaignCore.pair(captions, links, random));
            String body = row.optString("body");
            Store.put(row, "link", body.substring(body.lastIndexOf('\n') + 1));
            Store.put(row, "status", "PENDING"); rows.put(row);
        }
        used.addAll(selected);
        Store.put(data, "drawnPhones", new JSONArray(used));
        Store.put(data, "rows", rows);
        Store.save(context, data); // One atomic commit reserves history and publishes the queue.
        return data;
    }
}
