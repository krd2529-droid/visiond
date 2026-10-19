package com.smsmix.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;
import android.telephony.SmsManager;
import android.widget.Spinner;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.Shadows;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowSubscriptionManager;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28)
public class DualSimTest {
    Context c;
    SubscriptionInfo sim1, sim2;

    @Before public void setup() {
        c = RuntimeEnvironment.getApplication();
        Store.file(c).delete();
        LicenseClient.setVerifierForTests(context -> true);
        Shadows.shadowOf((android.app.Application)c).grantPermissions(
                android.Manifest.permission.SEND_SMS, android.Manifest.permission.READ_PHONE_STATE);
        sim1 = ShadowSubscriptionManager.SubscriptionInfoBuilder.newBuilder()
                .setId(7).setSimSlotIndex(0).setDisplayName("First").buildSubscriptionInfo();
        sim2 = ShadowSubscriptionManager.SubscriptionInfoBuilder.newBuilder()
                .setId(8).setSimSlotIndex(1).setDisplayName("Second").buildSubscriptionInfo();
        active(sim2, sim1); // Deliberately reversed: physical slot controls routing.
    }

    @After public void teardown() {
        LicenseClient.setVerifierForTests(null);
        Scheduler.setHandoffForTests(null);
    }

    void active(SubscriptionInfo... infos) {
        Shadows.shadowOf(c.getSystemService(SubscriptionManager.class)).setActiveSubscriptionInfos(infos);
    }

    JSONObject queue(int rows) {
        JSONObject d = Store.object();
        Store.put(d, "id", "dual-test");
        Store.put(d, "running", true);
        Store.put(d, "sim", 7);
        Store.put(d, "alternateSim", 8);
        Store.put(d, "simMode", "alternate");
        Store.put(d, "nextAt", 0);
        JSONArray list = new JSONArray();
        for (int i=0;i<rows;i++) {
            JSONObject row = Store.object();
            Store.put(row, "phone", "+6680000000" + i);
            Store.put(row, "body", "test " + i);
            Store.put(row, "status", "PENDING");
            Store.put(row, "sim", i % 2 == 0 ? 7 : 8);
            Store.put(row, "simLabel", i % 2 == 0 ? "SIM 1" : "SIM 2");
            list.put(row);
        }
        Store.put(d, "rows", list);
        Store.save(c,d);
        return d;
    }

    JSONObject saved() { return Store.load(c); }
    JSONObject row(int i) { return Store.rows(saved()).optJSONObject(i); }
    void result(int i, int code) {
        Scheduler.result(c,new Intent().putExtra("id","dual-test").putExtra("row",i).putExtra("part",0),code);
    }
    void due() {
        JSONObject d = saved(); Store.put(d,"nextAt",0); Store.save(c,d);
        Scheduler.tick(c,"dual-test",false);
    }
    void delayBetween(long lowMinutes, long highMinutes) {
        long remaining = saved().optLong("nextAt") - System.currentTimeMillis();
        assertTrue("delay too short: " + remaining, remaining >= lowMinutes * 60_000L - 1000);
        assertTrue("delay too long: " + remaining, remaining <= highMinutes * 60_000L + 1000);
    }

    @Test public void composerUsesPhysicalSlotOrderEvenWhenSubscriptionListIsReversed() throws Exception {
        try (var controller = Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity activity = controller.get(); activity.renderApp();
            Field spinnerField = MainActivity.class.getDeclaredField("simSpinner");
            spinnerField.setAccessible(true);
            Spinner spinner = (Spinner)spinnerField.get(activity);
            assertEquals(3,spinner.getCount());
            assertTrue(spinner.getItemAtPosition(0).toString().startsWith("SIM 1"));
            assertTrue(spinner.getItemAtPosition(1).toString().startsWith("SIM 2"));
            assertTrue(spinner.getItemAtPosition(2).toString().contains("สลับอัตโนมัติ"));
        }
    }

    @Test public void factoryPersistsEachMessageSimAndLegacyQueueStaysSingle() {
        List<String> captions = new ArrayList<>(), links = new ArrayList<>();
        for (int i=0;i<10;i++) { captions.add("caption " + i); links.add("https://example.com/" + i); }
        JSONObject d = CampaignFactory.create(c,false,List.of("0800000000","0800000001","0800000002","0800000003"),
                "","",4,captions,links,7,8,"สลับ SIM 1 / SIM 2",new Random(1));
        assertEquals("alternate",saved().optString("simMode"));
        assertEquals(8,saved().optInt("alternateSim"));
        for (int i=0;i<4;i++) {
            JSONObject item = Store.rows(saved()).optJSONObject(i);
            assertEquals(i % 2 == 0 ? 7 : 8,item.optInt("sim"));
            assertEquals(i % 2 == 0 ? "SIM 1" : "SIM 2",item.optString("simLabel"));
            assertEquals(item.optInt("sim"),Scheduler.simForRow(saved(),item,i));
        }
        assertEquals(4,Store.rows(d).length());
        JSONObject legacy = Store.object(); Store.put(legacy,"sim",7);
        assertEquals(7,Scheduler.simForRow(legacy,Store.object(),3));
    }

