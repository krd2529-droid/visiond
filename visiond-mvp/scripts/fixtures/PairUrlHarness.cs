using System;
using System.Collections.Generic;
using System.IO;
public static class PairUrlHarness {
 public static void Main(){
  const string uri="visiond-profile://setup/pair";
  if(!VisionDBrowserLauncher.Program.IsSetupPairUri(uri))throw new Exception("literal setup verb rejected");
  foreach(string value in new[]{"",uri.ToUpperInvariant(),uri+"\n",uri+"?code=123",uri+"#fragment",uri+"/","https://evil.test"})
   if(VisionDBrowserLauncher.Program.IsSetupPairUri(value))throw new Exception("noncanonical setup verb accepted");
  Console.WriteLine("PASS actual native exact setup verb and hostile rejection; no Process.Start/browser/config access (v75 supersedes website shell URL)");
 }
}
