package com.smsmix.app;

import android.content.Context;
import android.Manifest;
import android.content.pm.PackageManager;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;
import org.json.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

final class CampaignFactory {
    static final class RepeatSource {
        final String first, last;
        final int count;
        final List<String> captions, links;
        RepeatSource(String first, String last, int count, List<String> captions, List<String> links) {
            this.first=first; this.last=last; this.count=count; this.captions=captions; this.links=links;
        }
    }
    private static JSONArray strings(List<String> values) { return new JSONArray(values); }
    private static String digest(JSONArray values) {
        try {
            byte[] hash=MessageDigest.getInstance("SHA-256").digest(values.toString().getBytes(StandardCharsets.UTF_8));
            StringBuilder out=new StringBuilder(hash.length*2);
            for(byte part:hash)out.append(String.format(Locale.ROOT,"%02x",part&255));
            return out.toString();
        } catch(Exception e) {throw new IllegalStateException("ตรวจประวัติเบอร์ไม่ได้",e);}
    }
    private static JSONObject source(String first, String last, int count, List<String> captions, List<String> links) {
        JSONObject value=Store.object();
        Store.put(value,"version",1);
        Store.put(value,"first",CampaignCore.normalizePhone(first));
        Store.put(value,"last",CampaignCore.normalizePhone(last));
        Store.put(value,"count",count);
        Store.put(value,"captions",strings(captions));
        Store.put(value,"links",strings(links));
        return value;
    }
    private static List<String> sourceLines(JSONObject value, String field, boolean links) {
        Object raw=value.opt(field);
        if(!(raw instanceof JSONArray))throw new IllegalStateException("ต้นทางข้อความ/ลิงก์ของคิวเสียหาย");
        JSONArray array=(JSONArray)raw;
        if(array.length()<10 || array.length()>100)throw new IllegalStateException("จำนวนข้อความ/ลิงก์ต้นทางไม่ถูกต้อง");
        List<String> result=new ArrayList<>();
        for(int i=0;i<array.length();i++) {
            Object item=array.opt(i);
            if(!(item instanceof String) || ((String)item).trim().isEmpty()
                    || ((String)item).length()>1000 || ((String)item).matches("(?s).*\\R.*"))
                throw new IllegalStateException("ข้อความ/ลิงก์ต้นทางเสียหาย");
            result.add((String)item);
        }
        if(CampaignCore.lines(String.join("\n",result),links).size()!=result.size())
            throw new IllegalStateException("ข้อความ/ลิงก์ต้นทางเสียหาย");
        return result;
    }
    static RepeatSource repeatSource(JSONObject queue) {
        if(!"range".equals(queue.optString("recipientMode")))
            throw new IllegalStateException("ทำงานอีกครั้งได้เฉพาะคิวที่สุ่มจากช่วงเบอร์");
        JSONObject value=queue.optJSONObject("repeatSource");
        if(value==null || !(value.opt("version") instanceof Number)
                || ((Number)value.opt("version")).doubleValue()!=1
                || !(value.opt("first") instanceof String) || !(value.opt("last") instanceof String)
                || !(value.opt("count") instanceof Number))
            throw new IllegalStateException("คิวเก่าไม่มีต้นทางครบ กรุณาสร้างคิวจากช่วงเบอร์ใหม่หนึ่งครั้ง");
        double countValue=((Number)value.opt("count")).doubleValue();
        if(!Double.isFinite(countValue) || countValue!=Math.rint(countValue)
                || countValue<1 || countValue>CampaignCore.MAX_RECIPIENTS)
            throw new IllegalStateException("จำนวนสุ่มต้นทางไม่ถูกต้อง");
        String first=value.optString("first"), last=value.optString("last");
        if(!first.equals(CampaignCore.normalizePhone(first)) || !last.equals(CampaignCore.normalizePhone(last)))
            throw new IllegalStateException("ช่วงเบอร์ต้นทางไม่ถูกต้อง");
        RecipientSampler.Range range=new RecipientSampler.Range(first,last);
        JSONArray rows=Store.rows(queue);
        if(rows.length()!=(int)countValue)
            throw new IllegalStateException("จำนวนเบอร์ต้นทางไม่ตรงกับคิวเดิม");
        for(int i=0;i<rows.length();i++) {
            JSONObject row=rows.optJSONObject(i);
            if(row==null)throw new IllegalStateException("เบอร์ในคิวเดิมเสียหาย");
            String phone=CampaignCore.normalizePhone(row.optString("phone"));
            if(phone.length()!=range.width)throw new IllegalStateException("ช่วงเบอร์ต้นทางไม่ตรงกับคิวเดิม");
            long number=Long.parseLong(phone.substring(1));
            if(number<range.start || number>range.end)
                throw new IllegalStateException("ช่วงเบอร์ต้นทางไม่ตรงกับคิวเดิม");
        }
        return new RepeatSource(first,last,(int)countValue,
                sourceLines(value,"captions",false),sourceLines(value,"links",true));
    }
    static void requireTerminal(JSONObject queue) {
        if(queue.optBoolean("running"))
            throw new IllegalStateException("รอให้คิวปัจจุบันจบทุกเบอร์ก่อนทำงานอีกครั้ง");
        requireFinished(queue);
    }
    static void requireFinished(JSONObject queue) {
        JSONArray rows=Store.rows(queue);
        if(queue.optString("id").isEmpty() || rows.length()==0)
            throw new IllegalStateException("ยังไม่มีคิวที่ทำงานจบให้ทำซ้ำ");
        if(Store.pending(queue)>=0 || Store.sending(queue)>=0)
            throw new IllegalStateException("รอให้คิวปัจจุบันจบทุกเบอร์ก่อนทำงานอีกครั้ง");
        for(int i=0;i<rows.length();i++) {
            JSONObject row=rows.optJSONObject(i);
            if(row==null || !Arrays.asList("SENT","FAILED","SKIPPED","UNKNOWN","CANCELLED").contains(row.optString("status")))
                throw new IllegalStateException("สถานะคิวปัจจุบันไม่ครบหรือเสียหาย");
        }
    }
    private static Set<String> repeatHistory(JSONObject queue) {
        if(!(queue.opt("drawnPhones") instanceof JSONArray) || !(queue.opt("drawnPhonesCount") instanceof Number))
            throw new IllegalStateException("ประวัติเบอร์ที่เคยสุ่มไม่ครบ หยุดเพื่อป้องกันเบอร์ซ้ำ");
        JSONArray saved=queue.optJSONArray("drawnPhones");
        double count=((Number)queue.opt("drawnPhonesCount")).doubleValue();
        if(!Double.isFinite(count) || count!=saved.length()
                || !digest(saved).equals(queue.optString("drawnPhonesDigest")))
            throw new IllegalStateException("ประวัติเบอร์ที่เคยสุ่มไม่ครบ หยุดเพื่อป้องกันเบอร์ซ้ำ");
        Set<String> used=new LinkedHashSet<>();
        for(int i=0;i<saved.length();i++) {
            Object item=saved.opt(i);
            if(!(item instanceof String))throw new IllegalStateException("ประวัติเบอร์ที่เคยสุ่มเสียหาย");
            String normalized=CampaignCore.normalizePhone((String)item);
            if(!normalized.equals(item) || !used.add(normalized))
                throw new IllegalStateException("ประวัติเบอร์ที่เคยสุ่มเสียหาย");
        }
        JSONArray rows=Store.rows(queue);
        for(int i=0;i<rows.length();i++)
            if(!used.contains(CampaignCore.normalizePhone(rows.optJSONObject(i).optString("phone"))))
                throw new IllegalStateException("ประวัติเบอร์ที่เคยสุ่มไม่ครบ หยุดเพื่อป้องกันเบอร์ซ้ำ");
        return used;
    }
    static void validateNextRound(Context context, JSONObject previous) {
        RepeatSource source=repeatSource(previous);
        requireSim(context,previous);
        Set<String> used=repeatHistory(previous);
        // Check exhaustion before arming; the actual selection is made only after this queue finishes.
        RecipientSampler.fromRange(source.first,source.last,used,source.count,new Random(0));
    }
    static void requireSim(Context context, JSONObject queue) {
        if(context.checkSelfPermission(Manifest.permission.READ_PHONE_STATE)!=PackageManager.PERMISSION_GRANTED)
            throw new IllegalStateException("กรุณาอนุญาตการอ่านซิมก่อนทำงานอีกครั้ง");
        SubscriptionManager manager=context.getSystemService(SubscriptionManager.class);
        int first=queue.optInt("sim",-1), second=queue.optInt("alternateSim",-1);
        SubscriptionInfo one=manager==null?null:manager.getActiveSubscriptionInfo(first);
        if(first<0 || one==null)throw new IllegalStateException("ซิมเดิมไม่พร้อม กรุณาตรวจสอบซิมก่อน");
        if(Scheduler.alternating(queue)) {
            SubscriptionInfo two=manager.getActiveSubscriptionInfo(second);
            if(second<0 || first==second || one.getSimSlotIndex()!=0 || two==null || two.getSimSlotIndex()!=1)
                throw new IllegalStateException("SIM 1 / SIM 2 เดิมไม่พร้อมสำหรับคิวสลับซิม");
        } else if(queue.has("alternateSim")) throw new IllegalStateException("ข้อมูลซิมของคิวเสียหาย");
        else if (queue.has("singleSimSlot") && one.getSimSlotIndex() != Scheduler.singleSimSlot(queue))
            throw new IllegalStateException("ซิมเดียวที่เลือกถูกย้ายช่อง กรุณาตรวจสอบซิมก่อน");
    }
    private static int selectedSlot(Context context, int subscriptionId) {
        if (context.checkSelfPermission(Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED)
            throw new IllegalStateException("กรุณาอนุญาตการอ่านซิมก่อนสร้างคิว");
        SubscriptionManager manager=context.getSystemService(SubscriptionManager.class);
        SubscriptionInfo selected=manager==null?null:manager.getActiveSubscriptionInfo(subscriptionId);
        int slot=selected==null?-1:selected.getSimSlotIndex();
        if (slot != 0 && slot != 1) throw new IllegalStateException("SIM 1 / SIM 2 ที่เลือกไม่พร้อม กรุณาโหลดรายการซิมใหม่");
        return slot;
    }
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
        return create(context, rangeMode, imported, first, last, count, captions, links,
                sim, -1, simLabel, random);
    }

