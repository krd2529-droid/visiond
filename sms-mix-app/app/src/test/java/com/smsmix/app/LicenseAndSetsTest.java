package com.smsmix.app;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.Robolectric;
import org.robolectric.annotation.Config;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.lang.reflect.Field;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28)
public class LicenseAndSetsTest {
    Context context;

    @Before public void setup() {
        context = RuntimeEnvironment.getApplication();
        Store.file(context).delete();
        SavedSets.clearForTests(context);
    }
    @After public void teardown() { LicenseClient.setVerifierForTests(null); }

    JSONObject pendingQueue() {
        JSONObject data = Store.object(), row = Store.object();
        Store.put(data, "id", "license-test");
        Store.put(data, "running", true);
        Store.put(data, "nextAt", System.currentTimeMillis() - 1000);
        Store.put(data, "sim", 1);
        Store.put(row, "phone", "+66800000000");
        Store.put(row, "body", "hello");
        Store.put(row, "status", "PENDING");
        JSONArray rows = new JSONArray(); rows.put(row);
        Store.put(data, "rows", rows);
        Store.save(context, data);
        return data;
    }

    @Test public void offlineOrRevokedPausesPendingWithoutHandoff() {
        LicenseClient.setVerifierForTests(c -> false);
        pendingQueue();
        Scheduler.tick(context, "license-test", false);
        JSONObject after = Store.load(context);
        assertFalse(after.optBoolean("running"));
        assertEquals("PENDING", Store.rows(after).optJSONObject(0).optString("status"));
        assertEquals(-1, Store.sending(after));
    }

    @Test public void returningWithoutKeyHidesEditorAndPausesPendingQueue() throws Exception {
        try (var controller = Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity activity = controller.get();
            activity.renderApp();
            pendingQueue();
            controller.pause().resume();
            Field field = MainActivity.class.getDeclaredField("status");
            field.setAccessible(true);
            assertNull("editor must be hidden until a local or online entitlement is valid", field.get(activity));
            JSONObject after = Store.load(context);
            assertFalse(after.optBoolean("running"));
            assertEquals("PENDING", Store.rows(after).optJSONObject(0).optString("status"));
        }
    }

    @Test public void savedSetsCapUpdateAndQueuePreservation() {
        pendingQueue();
        String queueBefore = Store.load(context).toString();
        for (int i = 0; i < 20; i++) {
            SavedSets.save(context, "captions", "caption-" + i, "caption " + i);
            SavedSets.save(context, "phones", "phones-" + i, "+66800000000");
        }
        assertEquals(20, SavedSets.names(context, "captions").size());
        assertEquals(20, SavedSets.names(context, "phones").size());
        try { SavedSets.save(context, "captions", "caption-20", "extra"); fail("21st caption set accepted"); }
        catch (IllegalStateException expected) { }
        try { SavedSets.save(context, "phones", "phones-20", "+66800000001"); fail("21st phone set accepted"); }
        catch (IllegalStateException expected) { }
        SavedSets.save(context, "captions", "caption-0", "updated");
        SavedSets.save(context, "phones", "phones-0", "+66800000002");
        assertEquals("updated", SavedSets.read(context, "captions", "caption-0"));
        assertEquals("+66800000002", SavedSets.read(context, "phones", "phones-0"));
        assertEquals(queueBefore, Store.load(context).toString());
    }

    @Test public void threeConcurrentChecksShareOneRequest() throws Exception {
        CountDownLatch ready = new CountDownLatch(3), start = new CountDownLatch(1), inside = new CountDownLatch(1), release = new CountDownLatch(1);
        AtomicInteger calls = new AtomicInteger();
        AtomicBoolean[] answers = {new AtomicBoolean(),new AtomicBoolean(),new AtomicBoolean()};
        LicenseClient.setVerifierForTests(c -> {
            calls.incrementAndGet(); inside.countDown();
            try { return release.await(3, TimeUnit.SECONDS); }
            catch (InterruptedException error) { Thread.currentThread().interrupt(); return false; }
        });
        Thread[] workers = new Thread[3];
        for (int i = 0; i < 3; i++) {
            final int index = i;
            workers[i] = new Thread(() -> {
                ready.countDown();
                try { start.await(); } catch (InterruptedException error) { Thread.currentThread().interrupt(); return; }
                answers[index].set(LicenseClient.checkCurrent(context));
            });
            workers[i].start();
        }
        assertTrue(ready.await(3, TimeUnit.SECONDS)); start.countDown();
        assertTrue(inside.await(3, TimeUnit.SECONDS));
        Thread.sleep(100);
        release.countDown();
        for (Thread worker : workers) { worker.join(3000); assertFalse(worker.isAlive()); }
        assertEquals(1, calls.get());
        for (AtomicBoolean answer : answers) assertTrue(answer.get());
    }

