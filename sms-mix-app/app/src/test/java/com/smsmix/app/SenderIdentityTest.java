package com.smsmix.app;

import android.Manifest;
import android.app.Activity;
import android.app.Application;
import android.content.Context;
import android.content.Intent;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;
import android.view.View;
import android.widget.EditText;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.Robolectric;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.Shadows;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowSubscriptionManager;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=28)
public class SenderIdentityTest {
    Context context;
    SubscriptionInfo first, second;

    @Before public void setup() {
        context=RuntimeEnvironment.getApplication();
        Store.file(context).delete(); SuccessLog.file(context).delete();
        context.deleteDatabase("message-history.db");
        context.getSharedPreferences("MainActivity",0).edit().clear().commit();
        LicenseClient.setVerifierForTests(c -> true);
        Shadows.shadowOf((Application)context).grantPermissions(Manifest.permission.SEND_SMS,
                Manifest.permission.READ_PHONE_STATE);
        first=info(7,0,""); second=info(8,1,""); active(first,second);
    }
    @After public void teardown() {
        Scheduler.setHandoffForTests(null); LicenseClient.setVerifierForTests(null);
    }
    SubscriptionInfo info(int id,int slot,String number) {
        return ShadowSubscriptionManager.SubscriptionInfoBuilder.newBuilder().setId(id)
                .setSimSlotIndex(slot).setDisplayName("Test SIM").setNumber(number).buildSubscriptionInfo();
    }
    void active(SubscriptionInfo... infos) {
        Shadows.shadowOf(context.getSystemService(SubscriptionManager.class)).setActiveSubscriptionInfos(infos);
    }
    void manual(int id,String number) {
        context.getSharedPreferences("MainActivity",0).edit()
                .putString(SenderIdentity.manualKey(id),number).commit();
    }
    JSONObject queue(boolean alternating,int count) {
        JSONObject campaign=Store.object(); Store.put(campaign,"id","sender-test");
        Store.put(campaign,"running",true); Store.put(campaign,"nextAt",0);
        Store.put(campaign,"sim",7);
        if(alternating) {Store.put(campaign,"alternateSim",8);Store.put(campaign,"simMode","alternate");}
        JSONArray rows=new JSONArray();
        for(int i=0;i<count;i++) {
            JSONObject row=Store.object();Store.put(row,"phone","+6680000000"+i);
            Store.put(row,"body","caption\nhttps://example.com/"+i);Store.put(row,"status","PENDING");
            if(alternating) {Store.put(row,"sim",i%2==0?7:8);Store.put(row,"simLabel",i%2==0?"SIM 1":"SIM 2");}
            rows.put(row);
        }
        Store.put(campaign,"rows",rows);Store.save(context,campaign);return campaign;
    }
    void due() {
        JSONObject current=Store.load(context);Store.put(current,"nextAt",0);Store.save(context,current);
        Scheduler.tick(context,"sender-test",false);
    }
    JSONObject row(int index) {return Store.rows(Store.load(context)).optJSONObject(index);}
    void result(int index) {
        Scheduler.result(context,new Intent().putExtra("id","sender-test").putExtra("row",index).putExtra("part",0),Activity.RESULT_OK);
    }

    @Test public void oneSimHandoffStoresActualSenderAndBothLocalCsvExports() {
        manual(7,"0811111111");queue(false,1);
        Scheduler.setHandoffForTests((sms,row,parts,sent,delivered) -> assertEquals(7,sms.getSubscriptionId()));
        due();JSONObject sent=row(0);
        assertEquals("SENDING",sent.optString("status"));assertEquals(7,sent.optInt("usedSim"));
        assertEquals("SIM 1",sent.optString("usedSimLabel"));
        assertEquals("0811111111",sent.optString("senderPhone"));
        assertEquals("manual",sent.optString("senderPhoneSource"));
        assertTrue(SendStatus.line(sent).contains("0811111111 (ผู้ใช้ระบุ)"));
        MessageHistory.Page history=MessageHistory.page(context,"",0,0);
        assertEquals("0811111111",history.rows.get(0).optString("senderPhone"));
        result(0);SuccessLog.record(context,Store.load(context));
        assertTrue(MainActivity.campaignCsv(Store.rows(Store.load(context))).contains("0811111111"));
        assertTrue(SuccessLog.csv(context).contains("0811111111"));
        Store.save(context,Store.object());
        assertTrue("success archive survives queue replacement",SuccessLog.csv(context).contains("0811111111"));
    }

