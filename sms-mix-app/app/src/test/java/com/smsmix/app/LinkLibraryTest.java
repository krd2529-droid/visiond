package com.smsmix.app;
import android.app.*;
import android.content.*;
import android.os.Looper;
import android.view.*;
import android.widget.*;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowAlertDialog;
import java.io.*;
import java.lang.reflect.Field;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk=28)
public class LinkLibraryTest {
    Context c;
    @Before public void setup() {
        c=RuntimeEnvironment.getApplication(); LinkLibrary.file(c).delete(); Store.file(c).delete();
        c.getSharedPreferences("shortlinks",0).edit().clear().commit();
    }
    JSONObject job(int n) {
        JSONObject request=ShortLinkClientTest.request(n), job=Store.object(); JSONArray results=new JSONArray();
        for(int i=0;i<n;i++)results.put(ShortLinkClientTest.item(request,i).optString("short_url"));
        Store.put(job,"request",request); Store.put(job,"results",results); Store.put(job,"status","complete"); return job;
    }
    void seed(JSONObject job) {c.getSharedPreferences("shortlinks",0).edit().putString("job",job.toString()).commit();}
    void idle() {Shadows.shadowOf(Looper.getMainLooper()).idle();}
    void click(int which) {idle();ShadowAlertDialog.getLatestAlertDialog().getButton(which).performClick();idle();}
    EditText input(View v) {
        if(v instanceof EditText)return (EditText)v;
        if(v instanceof ViewGroup)for(int i=0;i<((ViewGroup)v).getChildCount();i++){
            EditText found=input(((ViewGroup)v).getChildAt(i));if(found!=null)return found;
        }
        return null;
    }
    EditText editor(MainActivity a,String name) throws Exception {
        Field f=MainActivity.class.getDeclaredField(name);f.setAccessible(true);return (EditText)f.get(a);
    }
    @Test public void savesOriginalAndEveryShortLinkAcrossReload() {
        JSONObject bundle=LinkLibrary.bundle(job(100));
        LinkLibrary.save(c,"  โปร  ",bundle,false);
        JSONObject loaded=LinkLibrary.load(c).get("โปร");
        assertEquals(bundle.toString(),loaded.toString());
        assertEquals("https://example.com/a?x=1&y=2",loaded.optString("original_url"));
        assertEquals(100,loaded.optJSONArray("short_urls").length());
        assertEquals(100,LinkLibrary.shortText(loaded).split("\n").length);
    }
    @Test public void partialSetRetainsRequestedAndActualCounts() throws Exception {
        JSONObject job=job(10); job.getJSONArray("results").remove(9);
        JSONObject bundle=LinkLibrary.bundle(job);
        assertEquals(10,bundle.optInt("requested_count")); assertEquals(9,bundle.optJSONArray("short_urls").length());
        LinkLibrary.save(c,"บางส่วน",bundle,false);
        assertEquals(9,LinkLibrary.load(c).get("บางส่วน").optJSONArray("short_urls").length());
    }
    @Test public void overwriteNeedsConfirmationAndCorruptStorageFailsClosed() throws Exception {
        JSONObject first=LinkLibrary.bundle(job(2)), second=LinkLibrary.bundle(job(3));
        LinkLibrary.save(c,"ชุด",first,false);
        assertThrows(IllegalArgumentException.class,()->LinkLibrary.save(c,"ชุด",second,false));
        assertEquals(first.toString(),LinkLibrary.load(c).get("ชุด").toString());
        LinkLibrary.save(c,"ชุด",second,true);
        assertEquals(second.toString(),LinkLibrary.load(c).get("ชุด").toString());
        try(FileOutputStream out=new FileOutputStream(LinkLibrary.file(c).getBaseFile())) {out.write("{bad".getBytes());}
        assertThrows(IllegalStateException.class,()->LinkLibrary.save(c,"ใหม่",first,false));
    }
    @Test public void rejectsEmptyOrForgedResults() {
        JSONObject job=job(1); Store.put(job,"results",new JSONArray());
        assertThrows(IllegalArgumentException.class,()->LinkLibrary.bundle(job));
        Store.put(job,"results",new JSONArray().put("https://g.shrinkrl.com/not-requested"));
        assertThrows(IllegalArgumentException.class,()->LinkLibrary.bundle(job));
    }
    @Test public void uiSavesAndChoosesCompleteBundleWithoutAlteringCaptionOrQueue() throws Exception {
        JSONObject job=job(10);
        try(var controller=Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity a=controller.get(); a.renderApp(); editor(a,"captions").setText("caption stays");
            LinkSetDialogs.save(a,job);
            input(ShadowAlertDialog.getLatestAlertDialog().getWindow().getDecorView()).setText("ชุดทดลอง");
            click(AlertDialog.BUTTON_POSITIVE);
            assertEquals(10,LinkLibrary.load(c).get("ชุดทดลอง").optJSONArray("short_urls").length());
            ShadowAlertDialog.getLatestAlertDialog().dismiss();
            editor(a,"links").setText("");
            LinkSetDialogs.choose(a,a::applyLinkText);
            ShadowAlertDialog.getLatestAlertDialog().getListView().performItemClick(null,0,0);idle();
            assertTrue(((TextView)ShadowAlertDialog.getLatestAlertDialog().findViewById(android.R.id.message)).getText().toString().contains("https://example.com/a?x=1&y=2"));
            click(AlertDialog.BUTTON_POSITIVE);
            assertEquals(LinkLibrary.shortText(LinkLibrary.bundle(job)),editor(a,"links").getText().toString());
            assertEquals("caption stays",editor(a,"captions").getText().toString());
            assertEquals(0,Store.rows(Store.load(c)).length());
        }
    }
    @Test public void resultImportCanBeCancelledAndDoesNotNeedDataUri() throws Exception {
        try(var controller=Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity a=controller.get(); a.renderApp(); editor(a,"links").setText("https://example.com/existing");
            String text=LinkLibrary.shortText(LinkLibrary.bundle(job(10)));
            a.onActivityResult(44,Activity.RESULT_OK,new Intent().putExtra("shortLinks",text));
            click(AlertDialog.BUTTON_NEGATIVE);
            assertEquals("https://example.com/existing",editor(a,"links").getText().toString());
            a.onActivityResult(44,Activity.RESULT_OK,new Intent().putExtra("shortLinks",text));
            click(AlertDialog.BUTTON_POSITIVE);
            assertEquals(text,editor(a,"links").getText().toString());
        }
    }
    @Test public void shortenerScreenReopensLatestResultsAndReturnsThem() {
        JSONObject job=job(2);seed(job);
        try(var controller=Robolectric.buildActivity(ShortLinksActivity.class).setup()) {
            ShortLinksActivity a=controller.get();a.refresh();a.apply();
            assertEquals(Activity.RESULT_OK,Shadows.shadowOf(a).getResultCode());
            assertEquals(LinkLibrary.shortText(LinkLibrary.bundle(job)),Shadows.shadowOf(a).getResultIntent().getStringExtra("shortLinks"));
        }
        assertEquals(job.toString(),ShortLinkJobs.snapshot(c).toString());
    }
}
