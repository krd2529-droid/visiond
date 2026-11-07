using System;
using VisionDBrowserLauncher;
internal static class PairIntentUriHarness {
 static int Main(){
  const string id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";string found;
  foreach(string uri in new[]{"visiond-helper-pair://setup/pair?intent="+id,"visiond-helper-pair://setup/pair/?intent="+id,"visiond-profile://setup/pair?intent="+id})
   if(!Program.TrySetupPairIntentUri(uri,out found)||found!=id)return 1;
  foreach(string uri in new[]{"visiond-helper-pair://setup/pair","visiond-helper-pair://open?intent="+id,"visiond-helper-pair://evil/pair?intent="+id,"visiond-helper-pair://setup/pair?intent="+id+"&other=1","visiond-helper-pair://setup/pair?intent="+id+"#x","visiond-helper-pair://setup/pair?intent="+id.ToUpperInvariant(),"visiond-helper-pair://setup/pair?intent=%61"+id.Substring(1),"visiond-helper-pair://setup/pair?intent="+id+"/","visiond-profile://evil/pair?intent="+id})
   if(Program.TrySetupPairIntentUri(uri,out found))return 2;
  LaunchRequest request;if(Program.IsSetupPairUri("visiond-helper-pair://setup/pair")||Program.TryParse("visiond-helper-pair://open?mode=new&slot_id="+id,out request))return 5;
  if(!Setup.ShouldAutoInstall(@"C:\Downloads\VisionD-Helper-Setup.exe",@"C:\Users\User\VisionDBrowserLauncher.exe"))return 3;
  if(Setup.ShouldAutoInstall(@"C:\Users\User\VisionDBrowserLauncher.exe",@"c:\users\user\VisionDBrowserLauncher.exe"))return 4;
  Console.WriteLine("PASS strict native same-browser pair intent URI parser");return 0;
 }
}
