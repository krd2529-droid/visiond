using System;
using System.IO;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Management;
using System.Collections.Generic;
using System.Windows.Forms;
using System.Net;
using Microsoft.Win32;
[assembly:System.Reflection.AssemblyVersion("0.20.86.0")]
[assembly:System.Reflection.AssemblyFileVersion("0.20.86.0")]
[assembly:System.Reflection.AssemblyProduct("VisionD Helper")]

namespace VisionDBrowserLauncher {
 internal static class Setup {
  internal const string Version="0.20.86";
  private const string Marker="VisionD Browser Launcher v1";
  private static readonly string Root=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"VisionD","BrowserLauncher");
  private static readonly string Exe=Path.Combine(Root,"VisionDBrowserLauncher-"+Version+".exe");
  private static readonly string PreviousExe=Path.Combine(Root,"VisionDBrowserLauncher-0.20.85.exe");
  private static readonly string LegacyExe=Path.Combine(Root,"VisionDBrowserLauncher.exe");
  private static readonly string Owner=Path.Combine(Root,"owner.txt");
  private const string RunKey=@"Software\Microsoft\Windows\CurrentVersion\Run",ProtocolKey=@"Software\Classes\visiond-profile",PairProtocolKey=@"Software\Classes\visiond-helper-pair",UninstallKey=@"Software\Microsoft\Windows\CurrentVersion\Uninstall\VisionDHelper";
  private static void RunExclusive(Action action){
   string sid=System.Security.Principal.WindowsIdentity.GetCurrent().User.Value;
   using(var mutex=new System.Threading.Mutex(false,"Global\\VisionDHelperSetup-"+sid)){
    bool acquired=false;try{try{acquired=mutex.WaitOne(0);}catch(System.Threading.AbandonedMutexException){acquired=true;}if(!acquired)throw new InvalidOperationException("มีตัวติดตั้ง VisionD อีกหน้าต่างกำลังทำงาน กรุณาปิดหรือรอหน้าต่างนั้นก่อน");action();}finally{if(acquired)mutex.ReleaseMutex();}
   }
  }
  private static string ServeCommand {get{return "\""+Exe+"\" --serve";}}
  internal static bool ShouldAutoInstall(string source,string installed){return !String.Equals(source,installed,StringComparison.OrdinalIgnoreCase);}
  internal static int PairAfterConsent(string intentId,Func<int> pair,Func<string,int> renew){try{return pair();}catch(LocalHelper.RevokedHelperException){if(intentId=="")throw;return renew(intentId);}}
  internal enum PairPhase { ProtocolInvoked, Start, AccountVerified, ConsentAccepted, ConfigLoaded, StageStart, StageHttp, StageLocal, StageRevoked, StageAccepted, Failed }
  private static string PairSteps="";
  internal static PairPhase LastPairPhase;
  internal static int LastPairHttpStatus;
  internal static void TracePairAt(string path,PairPhase phase,int httpStatus=0){
   if(phase==PairPhase.Start){PairSteps="";LastPairHttpStatus=0;}
   LastPairPhase=phase;
   if(phase==PairPhase.StageHttp&&httpStatus>=100&&httpStatus<=599)LastPairHttpStatus=httpStatus;
   string entry=phase.ToString()+(httpStatus>=100&&httpStatus<=599?" HTTP "+httpStatus:"");
   PairSteps=(PairSteps.Length>400?"":PairSteps)+entry+"\n";
   try{File.WriteAllText(path,DateTime.UtcNow.ToString("o")+"\n"+PairSteps);}catch{}
  }
  internal static void TracePair(PairPhase phase,int httpStatus=0){TracePairAt(LocalHelper.PairDiagnosticPath,phase,httpStatus);}
  internal static string PairFailureLabel(PairPhase phase,Exception error,int httpStatus){
   var web=error as WebException;
   int status=httpStatus>=100&&httpStatus<=599?httpStatus:0;
   if(status==0&&web!=null&&web.Response is HttpWebResponse)status=(int)((HttpWebResponse)web.Response).StatusCode;
   string kind=web!=null?(web.Status==WebExceptionStatus.Timeout?"timeout":status>0?"http":"network"):error is UnauthorizedAccessException?"access":error is IOException?"file":error is System.Security.Cryptography.CryptographicException?"crypto":error is InvalidOperationException?"state":error is InvalidDataException?"data":"other";
   return "เริ่มผูกเครื่องไม่สำเร็จ (ขั้น "+phase+"; ประเภท "+kind+(status>=100&&status<=599?"; HTTP "+status:"")+") กรุณาลองใหม่หรือติดต่อ VisionD";
  }
  internal static int PairExplicit(bool replace=false,string intentId=""){int result=0;TracePair(PairPhase.Start);try{RunExclusive(()=>{if(!Owned())throw new InvalidOperationException("กรุณาติดตั้งตัวช่วยก่อน");LocalHelper.PairStatus="ยกเลิกการเริ่มผูกเครื่อง ยังไม่มีการยืนยัน";string accountCode=intentId==""?"":LocalHelper.PairIntentAccount(intentId);TracePair(PairPhase.AccountVerified);string prompt=intentId==""?"คุณเพิ่งกดเริ่มผูกเครื่องจากหน้า VisionD ที่เข้าสู่ระบบอยู่ใช่หรือไม่? จะแสดงรหัสให้กรอกในเบราว์เซอร์เดิม ไม่เปิดเว็บไซต์ใหม่":"รหัสยืนยันบัญชีจากหน้า VisionD เดิม: "+accountCode+"\nตรวจว่ารหัสนี้ตรงกับหน้า VisionD ที่คุณเพิ่งกดถัดไปบนเครื่องนี้ก่อนยืนยัน รหัสผูกเครื่องอีกชุดจะปรากฏให้เทียบในเบราว์เซอร์เดิม";if(MessageBox.Show(prompt,"ยืนยันบัญชีและเครื่อง",MessageBoxButtons.OKCancel)!=DialogResult.OK)return;TracePair(PairPhase.ConsentAccepted);result=replace?LocalHelper.ReplacePair():PairAfterConsent(intentId,()=>LocalHelper.Pair(intentId),id=>LocalHelper.RenewRevokedPair(id));});}catch(Exception error){PairPhase phase=LastPairPhase;int http=LastPairHttpStatus;TracePair(PairPhase.Failed);LocalHelper.PairStatus=PairFailureLabel(phase,error,http);MessageBox.Show(LocalHelper.PairStatus,"VisionD Helper");result=2;}return result;}
  private static string ProtocolCommand {get{return "\""+Exe+"\" \"%1\"";}}
  [System.Runtime.InteropServices.DllImport("shell32.dll")] private static extern void SHChangeNotify(uint eventId,uint flags,IntPtr item1,IntPtr item2);
  private static void NotifyRegistry(){SHChangeNotify(0x08000000,0,IntPtr.Zero,IntPtr.Zero);}
  private static void WriteRegistration(List<Action> undo){
   WriteSetting(undo,RunKey,"VisionDBrowserLauncher",ServeCommand);
   WriteSetting(undo,ProtocolKey,"","URL:VisionD isolated Chrome profile");WriteSetting(undo,ProtocolKey,"URL Protocol","");
   WriteSetting(undo,ProtocolKey+@"\shell\open\command","",ProtocolCommand);
   WriteSetting(undo,PairProtocolKey,"","URL:VisionD Helper device pairing");WriteSetting(undo,PairProtocolKey,"URL Protocol","");
   WriteSetting(undo,PairProtocolKey+@"\shell\open\command","",ProtocolCommand);
   WriteSetting(undo,UninstallKey,"DisplayName","VisionD Helper");WriteSetting(undo,UninstallKey,"DisplayVersion",Version);WriteSetting(undo,UninstallKey,"UninstallString","\""+Exe+"\"");
  }
  internal static string Hash(string path){using(var input=File.OpenRead(path))using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(input)).Replace("-","");}
  private static string InstalledExe(){
   bool current=File.Exists(Exe),previous=File.Exists(PreviousExe),legacy=File.Exists(LegacyExe),marker=File.Exists(Owner);
   if(!current&&!previous&&!legacy&&!marker)return "";
   if(!marker)throw new InvalidOperationException("ข้อมูลเจ้าของตัวช่วยไม่ครบ ยังไม่แก้ไขไฟล์ใด");
   string[] lines=File.ReadAllLines(Owner);
   if(lines.Length!=2||lines[0]!=Marker)throw new InvalidOperationException("ไฟล์ตัวช่วยไม่ตรงกับหลักฐานเจ้าของ หยุดเพื่อป้องกันการเขียนทับ");
   if(current&&lines[1]=="sha256="+Hash(Exe))return Exe;
   if(previous&&lines[1]=="sha256="+Hash(PreviousExe))return PreviousExe;
   if(legacy&&lines[1]=="sha256="+Hash(LegacyExe))return LegacyExe;
   throw new InvalidOperationException("ไฟล์ตัวช่วยไม่ตรงกับหลักฐานเจ้าของ หยุดเพื่อป้องกันการเขียนทับ");
  }
  private static bool Owned(){return InstalledExe()!="";}
  private static string RegistryValue(string path,string name){using(var key=Registry.CurrentUser.OpenSubKey(path))return key==null?"":Convert.ToString(key.GetValue(name,""));}
  private static void WriteSetting(List<Action> undo,string path,string name,string value){
   var missing=new List<string>();string cursor=path;
   while(cursor.IndexOf('\\')>=0){using(var key=Registry.CurrentUser.OpenSubKey(cursor)){if(key!=null)break;}missing.Add(cursor);cursor=cursor.Substring(0,cursor.LastIndexOf('\\'));}
   undo.Add(()=>{foreach(string created in missing){bool empty=false;using(var key=Registry.CurrentUser.OpenSubKey(created)){empty=key!=null&&key.ValueCount==0&&key.SubKeyCount==0;}if(empty)Registry.CurrentUser.DeleteSubKey(created,false);}});
   object previous=null;RegistryValueKind kind=RegistryValueKind.String;bool existed=false;
   using(var before=Registry.CurrentUser.OpenSubKey(path)){if(before!=null){existed=Array.IndexOf(before.GetValueNames(),name)>=0;if(existed){previous=before.GetValue(name,null,RegistryValueOptions.DoNotExpandEnvironmentNames);kind=before.GetValueKind(name);}}}
   undo.Add(()=>{using(var key=Registry.CurrentUser.OpenSubKey(path,true)){if(key==null||!Object.Equals(key.GetValue(name,null,RegistryValueOptions.DoNotExpandEnvironmentNames),value))return;if(existed)key.SetValue(name,previous,kind);else key.DeleteValue(name,false);}});
   using(var key=Registry.CurrentUser.CreateSubKey(path))key.SetValue(name,value,RegistryValueKind.String);
  }
  private static void CheckRegistry(bool owned){
   string installed=owned?InstalledExe():"",run=RegistryValue(RunKey,"VisionDBrowserLauncher"),protocol=RegistryValue(ProtocolKey+@"\shell\open\command","");
   using(var key=Registry.CurrentUser.OpenSubKey(ProtocolKey)){if(key!=null&&(!owned||protocol!="\""+installed+"\" \"%1\""))throw new InvalidOperationException("ชื่อ protocol มีเจ้าของอื่น ไม่เปลี่ยนการตั้งค่า");}
   string pairProtocol=RegistryValue(PairProtocolKey+@"\shell\open\command","");
   using(var key=Registry.CurrentUser.OpenSubKey(PairProtocolKey)){if(key!=null&&(!owned||installed!=Exe||pairProtocol!=ProtocolCommand))throw new InvalidOperationException("ชื่อ protocol ผูกเครื่องมีเจ้าของอื่น ไม่เปลี่ยนการตั้งค่า");}
   if(run!=""&&(!owned||run!="\""+installed+"\" --serve"))throw new InvalidOperationException("รายการเริ่มต้นมีเจ้าของอื่น ไม่เปลี่ยนการตั้งค่า");
   string uninstall=RegistryValue(UninstallKey,"UninstallString");using(var key=Registry.CurrentUser.OpenSubKey(UninstallKey)){if(key!=null&&(!owned||uninstall!="\""+installed+"\""))throw new InvalidOperationException("รายการถอนติดตั้งมีเจ้าของอื่น");}
  }
  private static bool IsService(ManagementBaseObject row){string installed=InstalledExe();return installed!=""&&String.Equals(Convert.ToString(row["ExecutablePath"]),installed,StringComparison.OrdinalIgnoreCase)&&Convert.ToString(row["CommandLine"])=="\""+installed+"\" --serve";}
  private static bool HasOwnedService(){string name=Path.GetFileName(InstalledExe());using(var search=new ManagementObjectSearcher("SELECT ProcessId,ExecutablePath,CommandLine FROM Win32_Process WHERE Name='"+name+"'"))foreach(ManagementObject row in search.Get())if(IsService(row))return true;return false;}
  private static void StopCreated(Process process){
   process.Refresh();if(process.HasExited)return;
   using(var search=new ManagementObjectSearcher("SELECT ProcessId,ExecutablePath,CommandLine FROM Win32_Process WHERE ProcessId="+process.Id))foreach(ManagementObject row in search.Get())if(IsService(row)){process.Kill();if(!process.WaitForExit(5000))throw new InvalidOperationException("ตัวช่วยที่เริ่มในครั้งนี้ยังไม่หยุด");}
  }
  private static void StopOwned(){
   string name=Path.GetFileName(InstalledExe());using(var search=new ManagementObjectSearcher("SELECT ProcessId,ExecutablePath,CommandLine FROM Win32_Process WHERE Name='"+name+"'"))foreach(ManagementObject row in search.Get()){
    if(!IsService(row))continue;int id=Convert.ToInt32(row["ProcessId"]);
    using(var fresh=new ManagementObjectSearcher("SELECT ProcessId,ExecutablePath,CommandLine FROM Win32_Process WHERE ProcessId="+id))foreach(ManagementObject found in fresh.Get())if(IsService(found)){using(var process=Process.GetProcessById(id)){process.Kill();if(!process.WaitForExit(5000))throw new InvalidOperationException("ตัวช่วยเดิมยังไม่หยุด");}}
   }
  }
  private static Process Start(string argument,string path){return Process.Start(new ProcessStartInfo(path,argument){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden});}
  private static Process Start(string argument){return Start(argument,Exe);}
  internal static void RestoreImageAt(string current,string previous,string backup,string owner,string oldMarker,bool owned,bool swapped){
   if(swapped&&File.Exists(current))File.Delete(current);
   if(owned&&File.Exists(backup)){File.Move(backup,previous);File.WriteAllText(owner,oldMarker);}
   else if(!owned&&File.Exists(owner))File.Delete(owner);
  }
  internal static void RestartRestoredOwned(string previous,bool owned,bool stopped,Action<string> restart){if(owned&&stopped&&File.Exists(previous))restart(previous);}
  internal sealed class StartupFailure:InvalidOperationException {
   internal readonly int ExitCode;internal readonly bool Occupied;
   internal StartupFailure(int code,bool occupied):base("ตัวช่วยหยุดก่อนพร้อม (exit="+code+")"+(occupied?" พอร์ตที่ตั้งไว้ยังถูกใช้งาน กดซ่อมพอร์ตเพื่อยืนยันเครื่องใหม่":" ยังไม่มีหลักฐานว่าพอร์ตถูกใช้ กรุณาตรวจข้อผิดพลาดก่อนซ่อม")){ExitCode=code;Occupied=occupied;}
  }
  internal static bool NeedsRepair;
  internal static bool CanKeepDegraded(bool owned,bool serviceRunning,Exception error){var failure=error as StartupFailure;return owned&&!serviceRunning&&failure!=null&&failure.ExitCode==48&&failure.Occupied;}
  private static void Ready(Process service){
   ReadyOnPort(service,LocalHelper.ConfiguredPort());
  }
  internal static void ReadyOnPort(Process service,int configuredPort){
   for(int attempt=0;attempt<20;attempt++){
    service.Refresh();if(service.HasExited)throw new StartupFailure(service.ExitCode,!LocalHelper.PortAvailable(configuredPort));
    using(var search=new ManagementObjectSearcher(@"root\StandardCimv2","SELECT LocalAddress,LocalPort FROM MSFT_NetTCPConnection WHERE State=2 AND OwningProcess="+service.Id)){
     var rows=search.Get();if(rows.Count==1)foreach(ManagementObject row in rows){int port=Convert.ToInt32(row["LocalPort"]);if(Convert.ToString(row["LocalAddress"])=="127.0.0.1"&&port==configuredPort&&port>=49152&&port<=65535)return;throw new InvalidOperationException("ที่อยู่ตัวช่วยไม่ผ่านการตรวจสอบ");}
    }
    System.Threading.Thread.Sleep(100);
   }
   throw new InvalidOperationException("ยังยืนยันพอร์ตของตัวช่วยไม่ได้");
  }
  private static void Install(){
   NeedsRepair=false;bool owned=Owned();CheckRegistry(owned);string source=Process.GetCurrentProcess().MainModule.FileName;
   if(String.Equals(source,Exe,StringComparison.OrdinalIgnoreCase)){
    if(!owned)throw new InvalidOperationException("ต้องติดตั้งจากไฟล์ดาวน์โหลดที่ตรวจสอบแล้ว");
    bool running=false;string name=Path.GetFileName(InstalledExe());using(var search=new ManagementObjectSearcher("SELECT ProcessId,ExecutablePath,CommandLine FROM Win32_Process WHERE Name='"+name+"'"))foreach(ManagementObject row in search.Get())if(IsService(row)){Ready(Process.GetProcessById(Convert.ToInt32(row["ProcessId"])));running=true;break;}
    Process created=null;var repair=new List<Action>();try{if(!running){created=Start("--serve");try{Ready(created);}catch(Exception error){if(!CanKeepDegraded(owned,HasOwnedService(),error))throw;NeedsRepair=true;}}WriteRegistration(repair);NotifyRegistry();}catch{try{for(int i=repair.Count-1;i>=0;i--)repair[i]();NotifyRegistry();}finally{if(created!=null)StopCreated(created);}throw;}finally{if(created!=null)created.Dispose();}return;
   }
   Directory.CreateDirectory(Root);string backup=Path.Combine(Root,"setup-previous.exe"),candidate=Path.Combine(Root,"setup-candidate.exe"),oldExe=owned?InstalledExe():"";
   if(File.Exists(backup)||File.Exists(candidate))throw new InvalidOperationException("พบไฟล์กู้คืนจากการติดตั้งก่อนหน้า กรุณาติดต่อ VisionD ก่อนแก้ไข");
   File.Copy(source,candidate,false);string expected=Hash(source);if(Hash(candidate)!=expected)throw new InvalidDataException("ไฟล์ติดตั้งไม่ครบ");
   string oldMarker=owned?File.ReadAllText(Owner):null;bool stopped=false,swapped=false;Process service=null;var undo=new List<Action>();
   try{
    if(owned){stopped=HasOwnedService();StopOwned();File.Move(oldExe,backup);}File.Move(candidate,Exe);swapped=true;
    File.WriteAllLines(Owner,new[]{Marker,"sha256="+expected});
    using(var init=Start("--init")){if(!init.WaitForExit(10000)){init.Kill();init.WaitForExit(5000);throw new InvalidOperationException("เตรียมข้อมูลตัวช่วยหมดเวลา");}if(init.ExitCode!=0)throw new InvalidOperationException("เตรียมข้อมูลตัวช่วยไม่สำเร็จ");}
    service=Start("--serve");try{Ready(service);}catch(Exception error){if(!CanKeepDegraded(owned,HasOwnedService(),error))throw;NeedsRepair=true;}
    WriteRegistration(undo);NotifyRegistry();
    if(owned)File.Delete(backup);
   }catch(Exception failure){try{
    if(service!=null)StopCreated(service);
    RestoreImageAt(Exe,oldExe,backup,Owner,oldMarker,owned,swapped);
    try{for(int index=undo.Count-1;index>=0;index--)undo[index]();NotifyRegistry();}finally{RestartRestoredOwned(oldExe,owned,stopped,path=>Ready(Start("--serve",path)));}
    }catch(Exception rollback){throw new InvalidOperationException("ติดตั้งไม่สำเร็จ: "+failure.Message+"; การกู้คืนยังไม่พร้อม: "+rollback.Message);}throw;
   }finally{if(File.Exists(candidate))File.Delete(candidate);if(service!=null)service.Dispose();}
  }
  private static void Repair(){
   if(!Owned())throw new InvalidOperationException("ติดตั้งรุ่นใหม่นี้ก่อนซ่อม");CheckRegistry(true);
   if(HasOwnedService())throw new InvalidOperationException("ยังมีตัวช่วยเดิมทำงานอยู่ ไม่หยุดหรือเปลี่ยนข้อมูลอัตโนมัติ");
   if(LocalHelper.HasRepairCandidate()||(!LocalHelper.AwaitingRepairStart()&&!LocalHelper.PortAvailable(LocalHelper.ConfiguredPort()))){
    if(!LocalHelper.RepairPort())return;
   }
   // After confirmation the old backend key is revoked; no rollback to that key.
   Process created=null;try{created=Start("--serve");Ready(created);LocalHelper.CompleteRepairStartup();NeedsRepair=false;LocalHelper.PairStatus="ซ่อมและตรวจตัวช่วยพร้อมแล้ว กลับ VisionD และรีเฟรชสถานะช่อง";}
   catch(Exception e){if(created!=null)StopCreated(created);LocalHelper.PairStatus="ยังเริ่มตัวช่วยไม่ได้ ข้อมูลที่ยืนยันแล้วคงอยู่ กดซ่อมอีกครั้งเพื่อตรวจหรือดำเนินการต่อ: "+e.Message;throw new InvalidOperationException(LocalHelper.PairStatus);}
   finally{if(created!=null)created.Dispose();}
  }
  private static void Disable(){if(!Owned())return;CheckRegistry(true);if(!String.Equals(InstalledExe(),Exe,StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("ติดตั้งรุ่นใหม่จากไฟล์ Setup ที่ตรวจสอบแล้วก่อนถอนตัวช่วยเดิม");StopOwned();using(var run=Registry.CurrentUser.OpenSubKey(RunKey,true))if(run!=null&&Convert.ToString(run.GetValue("VisionDBrowserLauncher",""))==ServeCommand)run.DeleteValue("VisionDBrowserLauncher");using(var key=Registry.CurrentUser.OpenSubKey(ProtocolKey))if(key!=null)Registry.CurrentUser.DeleteSubKeyTree(ProtocolKey);using(var pair=Registry.CurrentUser.OpenSubKey(PairProtocolKey))if(pair!=null)Registry.CurrentUser.DeleteSubKeyTree(PairProtocolKey);if(RegistryValue(UninstallKey,"UninstallString")=="\""+Exe+"\"")Registry.CurrentUser.DeleteSubKeyTree(UninstallKey);if(!String.Equals(Process.GetCurrentProcess().MainModule.FileName,Exe,StringComparison.OrdinalIgnoreCase)){File.Delete(Exe);File.Delete(Owner);}NotifyRegistry();}
  [STAThread] internal static int Show(){
   Application.EnableVisualStyles();var form=new Form{Text="VisionD Helper "+Version,Width=560,Height=400,StartPosition=FormStartPosition.CenterScreen,MaximizeBox=false};
   var text=new Label{Left=20,Top=20,Width=500,Height=90,Text="ตัวช่วย Windows สำหรับ Chrome แยกบัญชี TikTok\nติดตั้งเฉพาะผู้ใช้ Windows นี้ ไม่คัดลอกคุกกี้หรือเปลี่ยนโปรไฟล์เดิม\nไฟล์นี้ยังไม่มีลายเซ็นผู้เผยแพร่ ตรวจแหล่งดาวน์โหลดและ SHA256 จาก VisionD ก่อนติดตั้ง"};
   var install=new Button{Left=20,Top=120,Width=240,Height=42,Text="ติดตั้ง / อัปเดตตัวช่วย"};var pair=new Button{Left=280,Top=120,Width=240,Height=42,Text="ผูกเครื่องกับ VisionD"};
   var repairPort=new Button{Left=20,Top=173,Width=500,Height=38,Text="ซ่อมพอร์ต / ยืนยันเครื่องใหม่"};
   var remove=new Button{Left=20,Top=219,Width=500,Height=38,Text="ถอนการติดตั้ง / หยุดตัวช่วย"};var status=new Label{Left=20,Top=272,Width=500,Height=80,AutoSize=false};
   Action<Action> run=action=>{install.Enabled=pair.Enabled=remove.Enabled=repairPort.Enabled=false;try{RunExclusive(action);}catch(Exception e){status.Text=e.Message.StartsWith("มีตัวติดตั้ง VisionD",StringComparison.Ordinal)?"ปิดหน้าต่างตัวติดตั้ง VisionD เดิม แล้วกด ติดตั้ง / อัปเดตตัวช่วย อีกครั้ง":"ไม่สำเร็จ: "+e.Message;}finally{install.Enabled=pair.Enabled=remove.Enabled=repairPort.Enabled=true;}};
   bool autoQueued=false;form.Shown+=(sender,args)=>{if(autoQueued||!ShouldAutoInstall(Process.GetCurrentProcess().MainModule.FileName,Exe))return;autoQueued=true;install.Enabled=false;status.Text="กำลังติดตั้ง / อัปเดตตัวช่วย…";form.BeginInvoke((MethodInvoker)delegate{if(form.IsDisposed)return;run(()=>{Install();status.Text=NeedsRepair?"ติดตั้งแล้วแต่พอร์ตเดิมถูกใช้งาน กดซ่อมพอร์ต / ยืนยันเครื่องใหม่":"ติดตั้งและเริ่มตัวช่วยแล้ว กลับหน้า VisionD เพื่อยืนยันเครื่อง";});});};
   install.Click+=(sender,args)=>run(()=>{if(MessageBox.Show(form,"ติดตั้ง / อัปเดตเฉพาะตัวช่วย VisionD ของผู้ใช้ Windows นี้? โปรไฟล์เดิมจะคงอยู่","ยืนยันติดตั้ง",MessageBoxButtons.OKCancel)!=DialogResult.OK)return;Install();status.Text=NeedsRepair?"ติดตั้งไฟล์และการตั้งค่าแล้ว แต่ตัวช่วยยังไม่พร้อม พอร์ตเดิมถูกใช้งาน กดซ่อมพอร์ต / ยืนยันเครื่องใหม่":"ติดตั้งและตรวจตัวช่วยแล้ว กดผูกเครื่องเพื่อดำเนินการต่อ";});
   repairPort.Click+=(sender,args)=>run(()=>{if(MessageBox.Show(form,"ซ่อมพอร์ตโดยขอรหัสใหม่และยืนยันแทนตัวช่วยเดิมในหน้า VisionD ที่เปิดอยู่? ก่อนยืนยันข้อมูลเดิมจะคงอยู่ ไม่ปิด Chrome หรือโปรแกรมอื่น","ยืนยันซ่อมพอร์ต",MessageBoxButtons.OKCancel)!=DialogResult.OK)return;Repair();status.Text=LocalHelper.PairStatus;});
   pair.Click+=(sender,args)=>run(()=>{PairExplicit();status.Text=LocalHelper.PairStatus;});
   remove.Click+=(sender,args)=>run(()=>{if(MessageBox.Show(form,"ถอนเฉพาะตัวช่วยและการเริ่มอัตโนมัติ? โปรไฟล์และข้อมูลการผูกเครื่องจะคงอยู่ หากกำลังเปิดจากตำแหน่งติดตั้ง ไฟล์โปรแกรมจะเก็บไว้","ถอนการติดตั้ง",MessageBoxButtons.OKCancel)!=DialogResult.OK)return;Disable();status.Text=File.Exists(Exe)?"ถอนการตั้งค่าแล้ว ไฟล์ที่กำลังเปิดยังคงอยู่ หากต้องการลบไฟล์ให้ปิดหน้านี้แล้วถอนผ่านไฟล์ Setup ที่ดาวน์โหลด":"ถอนตัวช่วยแล้ว โปรไฟล์และข้อมูลการผูกเครื่องคงอยู่";});
   form.Controls.AddRange(new Control[]{text,install,pair,repairPort,remove,status});Application.Run(form);return 0;
  }
 }
}
