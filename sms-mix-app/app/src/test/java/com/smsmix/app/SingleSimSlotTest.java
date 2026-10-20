package com.smsmix.app;

import android.Manifest;
import android.app.Activity;
import android.app.Application;
import android.content.Context;
import android.content.Intent;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;
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
import org.robolectric.shadows.ShadowAlertDialog;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=28)
public class SingleSimSlotTest {
    Context context;
    SubscriptionInfo sim1,sim2;
    List<String> captions=new ArrayList<>(), links=new ArrayList<>();
    @Before public void setup() {
        context=RuntimeEnvironment.getApplication(); Store.file(context).delete();
        context.deleteDatabase("message-history.db"); LicenseClient.setVerifierForTests(c -> true);
        Shadows.shadowOf((Application)context).grantPermissions(Manifest.permission.SEND_SMS,Manifest.permission.READ_PHONE_STATE);
        sim1=sim(7,0);sim2=sim(8,1);active(sim1,sim2);
        for(int i=0;i<10;i++){captions.add("caption "+i);links.add("https://example.com/"+i);}
    }
    @After public void teardown(){Scheduler.setHandoffForTests(null);LicenseClient.setVerifierForTests(null);}
    SubscriptionInfo sim(int id,int slot){return ShadowSubscriptionManager.SubscriptionInfoBuilder.newBuilder()
            .setId(id).setSimSlotIndex(slot).setDisplayName("Carrier").buildSubscriptionInfo();}
    void active(SubscriptionInfo... infos){Shadows.shadowOf(context.getSystemService(SubscriptionManager.class)).setActiveSubscriptionInfos(infos);}
    JSONObject create(int subscriptionId,boolean range){return create(subscriptionId,range,2);}
    JSONObject create(int subscriptionId,boolean range,int count){
        return CampaignFactory.create(context,range,range?List.of():List.of("0800000000","0800000001","0800000002"),
                "0800000000","0800000009",count,captions,links,subscriptionId,
                subscriptionId==7?"ซิมเดียว: SIM 1":"ซิมเดียว: SIM 2",new Random(2));
    }
    void due(){JSONObject queue=Store.load(context);Store.put(queue,"running",true);Store.put(queue,"nextAt",0);Store.save(context,queue);
        Scheduler.tick(context,queue.optString("id"),false);}
    void result(JSONObject queue,int code){Scheduler.result(context,new Intent().putExtra("id",queue.optString("id"))
            .putExtra("row",0).putExtra("part",0),code);}

    @Test public void explicitChoicesShowOnlyActivePhysicalSlots() throws Exception {
        try(var controller=Robolectric.buildActivity(MainActivity.class).setup()){
            MainActivity activity=controller.get();activity.renderApp();
            Field field=MainActivity.class.getDeclaredField("simSpinner");field.setAccessible(true);
            Spinner spinner=(Spinner)field.get(activity);
            assertTrue(spinner.getItemAtPosition(0).toString().startsWith("ซิมเดียว: SIM 1"));
            assertTrue(spinner.getItemAtPosition(1).toString().startsWith("ซิมเดียว: SIM 2"));
            assertTrue(spinner.getItemAtPosition(2).toString().contains("สลับอัตโนมัติ"));
            active(sim2);activity.loadSims();
            assertEquals(1,spinner.getCount());
            assertTrue(spinner.getItemAtPosition(0).toString().startsWith("ซิมเดียว: SIM 2"));
        }
    }

    @Test public void newSingleQueuePersistsSlotAndRepeatRetainsIt() {
        JSONObject first=create(8,true);assertEquals(1,first.optInt("singleSimSlot",-1));
        JSONArray rows=Store.rows(first);for(int i=0;i<rows.length();i++)Store.put(rows.optJSONObject(i),"status","SENT");
        active(sim(8,0));
        assertThrows(IllegalStateException.class,()->CampaignFactory.repeatCandidate(context,first,new Random(3)));
        active(sim1,sim2);
        JSONObject repeated=CampaignFactory.repeatCandidate(context,first,new Random(3));
        assertEquals(8,repeated.optInt("sim"));assertEquals(1,repeated.optInt("singleSimSlot",-1));
        assertFalse(Scheduler.alternating(repeated));
    }

