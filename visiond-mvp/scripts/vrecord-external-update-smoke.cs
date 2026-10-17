using System;
using System.IO;

class ExternalUpdateSmoke {
 static void Check(bool value,string message){if(!value)throw new Exception(message);}
 static int Main(string[] args){
  try {
   string root=args[0], stage=args[1], key=File.ReadAllText(args[2]);
   string engine=Path.Combine(root,"tools","ffmpeg.exe");
   string hash=UpdateProtocol.Hash(engine), before=File.ReadAllText(Path.Combine(root,"README.txt"));
   Check(!UpdateInstaller.Apply(root,stage,key,"0.6.1",nonce=>false),"failed update did not roll back");
   Check(UpdateProtocol.Hash(engine)==hash,"rollback changed external engine");
   Check(File.ReadAllText(Path.Combine(root,"README.txt"))==before,"rollback changed app files");
   Check(UpdateInstaller.Apply(root,stage,key,"0.6.1",nonce=>true),"update did not apply");
   Check(UpdateProtocol.Hash(engine)==hash,"update changed external engine");
   Check(File.ReadAllText(Path.Combine(root,"README.txt"))!=before,"new app files not installed");
   PackageIntegrity.Verify(root,key);
   File.AppendAllText(Path.Combine(stage,"README.txt"),"tampered");
   bool denied=false;try{PackageIntegrity.Verify(stage,key);}catch(InvalidOperationException){denied=true;}
   Check(denied,"tampered update accepted");
   Console.WriteLine("PASS update and rollback preserve external engine; tampered app denied");
   return 0;
  }catch(Exception error){Console.Error.WriteLine(error);return 1;}
 }
}
