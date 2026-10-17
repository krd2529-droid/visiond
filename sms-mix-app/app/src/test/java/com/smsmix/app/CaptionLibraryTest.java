package com.smsmix.app;

import android.app.*;
import android.content.*;
import android.os.Looper;
import android.view.*;
import android.widget.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowAlertDialog;
import java.io.*;
import java.lang.reflect.Field;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=28)
public class CaptionLibraryTest {
    Context c;
    String text(String prefix) {
        StringBuilder s=new StringBuilder();
        for(int i=0;i<10;i++) { if(i>0)s.append("\n"); s.append(prefix).append(i); }
        return s.toString();
    }
    @Before public void setup() {
        c=RuntimeEnvironment.getApplication(); CaptionLibrary.file(c).delete(); Store.file(c).delete();
    }
    @Test public void namedSetsSurviveReloadAndNormalizeWhitespace() {
        CaptionLibrary.save(c,"  โปรเดือนนี้  ",text("เดือน"),false);
        CaptionLibrary.save(c,"ชุดสอง",text("ใหม่"),false);
        assertEquals(2,CaptionLibrary.load(c).size());
        assertEquals(text("เดือน"),CaptionLibrary.load(c).get("โปรเดือนนี้"));
        assertEquals(text("ใหม่"),CaptionLibrary.load(c).get("ชุดสอง"));
    }
    @Test public void invalidNamesAndCaptionCountsLeaveExistingSetsUntouched() {
        CaptionLibrary.save(c,"เดิม",text("a"),false);
        assertThrows(IllegalArgumentException.class,()->CaptionLibrary.save(c,"  ",text("b"),false));
        assertThrows(IllegalArgumentException.class,()->CaptionLibrary.save(c,"a\nb",text("b"),false));
        assertThrows(IllegalArgumentException.class,()->CaptionLibrary.save(c,"ยาว".repeat(61),text("b"),false));
        assertThrows(IllegalArgumentException.class,()->CaptionLibrary.save(c,"ใหม่","ไม่ครบ",false));
        assertEquals(1,CaptionLibrary.load(c).size());
        assertEquals(text("a"),CaptionLibrary.load(c).get("เดิม"));
    }
    @Test public void duplicateRequiresExplicitOverwrite() {
        CaptionLibrary.save(c,"โปร",text("a"),false);
        assertThrows(IllegalArgumentException.class,()->CaptionLibrary.save(c,"โปร",text("b"),false));
        assertEquals(text("a"),CaptionLibrary.load(c).get("โปร"));
        CaptionLibrary.save(c,"โปร",text("b"),true);
        assertEquals(1,CaptionLibrary.load(c).size());
        assertEquals(text("b"),CaptionLibrary.load(c).get("โปร"));
    }
    @Test public void corruptFileIsNotSilentlyReplaced() throws Exception {
        try(FileOutputStream out=new FileOutputStream(CaptionLibrary.file(c).getBaseFile())) { out.write("{bad".getBytes()); }
        assertThrows(IllegalStateException.class,()->CaptionLibrary.save(c,"ใหม่",text("a"),false));
        assertThrows(IllegalStateException.class,()->CaptionLibrary.load(c));
    }
    EditText editor(MainActivity a,String field) throws Exception {
        Field f=MainActivity.class.getDeclaredField(field); f.setAccessible(true); return (EditText)f.get(a);
    }
    EditText nameInput(View v) {
        if(v instanceof EditText) return (EditText)v;
        if(v instanceof ViewGroup) for(int i=0;i<((ViewGroup)v).getChildCount();i++) {
            EditText found=nameInput(((ViewGroup)v).getChildAt(i)); if(found!=null)return found;
        }
        return null;
    }
    void click(int button) {
        Shadows.shadowOf(Looper.getMainLooper()).idle();
        ShadowAlertDialog.getLatestAlertDialog().getButton(button).performClick();
        Shadows.shadowOf(Looper.getMainLooper()).idle();
    }
    void pickFirst() {
        AlertDialog d=ShadowAlertDialog.getLatestAlertDialog();
        d.getListView().performItemClick(null,0,0);
        Shadows.shadowOf(Looper.getMainLooper()).idle();
    }

    @Test public void uiSaveSelectAndReopenPreservesCaptionsAndLinks() throws Exception {
        try(var controller=Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity a=controller.get(); a.renderApp();
            editor(a,"captions").setText(text("ไทย"));
            editor(a,"links").setText("https://example.com/unchanged");
            a.saveCaptionSet();
            nameInput(ShadowAlertDialog.getLatestAlertDialog().getWindow().getDecorView()).setText("ชุดทดสอบ");
            click(AlertDialog.BUTTON_POSITIVE);
            assertEquals(text("ไทย"),CaptionLibrary.load(c).get("ชุดทดสอบ"));
            ShadowAlertDialog.getLatestAlertDialog().dismiss();
            editor(a,"captions").setText("");
            a.chooseCaptionSet(); pickFirst();
            assertEquals(text("ไทย"),editor(a,"captions").getText().toString());
            assertEquals("https://example.com/unchanged",editor(a,"links").getText().toString());
            assertEquals(0,Store.rows(Store.load(c)).length());
        }
        try(var controller=Robolectric.buildActivity(MainActivity.class).setup()) {
            controller.get().renderApp();
            assertEquals(text("ไทย"),editor(controller.get(),"captions").getText().toString());
            assertEquals(1,CaptionLibrary.load(c).size());
        }
    }

    @Test public void cancelOverwriteAndCancelEditorReplacementPreserveText() throws Exception {
        CaptionLibrary.save(c,"โปร",text("เก่า"),false);
        try(var controller=Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity a=controller.get(); a.renderApp(); editor(a,"captions").setText(text("ใหม่"));
            a.saveCaptionSet();
            AlertDialog save=ShadowAlertDialog.getLatestAlertDialog();
            nameInput(save.getWindow().getDecorView()).setText("โปร");
            click(AlertDialog.BUTTON_POSITIVE);
            assertNotSame(save,ShadowAlertDialog.getLatestAlertDialog());
            click(AlertDialog.BUTTON_NEGATIVE);
            assertEquals(text("เก่า"),CaptionLibrary.load(c).get("โปร"));
            save.dismiss();
            a.chooseCaptionSet(); pickFirst(); click(AlertDialog.BUTTON_NEGATIVE);
            assertEquals(text("ใหม่"),editor(a,"captions").getText().toString());
            a.chooseCaptionSet(); pickFirst(); click(AlertDialog.BUTTON_POSITIVE);
            assertEquals(text("เก่า"),editor(a,"captions").getText().toString());
        }
    }
}
