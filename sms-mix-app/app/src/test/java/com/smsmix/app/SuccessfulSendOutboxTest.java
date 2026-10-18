package com.smsmix.app;

import android.content.Context;
import android.content.Intent;
import android.app.Activity;
import android.provider.Settings;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import java.util.*;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=28)
public class SuccessfulSendOutboxTest {
    private Context c;
    private final String campaignId="123e4567-e89b-42d3-a456-426614174000";
    @Before public void setup() {
        c=RuntimeEnvironment.getApplication();
        c.deleteDatabase("successful-send-outbox.db");
        c.getSharedPreferences("smsmix_license",Context.MODE_PRIVATE).edit().clear().commit();
        Settings.Secure.putString(c.getContentResolver(),Settings.Secure.ANDROID_ID,"test-android-id");
        c.getSharedPreferences("smsmix_license",Context.MODE_PRIVATE).edit().putString("key","VD7-TEST-KEY-ONE").commit();
    }
    private JSONObject campaign(String status,String identity) {
        JSONObject row=Store.object();Store.put(row,"phone","0800000001");
        Store.put(row,"status",status);Store.put(row,"resultAt",1700000000000L);
        Store.put(row,"reportIdentity",identity);
        JSONArray rows=new JSONArray();rows.put(row);
        JSONObject campaign=Store.object();Store.put(campaign,"id",campaignId);Store.put(campaign,"rows",rows);
        return campaign;
    }
    @Test public void onlyTerminalSuccessIsDurableAndAcknowledgedAfterSuccess() {
        String identity=LicenseClient.reportIdentity(c);
        SuccessfulSendOutbox.record(c,campaign("FAILED",identity),0);
        SuccessfulSendOutbox.record(c,campaign("SENDING",identity),0);
        assertTrue(SuccessfulSendOutbox.next(c).isEmpty());
        JSONObject success=campaign("SENT",identity);
        SuccessfulSendOutbox.record(c,success,0);
        SuccessfulSendOutbox.record(c,success,0);
        assertEquals(1,SuccessfulSendOutbox.next(c).size());
        assertEquals(1,SuccessfulSendOutbox.payload(SuccessfulSendOutbox.next(c)).optJSONArray("items").length());
        // Network failure does not acknowledge anything; retry returns the same row.
        assertEquals(1,SuccessfulSendOutbox.next(c).size());
        SuccessfulSendOutbox.acknowledge(c,SuccessfulSendOutbox.next(c));
        assertTrue(SuccessfulSendOutbox.next(c).isEmpty());
        SuccessfulSendOutbox.reconcile(c,success);
        assertTrue("settled success must not be reuploaded after app reopen",SuccessfulSendOutbox.next(c).isEmpty());
    }
    @Test public void oldKeyRowsWaitForTheOriginalIdentity() {
        String original=LicenseClient.reportIdentity(c);
        SuccessfulSendOutbox.record(c,campaign("SENT",original),0);
        c.getSharedPreferences("smsmix_license",Context.MODE_PRIVATE).edit().putString("key","VD7-TEST-KEY-TWO").commit();
        assertTrue(SuccessfulSendOutbox.next(c).isEmpty());
        c.getSharedPreferences("smsmix_license",Context.MODE_PRIVATE).edit().putString("key","VD7-TEST-KEY-ONE").commit();
        assertEquals(1,SuccessfulSendOutbox.next(c).size());
    }
    @Test public void legacySuccessWithoutHandoffIdentityIsNotImported() {
        SuccessfulSendOutbox.reconcile(c,campaign("SENT",""));
        assertTrue(SuccessfulSendOutbox.next(c).isEmpty());
    }
    @Test public void callbackQueuesOnlyCompletedMultipartSuccess() {
        JSONObject sending=campaign("SENDING",LicenseClient.reportIdentity(c));
        JSONObject row=Store.rows(sending).optJSONObject(0);
        JSONArray parts=new JSONArray();parts.put(0);parts.put(0);
        Store.put(row,"parts",parts);Store.put(row,"sentAt",1700000000000L);
        Store.put(row,"deadline",System.currentTimeMillis()+300000);
        Store.put(sending,"running",false);Store.save(c,sending);
        Intent part0=new Intent().putExtra("id",campaignId).putExtra("row",0).putExtra("part",0);
        Intent part1=new Intent().putExtra("id",campaignId).putExtra("row",0).putExtra("part",1);
        Scheduler.result(c,part0,Activity.RESULT_OK);
        assertTrue(SuccessfulSendOutbox.next(c).isEmpty());
        Scheduler.result(c,part1,Activity.RESULT_OK);
        assertEquals(1,SuccessfulSendOutbox.next(c).size());
        Scheduler.result(c,part1,Activity.RESULT_OK);
        assertEquals(1,SuccessfulSendOutbox.next(c).size());
    }
    @Test public void archiveWriteFailureStillKeepsConfirmedSuccess() {
        JSONObject sending=campaign("SENDING",LicenseClient.reportIdentity(c));
        JSONObject row=Store.rows(sending).optJSONObject(0);
        JSONArray parts=new JSONArray();parts.put(0);Store.put(row,"parts",parts);
        Store.put(row,"deadline",System.currentTimeMillis()+300000);
        Store.put(sending,"running",false);Store.save(c,sending);
        MessageHistory.failNextRecordRowForTests();
        Intent result=new Intent().putExtra("id",campaignId).putExtra("row",0).putExtra("part",0);
        assertThrows(IllegalStateException.class,()->Scheduler.result(c,result,Activity.RESULT_OK));
        assertEquals("SENT",Store.rows(Store.load(c)).optJSONObject(0).optString("status"));
        assertEquals(1,SuccessfulSendOutbox.next(c).size());
    }
}
