package com.smsmix.app;

import android.app.*;
import android.content.*;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.*;
import java.io.*;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28)
public class QueueTest {
    Context c;

    @Before public void setup() {
        c = RuntimeEnvironment.getApplication();
        Store.file(c).delete();
        LicenseClient.setVerifierForTests(context -> true);
    }
    @After public void teardown() { LicenseClient.setVerifierForTests(null); Scheduler.setHandoffForTests(null); }

    JSONObject queue(String status, int parts, boolean running) {
        JSONObject d = Store.object(), row = Store.object();
        Store.put(d,"id","test-campaign"); Store.put(d,"running",running);
        Store.put(d,"nextAt",System.currentTimeMillis()+600000);
        Store.put(row,"phone","+66800000000"); Store.put(row,"body","test");
        Store.put(row,"status",status); Store.put(row,"deadline",System.currentTimeMillis()+300000);
        JSONArray results = new JSONArray(); for(int p=0;p<parts;p++) results.put(0);
        Store.put(row,"parts",results);
        JSONArray rows = new JSONArray(); rows.put(row);
        Store.put(d,"rows",rows); Store.save(c,d); return d;
    }

    Intent callback(int part) {
        return new Intent().putExtra("id","test-campaign").putExtra("row",0).putExtra("part",part);
    }
    String status() { return Store.rows(Store.load(c)).optJSONObject(0).optString("status"); }

    @Test public void persistentQueueRoundTrip() {
        JSONObject d = queue("PENDING",1,false);
        assertEquals(d.toString(),Store.load(c).toString());
        assertEquals(0,Store.pending(Store.load(c)));
    }
    @Test public void corruptStoreFailsClosed() throws Exception {
        try(FileOutputStream out = new FileOutputStream(Store.file(c).getBaseFile())) { out.write("{bad".getBytes()); }
        assertThrows(IllegalStateException.class,()->Store.load(c));
    }
    @Test public void multipartWaitsForEveryPart() {
        queue("SENDING",2,true);
        Scheduler.result(c,callback(0),Activity.RESULT_OK);
        assertEquals("SENDING",status());
        Scheduler.result(c,callback(1),Activity.RESULT_OK);
        assertEquals("SENT",status());
        assertFalse(Store.load(c).optBoolean("running"));
    }
    @Test public void duplicateAndWrongCampaignCallbacksIgnored() {
        queue("SENDING",2,true);
        Scheduler.result(c,callback(0),Activity.RESULT_OK);
        Scheduler.result(c,callback(0),Activity.RESULT_CANCELED);
        Scheduler.result(c,callback(1).putExtra("id","stale"),Activity.RESULT_OK);
        assertEquals("SENDING",status());
        Scheduler.result(c,callback(1),Activity.RESULT_OK);
        assertEquals("SENT",status());
    }
    @Test public void partialFailureStopsQueue() {
        queue("SENDING",2,true);
        Scheduler.result(c,callback(0),Activity.RESULT_OK);
        Scheduler.result(c,callback(1),Activity.RESULT_CANCELED);
        assertEquals("FAILED",status());
        assertFalse(Store.load(c).optBoolean("running"));
    }
    @Test public void expiredSendingBecomesUnknownAndNeverPending() {
        JSONObject d=queue("SENDING",1,true);
        Store.put(Store.rows(d).optJSONObject(0),"deadline",System.currentTimeMillis()-1);
        Store.save(c,d);
        Scheduler.recoverTimeout(c,d);
        assertEquals("UNKNOWN",status());
        assertEquals(-1,Store.pending(Store.load(c)));
        assertFalse(Store.load(c).optBoolean("running"));
        Scheduler.result(c,callback(0),Activity.RESULT_OK);
        assertEquals("UNKNOWN",status());
    }
    @Test public void pauseAllowsCurrentReceiptButDoesNotResume() {
        JSONObject d=queue("SENDING",1,true);
        JSONObject next=Store.object(); Store.put(next,"status","PENDING"); Store.rows(d).put(next);
        Store.save(c,d);
        Scheduler.pause(c,d,"paused");
        Scheduler.result(c,callback(0),Activity.RESULT_OK);
        assertEquals("SENT",status());
        assertFalse(Store.load(c).optBoolean("running"));
        assertEquals(1,Store.pending(Store.load(c)));
    }
    @Test public void rebootPausesAndMarksInflightUnknown() {
        queue("SENDING",1,true);
        new BootReceiver().onReceive(c,new Intent(Intent.ACTION_BOOT_COMPLETED));
        assertEquals("UNKNOWN",status()); assertFalse(Store.load(c).optBoolean("running"));
    }
    @Test public void staleOrPausedAlarmCannotSend() {
        queue("PENDING",1,false);
        Scheduler.tick(c,"test-campaign",false);
        assertEquals("PENDING",status());
        Scheduler.tick(c,"stale",false);
        assertEquals("PENDING",status());
    }
    @Test public void missingPermissionCannotStartQueue() {
        JSONObject d=queue("PENDING",1,false);
        assertThrows(IllegalStateException.class,()->Scheduler.resume(c,d));
        assertFalse(Store.load(c).optBoolean("running"));
    }
    @Test public void screenCanOpenWithoutPermissionsOrSim() {
        try (var controller=Robolectric.buildActivity(MainActivity.class).setup()) {
            assertNotNull(controller.get());
        }
    }

