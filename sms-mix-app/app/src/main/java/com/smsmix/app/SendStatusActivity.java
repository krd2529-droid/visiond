package com.smsmix.app;
import android.app.*;
import android.os.*;
import android.view.*;
import android.widget.*;
import org.json.*;
import java.util.*;

public class SendStatusActivity extends Activity {
    private Spinner filter;
    private TextView summary;
    private ListView list;
    private String previous="";
    private final List<JSONObject> visible=new ArrayList<>();
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final Runnable poll=new Runnable(){public void run(){refresh();handler.postDelayed(this,2000);}};
    static final String[] FILTERS={"","SENT","FAILED","UNKNOWN","PENDING","SENDING"};
    @Override public void onCreate(Bundle state){
        super.onCreate(state);
        LinearLayout layout=new LinearLayout(this);layout.setOrientation(LinearLayout.VERTICAL);
        int p=(int)(16*getResources().getDisplayMetrics().density);layout.setPadding(p,p,p,p);setContentView(layout);
        layout.setOnApplyWindowInsetsListener((v,insets)->{
            v.setPadding(p+insets.getSystemWindowInsetLeft(),p+insets.getSystemWindowInsetTop(),p+insets.getSystemWindowInsetRight(),p+insets.getSystemWindowInsetBottom());return insets;
        });
        Button back=new Button(this);back.setText("กลับ");back.setOnClickListener(v->finish());layout.addView(back);
        summary=new TextView(this);summary.setTextSize(18);layout.addView(summary);
        TextView note=new TextView(this);note.setText("รายการเบอร์ที่สุ่มได้ • ส่งสำเร็จ = ส่งครบทุกส่วน\nถึงเครื่องผู้รับแล้ว = มีรายงานจากเครือข่าย • SMS ไม่รองรับสถานะอ่านแล้ว");layout.addView(note);
        filter=new Spinner(this);
        filter.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,
                new String[]{"ทั้งหมด","ส่งสำเร็จ","ส่งไม่สำเร็จ","ไม่ทราบผล","รอส่ง","รอผลจากระบบ"}));
        layout.addView(filter);
        list=new ListView(this);layout.addView(list,new LinearLayout.LayoutParams(-1,0,1));
        list.setOnItemClickListener((parent,v,position,id)->new AlertDialog.Builder(this)
                .setTitle("รายละเอียดการส่ง").setMessage(SendStatus.detail(visible.get(position))).setPositiveButton("ปิด",null).show());
        filter.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener(){
            public void onItemSelected(AdapterView<?> parent,View v,int position,long id){previous="";refresh();}
            public void onNothingSelected(AdapterView<?> parent){}
        });
    }
    void refresh(){
        try{
            JSONObject d=Store.load(this);Scheduler.recoverTimeout(this,d);
            String fingerprint=d.toString()+"#"+filter.getSelectedItemPosition();
            if(fingerprint.equals(previous))return;
            previous=fingerprint;visible.clear();
            JSONArray rows=Store.rows(d);List<String> labels=new ArrayList<>();int success=0,failed=0,unknown=0;
            int selected=Math.max(0,filter.getSelectedItemPosition());
            for(int i=0;i<rows.length();i++){
                JSONObject row=rows.optJSONObject(i);String status=row.optString("status");
                if("SENT".equals(status))success++;if("FAILED".equals(status))failed++;if("UNKNOWN".equals(status))unknown++;
                if(FILTERS[selected].isEmpty()||FILTERS[selected].equals(status)){visible.add(row);labels.add(SendStatus.line(row));}
            }
            summary.setText("สำเร็จ "+success+" • ไม่สำเร็จ "+failed+" • ไม่ทราบผล "+unknown+"\nทั้งหมด "+rows.length()+" เบอร์");
            list.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_list_item_1,labels));
        }catch(RuntimeException e){summary.setText("อ่านสถานะไม่ได้: "+e.getMessage());}
    }
    @Override protected void onResume(){super.onResume();handler.post(poll);}
    @Override protected void onPause(){handler.removeCallbacks(poll);super.onPause();}
}
