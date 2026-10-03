package com.smsmix.app;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.telephony.*;
import android.view.*;
import android.widget.*;
import org.json.*;
import java.io.*;
import java.nio.*;
import java.nio.charset.*;
import java.text.DateFormat;
import java.util.*;

public class MainActivity extends Activity {
    private static final int IMPORT = 41, EXPORT = 42, PERMISSIONS = 43;
    private EditText captions, links;
    private TextView recipientInfo, status, licenseStatus;
    private Spinner simSpinner;
    private LinearLayout content;
    private final List<Integer> simIds = new ArrayList<>();
    private List<String> phones = new ArrayList<>();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable refresh = new Runnable() {
        public void run() { updateStatus(); handler.postDelayed(this, 2000); }
    };

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(15, 23, 42));
        getWindow().setNavigationBarColor(Color.rgb(15, 23, 42));
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(Color.rgb(244, 247, 251));
        content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(20), dp(20), dp(20), dp(40));
        scroll.addView(content);
        setContentView(scroll);
        scroll.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        heading("SMS Mix", 30);
        label("ส่งผ่านซิม • สุ่มข้อความ • เว้นช่วง 10–30 นาที");
        heading("สิทธิ์ใช้งาน", 20);
        licenseStatus = label("ยังไม่ตรวจสอบสิทธิ์ออนไลน์");
        button("เปิดใช้คีย์บนเครื่องนี้", this::activateDialog);
        label("ใช้คีย์เดียวได้ครั้งละหนึ่งเครื่อง การเปิดใช้บนเครื่องนี้จะย้ายสิทธิ์จากเครื่องเดิม");
        heading("1  เตรียมเบอร์ผู้รับ", 20);
        button("นำเข้าไฟล์ CSV / TXT", () -> {
            Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE);
            startActivityForResult(i, IMPORT);
        });
        recipientInfo = label("ยังไม่ได้นำเข้าเบอร์");
        button("บันทึกชุดเบอร์", () -> saveSet("phones"));
        button("โหลด / ลบชุดเบอร์", () -> chooseSet("phones"));
        label("UTF-8 • เบอร์อยู่คอลัมน์แรก • เบอร์ไทย 08… หรือรูปแบบ +รหัสประเทศ • ตัดเบอร์ซ้ำ");
        heading("2  ข้อความและลิงก์", 20);
        captions = editor("แคปชั่น 10–100 รายการ บรรทัดละรายการ");
        button("บันทึกชุดแคปชั่น", () -> saveSet("captions"));
        button("โหลด / ลบชุดแคปชั่น", () -> chooseSet("captions"));
        links = editor("ลิงก์ http/https 10–100 รายการ บรรทัดละรายการ");
        captions.setText(getPreferences(0).getString("captions", ""));
        links.setText(getPreferences(0).getString("links", ""));
        String imported = getPreferences(0).getString("phones", "");
        if (!imported.isEmpty()) phones = new ArrayList<>(Arrays.asList(imported.split("\n")));
        recipientInfo.setText("พร้อมใช้งาน " + phones.size() + " เบอร์");
        label("สุ่มแคปชั่น 1 รายการ + ลิงก์ 1 รายการต่อเบอร์ สามารถสุ่มซ้ำได้ จำนวนสองชุดไม่ต้องเท่ากัน");
        heading("3  เลือกซิมและตรวจรายการ", 20);
        button("อนุญาต SMS / โหลดรายการซิม", this::requestPermissionsAndSims);
        simSpinner = new Spinner(this);
        content.addView(simSpinner);
        button("เปิดสิทธิ์ตั้งเวลา", () -> {
            if (Build.VERSION.SDK_INT >= 31 && !Scheduler.exactAllowed(this))
                startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getPackageName())));
            else message("เปิดสิทธิ์ตั้งเวลาแล้ว");
        });
        button("สร้างคิวและพรีวิว", this::prepare);
        label("เบอร์แรกส่งหลังยืนยันทันที เบอร์ถัดไปสุ่มรอ 10–30 นาทีใหม่ทุกครั้ง ข้อความยาวอาจคิดค่าบริการหลาย SMS");
        heading("คิวปัจจุบัน", 20);
        status = label("");
        button("ดูพรีวิว / สถานะทุกเบอร์", this::preview);
        button("เริ่มส่ง / ทำต่อ", this::confirmStart);
        button("หยุดชั่วคราว", () -> {
            JSONObject d = Store.load(this);
            Scheduler.pause(this, d, "หยุดโดยผู้ใช้ — ข้อความที่ส่งให้ระบบแล้วอาจยังส่งต่อจนเสร็จ");
            updateStatus();
        });
        button("ส่งออกบันทึก CSV", () -> startActivityForResult(
                new Intent(Intent.ACTION_CREATE_DOCUMENT).setType("text/csv")
                        .addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE, "smsmix-log.csv"), EXPORT));
        label("SMS Mix 0.2.0 • เบอร์และข้อความเก็บในเครื่อง\nสถานะส่งแล้ว = ระบบโทรศัพท์รายงานส่งสำเร็จ ไม่ใช่ยืนยันว่าผู้รับอ่านแล้ว\nหลังรีสตาร์ตเครื่อง ให้เปิดแอปและกดทำต่อ");
        loadSims();
    }

    int dp(int value) { return (int) (value * getResources().getDisplayMetrics().density); }
    TextView label(String text) {
        TextView v = new TextView(this); v.setText(text); v.setTextSize(15);
        v.setTextColor(Color.rgb(51, 65, 85)); v.setPadding(0, dp(6), 0, dp(10));
        content.addView(v); return v;
    }
    void heading(String text, int size) {
        TextView v = label(text); v.setTextSize(size); v.setTextColor(Color.rgb(15, 23, 42));
        v.setTypeface(null, android.graphics.Typeface.BOLD);
    }
    EditText editor(String hint) {
        EditText e = new EditText(this); e.setHint(hint); e.setTextSize(15); e.setMinLines(4);
        e.setMaxLines(7); e.setGravity(Gravity.TOP); e.setInputType(131073);
        content.addView(e, new LinearLayout.LayoutParams(-1, -2)); return e;
    }
    void button(String text, Runnable action) {
        Button b = new Button(this); b.setText(text); b.setAllCaps(false);
        b.setOnClickListener(v -> guarded(action));
        content.addView(b, new LinearLayout.LayoutParams(-1, -2));
    }
    void guarded(Runnable action) {
        try { action.run(); } catch (Exception e) { message(e.getMessage() == null ? e.toString() : e.getMessage()); }
    }
    void message(String text) { new AlertDialog.Builder(this).setMessage(text).setPositiveButton("ตกลง", null).show(); }
    void saveDraft() {
        getPreferences(0).edit().putString("captions", captions.getText().toString())
                .putString("links", links.getText().toString()).putString("phones", String.join("\n", phones)).apply();
    }
    @Override protected void onResume() {
        super.onResume(); handler.post(refresh); if (simSpinner != null) loadSims();
        if (!LicenseClient.hasKey(this)) {
            if (licenseStatus != null) licenseStatus.setText("ยังไม่มีคีย์บนเครื่องนี้");
            JSONObject queue = Store.load(this);
            if (queue.optBoolean("running")) Scheduler.pause(this, queue, "ยังไม่มีคีย์ คิวหยุดโดยไม่ส่งเบอร์ที่รออยู่");
            return;
        }
        new Thread(() -> {
            boolean active = LicenseClient.checkCurrent(this);
            if (!active) {
                JSONObject queue = Store.load(this);
                if (queue.optBoolean("running")) Scheduler.pause(this, queue, "ยืนยันสิทธิ์ออนไลน์ไม่ได้ คิวหยุดโดยไม่ส่งเบอร์ที่รออยู่");
            }
            runOnUiThread(() -> {
                if (isFinishing() || isDestroyed()) return;
                licenseStatus.setText(active ? "● สิทธิ์ใช้งานเครื่องนี้ยังใช้ได้" : "○ สิทธิ์ไม่พร้อมใช้งานหรือออฟไลน์ คิวถูกหยุด");
                updateStatus();
            });
        }, "smsmix-foreground-license").start();
    }
    @Override protected void onPause() { saveDraft(); handler.removeCallbacks(refresh); super.onPause(); }

    void requestPermissionsAndSims() {
        if (checkSelfPermission(Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED
                || checkSelfPermission(Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(new String[]{Manifest.permission.SEND_SMS, Manifest.permission.READ_PHONE_STATE}, PERMISSIONS);
        else loadSims();
    }
    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results); loadSims();
    }
    void loadSims() {
        int old = simSpinner.getSelectedItemPosition();
        int selected = old >= 0 && old < simIds.size() ? simIds.get(old) : -1;
        simIds.clear(); List<String> names = new ArrayList<>();
        if (checkSelfPermission(Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED) {
            SubscriptionManager sm = getSystemService(SubscriptionManager.class);
            List<SubscriptionInfo> active = sm == null ? null : sm.getActiveSubscriptionInfoList();
            if (active != null) for (SubscriptionInfo s : active) {
                simIds.add(s.getSubscriptionId()); names.add("SIM " + (s.getSimSlotIndex() + 1) + " · " + s.getDisplayName());
            }
        }
        if (names.isEmpty()) names.add("ยังไม่พบซิม / ยังไม่ได้ให้สิทธิ์");
        simSpinner.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, names));
        if (simIds.contains(selected)) simSpinner.setSelection(simIds.indexOf(selected));
    }

    void prepare() {
        if (phones.isEmpty()) throw new IllegalArgumentException("กรุณานำเข้าเบอร์ก่อน");
        List<String> c = CampaignCore.lines(captions.getText().toString(), false);
        List<String> l = CampaignCore.lines(links.getText().toString(), true);
        int selected = simSpinner.getSelectedItemPosition();
        if (selected < 0 || selected >= simIds.size()) throw new IllegalStateException("กรุณาอนุญาตและเลือกซิมก่อน");
        int sim = simIds.get(selected);
        JSONObject old = Store.load(this);
        String oldId = old.optString("id");
        if (old.optBoolean("running") || Store.sending(old) >= 0)
            throw new IllegalStateException("หยุดคิวและรอผลข้อความปัจจุบันก่อนสร้างคิวใหม่");
        Runnable create = () -> {
            synchronized (Scheduler.LOCK) {
            JSONObject latest = Store.load(this);
            if (!oldId.equals(latest.optString("id"))) throw new IllegalStateException("คิวเปลี่ยน กรุณาตรวจคิวล่าสุดก่อนสร้างใหม่");
            if (latest.optBoolean("running") || Store.sending(latest) >= 0)
                throw new IllegalStateException("หยุดคิวและรอผลข้อความปัจจุบันก่อนสร้างคิวใหม่");
            JSONObject d = Store.object(); JSONArray rows = new JSONArray();
            Store.put(d, "id", UUID.randomUUID().toString()); Store.put(d, "sim", sim);
            Store.put(d, "simLabel", simSpinner.getSelectedItem().toString());
            Store.put(d, "running", false); Store.put(d, "note", "พร้อมตรวจพรีวิว");
            for (String phone : phones) {
                JSONObject row = Store.object();
                Store.put(row, "phone", phone); Store.put(row, "body", CampaignCore.pair(c, l, Scheduler.RANDOM));
                Store.put(row, "status", "PENDING"); rows.put(row);
            }
            Store.put(d, "rows", rows); Store.save(this, d);
            }
            saveDraft(); updateStatus(); preview();
        };
        if (Store.rows(old).length() > 0)
            new AlertDialog.Builder(this).setTitle("แทนที่คิวเดิม?")
                    .setMessage("บันทึกคิวเดิมจะถูกแทนที่ ควรส่งออกก่อน เบอร์ในไฟล์ใหม่อาจเคยได้รับข้อความแล้ว")
                    .setNegativeButton("ยกเลิก", null).setPositiveButton("สร้างคิวใหม่", (a,b) -> guarded(create)).show();
        else create.run();
    }

    void preview() {
        JSONObject d = Store.load(this);
        JSONArray rows = Store.rows(d);
        if (rows.length() == 0) { message("ยังไม่มีคิว"); return; }
        String[] items = new String[rows.length()];
        for (int i = 0; i < rows.length(); i++) {
            JSONObject row = rows.optJSONObject(i);
            items[i] = (i + 1) + ". " + row.optString("phone") + " · " + statusName(row.optString("status"));
        }
        new AlertDialog.Builder(this).setTitle("คิว " + rows.length() + " เบอร์ · แตะดูข้อความ")
                .setItems(items, (dialog, which) -> {
                    JSONObject row = rows.optJSONObject(which);
                    message(row.optString("phone") + "\n\n" + row.optString("body") + "\n\n"
                            + statusName(row.optString("status")) + "\n" + row.optString("error"));
                }).setNegativeButton("ปิด", null).show();
    }

    void confirmStart() {
        JSONObject d = Store.load(this);
        if (d.optBoolean("running")) { message("คิวกำลังทำงานอยู่"); return; }
        if (Store.pending(d) < 0) { message("ไม่มีเบอร์ค้างส่ง กรุณาสร้างคิวก่อน"); return; }
        Scheduler.checkPermissions(this, d.optInt("sim", -1));
        String id = d.optString("id");
        new AlertDialog.Builder(this).setTitle("ยืนยันส่ง SMS")
                .setMessage(d.optString("simLabel") + "\nส่งข้อความตามพรีวิวผ่านซิมจริง มีค่าบริการตามแพ็กเกจ\n"
                        + "เริ่มเบอร์แรกทันที แล้วสุ่มรอ 10–30 นาทีระหว่างเบอร์\n"
                        + "รายการส่งแล้ว / ล้มเหลว / ไม่ทราบผล จะไม่ถูกส่งซ้ำเมื่อทำต่อ")
                .setNegativeButton("ยกเลิก", null)
                .setPositiveButton("เริ่มส่ง", (a,b) -> new Thread(() -> {
                    try {
                        JSONObject latest = Store.load(this);
                        if (!id.equals(latest.optString("id"))) throw new IllegalStateException("คิวเปลี่ยน กรุณาตรวจพรีวิวใหม่");
                        Scheduler.resume(this, latest);
                        runOnUiThread(this::updateStatus);
                    } catch (RuntimeException error) {
                        runOnUiThread(() -> { updateStatus(); message(error.getMessage()); });
                    }
                }, "smsmix-start-license").start()).show();
    }

    void activateDialog() {
        EditText field = new EditText(this);
        field.setSingleLine(true);
        field.setHint("VD7-...");
        new AlertDialog.Builder(this).setTitle("เปิดใช้คีย์ SMS Mix").setView(field)
                .setMessage("การเปิดใช้คีย์นี้จะย้ายสิทธิ์มาที่เครื่องนี้ เครื่องเดิมจะหยุดใช้เมื่อมีการตรวจออนไลน์ครั้งถัดไป")
                .setNegativeButton("ยกเลิก", null)
                .setPositiveButton("เปิดใช้", (dialog, which) -> {
                    String key = field.getText().toString();
                    licenseStatus.setText("กำลังตรวจสอบคีย์…");
                    new Thread(() -> {
                        boolean active = LicenseClient.activate(this, key);
                        runOnUiThread(() -> {
                            if (isFinishing() || isDestroyed()) return;
                            licenseStatus.setText(active ? "● เปิดใช้เครื่องนี้แล้ว" : "○ เปิดใช้ไม่สำเร็จ กรุณาตรวจคีย์และอินเทอร์เน็ต");
                        });
                    }, "smsmix-activate").start();
                }).show();
    }

    void saveSet(String category) {
        String value;
        if ("captions".equals(category)) {
            CampaignCore.lines(captions.getText().toString(), false);
            value = captions.getText().toString();
        } else {
            if (phones.isEmpty()) throw new IllegalStateException("กรุณานำเข้าเบอร์ก่อน");
            value = String.join("\n", phones);
        }
        EditText name = new EditText(this);
        name.setSingleLine(true);
        name.setHint("ชื่อชุดข้อมูล");
        new AlertDialog.Builder(this).setTitle("บันทึกชุด" + ("captions".equals(category) ? "แคปชั่น" : "เบอร์"))
                .setView(name).setNegativeButton("ยกเลิก", null)
                .setPositiveButton("บันทึก", (dialog, which) -> guarded(() -> {
                    String title = name.getText().toString().trim();
                    if (!SavedSets.read(this, category, title).isEmpty()) {
                        new AlertDialog.Builder(this).setMessage("แทนที่ชุด “" + title + "” ที่บันทึกไว้?")
                                .setNegativeButton("ยกเลิก", null)
                                .setPositiveButton("แทนที่", (d, w) -> guarded(() -> { SavedSets.save(this, category, title, value); message("บันทึกแล้ว"); })).show();
                    } else { SavedSets.save(this, category, title, value); message("บันทึกแล้ว"); }
                })).show();
    }

    void chooseSet(String category) {
        List<String> names = SavedSets.names(this, category);
        if (names.isEmpty()) { message("ยังไม่มีชุดข้อมูลที่บันทึกไว้"); return; }
        String label = "captions".equals(category) ? "แคปชั่น" : "เบอร์";
        new AlertDialog.Builder(this).setTitle("ชุด" + label).setItems(names.toArray(new String[0]), (dialog, index) -> {
            String name = names.get(index);
            new AlertDialog.Builder(this).setTitle(name).setItems(new String[]{"โหลดลงแบบร่าง", "ลบชุดนี้"}, (d, action) -> guarded(() -> {
                if (action == 1) {
                    new AlertDialog.Builder(this).setMessage("ลบชุด “" + name + "” ?")
                            .setNegativeButton("ยกเลิก", null)
                            .setPositiveButton("ลบ", (a, b) -> guarded(() -> SavedSets.delete(this, category, name))).show();
                    return;
                }
                String value = SavedSets.read(this, category, name);
                if ("captions".equals(category)) captions.setText(value);
                else {
                    CampaignCore.ImportResult imported = CampaignCore.importPhones(value);
                    if (!imported.errors.isEmpty()) throw new IllegalStateException("ชุดเบอร์ที่บันทึกไว้ไม่ถูกต้อง");
                    phones = imported.phones;
                    recipientInfo.setText("พร้อมใช้งาน " + phones.size() + " เบอร์ • โหลดจากชุด " + name);
                }
                saveDraft();
                message("โหลดลงแบบร่างแล้ว คิวที่สร้างไว้ไม่เปลี่ยน");
            })).show();
        }).show();
    }

    String statusName(String s) {
        switch (s) {
            case "PENDING": return "รอส่ง";
            case "SENDING": return "รอผลจากระบบ";
            case "SENT": return "ส่งแล้ว";
            case "FAILED": return "ส่งไม่สำเร็จ / บางส่วน";
            case "UNKNOWN": return "ไม่ทราบผล (ไม่ส่งซ้ำ)";
            default: return s;
        }
    }
    void updateStatus() {
        if (status == null) return;
        try {
            JSONObject d = Store.load(this); Scheduler.recoverTimeout(this, d);
            JSONArray rows = Store.rows(d); Map<String, Integer> counts = new LinkedHashMap<>();
            for (int i = 0; i < rows.length(); i++) {
                String s = rows.optJSONObject(i).optString("status");
                counts.put(s, counts.getOrDefault(s, 0) + 1);
            }
            StringBuilder text = new StringBuilder(d.optBoolean("running") ? "● กำลังทำงาน" : "○ หยุด / ยังไม่เริ่ม");
            text.append("\n").append(d.optString("simLabel")).append("\n").append(d.optString("note"));
            for (Map.Entry<String,Integer> e : counts.entrySet()) text.append("\n").append(statusName(e.getKey())).append(": ").append(e.getValue());
            if (d.optBoolean("running") && Store.pending(d) >= 0) {
                long next = d.optLong("nextAt");
                text.append("\nกำหนดส่งถัดไป: ").append(next == 0 ? "กำลังเริ่ม" : DateFormat.getDateTimeInstance().format(new Date(next)));
                if (!Scheduler.exactAllowed(this)) text.append("\nสิทธิ์ตั้งเวลาถูกปิด กรุณาหยุดคิว เปิดสิทธิ์ แล้วทำต่อ");
            }
            status.setText(text);
        } catch (RuntimeException e) { status.setText("หยุด: " + e.getMessage()); }
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (result != RESULT_OK || data == null || data.getData() == null) return;
        Uri uri = data.getData();
        if (request == IMPORT) {
            recipientInfo.setText("กำลังอ่านไฟล์…");
            new Thread(() -> {
                try (InputStream in = getContentResolver().openInputStream(uri)) {
                    if (in == null) throw new IOException("เปิดไฟล์ไม่ได้");
                    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                    byte[] buffer = new byte[8192]; int n;
                    while ((n = in.read(buffer)) != -1) {
                        bytes.write(buffer, 0, n);
                        if (bytes.size() > 2 * 1024 * 1024) throw new IOException("ไฟล์ต้องไม่เกิน 2 MB");
                    }
                    String text = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                            .decode(ByteBuffer.wrap(bytes.toByteArray())).toString();
                    CampaignCore.ImportResult imported = CampaignCore.importPhones(text);
                    runOnUiThread(() -> {
                        if (isFinishing() || isDestroyed()) return;
                        if (!imported.errors.isEmpty()) {
                            recipientInfo.setText("นำเข้าไม่สำเร็จ • เบอร์เดิม " + phones.size());
                            message("พบเบอร์ไม่ถูกต้อง " + imported.errors.size() + " แถว กรุณาแก้ไฟล์ก่อน\n"
                                    + String.join("\n", imported.errors.subList(0, Math.min(10, imported.errors.size()))));
                        } else {
                            phones = imported.phones;
                            recipientInfo.setText("พร้อมใช้งาน " + phones.size() + " เบอร์ • ตัดซ้ำ " + imported.duplicates);
                            saveDraft();
                        }
                    });
                } catch (Exception e) {
                    runOnUiThread(() -> {
                        if (isFinishing() || isDestroyed()) return;
                        recipientInfo.setText("นำเข้าไม่สำเร็จ • เบอร์เดิม " + phones.size());
                        message("อ่านไฟล์ไม่ได้: ใช้ CSV/TXT แบบ UTF-8\n" + e.getMessage());
                    });
                }
            }, "phone-import").start();
        } else if (request == EXPORT) guarded(() -> {
            JSONArray rows = Store.rows(Store.load(this));
            try (OutputStream out = getContentResolver().openOutputStream(uri, "wt")) {
                if (out == null) throw new IOException("เปิดไฟล์ไม่ได้");
                StringBuilder csv = new StringBuilder("\uFEFFphone,status,message,sent_at,error\r\n");
                for (int i = 0; i < rows.length(); i++) {
                    JSONObject row = rows.optJSONObject(i);
                    csv.append(quote(row.optString("phone"))).append(',').append(quote(row.optString("status"))).append(',')
                            .append(quote(row.optString("body"))).append(',')
                            .append(quote(row.optLong("sentAt") == 0 ? "" : new Date(row.optLong("sentAt")).toString())).append(',')
                            .append(quote(row.optString("error"))).append("\r\n");
                }
                out.write(csv.toString().getBytes(StandardCharsets.UTF_8));
                message("ส่งออกเรียบร้อย");
            } catch (IOException e) { throw new IllegalStateException("ส่งออกไม่สำเร็จ", e); }
        });
    }
    static String quote(String s) {
        // Prevent spreadsheet formulas when a recipient/message begins with =, +, -, @.
        if (!s.isEmpty() && "=+-@\t\r".indexOf(s.charAt(0)) >= 0) s = "'" + s;
        return "\"" + s.replace("\"", "\"\"") + "\"";
    }
}