    void allowSim() {
        Shadows.shadowOf((Application)c).grantPermissions(
                android.Manifest.permission.SEND_SMS, android.Manifest.permission.READ_PHONE_STATE);
        Shadows.shadowOf(c.getSystemService(android.telephony.SubscriptionManager.class))
                .setActiveSubscriptionInfos(org.robolectric.shadows.ShadowSubscriptionManager.SubscriptionInfoBuilder
                        .newBuilder().setId(7).setSimSlotIndex(1).setDisplayName("Test SIM").buildSubscriptionInfo());
    }

    @Test public void actualHandoffUsesSelectedSimAndPersistsBeforeDuplicateAlarm() {
        allowSim();
        JSONObject d=queue("PENDING",1,true);
        Store.put(d,"sim",7); Store.put(d,"nextAt",0); Store.save(c,d);
        Scheduler.tick(c,"test-campaign",false);
        var sms=Shadows.shadowOf(Scheduler.sms(7));
        assertNotNull(sms.getLastSentTextMessageParams());
        assertEquals("+66800000000",sms.getLastSentTextMessageParams().getDestinationAddress());
        assertEquals("test",sms.getLastSentTextMessageParams().getText());
        assertEquals("SENDING",status());
        JSONObject saved=Store.load(c);
        long delay=saved.optLong("nextAt")-Store.rows(saved).optJSONObject(0).optLong("sentAt");
        assertTrue(delay>=600000 && delay<=1800000);
        sms.clearLastSentTextMessageParams();
        Scheduler.tick(c,"test-campaign",false);
        assertNull(sms.getLastSentTextMessageParams());
    }

    @Test public void concurrentDueAlarmsClaimOnePendingRowOnce() throws Exception {
        allowSim();
        JSONObject d=queue("PENDING",1,true);
        Store.put(d,"sim",7); Store.put(d,"nextAt",0); Store.save(c,d);
        CountDownLatch checked=new CountDownLatch(1), release=new CountDownLatch(1);
        AtomicInteger handoffs=new AtomicInteger(), checks=new AtomicInteger();
        LicenseClient.setVerifierForTests(context -> {
            checks.incrementAndGet(); checked.countDown();
            try { return release.await(3,TimeUnit.SECONDS); }
            catch (InterruptedException error) { Thread.currentThread().interrupt(); return false; }
        });
        Scheduler.setHandoffForTests((manager,row,parts,callbacks) -> handoffs.incrementAndGet());
        Thread first=new Thread(() -> Scheduler.tick(c,"test-campaign",false));
        Thread second=new Thread(() -> Scheduler.tick(c,"test-campaign",false));
        first.start(); second.start();
        assertTrue(checked.await(3,TimeUnit.SECONDS));
        release.countDown();
        first.join(3000); second.join(3000);
        assertFalse(first.isAlive()); assertFalse(second.isAlive());
        assertEquals(1,handoffs.get());
        assertEquals(1,checks.get());
        assertEquals("SENDING",status());
    }

