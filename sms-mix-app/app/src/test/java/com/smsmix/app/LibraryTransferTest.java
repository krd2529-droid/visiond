package com.smsmix.app;

import android.content.Context;
import android.content.ContextWrapper;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import org.json.JSONObject;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.Robolectric;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.Shadows;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowAlertDialog;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Base64;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.BooleanSupplier;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk=28)
public class LibraryTransferTest {
    Context first, second;
    String captions(String prefix) {
        StringBuilder out=new StringBuilder();
        for(int i=0;i<10;i++) {if(i>0)out.append('\n');out.append(prefix).append(i);}
        return out.toString();
    }
    String lines(String prefix, int count) {
        StringBuilder out=new StringBuilder();
        for(int i=0;i<count;i++) {if(i>0)out.append('\n');out.append(prefix).append(i);}
        return out.toString();
    }
    Context device(Context base, String name) {
        String identity="transfer-test-"+name+"-"+System.nanoTime();
        File dir=new File(base.getCacheDir(),identity);
        assertTrue(dir.mkdirs());
        return new ContextWrapper(base) {
            @Override public File getFilesDir() {return dir;}
            @Override public android.content.SharedPreferences getSharedPreferences(String file, int mode) {
                return base.getSharedPreferences(identity+"-"+file,mode);
            }
        };
    }
    JSONObject links(String value) {return LinkLibrary.manual("",value+"\n"+value+"/2");}
    LibraryTransfer.Snapshot parse(byte[] bytes) throws Exception {
        return LibraryTransfer.parse(new ByteArrayInputStream(bytes));
    }
    Button button(View view, String title) {
        if(view instanceof Button && title.equals(((Button)view).getText().toString()))return (Button)view;
        if(view instanceof ViewGroup)for(int i=0;i<((ViewGroup)view).getChildCount();i++) {
            Button found=button(((ViewGroup)view).getChildAt(i),title); if(found!=null)return found;
        }
        return null;
    }
    EditText editor(View view, String hint) {
        if(view instanceof EditText && hint.equals(((EditText)view).getHint().toString()))return (EditText)view;
        if(view instanceof ViewGroup)for(int i=0;i<((ViewGroup)view).getChildCount();i++) {
            EditText found=editor(((ViewGroup)view).getChildAt(i),hint); if(found!=null)return found;
        }
        return null;
    }
    String dialogMessage(android.app.AlertDialog dialog) {
        TextView message=dialog==null?null:dialog.findViewById(android.R.id.message);
        return message==null?"":message.getText().toString();
    }
    void awaitUi(BooleanSupplier condition) throws Exception {
        for(int i=0;i<100;i++) {
            Shadows.shadowOf(Looper.getMainLooper()).idle();
            if(condition.getAsBoolean())return;
            Thread.sleep(20);
        }
        fail("Timed out waiting for file-picker result");
    }
    @Before public void setup() {
        Context base=RuntimeEnvironment.getApplication();
        first=device(base,"one"); second=device(base,"two");
    }
    @Test public void multipleSetsRoundTripToSeparateOfflineDeviceWithoutOtherData() throws Exception {
        CaptionLibrary.save(first,"โปรหนึ่ง",captions("a"),false);
        CaptionLibrary.save(first,"โปรสอง",captions("b"),false);
        LinkLibrary.save(first,"ลิงก์หนึ่ง",links("https://example.com/a"),false);
        LinkLibrary.save(first,"ลิงก์สอง",links("https://example.com/b"),false);
        JSONObject campaign=Store.object(); Store.put(campaign,"phone","+66812345678"); Store.save(first,campaign);
        first.getSharedPreferences("smsmix_license",0).edit().putString("key","PRIVATE-LICENSE-KEY").commit();
        first.getSharedPreferences("MainActivity",0).edit().putString("phones","+66812345678").commit();
        JSONObject destinationQueue=Store.object(); Store.put(destinationQueue,"marker","DESTINATION-QUEUE");
        Store.save(second,destinationQueue);
        second.getSharedPreferences("MainActivity",0).edit().putString("captions","DESTINATION-DRAFT")
                .putString("phones","+66987654321").commit();
        byte[] bytes=LibraryTransfer.export(first);
        String file=new String(bytes,StandardCharsets.UTF_8);
        assertFalse(file.contains("+66812345678"));
        assertFalse(file.contains("PRIVATE-LICENSE-KEY"));
        assertEquals(2,parse(bytes).captions.size());
        LibraryTransfer.apply(second,parse(bytes),LibraryTransfer.REJECT_CONFLICTS);
        assertEquals(CaptionLibrary.load(first),CaptionLibrary.load(second));
        assertEquals(LinkLibrary.shortText(LinkLibrary.load(first).get("ลิงก์หนึ่ง")),
                LinkLibrary.shortText(LinkLibrary.load(second).get("ลิงก์หนึ่ง")));
        assertEquals(2,LinkLibrary.load(second).size());
        assertEquals("DESTINATION-QUEUE",Store.load(second).getString("marker"));
        assertEquals("DESTINATION-DRAFT",second.getSharedPreferences("MainActivity",0).getString("captions",null));
        assertEquals("+66987654321",second.getSharedPreferences("MainActivity",0).getString("phones",null));
        assertEquals("+66812345678",Store.load(first).getString("phone"));
    }
    @Test public void conflictsRequireExplicitDecisionAndPreserveUnrelatedSets() throws Exception {
        CaptionLibrary.save(first,"ซ้ำ",captions("new"),false);
        CaptionLibrary.save(first,"เพิ่ม",captions("add"),false);
        LinkLibrary.save(first,"ลิงก์ซ้ำ",links("https://new.test"),false);
        CaptionLibrary.save(second,"ซ้ำ",captions("old"),false);
        CaptionLibrary.save(second,"เดิม",captions("keep"),false);
        LinkLibrary.save(second,"ลิงก์ซ้ำ",links("https://old.test"),false);
        LibraryTransfer.Snapshot incoming=parse(LibraryTransfer.export(first));
        assertEquals(2,LibraryTransfer.preview(second,incoming).conflicts);
        assertThrows(IllegalArgumentException.class,()->LibraryTransfer.apply(second,incoming,LibraryTransfer.REJECT_CONFLICTS));
        assertEquals(2,CaptionLibrary.load(second).size());
        LibraryTransfer.apply(second,incoming,LibraryTransfer.SKIP_CONFLICTS);
        assertEquals(captions("old"),CaptionLibrary.load(second).get("ซ้ำ"));
        assertEquals(captions("add"),CaptionLibrary.load(second).get("เพิ่ม"));
        assertEquals("https://old.test",LinkLibrary.load(second).get("ลิงก์ซ้ำ").getJSONArray("short_urls").getString(0));
        LibraryTransfer.apply(second,incoming,LibraryTransfer.OVERWRITE_CONFLICTS);
        assertEquals(captions("new"),CaptionLibrary.load(second).get("ซ้ำ"));
        assertEquals(captions("keep"),CaptionLibrary.load(second).get("เดิม"));
    }
    @Test public void malformedOversizeAndDuplicateNamesNeverMutate() throws Exception {
        CaptionLibrary.save(second,"เดิม",captions("keep"),false);
        byte[] valid=LibraryTransfer.export(first);
        assertThrows(Exception.class,()->parse("{broken".getBytes(StandardCharsets.UTF_8)));
        assertThrows(Exception.class,()->parse(new byte[]{(byte)0xc3,(byte)0x28}));
        assertThrows(Exception.class,()->parse(new byte[LibraryTransfer.MAX_BYTES+1]));
        String wrong=new String(valid,StandardCharsets.UTF_8).replace("\"version\":1","\"version\":2");
        assertThrows(Exception.class,()->parse(wrong.getBytes(StandardCharsets.UTF_8)));
        String fractional=new String(valid,StandardCharsets.UTF_8).replace("\"version\":1","\"version\":1.9");
        assertThrows(Exception.class,()->parse(fractional.getBytes(StandardCharsets.UTF_8)));
        String duplicate="{\"format\":\"vsms-saved-sets\",\"version\":1,\"captions\":["
                +"{\"name\":\"ซ้ำ\",\"text\":"+JSONObject.quote(captions("x"))+"},"
                +"{\"name\":\"ซ้ำ\",\"text\":"+JSONObject.quote(captions("y"))+"}],\"links\":[]}";
        assertThrows(Exception.class,()->parse(duplicate.getBytes(StandardCharsets.UTF_8)));
        String forged="{\"format\":\"vsms-saved-sets\",\"version\":1,\"captions\":[],\"links\":["
                +"{\"name\":\"bad\",\"entry\":{\"source\":\"manual\",\"original_url\":\"\","
                +"\"short_urls\":[\"one\\ntwo\"],\"requested_count\":1,\"saved_at\":1}}]}";
        assertThrows(Exception.class,()->parse(forged.getBytes(StandardCharsets.UTF_8)));
        assertEquals(captions("keep"),CaptionLibrary.load(second).get("เดิม"));
    }
    @Test public void secondFileFailureAndInterruptedImportRecoverBothLibraries() throws Exception {
        CaptionLibrary.save(first,"ใหม่",captions("new"),false);
        LinkLibrary.save(first,"ใหม่",links("https://new.test"),false);
        CaptionLibrary.save(second,"เดิม",captions("old"),false);
        LinkLibrary.save(second,"เดิม",links("https://old.test"),false);
        LibraryTransfer.Snapshot incoming=parse(LibraryTransfer.export(first));
        assertThrows(IllegalStateException.class,()->LibraryTransfer.apply(second,incoming,
                LibraryTransfer.REJECT_CONFLICTS,()->{throw new IllegalStateException("simulated second write failure");}));
        assertFalse(LibraryTransfer.journal(second).getBaseFile().exists());
        assertEquals(1,CaptionLibrary.load(second).size());
        assertEquals(1,LinkLibrary.load(second).size());
        assertEquals(captions("old"),CaptionLibrary.load(second).get("เดิม"));
    }
    @Test public void startupRecoversJournalLeftAfterFirstFileWrite() throws Exception {
        CaptionLibrary.save(first,"เดิม",captions("old"),false);
        LinkLibrary.save(first,"เดิม",links("https://old.test"),false);
        byte[] oldCaptions=Files.readAllBytes(CaptionLibrary.file(first).getBaseFile().toPath());
        byte[] oldLinks=Files.readAllBytes(LinkLibrary.file(first).getBaseFile().toPath());
        JSONObject journal=new JSONObject().put("captions",Base64.getEncoder().encodeToString(oldCaptions))
                .put("links",Base64.getEncoder().encodeToString(oldLinks));
        try(FileOutputStream out=new FileOutputStream(LibraryTransfer.journal(first).getBaseFile())) {
            out.write(journal.toString().getBytes(StandardCharsets.UTF_8));
        }
        CaptionLibrary.save(first,"ครึ่งทาง",captions("partial"),false);
        LibraryTransfer.recover(first); // Same recovery path MainActivity runs before its first picker.
        assertEquals(1,CaptionLibrary.load(first).size());
        assertFalse(CaptionLibrary.load(first).containsKey("ครึ่งทาง"));
        assertEquals(1,LinkLibrary.load(first).size());
        assertFalse(LibraryTransfer.journal(first).getBaseFile().exists());
    }
    @Test public void residualJournalAfterCleanupNeverReportsImportSuccess() throws Exception {
        CaptionLibrary.save(first,"ใหม่",captions("new"),false);
        CaptionLibrary.save(second,"เดิม",captions("old"),false);
        LibraryTransfer.Snapshot incoming=parse(LibraryTransfer.export(first));
        AtomicReference<byte[]> oldJournal=new AtomicReference<>();
        assertThrows(IOException.class,()->LibraryTransfer.apply(second,incoming,
                LibraryTransfer.REJECT_CONFLICTS,
                ()->{
                    try {oldJournal.set(Files.readAllBytes(LibraryTransfer.journal(second).getBaseFile().toPath()));}
                    catch(IOException e) {throw new IllegalStateException(e);}
                },
                ()->{
                    try {Files.write(LibraryTransfer.journal(second).getBaseFile().toPath(),oldJournal.get());}
                    catch(IOException e) {throw new IllegalStateException(e);}
                }));
        assertFalse(LibraryTransfer.journalPending(second));
        assertEquals(1,CaptionLibrary.load(second).size());
        assertEquals(captions("old"),CaptionLibrary.load(second).get("เดิม"));
    }
    @Test public void ordinarySaveWaitsForImportTransactionAndIsNotLost() throws Exception {
        CaptionLibrary.save(first,"นำเข้า",captions("import"),false);
        LibraryTransfer.Snapshot incoming=parse(LibraryTransfer.export(first));
        CountDownLatch firstWritten=new CountDownLatch(1), release=new CountDownLatch(1), saved=new CountDownLatch(1);
        AtomicReference<Throwable> error=new AtomicReference<>();
        Thread importThread=new Thread(() -> {
            try {LibraryTransfer.apply(second,incoming,LibraryTransfer.REJECT_CONFLICTS,()->{
                firstWritten.countDown();
                try {if(!release.await(5,TimeUnit.SECONDS))throw new IllegalStateException("timeout");}
                catch(InterruptedException e) {throw new IllegalStateException(e);}
            });} catch(Throwable e) {error.set(e);}
        });
        importThread.start(); assertTrue(firstWritten.await(5,TimeUnit.SECONDS));
        Thread saveThread=new Thread(() -> {
            try {CaptionLibrary.save(second,"ผู้ใช้",captions("user"),false);}
            catch(Throwable e) {error.set(e);} finally {saved.countDown();}
        });
        saveThread.start();
        assertFalse("ordinary save must not interleave with import",saved.await(100,TimeUnit.MILLISECONDS));
        release.countDown(); importThread.join(5000); saveThread.join(5000);
        assertFalse(importThread.isAlive()); assertFalse(saveThread.isAlive());
        assertNull(error.get());
        assertEquals(captions("import"),CaptionLibrary.load(second).get("นำเข้า"));
        assertEquals(captions("user"),CaptionLibrary.load(second).get("ผู้ใช้"));
    }
    @Test public void validLongManualLinksAndOriginalsRemainPortable() throws Exception {
        String longValue="x".repeat(5000);
        LinkLibrary.save(first,"ยาว",LinkLibrary.manual(longValue,longValue),false);
        LinkLibrary.save(first,"แท็บ",LinkLibrary.manual("","https://example.com/a\tb"),false);
        LibraryTransfer.apply(second,parse(LibraryTransfer.export(first)),LibraryTransfer.REJECT_CONFLICTS);
        assertEquals(longValue,LinkLibrary.load(second).get("ยาว").getString("original_url"));
        assertEquals("https://example.com/a\tb",LinkLibrary.shortText(LinkLibrary.load(second).get("แท็บ")));
    }
    @Test public void exportsEveryExistingNamedSetBeyondTwoHundred() throws Exception {
        for(int i=0;i<201;i++) CaptionLibrary.save(first,"ชุด"+i,captions("small"),false);
        LibraryTransfer.Snapshot imported=parse(LibraryTransfer.export(first));
        assertEquals(201,imported.captions.size());
        LibraryTransfer.apply(second,imported,LibraryTransfer.REJECT_CONFLICTS);
        assertEquals(201,CaptionLibrary.load(second).size());
    }
    @Test public void localFilePickerActionsAndCancellationLeaveLibrariesUntouched() {
        try(var controller=Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity activity=controller.get(); activity.renderApp();
            Button export=button(activity.getWindow().getDecorView(),"ส่งออกชุดแคปชั่นและลิงก์เป็นไฟล์");
            Button imp=button(activity.getWindow().getDecorView(),"นำเข้าชุดแคปชั่นและลิงก์จากไฟล์");
            assertNotNull(export); assertNotNull(imp);
            export.performClick();
            Intent exportIntent=Shadows.shadowOf(activity).getNextStartedActivityForResult().intent;
            assertEquals(Intent.ACTION_CREATE_DOCUMENT,exportIntent.getAction());
            assertEquals("application/json",exportIntent.getType());
            activity.onActivityResult(47,Activity.RESULT_CANCELED,null);
            imp.performClick();
            Intent importIntent=Shadows.shadowOf(activity).getNextStartedActivityForResult().intent;
            assertEquals(Intent.ACTION_OPEN_DOCUMENT,importIntent.getAction());
            assertEquals("application/json",importIntent.getType());
            activity.onActivityResult(48,Activity.RESULT_CANCELED,null);
            assertTrue(CaptionLibrary.load(activity).isEmpty());
            assertTrue(LinkLibrary.load(activity).isEmpty());
        }
    }
    @Test public void pickerResultExportsAndImportsSetsWithoutNetwork() throws Exception {
        try(var controller=Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity activity=controller.get(); activity.renderApp();
            CaptionLibrary.save(activity,"พกพา",captions("portable"),false);
            File portable=new File(activity.getCacheDir(),"portable-"+System.nanoTime()+".json");
            Uri uri=Uri.fromFile(portable);
            activity.onActivityResult(47,Activity.RESULT_OK,new Intent().setData(uri));
            awaitUi(()->portable.exists()&&portable.length()>0);
            assertTrue(new String(Files.readAllBytes(portable.toPath()),StandardCharsets.UTF_8).contains("พกพา"));
            CaptionLibrary.file(activity).delete();
            activity.onActivityResult(48,Activity.RESULT_OK,new Intent().setData(uri));
            awaitUi(()->{
                android.app.AlertDialog dialog=ShadowAlertDialog.getLatestAlertDialog();
                return dialog!=null && dialog.getListView()!=null && dialog.getListView().getAdapter()!=null
                        && dialog.getListView().getAdapter().getCount()==2;
            });
            ShadowAlertDialog.getLatestAlertDialog().getListView().performItemClick(null,0,0);
            awaitUi(()->CaptionLibrary.load(activity).containsKey("พกพา"));
            assertEquals(captions("portable"),CaptionLibrary.load(activity).get("พกพา"));
        }
    }
    @Test public void pickerImportShowsEveryLineOnFreshPhoneAndPreservesPopulatedDraftAndQueue() throws Exception {
        String captionLines=lines("ข้อความ ",50), linkLines=lines("https://example.com/l/",51);
        CaptionLibrary.save(first,"แคปชั่นย้ายเครื่อง",captionLines,false);
        LinkLibrary.save(first,"ลิงก์ย้ายเครื่อง",LinkLibrary.manual("",linkLines),false);
        byte[] exported=LibraryTransfer.export(first);
        File portable=new File(RuntimeEnvironment.getApplication().getCacheDir(),"sets-"+System.nanoTime()+".json");
        Files.write(portable.toPath(),exported);
        try(var controller=Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity activity=controller.get(); activity.renderApp();
            EditText captionEditor=editor(activity.getWindow().getDecorView(),"แคปชั่น 10–100 รายการ บรรทัดละรายการ");
            EditText linkEditor=editor(activity.getWindow().getDecorView(),"วางลิงก์ย่อ บรรทัดละลิงก์");
            assertNotNull(captionEditor); assertNotNull(linkEditor);
            captionEditor.setText(""); linkEditor.setText("");
            activity.onActivityResult(48,Activity.RESULT_OK,new Intent().setData(Uri.fromFile(portable)));
            awaitUi(()->{
                android.app.AlertDialog dialog=ShadowAlertDialog.getLatestAlertDialog();
                return dialog!=null && dialog.getListView()!=null
                        && dialogMessage(dialog).contains("50 ข้อความ")
                        && dialogMessage(dialog).contains("51 ลิงก์");
            });
            ShadowAlertDialog.getLatestAlertDialog().getListView().performItemClick(null,0,0);
            awaitUi(()->captionLines.contentEquals(captionEditor.getText()) && linkLines.contentEquals(linkEditor.getText()));
            assertEquals(50,captionEditor.getText().toString().split("\\n").length);
            assertEquals(51,linkEditor.getText().toString().split("\\n").length);
            assertTrue(dialogMessage(ShadowAlertDialog.getLatestAlertDialog()).contains("51 ลิงก์"));
            assertEquals(captionLines,activity.getPreferences(0).getString("captions",null));
            assertEquals(linkLines,activity.getPreferences(0).getString("links",null));

            captionEditor.setText("ร่างข้อความเดิม"); linkEditor.setText("https://old.example");
            JSONObject queue=Store.object(); Store.put(queue,"marker","KEEP-QUEUE"); Store.save(activity,queue);
            activity.onActivityResult(48,Activity.RESULT_OK,new Intent().setData(Uri.fromFile(portable)));
            awaitUi(()->{
                android.app.AlertDialog dialog=ShadowAlertDialog.getLatestAlertDialog();
                return dialog!=null && dialog.getListView()!=null
                        && dialogMessage(dialog).contains("ชื่อซ้ำ 2 ชุด");
            });
            ShadowAlertDialog.getLatestAlertDialog().getListView().performItemClick(null,0,0);
            awaitUi(()->dialogMessage(ShadowAlertDialog.getLatestAlertDialog()).contains("นำเข้าสำเร็จ"));
            assertEquals("ร่างข้อความเดิม",captionEditor.getText().toString());
            assertEquals("https://old.example",linkEditor.getText().toString());
            assertEquals("KEEP-QUEUE",Store.load(activity).getString("marker"));
        }
    }
    @Test public void pickerImportKeepsMultipleSetsSelectableWithoutChoosingOneForDrafts() throws Exception {
        CaptionLibrary.save(first,"ชุด A",captions("A"),false);
        CaptionLibrary.save(first,"ชุด B",captions("B"),false);
        LinkLibrary.save(first,"ลิงก์ A",links("https://a.test"),false);
        LinkLibrary.save(first,"ลิงก์ B",links("https://b.test"),false);
        File portable=new File(RuntimeEnvironment.getApplication().getCacheDir(),"multi-"+System.nanoTime()+".json");
        Files.write(portable.toPath(),LibraryTransfer.export(first));
        try(var controller=Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity activity=controller.get(); activity.renderApp();
            EditText captionEditor=editor(activity.getWindow().getDecorView(),"แคปชั่น 10–100 รายการ บรรทัดละรายการ");
            EditText linkEditor=editor(activity.getWindow().getDecorView(),"วางลิงก์ย่อ บรรทัดละลิงก์");
            captionEditor.setText(""); linkEditor.setText("");
            activity.onActivityResult(48,Activity.RESULT_OK,new Intent().setData(Uri.fromFile(portable)));
            awaitUi(()->dialogMessage(ShadowAlertDialog.getLatestAlertDialog()).contains("แคปชั่น 2 ชุด"));
            ShadowAlertDialog.getLatestAlertDialog().getListView().performItemClick(null,0,0);
            awaitUi(()->CaptionLibrary.load(activity).size()==2 && LinkLibrary.load(activity).size()==2);
            assertEquals("",captionEditor.getText().toString());
            assertEquals("",linkEditor.getText().toString());
            button(activity.getWindow().getDecorView(),"เลือกชุดแคปชั่นที่บันทึกไว้").performClick();
            assertEquals(2,ShadowAlertDialog.getLatestAlertDialog().getListView().getAdapter().getCount());
            button(activity.getWindow().getDecorView(),"เลือกชุดลิงก์ที่บันทึกไว้").performClick();
            assertEquals(2,ShadowAlertDialog.getLatestAlertDialog().getListView().getAdapter().getCount());
        }
    }
    @Test public void importFinishingDuringApplyRestoresEmptyDraftsOnNextLaunch() throws Exception {
        String captionLines=lines("caption ",50), linkLines=lines("https://example.com/",51);
        CaptionLibrary.save(first,"single",captionLines,false);
        LinkLibrary.save(first,"single",LinkLibrary.manual("",linkLines),false);
        File portable=new File(RuntimeEnvironment.getApplication().getCacheDir(),"reopen-"+System.nanoTime()+".json");
        Files.write(portable.toPath(),LibraryTransfer.export(first));
        var controller=Robolectric.buildActivity(MainActivity.class).setup();
        MainActivity activity=controller.get(); activity.renderApp();
        editor(activity.getWindow().getDecorView(),"แคปชั่น 10–100 รายการ บรรทัดละรายการ").setText("");
        editor(activity.getWindow().getDecorView(),"วางลิงก์ย่อ บรรทัดละลิงก์").setText("");
        activity.onActivityResult(48,Activity.RESULT_OK,new Intent().setData(Uri.fromFile(portable)));
        awaitUi(()->dialogMessage(ShadowAlertDialog.getLatestAlertDialog()).contains("50 ข้อความ"));
        ShadowAlertDialog.getLatestAlertDialog().getListView().performItemClick(null,0,0);
        controller.pause().stop().destroy();
        awaitUi(()->captionLines.equals(activity.getPreferences(0).getString("captions",null))
                && linkLines.equals(activity.getPreferences(0).getString("links",null)));
        try(var next=Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity reopened=next.get(); reopened.renderApp();
            assertEquals(captionLines,editor(reopened.getWindow().getDecorView(),
                    "แคปชั่น 10–100 รายการ บรรทัดละรายการ").getText().toString());
            assertEquals(linkLines,editor(reopened.getWindow().getDecorView(),
                    "วางลิงก์ย่อ บรรทัดละลิงก์").getText().toString());
        }
    }
    @Test public void combinedFileImportExposesBothActualPickersAfterDocumentReturn() throws Exception {
        byte[] bytes;
        String fixture=System.getenv("VSMS_IMPORT_FIXTURE");
        if(fixture==null || fixture.isEmpty()) {
            CaptionLibrary.save(first,"caption set",lines("caption ",50),false);
            LinkLibrary.save(first,"link set",LinkLibrary.manual("",lines("https://example.com/",51)),false);
            bytes=LibraryTransfer.export(first);
        } else bytes=Files.readAllBytes(new File(fixture).toPath());
        LibraryTransfer.Snapshot expected=parse(bytes);
        assertEquals(1,expected.captions.size()); assertEquals(1,expected.links.size());
        File portable=new File(RuntimeEnvironment.getApplication().getCacheDir(),"combined-"+System.nanoTime()+".json");
        Files.write(portable.toPath(),bytes);
        LicenseClient.setVerifierForTests(context->true);
        try(var controller=Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity activity=controller.get(); activity.renderApp();
            Button importButton=button(activity.getWindow().getDecorView(),"นำเข้าชุดแคปชั่นและลิงก์จากไฟล์");
            assertNotNull(importButton); importButton.performClick();
            assertEquals(Intent.ACTION_OPEN_DOCUMENT,
                    Shadows.shadowOf(activity).getNextStartedActivityForResult().intent.getAction());
            controller.pause();
            activity.onActivityResult(48,Activity.RESULT_OK,new Intent().setData(Uri.fromFile(portable)));
            controller.resume();
            awaitUi(()->dialogMessage(ShadowAlertDialog.getLatestAlertDialog()).contains("50 ข้อความ")
                    && dialogMessage(ShadowAlertDialog.getLatestAlertDialog()).contains("51 ลิงก์"));
            ShadowAlertDialog.getLatestAlertDialog().getListView().performItemClick(null,0,0);
            awaitUi(()->CaptionLibrary.load(activity).size()==1 && LinkLibrary.load(activity).size()==1);
            assertEquals(expected.captions,CaptionLibrary.load(activity));
            assertEquals(LinkLibrary.shortText(expected.links.get(expected.links.firstKey())),
                    LinkLibrary.shortText(LinkLibrary.load(activity).get(expected.links.firstKey())));
            Button captionPicker=button(activity.getWindow().getDecorView(),"เลือกชุดแคปชั่นที่บันทึกไว้");
            Button linkPicker=button(activity.getWindow().getDecorView(),"เลือกชุดลิงก์ที่บันทึกไว้");
            assertNotNull(captionPicker); assertNotNull(linkPicker);
            captionPicker.performClick();
            assertEquals(1,ShadowAlertDialog.getLatestAlertDialog().getListView().getAdapter().getCount());
            assertEquals(expected.captions.firstKey(),ShadowAlertDialog.getLatestAlertDialog().getListView().getAdapter().getItem(0));
            ShadowAlertDialog.getLatestAlertDialog().getListView().performItemClick(null,0,0);
            linkPicker.performClick();
            assertEquals(1,ShadowAlertDialog.getLatestAlertDialog().getListView().getAdapter().getCount());
            assertEquals(expected.links.firstKey(),ShadowAlertDialog.getLatestAlertDialog().getListView().getAdapter().getItem(0));
        } finally { LicenseClient.setVerifierForTests(null); }
    }
}