    @Test public void firstResultUnlocksSecondImmediatelyThenOneRoundDelay() {
        queue(4);
        AtomicInteger handoffs = new AtomicInteger();
        Scheduler.setHandoffForTests((manager,item,parts,callbacks,deliveries) -> {
            assertEquals(item.optInt("sim"),manager.getSubscriptionId());
            handoffs.incrementAndGet();
        });
        Scheduler.tick(c,"dual-test",false);
        assertEquals(1,handoffs.get()); assertEquals("SENDING",row(0).optString("status"));
        Scheduler.tick(c,"dual-test",false);
        assertEquals(1,handoffs.get()); // No simultaneous SIM 2 send while SIM 1 awaits result.
        result(0,Activity.RESULT_OK);
        assertEquals("SENT",row(0).optString("status"));
        assertTrue(saved().optLong("nextAt") - System.currentTimeMillis() < 1000);
        due();
        assertEquals(2,handoffs.get()); assertEquals("SENDING",row(1).optString("status"));
        result(1,Activity.RESULT_OK);
        delayBetween(10,30);
        assertEquals(-1,saved().optInt("fallbackSim",-1)); // A recipient failure is not proof of SIM outage.
        Scheduler.tick(c,"dual-test",false);
        assertEquals(2,handoffs.get()); // Round delay blocks SIM 1 of next pair.
        due();
        assertEquals(3,handoffs.get()); assertEquals(7,row(2).optInt("sim"));
    }

    @Test public void firstFailureWaitsOneMinuteThenGivesOtherSimTurn() {
        queue(3);
        Scheduler.setHandoffForTests((manager,item,parts,callbacks,deliveries) -> {});
        Scheduler.tick(c,"dual-test",false);
        result(0,Activity.RESULT_CANCELED);
        assertEquals("FAILED",row(0).optString("status"));
        assertEquals(row(0).optLong("resultAt")+60_000L,saved().optLong("nextAt"));
        delayBetween(1,1);
        assertEquals(1,Store.pending(saved()));
        due(); assertEquals("SENDING",row(1).optString("status"));
        result(1,Activity.RESULT_OK);
        delayBetween(10,30);
        assertEquals(2,Store.pending(saved()));
        assertEquals("FAILED",row(0).optString("status")); // Never requeued.
    }

    @Test public void secondFailureWaitsOneMinuteEvenAfterFirstSuccess() {
        queue(3);
        Scheduler.setHandoffForTests((manager,item,parts,callbacks,deliveries) -> {});
        Scheduler.tick(c,"dual-test",false); result(0,Activity.RESULT_OK);
        due(); result(1,Activity.RESULT_CANCELED);
        delayBetween(1,1);
        assertEquals("FAILED",row(1).optString("status"));
        assertEquals(row(1).optLong("resultAt")+60_000L,saved().optLong("nextAt"));
        assertEquals(-1,saved().optInt("fallbackSim",-1));
        queue(3);
        Scheduler.tick(c,"dual-test",false); result(0,Activity.RESULT_CANCELED);
        delayBetween(1,1);
        due(); result(1,Activity.RESULT_CANCELED);
        delayBetween(1,1);
        assertTrue(saved().optBoolean("running"));
        due(); assertEquals("SENDING",row(2).optString("status"));
    }

    @Test public void noServiceDemotesOnlyThatSimAndAuditsLaterSender() {
        queue(4);
        AtomicInteger handoffs = new AtomicInteger();
        Scheduler.setHandoffForTests((manager,item,parts,callbacks,deliveries) -> handoffs.incrementAndGet());
        Scheduler.tick(c,"dual-test",false); result(0,Activity.RESULT_OK);
        due(); assertEquals(8,row(1).optInt("usedSim"));
        result(1,SmsManager.RESULT_ERROR_NO_SERVICE);
        assertEquals("FAILED",row(1).optString("status"));
        assertEquals(7,saved().optInt("fallbackSim"));
        assertEquals(row(1).optLong("resultAt")+60_000L,saved().optLong("nextAt"));
        delayBetween(1,1);
        due(); assertEquals("SENDING",row(2).optString("status"));
        result(2,Activity.RESULT_OK); delayBetween(10,30);
        due(); assertEquals("SENDING",row(3).optString("status"));
        assertEquals(7,row(3).optInt("usedSim"));
        assertEquals(8,row(3).optInt("sim"));
        assertEquals(4,handoffs.get());
    }

    @Test public void noServiceOnFirstTurnWaitsOneMinuteForPartnerThenOneSimCadence() {
        queue(3);
        Scheduler.setHandoffForTests((manager,item,parts,callbacks,deliveries) -> {});
        Scheduler.tick(c,"dual-test",false);
        result(0,SmsManager.RESULT_ERROR_NO_SERVICE);
        assertEquals(8,saved().optInt("fallbackSim"));
        delayBetween(1,1);
        due(); assertEquals(8,row(1).optInt("usedSim"));
        result(1,Activity.RESULT_OK); delayBetween(10,30);
        due(); assertEquals(8,row(2).optInt("usedSim"));
    }

