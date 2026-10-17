package com.smsmix.app;
import android.app.*;
import android.content.*;
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
    @Test public void failedMultipartAdvancesAfterFiveToTenMinutesAndNeverRetries(){
        two(true);Scheduler.result(f.c,f.callback(0),Activity.RESULT_CANCELED);
        assertEquals("SENDING",f.status());
        Scheduler.result(f.c,f.callback(1),Activity.RESULT_OK);
        JSONObject d=Store.load(f.c);assertEquals("FAILED",f.status());assertTrue(d.optBoolean("running"));
        long wait=d.optLong("nextAt")-Store.rows(d).optJSONObject(0).optLong("resultAt");
        assertTrue(wait>=300000 && wait<=600000);assertEquals(1,Store.pending(d));
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
        assertTrue(SendStatus.line(Store.rows(Store.load(f.c)).optJSONObject(0)).contains("ยังไม่ยืนยันการรับ"));
        DeliveredReceiver.record(f.c,f.callback(1),0);
        JSONObject row=Store.rows(Store.load(f.c)).optJSONObject(0);
        assertTrue(row.optLong("deliveredAt")>0);assertTrue(SendStatus.line(row).contains("ถึงเครื่องผู้รับแล้ว"));
        assertFalse(SendStatus.line(row).contains("อ่านแล้ว"));assertTrue(SuccessLog.csv(f.c).contains("DELIVERED"));
    }
}
