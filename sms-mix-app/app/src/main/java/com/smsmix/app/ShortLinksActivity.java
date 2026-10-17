package com.smsmix.app;

import android.app.*;
import android.content.*;
import android.graphics.Color;
import android.os.*;
import android.view.*;
import android.widget.*;
import org.json.*;

public class ShortLinksActivity extends Activity {
    private EditText original, count;
    private TextView status, results;
    private Button generate, retry, use, saveSet;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final Runnable poll=new Runnable() {
        public void run() {refresh(); handler.postDelayed(this,1000);}
    };
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        ScrollView scroll=new ScrollView(this);
        LinearLayout layout=new LinearLayout(this); layout.setOrientation(LinearLayout.VERTICAL);
        int p=(int)(20*getResources().getDisplayMetrics().density); layout.setPadding(p,p,p,p);
        scroll.addView(layout); setContentView(scroll);
        scroll.setOnApplyWindowInsetsListener((v,insets)->{
            v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
            return insets;
        });
        TextView title=new TextView(this); title.setText("สร้างลิงก์ด้วย Shrinkrl"); title.setTextSize(24); layout.addView(title);
        TextView info=new TextView(this);
        info.setText("ใส่ลิงก์ต้นทาง 1 รายการ แล้วเลือกจำนวนลิงก์สั้น 1–100 รายการ\nส่งลิงก์ต้นทางให้ Shrinkrl ผ่านอินเทอร์เน็ต ไม่ส่งเบอร์โทรหรือแคปชั่น\nคิวส่ง SMS ต้องมีลิงก์รวม 10–100 รายการ");
        layout.addView(info);
        original=new EditText(this); original.setHint("https://…"); original.setSingleLine(true);
        original.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_VARIATION_URI);
        original.setText(getPreferences(0).getString("original","")); layout.addView(original);
        count=new EditText(this); count.setHint("จำนวนลิงก์ 1–100"); count.setInputType(android.text.InputType.TYPE_CLASS_NUMBER);
        count.setText(getPreferences(0).getString("count","20")); layout.addView(count);
        generate=button(layout,"สร้างลิงก์",this::generate);
        retry=button(layout,"ลองต่อด้วยคำขอเดิม",()->ShortLinkJobs.start(this,null,true));
        status=new TextView(this); status.setTextColor(Color.rgb(15,23,42)); layout.addView(status);
        results=new TextView(this); results.setTextIsSelectable(true); layout.addView(results);
        use=button(layout,"ใช้ลิงก์ที่สร้างได้",this::apply);
        saveSet=button(layout,"บันทึกต้นฉบับ + ลิงก์ย่อเป็นชุด",()->LinkSetDialogs.save(this,ShortLinkJobs.snapshot(this)));
        button(layout,"ดูชุดลิงก์ที่บันทึกไว้",()->LinkSetDialogs.choose(this,this::returnLinks));
        button(layout,"กลับ",this::finish);
    }
    Button button(LinearLayout layout,String text,Runnable action) {
        Button b=new Button(this); b.setText(text); b.setAllCaps(false);
        b.setOnClickListener(v->guarded(()->{action.run();refresh();})); layout.addView(b); return b;
    }
    void guarded(Runnable action) {
        try {action.run();} catch(Exception e) {
            new AlertDialog.Builder(this).setMessage(e.getMessage()).setPositiveButton("ตกลง",null).show();
        }
    }
    void generate() {
        int quantity;
        try {quantity=Integer.parseInt(count.getText().toString().trim());}
        catch(NumberFormatException e) {throw new IllegalArgumentException("ใส่จำนวนลิงก์ 1–100");}
        JSONObject request=ShortLinkClient.request(original.getText().toString(),quantity);
        Runnable start=()->{
            getPreferences(0).edit().putString("original",original.getText().toString()).putString("count",count.getText().toString()).apply();
            ShortLinkJobs.start(this,request,false); refresh();
        };
        if(ShortLinkJobs.snapshot(this).has("request"))
            new AlertDialog.Builder(this).setTitle("เริ่มชุดลิงก์ใหม่?")
                    .setMessage("ผลชุดล่าสุดในหน้านี้จะถูกแทนที่ หากต้องการเก็บผลเดิม ให้บันทึกเป็นชุดลิงก์ก่อน")
                    .setNegativeButton("ยกเลิก",null).setPositiveButton("สร้างชุดใหม่",(a,b)->guarded(start)).show();
        else start.run();
    }
    void refresh() {
        try {
            JSONObject job=ShortLinkJobs.snapshot(this);
            boolean busy=ShortLinkJobs.isRunning();
            JSONArray urls=job.optJSONArray("results");
            int size=urls==null?0:urls.length();
            JSONObject request=job.optJSONObject("request");
            int total=request==null?0:request.optJSONArray("urls").length();
            generate.setEnabled(!busy); retry.setEnabled(!busy && request!=null && size<total);
            use.setEnabled(!busy && size>0); saveSet.setEnabled(!busy && size>0);
            String note=busy?"กำลังสร้างลิงก์…":job.optString("error");
            if(!busy && "working".equals(job.optString("status")))
                note="งานถูกขัดจังหวะหรือบันทึกผลไม่สำเร็จ กดลองต่อด้วยคำขอเดิม";
            String destination=request==null?"":request.optJSONArray("urls").optJSONObject(0).optString("original_url");
            status.setText("ผลล่าสุด: "+size+" / "+total+" ลิงก์\n"+destination+"\n"+note);
            StringBuilder text=new StringBuilder();
            if(urls!=null) for(int i=0;i<urls.length();i++) {if(i>0)text.append('\n');text.append(urls.optString(i));}
            results.setText(text.toString());
        } catch(Exception e) {status.setText(e.getMessage());generate.setEnabled(false);retry.setEnabled(false);use.setEnabled(false);saveSet.setEnabled(false);}
    }
    void apply() {
        if(ShortLinkJobs.isRunning()) throw new IllegalStateException("กรุณารอผลก่อน");
        JSONObject job=ShortLinkJobs.snapshot(this);
        JSONArray urls=job.optJSONArray("results");
        if(urls==null || urls.length()==0) throw new IllegalStateException("ยังไม่มีลิงก์ที่สร้างได้");
        StringBuilder text=new StringBuilder();
        for(int i=0;i<urls.length();i++) {if(i>0)text.append('\n');text.append(urls.optString(i));}
        returnLinks(text.toString());
    }
    void returnLinks(String text) {
        setResult(RESULT_OK,new Intent().putExtra("shortLinks",text)); finish();
    }
    @Override protected void onResume() {super.onResume();handler.post(poll);}
    @Override protected void onPause() {
        handler.removeCallbacks(poll);
        getPreferences(0).edit().putString("original",original.getText().toString()).putString("count",count.getText().toString()).apply();
        super.onPause();
    }
}