    @Test public void missingSim2ConsumesOnlyItsRecipientThenPersistsSim1Fallback() {
        queue(4);
        active(sim1);
        AtomicInteger handoffs = new AtomicInteger();
        Scheduler.setHandoffForTests((manager,item,parts,callbacks,deliveries) -> {
            assertEquals(7,manager.getSubscriptionId()); handoffs.incrementAndGet();
        });
        Scheduler.tick(c,"dual-test",false);
        assertEquals(1,handoffs.get());
        result(0,Activity.RESULT_OK);
        due();
        assertEquals("SKIPPED",row(1).optString("status"));
        assertEquals(1,handoffs.get());
        assertEquals(7,saved().optInt("fallbackSim"));
        delayBetween(10,30);
        Scheduler.pause(c,saved(),"manual pause");
        Scheduler.resume(c,saved());
        due(); assertEquals("SENDING",row(2).optString("status"));
        assertEquals(2,handoffs.get());
        result(2,Activity.RESULT_OK); delayBetween(10,30);
        due(); assertEquals("SENDING",row(3).optString("status"));
        assertEquals(7,row(3).optInt("usedSim")); // Original planned SIM 2 is retained for audit.
        assertEquals(8,row(3).optInt("sim"));
        assertEquals(3,handoffs.get());
    }

    @Test public void missingSim1SkipsFirstRecipientAndUsesSim2ForLaterRows() {
        queue(3); active(sim2);
        AtomicInteger handoffs = new AtomicInteger();
        Scheduler.setHandoffForTests((manager,item,parts,callbacks,deliveries) -> {
            assertEquals(8,manager.getSubscriptionId()); handoffs.incrementAndGet();
        });
        Scheduler.tick(c,"dual-test",false);
        assertEquals(0,handoffs.get());
        assertEquals("SKIPPED",row(0).optString("status"));
        assertTrue(saved().optBoolean("running"));
        assertEquals(8,saved().optInt("fallbackSim"));
        due(); assertEquals("SENDING",row(1).optString("status"));
        result(1,Activity.RESULT_OK); delayBetween(10,30);
        due(); assertEquals("SENDING",row(2).optString("status"));
        assertEquals(8,row(2).optInt("usedSim"));
        assertEquals(7,row(2).optInt("sim"));
    }

    @Test public void replacementTriggersFallbackButDefiniteFailureOnSurvivorKeepsProgressing() {
        queue(4);
        SubscriptionInfo replacement = ShadowSubscriptionManager.SubscriptionInfoBuilder.newBuilder()
                .setId(9).setSimSlotIndex(1).setDisplayName("Replacement").buildSubscriptionInfo();
        active(sim1,replacement);
        AtomicInteger handoffs = new AtomicInteger();
        Scheduler.setHandoffForTests((manager,item,parts,callbacks,deliveries) -> {
            assertEquals(7,manager.getSubscriptionId()); handoffs.incrementAndGet();
        });
        Scheduler.tick(c,"dual-test",false); result(0,Activity.RESULT_OK);
        due(); assertEquals("SKIPPED",row(1).optString("status"));
        assertEquals(7,saved().optInt("fallbackSim"));
        due(); assertEquals("SENDING",row(2).optString("status"));
        result(2,Activity.RESULT_CANCELED);
        assertEquals("FAILED",row(2).optString("status"));
        assertEquals(row(2).optLong("resultAt")+60_000L,saved().optLong("nextAt"));
        assertTrue(saved().optBoolean("running"));
        delayBetween(1,1);
        due(); assertEquals("SENDING",row(3).optString("status"));
        assertEquals(7,row(3).optInt("usedSim"));
        assertEquals(3,handoffs.get());
    }

    @Test public void bothMissingStopsWithPendingIntactAndTamperedRowDoesNotSend() {
        queue(2); active();
        AtomicInteger handoffs = new AtomicInteger();
        Scheduler.setHandoffForTests((manager,item,parts,callbacks,deliveries) -> handoffs.incrementAndGet());
        Scheduler.tick(c,"dual-test",false);
        assertEquals(0,handoffs.get()); assertFalse(saved().optBoolean("running"));
        assertEquals("PENDING",row(0).optString("status"));

        active(sim1,sim2);
        JSONObject d=saved();
        Store.put(d,"running",true);
        Store.put(Store.rows(d).optJSONObject(0),"sim",8);
        Store.save(c,d);
        Scheduler.tick(c,"dual-test",false);
        assertEquals(0,handoffs.get());
        assertFalse(saved().optBoolean("running"));
        assertEquals("PENDING",row(0).optString("status"));
    }

    @Test public void deniedLicenseKeepsBothSimRowsPending() {
        queue(2);
        LicenseClient.setVerifierForTests(context -> false);
        Scheduler.tick(c,"dual-test",false);
        assertFalse(saved().optBoolean("running"));
        assertEquals("PENDING",row(0).optString("status"));
        assertEquals("PENDING",row(1).optString("status"));
    }
}
