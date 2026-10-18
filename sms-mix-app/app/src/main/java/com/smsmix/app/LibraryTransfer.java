package com.smsmix.app;

import android.content.Context;
import android.util.AtomicFile;
import android.util.Base64;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.nio.ByteBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Offline, named-set-only backup. Never reads drafts, recipients, license or campaign files. */
final class LibraryTransfer {
    static final int MAX_BYTES = 16 * 1024 * 1024;
    private static final int MAX_SETS_PER_KIND = 10000;
    static final int REJECT_CONFLICTS = 0, OVERWRITE_CONFLICTS = 1, SKIP_CONFLICTS = 2;
    private static final String FORMAT = "vsms-saved-sets";
    private LibraryTransfer() {}

    static final class Snapshot {
        final SortedMap<String,String> captions;
        final SortedMap<String,JSONObject> links;
        Snapshot(SortedMap<String,String> captions, SortedMap<String,JSONObject> links) {
            this.captions = captions; this.links = links;
        }
    }
    static final class Preview {
        final int captions, links, conflicts;
        Preview(int captions, int links, int conflicts) {
            this.captions = captions; this.links = links; this.conflicts = conflicts;
        }
    }

    static AtomicFile journal(Context c) {
        return new AtomicFile(new File(c.getFilesDir(), "library-transfer-journal.json"));
    }
    static boolean journalPending(Context c) {
        return exists(journal(c));
    }
    private static boolean exists(AtomicFile file) {
        String path=file.getBaseFile().getPath();
        return file.getBaseFile().exists() || new File(path+".bak").exists() || new File(path+".new").exists();
    }
    private static void deleteChecked(AtomicFile file) throws IOException {
        file.delete();
        if(exists(file))throw new IOException("ลบข้อมูลธุรกรรมเดิมไม่สำเร็จ");
    }
    private static byte[] read(InputStream in, int limit) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192]; int n;
        while ((n = in.read(buffer)) != -1) {
            if (n > limit - out.size()) throw new IOException("ไฟล์ชุดใหญ่เกิน 16 MB");
            out.write(buffer, 0, n);
        }
        return out.toByteArray();
    }
    private static String utf8(byte[] bytes) throws Exception {
        return StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString();
    }
    private static void fields(JSONObject value, String... allowed) {
        Set<String> names = new HashSet<>(Arrays.asList(allowed));
        Iterator<String> keys = value.keys();
        while (keys.hasNext()) if (!names.remove(keys.next()))
            throw new IllegalArgumentException("รูปแบบไฟล์ชุดไม่ถูกต้อง");
        if (!names.isEmpty()) throw new IllegalArgumentException("รูปแบบไฟล์ชุดไม่ครบ");
    }
    private static void linkFields(JSONObject value) {
        Set<String> allowed = new HashSet<>(Arrays.asList("original_url", "short_urls", "requested_count", "saved_at", "source"));
        Iterator<String> keys = value.keys();
        while (keys.hasNext()) if (!allowed.remove(keys.next()))
            throw new IllegalArgumentException("ข้อมูลชุดลิงก์มีช่องที่ไม่รองรับ");
        if (value.length() < 4 || !value.has("original_url") || !value.has("short_urls")
                || !value.has("requested_count") || !value.has("saved_at"))
            throw new IllegalArgumentException("ข้อมูลชุดลิงก์ไม่ครบ");
    }
    private static boolean integer(Object value, long minimum, long maximum) {
        if (!(value instanceof Number)) return false;
        double number=((Number)value).doubleValue();
        return Double.isFinite(number) && number>=minimum && number<=maximum
                && number==Math.rint(number);
    }
    private static JSONObject cleanLink(JSONObject entry) throws Exception {
        linkFields(entry);
        if (!(entry.get("original_url") instanceof String) || !(entry.get("short_urls") instanceof JSONArray)
                || !(entry.get("requested_count") instanceof Number) || !(entry.get("saved_at") instanceof Number))
            throw new IllegalArgumentException("ชนิดข้อมูลชุดลิงก์ไม่ถูกต้อง");
        if (entry.has("source") && (!"manual".equals(entry.get("source"))))
            throw new IllegalArgumentException("แหล่งชุดลิงก์ไม่ถูกต้อง");
        String original = entry.getString("original_url");
        if (original.length() > MAX_BYTES
                || !integer(entry.get("saved_at"),0,Long.MAX_VALUE)
                || !integer(entry.get("requested_count"),1,100))
            throw new IllegalArgumentException("ข้อมูลชุดลิงก์ยาวหรือจำนวนไม่ถูกต้อง");
        JSONArray urls = entry.getJSONArray("short_urls");
        for (int i=0; i<urls.length(); i++)
            if (!(urls.get(i) instanceof String) || urls.getString(i).length() > MAX_BYTES
                    || urls.getString(i).matches("(?s).*\\R.*") || urls.getString(i).indexOf('\u0000')>=0)
                throw new IllegalArgumentException("ลิงก์ยาวหรือชนิดข้อมูลไม่ถูกต้อง");
        LinkLibrary.validate(entry);
        return entry;
    }
    static Snapshot parse(InputStream input) throws Exception {
        byte[] bytes = read(input, MAX_BYTES);
        JSONObject root = new JSONObject(utf8(bytes));
        fields(root, "format", "version", "captions", "links");
        if (!FORMAT.equals(root.get("format")) || !integer(root.get("version"),1,1)
                || !(root.get("captions") instanceof JSONArray)
                || !(root.get("links") instanceof JSONArray))
            throw new IllegalArgumentException("ไฟล์นี้ไม่ใช่ไฟล์ชุด VSMS รุ่นที่รองรับ");
        JSONArray captions = root.getJSONArray("captions"), links = root.getJSONArray("links");
        if(captions.length()>MAX_SETS_PER_KIND || links.length()>MAX_SETS_PER_KIND)
            throw new IllegalArgumentException("ไฟล์มีชุดมากเกิน 10,000 ชุดต่อประเภท");
        SortedMap<String,String> captionMap = new TreeMap<>();
        SortedMap<String,JSONObject> linkMap = new TreeMap<>();
        for (int i=0; i<captions.length(); i++) {
            JSONObject item = captions.getJSONObject(i); fields(item,"name","text");
            if (!(item.get("name") instanceof String) || !(item.get("text") instanceof String))
                throw new IllegalArgumentException("ชนิดข้อมูลแคปชั่นไม่ถูกต้อง");
            String name = item.getString("name"), text = item.getString("text");
            if (!name.equals(CaptionLibrary.name(name)) || text.length() > 110000
                    || !text.equals(String.join("\n", CampaignCore.lines(text, false)))
                    || captionMap.put(name,text) != null)
                throw new IllegalArgumentException("ชื่อหรือข้อความชุดแคปชั่นไม่ถูกต้อง/ซ้ำ");
        }
        for (int i=0; i<links.length(); i++) {
            JSONObject item = links.getJSONObject(i); fields(item,"name","entry");
            if (!(item.get("name") instanceof String) || !(item.get("entry") instanceof JSONObject))
                throw new IllegalArgumentException("ชนิดข้อมูลชุดลิงก์ไม่ถูกต้อง");
            String name = item.getString("name");
            if (!name.equals(CaptionLibrary.name(name))
                    || linkMap.put(name,cleanLink(item.getJSONObject("entry"))) != null)
                throw new IllegalArgumentException("ชื่อชุดลิงก์ไม่ถูกต้อง/ซ้ำ");
        }
        return new Snapshot(captionMap,linkMap);
    }
    static synchronized byte[] export(Context c) throws Exception {
        recover(c);
        JSONArray captions = new JSONArray(), links = new JSONArray();
        for (Map.Entry<String,String> item : CaptionLibrary.load(c).entrySet())
            captions.put(new JSONObject().put("name",item.getKey()).put("text",item.getValue()));
        for (Map.Entry<String,JSONObject> item : LinkLibrary.load(c).entrySet()) {
            JSONObject entry = item.getValue();
            JSONObject clean = new JSONObject().put("original_url",entry.get("original_url"))
                    .put("short_urls",entry.get("short_urls"))
                    .put("requested_count",entry.get("requested_count"))
                    .put("saved_at",entry.get("saved_at"));
            if (entry.has("source")) clean.put("source",entry.get("source"));
            links.put(new JSONObject().put("name",item.getKey()).put("entry",cleanLink(clean)));
        }
        byte[] bytes = new JSONObject().put("format",FORMAT).put("version",1)
                .put("captions",captions).put("links",links).toString().getBytes(StandardCharsets.UTF_8);
        if (bytes.length > MAX_BYTES || captions.length()>MAX_SETS_PER_KIND || links.length()>MAX_SETS_PER_KIND)
            throw new IOException("ชุดที่บันทึกไว้เกินขีดจำกัด 16 MB หรือ 10,000 ชุดต่อประเภท");
        return bytes;
    }
    static synchronized Preview preview(Context c, Snapshot incoming) {
        recover(c);
        int conflicts=0;
        SortedMap<String,String> existingCaptions=CaptionLibrary.load(c);
        SortedMap<String,JSONObject> existingLinks=LinkLibrary.load(c);
        for (String name:incoming.captions.keySet()) if(existingCaptions.containsKey(name)) conflicts++;
        for (String name:incoming.links.keySet()) if(existingLinks.containsKey(name)) conflicts++;
        return new Preview(incoming.captions.size(),incoming.links.size(),conflicts);
    }
    private static byte[] old(AtomicFile file, int limit) throws IOException {
        try(InputStream in=file.openRead()) { return read(in, limit); }
        catch(FileNotFoundException e) {
            if (!exists(file)) return null;
            throw e;
        }
    }
    private static void write(AtomicFile file, byte[] bytes) throws IOException {
        FileOutputStream out=null;
        try { out=file.startWrite(); out.write(bytes); file.finishWrite(out); }
        catch(IOException | RuntimeException e) { if(out!=null)file.failWrite(out); throw e; }
    }
    private static void restore(AtomicFile file, byte[] bytes) throws IOException {
        if(bytes==null) deleteChecked(file); else write(file,bytes);
    }
    private static String encode(byte[] bytes) { return bytes==null?"":Base64.encodeToString(bytes,Base64.NO_WRAP); }
    private static byte[] decode(String text) { return text.isEmpty()?null:Base64.decode(text,Base64.DEFAULT); }
    static synchronized void recover(Context c) {
        AtomicFile journal=journal(c);
        byte[] bytes;
        try { bytes=old(journal, 48 * 1024 * 1024); } catch(IOException e) {throw new IllegalStateException("อ่านข้อมูลกู้คืนชุดไม่ได้",e);}
        if(bytes==null)return;
        try {
            JSONObject state=new JSONObject(utf8(bytes)); fields(state,"captions","links");
            restore(CaptionLibrary.file(c),decode(state.getString("captions")));
            restore(LinkLibrary.file(c),decode(state.getString("links")));
            deleteChecked(journal);
        } catch(Exception e) {throw new IllegalStateException("กู้คืนชุดเดิมไม่สำเร็จ",e);}
    }
    static synchronized void apply(Context c, Snapshot incoming, int conflictMode) throws Exception {
        apply(c,incoming,conflictMode,null,null);
    }
    // Package-private failure hook lets tests prove rollback after the first library write.
    static synchronized void apply(Context c, Snapshot incoming, int conflictMode, Runnable beforeSecondWrite) throws Exception {
        apply(c,incoming,conflictMode,beforeSecondWrite,null);
    }
    static synchronized void apply(Context c, Snapshot incoming, int conflictMode, Runnable beforeSecondWrite,
                                   Runnable afterJournalDeleteForTests) throws Exception {
        if(conflictMode<REJECT_CONFLICTS || conflictMode>SKIP_CONFLICTS)
            throw new IllegalArgumentException("วิธีจัดการชื่อซ้ำไม่ถูกต้อง");
        recover(c);
        SortedMap<String,String> captions=CaptionLibrary.load(c);
        SortedMap<String,JSONObject> links=LinkLibrary.load(c);
        for(String name:incoming.captions.keySet())
            if(captions.containsKey(name) && conflictMode==REJECT_CONFLICTS) throw new IllegalArgumentException("มีชื่อชุดแคปชั่นซ้ำ กรุณาเลือกวิธีจัดการก่อน");
        for(String name:incoming.links.keySet())
            if(links.containsKey(name) && conflictMode==REJECT_CONFLICTS) throw new IllegalArgumentException("มีชื่อชุดลิงก์ซ้ำ กรุณาเลือกวิธีจัดการก่อน");
        for(Map.Entry<String,String> item:incoming.captions.entrySet())
            if(conflictMode!=SKIP_CONFLICTS || !captions.containsKey(item.getKey())) captions.put(item.getKey(),item.getValue());
        for(Map.Entry<String,JSONObject> item:incoming.links.entrySet())
            if(conflictMode!=SKIP_CONFLICTS || !links.containsKey(item.getKey())) links.put(item.getKey(),item.getValue());
        if(captions.size()>MAX_SETS_PER_KIND || links.size()>MAX_SETS_PER_KIND)
            throw new IllegalArgumentException("หลังนำเข้ามีเกิน 10,000 ชุดต่อประเภท");
        byte[] nextCaptions=new JSONObject(captions).toString().getBytes(StandardCharsets.UTF_8);
        byte[] nextLinks=new JSONObject(links).toString().getBytes(StandardCharsets.UTF_8);
        if(nextCaptions.length>MAX_BYTES || nextLinks.length>MAX_BYTES)
            throw new IllegalArgumentException("ชุดรวมมีขนาดเกิน 16 MB");
        byte[] priorCaptions=old(CaptionLibrary.file(c),MAX_BYTES), priorLinks=old(LinkLibrary.file(c),MAX_BYTES);
        byte[] state=new JSONObject().put("captions",encode(priorCaptions))
                .put("links",encode(priorLinks)).toString().getBytes(StandardCharsets.UTF_8);
        write(journal(c),state);
        try {
            write(CaptionLibrary.file(c),nextCaptions);
            if(beforeSecondWrite!=null)beforeSecondWrite.run();
            write(LinkLibrary.file(c),nextLinks);
            journal(c).delete();
            if(afterJournalDeleteForTests!=null)afterJournalDeleteForTests.run();
            if(journalPending(c))throw new IOException("ลบข้อมูลธุรกรรมนำเข้าไม่สำเร็จ");
        } catch(Exception e) { recover(c); throw e; }
    }
}
