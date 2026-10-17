using System;
using System.IO;

class LicenseEnvelope {public string payload{get;set;}public string signature{get;set;}}

class ExternalPackageSmoke {
 static void Check(bool value,string message){if(!value)throw new Exception(message);}
 static int Main(string[] args){
  try {
   string root=args[0], key=File.ReadAllText(args[1]), engine=Path.Combine(root,"tools","ffmpeg.exe");
   PackageIntegrity.Verify(root,key);
   string setup=Path.Combine(root,"Install-FFmpeg.ps1"), original=File.ReadAllText(setup);
   File.AppendAllText(setup,"\ntampered");
   bool blocked=false;try{PackageIntegrity.Verify(root,key);}catch(InvalidOperationException){blocked=true;}
   Check(blocked,"tampered setup script accepted");
   File.WriteAllText(setup,original);
   PackageIntegrity.Verify(root,key);
   if(args.Length>2&&args[2]=="installed"){
    Check(ExternalEngine.Ready(engine),"verified publisher engine rejected");
    Console.WriteLine("PASS signed app with publisher-installed engine");
   }else{
    Check(!ExternalEngine.Ready(engine),"missing engine accepted");
    Directory.CreateDirectory(Path.GetDirectoryName(engine));
    File.WriteAllText(engine,"wrong engine");
    Check(!ExternalEngine.Ready(engine),"wrong engine accepted");
    File.Delete(engine);
    Console.WriteLine("PASS signed app without engine; missing and wrong engine rejected");
   }
   return 0;
  } catch(Exception error){Console.Error.WriteLine(error);return 1;}
 }
}
