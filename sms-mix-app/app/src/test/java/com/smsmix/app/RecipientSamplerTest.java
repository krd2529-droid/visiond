package com.smsmix.app;

import org.junit.Test;
import java.util.*;
import static org.junit.Assert.*;

public class RecipientSamplerTest {
    String phone(int n) { return "+6680000000" + n; }

    @Test public void allDenseAndSparseExclusionsAreSampledExactlyOnce() {
        for (int mask = 0; mask < 32; mask++) {
            Set<String> used = new HashSet<>(), expected = new HashSet<>();
            for (int i = 0; i < 5; i++) {
                if ((mask & (1 << i)) != 0) used.add(phone(i)); else expected.add(phone(i));
            }
            if (expected.isEmpty()) {
                assertThrows(IllegalArgumentException.class, () ->
                        RecipientSampler.fromRange("0800000000", "0800000004", used, 1, new Random(1)));
                continue;
            }
            for (int seed = 0; seed < 30; seed++) {
                List<String> got = RecipientSampler.fromRange("0800000000", "0800000004", used, expected.size(), new Random(seed));
                assertEquals(expected.size(), got.size()); assertEquals(expected, new HashSet<>(got));
            }
        }
    }

    @Test public void fileNormalizesDeduplicatesAndExcludesHistory() {
        List<String> got = RecipientSampler.fromFile(Arrays.asList("0800000000", phone(0), "0800000001", "0800000002"),
                Set.of(phone(1)), 2, new Random(1));
        assertEquals(Set.of(phone(0), phone(2)), new HashSet<>(got));
        assertThrows(IllegalArgumentException.class, () ->
                RecipientSampler.fromFile(Arrays.asList(phone(0), phone(0)), Set.of(), 2, new Random()));
    }

    @Test public void overlappingRangesExcludeEarlierDraws() {
        Set<String> used = new HashSet<>(RecipientSampler.fromRange(phone(0), phone(4), Set.of(), 5, new Random(1)));
        List<String> next = RecipientSampler.fromRange(phone(2), phone(7), used, 3, new Random(2));
        assertEquals(Set.of(phone(5), phone(6), phone(7)), new HashSet<>(next));
    }

    @Test public void equalEndpointAndBadInputs() {
        assertEquals(List.of(phone(0)), RecipientSampler.fromRange("0800000000", phone(0), Set.of(), 1, new Random()));
        assertThrows(IllegalArgumentException.class, () -> new RecipientSampler.Range(phone(2), phone(0)));
        assertThrows(IllegalArgumentException.class, () -> new RecipientSampler.Range("0600000000", "0800000000"));
        assertThrows(IllegalArgumentException.class, () -> new RecipientSampler.Range("+12345678", "+123456789"));
        assertThrows(IllegalArgumentException.class, () -> new RecipientSampler.Range("bad", phone(0)));
        assertThrows(IllegalArgumentException.class, () -> RecipientSampler.count(0, 5));
        assertThrows(IllegalArgumentException.class, () -> RecipientSampler.count(10001, 20000));
        assertThrows(IllegalArgumentException.class, () -> RecipientSampler.count(6, 5));
    }

    @Test(timeout = 5000) public void hugeRangeUsesBoundedMemoryAndKeepsAllDigits() {
        Set<String> used = Set.of("+100000000000000", "+999999999999999");
        List<String> got = RecipientSampler.fromRange("+100000000000000", "+999999999999999", used, 10000, new Random(3));
        assertEquals(10000, new HashSet<>(got).size());
        for (String p : got) { assertEquals(16, p.length()); assertFalse(used.contains(p)); }
    }

    @Test public void samplingActuallyChangesOrderAcrossSeeds() {
        Set<List<String>> orders = new HashSet<>();
        for (int i = 0; i < 50; i++)
            orders.add(RecipientSampler.fromRange(phone(0), phone(4), Set.of(), 5, new Random(i)));
        assertTrue(orders.size() > 20);
    }
}
