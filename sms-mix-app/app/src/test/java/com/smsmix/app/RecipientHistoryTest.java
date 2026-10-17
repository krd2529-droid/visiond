package com.smsmix.app;

import android.app.*;
import android.content.*;
import android.widget.*;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.*;
import java.util.*;
import java.lang.reflect.Field;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28)
public class RecipientHistoryTest {
    Context c;
    List<String> captions = new ArrayList<>(), links = new ArrayList<>();
    @Before public void setup() {
        c = RuntimeEnvironment.getApplication();
        Store.file(c).delete();
        for (int i=0;i<10;i++) { captions.add("caption " + i); links.add("https://example.com/" + i); }
    }
    JSONObject create(boolean range, List<String> phones, int count) {
        return CampaignFactory.create(c, range, phones, "0800000000", "0800000009", count,
                captions, links, 7, "SIM test", new Random(2));
    }
    List<String> phones(JSONObject d) {
        List<String> out = new ArrayList<>();
        JSONArray rows = Store.rows(d);
        for(int i=0;i<rows.length();i++) out.add(rows.optJSONObject(i).optString("phone"));
        return out;
    }

    @Test public void historySurvivesReloadAndModeSwitchBothDirections() {
        JSONObject first = create(false, List.of("0800000000", "0800000001"), 2);
        assertEquals(2, CampaignFactory.history(Store.load(c)).size());
        JSONObject range = create(true, List.of(), 5);
        assertTrue(Collections.disjoint(phones(first), phones(range)));
        Set<String> all = CampaignFactory.history(Store.load(c));
        assertEquals(7, all.size());
        List<String> full = new ArrayList<>();
        for(int i=0;i<10;i++) full.add("080000000" + i);
        JSONObject third = create(false, full, 3);
        assertTrue(Collections.disjoint(all, phones(third)));
        assertEquals(10, CampaignFactory.history(Store.load(c)).size());
        String saved = Store.load(c).toString();
        assertThrows(IllegalArgumentException.class, () -> create(true, List.of(), 1));
        assertEquals(saved, Store.load(c).toString());
    }

    @Test public void survivingLegacyQueueMigratesIncludingUnsentNumbers() {
        JSONObject old = Store.object(); JSONArray rows = new JSONArray();
        for(String status : List.of("PENDING","SENT","UNKNOWN","FAILED")) {
            JSONObject row = Store.object();
            Store.put(row,"phone","080000000" + rows.length()); Store.put(row,"status",status); rows.put(row);
        }
        Store.put(old,"rows",rows); Store.save(c,old);
        JSONObject next = create(true,List.of(),6);
        assertEquals(10,CampaignFactory.history(Store.load(c)).size());
        for(String phone : phones(next)) assertTrue(Long.parseLong(phone.substring(1))>=66800000004L);
    }

    @Test public void invalidInputsAndActiveQueueLeaveHistoryUntouched() {
        JSONObject previous = create(true,List.of(),2);
        String saved = previous.toString();
        assertThrows(IllegalArgumentException.class, () -> create(true,List.of(),9));
        assertEquals(saved,Store.load(c).toString());
        Store.put(previous,"running",true); Store.save(c,previous);
        saved = Store.load(c).toString();
        assertThrows(IllegalStateException.class, () -> create(true,List.of(),1));
        assertEquals(saved,Store.load(c).toString());
    }

    @Test public void corruptHistoryDoesNotResetOrAllowRedraw() {
        JSONObject previous = create(true,List.of(),2);
        Store.put(previous,"drawnPhones","broken"); Store.save(c,previous);
        String saved=Store.load(c).toString();
        assertThrows(IllegalStateException.class, () -> create(true,List.of(),1));
        assertEquals(saved,Store.load(c).toString());
    }

    Object field(MainActivity a, String name) throws Exception {
        Field f=MainActivity.class.getDeclaredField(name); f.setAccessible(true); return f.get(a);
    }

    @Test public void rangeUiCreatesQueueAndCancelReplacementDoesNotConsumeNumbers() throws Exception {
        Shadows.shadowOf((Application)c).grantPermissions(android.Manifest.permission.READ_PHONE_STATE, android.Manifest.permission.SEND_SMS);
        Shadows.shadowOf(c.getSystemService(android.telephony.SubscriptionManager.class)).setActiveSubscriptionInfos(
                ShadowSubscriptionManager.SubscriptionInfoBuilder.newBuilder().setId(7).setSimSlotIndex(0).setDisplayName("Test").buildSubscriptionInfo());
        try(var controller=Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity a=controller.get(); a.renderApp();
            ((Spinner)field(a,"recipientMode")).setSelection(1);
            ((EditText)field(a,"rangeStart")).setText("0800000000");
            ((EditText)field(a,"rangeEnd")).setText("0800000009");
            ((EditText)field(a,"drawCount")).setText("3");
            ((EditText)field(a,"captions")).setText(String.join("\n",captions));
            ((EditText)field(a,"links")).setText(String.join("\n",links));
            a.prepare();
            JSONObject first=Store.load(c); assertEquals(3,Store.rows(first).length());
            assertEquals("range",first.optString("recipientMode"));
            ShadowAlertDialog.getLatestAlertDialog().dismiss();
            a.prepare();
            ShadowAlertDialog.getLatestAlertDialog().getButton(AlertDialog.BUTTON_NEGATIVE).performClick();
            Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();
            assertEquals(first.toString(),Store.load(c).toString());
            a.prepare();
            ShadowAlertDialog.getLatestAlertDialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick();
            Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();
            JSONObject second=Store.load(c);
            assertEquals(6,CampaignFactory.history(second).size());
            assertTrue(Collections.disjoint(phones(first),phones(second)));
        }
    }
}