    @Test public void dueHandoffDoesNotUseOldForegroundFlight() throws Exception {
        CountDownLatch foregroundStarted = new CountDownLatch(1), releaseForeground = new CountDownLatch(1);
        AtomicInteger calls = new AtomicInteger();
        AtomicBoolean foregroundAnswer = new AtomicBoolean();
        LicenseClient.setVerifierForTests(c -> {
            int call = calls.incrementAndGet();
            if (call == 1) {
                foregroundStarted.countDown();
                try { releaseForeground.await(3, TimeUnit.SECONDS); }
                catch (InterruptedException error) { Thread.currentThread().interrupt(); return false; }
                return true;
            }
            return false;
        });
        Thread foreground = new Thread(() -> foregroundAnswer.set(LicenseClient.checkCurrent(context)));
        foreground.start(); assertTrue(foregroundStarted.await(3, TimeUnit.SECONDS));
        Thread.sleep(300);
        assertFalse(LicenseClient.checkCurrent(context, true));
        releaseForeground.countDown(); foreground.join(3000);
        assertTrue(foregroundAnswer.get());
        assertEquals(2, calls.get());
    }

    @Test public void staleCheckCannotOverwriteNewlyActivatedKey() throws Exception {
        LicenseClient.setVerifierForTests(null);
        android.provider.Settings.Secure.putString(context.getContentResolver(),android.provider.Settings.Secure.ANDROID_ID,"race-android-id");
        android.content.SharedPreferences state=context.getSharedPreferences("smsmix_license",Context.MODE_PRIVATE);
        state.edit().clear().putString("key","VD7-OLD-KEY-ONLY").commit();
        java.lang.reflect.Method method=LicenseClient.class.getDeclaredMethod("deviceId",Context.class);
        method.setAccessible(true);
        String device=(String)method.invoke(null,context);
        long now=System.currentTimeMillis();
        JSONObject oldReply=new JSONObject().put("ok",true).put("activated_at","2026-01-01 00:00:00")
                .put("expires_at","2099-01-01 00:00:00").put("server_time",now);
        JSONObject newReply=new JSONObject().put("ok",true).put("activated_at","2026-01-01 00:00:00")
                .put("expires_at","2099-12-01 00:00:00").put("server_time",now);
        CountDownLatch ready=new CountDownLatch(1), release=new CountDownLatch(1);
        AtomicBoolean staleAccepted=new AtomicBoolean(true);
        Thread oldCheck=new Thread(()->{
            ready.countDown();
            try { release.await(3,TimeUnit.SECONDS); }
            catch (InterruptedException error) { Thread.currentThread().interrupt(); return; }
            staleAccepted.set(LicenseClient.storeCheckedEntitlement(context,"VD7-OLD-KEY-ONLY",device,oldReply));
        });
        try {
            oldCheck.start(); assertTrue(ready.await(3,TimeUnit.SECONDS));
            assertTrue(state.edit().putString("key","VD7-NEW-KEY-ONLY").commit());
            assertTrue(LicenseClient.storeCheckedEntitlement(context,"VD7-NEW-KEY-ONLY",device,newReply));
            release.countDown(); oldCheck.join(3000);
            assertFalse(oldCheck.isAlive()); assertFalse(staleAccepted.get());
            assertEquals("VD7-NEW-KEY-ONLY",state.getString("key",""));
            assertEquals("2099-12-01 00:00:00",state.getString("entitlement_expiry",""));
        } finally { release.countDown(); state.edit().clear().commit(); }
    }

    @Test public void lateFailedForegroundCheckDoesNotPauseNewEntitlementQueue() throws Exception {
        pendingQueue();
        android.content.SharedPreferences state=context.getSharedPreferences("smsmix_license",Context.MODE_PRIVATE);
        state.edit().clear().putString("key","VD7-OLD-KEY-ONLY").commit();
        CountDownLatch checking=new CountDownLatch(1),release=new CountDownLatch(1);
        AtomicInteger calls=new AtomicInteger();
        LicenseClient.setVerifierForTests(c->{
            if(calls.incrementAndGet()==1)return false;
            checking.countDown();
            while(true){
                try { return release.await(3,TimeUnit.SECONDS) && false; }
                catch(InterruptedException ignored) { /* A canceled HTTP request may still finish late. */ }
            }
        });
        try(var controller=Robolectric.buildActivity(MainActivity.class).setup()){
            assertTrue(checking.await(3,TimeUnit.SECONDS));
            state.edit().putString("key","VD7-NEW-KEY-ONLY").commit();
            LicenseClient.setVerifierForTests(c->true);
            release.countDown();
            for(int i=0;i<100;i++){
                org.robolectric.Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();
                if(controller.get().findViewById(android.R.id.content)!=null && calls.get()>=2)Thread.sleep(10);
            }
            Field statusField=MainActivity.class.getDeclaredField("status");statusField.setAccessible(true);
            assertNotNull("late callback must render the valid new entitlement",statusField.get(controller.get()));
            assertTrue("new valid entitlement must keep the queue running",Store.load(context).optBoolean("running"));
        } finally { release.countDown(); state.edit().clear().commit(); }
    }
}
