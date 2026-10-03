package com.smsmix.app;
import java.util.*;

public class CoreTest {
    static int checks;
    static void check(boolean ok, String why) {
        checks++; if (!ok) throw new AssertionError(why);
    }
    static void rejects(Runnable r, String why) {
        try { r.run(); } catch (IllegalArgumentException expected) { checks++; return; }
        throw new AssertionError(why);
    }
    static String pool(int n, boolean link) {
        List<String> values = new ArrayList<>();
        for(int i=0;i<n;i++) values.add(link ? "https://example.com/" + i : "แคปชั่น " + i);
        return String.join("\n", values);
    }
    public static void main(String[] args) {
        for (boolean links : new boolean[]{true,false}) {
            check(CampaignCore.lines(pool(10,links),links).size()==10,"minimum");
            check(CampaignCore.lines(pool(100,links),links).size()==100,"maximum");
            rejects(() -> CampaignCore.lines(pool(9,links),links),"reject 9");
            rejects(() -> CampaignCore.lines(pool(101,links),links),"reject 101");
            rejects(() -> CampaignCore.lines("",links),"reject empty");
        }
        rejects(() -> CampaignCore.lines(pool(10,true)+"\njavascript:alert(1)",true),"scheme");
        rejects(() -> CampaignCore.lines(pool(10,true)+"\nhttps://",true),"missing host");
        rejects(() -> CampaignCore.lines(pool(10,true)+"\nhttps://user:pass@example.com",true),"credentials");
        check(CampaignCore.normalizePhone("081-234-5678").equals("+66812345678"),"Thai");
        check(CampaignCore.normalizePhone("66812345678").equals("+66812345678"),"Thai country prefix");
        check(CampaignCore.normalizePhone("+1 (202) 555-0123").equals("+12025550123"),"international");
        rejects(() -> CampaignCore.normalizePhone("8.123E9"),"spreadsheet notation");
        rejects(() -> CampaignCore.normalizePhone("812345678"),"missing leading zero");
        rejects(() -> CampaignCore.normalizePhone("123"),"short");
        CampaignCore.ImportResult imported = CampaignCore.importPhones("\uFEFFphone,name\r\n\"0812345678\",\"A, B\"\r\n+66812345678,Duplicate\r\n0891234567,Name");
        check(imported.phones.size()==2,"csv count");
        check(imported.duplicates==1,"normalization dedup");
        check(imported.errors.isEmpty(),"valid csv");
        check(CampaignCore.importPhones("phone\ninvalid").errors.size()==1,"invalid rows");
        check(CampaignCore.importPhones("0812345678\n\n0891234567").phones.size()==2,"txt");
        rejects(() -> CampaignCore.importPhones("\"0812345678"),"unclosed quote");
        List<String> captions = CampaignCore.lines(pool(10,false),false);
        List<String> links = CampaignCore.lines(pool(100,true),true);
        Random random = new Random(7); Set<Long> delays = new HashSet<>();
        Set<String> pairs = new HashSet<>();
        for(int i=0;i<10000;i++) {
            long d = CampaignCore.delay(random); delays.add(d);
            check(d>=600000L && d<=1800000L,"delay bounds");
            String p = CampaignCore.pair(captions,links,random); pairs.add(p);
            String[] parts=p.split("\n");
            check(parts.length==2 && captions.contains(parts[0]) && links.contains(parts[1]),"pair membership");
        }
        check(delays.size()==21,"all minute delays");
        check(pairs.size()>900,"independent pairing");
        System.out.println("PASS " + checks + " checks");
    }
}
