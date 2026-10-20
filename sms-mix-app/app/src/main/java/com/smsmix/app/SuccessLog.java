package com.smsmix.app;

import android.content.Context;
import android.util.AtomicFile;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;

/** Persistent success-only archive, separate from the replaceable campaign queue. */
final class SuccessLog {
    static AtomicFile file(Context c) { return new AtomicFile(new File(c.getFilesDir(), "successful-sends.json")); }
    static JSONObject load(Context c) {
        AtomicFile f=file(c);
        try(FileInputStream in=f.openRead()) {
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();
            byte[] buffer=new byte[8192];int n;
            while((n=in.read(buffer))!=-1)bytes.write(buffer,0,n);
            return new JSONObject(bytes.toString("UTF-8"));
        } catch(FileNotFoundException e) {
            if(!f.getBaseFile().exists() && !new File(f.getBaseFile()+".bak").exists())return Store.object();
            throw new IllegalStateException("อ่านบันทึกส่งสำเร็จไม่ได้",e);
        } catch(Exception e){throw new IllegalStateException("อ่านบันทึกส่งสำเร็จไม่ได้",e);}
    }
    static synchronized void record(Context c,JSONObject campaign) {
        JSONObject archive=load(c);boolean changed=false;
        JSONArray rows=Store.rows(campaign);
        for(int i=0;i<rows.length();i++) {
            JSONObject row=rows.optJSONObject(i);
            String key=campaign.optString("id")+":"+i;
            if(!"SENT".equals(row.optString("status")))continue;
            JSONObject entry=Store.object();String body=row.optString("body");
            Store.put(entry,"phone",row.optString("phone"));
            Store.put(entry,"link",row.optString("link",body.substring(body.lastIndexOf('\n')+1)));
            Store.put(entry,"sentAt",row.optLong("sentAt"));Store.put(entry,"resultAt",row.optLong("resultAt"));
            Store.put(entry,"deliveredAt",row.optLong("deliveredAt"));
            Store.put(entry,"usedSim",row.optInt("usedSim",-1));
            Store.put(entry,"usedSimLabel",row.optString("usedSimLabel"));
            Store.put(entry,"senderPhone",row.optString("senderPhone"));
            Store.put(entry,"senderPhoneSource",row.optString("senderPhoneSource"));
            if(archive.has(key) && entry.toString().equals(archive.optJSONObject(key).toString()))continue;
            Store.put(archive,key,entry);changed=true;
        }
        if(!changed)return;
        AtomicFile f=file(c);FileOutputStream out=null;
        try {out=f.startWrite();out.write(archive.toString().getBytes(StandardCharsets.UTF_8));f.finishWrite(out);}
        catch(Exception e){if(out!=null)f.failWrite(out);throw new IllegalStateException("บันทึกรายการส่งสำเร็จไม่ได้",e);}
    }
    static synchronized String csv(Context c) {
        record(c,Store.load(c));JSONObject archive=load(c);
        StringBuilder text=new StringBuilder("\uFEFFphone,link,sent_at,result_at,delivery_status,delivered_at,sender_sim,sender_phone,sender_source\r\n");
        java.util.Iterator<String> keys=archive.keys();
        while(keys.hasNext()){
            JSONObject row=archive.optJSONObject(keys.next());
            text.append(MainActivity.quote(row.optString("phone"))).append(',')
                .append(MainActivity.quote(row.optString("link"))).append(',')
                .append(MainActivity.quote(SendStatus.time(row.optLong("sentAt")))).append(',')
                .append(MainActivity.quote(SendStatus.time(row.optLong("resultAt")))).append(',')
                .append(MainActivity.quote(row.optLong("deliveredAt")>0 ? "DELIVERED" : "UNCONFIRMED")).append(',')
                .append(MainActivity.quote(SendStatus.time(row.optLong("deliveredAt")))).append(',')
                .append(MainActivity.quote(SenderIdentity.sim(row))).append(',')
                .append(MainActivity.quote(SenderIdentity.phone(row))).append(',')
                .append(MainActivity.quote(SenderIdentity.source(row))).append("\r\n");
        }
        return text.toString();
    }
}
