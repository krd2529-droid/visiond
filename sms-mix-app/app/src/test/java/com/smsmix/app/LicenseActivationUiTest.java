package com.smsmix.app;

import android.os.Looper;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.Shadows;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28)
public class LicenseActivationUiTest {
    @Test public void serverFailuresAreActionableWithoutExposingKeyExistence() {
        assertEquals(LicenseClient.ActivationResult.INVALID_FORMAT,
                LicenseClient.ActivationResult.fromHttpStatus(400));
        assertEquals(LicenseClient.ActivationResult.NOT_ELIGIBLE,
                LicenseClient.ActivationResult.fromHttpStatus(403));
        assertEquals(LicenseClient.ActivationResult.BOUND_OTHER_DEVICE,
                LicenseClient.ActivationResult.fromHttpStatus(409));
        assertTrue(LicenseClient.ActivationResult.BOUND_OTHER_DEVICE.message().contains("เครื่องอื่น"));
        assertEquals(LicenseClient.ActivationResult.RATE_LIMITED,
                LicenseClient.ActivationResult.fromHttpStatus(429));
        assertEquals(LicenseClient.ActivationResult.UNAVAILABLE,
                LicenseClient.ActivationResult.fromHttpStatus(503));
        assertTrue(LicenseClient.ActivationResult.NOT_ELIGIBLE.message().contains("VSMS"));
        assertFalse(LicenseClient.ActivationResult.NOT_ELIGIBLE.message().contains("มีคีย์นี้"));
    }

    @Test public void malformedKeyShowsActionableFormatErrorWithoutNetwork() throws Exception {
        try (var controller = Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity activity = controller.get();
            LinearLayout gate = (LinearLayout)((android.view.ViewGroup)activity.findViewById(android.R.id.content)).getChildAt(0);
            TextView state = (TextView)gate.getChildAt(1);
            EditText input = (EditText)gate.getChildAt(2);
            Button activate = (Button)gate.getChildAt(3);
            input.setText("short");
            activate.performClick();
            for (int i = 0; i < 50 && !activate.isEnabled(); i++) {
                Thread.sleep(20);
                Shadows.shadowOf(Looper.getMainLooper()).idle();
            }
            assertTrue("activation call completed", activate.isEnabled());
            assertTrue("format guidance shown: " + state.getText(),
                    state.getText().toString().contains("รูปแบบคีย์"));
        }
    }
}