    static synchronized JSONObject create(Context context, boolean rangeMode, List<String> imported,
            String first, String last, int count, List<String> captions, List<String> links,
            int sim, int alternateSim, String simLabel, Random random) {
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
        JSONObject data = build(previous,rangeMode,first,last,count,captions,links,sim,alternateSim,simLabel,selected,used,0);
        if (alternateSim < 0) Store.put(data, "singleSimSlot", selectedSlot(context, sim));
        String previousId = previous.optString("id");
        synchronized (Scheduler.LOCK) {
            JSONObject latest = Store.load(context);
            if (!previousId.equals(latest.optString("id")) || latest.optBoolean("running")
                    || Store.sending(latest) >= 0)
                throw new IllegalStateException("คิวเปลี่ยน กรุณาตรวจพรีวิวใหม่");
            MessageHistory.reconcileReplacement(context, latest);
            MessageHistory.recordCampaign(context, latest);
            Store.save(context, data); // One atomic commit reserves history and publishes the queue.
            MessageHistory.finishReplaced(context, previousId);
            MessageHistory.recordCampaign(context, data);
        }
        return data;
    }

    private static JSONObject build(JSONObject previous, boolean rangeMode, String first, String last, int count,
            List<String> captions, List<String> links, int sim, int alternateSim, String simLabel,
            List<String> selected, Set<String> used, int pairOffset) {
        JSONObject data = Store.object();
        Store.put(data, "id", UUID.randomUUID().toString());
        Store.put(data, "createdAt", System.currentTimeMillis());
        Store.put(data, "sim", sim); Store.put(data, "simLabel", simLabel);
        if (alternateSim >= 0) {
            if (sim == alternateSim) throw new IllegalStateException("ต้องใช้ SIM 1 และ SIM 2 คนละซิม");
            Store.put(data, "simMode", "alternate");
            Store.put(data, "alternateSim", alternateSim);
        }
        Store.put(data, "running", false); Store.put(data, "note", "พร้อมตรวจพรีวิว");
        Store.put(data, "recipientMode", rangeMode ? "range" : "file");
        Store.put(data, "pairOffset", pairOffset);
        if(rangeMode)Store.put(data,"repeatSource",source(first,last,count,captions,links));
        JSONArray rows = new JSONArray();
        for (String phone : selected) {
            JSONObject row = Store.object();
            if (alternateSim >= 0) {
                boolean firstSlot = rows.length() % 2 == 0;
                Store.put(row, "sim", firstSlot ? sim : alternateSim);
                Store.put(row, "simLabel", firstSlot ? "SIM 1" : "SIM 2");
            }
            Store.put(row, "phone", phone);
            Store.put(row, "body", CampaignCore.pair(captions, links, pairOffset + rows.length()));
            String body = row.optString("body");
            Store.put(row, "link", body.substring(body.lastIndexOf('\n') + 1));
            Store.put(row, "status", "PENDING"); rows.put(row);
        }
        used.addAll(selected);
        JSONArray drawn=new JSONArray(used);
        Store.put(data, "drawnPhones", drawn);
        Store.put(data, "drawnPhonesCount", used.size());
        Store.put(data, "drawnPhonesDigest", digest(drawn));
        Store.put(data, "rows", rows);
        String previousId = previous.optString("id");
        if (!previousId.isEmpty()) Store.put(data, "previousCampaignId", previousId);
        return data;
    }

