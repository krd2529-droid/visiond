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
            case "UNKNOWN":return "ไม่ทราบผล";
            default:return s;
        }
    }
    static String time(long value){return value>0?DateFormat.getDateTimeInstance().format(new Date(value)):"—";}
    static String line(JSONObject row){
        String text=row.optString("phone")+" • "+name(row.optString("status"));
        String simLabel=row.optString("usedSimLabel",row.optString("simLabel"));
        if(!simLabel.isEmpty())text+=" • "+simLabel;
        if(row.optLong("sentAt")>0)text+="\nส่งเมื่อ "+time(row.optLong("sentAt"));
        if(row.optLong("resultAt")>0)text+="\nทราบผล "+time(row.optLong("resultAt"));
        if("SENT".equals(row.optString("status")))text+="\n"+delivery(row);
        return text;
    }
    static String delivery(JSONObject row){
        return row.optLong("deliveredAt")>0 ? "ถึงเครื่องผู้รับแล้ว • "+time(row.optLong("deliveredAt")) : "ยังไม่ยืนยันการรับ";
    }
    static String detail(JSONObject row){
        return line(row)+"\n\n"+row.optString("body")+
                (row.optString("error").isEmpty()?"":"\n\n"+row.optString("error"));
    }
}
