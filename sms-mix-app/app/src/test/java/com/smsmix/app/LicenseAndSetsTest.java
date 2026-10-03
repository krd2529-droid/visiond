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
import org.robolectric.annotation.Config;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
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
}
