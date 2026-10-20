package com.smsmix.app;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
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
    private static final int IMPORT = 41, EXPORT = 42, PERMISSIONS = 43, SHORT_LINKS = 44, EXPORT_SUCCESS = 46,
            EXPORT_SETS = 47, IMPORT_SETS = 48, PHONE_NUMBER_PERMISSION = 49;
    private EditText captions, links, manualOriginal, rangeStart, rangeEnd, drawCount, senderSim1, senderSim2;
    private Spinner recipientMode;
    private TextView recipientInfo, status, queueStateBadge;
    private Spinner simSpinner;
    private LinearLayout content;
    private final List<Integer> simIds = new ArrayList<>();
    private int sim1Id = -1, sim2Id = -1;
    private List<String> phones = new ArrayList<>();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable refresh = new Runnable() {
        public void run() { updateStatus(); handler.postDelayed(this, 2000); }
    };

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        try { LibraryTransfer.recover(this); }
        catch (RuntimeException e) {
            new AlertDialog.Builder(this).setMessage("กู้คืนชุดที่บันทึกไว้ไม่สำเร็จ: " + e.getMessage())
                    .setPositiveButton("ปิดแอป",(dialog,which)->finish()).setCancelable(false).show();
            return;
        }
        showLicenseGate();
    }

    void showLicenseGate() {
        try { SuccessfulSendOutbox.reconcile(this, Store.load(this)); }
        catch (RuntimeException ignored) { /* Local queue remains available for recovery. */ }
        status = null;
        queueStateBadge = null;
        simSpinner = null;
        senderSim1 = senderSim2 = null;
        sim1Id = sim2Id = -1;
        LinearLayout gate = new LinearLayout(this);
        gate.setOrientation(LinearLayout.VERTICAL);
        gate.setPadding(dp(20), dp(30), dp(20), dp(20));
        setContentView(gate);
        TextView title = new TextView(this);
        title.setText("เปิดใช้งาน VSMS ด้วยคีย์ VisionD");
        title.setTextSize(22);
        gate.addView(title);
        TextView state = new TextView(this);
        state.setText("คีย์หนึ่งชุดใช้ได้กับเครื่องเดียว ต้องเชื่อมต่ออินเทอร์เน็ตเพื่อยืนยันสิทธิ์");
        state.setPadding(0, dp(12), 0, dp(12));
        gate.addView(state);
        EditText input = new EditText(this);
        input.setHint("คีย์ VisionD");
        input.setSingleLine(true);
        gate.addView(input);
        Button activate = new Button(this);
        activate.setText("เปิดใช้งาน / เปลี่ยนคีย์");
        gate.addView(activate);
        activate.setOnClickListener(view -> {
            String key = input.getText().toString().trim();
            activate.setEnabled(false);
            state.setText("กำลังตรวจคีย์กับ VisionD...");
            new Thread(() -> {
                LicenseClient.ActivationResult result = LicenseClient.activate(this, key);
                runOnUiThread(() -> {
                    if (result == LicenseClient.ActivationResult.ACTIVE) {
                        SuccessfulSendOutbox.schedule(this);
                        renderApp();
                    }
                    else { state.setText(result.message()); activate.setEnabled(true); }
                });
            }, "vsms-activation").start();
        });
        if (LicenseClient.locallyCurrent(this)) {
            SuccessfulSendOutbox.schedule(this);
            renderApp();
        } else if (LicenseClient.hasKey(this)) {
            state.setText("กำลังตรวจสิทธิ์ออนไลน์...");
            new Thread(() -> {
                boolean accepted = LicenseClient.checkCurrent(this);
                runOnUiThread(() -> {
                    if (accepted || LicenseClient.locallyCurrent(this)) renderApp();
                    else {
                        pauseForLicense();
                        state.setText("ยืนยันสิทธิ์ไม่ได้ กรุณาเชื่อมต่ออินเทอร์เน็ตเพื่อต่ออายุหรือเปิดใช้คีย์อีกครั้ง");
                    }
                });
            }, "vsms-license-check").start();
        } else pauseForLicense();
    }

    void pauseForLicense() {
        try {
            JSONObject queue = Store.load(this);
            if (queue.optBoolean("running")) Scheduler.pause(this, queue, "หยุดคิว: สิทธิ์ VSMS ในเครื่องหมดอายุหรือไม่ถูกต้อง");
        } catch (RuntimeException ignored) { /* The send path remains fail-closed. */ }
    }

    void renderApp() {
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
        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.ic_vsms);
        logo.setContentDescription("โลโก้ VSMS");
        content.addView(logo, new LinearLayout.LayoutParams(dp(88), dp(88)));
        heading("VSMS", 30);
        label(LicenseClient.statusText());
        label("ส่งผ่านซิม • สุ่มข้อความ • ส่งสำเร็จเว้น 10–30 นาที • ล้มเหลวรอ 1 นาทีก่อนเบอร์ถัดไป");
        heading("1  สุ่มเบอร์ผู้รับแบบไม่ซ้ำ", 20);
        recipientMode = new Spinner(this);
        recipientMode.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item,
                new String[]{"สุ่มจากไฟล์เบอร์", "สุ่มจากช่วงเบอร์"}));
        content.addView(recipientMode);
        rangeStart = singleLine("เบอร์เริ่มต้น", android.text.InputType.TYPE_CLASS_PHONE);
        rangeEnd = singleLine("เบอร์สิ้นสุด (รวมเบอร์นี้)", android.text.InputType.TYPE_CLASS_PHONE);
        drawCount = singleLine("จำนวนเบอร์ที่จะสุ่ม 1–10,000", android.text.InputType.TYPE_CLASS_NUMBER);
        rangeStart.setText(getPreferences(0).getString("rangeStart", ""));
        rangeEnd.setText(getPreferences(0).getString("rangeEnd", ""));
        drawCount.setText(getPreferences(0).getString("drawCount", "10"));
        recipientMode.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener() {
            public void onItemSelected(android.widget.AdapterView<?> parent, View view, int position, long id) {
                rangeStart.setVisibility(position == 1 ? View.VISIBLE : View.GONE);
                rangeEnd.setVisibility(position == 1 ? View.VISIBLE : View.GONE);
            }
            public void onNothingSelected(android.widget.AdapterView<?> parent) {}
        });
        int mode = getPreferences(0).getInt("recipientMode", 0);
        recipientMode.setSelection(mode);
        rangeStart.setVisibility(mode == 1 ? View.VISIBLE : View.GONE);
        rangeEnd.setVisibility(mode == 1 ? View.VISIBLE : View.GONE);
        label("จำเบอร์ที่สุ่มเมื่อสร้างคิวสำเร็จ ทั้งสองโหมดใช้ประวัติเดียวกัน ไม่สุ่มซ้ำแม้เปลี่ยนไฟล์ ช่วงเบอร์ หรือเปิดแอปใหม่");
        label("ช่วงเบอร์ไทยต้องอยู่ในกลุ่ม 06, 08 หรือ 09 เดียวกัน ใส่จำนวนที่ต้องการสุ่มได้ทั้งสองโหมด");
        button("นำเข้าไฟล์ CSV / TXT", () -> {
            Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE);
            startActivityForResult(i, IMPORT);
        });
        recipientInfo = label("ยังไม่ได้นำเข้าเบอร์");
        label("UTF-8 • เบอร์อยู่คอลัมน์แรก • เบอร์ไทย 08… หรือรูปแบบ +รหัสประเทศ • ตัดเบอร์ซ้ำ");
        heading("2  ข้อความและลิงก์", 20);
        captions = editor("แคปชั่น 10–100 รายการ บรรทัดละรายการ");
        button("ล้างช่องข้อความ", () -> confirmClearDraft(captions, "ล้างช่องข้อความ"));
        button("บันทึกชุดแคปชั่น / ตั้งชื่อ", this::saveCaptionSet);
        button("เลือกชุดแคปชั่นที่บันทึกไว้", this::chooseCaptionSet);
        manualOriginal = singleLine("ลิงก์ต้นฉบับ (ไม่บังคับ)", android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI);
        manualOriginal.setText(getPreferences(0).getString("manualOriginal", ""));
        links = editor("วางลิงก์ย่อ บรรทัดละลิงก์");
        button("ล้างช่องลิงก์", () -> confirmClearDraft(links, "ล้างช่องลิงก์"));
        label("เซฟชุดได้ 1–100 ลิงก์ (ตัดซ้ำ) • สร้างคิว SMS ใช้ 10–100 ลิงก์");
        button("เซฟชุดลิงก์ที่วางเอง / ตั้งชื่อ", this::saveManualLinks);
        button("สร้างลิงก์ด้วย Shrinkrl", () -> startActivityForResult(new Intent(this, ShortLinksActivity.class), SHORT_LINKS));
        button("เลือกชุดลิงก์ที่บันทึกไว้", () -> LinkSetDialogs.chooseBundle(this, this::applyLinkBundle));
        button("ส่งออกชุดแคปชั่นและลิงก์เป็นไฟล์", () -> startActivityForResult(
                new Intent(Intent.ACTION_CREATE_DOCUMENT).setType("application/json")
                        .addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE, "VSMS-saved-sets.json"), EXPORT_SETS));
        button("นำเข้าชุดแคปชั่นและลิงก์จากไฟล์", () -> startActivityForResult(
                new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("application/json")
                        .addCategory(Intent.CATEGORY_OPENABLE), IMPORT_SETS));
        label("ไฟล์ชุดเป็นข้อความอ่านได้ เก็บเฉพาะชุดแคปชั่นและลิงก์ ไม่รวมเบอร์/คีย์/คิว คุณเป็นผู้ย้ายไฟล์เอง");
        captions.setText(getPreferences(0).getString("captions", ""));
        links.setText(getPreferences(0).getString("links", ""));
        String imported = getPreferences(0).getString("phones", "");
        if (!imported.isEmpty()) phones = new ArrayList<>(Arrays.asList(imported.split("\n")));
        recipientInfo.setText("พร้อมใช้งาน " + phones.size() + " เบอร์");
        label("สุ่มแคปชั่น 1 รายการ + ลิงก์ 1 รายการต่อเบอร์ สามารถสุ่มซ้ำได้ จำนวนสองชุดไม่ต้องเท่ากัน");
        heading("3  เลือกซิมและตรวจรายการ", 20);
        button("อนุญาต SMS / โหลดรายการซิม", this::requestPermissionsAndSims);
        label("เบอร์ผู้ส่งที่ Android รายงานอาจว่างหรือไม่ตรง หากว่างให้ระบุเบอร์สำรองตามช่องซิม (จะแสดงว่า ผู้ใช้ระบุ)");
        if (Build.VERSION.SDK_INT >= 33)
            button("อนุญาตอ่านเบอร์ซิม (ไม่บังคับ)", () -> {
                if (checkSelfPermission(Manifest.permission.READ_PHONE_NUMBERS) != PackageManager.PERMISSION_GRANTED)
                    requestPermissions(new String[]{Manifest.permission.READ_PHONE_NUMBERS}, PHONE_NUMBER_PERMISSION);
                else message("อนุญาตอ่านเบอร์ซิมแล้ว แต่เครือข่ายอาจไม่รายงานเบอร์");
            });
        senderSim1 = singleLine("เบอร์ผู้ส่งสำรอง SIM 1 (ผู้ใช้ระบุ)", android.text.InputType.TYPE_CLASS_PHONE);
        senderSim2 = singleLine("เบอร์ผู้ส่งสำรอง SIM 2 (ผู้ใช้ระบุ)", android.text.InputType.TYPE_CLASS_PHONE);
        simSpinner = new Spinner(this);
        content.addView(simSpinner);
        button("เปิดสิทธิ์ตั้งเวลา", () -> {
            if (Build.VERSION.SDK_INT >= 31 && !Scheduler.exactAllowed(this))
                startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getPackageName())));
            else message("เปิดสิทธิ์ตั้งเวลาแล้ว");
        });
        button("สร้างคิวและพรีวิว", this::prepare);
        label("เบอร์แรกส่งหลังยืนยันทันที ส่งสำเร็จแล้วสุ่มรอ 10–30 นาที; ส่งไม่สำเร็จรอ 1 นาทีก่อนเบอร์ถัดไป ข้อความยาวอาจคิดค่าบริการหลาย SMS");
        heading("คิวปัจจุบัน", 20);
        queueStateBadge = new TextView(this);
        queueStateBadge.setTextSize(24);
        queueStateBadge.setTypeface(null, Typeface.BOLD);
        queueStateBadge.setGravity(Gravity.CENTER_VERTICAL);
        queueStateBadge.setMinHeight(dp(60));
        queueStateBadge.setPadding(dp(18), dp(12), dp(18), dp(12));
        LinearLayout.LayoutParams badgeLayout = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        badgeLayout.setMargins(0, dp(8), 0, dp(8));
        content.addView(queueStateBadge, badgeLayout);
        status = label("");
        button("เบอร์ที่สุ่มได้ / พรีวิวและผลส่งทุกเบอร์", this::preview);
        button("ทำงานอีกครั้ง (สุ่มเบอร์ใหม่จากช่วงเดิม)", this::repeatCampaign);
        button("เริ่มส่ง / ทำต่อ", this::confirmStart);
        button("สถานะการส่งรายเบอร์ / เบอร์ส่งสำเร็จ", () -> startActivity(new Intent(this, SendStatusActivity.class)));
        button("ตั้งค่าแบตเตอรี่สำหรับส่งขณะปิดจอ", () -> {
            if (getSystemService(PowerManager.class).isIgnoringBatteryOptimizations(getPackageName())) {
                message("อนุญาตทำงานโดยไม่จำกัดแบตเตอรี่แล้ว"); return;
            }
            startActivity(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getPackageName())));
        });
        button("หยุดชั่วคราว", () -> {
            JSONObject d = Store.load(this);
            Scheduler.pause(this, d, "หยุดโดยผู้ใช้ — ข้อความที่ส่งให้ระบบแล้วอาจยังส่งต่อจนเสร็จ");
            updateStatus();
        });
        button("ส่งออกบันทึก CSV", () -> startActivityForResult(
                new Intent(Intent.ACTION_CREATE_DOCUMENT).setType("text/csv")
                        .addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE, "smsmix-log.csv"), EXPORT));
        button("บันทึกไฟล์เบอร์ + ลิงก์ที่ส่งสำเร็จ (CSV)", () -> startActivityForResult(
                new Intent(Intent.ACTION_CREATE_DOCUMENT).setType("text/csv")
                        .addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE, "smsmix-success.csv"), EXPORT_SUCCESS));
        label(footerText());
        loadSims();
        senderSim1.addTextChangedListener(senderDraftWatcher(0));
        senderSim2.addTextChangedListener(senderDraftWatcher(1));
        updateStatus();
    }

    android.text.TextWatcher senderDraftWatcher(int slot) {
        return new android.text.TextWatcher() {
            public void beforeTextChanged(CharSequence text, int start, int count, int after) {}
            public void onTextChanged(CharSequence text, int start, int before, int count) {}
            public void afterTextChanged(android.text.Editable text) { saveSenderNumber(slot); }
        };
    }

    String footerText() {
        String version = "ไม่ทราบเวอร์ชัน";
        try {
            String installed = getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            if (installed != null && !installed.isEmpty()) version = installed;
        } catch (PackageManager.NameNotFoundException ignored) { /* Never claim a stale hard-coded version. */ }
        return "VSMS " + version + " • ข้อมูลเก็บในเครื่อง\nส่งสำเร็จ: เว้น 10–30 นาทีต่อเบอร์/รอบ (สลับซิม: SIM 1 → SIM 2 หลังผลสำเร็จ)\nส่งไม่สำเร็จ: รอ 1 นาทีแล้วส่งเบอร์ถัดไป ไม่ส่งเบอร์เดิมซ้ำ\nหากซิมหนึ่งใช้ไม่ได้ จะข้ามเบอร์นั้นแล้วทำต่อด้วยอีกซิม เว้น 10–30 นาทีต่อเบอร์\nSMS ไม่มีสถานะอ่านแล้ว การรับขึ้นกับรายงานจากเครือข่าย\nหลังรีสตาร์ตเครื่อง ให้เปิดแอปและกดทำต่อ";
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
    EditText singleLine(String hint, int inputType) {
        EditText e = new EditText(this); e.setHint(hint); e.setSingleLine(true);
        e.setInputType(inputType); content.addView(e); return e;
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
    void confirmClearDraft(EditText field, String title) {
        if (field.getText().length() == 0) return;
        new AlertDialog.Builder(this).setTitle(title)
                .setMessage("ต้องการ" + title + "หรือไม่? ข้อความในช่องนี้จะถูกล้าง แต่ชุดที่บันทึกไว้และคิวปัจจุบันจะไม่เปลี่ยน")
                .setNegativeButton("ยกเลิก", null)
                .setPositiveButton("ล้าง", (dialog, which) -> {
                    field.setText("");
                    saveDraft();
                }).show();
    }
    void saveCaptionSet() {
        final String text = String.join("\n", CampaignCore.lines(captions.getText().toString(), false));
        EditText nameInput = new EditText(this);
        nameInput.setSingleLine(true);
        nameInput.setHint("ชื่อชุด เช่น โปรประจำเดือน");
        nameInput.setFilters(new android.text.InputFilter[]{new android.text.InputFilter.LengthFilter(60)});
        AlertDialog dialog = new AlertDialog.Builder(this).setTitle("บันทึกชุดแคปชั่น")
                .setView(nameInput).setNegativeButton("ยกเลิก", null).setPositiveButton("บันทึก", null).create();
        dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            try {
                String name = CaptionLibrary.name(nameInput.getText().toString());
                boolean exists = CaptionLibrary.load(this).containsKey(name);
                Runnable write = () -> {
                    CaptionLibrary.save(this, name, text, exists);
                    saveDraft(); dialog.dismiss(); message("บันทึกชุด «" + name + "» แล้ว");
                };
                if (exists) new AlertDialog.Builder(this).setTitle("บันทึกทับชุดเดิม?")
                        .setMessage("มีชุดชื่อ «" + name + "» แล้ว ต้องการแทนที่แคปชั่นในชุดนี้หรือไม่")
                        .setNegativeButton("ยกเลิก", null)
                        .setPositiveButton("บันทึกทับ", (a,b) -> guarded(write)).show();
                else write.run();
            } catch (Exception e) { nameInput.setError(e.getMessage()); }
        }));
        dialog.show();
    }

    void chooseCaptionSet() {
        SortedMap<String,String> library = CaptionLibrary.load(this);
        if (library.isEmpty()) { message("ยังไม่มีชุดแคปชั่น กรุณาใส่แคปชั่นแล้วกดบันทึกชุดก่อน"); return; }
        String[] names = library.keySet().toArray(new String[0]);
        new AlertDialog.Builder(this).setTitle("เลือกชุดแคปชั่น")
                .setItems(names, (dialog, which) -> guarded(() -> {
                    String text = library.get(names[which]);
                    Runnable use = () -> { captions.setText(text); saveDraft(); };
                    String current = captions.getText().toString().trim();
                    if (!current.isEmpty() && !current.equals(text))
                        new AlertDialog.Builder(this).setTitle("ใช้ชุด «" + names[which] + "»?")
                                .setMessage("ข้อความในช่องแคปชั่นจะถูกแทนที่ หากต้องการเก็บข้อความปัจจุบัน ให้ยกเลิกและบันทึกเป็นชุดก่อน")
                                .setNegativeButton("ยกเลิก", null).setPositiveButton("ใช้ชุดนี้", (a,b) -> guarded(use)).show();
                    else use.run();
                })).setNegativeButton("ปิด", null).show();
    }

    void saveManualLinks() {
        LinkSetDialogs.saveEntry(this, LinkLibrary.manual(manualOriginal.getText().toString(), links.getText().toString()));
        saveDraft();
    }
    void saveDraft() {
        getPreferences(0).edit().putString("captions", captions.getText().toString())
                .putString("manualOriginal", manualOriginal.getText().toString())
                .putString("links", links.getText().toString()).putString("phones", String.join("\n", phones))
                .putString("rangeStart", rangeStart.getText().toString())
                .putString("rangeEnd", rangeEnd.getText().toString())
                .putString("drawCount", drawCount.getText().toString())
                .putInt("recipientMode", recipientMode.getSelectedItemPosition()).apply();
        saveSenderNumbers();
    }
    void saveSenderNumbers() {
        saveSenderNumber(0);
        saveSenderNumber(1);
    }
    void saveSenderNumber(int slot) {
        int subscriptionId = slot == 0 ? sim1Id : sim2Id;
        EditText field = slot == 0 ? senderSim1 : senderSim2;
        if (field != null && subscriptionId >= 0)
            getPreferences(0).edit().putString(SenderIdentity.manualKey(subscriptionId),
                    field.getText().toString().trim()).apply();
    }
    @Override protected void onResume() {
        super.onResume();
        if (status != null) showLicenseGate();
        handler.post(refresh);
    }
    @Override protected void onPause() { if (captions != null) saveDraft(); handler.removeCallbacks(refresh); super.onPause(); }

    void requestPermissionsAndSims() {
        if (checkSelfPermission(Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED
                || checkSelfPermission(Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(new String[]{Manifest.permission.SEND_SMS, Manifest.permission.READ_PHONE_STATE}, PERMISSIONS);
        else loadSims();
    }
    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (code == PERMISSIONS || code == PHONE_NUMBER_PERMISSION) loadSims();
    }
    void loadSims() {
        saveSenderNumbers();
        int old = simSpinner.getSelectedItemPosition();
        int selected = old >= 0 && old < simIds.size() ? simIds.get(old) : -1;
        simIds.clear(); List<String> names = new ArrayList<>();
        sim1Id = -1; sim2Id = -1;
        if (checkSelfPermission(Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED) {
            SubscriptionManager sm = getSystemService(SubscriptionManager.class);
            List<SubscriptionInfo> current = sm == null ? null : sm.getActiveSubscriptionInfoList();
            if (current != null) {
                List<SubscriptionInfo> active = new ArrayList<>(current);
                active.sort(Comparator.comparingInt(SubscriptionInfo::getSimSlotIndex));
                for (SubscriptionInfo s : active) {
                    int slot = s.getSimSlotIndex(), id = s.getSubscriptionId();
                    if (slot == 0) sim1Id = id;
                    if (slot == 1) sim2Id = id;
                    simIds.add(id); names.add("SIM " + (slot + 1) + " · " + s.getDisplayName());
                }
            }
        }
        if (sim1Id >= 0 && sim2Id >= 0 && sim1Id != sim2Id) {
            simIds.add(-2); names.add("สลับอัตโนมัติ: SIM 1 → SIM 2 → พักหนึ่งรอบ");
        }
        if (names.isEmpty()) names.add("ยังไม่พบซิม / ยังไม่ได้ให้สิทธิ์");
        simSpinner.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, names));
        if (simIds.contains(selected)) simSpinner.setSelection(simIds.indexOf(selected));
        if (senderSim1 != null) {
            senderSim1.setVisibility(sim1Id >= 0 ? View.VISIBLE : View.GONE);
            senderSim1.setText(sim1Id >= 0 ? getPreferences(0).getString(SenderIdentity.manualKey(sim1Id), "") : "");
        }
        if (senderSim2 != null) {
            senderSim2.setVisibility(sim2Id >= 0 ? View.VISIBLE : View.GONE);
            senderSim2.setText(sim2Id >= 0 ? getPreferences(0).getString(SenderIdentity.manualKey(sim2Id), "") : "");
        }
    }

    void prepare() {
        final boolean range = recipientMode.getSelectedItemPosition() == 1;
        final String first = rangeStart.getText().toString(), last = rangeEnd.getText().toString();
        final int count;
        try { count = Integer.parseInt(drawCount.getText().toString().trim()); }
        catch (NumberFormatException e) { throw new IllegalArgumentException("กรุณาใส่จำนวนเบอร์ที่จะสุ่ม 1–10,000"); }
        RecipientSampler.count(count, CampaignCore.MAX_RECIPIENTS);
        if (range) new RecipientSampler.Range(first, last);
        else if (phones.isEmpty()) throw new IllegalArgumentException("กรุณานำเข้าเบอร์ก่อน");
        List<String> imported = new ArrayList<>(phones);
        List<String> c = CampaignCore.lines(captions.getText().toString(), false);
        List<String> l = CampaignCore.lines(links.getText().toString(), true);
        int selected = simSpinner.getSelectedItemPosition();
        if (selected < 0 || selected >= simIds.size()) throw new IllegalStateException("กรุณาอนุญาตและเลือกซิมก่อน");
        int sim = simIds.get(selected), alternateSim = -1;
        if (sim == -2) {
            if (sim1Id < 0 || sim2Id < 0 || sim1Id == sim2Id)
                throw new IllegalStateException("ต้องมี SIM 1 และ SIM 2 ที่ใช้งานอยู่ก่อนสร้างคิวสลับซิม");
            sim = sim1Id; alternateSim = sim2Id;
        }
        String simLabel = simSpinner.getSelectedItem().toString();
        JSONObject old = Store.load(this);
        if (old.optBoolean("running") || Store.sending(old) >= 0)
            throw new IllegalStateException("หยุดคิวและรอผลข้อความปัจจุบันก่อนสร้างคิวใหม่");
        final int firstSim = sim, secondSim = alternateSim;
        Runnable create = () -> {
            CampaignFactory.create(this, range, imported, first, last, count, c, l, firstSim, secondSim, simLabel, Scheduler.RANDOM);
            saveDraft(); updateStatus(); preview();
        };
        if (Store.rows(old).length() > 0)
            new AlertDialog.Builder(this).setTitle("สุ่มและแทนที่คิวเดิม?")
                    .setMessage("คิวเดิมจะถูกแทนที่ ควรส่งออกก่อน เบอร์ที่เคยสุ่มทั้งหมดจะยังถูกจดจำและไม่ถูกสุ่มใหม่ แม้ยังไม่ได้ส่ง")
                    .setNegativeButton("ยกเลิก", null).setPositiveButton("สุ่มและสร้างคิว", (a,b) -> guarded(create)).show();
        else create.run();
    }

    void preview() {
        JSONObject d = Store.load(this);
        JSONArray rows = Store.rows(d);
        if (rows.length() == 0) { message("ยังไม่มีคิว"); return; }
        String[] items = new String[rows.length()];
        for (int i = 0; i < rows.length(); i++) {
            JSONObject row = rows.optJSONObject(i);
            items[i] = (i + 1) + ". " + row.optString("phone")
                    + (row.optString("usedSimLabel", row.optString("simLabel")).isEmpty() ? ""
                    : " · " + row.optString("usedSimLabel", row.optString("simLabel")))
                    + " · " + statusName(row.optString("status"));
        }
        new AlertDialog.Builder(this).setTitle("คิว " + rows.length() + " เบอร์ · แตะดูข้อความ")
                .setItems(items, (dialog, which) -> {
                    JSONObject row = rows.optJSONObject(which);
                    message(SendStatus.detail(row));
                }).setNegativeButton("ปิด", null).show();
    }

    void repeatCampaign() {
        JSONObject previous=Store.load(this);
        String id=previous.optString("id");
        if(previous.optBoolean("running") && (Store.pending(previous)>=0 || Store.sending(previous)>=0)) {
            Scheduler.armNextRound(this,id);
            updateStatus();
            message("จองรอบถัดไป 1 รอบแล้ว เมื่อคิวนี้จบจะสุ่มเบอร์ใหม่และเริ่มส่งอัตโนมัติ กดหยุดชั่วคราวเพื่อยกเลิก");
        } else {
            Scheduler.startNextRound(this,id);
            updateStatus();
            message("สร้างคิวใหม่และเริ่มทำงานแล้ว ตรวจรายการและสถานะได้ในคิวปัจจุบัน");
        }
    }

    void confirmStart() {
        saveDraft(); // Include the latest manual sender fallback before the scheduler can hand off a row.
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 45);
            message("อนุญาตการแจ้งเตือนเพื่อแสดงสถานะและปุ่มหยุด แล้วกดเริ่มส่งอีกครั้ง"); return;
        }
        if (!getSystemService(NotificationManager.class).areNotificationsEnabled()) {
            startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName())); return;
        }
        JSONObject d = Store.load(this);
        if (d.optBoolean("running")) { message("คิวกำลังทำงานอยู่"); return; }
        if (Store.pending(d) < 0) { message("ไม่มีเบอร์ค้างส่ง กรุณาสร้างคิวก่อน"); return; }
        Scheduler.checkPermissions(this, d);
        String id = d.optString("id");
        new AlertDialog.Builder(this).setTitle("ยืนยันส่ง SMS")
                .setMessage(d.optString("simLabel") + "\nส่งข้อความตามพรีวิวผ่านซิมจริง มีค่าบริการตามแพ็กเกจ\n"
                        + (Scheduler.alternating(d) ? "SIM 1 ส่งก่อน หากสำเร็จ SIM 2 ส่งต่อทันที แล้วพัก 10–30 นาทีหนึ่งรอบ; หากส่งล้มเหลวรอ 1 นาทีก่อนเบอร์ถัดไป\n"
                        : "เริ่มเบอร์แรกทันที ส่งสำเร็จแล้วรอ 10–30 นาที; ส่งล้มเหลวรอ 1 นาทีก่อนเบอร์ถัดไป\n")
                        + "รายการส่งแล้ว / ล้มเหลว / ไม่ทราบผล จะไม่ถูกส่งซ้ำเมื่อทำต่อ")
                .setNegativeButton("ยกเลิก", null)
                .setPositiveButton("เริ่มส่ง", (a,b) -> guarded(() -> {
                    JSONObject latest = Store.load(this);
                    if (!id.equals(latest.optString("id"))) throw new IllegalStateException("คิวเปลี่ยน กรุณาตรวจพรีวิวใหม่");
                    Scheduler.resume(this, latest); updateStatus();
                })).show();
    }

    String statusName(String s) {
        switch (s) {
            case "PENDING": return "รอส่ง";
            case "SENDING": return "รอผลจากระบบ";
            case "SENT": return "ส่งสำเร็จ";
            case "FAILED": return "ส่งไม่สำเร็จ / บางส่วน";
            case "SKIPPED": return "ข้าม: ซิมไม่พร้อม ไม่ได้ส่ง";
            case "UNKNOWN": return "ไม่ทราบผล (ไม่ส่งซ้ำ)";
            default: return s;
        }
    }
    void showQueueState(boolean running) {
        if (queueStateBadge == null) return;
        int foreground = running ? Color.rgb(11, 122, 59) : Color.rgb(180, 35, 24);
        GradientDrawable background = new GradientDrawable();
        background.setColor(running ? Color.rgb(226, 246, 233) : Color.rgb(255, 234, 232));
        background.setCornerRadius(dp(14));
        background.setStroke(dp(2), foreground);
        queueStateBadge.setBackground(background);
        queueStateBadge.setTextColor(foreground);
        queueStateBadge.setText(running ? "▶ กำลังทำงาน" : "■ หยุด");
        queueStateBadge.setContentDescription(running ? "กำลังทำงาน" : "หยุด");
    }
    void updateStatus() {
        if (status == null) return;
        try {
            JSONObject d = Store.load(this); Scheduler.recoverTimeout(this, d);
            d = Store.load(this);
            showQueueState(d.optBoolean("running"));
            JSONArray rows = Store.rows(d); Map<String, Integer> counts = new LinkedHashMap<>();
            for (int i = 0; i < rows.length(); i++) {
                String s = rows.optJSONObject(i).optString("status");
                counts.put(s, counts.getOrDefault(s, 0) + 1);
            }
            StringBuilder text = new StringBuilder(d.optBoolean("running") ? "● กำลังทำงาน" : "○ หยุด / ยังไม่เริ่ม");
            text.append("\n").append(d.optString("simLabel")).append("\n").append(d.optString("note"));
            text.append("\nคิวปัจจุบัน: ").append(rows.length()).append(" เบอร์");
            text.append("\nประวัติเบอร์ที่ไม่สุ่มซ้ำสะสม: ").append(CampaignFactory.history(d).size()).append(" เบอร์");
            if(d.optBoolean("repeatArmed"))text.append("\nจองรอบถัดไป 1 รอบ — เริ่มอัตโนมัติเมื่อคิวนี้จบ (กดหยุดชั่วคราวเพื่อยกเลิก)");
            for (Map.Entry<String,Integer> e : counts.entrySet()) text.append("\n").append(statusName(e.getKey())).append(": ").append(e.getValue());
            if (d.optBoolean("running") && Store.pending(d) >= 0) {
                long next = d.optLong("nextAt");
                text.append("\nกำหนดส่งถัดไป: ").append(next == 0 ? "กำลังเริ่ม" : DateFormat.getDateTimeInstance().format(new Date(next)));
                if (!Scheduler.exactAllowed(this)) text.append("\nสิทธิ์ตั้งเวลาถูกปิด กรุณาหยุดคิว เปิดสิทธิ์ แล้วทำต่อ");
            }
            status.setText(text);
        } catch (RuntimeException e) { showQueueState(false); status.setText("หยุด: " + e.getMessage()); }
    }

    void applyLinkBundle(JSONObject entry) {
        applyLinkText(LinkLibrary.shortText(entry), entry.optString("original_url"));
    }
    void applyLinkText(String text) { applyLinkText(text, ""); }
    void applyLinkText(String text, String original) {
        Runnable apply = () -> { links.setText(text); manualOriginal.setText(original); saveDraft(); };
        if (!links.getText().toString().trim().isEmpty() && !links.getText().toString().trim().equals(text))
            new AlertDialog.Builder(this).setTitle("ใช้ลิงก์ชุดนี้?")
                    .setMessage("แทนที่รายการในช่องลิงก์ คิวที่สร้างไว้แล้วจะไม่เปลี่ยน")
                    .setNegativeButton("ยกเลิก", null).setPositiveButton("ใช้ลิงก์", (a,b) -> guarded(apply)).show();
        else apply.run();
    }

    private String importedSetCounts(LibraryTransfer.Preview preview) {
        return "แคปชั่น " + preview.captions + " ชุด (" + preview.captionLines + " ข้อความ) และลิงก์ "
                + preview.links + " ชุด (" + preview.linkUrls + " ลิงก์)";
    }

    private static final class ImportDrafts {
        final String captions, links, original;
        ImportDrafts(String captions, String links, String original) {
            this.captions=captions; this.links=links; this.original=original;
        }
    }
    private ImportDrafts currentImportDrafts() {
        return new ImportDrafts(captions.getText().toString(), links.getText().toString(),
                manualOriginal.getText().toString());
    }
    private boolean hasImportDrafts(LibraryTransfer.Snapshot incoming) {
        return (incoming.captions.size()==1 && !captions.getText().toString().trim().isEmpty())
                || (incoming.links.size()==1 && (!links.getText().toString().trim().isEmpty()
                || !manualOriginal.getText().toString().trim().isEmpty()));
    }

    private String showImportedSets(LibraryTransfer.Snapshot incoming, boolean replaceDrafts, ImportDrafts before) {
        int loaded=0;
        if(captions!=null && incoming.captions.size()==1 && (captions.getText().toString().trim().isEmpty()
                || (replaceDrafts && captions.getText().toString().equals(before.captions)))) {
            String name=incoming.captions.firstKey();
            String saved=CaptionLibrary.load(this).get(name);
            if(incoming.captions.get(name).equals(saved)) { captions.setText(saved); loaded++; }
        }
        if(links!=null && manualOriginal!=null && incoming.links.size()==1
                && ((links.getText().toString().trim().isEmpty()
                && manualOriginal.getText().toString().trim().isEmpty())
                || (replaceDrafts && links.getText().toString().equals(before.links)
                && manualOriginal.getText().toString().equals(before.original)))) {
            String name=incoming.links.firstKey();
            JSONObject entry=LinkLibrary.load(this).get(name);
            JSONObject selected=incoming.links.get(name);
            if(entry!=null && entry.optString("original_url").equals(selected.optString("original_url"))
                    && LinkLibrary.shortText(entry).equals(LinkLibrary.shortText(selected))) {
                links.setText(LinkLibrary.shortText(entry));
                manualOriginal.setText(entry.optString("original_url"));
                loaded++;
            }
        }
        if(loaded>0) saveDraft();
        return loaded==2 ? "เติมข้อความและลิงก์ลงช่องแก้ไขแล้ว" : loaded==1
                ? "เติมหนึ่งชุดลงช่องแก้ไขแล้ว อีกชุดเลือกใช้จากชุดที่บันทึกไว้"
                : "เลือกใช้จากชุดที่บันทึกไว้ได้ โดยร่างเดิมไม่เปลี่ยน";
    }

    private void saveImportedSetsForNextLaunch(LibraryTransfer.Snapshot incoming, boolean replaceDrafts, ImportDrafts before) {
        SharedPreferences drafts=getPreferences(0);
        SharedPreferences.Editor edit=drafts.edit();
        String currentCaptions=drafts.getString("captions","");
        String currentLinks=drafts.getString("links","");
        String currentOriginal=drafts.getString("manualOriginal","");
        if(incoming.captions.size()==1 && (currentCaptions.trim().isEmpty()
                || (replaceDrafts && currentCaptions.equals(before.captions)))) {
            String name=incoming.captions.firstKey();
            String saved=CaptionLibrary.load(this).get(name);
            if(incoming.captions.get(name).equals(saved))edit.putString("captions",saved);
        }
        if(incoming.links.size()==1 && ((currentLinks.trim().isEmpty() && currentOriginal.trim().isEmpty())
                || (replaceDrafts && currentLinks.equals(before.links) && currentOriginal.equals(before.original)))) {
            String name=incoming.links.firstKey();
            JSONObject entry=LinkLibrary.load(this).get(name), selected=incoming.links.get(name);
            if(entry!=null && entry.optString("original_url").equals(selected.optString("original_url"))
                    && LinkLibrary.shortText(entry).equals(LinkLibrary.shortText(selected))) {
                edit.putString("links",LinkLibrary.shortText(entry));
                edit.putString("manualOriginal",entry.optString("original_url"));
            }
        }
        edit.apply();
    }

    private void applyImportedSets(LibraryTransfer.Snapshot incoming, LibraryTransfer.Preview preview,
                                   int mode, boolean replaceDrafts, ImportDrafts before) {
        new Thread(() -> {
            try {
                LibraryTransfer.apply(this,incoming,mode);
                runOnUiThread(() -> {
                    try {
                        if(isFinishing()||isDestroyed()) saveImportedSetsForNextLaunch(incoming,replaceDrafts,before);
                        else message("นำเข้าสำเร็จ ไฟล์มี"+importedSetCounts(preview)+"\n"
                                +showImportedSets(incoming,replaceDrafts,before));
                    } catch(RuntimeException e) {
                        if(!isFinishing()&&!isDestroyed())message("นำเข้าชุดแล้ว แต่แสดงในช่องไม่ได้: "+e.getMessage());
                    }
                });
            } catch(Exception e) {
                boolean recoveryNeeded=LibraryTransfer.journalPending(this);
                runOnUiThread(() -> {
                    if(isFinishing()||isDestroyed())return;
                    if(recoveryNeeded) new AlertDialog.Builder(this)
                            .setMessage("นำเข้าชุดไม่สำเร็จและยังกู้คืนไม่ครบ กรุณาปิดแอปและตรวจพื้นที่เก็บข้อมูลก่อนเปิดใหม่: "+e.getMessage())
                            .setPositiveButton("ปิดแอป",(d,w)->finish()).setCancelable(false).show();
                    else message("นำเข้าชุดไม่สำเร็จ ข้อมูลเดิมยังอยู่: "+e.getMessage());
                });
            }
        },"sets-apply").start();
    }

    private void confirmImportedSets(LibraryTransfer.Snapshot incoming, LibraryTransfer.Preview preview, int mode) {
        ImportDrafts before=currentImportDrafts();
        if(hasImportDrafts(incoming))
            new AlertDialog.Builder(this).setTitle("แทนร่างเดิมหลังนำเข้า?")
                    .setMessage("ร่างเดิมในช่องแคปชั่นหรือลิงก์จะถูกแทนที่เฉพาะเมื่อเลือกแทนร่าง เบอร์และคิวไม่เปลี่ยน")
                    .setPositiveButton("แทนร่างเดิม",(dialog,which)->applyImportedSets(incoming,preview,mode,true,before))
                    .setNeutralButton("เก็บร่างเดิม",(dialog,which)->applyImportedSets(incoming,preview,mode,false,before))
                    .setNegativeButton("ยกเลิก",null).show();
        else applyImportedSets(incoming,preview,mode,false,before);
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (result != RESULT_OK || data == null) return;
        if (request == SHORT_LINKS) {
            String text = data.getStringExtra("shortLinks");
            if (text == null || text.trim().isEmpty()) return;
            applyLinkText(text);
            return;
        }
        if (data.getData() == null) return;
        Uri uri = data.getData();
        if (request == EXPORT_SETS) {
            new Thread(() -> {
                try {
                    byte[] bytes=LibraryTransfer.export(this);
                    try(OutputStream out=getContentResolver().openOutputStream(uri,"wt")) {
                        if(out==null)throw new IOException("เปิดไฟล์ปลายทางไม่ได้");
                        out.write(bytes);
                    }
                    runOnUiThread(() -> { if(!isFinishing()&&!isDestroyed()) message("ส่งออกชุดแคปชั่นและลิงก์แล้ว คุณสามารถย้ายไฟล์ไปอีกเครื่องเอง"); });
                } catch(Exception e) {
                    runOnUiThread(() -> { if(!isFinishing()&&!isDestroyed()) message("ส่งออกชุดไม่สำเร็จ: "+e.getMessage()); });
                }
            },"sets-export").start();
        } else if (request == IMPORT_SETS) {
            new Thread(() -> {
                try(InputStream in=getContentResolver().openInputStream(uri)) {
                    if(in==null)throw new IOException("เปิดไฟล์ไม่ได้");
                    LibraryTransfer.Snapshot incoming=LibraryTransfer.parse(in);
                    LibraryTransfer.Preview preview=LibraryTransfer.preview(this,incoming);
                    runOnUiThread(() -> {
                        if(isFinishing()||isDestroyed())return;
                        String summary="พบ"+importedSetCounts(preview)
                                + (preview.conflicts>0?" • ชื่อซ้ำ "+preview.conflicts+" ชุด":"")
                                + (hasImportDrafts(incoming)
                                ? "\nมีร่างเดิมในช่องแก้ไข หากเลือกแทนร่าง ข้อความและลิงก์เดิมจะถูกแทนที่หลังนำเข้า"
                                : "\nช่องร่างที่ว่างจะเติมจากไฟล์เมื่อมีชุดเดียวต่อประเภท")
                                + "\nเบอร์และคิวปัจจุบันจะไม่เปลี่ยน";
                        AlertDialog.Builder confirm=new AlertDialog.Builder(this).setTitle("นำเข้าชุดจากไฟล์?")
                                .setMessage(summary).setNegativeButton("ยกเลิก",null);
                        if(preview.conflicts>0)confirm
                                .setPositiveButton("ข้ามชื่อซ้ำ",(dialog,which)->confirmImportedSets(
                                        incoming,preview,LibraryTransfer.SKIP_CONFLICTS))
                                .setNeutralButton("แทนที่ชื่อซ้ำ",(dialog,which)->confirmImportedSets(
                                        incoming,preview,LibraryTransfer.OVERWRITE_CONFLICTS));
                        else confirm.setPositiveButton("นำเข้าชุด",(dialog,which)->confirmImportedSets(
                                incoming,preview,LibraryTransfer.REJECT_CONFLICTS));
                        confirm.show();
                    });
                } catch(Exception e) {
                    runOnUiThread(() -> { if(!isFinishing()&&!isDestroyed()) message("อ่านไฟล์ชุดไม่ได้ ข้อมูลเดิมยังอยู่: "+e.getMessage()); });
                }
            },"sets-import").start();
        } else if (request == IMPORT) {
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
        } else if (request == EXPORT_SUCCESS) guarded(() -> {
            String csv=SuccessLog.csv(this);
            try(OutputStream out=getContentResolver().openOutputStream(uri,"wt")) {
                if(out==null)throw new IOException("เปิดไฟล์ไม่ได้");
                out.write(csv.getBytes(StandardCharsets.UTF_8));message("บันทึกไฟล์เบอร์และลิงก์ที่ส่งสำเร็จแล้ว");
            }catch(IOException e){throw new IllegalStateException("ส่งออกไม่สำเร็จ",e);}
        });
        else if (request == EXPORT) guarded(() -> {
            JSONArray rows = Store.rows(Store.load(this));
            try (OutputStream out = getContentResolver().openOutputStream(uri, "wt")) {
                if (out == null) throw new IOException("เปิดไฟล์ไม่ได้");
                out.write(campaignCsv(rows).getBytes(StandardCharsets.UTF_8));
                message("ส่งออกเรียบร้อย");
            } catch (IOException e) { throw new IllegalStateException("ส่งออกไม่สำเร็จ", e); }
        });
    }
    static String campaignCsv(JSONArray rows) {
        StringBuilder csv = new StringBuilder("\uFEFFphone,status,message,sent_at,result_at,error,sender_sim,sender_phone,sender_source\r\n");
        for (int i = 0; i < rows.length(); i++) {
            JSONObject row = rows.optJSONObject(i);
            csv.append(quote(row.optString("phone"))).append(',').append(quote(row.optString("status"))).append(',')
                    .append(quote(row.optString("body"))).append(',')
                    .append(quote(row.optLong("sentAt") == 0 ? "" : new Date(row.optLong("sentAt")).toString())).append(',')
                    .append(quote(row.optLong("resultAt") == 0 ? "" : new Date(row.optLong("resultAt")).toString())).append(',')
                    .append(quote(row.optString("error"))).append(',')
                    .append(quote(SenderIdentity.sim(row))).append(',')
                    .append(quote(SenderIdentity.phone(row))).append(',')
                    .append(quote(SenderIdentity.source(row))).append("\r\n");
        }
        return csv.toString();
    }
    static String quote(String s) {
        // Prevent spreadsheet formulas when a recipient/message begins with =, +, -, @.
        if (!s.isEmpty() && "=+-@\t\r".indexOf(s.charAt(0)) >= 0) s = "'" + s;
        return "\"" + s.replace("\"", "\"\"") + "\"";
    }
}
