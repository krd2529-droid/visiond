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
    private Button older,newer;
    private long nextAt,nextId;
    private long lastRevision=-1;
    private boolean hasMore;
    private int pageIndex;
    private final List<long[]> cursors=new ArrayList<>();
    private final List<JSONObject> visible=new ArrayList<>();
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final Runnable poll=new Runnable(){public void run(){
        try {
            if(MessageHistory.revision(SendStatusActivity.this)!=lastRevision)refresh();
        } catch(RuntimeException e) { summary.setText("อ่านสถานะไม่ได้: "+e.getMessage()); }
        handler.postDelayed(this,2000);
    }};
    static final String[] FILTERS={"","SENT","FAILED","SKIPPED","CANCELLED","UNKNOWN","PENDING","SENDING"};
    @Override public void onCreate(Bundle state){
        super.onCreate(state);
        LinearLayout layout=new LinearLayout(this);layout.setOrientation(LinearLayout.VERTICAL);
        int p=(int)(16*getResources().getDisplayMetrics().density);layout.setPadding(p,p,p,p);setContentView(layout);
        layout.setOnApplyWindowInsetsListener((v,insets)->{
            v.setPadding(p+insets.getSystemWindowInsetLeft(),p+insets.getSystemWindowInsetTop(),p+insets.getSystemWindowInsetRight(),p+insets.getSystemWindowInsetBottom());return insets;
        });
        Button back=new Button(this);back.setText("กลับ");back.setOnClickListener(v->finish());layout.addView(back);
        summary=new TextView(this);summary.setTextSize(18);layout.addView(summary);
        TextView note=new TextView(this);note.setText("ประวัติข้อความในเครื่อง • แตะรายการเพื่อดูเนื้อหา\nส่งสำเร็จ = ระบบยืนยันครบทุกส่วน • ถึงเครื่อง = มีรายงานจากเครือข่าย\nSMS ทั่วไปตรวจสอบเวลาเปิดอ่านไม่ได้");layout.addView(note);
        filter=new Spinner(this);
        filter.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,
                new String[]{"ทั้งหมด","ส่งสำเร็จ","ส่งไม่สำเร็จ","ข้าม: ซิมไม่พร้อม","ไม่ได้ส่ง: คิวถูกแทนที่","ไม่ทราบผล","รอส่ง","รอผลจากระบบ"}));
        layout.addView(filter);
        list=new ListView(this);layout.addView(list,new LinearLayout.LayoutParams(-1,0,1));
        LinearLayout pages=new LinearLayout(this);
        newer=new Button(this);newer.setText("ใหม่กว่า");newer.setOnClickListener(v->{pageIndex--;loadPage();});
        older=new Button(this);older.setText("เก่ากว่า");older.setOnClickListener(v->{
            long[] cursor={nextAt,nextId};
            if(cursors.size()>pageIndex+1)cursors.set(pageIndex+1,cursor);else cursors.add(cursor);
            pageIndex++;loadPage();
        });
        pages.addView(newer,new LinearLayout.LayoutParams(0,-2,1));
        pages.addView(older,new LinearLayout.LayoutParams(0,-2,1));layout.addView(pages);
        list.setOnItemClickListener((parent,v,position,id)->new AlertDialog.Builder(this)
                .setTitle("รายละเอียดการส่ง").setMessage(SendStatus.detail(visible.get(position))).setPositiveButton("ปิด",null).show());
        filter.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener(){
            public void onItemSelected(AdapterView<?> parent,View v,int position,long id){refresh();}
            public void onNothingSelected(AdapterView<?> parent){}
        });
    }
    void refresh(){
        try{
            synchronized(Scheduler.LOCK){
                JSONObject current=Store.load(this);
                MessageHistory.reconcileReplacement(this,current);
                MessageHistory.recordCampaign(this,current);
                Scheduler.recoverTimeout(this,current);
            }
            pageIndex=0;cursors.clear();cursors.add(new long[]{0,0});loadPage();
        }catch(RuntimeException e){summary.setText("อ่านสถานะไม่ได้: "+e.getMessage());}
    }
    void loadPage(){
        try{
            int selected=Math.max(0,filter.getSelectedItemPosition());
            long[] cursor=cursors.get(pageIndex);
            MessageHistory.Page page=MessageHistory.page(this,FILTERS[selected],cursor[0],cursor[1]);
            visible.clear();visible.addAll(page.rows);nextAt=page.nextAt;nextId=page.nextId;hasMore=page.more;
            lastRevision=MessageHistory.revision(this);
            List<String> labels=new ArrayList<>();for(JSONObject row:visible)labels.add(SendStatus.line(row));
            summary.setText("ประวัติข้อความในเครื่อง • หน้า "+(pageIndex+1)+" • "+visible.size()+" รายการ");
            list.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_list_item_1,labels));
            newer.setVisibility(pageIndex>0?View.VISIBLE:View.INVISIBLE);
            older.setVisibility(hasMore?View.VISIBLE:View.INVISIBLE);
        }catch(RuntimeException e){summary.setText("อ่านประวัติไม่ได้: "+e.getMessage());}
    }
    @Override protected void onResume(){super.onResume();refresh();handler.post(poll);}
    @Override protected void onPause(){handler.removeCallbacks(poll);super.onPause();}
}
