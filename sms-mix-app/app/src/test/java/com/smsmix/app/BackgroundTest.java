package com.smsmix.app;
import android.app.*;
import android.content.*;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.*;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=28)
public class BackgroundTest {
    QueueTest fixture;
    @Before public void setup(){fixture=new QueueTest();fixture.setup();fixture.allowSim();}
    JSONObject queue(boolean running){
        JSONObject d=fixture.queue("PENDING",1,running);Store.put(d,"sim",7);Store.save(fixture.c,d);return d;
    }
    @Test public void restartedServiceRestoresAlarmWithoutSendingImmediately(){
        JSONObject d=queue(true);
        var ctl=Robolectric.buildService(CampaignService.class).create();
        assertEquals(Service.START_STICKY,ctl.get().onStartCommand(null,0,1));
        var alarm=Shadows.shadowOf(fixture.c.getSystemService(AlarmManager.class)).peekNextScheduledAlarm();
        assertEquals(d.optLong("nextAt"),alarm.getTriggerAtMs());
        assertEquals("PENDING",fixture.status());
        assertNull(Shadows.shadowOf(Scheduler.sms(7)).getLastSentTextMessageParams());
        ctl.destroy();
    }
    @Test public void pausedServiceDoesNotResume(){
        queue(false);var ctl=Robolectric.buildService(CampaignService.class).create();
        assertEquals(Service.START_NOT_STICKY,ctl.get().onStartCommand(null,0,1));
        assertFalse(Store.load(fixture.c).optBoolean("running"));ctl.destroy();
    }
    @Test public void stopActionCancelsFutureSendAndIgnoresStaleCampaign(){
        JSONObject d=queue(true);Scheduler.alarm(fixture.c,d,d.optLong("nextAt"),false);
        StopCampaignReceiver receiver=new StopCampaignReceiver();
        receiver.onReceive(fixture.c,new Intent().putExtra("id","old"));
        assertTrue(Store.load(fixture.c).optBoolean("running"));
        receiver.onReceive(fixture.c,new Intent().putExtra("id",d.optString("id")));
        assertFalse(Store.load(fixture.c).optBoolean("running"));
        assertNull(Shadows.shadowOf(fixture.c.getSystemService(AlarmManager.class)).peekNextScheduledAlarm());
        Scheduler.tick(fixture.c,d.optString("id"),false);assertEquals("PENDING",fixture.status());
    }
    @Test public void successDetailsContainNumberAndTime(){
        fixture.queue("SENDING",1,false);Scheduler.result(fixture.c,fixture.callback(0),Activity.RESULT_OK);
        String line=SendStatus.line(Store.rows(Store.load(fixture.c)).optJSONObject(0));
        assertTrue(line.contains("+66800000000"));assertTrue(line.contains("ส่งสำเร็จ"));assertTrue(line.contains("ทราบผล"));
        try(var ctl=Robolectric.buildActivity(SendStatusActivity.class).setup()){assertNotNull(ctl.get());}
    }
}
