package com.smsmix.app;

import android.app.*;
import android.widget.*;
import org.json.*;
import java.util.*;
import java.util.function.Consumer;

final class LinkSetDialogs {
    static void error(Activity a,Exception e) {
        new AlertDialog.Builder(a).setMessage(e.getMessage()).setPositiveButton("ตกลง",null).show();
    }
    static void save(Activity a,JSONObject job) {
        saveEntry(a,LinkLibrary.bundle(job));
    }
    static void saveEntry(Activity a,JSONObject entry) {
        LinkLibrary.validate(entry);
        EditText input=new EditText(a); input.setSingleLine(true); input.setHint("ชื่อชุดลิงก์");
        input.setFilters(new android.text.InputFilter[]{new android.text.InputFilter.LengthFilter(60)});
        AlertDialog dialog=new AlertDialog.Builder(a).setTitle("บันทึกต้นฉบับ + ลิงก์ย่อทั้งหมด")
                .setMessage(entry.optString("original_url")+"\nลิงก์ย่อ "+entry.optJSONArray("short_urls").length()+" / "+entry.optInt("requested_count")+" ลิงก์")
                .setView(input).setNegativeButton("ยกเลิก",null).setPositiveButton("บันทึก",null).create();
        dialog.setOnShowListener(ignored->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{
            try {
                String name=CaptionLibrary.name(input.getText().toString());
                boolean exists=LinkLibrary.load(a).containsKey(name);
                Runnable write=()->{
                    try {
                        LinkLibrary.save(a,name,entry,exists); dialog.dismiss();
                        new AlertDialog.Builder(a).setMessage("บันทึกชุด «"+name+"» พร้อมลิงก์ต้นฉบับแล้ว").setPositiveButton("ตกลง",null).show();
                    } catch(Exception e) {error(a,e);}
                };
                if(exists) new AlertDialog.Builder(a).setTitle("บันทึกทับชุดเดิม?")
                        .setMessage("ชุด «"+name+"» จะถูกแทนที่ทั้งต้นฉบับและลิงก์ย่อ")
                        .setNegativeButton("ยกเลิก",null).setPositiveButton("บันทึกทับ",(d,b)->write.run()).show();
                else write.run();
            } catch(Exception e) {input.setError(e.getMessage());}
        }));
        dialog.show();
    }
    static void choose(Activity a,Consumer<String> use) {
        chooseBundle(a,entry->use.accept(LinkLibrary.shortText(entry)));
    }
    static void chooseBundle(Activity a,Consumer<JSONObject> use) {
        SortedMap<String,JSONObject> library=LinkLibrary.load(a);
        if(library.isEmpty()) {new AlertDialog.Builder(a).setMessage("ยังไม่มีชุดลิงก์ที่บันทึกไว้").setPositiveButton("ตกลง",null).show();return;}
        String[] names=library.keySet().toArray(new String[0]);
        new AlertDialog.Builder(a).setTitle("เลือกชุดลิงก์ที่บันทึกไว้").setItems(names,(d,which)->{
            JSONObject entry=library.get(names[which]);
            String text=LinkLibrary.shortText(entry);
            new AlertDialog.Builder(a).setTitle(names[which])
                    .setMessage("ต้นฉบับ:\n"+entry.optString("original_url")+"\n\nลิงก์ย่อ "+entry.optJSONArray("short_urls").length()
                            +" / "+entry.optInt("requested_count")+" รายการ:\n"+text)
                    .setNegativeButton("ปิด",null).setPositiveButton("ใช้ลิงก์ย่อชุดนี้",(dialog,b)->use.accept(entry)).show();
        }).setNegativeButton("ปิด",null).show();
    }
}
