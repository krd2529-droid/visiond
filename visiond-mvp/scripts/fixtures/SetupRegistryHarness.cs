using System;
using System.Collections.Generic;
using System.Reflection;
using Microsoft.Win32;
// Entire registry substitute is memory-only. No Microsoft.Win32.Registry access.
public static class FakeRegistry {
 public static readonly Key CurrentUser=new Key("");
 public static Dictionary<string,Dictionary<string,object>> Keys=new Dictionary<string,Dictionary<string,object>>();
 public sealed class Key:IDisposable {
  string path;public Key(string p){path=p;}public void Dispose(){}
  public Key OpenSubKey(string p){return OpenSubKey(p,false);}public Key OpenSubKey(string p,bool write){return Keys.ContainsKey(p)?new Key(p):null;}
  public Key CreateSubKey(string p){string cursor=p;while(cursor!=""){if(!Keys.ContainsKey(cursor))Keys[cursor]=new Dictionary<string,object>();int i=cursor.LastIndexOf('\\');cursor=i<0?"":cursor.Substring(0,i);}return new Key(p);}
  public object GetValue(string n,object fallback){return GetValue(n,fallback,RegistryValueOptions.None);}public object GetValue(string n,object fallback,RegistryValueOptions options){return Keys[path].ContainsKey(n)?Keys[path][n]:fallback;}
  public string[] GetValueNames(){var result=new string[Keys[path].Count];Keys[path].Keys.CopyTo(result,0);return result;}
  public RegistryValueKind GetValueKind(string n){return RegistryValueKind.String;}
  public void SetValue(string n,object v){SetValue(n,v,RegistryValueKind.String);}public void SetValue(string n,object v,RegistryValueKind kind){Keys[path][n]=v;}
  public void DeleteValue(string n){DeleteValue(n,true);}public void DeleteValue(string n,bool fail){Keys[path].Remove(n);}
  public int ValueCount{get{return Keys[path].Count;}}public int SubKeyCount{get{int n=0;foreach(string k in Keys.Keys)if(k.StartsWith(path+"\\")&&k.Substring(path.Length+1).IndexOf('\\')<0)n++;return n;}}
  public void DeleteSubKey(string p,bool fail){if(Keys[p].Count!=0)throw new Exception("nonempty deletion");foreach(string k in Keys.Keys)if(k.StartsWith(p+"\\"))throw new Exception("child deletion");Keys.Remove(p);}
  public void DeleteSubKeyTree(string p){throw new Exception("No tree deletion is allowed by rollback test");}
 }
}
public static class SetupRegistryHarness {
 static void Check(bool value,string message){if(!value)throw new Exception(message);}
 static void Write(List<Action> undo,string path,string name,string value){typeof(VisionDBrowserLauncher.Setup).GetMethod("WriteSetting",BindingFlags.Static|BindingFlags.NonPublic).Invoke(null,new object[]{undo,path,name,value});}
 static void Undo(List<Action> undo){for(int i=undo.Count-1;i>=0;i--)undo[i]();}
 public static void Main(string[] args){
  if(args.Length==1){
   var method=typeof(VisionDBrowserLauncher.Setup).GetMethod("RunExclusive",BindingFlags.Static|BindingFlags.NonPublic);
   try{method.Invoke(null,new object[]{(Action)(()=>{Console.WriteLine("LOCKED");if(args[0]=="hold")Console.ReadLine();})});}catch(TargetInvocationException e){Check(e.InnerException is InvalidOperationException,"expected busy failure");Console.WriteLine("BUSY");}return;
  }
  var paths=new[]{@"Software\Current\Run",@"Software\Classes\visiond-profile",@"Software\Classes\visiond-profile",@"Software\Classes\visiond-profile\shell\open\command",@"Software\Uninstall\VisionDHelper",@"Software\Uninstall\VisionDHelper",@"Software\Uninstall\VisionDHelper"};
  var names=new[]{"VisionDBrowserLauncher","","URL Protocol","","DisplayName","DisplayVersion","UninstallString"};
  for(int stop=1;stop<=paths.Length;stop++){
   FakeRegistry.Keys.Clear();FakeRegistry.CurrentUser.CreateSubKey("Software");var undo=new List<Action>();for(int i=0;i<stop;i++)Write(undo,paths[i],names[i],"owned"+i);Undo(undo);Check(FakeRegistry.Keys.Count==1,"partial first install leaves no retry-blocking empty keys at step "+stop);
  }
  FakeRegistry.Keys.Clear();var original=FakeRegistry.CurrentUser.CreateSubKey(@"Software\Current\Run");original.SetValue("VisionDBrowserLauncher","old");original.SetValue("OtherApp","other");var changes=new List<Action>();Write(changes,@"Software\Current\Run","VisionDBrowserLauncher","new");Undo(changes);Check((string)original.GetValue("VisionDBrowserLauncher",null)=="old","restore old startup");Check((string)original.GetValue("OtherApp",null)=="other","preserve unrelated setting");
  changes.Clear();Write(changes,@"Software\Classes\visiond-profile","","ours");FakeRegistry.CurrentUser.OpenSubKey(@"Software\Classes\visiond-profile").SetValue("","concurrent");Undo(changes);Check((string)FakeRegistry.CurrentUser.OpenSubKey(@"Software\Classes\visiond-profile").GetValue("",null)=="concurrent","do not remove concurrent changed value or its keys");
  Console.WriteLine("PASS actual Setup.WriteSetting rollback at seven partial-install boundaries; old/concurrent/foreign values preserved; no real registry touched");
  FakeRegistry.Keys.Clear();changes.Clear();typeof(VisionDBrowserLauncher.Setup).GetMethod("WriteRegistration",BindingFlags.Static|BindingFlags.NonPublic).Invoke(null,new object[]{changes});
  Check(FakeRegistry.Keys.ContainsKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\VisionDHelper"),"repair includes uninstall registration");
  Check(FakeRegistry.Keys.ContainsKey(@"Software\Classes\visiond-profile\shell\open\command"),"repair includes protocol registration");
  Check(FakeRegistry.Keys[@"Software\Microsoft\Windows\CurrentVersion\Run"].ContainsKey("VisionDBrowserLauncher"),"repair includes startup registration");Undo(changes);
  Console.WriteLine("PASS shared installed-image repair restores all owned registration surfaces and remains reversible");
 }
}
