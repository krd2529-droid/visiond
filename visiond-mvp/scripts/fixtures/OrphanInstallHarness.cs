using System;using System.IO;using System.Diagnostics;using System.Net;using System.Net.Sockets;using System.Reflection;using System.Collections.Generic;
public static class OrphanInstallHarness {
 static List<Process> children=new List<Process>();public static bool FailRegistration;
 public static void Track(Process p,string arg){if(arg=="--serve")try{children.Add(Process.GetProcessById(p.Id));}catch(ArgumentException){}}
 public static bool HasService(){foreach(var p in children){p.Refresh();if(!p.HasExited)return true;}return false;}
 public static void StopService(){foreach(var p in children){p.Refresh();if(!p.HasExited){p.Kill();if(!p.WaitForExit(5000))throw new Exception("test child did not stop");}}}
 public static void AfterRegistration(){if(FailRegistration){FailRegistration=false;throw new InvalidOperationException("injected registration failure");}}
 static Type S=typeof(VisionDBrowserLauncher.Setup);
 static object Call(string method,params object[] args){try{return S.GetMethod(method,BindingFlags.Static|BindingFlags.NonPublic|BindingFlags.Public).Invoke(null,args);}catch(TargetInvocationException e){throw e.InnerException;}}
 static string Field(string name){return (string)S.GetField(name,BindingFlags.NonPublic|BindingFlags.Static).GetValue(null);}
 public static int Main(string[] args){if(args.Length>0){if(args[0]=="--init")return VisionDBrowserLauncher.LocalHelper.Initialize();if(args[0]=="--serve")return VisionDBrowserLauncher.LocalHelper.Serve();return 2;}
  string root=Field("Root"),exe=Field("Exe"),owner=Field("Owner");Directory.CreateDirectory(root);VisionDBrowserLauncher.LocalHelper.Initialize();int port=VisionDBrowserLauncher.LocalHelper.ConfiguredPort();string config=Path.Combine(root,"Transport","helper.dpapi"),configHash=VisionDBrowserLauncher.Setup.Hash(config);string profile=Path.Combine(root,"Profiles","preserved-fixture");Directory.CreateDirectory(profile);File.WriteAllText(Path.Combine(profile,"sentinel"),"preserve");
  Action oldImage=()=>{File.Copy(Process.GetCurrentProcess().MainModule.FileName,exe,true);using(var f=new FileStream(exe,FileMode.Append))f.WriteByte(1);File.WriteAllLines(owner,new[]{"VisionD Browser Launcher v1","sha256="+VisionDBrowserLauncher.Setup.Hash(exe)});};oldImage();var undo=new List<Action>();Call("WriteRegistration",undo);
  try{
   // Real bind failure in candidate child, while unrelated test listener stays alive.
   var occupied=new TcpListener(IPAddress.Loopback,port);occupied.ExclusiveAddressUse=true;occupied.Start();try{Call("Install");if(!VisionDBrowserLauncher.Setup.NeedsRepair||VisionDBrowserLauncher.Setup.Hash(exe)!=VisionDBrowserLauncher.Setup.Hash(Process.GetCurrentProcess().MainModule.FileName)||HasService())throw new Exception("degraded install did not retain new owned image/not-ready");if(VisionDBrowserLauncher.LocalHelper.PortAvailable(port))throw new Exception("foreign test listener disturbed");}finally{occupied.Stop();}
   if(VisionDBrowserLauncher.Setup.Hash(config)!=configHash||!File.Exists(Path.Combine(profile,"sentinel")))throw new Exception("degraded install changed config/profile");
   // Normal owned update must start exact configured port; only tracked child is stopped.
   oldImage();Call("Install");if(VisionDBrowserLauncher.Setup.NeedsRepair||!HasService())throw new Exception("normal update not ready");StopService();
   // Registration failure restores old executable/marker and leaves stopped state stopped.
   oldImage();string oldHash=VisionDBrowserLauncher.Setup.Hash(exe),oldMarker=File.ReadAllText(owner);FailRegistration=true;bool failed=false;try{Call("Install");}catch(InvalidOperationException e){failed=e.Message.Contains("injected");}if(!failed||VisionDBrowserLauncher.Setup.Hash(exe)!=oldHash||File.ReadAllText(owner)!=oldMarker||HasService()||VisionDBrowserLauncher.Setup.Hash(config)!=configHash)throw new Exception("rollback state mismatch");
   Console.WriteLine("PASS actual isolated Install normal/degraded occupied-port/registration-failure rollback, owned image+marker/config/profile preserved; registry is memory-only");
  }finally{StopService();foreach(var p in children)p.Dispose();}return 0;
 }
}
