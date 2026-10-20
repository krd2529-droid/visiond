package com.smsmix.app;

import android.content.Context;
import android.graphics.Color;
import android.os.Looper;
import android.widget.TextView;
import org.json.JSONObject;
import org.json.JSONArray;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.Shadows;
import org.robolectric.annotation.Config;
import java.io.FileOutputStream;
import java.lang.reflect.Field;
import java.time.Duration;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=28)
public class QueueStateBadgeTest {
    Context context;

    @Before public void setup() {
        context=RuntimeEnvironment.getApplication();
        Store.file(context).delete();
        LicenseClient.setVerifierForTests(c -> true);
    }
    @After public void teardown() { LicenseClient.setVerifierForTests(null); }

    static TextView view(MainActivity activity, String name) throws Exception {
        Field field=MainActivity.class.getDeclaredField(name);
        field.setAccessible(true);
        return (TextView)field.get(activity);
    }
    static JSONObject queue(boolean running) {
        JSONObject data=Store.object();
        Store.put(data,"id","badge-test");
        Store.put(data,"running",running);
        Store.put(data,"note",running?"รอเวลาส่งถัดไป":"หยุดโดยผู้ใช้");
        Store.put(data,"nextAt",System.currentTimeMillis()+600_000L);
        JSONObject row=Store.object(); Store.put(row,"phone","+66800000000");
        Store.put(row,"status","PENDING");
        Store.put(data,"rows",new JSONArray().put(row));
        return data;
    }

    @Test public void emptyQueueStartsWithRedStoppedBadge() throws Exception {
        try(var controller=Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity activity=controller.get(); activity.renderApp();
            assertEquals("■ หยุด",view(activity,"queueStateBadge").getText().toString());
            assertEquals(Color.rgb(180,35,24),view(activity,"queueStateBadge").getCurrentTextColor());
        }
    }

    @Test public void prominentBadgeFollowsPersistedRunningStateOnLaunchAndTwoSecondRefresh() throws Exception {
        try(var controller=Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity activity=controller.get();
            Store.save(context,queue(true)); // License gate in this harness has no activated key.
            assertTrue(Store.load(context).optBoolean("running"));
            activity.renderApp(); activity.updateStatus();
            assertTrue("render must not pause the campaign: "+Store.load(context),Store.load(context).optBoolean("running"));
            TextView badge=view(activity,"queueStateBadge"), details=view(activity,"status");
            assertTrue(badge.isShown());
            assertEquals("▶ กำลังทำงาน",badge.getText().toString());
            assertEquals("กำลังทำงาน",badge.getContentDescription().toString());
            assertEquals(Color.rgb(11,122,59),badge.getCurrentTextColor());
            assertTrue("state should be prominent",badge.getTextSize()/activity.getResources().getDisplayMetrics().scaledDensity>=22);
            assertTrue(details.getText().toString().contains("รอเวลาส่งถัดไป"));

            JSONObject sending=queue(true);
            Store.put(Store.rows(sending).optJSONObject(0),"status","SENDING");
            Store.put(Store.rows(sending).optJSONObject(0),"deadline",System.currentTimeMillis()+300_000L);
            Store.save(context,sending);
            activity.updateStatus();
            assertEquals("▶ กำลังทำงาน",badge.getText().toString());
            assertTrue(details.getText().toString().contains("รอผลจากระบบ: 1"));

            Store.save(context,queue(false));
            Shadows.shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(2));
            assertEquals("■ หยุด",badge.getText().toString());
            assertEquals("หยุด",badge.getContentDescription().toString());
            assertEquals(Color.rgb(180,35,24),badge.getCurrentTextColor());
            assertTrue(details.getText().toString().contains("หยุดโดยผู้ใช้"));
        }
    }

    @Test public void unreadableQueueShowsRedStoppedStateAndKeepsErrorDetail() throws Exception {
        try(var controller=Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity activity=controller.get(); Store.save(context,queue(true));
            activity.renderApp(); activity.updateStatus();
            try(FileOutputStream out=new FileOutputStream(Store.file(context).getBaseFile())) {
                out.write("{bad".getBytes(java.nio.charset.StandardCharsets.UTF_8));
            }
            activity.updateStatus();
            assertEquals("■ หยุด",view(activity,"queueStateBadge").getText().toString());
            assertEquals(Color.rgb(180,35,24),view(activity,"queueStateBadge").getCurrentTextColor());
            assertTrue(view(activity,"status").getText().toString().startsWith("หยุด:"));
        }
    }

    @Test public void expiredSendingRecoversToUnknownBeforeBadgeIsPainted() throws Exception {
        JSONObject data=queue(true), row=Store.rows(data).optJSONObject(0);
        Store.put(row,"status","SENDING");
        Store.put(row,"deadline",System.currentTimeMillis()-1);
        try(var controller=Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity activity=controller.get(); Store.save(context,data);
            activity.renderApp(); activity.updateStatus();
            assertEquals("UNKNOWN",Store.rows(Store.load(context)).optJSONObject(0).optString("status"));
            assertEquals("■ หยุด",view(activity,"queueStateBadge").getText().toString());
            assertFalse(Store.load(context).optBoolean("running"));
        }
    }
}