    @Test public void staggeredForegroundAndDuplicateDueAlarmsUseOneFreshHandoffCheck() throws Exception {
        allowSim();
        JSONObject d=queue("PENDING",1,true);
        Store.put(d,"sim",7); Store.put(d,"nextAt",0); Store.save(c,d);
        CountDownLatch foregroundEntered=new CountDownLatch(1), dueEntered=new CountDownLatch(1);
        CountDownLatch releaseForeground=new CountDownLatch(1), releaseDue=new CountDownLatch(1);
        AtomicInteger checks=new AtomicInteger(), handoffs=new AtomicInteger();
        LicenseClient.setVerifierForTests(context -> {
            int call=checks.incrementAndGet();
            try {
                if(call==1) { foregroundEntered.countDown(); return releaseForeground.await(4,TimeUnit.SECONDS); }
                if(call==2) { dueEntered.countDown(); return releaseDue.await(4,TimeUnit.SECONDS); }
            } catch(InterruptedException error) { Thread.currentThread().interrupt(); return false; }
            return false;
        });
        Scheduler.setHandoffForTests((manager,row,parts,callbacks) -> handoffs.incrementAndGet());
        Thread foreground=new Thread(() -> LicenseClient.checkCurrent(c));
        foreground.start(); assertTrue(foregroundEntered.await(3,TimeUnit.SECONDS));
        Thread.sleep(250);
        Thread dueA=new Thread(() -> Scheduler.tick(c,"test-campaign",false));
        dueA.start(); assertTrue(dueEntered.await(3,TimeUnit.SECONDS));
        Thread.sleep(250);
        Thread dueB=new Thread(() -> Scheduler.tick(c,"test-campaign",false));
        dueB.start(); dueB.join(1000); assertFalse(dueB.isAlive());
        assertEquals(2,checks.get());
        assertEquals(0,handoffs.get());
        releaseDue.countDown(); releaseForeground.countDown();
        dueA.join(3000); foreground.join(3000);
        assertFalse(dueA.isAlive()); assertFalse(foreground.isAlive());
        assertEquals(1,handoffs.get());
        assertEquals("SENDING",status());
    }

    @Test public void manualPauseDuringOnlineCheckPreventsHandoff() throws Exception {
        allowSim();
        JSONObject d=queue("PENDING",1,true);
        Store.put(d,"sim",7); Store.put(d,"nextAt",0); Store.save(c,d);
        CountDownLatch checking=new CountDownLatch(1), release=new CountDownLatch(1);
        AtomicInteger handoffs=new AtomicInteger();
        LicenseClient.setVerifierForTests(context -> {
            checking.countDown();
            try { return release.await(3,TimeUnit.SECONDS); }
            catch (InterruptedException error) { Thread.currentThread().interrupt(); return false; }
        });
        Scheduler.setHandoffForTests((manager,row,parts,callbacks) -> handoffs.incrementAndGet());
        Thread alarm=new Thread(() -> Scheduler.tick(c,"test-campaign",false));
        alarm.start();
        assertTrue(checking.await(3,TimeUnit.SECONDS));
        Scheduler.pause(c,Store.load(c),"manual pause");
        release.countDown(); alarm.join(3000);
        assertFalse(alarm.isAlive());
        assertEquals(0,handoffs.get());
        assertEquals("PENDING",status());
        assertFalse(Store.load(c).optBoolean("running"));
    }

    @Test public void resumeCannotOverwriteQueueReplacedDuringOnlineCheck() throws Exception {
        allowSim();
        JSONObject old=queue("PENDING",1,false);
        Store.put(old,"sim",7); Store.save(c,old);
        CountDownLatch checking=new CountDownLatch(1), release=new CountDownLatch(1);
        LicenseClient.setVerifierForTests(context -> {
            checking.countDown();
            try { return release.await(3,TimeUnit.SECONDS); }
            catch (InterruptedException error) { Thread.currentThread().interrupt(); return false; }
        });
        AtomicReference<Throwable> failure=new AtomicReference<>();
        Thread start=new Thread(() -> {
            try { Scheduler.resume(c,old); }
            catch (Throwable error) { failure.set(error); }
        });
        start.start(); assertTrue(checking.await(3,TimeUnit.SECONDS));
        synchronized (Scheduler.LOCK) {
            JSONObject replacement=Store.object(), row=Store.object(), rows=new JSONObject();
            Store.put(replacement,"id","replacement"); Store.put(replacement,"running",false);
            Store.put(row,"status","PENDING");
            JSONArray list=new JSONArray(); list.put(row); Store.put(replacement,"rows",list);
            Store.save(c,replacement);
        }
        release.countDown(); start.join(3000);
        assertFalse(start.isAlive()); assertNotNull(failure.get());
        assertEquals("replacement",Store.load(c).optString("id"));
        assertFalse(Store.load(c).optBoolean("running"));
    }

