package com.smsmix.app;
import android.app.*;
import android.content.*;
import android.widget.*;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.*;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk=28)
public class OutcomeTest {
    QueueTest f;
    @Before public void setup(){f=new QueueTest();f.setup();f.allowSim();SuccessLog.file(f.c).delete();}
    @After public void teardown(){f.teardown();}
    JSONObject two(boolean running){
        JSONObject d=f.queue("SENDING",2,running);Store.put(d,"sim",7);
        JSONObject row=Store.rows(d).optJSONObject(0);Store.put(row,"body","caption\nhttps://example.com/a");
        Store.put(row,"deliveryParts",new JSONArray().put(-1).put(-1));
        JSONObject next=Store.object();Store.put(next,"phone","+66800000001");Store.put(next,"body","next");Store.put(next,"status","PENDING");
        Store.rows(d).put(next);Store.save(f.c,d);return d;
    }
    @Test public void failedMultipartAdvancesAfterOneMinuteAndNeverRetries(){
        two(true);Scheduler.result(f.c,f.callback(0),Activity.RESULT_CANCELED);
        assertEquals("SENDING",f.status());
        Scheduler.result(f.c,f.callback(1),Activity.RESULT_OK);
        JSONObject d=Store.load(f.c);assertEquals("FAILED",f.status());assertTrue(d.optBoolean("running"));
        long wait=d.optLong("nextAt")-Store.rows(d).optJSONObject(0).optLong("resultAt");
        assertEquals(60_000L,wait);assertEquals(1,Store.pending(d));
        assertEquals(d.optLong("nextAt"),Shadows.shadowOf(f.c.getSystemService(AlarmManager.class)).peekNextScheduledAlarm().getTriggerAtMs());
        Scheduler.tick(f.c,d.optString("id"),false);assertEquals("PENDING",Store.rows(Store.load(f.c)).optJSONObject(1).optString("status"));
        Store.put(d,"nextAt",0);Store.save(f.c,d);Scheduler.tick(f.c,d.optString("id"),false);
        assertEquals("+66800000001",Shadows.shadowOf(Scheduler.sms(7)).getLastSentTextMessageParams().getDestinationAddress());
        assertEquals("FAILED",f.status());
    }
    @Test public void failureAfterUserStopDoesNotRestart(){
        JSONObject d=two(true);Scheduler.pause(f.c,d,"user stop");
        Scheduler.result(f.c,f.callback(0),Activity.RESULT_CANCELED);Scheduler.result(f.c,f.callback(1),Activity.RESULT_OK);
        assertFalse(Store.load(f.c).optBoolean("running"));
        assertNull(Shadows.shadowOf(f.c.getSystemService(AlarmManager.class)).peekNextScheduledAlarm());
    }
    @Test public void archiveOnlySuccessPersistsAcrossQueuesWithoutDuplicates(){
        two(false);Scheduler.result(f.c,f.callback(0),Activity.RESULT_OK);Scheduler.result(f.c,f.callback(1),Activity.RESULT_OK);
        SuccessLog.record(f.c,Store.load(f.c));assertEquals(1,SuccessLog.load(f.c).length());
        Store.save(f.c,Store.object());String csv=SuccessLog.csv(f.c);
        assertTrue(csv.contains("+66800000000"));assertTrue(csv.contains("https://example.com/a"));assertFalse(csv.contains("+66800000001"));
    }
    @Test public void deliveryRequiresEveryPartAndNeverClaimsRead(){
        two(false);Scheduler.result(f.c,f.callback(0),Activity.RESULT_OK);Scheduler.result(f.c,f.callback(1),Activity.RESULT_OK);
        new DeliveredReceiver().onReceive(f.c,f.callback(0));
        DeliveredReceiver.record(f.c,f.callback(0).putExtra("id","stale"),0);
        DeliveredReceiver.record(f.c,f.callback(0),0);
        assertEquals(0,Store.rows(Store.load(f.c)).optJSONObject(0).optLong("deliveredAt"));
        DeliveredReceiver.record(f.c,f.callback(1),32);
        assertTrue(SendStatus.line(Store.rows(Store.load(f.c)).optJSONObject(0)).contains("ยังไม่มีรายงานยืนยันถึงเครื่อง"));
        DeliveredReceiver.record(f.c,f.callback(1),0);
        JSONObject row=Store.rows(Store.load(f.c)).optJSONObject(0);
        assertTrue(row.optLong("deliveredAt")>0);assertTrue(SendStatus.line(row).contains("มีรายงานถึงเครื่องผู้รับ"));
        assertFalse(SendStatus.line(row).contains("อ่านแล้ว"));assertTrue(SuccessLog.csv(f.c).contains("DELIVERED"));
    }
    @Test public void messageBodyAndFailedResultSurviveQueueReplacement(){
        two(false);Scheduler.result(f.c,f.callback(0),Activity.RESULT_CANCELED);
        Scheduler.result(f.c,f.callback(1),Activity.RESULT_OK);
        JSONObject before=Store.rows(Store.load(f.c)).optJSONObject(0);
        assertTrue(before.optLong("resultAt")>0);
        MessageHistory.recordCampaign(f.c,Store.load(f.c));
        Store.save(f.c,Store.object());
        MessageHistory.Page page=MessageHistory.page(f.c,"FAILED",0,0);
        assertEquals(1,page.rows.size());
        assertEquals("FAILED",page.rows.get(0).optString("status"));
        assertEquals("caption\nhttps://example.com/a",page.rows.get(0).optString("body"));
        assertEquals(before.optLong("resultAt"),page.rows.get(0).optLong("resultAt"));
        assertTrue(SendStatus.line(page.rows.get(0)).contains("ข้อความ: caption https://example.com/a"));
        assertTrue(SendStatus.line(page.rows.get(0)).contains("ทราบผลส่ง"));
        assertTrue(SendStatus.detail(page.rows.get(0)).contains("ตรวจสอบไม่ได้"));
    }
    @Test public void lateMultipartDeliveryUpdatesOldCampaignAfterReplacement(){
        two(false);Scheduler.result(f.c,f.callback(0),Activity.RESULT_OK);
        Scheduler.result(f.c,f.callback(1),Activity.RESULT_OK);
        MessageHistory.recordCampaign(f.c,Store.load(f.c));
        Store.save(f.c,Store.object());
        DeliveredReceiver.record(f.c,f.callback(0),0);
        assertEquals(0,MessageHistory.page(f.c,"SENT",0,0).rows.get(0).optLong("deliveredAt"));
        DeliveredReceiver.record(f.c,f.callback(1),0);
        JSONObject row=MessageHistory.page(f.c,"SENT",0,0).rows.get(0);
        assertTrue(row.optLong("deliveredAt")>0);
        assertTrue(SendStatus.detail(row).contains("มีรายงานถึงเครื่องผู้รับ"));
        assertFalse(SendStatus.detail(row).contains("อ่านแล้ว"));
    }
    @Test public void legacySuccessShowsMissingBodyHonestly(){
        JSONObject old=Store.object(), success=Store.object();
        Store.put(success,"phone","+66800000009");Store.put(success,"resultAt",1234L);
        Store.put(old,"old-campaign:2",success);
        java.io.File file=SuccessLog.file(f.c).getBaseFile();
        try(java.io.FileOutputStream out=new java.io.FileOutputStream(file)){
            out.write(old.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
        }catch(java.io.IOException e){throw new AssertionError(e);}
        MessageHistory.Page page=MessageHistory.page(f.c,"",0,0);
        assertEquals(1,page.rows.size());
        assertTrue(page.rows.get(0).optBoolean("bodyUnavailable"));
        assertTrue(SendStatus.line(page.rows.get(0)).contains("ไม่มีเนื้อหาที่บันทึกไว้ในเวอร์ชันเดิม"));
        assertTrue(SendStatus.detail(page.rows.get(0)).contains("ไม่มีเนื้อหาที่บันทึกไว้ในเวอร์ชันเดิม"));
    }
    @Test public void historyPagesAreIndexedAndDoNotRepeatRows(){
        JSONObject campaign=Store.object();Store.put(campaign,"id","paged");
        JSONArray all=new JSONArray();Store.put(campaign,"rows",all);
        for(int i=0;i<50;i++){
            JSONObject row=Store.object();Store.put(row,"phone","+668000"+i);
            Store.put(row,"body","message "+i);Store.put(row,"status",i%2==0?"SENT":"FAILED");
            Store.put(row,"resultAt",1000L+i);all.put(row);
            MessageHistory.recordRow(f.c,campaign,i);
        }
        java.util.Set<String> seen=new java.util.HashSet<>();
        long at=0,id=0;int count=0;boolean updated=false;
        while(true){
            MessageHistory.Page page=MessageHistory.page(f.c,"",at,id);
            assertTrue(page.rows.size()<=24);
            for(JSONObject row:page.rows){assertTrue(seen.add(row.optString("phone")));count++;}
            if(!page.more)break;
            if(!updated){
                long revision=MessageHistory.revision(f.c);
                JSONObject first=all.optJSONObject(0);
                Store.put(first,"status","FAILED");Store.put(first,"resultAt",50000L);
                MessageHistory.recordRow(f.c,campaign,0);
                assertTrue(MessageHistory.revision(f.c)>revision);
                updated=true;
            }
            at=page.nextAt;id=page.nextId;
        }
        assertEquals(50,count);
        assertEquals(24,MessageHistory.page(f.c,"SENT",0,0).rows.size());
        try(android.database.sqlite.SQLiteDatabase db=android.database.sqlite.SQLiteDatabase.openDatabase(
                f.c.getDatabasePath("message-history.db").getPath(),null,android.database.sqlite.SQLiteDatabase.OPEN_READONLY);
            android.database.Cursor plan=db.rawQuery("EXPLAIN QUERY PLAN SELECT id,event_at,payload FROM messages WHERE status=? ORDER BY event_at DESC,id DESC LIMIT 25",new String[]{"SENT"})){
            boolean indexed=false;
            while(plan.moveToNext())if(plan.getString(3).contains("messages_status_recent"))indexed=true;
            assertTrue(indexed);
        }
    }
    @Test public void replacedPendingIsExplicitlyUnsent(){
        JSONObject d=two(false);MessageHistory.recordCampaign(f.c,d);
        MessageHistory.finishReplaced(f.c,d.optString("id"));
        MessageHistory.Page page=MessageHistory.page(f.c,"CANCELLED",0,0);
        assertEquals(1,page.rows.size());
        assertEquals("next",page.rows.get(0).optString("body"));
        assertTrue(SendStatus.detail(page.rows.get(0)).contains("คิวถูกแทนที่"));
    }
    @Test public void replacingLargeQueueMarksEveryPendingMessageWithoutLoss(){
        JSONObject d=Store.object();Store.put(d,"id","many-pending");
        Store.put(d,"createdAt",1000L);JSONArray rows=new JSONArray();
        for(int i=0;i<50;i++){
            JSONObject row=Store.object();Store.put(row,"phone","+668000"+i);
            Store.put(row,"body","body "+i);Store.put(row,"status","PENDING");rows.put(row);
        }
        Store.put(d,"rows",rows);MessageHistory.recordCampaign(f.c,d);
        MessageHistory.finishReplaced(f.c,d.optString("id"));
        assertEquals(0,MessageHistory.page(f.c,"PENDING",0,0).rows.size());
        int total=0;long at=0,id=0;
        while(true){
            MessageHistory.Page page=MessageHistory.page(f.c,"CANCELLED",at,id);
            total+=page.rows.size();if(!page.more)break;
            at=page.nextAt;id=page.nextId;
        }
        assertEquals(50,total);
    }
    @Test public void historyScreenKeepsOnlyOnePageInItsList() throws Exception {
        JSONObject campaign=Store.object();Store.put(campaign,"id","screen-pages");
        JSONArray rows=new JSONArray();Store.put(campaign,"rows",rows);
        for(int i=0;i<50;i++){
            JSONObject row=Store.object();Store.put(row,"phone","+66801"+i);
            Store.put(row,"body","body "+i);Store.put(row,"status","SENT");
            Store.put(row,"resultAt",1000L+i);rows.put(row);
            MessageHistory.recordRow(f.c,campaign,i);
        }
        try(var ctl=Robolectric.buildActivity(SendStatusActivity.class).setup()){
            SendStatusActivity screen=ctl.get();
            java.lang.reflect.Field listField=SendStatusActivity.class.getDeclaredField("list");
            java.lang.reflect.Field olderField=SendStatusActivity.class.getDeclaredField("older");
            java.lang.reflect.Field newerField=SendStatusActivity.class.getDeclaredField("newer");
            listField.setAccessible(true);olderField.setAccessible(true);newerField.setAccessible(true);
            ListView list=(ListView)listField.get(screen);
            Button older=(Button)olderField.get(screen),newer=(Button)newerField.get(screen);
            assertEquals(24,list.getAdapter().getCount());
            older.performClick();assertEquals(24,list.getAdapter().getCount());
            newer.performClick();assertEquals(24,list.getAdapter().getCount());
        }
    }
    @Test public void failedArchiveWriteReconcilesFromAuthoritativeQueueBeforeReplacement(){
        JSONObject d=two(false);MessageHistory.recordCampaign(f.c,d);
        Scheduler.result(f.c,f.callback(0),Activity.RESULT_OK);
        MessageHistory.failNextRecordRowForTests();
        assertThrows(IllegalStateException.class,()->Scheduler.result(f.c,f.callback(1),Activity.RESULT_OK));
        assertEquals("SENT",f.status());
        assertEquals(1,MessageHistory.page(f.c,"SENDING",0,0).rows.size());
        java.util.List<String> captions=java.util.Collections.nCopies(10,"caption");
        java.util.List<String> links=java.util.Collections.nCopies(10,"link");
        CampaignFactory.create(f.c,false,java.util.List.of("+66800000002"),"","",1,
                captions,links,7,"SIM",new java.util.Random(1));
        MessageHistory.Page sent=MessageHistory.page(f.c,"SENT",0,0);
        assertEquals(1,sent.rows.size());
        assertEquals("caption\nhttps://example.com/a",sent.rows.get(0).optString("body"));
        assertTrue(sent.rows.get(0).optLong("resultAt")>0);
        assertEquals(1,MessageHistory.page(f.c,"CANCELLED",0,0).rows.size());
        assertEquals(0,MessageHistory.page(f.c,"SENDING",0,0).rows.size());
    }
    @Test public void unknownAndSkippedTimesDoNotClaimConfirmedSend(){
        JSONObject unknown=Store.object();Store.put(unknown,"status","UNKNOWN");
        Store.put(unknown,"resultAt",1234L);
        assertTrue(SendStatus.line(unknown).contains("อัปเดตสถานะ"));
        assertFalse(SendStatus.line(unknown).contains("ทราบผลส่ง"));
        JSONObject skipped=Store.object();Store.put(skipped,"status","SKIPPED");
        Store.put(skipped,"resultAt",1234L);
        assertTrue(SendStatus.line(skipped).contains("อัปเดตสถานะ"));
        assertFalse(SendStatus.line(skipped).contains("ทราบผลส่ง"));
    }
    @Test public void failedReplacementClosureRepairsWhenHistoryReopens(){
        JSONObject old=f.queue("PENDING",1,false);
        MessageHistory.recordCampaign(f.c,old);
        java.util.List<String> captions=java.util.Collections.nCopies(10,"caption");
        java.util.List<String> links=java.util.Collections.nCopies(10,"link");
        MessageHistory.failNextFinishReplacedForTests();
        assertThrows(IllegalStateException.class,()->CampaignFactory.create(f.c,false,
                java.util.List.of("+66800000002"),"","",1,captions,links,7,"SIM",new java.util.Random(1)));
        JSONObject current=Store.load(f.c);
        assertNotEquals(old.optString("id"),current.optString("id"));
        assertEquals(old.optString("id"),current.optString("previousCampaignId"));
        assertEquals(1,MessageHistory.page(f.c,"PENDING",0,0).rows.size());
        try(var screen=Robolectric.buildActivity(SendStatusActivity.class).setup()){
            assertNotNull(screen.get());
        }
        assertEquals(1,MessageHistory.page(f.c,"CANCELLED",0,0).rows.size());
        assertEquals(1,MessageHistory.page(f.c,"PENDING",0,0).rows.size());
    }
    @Test public void nextReplacementRepairsEarlierUnfinishedClosure(){
        JSONObject first=f.queue("PENDING",1,false);MessageHistory.recordCampaign(f.c,first);
        java.util.List<String> captions=java.util.Collections.nCopies(10,"caption");
        java.util.List<String> links=java.util.Collections.nCopies(10,"link");
        MessageHistory.failNextFinishReplacedForTests();
        assertThrows(IllegalStateException.class,()->CampaignFactory.create(f.c,false,
                java.util.List.of("+66800000002"),"","",1,captions,links,7,"SIM",new java.util.Random(1)));
        JSONObject middle=Store.load(f.c);
        CampaignFactory.create(f.c,false,java.util.List.of("+66800000003"),"","",1,
                captions,links,7,"SIM",new java.util.Random(2));
        assertEquals(middle.optString("id"),Store.load(f.c).optString("previousCampaignId"));
        assertEquals(2,MessageHistory.page(f.c,"CANCELLED",0,0).rows.size());
    }
    @Test public void failedNewQueueCommitNeverCancelsOldPendingHistory(){
        JSONObject old=f.queue("PENDING",1,false);MessageHistory.recordCampaign(f.c,old);
        java.util.List<String> captions=java.util.Collections.nCopies(10,"caption");
        java.util.List<String> links=java.util.Collections.nCopies(10,"link");
        Store.failNextSaveForTests();
        assertThrows(IllegalStateException.class,()->CampaignFactory.create(f.c,false,
                java.util.List.of("+66800000002"),"","",1,captions,links,7,"SIM",new java.util.Random(1)));
        assertEquals(old.optString("id"),Store.load(f.c).optString("id"));
        assertEquals(1,MessageHistory.page(f.c,"PENDING",0,0).rows.size());
        assertEquals(0,MessageHistory.page(f.c,"CANCELLED",0,0).rows.size());
    }
}
