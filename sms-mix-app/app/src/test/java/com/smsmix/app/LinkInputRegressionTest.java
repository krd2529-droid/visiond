package com.smsmix.app;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk=28)
public class LinkInputRegressionTest {
    @Test public void blankOriginalWithValidPastedLinksSavesAndReloads() {
        var c=RuntimeEnvironment.getApplication(); LinkLibrary.file(c).delete();
        String pasted="https://g.shrinkrl.com/yAYGL9\nhttps://g.shrinkrl.com/ps0RyP";
        JSONObject entry=LinkLibrary.manual("",pasted);
        LinkLibrary.save(c,"จากมือถือ",entry,false);
        assertEquals("",LinkLibrary.load(c).get("จากมือถือ").optString("original_url"));
        assertEquals(pasted,LinkLibrary.shortText(LinkLibrary.load(c).get("จากมือถือ")));
    }
    @Test public void schemeFreeLinksSurviveSaveAndQueueValidation() {
        StringBuilder text=new StringBuilder();
        for(int i=0;i<10;i++){if(i>0)text.append('\n');text.append("g.shrinkrl.com/link").append(i);}
        JSONObject entry=LinkLibrary.manual("ต้นฉบับตามที่กรอก",text.toString());
        assertEquals(text.toString(),LinkLibrary.shortText(entry));
        assertEquals(10,CampaignCore.lines(LinkLibrary.shortText(entry),true).size());
    }
}