    @Test public void concurrentMultipartCallbacksRetainBothParts() throws Exception {
        queue("SENDING",2,true);
        Thread first=new Thread(() -> Scheduler.result(c,callback(0),Activity.RESULT_OK));
        Thread second=new Thread(() -> Scheduler.result(c,callback(1),Activity.RESULT_OK));
        first.start(); second.start(); first.join(3000); second.join(3000);
        assertFalse(first.isAlive()); assertFalse(second.isAlive());
        JSONObject row=Store.rows(Store.load(c)).optJSONObject(0);
        assertEquals(1,row.optJSONArray("parts").optInt(0));
        assertEquals(1,row.optJSONArray("parts").optInt(1));
        assertEquals("SENT",row.optString("status"));
    }

    @Test public void hungOnlineVerifierTimesOutWithoutSending() {
        allowSim();
        JSONObject d=queue("PENDING",1,true);
        Store.put(d,"sim",7); Store.put(d,"nextAt",0); Store.save(c,d);
        AtomicInteger handoffs=new AtomicInteger();
        LicenseClient.setVerifierForTests(context -> {
            try { Thread.sleep(30_000); } catch (InterruptedException error) { Thread.currentThread().interrupt(); }
            return true;
        });
        Scheduler.setHandoffForTests((manager,row,parts,callbacks) -> handoffs.incrementAndGet());
        long start=System.nanoTime();
        Scheduler.tick(c,"test-campaign",false);
        long elapsed=(System.nanoTime()-start)/1_000_000;
        assertTrue("watchdog exceeded broadcast budget: "+elapsed,elapsed<8000);
        assertEquals(0,handoffs.get());
        assertEquals("PENDING",status());
        assertFalse(Store.load(c).optBoolean("running"));
    }

    @Test public void thaiMultipartHasOneCallbackPerPartAndSchedulesNextRecipient() {
        allowSim();
        JSONObject d=queue("PENDING",1,true);
        String body="ทดสอบข้อความภาษาไทย ".repeat(20);
        Store.put(Store.rows(d).optJSONObject(0),"body",body);
        JSONObject next=Store.object();
        Store.put(next,"phone","+66800000001"); Store.put(next,"body","next"); Store.put(next,"status","PENDING");
        Store.rows(d).put(next);
        Store.put(d,"sim",7); Store.put(d,"nextAt",0); Store.save(c,d);
        Scheduler.tick(c,"test-campaign",false);
        var params=Shadows.shadowOf(Scheduler.sms(7)).getLastSentMultipartTextMessageParams();
        assertNotNull(params); assertTrue(params.getParts().size()>1);
        assertEquals(body,String.join("",params.getParts()));
        assertEquals(params.getParts().size(),params.getSentIntents().size());
        for(int p=0;p<params.getParts().size();p++) Scheduler.result(c,callback(p),Activity.RESULT_OK);
        assertEquals("SENT",status());
        assertTrue(Store.load(c).optBoolean("running"));
        var alarm=Shadows.shadowOf(c.getSystemService(AlarmManager.class)).peekNextScheduledAlarm();
        assertNotNull(alarm);
        assertEquals(Store.load(c).optLong("nextAt"),alarm.getTriggerAtMs());
        var sms=Shadows.shadowOf(Scheduler.sms(7));
        sms.clearLastSentTextMessageParams();
        Scheduler.tick(c,"test-campaign",false);
        assertNull(sms.getLastSentTextMessageParams());
    }
}
