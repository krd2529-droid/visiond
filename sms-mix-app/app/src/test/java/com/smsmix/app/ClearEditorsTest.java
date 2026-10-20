package com.smsmix.app;

import android.app.AlertDialog;
import android.content.Context;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.Shadows;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowAlertDialog;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=28)
public class ClearEditorsTest {
    Context context;

    @Before public void setup() {
        context=RuntimeEnvironment.getApplication();
        Store.file(context).delete();
        CaptionLibrary.file(context).delete();
        LinkLibrary.file(context).delete();
        context.getSharedPreferences("MainActivity",0).edit().clear().commit();
    }

    static Button button(View view, String title) {
        if(view instanceof Button && title.equals(((Button)view).getText().toString())) return (Button)view;
        if(view instanceof ViewGroup) for(int i=0;i<((ViewGroup)view).getChildCount();i++) {
            Button found=button(((ViewGroup)view).getChildAt(i),title); if(found!=null)return found;
        }
        return null;
    }
    static EditText editor(View view, String hint) {
        if(view instanceof EditText && hint.equals(((EditText)view).getHint().toString()))return (EditText)view;
        if(view instanceof ViewGroup) for(int i=0;i<((ViewGroup)view).getChildCount();i++) {
            EditText found=editor(((ViewGroup)view).getChildAt(i),hint); if(found!=null)return found;
        }
        return null;
    }
    static AlertDialog dialog(String title) {
        AlertDialog value=ShadowAlertDialog.getLatestAlertDialog();
        assertNotNull("missing confirmation for "+title,value);
        assertEquals("ล้าง",value.getButton(AlertDialog.BUTTON_POSITIVE).getText().toString());
        assertTrue(((TextView)value.findViewById(android.R.id.message)).getText().toString().contains(title));
        assertTrue(value.isShowing());
        return value;
    }
    static void choose(AlertDialog dialog, int which) {
        dialog.getButton(which).performClick();
        Shadows.shadowOf(Looper.getMainLooper()).idle();
    }
    static String savedCaptions() {
        StringBuilder text=new StringBuilder();
        for(int i=0;i<10;i++) {if(i>0)text.append('\n');text.append("saved ").append(i);}
        return text.toString();
    }

    @Test public void separateConfirmedClearsPersistWithoutTouchingOtherDraftSetsOrQueue() throws Exception {
        try(var controller=Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity activity=controller.get(); activity.renderApp();
            View root=activity.getWindow().getDecorView();
            Button clearCaptions=button(root,"ล้างช่องข้อความ"), clearLinks=button(root,"ล้างช่องลิงก์");
            assertNotNull("caption clear control in Step 2",clearCaptions);
            assertNotNull("link clear control in Step 2",clearLinks);
            assertTrue(clearCaptions.isShown()); assertTrue(clearLinks.isShown());
            EditText captions=editor(root,"แคปชั่น 10–100 รายการ บรรทัดละรายการ");
            EditText links=editor(root,"วางลิงก์ย่อ บรรทัดละลิงก์");
            EditText original=editor(root,"ลิงก์ต้นฉบับ (ไม่บังคับ)");
            assertNotNull(captions); assertNotNull(links); assertNotNull(original);
            captions.setText("draft caption"); links.setText("https://draft.example/1");
            original.setText("https://original.example"); activity.saveDraft();
            CaptionLibrary.save(activity,"kept caption",savedCaptions(),false);
            LinkLibrary.save(activity,"kept links",LinkLibrary.manual("","https://saved.example/1"),false);
            JSONObject queue=Store.object(), row=Store.object();
            Store.put(queue,"id","keep-queue"); Store.put(queue,"running",false);
            Store.put(row,"phone","+66800000000"); Store.put(row,"body","queued body");
            Store.put(row,"status","PENDING"); Store.put(queue,"rows",new JSONArray().put(row));
            Store.save(activity,queue); String queueBefore=Store.load(activity).toString();

            clearCaptions.performClick(); choose(dialog("ล้างช่องข้อความ"),AlertDialog.BUTTON_NEGATIVE);
            assertEquals("draft caption",captions.getText().toString());
            assertEquals("draft caption",activity.getPreferences(0).getString("captions",null));
            clearCaptions.performClick(); choose(dialog("ล้างช่องข้อความ"),AlertDialog.BUTTON_POSITIVE);
            assertEquals("",captions.getText().toString());
            assertEquals("https://draft.example/1",links.getText().toString());
            assertEquals("https://original.example",original.getText().toString());
            assertEquals("",activity.getPreferences(0).getString("captions",null));
            assertEquals("https://draft.example/1",activity.getPreferences(0).getString("links",null));

            captions.setText("new caption draft"); activity.saveDraft();
            clearLinks.performClick(); choose(dialog("ล้างช่องลิงก์"),AlertDialog.BUTTON_NEGATIVE);
            assertEquals("https://draft.example/1",links.getText().toString());
            clearLinks.performClick(); choose(dialog("ล้างช่องลิงก์"),AlertDialog.BUTTON_POSITIVE);
            assertEquals("",links.getText().toString());
            assertEquals("new caption draft",captions.getText().toString());
            assertEquals("https://original.example",original.getText().toString());
            assertEquals("",activity.getPreferences(0).getString("links",null));
            assertEquals("new caption draft",activity.getPreferences(0).getString("captions",null));
            AlertDialog last=ShadowAlertDialog.getLatestAlertDialog();
            clearLinks.performClick(); assertSame("empty field is a no-op",last,ShadowAlertDialog.getLatestAlertDialog());
            assertEquals(savedCaptions(),CaptionLibrary.load(activity).get("kept caption"));
            assertEquals("https://saved.example/1",LinkLibrary.shortText(LinkLibrary.load(activity).get("kept links")));
            assertEquals(queueBefore,Store.load(activity).toString());
            controller.pause().stop().destroy();
        }
        try(var reopened=Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity activity=reopened.get(); activity.renderApp();
            View root=activity.getWindow().getDecorView();
            assertEquals("new caption draft",editor(root,"แคปชั่น 10–100 รายการ บรรทัดละรายการ").getText().toString());
            assertEquals("",editor(root,"วางลิงก์ย่อ บรรทัดละลิงก์").getText().toString());
            assertEquals("https://original.example",editor(root,"ลิงก์ต้นฉบับ (ไม่บังคับ)").getText().toString());
            assertEquals("queued body",Store.rows(Store.load(activity)).optJSONObject(0).optString("body"));
        }
    }

    @Test public void clearedCaptionRemainsEmptyAfterActivityRecreate() {
        try(var controller=Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity activity=controller.get(); activity.renderApp();
            View root=activity.getWindow().getDecorView();
            EditText captions=editor(root,"แคปชั่น 10–100 รายการ บรรทัดละรายการ");
            EditText links=editor(root,"วางลิงก์ย่อ บรรทัดละลิงก์");
            captions.setText("draft caption"); links.setText("https://draft.example/1"); activity.saveDraft();
            button(root,"ล้างช่องข้อความ").performClick();
            choose(dialog("ล้างช่องข้อความ"),AlertDialog.BUTTON_POSITIVE);
            assertEquals("",activity.getPreferences(0).getString("captions",null));
            controller.pause().stop().destroy();
        }
        try(var reopened=Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity activity=reopened.get(); activity.renderApp();
            View root=activity.getWindow().getDecorView();
            assertEquals("",editor(root,"แคปชั่น 10–100 รายการ บรรทัดละรายการ").getText().toString());
            assertEquals("https://draft.example/1",editor(root,"วางลิงก์ย่อ บรรทัดละลิงก์").getText().toString());
        }
    }
}
