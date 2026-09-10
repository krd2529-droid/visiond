using System;
using System.IO;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Management;
using System.Collections.Generic;
using System.Windows.Forms;
using Microsoft.Win32;
[assembly:System.Reflection.AssemblyVersion("0.20.73.0")]
[assembly:System.Reflection.AssemblyFileVersion("0.20.73.0")]
[assembly:System.Reflection.AssemblyProduct("VisionD Helper")]

namespace VisionDBrowserLauncher {
 internal static class Setup {
  internal const string Version="0.20.73";
  private const string Marker="VisionD Browser Launcher v1";
  private static readonly string Root=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"VisionD","BrowserLauncher");
  private static readonly string Exe=Path.Combine(Root,"VisionDBrowserLauncher.exe");
  private static readonly string Owner=Path.Combine(Root,"owner.txt");
  private const string RunKey=@"Software\Microsoft\Windows\CurrentVersion\Run",ProtocolKey=@"Software\Classes\visiond-profile",UninstallKey=@"Software\Microsoft\Windows\CurrentVersion\Uninstall\VisionDHelper";
  private static void RunExclusive(Action action){
   string sid=System.Security.Principal.WindowsIdentity.GetCurrent().User.Value;
   using(var mutex=new System.Threading.Mutex(false,"Global\\VisionDHelperSetup-"+sid)){
    bool acquired=false;try{try{acquired=mutex.WaitOne(0);}catch(System.Threading.AbandonedMutexException){acquired=true;}if(!acquired)throw new InvalidOperationException("มีตัวติดตั้ง VisionD อีกหน้าต่างกำลังทำงาน กรุณาปิดหรือรอหน้าต่างนั้นก่อน");action();}finally{if(acquired)mutex.ReleaseMutex();}
   }
  }
  private static string ServeCommand {get{return "\""+Exe+"\" --serve";}}
  private static string ProtocolCommand {get{return "\""+Exe+"\" \"%1\"";}}
  [System.Runtime.InteropServices.DllImport("shell32.dll")] private static extern void SHChangeNotify(uint eventId,uint flags,IntPtr item1,IntPtr item2);
  private static void NotifyRegistry(){SHChangeNotify(0x08000000,0,IntPtr.Zero,IntPtr.Zero);}
  private static void WriteRegistration(List<Action> undo){
   WriteSetting(undo,RunKey,"VisionDBrowserLauncher",ServeCommand);
   WriteSetting(undo,ProtocolKey,"","URL:VisionD isolated Chrome profile");WriteSetting(undo,ProtocolKey,"URL Protocol","");
   WriteSetting(undo,ProtocolKey+@"\shell\open\command","",ProtocolCommand);
   WriteSetting(undo,UninstallKey,"DisplayName","VisionD Helper");WriteSetting(undo,UninstallKey,"DisplayVersion",Version);WriteSetting(undo,UninstallKey,"UninstallString","\""+Exe+"\"");
  }
  internal static string Hash(string path){using(var input=File.OpenRead(path))using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(input)).Replace("-","");}
  private static bool Owned(){
   bool file=File.Exists(Exe),marker=File.Exists(Owner);if(!file&&!marker)return false;
   if(!file||!marker)throw new InvalidOperationException("ข้อมูลเจ้าของตัวช่วยไม่ครบ ยังไม่แก้ไขไฟล์ใด");
   string[] lines=File.ReadAllLines(Owner);if(lines.Length!=2||lines[0]!=Marker||lines[1]!="sha256="+Hash(Exe))throw new InvalidOperationException("ไฟล์ตัวช่วยไม่ตรงกับหลักฐานเจ้าของ หยุดเพื่อป้องกันการเขียนทับ");return true;
  }
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
   string run=RegistryValue(RunKey,"VisionDBrowserLauncher"),protocol=RegistryValue(ProtocolKey+@"\shell\open\command","");
   using(var key=Registry.CurrentUser.OpenSubKey(ProtocolKey)){if(key!=null&&(!owned||protocol!=ProtocolCommand))throw new InvalidOperationException("ชื่อ protocol มีเจ้าของอื่น ไม่เปลี่ยนการตั้งค่า");}
   if(run!=""&&(!owned||run!=ServeCommand))throw new InvalidOperationException("รายการเริ่มต้นมีเจ้าของอื่น ไม่เปลี่ยนการตั้งค่า");
   string uninstall=RegistryValue(UninstallKey,"UninstallString");using(var key=Registry.CurrentUser.OpenSubKey(UninstallKey)){if(key!=null&&(!owned||uninstall!="\""+Exe+"\""))throw new InvalidOperationException("รายการถอนติดตั้งมีเจ้าของอื่น");}
  }
  private static bool IsService(ManagementBaseObject row){return String.Equals(Convert.ToString(row["ExecutablePath"]),Exe,StringComparison.OrdinalIgnoreCase)&&Convert.ToString(row["CommandLine"])==ServeCommand;}
  private static bool HasOwnedService(){using(var search=new ManagementObjectSearcher("SELECT ProcessId,ExecutablePath,CommandLine FROM Win32_Process WHERE Name='VisionDBrowserLauncher.exe'"))foreach(ManagementObject row in search.Get())if(IsService(row))return true;return false;}
  private static void StopCreated(Process process){
   process.Refresh();if(process.HasExited)return;
   using(var search=new ManagementObjectSearcher("SELECT ProcessId,ExecutablePath,CommandLine FROM Win32_Process WHERE ProcessId="+process.Id))foreach(ManagementObject row in search.Get())if(IsService(row)){process.Kill();if(!process.WaitForExit(5000))throw new InvalidOperationException("ตัวช่วยที่เริ่มในครั้งนี้ยังไม่หยุด");}
  }
  private static void StopOwned(){
   using(var search=new ManagementObjectSearcher("SELECT ProcessId,ExecutablePath,CommandLine FROM Win32_Process WHERE Name='VisionDBrowserLauncher.exe'"))foreach(ManagementObject row in search.Get()){
    if(!IsService(row))continue;int id=Convert.ToInt32(row["ProcessId"]);
    using(var fresh=new ManagementObjectSearcher("SELECT ProcessId,ExecutablePath,CommandLine FROM Win32_Process WHERE ProcessId="+id))foreach(ManagementObject found in fresh.Get())if(IsService(found)){using(var process=Process.GetProcessById(id)){process.Kill();if(!process.WaitForExit(5000))throw new InvalidOperationException("ตัวช่วยเดิมยังไม่หยุด");}}
   }
  }
  private static Process Start(string argument){return Process.Start(new ProcessStartInfo(Exe,argument){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden});}
  private static void Ready(Process service){
   for(int attempt=0;attempt<20;attempt++){
    service.Refresh();if(service.HasExited)throw new InvalidOperationException("ตัวช่วยเริ่มไม่สำเร็จ อาจมีโปรแกรมใช้พอร์ตเดิม");
    using(var search=new ManagementObjectSearcher(@"root\StandardCimv2","SELECT LocalAddress,LocalPort FROM MSFT_NetTCPConnection WHERE State=2 AND OwningProcess="+service.Id)){
     var rows=search.Get();if(rows.Count==1)foreach(ManagementObject row in rows){int port=Convert.ToInt32(row["LocalPort"]);if(Convert.ToString(row["LocalAddress"])=="127.0.0.1"&&port>=49152&&port<=65535)return;throw new InvalidOperationException("ที่อยู่ตัวช่วยไม่ผ่านการตรวจสอบ");}
    }
    System.Threading.Thread.Sleep(100);
   }
   throw new InvalidOperationException("ยังยืนยันพอร์ตของตัวช่วยไม่ได้");
  }
  private static void Install(){
   bool owned=Owned();CheckRegistry(owned);string source=Process.GetCurrentProcess().MainModule.FileName;
   if(String.Equals(source,Exe,StringComparison.OrdinalIgnoreCase)){
    if(!owned)throw new InvalidOperationException("ต้องติดตั้งจากไฟล์ดาวน์โหลดที่ตรวจสอบแล้ว");
    bool running=false;using(var search=new ManagementObjectSearcher("SELECT ProcessId,ExecutablePath,CommandLine FROM Win32_Process WHERE Name='VisionDBrowserLauncher.exe'"))foreach(ManagementObject row in search.Get())if(IsService(row)){Ready(Process.GetProcessById(Convert.ToInt32(row["ProcessId"])));running=true;break;}
    Process created=null;var repair=new List<Action>();try{if(!running){created=Start("--serve");Ready(created);}WriteRegistration(repair);NotifyRegistry();}catch{try{for(int i=repair.Count-1;i>=0;i--)repair[i]();NotifyRegistry();}finally{if(created!=null)StopCreated(created);}throw;}finally{if(created!=null)created.Dispose();}return;
   }
   Directory.CreateDirectory(Root);string backup=Path.Combine(Root,"setup-previous.exe"),candidate=Path.Combine(Root,"setup-candidate.exe");
   if(File.Exists(backup)||File.Exists(candidate))throw new InvalidOperationException("พบไฟล์กู้คืนจากการติดตั้งก่อนหน้า กรุณาติดต่อ VisionD ก่อนแก้ไข");
   File.Copy(source,candidate,false);string expected=Hash(source);if(Hash(candidate)!=expected)throw new InvalidDataException("ไฟล์ติดตั้งไม่ครบ");
   string oldMarker=owned?File.ReadAllText(Owner):null;bool stopped=false,swapped=false;Process service=null;var undo=new List<Action>();
   try{
    if(owned){stopped=HasOwnedService();StopOwned();File.Move(Exe,backup);}File.Move(candidate,Exe);swapped=true;
    File.WriteAllLines(Owner,new[]{Marker,"sha256="+expected});
    using(var init=Start("--init")){if(!init.WaitForExit(10000)){init.Kill();init.WaitForExit(5000);throw new InvalidOperationException("เตรียมข้อมูลตัวช่วยหมดเวลา");}if(init.ExitCode!=0)throw new InvalidOperationException("เตรียมข้อมูลตัวช่วยไม่สำเร็จ");}
    service=Start("--serve");Ready(service);
    WriteRegistration(undo);NotifyRegistry();
    if(owned)File.Delete(backup);
   }catch{
    if(service!=null)StopCreated(service);
    if(swapped&&File.Exists(Exe))File.Delete(Exe);
    if(owned&&File.Exists(backup)){File.Move(backup,Exe);File.WriteAllText(Owner,oldMarker);}
    else if(!owned&&File.Exists(Owner))File.Delete(Owner);
    try{for(int index=undo.Count-1;index>=0;index--)undo[index]();NotifyRegistry();}finally{if(owned&&stopped&&File.Exists(Exe))Ready(Start("--serve"));}
    throw;
   }finally{if(File.Exists(candidate))File.Delete(candidate);if(service!=null)service.Dispose();}
  }
  private static void Disable(){if(!Owned())return;CheckRegistry(true);StopOwned();using(var run=Registry.CurrentUser.OpenSubKey(RunKey,true))if(run!=null&&Convert.ToString(run.GetValue("VisionDBrowserLauncher",""))==ServeCommand)run.DeleteValue("VisionDBrowserLauncher");using(var key=Registry.CurrentUser.OpenSubKey(ProtocolKey))if(key!=null)Registry.CurrentUser.DeleteSubKeyTree(ProtocolKey);if(RegistryValue(UninstallKey,"UninstallString")=="\""+Exe+"\"")Registry.CurrentUser.DeleteSubKeyTree(UninstallKey);if(!String.Equals(Process.GetCurrentProcess().MainModule.FileName,Exe,StringComparison.OrdinalIgnoreCase)){File.Delete(Exe);File.Delete(Owner);}NotifyRegistry();}
  [STAThread] internal static int Show(){
   Application.EnableVisualStyles();var form=new Form{Text="VisionD Helper "+Version,Width=560,Height=340,StartPosition=FormStartPosition.CenterScreen,MaximizeBox=false};
   var text=new Label{Left=20,Top=20,Width=500,Height=90,Text="ตัวช่วย Windows สำหรับ Chrome แยกบัญชี TikTok\nติดตั้งเฉพาะผู้ใช้ Windows นี้ ไม่คัดลอกคุกกี้หรือเปลี่ยนโปรไฟล์เดิม\nไฟล์นี้ยังไม่มีลายเซ็นผู้เผยแพร่ ตรวจแหล่งดาวน์โหลดและ SHA256 จาก VisionD ก่อนติดตั้ง"};
   var install=new Button{Left=20,Top=120,Width=240,Height=42,Text="ติดตั้ง / อัปเดตตัวช่วย"};var pair=new Button{Left=280,Top=120,Width=240,Height=42,Text="ผูกเครื่องกับ VisionD"};
   var remove=new Button{Left=20,Top=178,Width=500,Height=38,Text="ถอนการติดตั้ง / หยุดตัวช่วย"};var status=new Label{Left=20,Top=235,Width=500,Height=65,AutoSize=false};
   Action<Action> run=action=>{install.Enabled=pair.Enabled=remove.Enabled=false;try{RunExclusive(action);}catch(Exception e){status.Text="ไม่สำเร็จ: "+e.Message;}finally{install.Enabled=pair.Enabled=remove.Enabled=true;}};
   install.Click+=(sender,args)=>run(()=>{if(MessageBox.Show(form,"ติดตั้ง / อัปเดตเฉพาะตัวช่วย VisionD ของผู้ใช้ Windows นี้? โปรไฟล์เดิมจะคงอยู่","ยืนยันติดตั้ง",MessageBoxButtons.OKCancel)!=DialogResult.OK)return;Install();status.Text="ติดตั้งและตรวจตัวช่วยแล้ว กดผูกเครื่องเพื่อดำเนินการต่อ";});
   pair.Click+=(sender,args)=>run(()=>{if(!Owned())throw new InvalidOperationException("กรุณาติดตั้งตัวช่วยก่อน");if(MessageBox.Show(form,"จะเปิดหน้า VisionD เพื่อเข้าสู่ระบบและเทียบรหัส ก่อนกดยืนยันผูกเครื่อง","เปิดขั้นตอนผูกเครื่อง",MessageBoxButtons.OKCancel)!=DialogResult.OK)return;LocalHelper.Pair();status.Text=LocalHelper.PairStatus;});
   remove.Click+=(sender,args)=>run(()=>{if(MessageBox.Show(form,"ถอนเฉพาะตัวช่วยและการเริ่มอัตโนมัติ? โปรไฟล์และข้อมูลการผูกเครื่องจะคงอยู่ หากกำลังเปิดจากตำแหน่งติดตั้ง ไฟล์โปรแกรมจะเก็บไว้","ถอนการติดตั้ง",MessageBoxButtons.OKCancel)!=DialogResult.OK)return;Disable();status.Text=File.Exists(Exe)?"ถอนการตั้งค่าแล้ว ไฟล์ที่กำลังเปิดยังคงอยู่ หากต้องการลบไฟล์ให้ปิดหน้านี้แล้วถอนผ่านไฟล์ Setup ที่ดาวน์โหลด":"ถอนตัวช่วยแล้ว โปรไฟล์และข้อมูลการผูกเครื่องคงอยู่";});
   form.Controls.AddRange(new Control[]{text,install,pair,remove,status});Application.Run(form);return 0;
  }
 }
}
