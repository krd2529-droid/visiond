package com.smsmix.app;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import java.io.*;
import java.util.*;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk=28)
public class ShortLinkClientTest {
    static JSONObject request(int n) {return ShortLinkClient.request("https://example.com/a?x=1&y=2",n);}
    static JSONObject item(JSONObject request,int i) {
        JSONObject sent=request.optJSONArray("urls").optJSONObject(i), out=Store.object();
        Store.put(out,"slug",sent.optString("slug")); Store.put(out,"original_url",sent.optString("original_url"));
        Store.put(out,"short_url","https://g.shrinkrl.com/"+sent.optString("slug")); return out;
    }
    static String response(JSONArray items) {
        JSONObject out=Store.object(); Store.put(out,"status","completed"); Store.put(out,"urls",items); return out.toString();
    }
    @Test public void generatesRequestedUniqueSlugsAndSameOriginal() {
        JSONObject r=request(100); Set<String> slugs=new HashSet<>();
        for(int i=0;i<100;i++) {
            JSONObject row=r.optJSONArray("urls").optJSONObject(i);
            assertEquals("https://example.com/a?x=1&y=2",row.optString("original_url"));
            assertTrue(row.optString("slug").matches("[A-Za-z0-9_-]{20}")); slugs.add(row.optString("slug"));
        }
        assertEquals(100,slugs.size()); assertEquals(1,request(1).optJSONArray("urls").length());
    }
    @Test public void rejectsInvalidInputs() {
        for(String u:List.of("javascript:alert(1)","https://","https://user:pass@example.com","bad"))
            assertThrows(IllegalArgumentException.class,()->ShortLinkClient.request(u,10));
        assertThrows(IllegalArgumentException.class,()->request(0));
        assertThrows(IllegalArgumentException.class,()->request(101));
    }
    @Test public void parserRejectsMismatchesAndDeduplicates() throws Exception {
        JSONObject r=request(3), good=item(r,0), wrong=item(r,1), hostile=item(r,2);
        Store.put(wrong,"original_url","https://other.example/");
        Store.put(hostile,"short_url","https://evil.example/"+hostile.optString("slug"));
        List<String> found=ShortLinkClient.parse(r,response(new JSONArray().put(good).put(good).put(wrong).put(hostile)));
        assertEquals(List.of(good.optString("short_url")),found);
    }
    @Test public void malformedOrAsyncResponseIsNotSuccess() {
        assertThrows(IOException.class,()->ShortLinkClient.parse(request(1),"not json"));
        assertThrows(IOException.class,()->ShortLinkClient.parse(request(1),"{\"status\":\"processing\"}"));
        assertThrows(IOException.class,()->ShortLinkClient.parse(request(1),"{\"status\":\"completed\"}"));
    }
    @Test public void recoversBulkCollisionResultsUsingVerifiedLookup() throws Exception {
        JSONObject r=request(2); Map<String,String> records=new HashMap<>();
        for(int i=0;i<2;i++) {JSONObject item=item(r,i);records.put(item.optString("slug"),item.toString());}
        List<String> found=ShortLinkClient.resolve(r,response(new JSONArray()),records::get);
        assertEquals(2,found.size()); assertEquals(2,new HashSet<>(found).size());
    }
    @Test public void interruptedRecoveryPreservesConfirmedResultsAndStopsRequests() throws Exception {
        JSONObject r=request(3); int[] calls={0};
        List<String> found=ShortLinkClient.resolve(r,response(new JSONArray().put(item(r,0))),slug->{
            calls[0]++;throw new IOException("HTTP 429");
        });
        assertEquals(1,found.size());assertEquals(1,calls[0]);
    }
    @Test public void wrongDestinationAndMissingLookupNeverInventLinks() throws Exception {
        JSONObject r=request(2); JSONObject wrong=item(r,0);Store.put(wrong,"original_url","https://other.example");
        List<String> found=ShortLinkClient.resolve(r,response(new JSONArray()),slug->
                slug.equals(wrong.optString("slug"))?wrong.toString():null);
        assertTrue(found.isEmpty());
    }
}
