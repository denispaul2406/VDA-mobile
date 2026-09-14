package in.gov.abdm.vdahealth;

import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Opens the official eSanjeevani patient sign-in page in an external browser. */
@CapacitorPlugin(name = "EsanjeevaniLauncher")
public class EsanjeevaniLauncherPlugin extends Plugin {
    private static final String OFFICIAL_URL = "https://esanjeevani.mohfw.gov.in/#/patient/signin";

    @PluginMethod
    public void open(PluginCall call) {
        Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(OFFICIAL_URL));
        getActivity().startActivity(browserIntent);
        call.resolve();
    }
}
