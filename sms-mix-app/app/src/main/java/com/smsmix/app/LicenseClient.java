package com.smsmix.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import org.json.JSONObject;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.*;

final class LicenseClient {
    private static final String BASE = "https://visiondonline.com/api/vision7/sms-mix/";
    private static final String PREFS = "smsmix_license";
    private static final Object FLIGHT_LOCK = new Object();
    private static Future<Boolean> checkFlight;
    private static String checkIdentity;
    private static long checkStartedNanos;
    private static final ExecutorService CHECKS = new ThreadPoolExecutor(0, 2, 30, TimeUnit.SECONDS,
            new SynchronousQueue<>(), task -> {
                Thread thread = new Thread(task, "smsmix-license-network");
                thread.setDaemon(true);
                return thread;
            }, new ThreadPoolExecutor.AbortPolicy());
    interface Verifier { boolean verify(Context context); }
    private static volatile Verifier testVerifier;
    static void setVerifierForTests(Verifier verifier) {
        synchronized (FLIGHT_LOCK) {
            if (checkFlight != null) checkFlight.cancel(true);
            checkFlight = null; checkIdentity = null;
            testVerifier = verifier;
        }
    }

    private static SharedPreferences prefs(Context context) { return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }
    private static String deviceId(Context context) {
        SharedPreferences preferences = prefs(context);
        String id = preferences.getString("device_id", "");
        if (!id.isEmpty()) return id;
        id = UUID.randomUUID().toString();
        if (!preferences.edit().putString("device_id", id).commit()) throw new IllegalStateException("บันทึกรหัสเครื่องไม่ได้");
        return id;
    }
    static boolean hasKey(Context context) { return !prefs(context).getString("key", "").isEmpty(); }
    static boolean checkCurrent(Context context) { return checkCurrent(context, false); }
    static boolean checkCurrent(Context context, boolean handoff) {
        Verifier verifier = testVerifier;
        String key = verifier == null ? prefs(context).getString("key", "") : "";
        if (verifier == null && key.isEmpty()) return false;
        String device;
        try { device = verifier == null ? deviceId(context) : "test-device"; }
        catch (RuntimeException error) { return false; }
        String identity = key + "\u0000" + device;
        Future<Boolean> pending;
        boolean owner;
        long started;
        synchronized (FLIGHT_LOCK) {
            long age = System.nanoTime() - checkStartedNanos;
            if (checkFlight != null && !checkFlight.isDone() && identity.equals(checkIdentity)
                    && (!handoff || age <= TimeUnit.MILLISECONDS.toNanos(200))) {
                pending = checkFlight; owner = false;
            }
            else {
                try { pending = CHECKS.submit(() -> {
                    if (verifier != null) return verifier.verify(context);
                    try { return request("check", key, device, appVersion(context)); }
                    catch (IOException | RuntimeException error) { return false; }
                }); } catch (RejectedExecutionException error) { return false; }
                checkFlight = pending; checkIdentity = identity; checkStartedNanos = System.nanoTime();
                owner = true;
            }
            started = checkStartedNanos;
        }
        try {
            long remaining = TimeUnit.SECONDS.toNanos(5) - (System.nanoTime() - started);
            if (remaining <= 0) return false;
            return pending.get(remaining, TimeUnit.NANOSECONDS);
        }
        catch (InterruptedException error) { Thread.currentThread().interrupt(); return false; }
        catch (ExecutionException | TimeoutException | CancellationException error) { return false; }
        finally {
            if (owner && System.nanoTime() - started >= TimeUnit.SECONDS.toNanos(5) && !pending.isDone()) pending.cancel(true);
            synchronized (FLIGHT_LOCK) {
                if (checkFlight == pending && pending.isDone()) { checkFlight = null; checkIdentity = null; }
            }
        }
    }
    static void requireCurrent(Context context) {
        if (!checkCurrent(context)) throw new IllegalStateException("ยืนยันสิทธิ์ออนไลน์ไม่ได้ คิวถูกหยุด กรุณาตรวจอินเทอร์เน็ตและคีย์");
    }
    static boolean activate(Context context, String key) {
        String candidate = String.valueOf(key).trim();
        if (candidate.length() < 12 || candidate.length() > 200) return false;
        Future<Boolean> pending;
        try {
            String device = deviceId(context), version = appVersion(context);
            pending = CHECKS.submit(() -> request("activate", candidate, device, version, deviceName()));
        } catch (IOException | RuntimeException error) { return false; }
        try {
            if (!pending.get(5, TimeUnit.SECONDS)) return false;
            synchronized (FLIGHT_LOCK) {
                if (checkFlight != null) checkFlight.cancel(true);
                checkFlight = null; checkIdentity = null;
                return prefs(context).edit().putString("key", candidate).commit();
            }
        } catch (InterruptedException error) { Thread.currentThread().interrupt(); return false; }
        catch (ExecutionException | TimeoutException | CancellationException error) { return false; }
        finally { pending.cancel(true); }
    }
    private static String appVersion(Context context) throws IOException {
        try { return context.getPackageManager().getPackageInfo(context.getPackageName(), 0).versionName; }
        catch (PackageManager.NameNotFoundException error) { throw new IOException("อ่านเวอร์ชันแอปไม่ได้", error); }
    }
    private static String deviceName() {
        String name = (Build.MANUFACTURER + " " + Build.MODEL).replaceAll("[\\p{Cntrl}<>]", " ").trim();
        return name.isEmpty() ? "Android" : name.substring(0, Math.min(name.length(), 80));
    }
    private static boolean request(String path, String key, String deviceId, String version) throws IOException {
        return request(path, key, deviceId, version, null);
    }
    private static boolean request(String path, String key, String deviceId, String version, String deviceName) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) new URL(BASE + path).openConnection();
        connection.setRequestMethod("POST");
        connection.setConnectTimeout(2000);
        connection.setReadTimeout(2000);
        connection.setInstanceFollowRedirects(false);
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        connection.setRequestProperty("Cache-Control", "no-store");
        JSONObject body = new JSONObject();
        try { body.put("key", key); body.put("device_id", deviceId); body.put("app_version", version);
            if (deviceName != null) body.put("device_name", deviceName); }
        catch (Exception error) { throw new IOException("คำขอสิทธิ์ไม่ถูกต้อง", error); }
        try {
            byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
            connection.setFixedLengthStreamingMode(bytes.length);
            try (OutputStream out = connection.getOutputStream()) { out.write(bytes); }
            if (connection.getResponseCode() != 200) return false;
            try (InputStream in = connection.getInputStream()) {
                byte[] response = new byte[4096];
                int used = 0, n;
                while ((n = in.read(response, used, response.length - used)) != -1) {
                    used += n;
                    if (used == response.length) throw new IOException("คำตอบสิทธิ์ยาวเกินกำหนด");
                }
                return new JSONObject(new String(response, 0, used, StandardCharsets.UTF_8)).optBoolean("ok");
            } catch (Exception error) { throw new IOException("อ่านผลสิทธิ์ไม่ได้", error); }
        } finally { connection.disconnect(); }
    }
}
