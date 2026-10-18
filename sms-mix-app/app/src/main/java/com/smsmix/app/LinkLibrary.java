package com.smsmix.app;

import android.content.Context;
import android.util.AtomicFile;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

final class LinkLibrary {
    static AtomicFile file(Context c) {return new AtomicFile(new File(c.getFilesDir(),"link-library.json"));}
    static JSONObject bundle(JSONObject job) {
        JSONObject request=job.optJSONObject("request");
        JSONArray items=request==null?null:request.optJSONArray("urls");
        JSONArray results=job.optJSONArray("results");
        if(items==null || items.length()<1 || items.length()>100 || results==null || results.length()<1)
            throw new IllegalArgumentException("ยังไม่มีผลลิงก์ที่บันทึกได้");
        String original=items.optJSONObject(0).optString("original_url");
        Set<String> expected=new HashSet<>();
        for(int i=0;i<items.length();i++) {
            JSONObject item=items.optJSONObject(i);
            if(!original.equals(item.optString("original_url"))) throw new IllegalArgumentException("ปลายทางในชุดไม่ตรงกัน");
            expected.add("https://g.shrinkrl.com/"+item.optString("slug"));
        }
        Set<String> unique=new LinkedHashSet<>();
        for(int i=0;i<results.length();i++) {
            String link=results.optString(i);
            if(!expected.contains(link) || !unique.add(link)) throw new IllegalArgumentException("ผลลิงก์ไม่ถูกต้องหรือซ้ำ");
        }
        JSONObject entry=Store.object();
        Store.put(entry,"original_url",original); Store.put(entry,"short_urls",new JSONArray(unique));
        Store.put(entry,"requested_count",items.length()); Store.put(entry,"saved_at",System.currentTimeMillis());
        validate(entry); return entry;
    }
    static JSONObject manual(String original, String pasted) {
        String destination=original.trim();
        Set<String> urls=new LinkedHashSet<>();
        for(String line:pasted.split("\\R")) {
            if(!line.trim().isEmpty()) urls.add(line.trim());
        }
        if(urls.isEmpty() || urls.size()>100)
            throw new IllegalArgumentException("ใส่ลิงก์ย่อ 1–100 รายการ บรรทัดละลิงก์");
        JSONObject entry=Store.object();
        Store.put(entry,"source","manual");
        Store.put(entry,"original_url",destination);
        Store.put(entry,"short_urls",new JSONArray(urls));
        Store.put(entry,"requested_count",urls.size());
        Store.put(entry,"saved_at",System.currentTimeMillis());
        validate(entry); return entry;
    }
    static void validate(JSONObject entry) {
        if(entry==null) throw new IllegalArgumentException("ข้อมูลชุดลิงก์เสียหาย");
        String original=entry.optString("original_url");
        if(!"manual".equals(entry.optString("source"))) ShortLinkClient.destination(original);
        JSONArray links=entry.optJSONArray("short_urls");
        int requested=entry.optInt("requested_count",0);
        if(links==null || links.length()<1 || links.length()>100 || requested<links.length() || requested>100)
            throw new IllegalArgumentException("จำนวนลิงก์ในชุดไม่ถูกต้อง");
        Set<String> seen=new HashSet<>();
        for(int i=0;i<links.length();i++) {
            Object v=links.opt(i);
            if(!(v instanceof String) || ((String)v).trim().isEmpty() || !seen.add((String)v))
                throw new IllegalArgumentException("ลิงก์ในชุดเสียหาย");
            if(!"manual".equals(entry.optString("source")) && !((String)v).matches("https://g[.]shrinkrl[.]com/[A-Za-z0-9_-]{3,20}"))
                throw new IllegalArgumentException("ลิงก์ในชุดเสียหาย");
        }
    }
    static SortedMap<String,JSONObject> load(Context c) {
        synchronized (LibraryTransfer.class) {
        AtomicFile f=file(c);
        try(InputStream in=f.openRead()) {
            ByteArrayOutputStream out=new ByteArrayOutputStream(); byte[] buffer=new byte[8192]; int n;
            while((n=in.read(buffer))!=-1) out.write(buffer,0,n);
            JSONObject json=new JSONObject(out.toString("UTF-8"));
            SortedMap<String,JSONObject> map=new TreeMap<>();
            Iterator<String> keys=json.keys();
            while(keys.hasNext()) {
                String key=keys.next();
                if(!key.equals(CaptionLibrary.name(key))) throw new IOException("Invalid name");
                JSONObject entry=json.getJSONObject(key); validate(entry); map.put(key,entry);
            }
            return map;
        } catch(FileNotFoundException e) {
            if(!f.getBaseFile().exists() && !new File(f.getBaseFile().getPath()+".bak").exists()) return new TreeMap<>();
            throw new IllegalStateException("อ่านชุดลิงก์ไม่ได้",e);
        } catch(Exception e) {throw new IllegalStateException("อ่านชุดลิงก์ไม่ได้ ข้อมูลเดิมจะไม่ถูกเขียนทับ",e);}
        }
    }
    static void save(Context c,String title,JSONObject entry,boolean overwrite) {
        synchronized (LibraryTransfer.class) {
        String name=CaptionLibrary.name(title); validate(entry);
        SortedMap<String,JSONObject> all=load(c);
        if(all.containsKey(name) && !overwrite) throw new IllegalArgumentException("ชื่อซ้ำ กรุณายืนยันก่อนบันทึกทับ");
        all.put(name,entry);
        AtomicFile f=file(c); FileOutputStream out=null;
        try {
            out=f.startWrite(); out.write(new JSONObject(all).toString().getBytes(StandardCharsets.UTF_8));
            f.finishWrite(out);
        } catch(Exception e) {
            if(out!=null)f.failWrite(out);
            throw new IllegalStateException("บันทึกชุดลิงก์ไม่สำเร็จ",e);
        }
        }
    }
    static String shortText(JSONObject entry) {
        validate(entry); JSONArray urls=entry.optJSONArray("short_urls"); List<String> result=new ArrayList<>();
        for(int i=0;i<urls.length();i++) result.add(urls.optString(i));
        return String.join("\n",result);
    }
}