    static synchronized JSONObject repeat(Context context, String expectedId, Random random) {
        synchronized(Scheduler.LOCK) {
            JSONObject previous=Store.load(context);
            if(!expectedId.equals(previous.optString("id")))
                throw new IllegalStateException("คิวเปลี่ยน กรุณาตรวจพรีวิวใหม่");
            requireTerminal(previous);
            JSONObject data=repeatCandidate(context,previous,random);
            // No history/archive mutation before the atomic queue write: failed repeat keeps both untouched.
            Store.save(context,data);
            recordRepeat(context,previous,data);
            return data;
        }
    }
    static JSONObject repeatCandidate(Context context, JSONObject previous, Random random) {
        requireFinished(previous);
        RepeatSource source=repeatSource(previous);
        requireSim(context,previous);
        Set<String> used=repeatHistory(previous);
        List<String> selected=RecipientSampler.fromRange(source.first,source.last,used,source.count,random);
        int pairOffset=nextPairOffset(previous,source.captions.size(),source.links.size());
        JSONObject data=build(previous,true,source.first,source.last,source.count,source.captions,source.links,
                previous.optInt("sim",-1),Scheduler.alternating(previous)?previous.optInt("alternateSim",-1):-1,
                previous.optString("simLabel"),selected,used,pairOffset);
        if (previous.has("singleSimSlot")) Store.put(data,"singleSimSlot",Scheduler.singleSimSlot(previous));
        return data;
    }
    private static int nextPairOffset(JSONObject previous, int captions, int links) {
        int cycle=captions / gcd(captions,links) * links;
        int offset=0;
        if(previous.has("pairOffset")) {
            Object value=previous.opt("pairOffset");
            if(!(value instanceof Number) || !Double.isFinite(((Number)value).doubleValue())
                    || ((Number)value).doubleValue()!=Math.rint(((Number)value).doubleValue())
                    || ((Number)value).doubleValue()<0 || ((Number)value).doubleValue()>=cycle)
                throw new IllegalStateException("ตำแหน่งข้อความ/ลิงก์ของคิวเสียหาย");
            offset=((Number)value).intValue();
        }
        // A pre-0.5.11 queue has no offset; count its rows as the first sequence.
        return (offset+Store.rows(previous).length())%cycle;
    }
    private static int gcd(int a, int b) {
        while(b!=0) { int next=a%b; a=b; b=next; }
        return a;
    }
    static void recordRepeat(Context context, JSONObject previous, JSONObject data) {
        try {SuccessLog.record(context,previous);} catch(RuntimeException ignored) { /* Existing queue callbacks also archive. */ }
        try {MessageHistory.recordCampaign(context,previous); MessageHistory.recordCampaign(context,data);}
        catch(RuntimeException ignored) { /* Current queue remains authoritative for later reconciliation. */ }
    }
}