    @Test public void movedSubscriptionPausesBeforeHandoffButLegacyQueueRemainsCompatible() {
        JSONObject queue=create(7,false);assertEquals(0,queue.optInt("singleSimSlot",-1));
        active(sim(7,1));AtomicInteger handoffs=new AtomicInteger();
        Scheduler.setHandoffForTests((manager,row,parts,sent,delivered)->handoffs.incrementAndGet());
        assertThrows(IllegalStateException.class,()->Scheduler.checkPermissions(context,queue));
        due();assertEquals(0,handoffs.get());
        assertEquals("PENDING",Store.rows(Store.load(context)).optJSONObject(0).optString("status"));
        assertFalse(Store.load(context).optBoolean("running"));
        assertTrue(assertThrows(IllegalStateException.class,()->Scheduler.resume(context,Store.load(context)))
                .getMessage().contains("ซิมเดียว"));
        JSONObject legacy=Store.load(context);legacy.remove("singleSimSlot");Store.save(context,legacy);
        due();assertEquals(1,handoffs.get());
        assertEquals(7,Store.rows(Store.load(context)).optJSONObject(0).optInt("usedSim"));
    }

    @Test public void unchangedOneSimSuccessAndFailureCadence() {
        JSONObject queue=create(7,false);
        Scheduler.setHandoffForTests((manager,row,parts,sent,delivered)->{});
        due();long handoffAt=Store.rows(Store.load(context)).optJSONObject(0).optLong("sentAt");
        long successDue=Store.load(context).optLong("nextAt");
        assertTrue(successDue-handoffAt>=10*60_000L && successDue-handoffAt<=30*60_000L);
        result(queue,Activity.RESULT_OK);
        assertEquals(successDue,Store.load(context).optLong("nextAt"));
        JSONObject d=Store.load(context);Store.put(d,"nextAt",0);Store.save(context,d);
        Scheduler.tick(context,d.optString("id"),false);
        Scheduler.result(context,new Intent().putExtra("id",d.optString("id")).putExtra("row",1).putExtra("part",0),Activity.RESULT_CANCELED);
        JSONObject failed=Store.load(context);
        assertEquals("FAILED",Store.rows(failed).optJSONObject(1).optString("status"));
        assertEquals(-1,Store.pending(failed));
    }

    @Test public void sim2FailureWaitsExactlyOneMinuteBeforeNextDifferentRecipient() {
        JSONObject queue=create(8,false,3);AtomicInteger handoffs=new AtomicInteger();
        Scheduler.setHandoffForTests((manager,row,parts,sent,delivered)->{
            assertEquals(8,manager.getSubscriptionId());handoffs.incrementAndGet();
        });
        due();assertEquals(8,Store.rows(Store.load(context)).optJSONObject(0).optInt("usedSim"));
        result(queue,Activity.RESULT_CANCELED);
        JSONObject failed=Store.load(context);JSONObject first=Store.rows(failed).optJSONObject(0);
        assertEquals("FAILED",first.optString("status"));assertEquals(1,Store.pending(failed));
        assertEquals(first.optLong("resultAt")+60_000L,failed.optLong("nextAt"));
        Scheduler.tick(context,failed.optString("id"),false);assertEquals(1,handoffs.get());
        due();assertEquals(2,handoffs.get());
        assertEquals("FAILED",Store.rows(Store.load(context)).optJSONObject(0).optString("status"));
        assertEquals("SENDING",Store.rows(Store.load(context)).optJSONObject(1).optString("status"));
    }

    @Test public void previewAndStartConfirmationNameTheSelectedSingleSimAndCadence() {
        create(8,false);
        try(var controller=Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity activity=controller.get();activity.renderApp();activity.preview();
            assertTrue(Shadows.shadowOf(ShadowAlertDialog.getLatestAlertDialog()).getTitle().toString().contains("ซิมเดียว: SIM 2"));
            assertTrue(Shadows.shadowOf(ShadowAlertDialog.getLatestAlertDialog()).getTitle().toString().contains("10–30 นาที"));
            activity.confirmStart();
            assertTrue(Shadows.shadowOf(ShadowAlertDialog.getLatestAlertDialog()).getMessage().toString().contains("ซิมเดียว: SIM 2"));
            assertTrue(Shadows.shadowOf(ShadowAlertDialog.getLatestAlertDialog()).getMessage().toString().contains("รอ 1 นาที"));
        }
    }
}
