package com.smsmix.app;

import android.content.Context;
import android.util.AtomicFile;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;

final class Store {
    static void put(JSONObject object, String key, Object value) {
        try { object.put(key, value); } catch (JSONException e) { throw new IllegalStateException(e); }
    }
    static JSONObject object() { return new JSONObject(); }
    static AtomicFile file(Context c) { return new AtomicFile(new File(c.getFilesDir(), "campaign.json")); }
    static synchronized JSONObject load(Context c) {
        AtomicFile f = file(c);

        try (FileInputStream in = f.openRead()) {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192]; int n;
            while ((n = in.read(buffer)) != -1) bytes.write(buffer, 0, n);
            return new JSONObject(new String(bytes.toByteArray(), StandardCharsets.UTF_8));
        } catch (FileNotFoundException e) {
            if (!f.getBaseFile().exists() && !new File(f.getBaseFile().getPath() + ".bak").exists()) return object();
            throw new IllegalStateException("อ่านคิวเดิมไม่ได้", e);
        } catch (Exception e) {
            // Never replace unreadable state with a fresh queue: that could resend numbers.
            throw new IllegalStateException("อ่านคิวไม่ได้ กรุณาเก็บข้อมูลเดิมไว้และติดต่อผู้พัฒนา", e);
        }
    }
    static synchronized void save(Context c, JSONObject data) {
        AtomicFile f = file(c);
        FileOutputStream out = null;
        try {
            out = f.startWrite();
            out.write(data.toString().getBytes(StandardCharsets.UTF_8));
            f.finishWrite(out);
        } catch (Exception e) {
            if (out != null) f.failWrite(out);
            throw new IllegalStateException("บันทึกคิวไม่สำเร็จ จึงยังไม่ส่งข้อความ", e);
        }
    }
    static JSONArray rows(JSONObject data) {
        JSONArray a = data.optJSONArray("rows");
        return a == null ? new JSONArray() : a;
    }
    static int pending(JSONObject data) {
        JSONArray a = rows(data);
        for (int i = 0; i < a.length(); i++)
            if ("PENDING".equals(a.optJSONObject(i).optString("status"))) return i;
        return -1;
    }
    static int sending(JSONObject data) {
        JSONArray a = rows(data);
        for (int i = 0; i < a.length(); i++)
            if ("SENDING".equals(a.optJSONObject(i).optString("status"))) return i;
        return -1;
    }
}
