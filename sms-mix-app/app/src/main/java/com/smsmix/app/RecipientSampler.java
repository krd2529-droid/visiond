package com.smsmix.app;

import java.util.*;

/** Sampling without replacement; no enumeration of the numeric phone range. */
final class RecipientSampler {
    static void count(int count, long available) {
        if (count < 1 || count > CampaignCore.MAX_RECIPIENTS)
            throw new IllegalArgumentException("จำนวนที่สุ่มต้องอยู่ระหว่าง 1–10,000 เบอร์");
        if (count > available)
            throw new IllegalArgumentException("เหลือเบอร์ที่ยังไม่เคยสุ่ม " + available + " เบอร์ กรุณาลดจำนวน");
    }

    static List<String> fromFile(List<String> phones, Set<String> used, int count, Random random) {
        Set<String> unique = new LinkedHashSet<>();
        for (String raw : phones) {
            String phone = CampaignCore.normalizePhone(raw);
            if (!used.contains(phone)) unique.add(phone);
        }
        List<String> available = new ArrayList<>(unique);
        count(count, available.size());
        for (int i = 0; i < count; i++)
            Collections.swap(available, i, i + random.nextInt(available.size() - i));
        return new ArrayList<>(available.subList(0, count));
    }

    static final class Range {
        final long start, end;
        final int width;
        Range(String first, String last) {
            String a = CampaignCore.normalizePhone(first), b = CampaignCore.normalizePhone(last);
            if (a.length() != b.length())
                throw new IllegalArgumentException("เบอร์เริ่มต้นและสิ้นสุดต้องมีจำนวนหลักเท่ากัน");
            // Thai mobile ranges must not cross gaps such as the 07 prefix.
            if ((a.startsWith("+66") || b.startsWith("+66")) &&
                    (!a.matches("[+]66[689][0-9]{8}") || !b.matches("[+]66[689][0-9]{8}") ||
                            !a.substring(0,4).equals(b.substring(0,4))))
                throw new IllegalArgumentException("ช่วงเบอร์ไทยต้องอยู่ในกลุ่ม 06, 08 หรือ 09 เดียวกัน");
            start = Long.parseLong(a.substring(1)); end = Long.parseLong(b.substring(1));
            width = a.length();
            if (start > end) throw new IllegalArgumentException("เบอร์เริ่มต้นต้องไม่มากกว่าเบอร์สิ้นสุด");
        }
        List<Long> blocked(Set<String> used) {
            List<Long> blocked = new ArrayList<>();
            for (String phone : used) {
                if (phone.length() != width) continue;
                long value = Long.parseLong(phone.substring(1));
                if (value >= start && value <= end) blocked.add(value);
            }
            Collections.sort(blocked);
            return blocked;
        }
    }

    static int upperBound(List<Long> sorted, long value) {
        int low = 0, high = sorted.size();
        while (low < high) {
            int mid = (low + high) >>> 1;
            if (sorted.get(mid) <= value) low = mid + 1; else high = mid;
        }
        return low;
    }

    // Map a zero-based rank among unused numbers back to a phone number.
    static long atRank(Range r, List<Long> blocked, long rank) {
        long low = r.start, high = r.end;
        while (low < high) {
            long mid = low + (high - low) / 2;
            long freeThroughMid = mid - r.start + 1 - upperBound(blocked, mid);
            if (freeThroughMid > rank) high = mid; else low = mid + 1;
        }
        return low;
    }

    static long nextLong(Random random, long bound) {
        long bits, value;
        do {
            bits = random.nextLong() >>> 1;
            value = bits % bound;
        } while (bits - value + (bound - 1) < 0);
        return value;
    }

    static List<String> fromRange(String first, String last, Set<String> used, int count, Random random) {
        Range range = new Range(first, last);
        List<Long> blocked = range.blocked(used);
        long remaining = range.end - range.start + 1 - blocked.size();
        count(count, remaining);
        // Sparse Fisher-Yates: O(count) storage even for a trillion-number interval.
        Map<Long, Long> swaps = new HashMap<>();
        List<String> result = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            long chosen = nextLong(random, remaining);
            long rank = swaps.getOrDefault(chosen, chosen);
            long tail = remaining - 1;
            swaps.put(chosen, swaps.getOrDefault(tail, tail));
            swaps.remove(tail);
            remaining--;
            result.add("+" + atRank(range, blocked, rank));
        }
        return result;
    }
}
