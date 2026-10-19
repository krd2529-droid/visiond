package com.smsmix.app;

import android.app.*;
import android.content.*;
import android.widget.*;
import android.view.View;
import android.view.ViewGroup;
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
        Shadows.shadowOf((Application)c).grantPermissions(android.Manifest.permission.READ_PHONE_STATE);
        Shadows.shadowOf(c.getSystemService(android.telephony.SubscriptionManager.class)).setActiveSubscriptionInfos(
                ShadowSubscriptionManager.SubscriptionInfoBuilder.newBuilder().setId(7).setSimSlotIndex(0).setDisplayName("Test").buildSubscriptionInfo());
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
    JSONObject complete(JSONObject queue) {
        JSONArray rows=Store.rows(queue);
        String[] outcomes={"SENT","FAILED","UNKNOWN","SKIPPED"};
        for(int i=0;i<rows.length();i++) Store.put(rows.optJSONObject(i),"status",outcomes[i%outcomes.length]);
        Store.put(queue,"running",false); Store.save(c,queue); return queue;
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
    Button findButton(View view, String text) {
        if(view instanceof Button && text.equals(((Button)view).getText().toString()))return (Button)view;
        if(view instanceof ViewGroup)for(int i=0;i<((ViewGroup)view).getChildCount();i++) {
            Button found=findButton(((ViewGroup)view).getChildAt(i),text); if(found!=null)return found;
        }
        return null;
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
    @Test public void repeatKeepsOriginalSourceAndNeverRedrawsAcrossRounds() {
        JSONObject first=complete(create(true,List.of(),3));
        assertEquals(1,first.optJSONObject("repeatSource").optInt("version"));
        assertEquals(3,first.optJSONObject("repeatSource").optInt("count"));
        List<String> oldCaptions=new ArrayList<>(captions), oldLinks=new ArrayList<>(links);
        captions.clear(); links.clear();
        for(int i=0;i<10;i++){captions.add("changed "+i);links.add("https://changed.test/"+i);}
        JSONObject second=CampaignFactory.repeat(c,first.optString("id"),new Random(3));
        assertFalse(second.optBoolean("running"));
        assertEquals(-1,Store.sending(second)); // No SMS handoff: every row remains PENDING.
        for(int i=0;i<Store.rows(second).length();i++) {
            JSONObject row=Store.rows(second).optJSONObject(i);
            String[] parts=row.optString("body").split("\n",2);
            assertTrue(oldCaptions.contains(parts[0])); assertTrue(oldLinks.contains(parts[1]));
            assertEquals("PENDING",row.optString("status"));
        }
        assertTrue(Collections.disjoint(phones(first),phones(second)));
        complete(second);
        JSONObject third=CampaignFactory.repeat(c,second.optString("id"),new Random(4));
        assertTrue(Collections.disjoint(phones(first),phones(third)));
        assertTrue(Collections.disjoint(phones(second),phones(third)));
        assertEquals(9,CampaignFactory.history(third).size());
        complete(third);
        String before=Store.load(c).toString();
        assertThrows(IllegalArgumentException.class,()->CampaignFactory.repeat(c,third.optString("id"),new Random(5)));
        assertEquals(before,Store.load(c).toString());
    }
    @Test public void repeatRefusesPendingRunningLegacyFileAndCorruptHistory() throws Exception {
        JSONObject range=create(true,List.of(),2);
        String pending=Store.load(c).toString();
        assertThrows(IllegalStateException.class,()->CampaignFactory.repeat(c,range.optString("id"),new Random(1)));
        assertEquals(pending,Store.load(c).toString());
        complete(range); Store.put(range,"running",true); Store.save(c,range);
        assertThrows(IllegalStateException.class,()->CampaignFactory.repeat(c,range.optString("id"),new Random(1)));
        Store.put(range,"running",false);
        Store.put(Store.rows(range).optJSONObject(0),"status","SENDING"); Store.save(c,range);
        assertThrows(IllegalStateException.class,()->CampaignFactory.repeat(c,range.optString("id"),new Random(1)));
        Store.put(Store.rows(range).optJSONObject(0),"status","SENT"); Store.save(c,range);
        String originalDrawn=range.optJSONArray("drawnPhones").toString();
        range.remove("drawnPhones"); Store.save(c,range);
        String missing=Store.load(c).toString();
        assertThrows(IllegalStateException.class,()->CampaignFactory.repeat(c,range.optString("id"),new Random(1)));
        assertEquals(missing,Store.load(c).toString());
        Store.put(range,"drawnPhones",new JSONArray().put(phones(range).get(0))); Store.save(c,range);
        String partial=Store.load(c).toString();
        assertThrows(IllegalStateException.class,()->CampaignFactory.repeat(c,range.optString("id"),new Random(1)));
        assertEquals(partial,Store.load(c).toString());
        Store.put(range,"drawnPhones",new JSONArray().put("+66800000008").put("+66800000009")); Store.save(c,range);
        String wrongRows=Store.load(c).toString();
        assertThrows(IllegalStateException.class,()->CampaignFactory.repeat(c,range.optString("id"),new Random(1)));
        assertEquals(wrongRows,Store.load(c).toString());
        Store.put(range,"drawnPhones",new JSONArray(originalDrawn).put("+66800000008"));
        Store.put(range,"drawnPhonesCount",3); Store.save(c,range);
        String mismatchedDigest=Store.load(c).toString();
        assertThrows(IllegalStateException.class,()->CampaignFactory.repeat(c,range.optString("id"),new Random(1)));
        assertEquals(mismatchedDigest,Store.load(c).toString());
        JSONObject legacy=Store.object(); Store.put(legacy,"id","legacy"); Store.put(legacy,"recipientMode","range");
        Store.put(legacy,"rows",new JSONArray().put(new JSONObject().put("phone","+66800000000").put("status","SENT")));
        Store.save(c,legacy);
        assertThrows(IllegalStateException.class,()->CampaignFactory.repeat(c,"legacy",new Random(1)));
        JSONObject file=create(false,List.of("0800000002","0800000003"),1); complete(file);
        assertThrows(IllegalStateException.class,()->CampaignFactory.repeat(c,file.optString("id"),new Random(1)));
    }
    @Test public void corruptRepeatSourceAndFullyExhaustedRangeFailWithoutHistoryChange() {
        JSONObject first=complete(create(true,List.of(),2));
        JSONObject source=first.optJSONObject("repeatSource");
        Store.put(source,"count",0); Store.save(c,first);
        String corrupt=Store.load(c).toString(); long revision=MessageHistory.revision(c);
        assertThrows(IllegalStateException.class,()->CampaignFactory.repeat(c,first.optString("id"),new Random(1)));
        assertEquals(corrupt,Store.load(c).toString()); assertEquals(revision,MessageHistory.revision(c));
        Store.put(source,"count",3); Store.save(c,first);
        corrupt=Store.load(c).toString();
        assertThrows(IllegalStateException.class,()->CampaignFactory.repeat(c,first.optString("id"),new Random(1)));
        assertEquals(corrupt,Store.load(c).toString());
        Store.put(source,"count",2); Store.put(source,"first","+66800000009");
        Store.put(source,"last","+66800000000"); Store.save(c,first);
        corrupt=Store.load(c).toString();
        assertThrows(IllegalArgumentException.class,()->CampaignFactory.repeat(c,first.optString("id"),new Random(1)));
        assertEquals(corrupt,Store.load(c).toString());
        Store.put(source,"first","+66800000020"); Store.put(source,"last","+66800000029"); Store.save(c,first);
        corrupt=Store.load(c).toString();
        assertThrows(IllegalStateException.class,()->CampaignFactory.repeat(c,first.optString("id"),new Random(1)));
        assertEquals(corrupt,Store.load(c).toString());
        Store.file(c).delete();
        JSONObject tiny=CampaignFactory.create(c,true,List.of(),"0800000000","0800000001",2,
                captions,links,7,"SIM test",new Random(1)); complete(tiny);
        String exhausted=Store.load(c).toString();
        assertThrows(IllegalArgumentException.class,()->CampaignFactory.repeat(c,tiny.optString("id"),new Random(1)));
        assertEquals(exhausted,Store.load(c).toString());
    }
    @Test public void failedRepeatCommitPreservesQueueAndHistory() {
        JSONObject first=complete(create(true,List.of(),2));
        String queue=Store.load(c).toString();
        long revision=MessageHistory.revision(c);
        String successes=SuccessLog.load(c).toString();
        Store.failNextSaveForTests();
        assertThrows(IllegalStateException.class,()->CampaignFactory.repeat(c,first.optString("id"),new Random(1)));
        assertEquals(queue,Store.load(c).toString());
        assertEquals(revision,MessageHistory.revision(c));
        assertEquals(successes,SuccessLog.load(c).toString());
        assertThrows(IllegalStateException.class,()->CampaignFactory.repeat(c,"stale",new Random(1)));
    }
    @Test public void missingOriginalSimBlocksRepeatWithoutChangingQueue() {
        JSONObject first=complete(create(true,List.of(),2));
        String queue=Store.load(c).toString();
        Shadows.shadowOf(c.getSystemService(android.telephony.SubscriptionManager.class)).setActiveSubscriptionInfos();
        assertThrows(IllegalStateException.class,()->CampaignFactory.repeat(c,first.optString("id"),new Random(1)));
        assertEquals(queue,Store.load(c).toString());
    }
    @Test public void alternatingRepeatKeepsBothOriginalSimsOnlyWhileAvailable() {
        Shadows.shadowOf(c.getSystemService(android.telephony.SubscriptionManager.class)).setActiveSubscriptionInfos(
                ShadowSubscriptionManager.SubscriptionInfoBuilder.newBuilder().setId(7).setSimSlotIndex(0).setDisplayName("SIM 1").buildSubscriptionInfo(),
                ShadowSubscriptionManager.SubscriptionInfoBuilder.newBuilder().setId(8).setSimSlotIndex(1).setDisplayName("SIM 2").buildSubscriptionInfo());
        JSONObject first=CampaignFactory.create(c,true,List.of(),"0800000000","0800000009",2,
                captions,links,7,8,"สลับอัตโนมัติ",new Random(1));
        complete(first);
        JSONObject repeated=CampaignFactory.repeat(c,first.optString("id"),new Random(2));
        assertEquals("alternate",repeated.optString("simMode"));
        assertEquals(7,repeated.optInt("sim")); assertEquals(8,repeated.optInt("alternateSim"));
        assertEquals(7,Store.rows(repeated).optJSONObject(0).optInt("sim"));
        assertEquals(8,Store.rows(repeated).optJSONObject(1).optInt("sim"));
        complete(repeated);
        String before=Store.load(c).toString();
        Shadows.shadowOf(c.getSystemService(android.telephony.SubscriptionManager.class)).setActiveSubscriptionInfos(
                ShadowSubscriptionManager.SubscriptionInfoBuilder.newBuilder().setId(7).setSimSlotIndex(0).setDisplayName("SIM 1").buildSubscriptionInfo());
        assertThrows(IllegalStateException.class,()->CampaignFactory.repeat(c,repeated.optString("id"),new Random(3)));
        assertEquals(before,Store.load(c).toString());
    }
    @Test public void repeatButtonAfterRestartUsesSavedSourceAndOnlyOpensPreview() throws Exception {
        JSONObject first=complete(create(true,List.of(),2));
        String originalId=first.optString("id");
        try(var controller=Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity activity=controller.get(); activity.renderApp();
            ((EditText)field(activity,"captions")).setText("draft changed");
            ((EditText)field(activity,"links")).setText("https://draft.changed");
            ((EditText)field(activity,"rangeStart")).setText("0900000000");
            Button repeat=findButton(activity.getWindow().getDecorView(),"ทำงานอีกครั้ง (สุ่มเบอร์ใหม่จากช่วงเดิม)");
            assertNotNull(repeat);
            repeat.performClick();
            ShadowAlertDialog.getLatestAlertDialog().getButton(AlertDialog.BUTTON_NEGATIVE).performClick();
            assertEquals(originalId,Store.load(c).optString("id"));
            repeat.performClick();
            assertTrue(ShadowAlertDialog.getLatestAlertDialog().findViewById(android.R.id.message) instanceof TextView);
            assertTrue(((TextView)ShadowAlertDialog.getLatestAlertDialog().findViewById(android.R.id.message))
                    .getText().toString().contains("ยังไม่ส่ง SMS"));
            ShadowAlertDialog.getLatestAlertDialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick();
            Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();
            JSONObject second=Store.load(c);
            assertNotEquals(originalId,second.optString("id"));
            assertFalse(second.optBoolean("running"));
            assertEquals("range",second.optString("recipientMode"));
            assertTrue(Collections.disjoint(phones(first),phones(second)));
            for(int i=0;i<Store.rows(second).length();i++) {
                JSONObject row=Store.rows(second).optJSONObject(i);
                assertEquals("PENDING",row.optString("status"));
                assertFalse(row.optString("body").contains("draft changed"));
            }
            assertEquals(2,ShadowAlertDialog.getLatestAlertDialog().getListView().getAdapter().getCount());
        }
    }
    @Test public void repeatButtonExplainsIncompleteQueueInsteadOfCrashing() {
        JSONObject first=create(true,List.of(),2);
        try(var controller=Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity activity=controller.get(); activity.renderApp();
            Button repeat=findButton(activity.getWindow().getDecorView(),"ทำงานอีกครั้ง (สุ่มเบอร์ใหม่จากช่วงเดิม)");
            assertNotNull(repeat); repeat.performClick();
            String text=((TextView)ShadowAlertDialog.getLatestAlertDialog().findViewById(android.R.id.message)).getText().toString();
            assertTrue(text.contains("รอให้คิวปัจจุบันจบ"));
            assertEquals(first.toString(),Store.load(c).toString());
        }
    }
}
