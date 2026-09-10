using System;
using System.Collections.Generic;
using System.IO;
public static class PairUrlHarness {
 public static void Main(){
  string id="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  var start=VisionDBrowserLauncher.LocalHelper.PairStartInfo(new Dictionary<string,object>{{"pair_id",id}});
  if(start.FileName!="https://visiondonline.com/launcher-pair#id="+id||!start.UseShellExecute||start.Arguments!="")throw new Exception("exact returned-id shell URL contract");
  foreach(string value in new[]{"",id.ToUpperInvariant(),id+"\n",id+"&evil=1",id+"#fragment","https://evil.test","00000000-0000-0000-0000-000000000000"}){
   bool rejected=false;try{VisionDBrowserLauncher.LocalHelper.PairStartInfo(new Dictionary<string,object>{{"pair_id",value}});}catch(InvalidDataException){rejected=true;}if(!rejected)throw new Exception("invalid returned id accepted");
  }
  Console.WriteLine("PASS actual native returned pair_id→clean canonical shell URL, strict rejection; no Process.Start/browser/config access");
 }
}