    @Test public void fallbackUsesSurvivingSubscriptionNumberNotOriginalSlot() {
        manual(7,"0811111111");manual(8,"0822222222");queue(true,3);active(second);
        Scheduler.setHandoffForTests((sms,row,parts,sent,delivered) -> assertEquals(8,sms.getSubscriptionId()));
        Scheduler.tick(context,"sender-test",false);assertEquals("SKIPPED",row(0).optString("status"));
        due();assertEquals(8,row(1).optInt("usedSim"));
        assertEquals("0822222222",row(1).optString("senderPhone"));
        result(1);due();
        assertEquals(7,row(2).optInt("sim"));
        assertEquals(8,row(2).optInt("usedSim"));
        assertEquals("SIM 2",row(2).optString("usedSimLabel"));
        assertEquals("0822222222",row(2).optString("senderPhone"));
    }

    @Test public void simSwapAndMissingNumberStayTruthfullyUnknown() {
        manual(7,"0811111111");active(info(9,0,""));
        JSONObject row=Store.object();SenderIdentity.snapshot(context,row,9);
        assertEquals("SIM 1",row.optString("usedSimLabel"));
        assertEquals("",row.optString("senderPhone"));
        assertTrue(SenderIdentity.display(row).contains("ไม่ทราบเบอร์ผู้ส่ง"));
        assertFalse(SenderIdentity.display(row).contains("0811111111"));
        JSONObject legacy=Store.object();Store.put(legacy,"status","SENT");
        assertTrue(SendStatus.line(legacy).contains("ไม่ทราบซิมผู้ส่ง • เบอร์ผู้ส่ง: ไม่ทราบเบอร์ผู้ส่ง"));
        assertTrue(MainActivity.campaignCsv(new JSONArray().put(legacy)).contains("ไม่ทราบเบอร์ผู้ส่ง"));
        assertFalse(SuccessfulSendOutbox.payload(java.util.List.of(
                new SuccessfulSendOutbox.Entry("old",0,"+66800000000",123L)))
                .toString().contains("senderPhone"));
    }

    @Test public void olderAndroidUsesReportedSubscriptionNumberAheadOfManualFallback() {
        active(info(7,0,"0888888888"),second);manual(7,"0811111111");
        JSONObject row=Store.object();SenderIdentity.snapshot(context,row,7);
        assertEquals("0888888888",row.optString("senderPhone"));
        assertEquals("api",row.optString("senderPhoneSource"));
    }

    @Test public void manualEditorReloadsOnlyForTheCurrentlyActiveSubscription() {
        try(var controller=Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity activity=controller.get(); activity.renderApp();
            View root=activity.getWindow().getDecorView();
            EditText sim1=ClearEditorsTest.editor(root,"เบอร์ผู้ส่งสำรอง SIM 1 (ผู้ใช้ระบุ)");
            EditText sim2=ClearEditorsTest.editor(root,"เบอร์ผู้ส่งสำรอง SIM 2 (ผู้ใช้ระบุ)");
            assertNotNull(sim1);assertNotNull(sim2);
            sim1.setText("0811111111");sim2.setText("0822222222");
            assertEquals("0811111111",activity.getPreferences(0).getString(SenderIdentity.manualKey(7),""));
            assertEquals("0822222222",activity.getPreferences(0).getString(SenderIdentity.manualKey(8),""));
            active(info(9,0,""),info(10,1,""));activity.loadSims();
            assertEquals("",sim1.getText().toString());assertEquals("",sim2.getText().toString());
            sim1.setText("0899999999");
            assertEquals("0899999999",activity.getPreferences(0).getString(SenderIdentity.manualKey(9),""));
            assertEquals("",activity.getPreferences(0).getString(SenderIdentity.manualKey(10),""));
            assertEquals("0811111111",activity.getPreferences(0).getString(SenderIdentity.manualKey(7),""));
            assertEquals("0822222222",activity.getPreferences(0).getString(SenderIdentity.manualKey(8),""));
        }
    }

    @Test @Config(sdk=33) public void optionalPhonePermissionDenialFallsBackAndGrantUsesReportedNumber() {
        manual(7,"0811111111");
        ShadowSubscriptionManager shadow=Shadows.shadowOf(context.getSystemService(SubscriptionManager.class));
        shadow.setPhoneNumber(7,"0899999999");
        JSONObject denied=Store.object();SenderIdentity.snapshot(context,denied,7);
        assertEquals("0811111111",denied.optString("senderPhone"));
        assertEquals("manual",denied.optString("senderPhoneSource"));
        Shadows.shadowOf((Application)context).grantPermissions(Manifest.permission.READ_PHONE_NUMBERS);
        shadow.setReadPhoneNumbersPermission(true);
        JSONObject granted=Store.object();SenderIdentity.snapshot(context,granted,7);
        assertEquals("0899999999",granted.optString("senderPhone"));
        assertEquals("api",granted.optString("senderPhoneSource"));
        shadow.setPhoneNumber(7,"");
        JSONObject blank=Store.object();SenderIdentity.snapshot(context,blank,7);
        assertEquals("0811111111",blank.optString("senderPhone"));
        assertEquals("manual",blank.optString("senderPhoneSource"));
    }
}
