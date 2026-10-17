package com.smsmix.app;
import org.json.JSONObject;
import java.text.DateFormat;
import java.util.Date;

final class SendStatus {
    static String name(String s){
        switch(s){
            case "PENDING":return "รอส่ง";
            case "SENDING":return "รอผลจากระบบ";
            case "SENT":return "ส่งสำเร็จ";
            case "FAILED":return "ส่งไม่สำเร็จ / บางส่วน";
            case "SKIPPED":return "ข้าม: ซิมไม่พร้อม ไม่ได้ส่ง";
            case "CANCELLED":return "ไม่ได้ส่ง: คิวถูกแทนที่";
            case "UNKNOWN":return "ไม่ทราบผล";
            default:return s;
        }
    }
    static String time(long value){return value>0?DateFormat.getDateTimeInstance().format(new Date(value)):"—";}
    static String line(JSONObject row){
        String text=row.optString("phone")+" • "+name(row.optString("status"));
        String simLabel=row.optString("usedSimLabel",row.optString("simLabel"));
        if(!simLabel.isEmpty())text+=" • "+simLabel;
        String preview=row.optBoolean("bodyUnavailable") ? "ไม่มีเนื้อหาที่บันทึกไว้ในเวอร์ชันเดิม"
                : row.optString("body").replace('\n',' ').replace('\r',' ').trim();
        if(preview.length()>80)preview=preview.substring(0,80)+"…";
        text+="\nข้อความ: "+preview;
        if(row.optLong("sentAt")>0)text+="\nเริ่มส่ง "+time(row.optLong("sentAt"));
        if(row.optLong("resultAt")>0){
            String status=row.optString("status");
            String label="SENT".equals(status)||"FAILED".equals(status) ? "ทราบผลส่ง " : "อัปเดตสถานะ ";
            text+="\n"+label+time(row.optLong("resultAt"));
        }
        if("SENT".equals(row.optString("status")) || row.optLong("deliveredAt")>0)text+="\n"+delivery(row);
        return text;
    }
    static String delivery(JSONObject row){
        return row.optLong("deliveredAt")>0 ? "มีรายงานถึงเครื่องผู้รับ • "+time(row.optLong("deliveredAt")) : "ยังไม่มีรายงานยืนยันถึงเครื่อง";
    }
    static String detail(JSONObject row){
        return line(row)+"\nสถานะเปิดอ่าน: ตรวจสอบไม่ได้สำหรับ SMS ทั่วไป\n\nข้อความ:\n"
                +(row.optBoolean("bodyUnavailable") ? "ไม่มีเนื้อหาที่บันทึกไว้ในเวอร์ชันเดิม" : row.optString("body"))+
                (row.optString("error").isEmpty()?"":"\n\n"+row.optString("error"));
    }
}
