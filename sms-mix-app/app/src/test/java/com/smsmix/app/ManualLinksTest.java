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
import java.lang.reflect.Field;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk=28)
public class ManualLinksTest {
    Context c;
    @Before public void setup(){c=RuntimeEnvironment.getApplication();LinkLibrary.file(c).delete();Store.file(c).delete();}
    @Test public void roundTripOriginalAndExternalLinksWithoutNetwork(){
        JSONObject b=LinkLibrary.manual(" https://example.com/offer ","https://short.example/one\nhttps://another.example/two\nhttps://short.example/one\n");
        LinkLibrary.save(c,"จากเว็บ",b,false);
        JSONObject read=LinkLibrary.load(c).get("จากเว็บ");
        assertEquals("https://example.com/offer",read.optString("original_url"));
        assertEquals("manual",read.optString("source"));
        assertEquals("https://short.example/one\nhttps://another.example/two",LinkLibrary.shortText(read));
    }
    @Test public void validatesOriginalLinksAndCount(){
        assertEquals("",LinkLibrary.manual("","https://short.example/one").optString("original_url"));
        assertThrows(IllegalArgumentException.class,()->LinkLibrary.manual("https://example.com",""));
        assertEquals("short.example/path",LinkLibrary.shortText(LinkLibrary.manual("","short.example/path")));
        StringBuilder many=new StringBuilder();
        for(int i=0;i<100;i++)many.append("https://short.example/").append(i).append('\n');
        assertEquals(100,LinkLibrary.manual("https://example.com",many.toString()).optJSONArray("short_urls").length());
        many.append("https://short.example/100");
        assertThrows(IllegalArgumentException.class,()->LinkLibrary.manual("https://example.com",many.toString()));
    }
    EditText editor(MainActivity a,String name)throws Exception{
        Field f=MainActivity.class.getDeclaredField(name);f.setAccessible(true);return(EditText)f.get(a);
    }
    EditText input(View v){
        if(v instanceof EditText)return(EditText)v;
        if(v instanceof ViewGroup)for(int i=0;i<((ViewGroup)v).getChildCount();i++){EditText r=input(((ViewGroup)v).getChildAt(i));if(r!=null)return r;}
        return null;
    }
    @Test public void sectionTwoSaveAndReopenKeepsBothFields()throws Exception{
        try(var controller=Robolectric.buildActivity(MainActivity.class).setup()){
            MainActivity a=controller.get(); a.renderApp();
            editor(a,"manualOriginal").setText("https://example.com/source");
            editor(a,"links").setText("https://short.example/a\nhttps://short.example/b");
            a.saveManualLinks();
            input(ShadowAlertDialog.getLatestAlertDialog().getWindow().getDecorView()).setText("ชุดวางเอง");
            Shadows.shadowOf(Looper.getMainLooper()).idle();
            ShadowAlertDialog.getLatestAlertDialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick();
            Shadows.shadowOf(Looper.getMainLooper()).idle();
            assertEquals(2,LinkLibrary.load(c).get("ชุดวางเอง").optJSONArray("short_urls").length());
            assertEquals(0,Store.rows(Store.load(c)).length());
        }
        try(var controller=Robolectric.buildActivity(MainActivity.class).setup()){
            MainActivity a=controller.get(); a.renderApp();
            assertEquals("https://example.com/source",editor(a,"manualOriginal").getText().toString());
            assertEquals("https://short.example/a\nhttps://short.example/b",editor(a,"links").getText().toString());
            editor(a,"links").setText("");
            editor(a,"manualOriginal").setText("https://old.example");
            a.applyLinkBundle(LinkLibrary.load(c).get("ชุดวางเอง"));
            assertEquals("https://example.com/source",editor(a,"manualOriginal").getText().toString());
        }
    }
}
