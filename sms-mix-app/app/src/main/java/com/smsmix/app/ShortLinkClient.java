package com.smsmix.app;

import org.json.*;
import java.net.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

final class ShortLinkClient {
    static final String ENDPOINT = "https://api.shrinkrl.com/api/v1/urls/bulk_create";
    static String destination(String input) {
        String url=input.trim();
        try {
            URI u=new URI(url);
            if (!("https".equalsIgnoreCase(u.getScheme()) || "http".equalsIgnoreCase(u.getScheme()))
                    || u.getHost()==null || u.getUserInfo()!=null || url.length()>8192) throw new Exception();
        } catch(Exception e) {throw new IllegalArgumentException("กรุณาใส่ลิงก์ http/https ที่ถูกต้อง");}
        return url;
    }
    static JSONObject request(String input, int count) {
        String url=destination(input);
        if(count<1 || count>100) throw new IllegalArgumentException("จำนวนลิงก์ต้องอยู่ระหว่าง 1–100");
        JSONArray urls=new JSONArray();
        for(int i=0;i<count;i++) {
            JSONObject item=Store.object();
            Store.put(item,"original_url",url);
            Store.put(item,"slug","sm"+UUID.randomUUID().toString().replace("-","").substring(0,18));
            urls.put(item);
        }
        JSONObject body=Store.object(); Store.put(body,"urls",urls); return body;
    }
    static String post(JSONObject body) throws IOException {
        HttpURLConnection connection=(HttpURLConnection)new URL(ENDPOINT).openConnection();
        try {
            connection.setRequestMethod("POST");
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(15000); connection.setReadTimeout(60000);
            connection.setRequestProperty("Content-Type","application/json");
            connection.setRequestProperty("Accept","application/json");
            connection.setDoOutput(true);
            byte[] bytes=body.toString().getBytes(StandardCharsets.UTF_8);
            connection.setFixedLengthStreamingMode(bytes.length);
            try(OutputStream out=connection.getOutputStream()) {out.write(bytes);}
            int status=connection.getResponseCode();
            if(status==429) throw new IOException("Shrinkrl จำกัดจำนวนคำขอ กรุณารอตามบริการแล้วกดลองต่อ (ไม่มีการยิงซ้ำอัตโนมัติ)");
            if(status!=200 && status!=201) throw new IOException("Shrinkrl ตอบ HTTP "+status+" กรุณาลองต่อภายหลัง");
            try(InputStream in=connection.getInputStream()) {
                ByteArrayOutputStream result=new ByteArrayOutputStream();
                byte[] buffer=new byte[8192]; int n;
                while((n=in.read(buffer))!=-1) {
                    result.write(buffer,0,n);
                    if(result.size()>2*1024*1024) throw new IOException("คำตอบจากบริการมีขนาดเกินกำหนด");
                }
                return result.toString("UTF-8");
            }
        } finally {connection.disconnect();}
    }

    static List<String> parse(JSONObject request, String raw) throws IOException {
        try {
            JSONObject response=new JSONObject(raw);
            if(!"completed".equals(response.optString("status"))) throw new IOException("บริการยังไม่ส่งผลลัพธ์ที่เสร็จสมบูรณ์");
            JSONArray returned=response.optJSONArray("urls");
            if(returned==null) throw new IOException("รูปแบบคำตอบจาก Shrinkrl ไม่ถูกต้อง");
            Map<String,String> expected=new HashMap<>();
            JSONArray sent=request.getJSONArray("urls");
            for(int i=0;i<sent.length();i++) {
                JSONObject item=sent.getJSONObject(i);
                expected.put(item.getString("slug"),item.getString("original_url"));
            }
            Set<String> valid=new LinkedHashSet<>();
            for(int i=0;i<returned.length();i++) {
                JSONObject item=returned.optJSONObject(i);
                if(item==null) continue;
                String slug=item.optString("slug"), link=item.optString("short_url");
                if(!expected.containsKey(slug) || !expected.get(slug).equals(item.optString("original_url"))) continue;
                // Only accept the provider's documented HTTPS short-link domain and requested slug.
                if(!("https://g.shrinkrl.com/"+slug).equals(link)) continue;
                valid.add(link);
            }
            return new ArrayList<>(valid);
        } catch(JSONException e) {throw new IOException("อ่านคำตอบจาก Shrinkrl ไม่ได้",e);}
    }

    interface Lookup { String get(String slug) throws IOException; }

    static String read(String slug) throws IOException {
        if(!slug.matches("[A-Za-z0-9_-]{3,20}")) throw new IOException("รหัสลิงก์ไม่ถูกต้อง");
        HttpURLConnection c=(HttpURLConnection)new URL("https://api.shrinkrl.com/api/v1/urls/"+slug).openConnection();
        try {
            c.setInstanceFollowRedirects(false); c.setConnectTimeout(10000); c.setReadTimeout(10000);
            int code=c.getResponseCode();
            if(code==404) return null;
            if(code!=200) throw new IOException("อ่านผล Shrinkrl ไม่สำเร็จ HTTP "+code);
            try(InputStream in=c.getInputStream()) {
                ByteArrayOutputStream out=new ByteArrayOutputStream(); byte[] buffer=new byte[8192]; int n;
                while((n=in.read(buffer))!=-1) {
                    out.write(buffer,0,n);
                    if(out.size()>2*1024*1024) throw new IOException("คำตอบมีขนาดเกินกำหนด");
                }
                return out.toString("UTF-8");
            }
        } finally {c.disconnect();}
    }

    static List<String> resolve(JSONObject request, String response, Lookup lookup) throws IOException {
        Set<String> found=new LinkedHashSet<>(parse(request,response));
        JSONArray requested=request.optJSONArray("urls");
        for(int i=0;i<requested.length();i++) {
            JSONObject item=requested.optJSONObject(i);
            String slug=item.optString("slug");
            if(found.contains("https://g.shrinkrl.com/"+slug)) continue;
            try {
                String raw=lookup.get(slug);
                if(raw==null) continue;
                JSONObject wrapped=Store.object();
                Store.put(wrapped,"status","completed");
                Store.put(wrapped,"urls",new JSONArray().put(new JSONObject(raw)));
                found.addAll(parse(request,wrapped.toString()));
            } catch(IOException | JSONException unavailable) {
                // Preserve confirmed results; stop lookups on rate limits/network failures.
                break;
            }
        }
        return new ArrayList<>(found);
    }
}
