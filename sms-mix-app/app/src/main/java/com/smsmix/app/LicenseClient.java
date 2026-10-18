package com.smsmix.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.SystemClock;
import android.provider.Settings;
import org.json.JSONObject;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.UUID;
import java.util.concurrent.*;

final class LicenseClient {
    enum ActivationResult {
        ACTIVE(""),
        INVALID_FORMAT("รูปแบบคีย์ไม่ถูกต้อง กรุณาตรวจคีย์ VisionD แล้วกรอกใหม่"),
        NOT_ELIGIBLE("คีย์นี้ยังเปิดใช้ VSMS ไม่ได้ กรุณาตรวจว่าเป็นคีย์ VSMS ที่ชำระแล้ว เปิดใช้งานอยู่ ไม่หมดอายุ และไม่ผูกเครื่องอื่น หากยังไม่ได้เปิดขายให้ติดต่อ VisionD"),
        BOUND_OTHER_DEVICE("คีย์นี้ผูกกับเครื่องอื่นแล้ว หากต้องการย้ายเครื่อง กรุณาติดต่อ VisionD"),
        RATE_LIMITED("ลองเปิดใช้คีย์บ่อยเกินไป กรุณารอ 15 นาทีแล้วลองอีกครั้ง"),
        UNAVAILABLE("ติดต่อระบบสิทธิ์ VisionD ไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง"),
        DEVICE_ERROR("อ่านรหัสเครื่องไม่ได้ กรุณาตรวจการตั้งค่าเครื่องแล้วลองอีกครั้ง"),
        STORAGE_ERROR("บันทึกคีย์ในเครื่องไม่ได้ กรุณาตรวจพื้นที่เก็บข้อมูลแล้วลองอีกครั้ง");
        private final String message;
        ActivationResult(String message) { this.message = message; }
        String message() { return message; }
        static ActivationResult fromHttpStatus(int status) {
            if (status == 200) return ACTIVE;
            if (status == 400) return INVALID_FORMAT;
            if (status == 403) return NOT_ELIGIBLE;
            if (status == 409) return BOUND_OTHER_DEVICE;
            if (status == 429) return RATE_LIMITED;
            return UNAVAILABLE;
        }
    }
    private static final String BASE = "https://visiondonline.com/api/vision7/sms-mix/";
    private static final String PREFS = "smsmix_license";
    private static final Object FLIGHT_LOCK = new Object();
    private static Future<Boolean> checkFlight;
    private static String checkIdentity;
    private static long checkStartedNanos;
    private static volatile String expiresAt = "";
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
        if (id.isEmpty()) {
            id = UUID.randomUUID().toString();
            if (!preferences.edit().putString("device_id", id).commit()) throw new IllegalStateException("บันทึกรหัสเครื่องไม่ได้");
        }
        String androidId = Settings.Secure.getString(context.getContentResolver(), Settings.Secure.ANDROID_ID);
        if (androidId == null || androidId.isEmpty()) throw new IllegalStateException("อ่านรหัสเครื่องไม่ได้");
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest((id + ":" + androidId).getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder(digest.length * 2);
            for (byte value : digest) result.append(String.format(java.util.Locale.ROOT, "%02x", value & 0xff));
            return result.toString();
        } catch (NoSuchAlgorithmException error) { throw new IllegalStateException("ไม่รองรับการตรวจรหัสเครื่อง", error); }
    }
    static boolean hasKey(Context context) { return !prefs(context).getString("key", "").isEmpty(); }
    static String reportIdentity(Context context) {
        String key = prefs(context).getString("key", "");
        if (key.isEmpty()) return "";
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest((key + ":" + deviceId(context)).getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder(digest.length * 2);
            for (byte value : digest) result.append(String.format(java.util.Locale.ROOT, "%02x", value & 0xff));
            return result.toString();
        } catch (NoSuchAlgorithmException error) { throw new IllegalStateException(error); }
    }
    static String statusText() { return expiresAt.isEmpty() ? "สิทธิ์ VisionD ใช้งานได้" : "สิทธิ์ VisionD ใช้งานได้ถึง " + expiresAt + " UTC"; }
    private static long expiryMillis(String value) {
        try { return java.time.Instant.parse(value.replace(' ','T') + (value.endsWith("Z") ? "" : "Z")).toEpochMilli(); }
        catch (RuntimeException error) { return 0; }
    }
    private static boolean storeEntitlement(Context context, String key, String device, JSONObject reply) {
        if (reply == null || !reply.optBoolean("ok") || reply.optString("activated_at").isEmpty()) return false;
        String expiry = reply.optString("expires_at");
        long until = expiryMillis(expiry), serverTime = reply.optLong("server_time");
        if (until <= serverTime || serverTime <= 0) return false;
        long wall = System.currentTimeMillis();
        String identity;
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest((key + ":" + device).getBytes(StandardCharsets.UTF_8));
            StringBuilder value = new StringBuilder();
            for (byte part:digest) value.append(String.format(java.util.Locale.ROOT,"%02x",part & 0xff));
            identity=value.toString();
        } catch (NoSuchAlgorithmException error) { return false; }
        boolean saved=prefs(context).edit().putString("key",key).putString("entitlement_identity",identity)
            .putString("entitlement_expiry",expiry).putLong("entitlement_until",until)
            .putLong("entitlement_server_time",serverTime).putLong("entitlement_wall_at_sync",wall)
            .putLong("entitlement_elapsed_at_sync",SystemClock.elapsedRealtime())
            .putLong("entitlement_last_wall",wall).commit();
        if (saved) expiresAt=expiry;
        return saved;
    }
    static boolean storeCheckedEntitlement(Context context, String key, String device, JSONObject reply) {
        synchronized (FLIGHT_LOCK) {
            if (!key.equals(prefs(context).getString("key", ""))) return false;
            try { if (!device.equals(deviceId(context))) return false; }
            catch (RuntimeException error) { return false; }
            return storeEntitlement(context,key,device,reply);
        }
    }
    static boolean locallyCurrent(Context context) {
        Verifier verifier=testVerifier;
        if (verifier != null) return verifier.verify(context);
        SharedPreferences state=prefs(context);
        String key=state.getString("key","");
        if (key.isEmpty()) return false;
        String identity;
        try { identity=reportIdentity(context); } catch (RuntimeException error) { return false; }
        if (!identity.equals(state.getString("entitlement_identity",""))) return false;
        long until=state.getLong("entitlement_until",0),serverTime=state.getLong("entitlement_server_time",0);
        long wallAtSync=state.getLong("entitlement_wall_at_sync",0),elapsedAtSync=state.getLong("entitlement_elapsed_at_sync",0);
        long lastWall=state.getLong("entitlement_last_wall",0),nowWall=System.currentTimeMillis(),nowElapsed=SystemClock.elapsedRealtime();
        if (until<=0 || serverTime<=0 || wallAtSync<=0 || nowWall+120000<lastWall) return false;
        long effective=Math.max(nowWall,serverTime+Math.max(0,nowWall-wallAtSync));
        if (nowElapsed>=elapsedAtSync) effective=Math.max(effective,serverTime+nowElapsed-elapsedAtSync);
        if (effective>=until) return false;
        if (nowWall>lastWall && !state.edit().putLong("entitlement_last_wall",nowWall).commit()) return false;
        expiresAt=state.getString("entitlement_expiry","");
        return true;
    }
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
                    try { ServerReply reply=request("check", key, device, appVersion(context));
                        return reply.status==200 && storeCheckedEntitlement(context,key,device,reply.body); }
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
        if (!locallyCurrent(context)) throw new IllegalStateException("สิทธิ์ VSMS ในเครื่องหมดอายุหรือไม่ถูกต้อง กรุณาเชื่อมต่ออินเทอร์เน็ตเพื่อยืนยันคีย์ใหม่");
    }
    static ActivationResult activate(Context context, String key) {
        String candidate = String.valueOf(key).trim();
        if (candidate.length() < 12 || candidate.length() > 200) return ActivationResult.INVALID_FORMAT;
        Future<ServerReply> pending;
        try {
            String device = deviceId(context), version = appVersion(context);
            pending = CHECKS.submit(() -> request("activate", candidate, device, version, deviceName()));
        } catch (IOException | RuntimeException error) { return ActivationResult.DEVICE_ERROR; }
        try {
            ServerReply reply = pending.get(5, TimeUnit.SECONDS);
            if (reply.status != 200) return ActivationResult.fromHttpStatus(reply.status);
            synchronized (FLIGHT_LOCK) {
                if (checkFlight != null) checkFlight.cancel(true);
                checkFlight = null; checkIdentity = null;
                return storeEntitlement(context,candidate,deviceId(context),reply.body)
                        ? ActivationResult.ACTIVE : ActivationResult.STORAGE_ERROR;
            }
        } catch (InterruptedException error) { Thread.currentThread().interrupt(); return ActivationResult.UNAVAILABLE; }
        catch (ExecutionException | TimeoutException | CancellationException error) { return ActivationResult.UNAVAILABLE; }
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
    static boolean uploadSuccessfulSends(Context context, JSONObject payload) {
        String key = prefs(context).getString("key", "");
        if (key.isEmpty()) return false;
        HttpURLConnection connection = null;
        try {
            String device = deviceId(context);
            payload.put("key", key); payload.put("device_id", device);
            byte[] bytes = payload.toString().getBytes(StandardCharsets.UTF_8);
            connection = (HttpURLConnection) new URL(BASE + "successful-sends").openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(5000); connection.setReadTimeout(5000);
            connection.setInstanceFollowRedirects(false); connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            connection.setRequestProperty("Cache-Control", "no-store");
            connection.setFixedLengthStreamingMode(bytes.length);
            try (OutputStream out = connection.getOutputStream()) { out.write(bytes); }
            if (connection.getResponseCode() != 200) return false;
            try (InputStream in = connection.getInputStream()) {
                byte[] answer = new byte[512]; int used=0,n;
                while (used < answer.length && (n=in.read(answer,used,answer.length-used))!=-1) used+=n;
                if (used==answer.length) return false;
                JSONObject response = new JSONObject(new String(answer,0,used,StandardCharsets.UTF_8));
                return response.optBoolean("ok") && response.optInt("accepted") == payload.optJSONArray("items").length();
            }
        } catch (Exception ignored) { return false; }
        finally { if(connection!=null) connection.disconnect(); }
    }
    private static final class ServerReply {
        final int status; final JSONObject body;
        ServerReply(int status, JSONObject body) { this.status=status;this.body=body; }
    }
    private static ServerReply request(String path, String key, String deviceId, String version) throws IOException {
        return request(path, key, deviceId, version, null);
    }
    private static ServerReply request(String path, String key, String deviceId, String version, String deviceName) throws IOException {
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
            int status = connection.getResponseCode();
            if (status != 200) return new ServerReply(status,null);
            try (InputStream in = connection.getInputStream()) {
                byte[] response = new byte[4096];
                int used = 0, n;
                while ((n = in.read(response, used, response.length - used)) != -1) {
                    used += n;
                    if (used == response.length) throw new IOException("คำตอบสิทธิ์ยาวเกินกำหนด");
                }
                JSONObject result = new JSONObject(new String(response, 0, used, StandardCharsets.UTF_8));
                return new ServerReply(result.optBoolean("ok") ? 200 : 403,result);
            } catch (Exception error) { throw new IOException("อ่านผลสิทธิ์ไม่ได้", error); }
        } finally { connection.disconnect(); }
    }
}
