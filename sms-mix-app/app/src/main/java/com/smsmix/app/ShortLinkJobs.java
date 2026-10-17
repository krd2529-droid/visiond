package com.smsmix.app;

import android.content.Context;
import org.json.*;
import java.util.*;

final class ShortLinkJobs {
    private static boolean running;
    static synchronized JSONObject snapshot(Context c) {
        String raw=c.getSharedPreferences("shortlinks",0).getString("job","");
        if(raw.isEmpty()) return Store.object();
        try {return new JSONObject(raw);}
        catch(JSONException e) {throw new IllegalStateException("อ่านงานย่อลิงก์ที่บันทึกไว้ไม่ได้",e);}
    }
    private static void save(Context c, JSONObject state) {
        if(!c.getSharedPreferences("shortlinks",0).edit().putString("job",state.toString()).commit())
            throw new IllegalStateException("บันทึกงานย่อลิงก์ไม่สำเร็จ");
    }
    static synchronized boolean isRunning() {return running;}
    static synchronized void start(Context context, JSONObject request, boolean retry) {
        if(running) throw new IllegalStateException("กำลังสร้างลิงก์ กรุณารอ");
        Context app=context.getApplicationContext();
        JSONObject job=retry?snapshot(app):Store.object();
        if(retry) request=job.optJSONObject("request");
        if(request==null) throw new IllegalStateException("ไม่มีงานให้ลองต่อ");
        Store.put(job,"request",request); Store.put(job,"status","working"); Store.put(job,"error","");
        if(!retry) Store.put(job,"results",new JSONArray());
        save(app,job);
        running=true;
        final JSONObject body=request;
        new Thread(() -> {
            try {
                List<String> fresh=ShortLinkClient.resolve(body,ShortLinkClient.post(body),ShortLinkClient::read);
                Set<String> merged=new LinkedHashSet<>();
                JSONArray previous=job.optJSONArray("results");
                if(previous!=null) for(int i=0;i<previous.length();i++) merged.add(previous.optString(i));
                merged.addAll(fresh);
                Store.put(job,"results",new JSONArray(merged));
                Store.put(job,"status",merged.size()==body.optJSONArray("urls").length()?"complete":"partial");
                if(merged.size()!=body.optJSONArray("urls").length())
                    Store.put(job,"error","ได้ผลลัพธ์ไม่ครบ กดลองต่อเพื่อใช้คำขอเดิม");
            } catch(Exception e) {Store.put(job,"status","error"); Store.put(job,"error",e.getMessage());}
            synchronized(ShortLinkJobs.class) {
                try {save(app,job);} catch (RuntimeException storageFailure) {
                    // Persisted request remains available for an idempotent manual retry.
                } finally {running=false;}
            }
        },"shrinkrl").start();
    }
}
