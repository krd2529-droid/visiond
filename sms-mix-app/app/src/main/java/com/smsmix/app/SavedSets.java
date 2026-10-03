package com.smsmix.app;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Iterator;
import java.util.List;

final class SavedSets {
    private static final int MAX_SETS = 20;
    private static final String PREFS = "saved_sets";

    private static String kind(String value) {
        if (!"captions".equals(value) && !"phones".equals(value)) throw new IllegalArgumentException("ชนิดชุดข้อมูลไม่ถูกต้อง");
        return value;
    }
    private static SharedPreferences prefs(Context context) { return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }
    private static JSONObject data(Context context, String category) {
        try { return new JSONObject(prefs(context).getString(kind(category), "{}")); }
        catch (Exception error) { throw new IllegalStateException("อ่านชุดข้อมูลที่บันทึกไว้ไม่ได้", error); }
    }
    static synchronized void save(Context context, String category, String name, String contents) {
        String title = String.valueOf(name).trim();
        if (title.isEmpty() || title.length() > 60) throw new IllegalArgumentException("ชื่อชุดข้อมูลต้องมี 1–60 ตัวอักษร");
        if (contents == null || contents.isEmpty() || contents.getBytes(StandardCharsets.UTF_8).length > 256 * 1024)
            throw new IllegalArgumentException("ชุดข้อมูลต้องไม่ว่างและไม่เกิน 256 KB");
        JSONObject object = data(context, category);
        if (!object.has(title) && object.length() >= MAX_SETS) throw new IllegalStateException("บันทึกได้สูงสุด 20 ชุดต่อประเภท");
        try { object.put(title, contents); }
        catch (Exception error) { throw new IllegalStateException("บันทึกชุดข้อมูลไม่ได้", error); }
        if (!prefs(context).edit().putString(kind(category), object.toString()).commit()) throw new IllegalStateException("บันทึกชุดข้อมูลไม่ได้");
    }
    static synchronized List<String> names(Context context, String category) {
        JSONObject object = data(context, category);
        List<String> result = new ArrayList<>();
        Iterator<String> keys = object.keys();
        while (keys.hasNext()) result.add(keys.next());
        Collections.sort(result);
        return result;
    }
    static synchronized String read(Context context, String category, String name) {
        return data(context, category).optString(name, "");
    }
    static synchronized void delete(Context context, String category, String name) {
        JSONObject object = data(context, category);
        object.remove(name);
        if (!prefs(context).edit().putString(kind(category), object.toString()).commit()) throw new IllegalStateException("ลบชุดข้อมูลไม่ได้");
    }
    static void clearForTests(Context context) { prefs(context).edit().clear().commit(); }
}
