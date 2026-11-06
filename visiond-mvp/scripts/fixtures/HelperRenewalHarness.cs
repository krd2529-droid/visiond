using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Web.Script.Serialization;
using VisionDBrowserLauncher;

public static class HelperRenewalHarness {
 static readonly JavaScriptSerializer Json=new JavaScriptSerializer();
 static void Check(bool value,string message){if(!value)throw new Exception(message);}
 static Dictionary<string,object> Read(string path){return Json.Deserialize<Dictionary<string,object>>(Encoding.UTF8.GetString(ProtectedData.Unprotect(File.ReadAllBytes(path),null,DataProtectionScope.CurrentUser)));}
 static void Write(string path,Dictionary<string,object> value){File.WriteAllBytes(path,ProtectedData.Protect(Encoding.UTF8.GetBytes(Json.Serialize(value)),null,DataProtectionScope.CurrentUser));}
 public static int Main(string[] args){
  string root=Path.Combine(args[0],"fixture");
  string transport=Path.Combine(root,"Transport"),profiles=Path.Combine(root,"Profiles"),active=Path.Combine(transport,"helper.dpapi"),candidate=Path.Combine(transport,"helper.renew.dpapi"),profile=Path.Combine(profiles,"existing-profile"),other=Path.Combine(transport,"unrelated.txt");
  Directory.CreateDirectory(transport);Directory.CreateDirectory(profiles);
  try{
   File.WriteAllText(profile,"profile-preserved");File.WriteAllText(other,"transport-preserved");
   string oldId="cccccccc-cccc-4ccc-8ccc-cccccccccccc",target="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",intent="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
   var original=new Dictionary<string,object>{{"helper_id",oldId},{"owner_hash",LocalHelper.Digest(WindowsIdentity.GetCurrent().User.Value)},{"port",57093},{"secret",new string('a',64)},{"pair_code","12ABCDEF"}};
   Write(active,original);string oldHash=Setup.Hash(active);int staged=0;
   var waiting=new Func<Dictionary<string,object>>(()=>new Dictionary<string,object>{{"paired",false},{"helper_id",""},{"replaces_helper_id",""}});
   Check(LocalHelper.RenewRevokedPairAt(intent,active,candidate,waiting,()=>{staged++;Check(File.Exists(candidate),"candidate absent during stage");},()=>{},2)==2,"unconfirmed renewal advanced");
   Check(staged==1&&Setup.Hash(active)==oldHash&&File.Exists(candidate),"old config changed before confirmation");
   var pending=Read(candidate);string newId=Convert.ToString(pending["helper_id"]);
   Check(newId!=oldId&&Convert.ToString(pending["secret"])!=Convert.ToString(original["secret"]),"candidate identity not rotated");
   Check(Convert.ToString(pending["owner_hash"])==Convert.ToString(original["owner_hash"])&&Convert.ToInt32(pending["port"])==57093,"candidate owner/port changed");
   Check(Convert.ToString(pending["renew_previous_id"])==oldId&&Convert.ToString(pending["renew_previous_hash"])==oldHash,"candidate lacks old-key proof");
   var wrong=new Func<Dictionary<string,object>>(()=>new Dictionary<string,object>{{"paired",true},{"helper_id",newId},{"replaces_helper_id",oldId}});
   Check(LocalHelper.RenewRevokedPairAt(intent,active,candidate,wrong,()=>{},()=>{},0)==2&&Setup.Hash(active)==oldHash,"wrong replacement promoted candidate");
   var confirmed=new Func<Dictionary<string,object>>(()=>new Dictionary<string,object>{{"paired",true},{"helper_id",newId},{"replaces_helper_id",target}});
   Check(LocalHelper.RenewRevokedPairAt(intent,active,candidate,confirmed,()=>{throw new Exception("confirmed candidate restaged");},()=>{},0)==0,"confirmed candidate not promoted");
   Check(!File.Exists(candidate)&&Convert.ToString(Read(active)["helper_id"])==newId,"same candidate not atomically promoted");
   Check(File.ReadAllText(profile)=="profile-preserved"&&File.ReadAllText(other)=="transport-preserved","unrelated data changed");
   Console.WriteLine("PASS isolated native renewal preserves old DPAPI until signed confirmation, resumes same candidate after crash, and leaves Profiles/Transport untouched");return 0;
  }finally{Directory.Delete(root,true);}
 }
}
