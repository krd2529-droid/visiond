package com.smsmix.app;

import java.net.URI;
import java.util.*;

public final class CampaignCore {
    private CampaignCore() {}
    public static final int MAX_RECIPIENTS = 10000;
    public static final long MIN_DELAY = 10 * 60_000L;
    public static final long MAX_DELAY = 30 * 60_000L;

    public static List<String> lines(String value, boolean links) {
        List<String> result = new ArrayList<>();
        for (String line : value.split("\\R")) {
            String text = line.trim();
            if (text.isEmpty()) continue;
            if (text.length() > 1000) throw new IllegalArgumentException("แต่ละรายการยาวได้ไม่เกิน 1,000 ตัวอักษร");
            if (links) {
                try {
                    URI u = new URI(text);
                    if (!("https".equalsIgnoreCase(u.getScheme()) || "http".equalsIgnoreCase(u.getScheme()))
                            || u.getHost() == null || u.getUserInfo() != null)
                        throw new Exception();
                } catch (Exception e) {
                    throw new IllegalArgumentException("ลิงก์ไม่ถูกต้อง: " + text);
                }
            }
            result.add(text);
        }
        if (result.size() < 10 || result.size() > 100)
            throw new IllegalArgumentException((links ? "ลิงก์" : "แคปชั่น") + " ต้องมี 10–100 รายการ (บรรทัดละรายการ)");
        return result;
    }

    public static String normalizePhone(String raw) {
        String p = raw.trim().replaceAll("[\\s()\\-]", "");
        if (p.matches("0[689][0-9]{8}")) p = "+66" + p.substring(1);
        else if (p.matches("66[689][0-9]{8}")) p = "+" + p;
        if (!p.matches("\\+[1-9][0-9]{7,14}"))
            throw new IllegalArgumentException("เบอร์ไม่ถูกต้อง: " + raw);
        return p;
    }

    public static final class ImportResult {
        public final List<String> phones = new ArrayList<>();
        public final List<String> errors = new ArrayList<>();
        public int duplicates;
    }

    // RFC-style quotes and escaped quotes; first column is the phone number.
    static List<List<String>> csv(String text) {
        List<List<String>> rows = new ArrayList<>();
        List<String> row = new ArrayList<>();
        StringBuilder field = new StringBuilder();
        boolean quoted = false, closed = false;
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (quoted) {
                if (c == '"') {
                    if (i + 1 < text.length() && text.charAt(i + 1) == '"') { field.append('"'); i++; }
                    else { quoted = false; closed = true; }
                } else field.append(c);
            } else if (c == '"') {
                if (field.length() != 0 || closed) throw new IllegalArgumentException("รูปแบบ CSV ไม่ถูกต้อง");
                quoted = true;
            } else if (c == ',' || c == ';' || c == '\t' || c == '\n' || c == '\r') {
                row.add(field.toString()); field.setLength(0); closed = false;
                if (c == '\n' || c == '\r') {
                    rows.add(row); row = new ArrayList<>();
                    if (c == '\r' && i + 1 < text.length() && text.charAt(i + 1) == '\n') i++;
                }
            } else {
                if (closed && !Character.isWhitespace(c)) throw new IllegalArgumentException("รูปแบบ CSV ไม่ถูกต้อง");
                if (!closed) field.append(c);
            }
        }
        if (quoted) throw new IllegalArgumentException("เครื่องหมายคำพูดใน CSV ไม่ครบ");
        row.add(field.toString()); rows.add(row);
        return rows;
    }

    public static ImportResult importPhones(String text) {
        ImportResult out = new ImportResult();
        Set<String> seen = new LinkedHashSet<>();
        List<List<String>> rows = csv(text.replaceFirst("^\uFEFF", ""));
        int n = 0;
        for (List<String> row : rows) {
            n++;
            String raw = row.get(0).trim();
            if (raw.isEmpty()) continue;
            if (n == 1 && Arrays.asList("phone", "phone_number", "number", "เบอร์", "เบอร์โทร").contains(raw.toLowerCase(Locale.ROOT))) continue;
            try {
                String phone = normalizePhone(raw);
                if (!seen.add(phone)) out.duplicates++;
            } catch (IllegalArgumentException e) { out.errors.add("แถว " + n + ": " + raw); }
        }
        out.phones.addAll(seen);
        if (seen.size() > MAX_RECIPIENTS) throw new IllegalArgumentException("รองรับไม่เกิน 10,000 เบอร์ต่อรายการ");
        return out;
    }

    public static String pair(List<String> captions, List<String> links, Random random) {
        return captions.get(random.nextInt(captions.size())) + "\n" + links.get(random.nextInt(links.size()));
    }

    public static long delay(Random random) {
        return (10 + random.nextInt(21)) * 60_000L;
    }
}
