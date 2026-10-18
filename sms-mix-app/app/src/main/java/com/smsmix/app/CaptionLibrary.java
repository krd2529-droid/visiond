package com.smsmix.app;

import android.content.Context;
import android.util.AtomicFile;
import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

final class CaptionLibrary {
    static AtomicFile file(Context c) {
        return new AtomicFile(new File(c.getFilesDir(), "caption-library.json"));
    }
    static String name(String value) {
        String name = value.trim();
        if (name.isEmpty() || name.length() > 60 || name.matches("(?s).*\\p{Cntrl}.*"))
            throw new IllegalArgumentException("ชื่อชุดต้องมี 1–60 ตัวอักษร และไม่มีอักขระขึ้นบรรทัดใหม่");
        return name;
    }
    static SortedMap<String,String> load(Context c) {
        synchronized (LibraryTransfer.class) {
        AtomicFile file = file(c);
        try (InputStream in = file.openRead()) {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192]; int n;
            while ((n = in.read(buffer)) != -1) bytes.write(buffer, 0, n);
            JSONObject json = new JSONObject(new String(bytes.toByteArray(), StandardCharsets.UTF_8));
            SortedMap<String,String> result = new TreeMap<>();
            Iterator<String> keys = json.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                Object value = json.get(key);
                if (!key.equals(name(key)) || !(value instanceof String))
                    throw new IOException("Invalid caption library");
                CampaignCore.lines((String)value, false);
                result.put(key, (String)value);
            }
            return result;
        } catch (FileNotFoundException e) {
            if (!file.getBaseFile().exists() && !new File(file.getBaseFile().getPath()+".bak").exists())
                return new TreeMap<>();
            throw new IllegalStateException("อ่านชุดแคปชั่นไม่ได้", e);
        } catch (Exception e) {
            throw new IllegalStateException("อ่านชุดแคปชั่นไม่ได้ ข้อมูลเดิมจะไม่ถูกเขียนทับ", e);
        }
        }
    }
    static void save(Context c, String title, String text, boolean overwrite) {
        synchronized (LibraryTransfer.class) {
        String key = name(title);
        String normalized = String.join("\n", CampaignCore.lines(text, false));
        SortedMap<String,String> all = load(c);
        if (all.containsKey(key) && !overwrite)
            throw new IllegalArgumentException("มีชุดชื่อนี้แล้ว กรุณายืนยันการบันทึกทับ");
        all.put(key, normalized);
        AtomicFile file = file(c);
        FileOutputStream out = null;
        try {
            out = file.startWrite();
            out.write(new JSONObject(all).toString().getBytes(StandardCharsets.UTF_8));
            file.finishWrite(out);
        } catch (Exception e) {
            if (out != null) file.failWrite(out);
            throw new IllegalStateException("บันทึกชุดแคปชั่นไม่สำเร็จ", e);
        }
        }
    }
}
