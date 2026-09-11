using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Collections.Generic;
using VisionDBrowserLauncher;
internal static class LauncherTransportHarness
{
 static void Check(bool value,string name){if(!value)throw new Exception(name);}
 static int Main(string[] args)
 {
  string id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",slot="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",root=args[0];Directory.CreateDirectory(root);
  Console.WriteLine("MAC="+LocalHelper.Mac(new string('a',64),LocalHelper.Canonical("claim",id,"1",slot,new string('b',64),"2030-01-01 00:00:00","")));
  var listener=new TcpListener(IPAddress.Loopback,0);listener.ExclusiveAddressUse=true;listener.Start();int port=((IPEndPoint)listener.LocalEndpoint).Port;int calls=0;
  string good="GET /launch?command_id="+id+" HTTP/1.1\r\nHost: 127.0.0.1:"+port+"\r\n\r\n",command;
  Check(LocalHelper.ParseLocalRequest(good,port,out command)&&command==id,"canonical local request");
  foreach(string bad in new string[]{good.Replace("GET ","POST "),good.Replace("127.0.0.1","localhost"),good.Replace(" HTTP/1.1","&ticket=secret HTTP/1.1"),good.Replace("Host:","Host: attacker\r\nHost:"),good.Replace("\r\n\r\n","\r\nTransfer-Encoding: chunked\r\n\r\n"),good.Replace("\r\n\r\n","\r\nContent-Length: 1\r\n\r\n"),good.TrimEnd(),new string('a',4097)})Check(!LocalHelper.ParseLocalRequest(bad,port,out command),"invalid local request");
  foreach(bool valid in new bool[]{true,false}){
   var server=new Thread(delegate(){using(var accepted=listener.AcceptTcpClient())LocalHelper.Handle(accepted,port,delegate(string received){Check(received==id,"dispatch id");Interlocked.Increment(ref calls);});});server.Start();
   using(var client=new TcpClient("127.0.0.1",port)){var stream=client.GetStream();byte[] bytes=Encoding.ASCII.GetBytes(valid?good:good.Replace("Host: 127.0.0.1","Host: evil.example"));stream.Write(bytes,0,bytes.Length);using(var reader=new StreamReader(stream)){string response=reader.ReadToEnd();Check(response.StartsWith(valid?"HTTP/1.1 202":"HTTP/1.1 400"),"actual HTTP status");Check(response.Contains("Cache-Control: no-store")&&response.Contains("Referrer-Policy: no-referrer"),"private local response");Check(!response.Contains(id)&&!response.Contains("ticket="),"no reflected capability/id");}}server.Join();
  }listener.Stop();Check(calls==1,"only valid request dispatches");
  int launched=0,claimed=0;string last="";
  Func<Dictionary<string,object>> claim=delegate{claimed++;return new Dictionary<string,object>{{"status","claimed"},{"id",id},{"slot_id",slot},{"profile_kind","channel"},{"ticket",new string('c',64)},{"intent","oauth"},{"expires_at",DateTime.UtcNow.AddMinutes(1).ToString("yyyy-MM-dd HH:mm:ss")}};};
  Func<LaunchRequest,int> launch=delegate(LaunchRequest request){Check(request.Kind=="channel"&&request.SlotId.ToString("D")==slot,"exact profile");Check(File.ReadAllText(Path.Combine(root,id+".journal"))=="unknown","reservation before launch");launched++;return 0;};
  try{LocalHelper.RunCommand(root,id,claim,launch,delegate(string state){last=state;throw new Exception("lost status response");});}catch(Exception e){Check(e.Message=="lost status response","expected simulated response loss");}
  LocalHelper.RunCommand(root,id,claim,launch,delegate(string state){last=state;});
  Check(launched==1&&claimed==1&&last=="process_started","lost response replays journal without launch");
  string ambiguous="cccccccc-cccc-4ccc-8ccc-cccccccccccc";File.WriteAllText(Path.Combine(root,ambiguous+".journal"),"unknown");
  LocalHelper.RunCommand(root,ambiguous,claim,launch,delegate(string state){last=state;});Check(last=="unknown"&&launched==1&&claimed==1,"restart reservation never relaunches");
  string denied="dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  LocalHelper.RunCommand(root,denied,delegate{return new Dictionary<string,object>{{"status","failed"},{"error_code","HELPER_UPDATE_REQUIRED"}};},launch,delegate(string state){last=state;});Check(launched==1&&!File.Exists(Path.Combine(root,denied+".journal")),"legacy update-required never launches or reserves profile");
  LocalHelper.RunCommand(root,denied,delegate{return new Dictionary<string,object>{{"status","process_started"}};},launch,delegate(string state){last=state;});Check(launched==1,"terminal backend does not launch");
  Console.WriteLine("PASS native actual HTTP strict parsing, no reflection, durable journal/idempotence/ambiguous crash and exact profile");return 0;
 }
}
