using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Collections.Generic;
using System.Net;
using System.Net.Sockets;
using System.Threading;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Security.AccessControl;
using System.Web.Script.Serialization;

namespace VisionDBrowserLauncher
{
    internal sealed class LaunchRequest
    {
        internal string Kind;
        internal Guid ChannelId;
        internal Guid SlotId;
        internal string Intent;
        internal string HandoffId;
        internal string Ticket;
    }

    internal static class Program
    {
        private const string SchemePrefix = "visiond-profile://open";
        private const string TikTokLoginUrl = "https://www.tiktok.com/login";
        private static readonly Regex HandoffPattern = new Regex(@"\Avisiond-profile://open/?\?mode=handoff&slot_id=([0-9a-f-]{36})&id=([0-9a-f-]{36})&ticket=([0-9a-f]{64})\z", RegexOptions.CultureInvariant);
        private static readonly Regex DirectHandoffPattern = new Regex(@"\Avisiond-profile://open/?\?mode=handoff&profile_kind=(slot|channel)&slot_id=([0-9a-f-]{36})&id=([0-9a-f-]{36})&ticket=([0-9a-f]{64})\z", RegexOptions.CultureInvariant);
        private static readonly Regex ExistingPattern = new Regex(
            @"\Avisiond-profile://open/?\?mode=existing&channel_id=([0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12})(?:&intent=(view|tiktok|shop))?\z",
            RegexOptions.CultureInvariant);
        private static readonly Regex BoundExistingPattern = new Regex(
            @"\Avisiond-profile://open/?\?mode=existing&channel_id=([0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12})&slot_id=([0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12})&intent=(view|tiktok|shop)\z",
            RegexOptions.CultureInvariant);
        private static readonly Regex NewPattern = new Regex(
            @"\Avisiond-profile://open/?\?mode=new&slot_id=([0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12})\z",
            RegexOptions.CultureInvariant);

        [STAThread] private static int Main(string[] args)
        {
            try
            {
                if (args.Length == 0) return Setup.Show();
                if (args.Length == 1 && args[0] == "--init") return LocalHelper.Initialize();
                if (args.Length == 1 && args[0] == "--serve") return LocalHelper.Serve();
                if (args.Length == 1 && args[0] == "--pair") return LocalHelper.Pair();
                if (args.Length == 1 && args[0] == "--pair-replace") return LocalHelper.ReplacePair();
                bool inspect = args.Length == 2 && args[0] == "--inspect";
                if ((!inspect && args.Length != 1) || (inspect && args.Length != 2)) return Fail("invalid_arguments");

                LaunchRequest request;
                string raw = inspect ? args[1] : args[0];
                if (!TryParse(raw, out request)) return Fail("invalid_request");

                string profileDirectory = ProfileDirectory(request, Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData));
                string target = TargetUrl(request);
                if (inspect)
                {
                    Console.WriteLine("kind=" + request.Kind);
                    Console.WriteLine("channel_id=" + (request.ChannelId == Guid.Empty ? "" : request.ChannelId.ToString("D")));
                    Console.WriteLine("slot_id=" + request.SlotId.ToString("D"));
                    Console.WriteLine("profile_leaf=" + Path.GetFileName(profileDirectory));
                    Uri targetUri = new Uri(target);
                    Console.WriteLine("target=" + targetUri.GetLeftPart(UriPartial.Path));
                    Console.WriteLine("target_has_query=" + (!String.IsNullOrEmpty(targetUri.Query) ? "true" : "false"));
                    return 0;
                }

                return Launch(request);
            }
            catch
            {
                return Fail("launch_failed");
            }
        }

        internal static int Launch(LaunchRequest request)
        {
                string profileDirectory = ProfileDirectory(request, Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData));
                string target = TargetUrl(request);
                Directory.CreateDirectory(profileDirectory);
                string chrome = FindChrome();
                if (chrome == null) return Fail("chrome_not_found");

                ProcessStartInfo start = new ProcessStartInfo();
                start.FileName = chrome;
                start.UseShellExecute = false;
                start.CreateNoWindow = true;
                start.Arguments = QuoteArgument("--user-data-dir=" + profileDirectory)
                    + " " + QuoteArgument("--no-default-browser-check")
                    + " " + QuoteArgument("--new-window")
                    + " " + QuoteArgument(target);
                Process.Start(start);
                return 0;
        }

        internal static bool TryParse(string raw, out LaunchRequest request)
        {
            request = null;
            if (String.IsNullOrEmpty(raw) || raw.Length > 240 || !raw.StartsWith(SchemePrefix, StringComparison.Ordinal)) return false;
            for (int i = 0; i < raw.Length; i++)
            {
                char c = raw[i];
                if (c < 0x21 || c > 0x7e || c == '%' || c == '#' || c == '\\' || c == '"' || c == '\'') return false;
            }

            Match match = DirectHandoffPattern.Match(raw);
            if(match.Success)
            {
                Guid slotId,handoffId;
                if(!Guid.TryParseExact(match.Groups[2].Value,"D",out slotId)||!IsProfileSlot(slotId)||!Guid.TryParseExact(match.Groups[3].Value,"D",out handoffId)||!IsProfileSlot(handoffId))return false;
                request=new LaunchRequest { Kind=match.Groups[1].Value, SlotId=slotId, ChannelId=Guid.Empty, Intent="handoff", HandoffId=handoffId.ToString("D"), Ticket=match.Groups[4].Value };
                return true;
            }
            match = HandoffPattern.Match(raw);
            if(match.Success)
            {
                Guid slotId, handoffId;
                if(!Guid.TryParseExact(match.Groups[1].Value,"D",out slotId)||!IsProfileSlot(slotId)
                    ||!Guid.TryParseExact(match.Groups[2].Value,"D",out handoffId)||!IsProfileSlot(handoffId))return false;
                request=new LaunchRequest { Kind="slot", SlotId=slotId, ChannelId=Guid.Empty, Intent="handoff", HandoffId=handoffId.ToString("D"), Ticket=match.Groups[3].Value };
                return true;
            }
            match = BoundExistingPattern.Match(raw);
            if (match.Success)
            {
                Guid channelId, slotId;
                if (!Guid.TryParseExact(match.Groups[1].Value, "D", out channelId) || channelId == Guid.Empty
                    || !Guid.TryParseExact(match.Groups[2].Value, "D", out slotId) || !IsProfileSlot(slotId)) return false;
                request = new LaunchRequest { Kind = "slot", ChannelId = channelId, SlotId = slotId, Intent = match.Groups[3].Value };
                return true;
            }
            match = ExistingPattern.Match(raw);
            if (match.Success)
            {
                Guid channelId;
                if (!Guid.TryParseExact(match.Groups[1].Value, "D", out channelId) || channelId == Guid.Empty) return false;
                request = new LaunchRequest { Kind = "channel", ChannelId = channelId, SlotId = channelId, Intent = match.Groups[2].Success ? match.Groups[2].Value : "view" };
                return true;
            }
            match = NewPattern.Match(raw);
            if (!match.Success) return false;
            Guid pendingSlot;
            if (!Guid.TryParseExact(match.Groups[1].Value, "D", out pendingSlot) || !IsProfileSlot(pendingSlot)) return false;
            request = new LaunchRequest { Kind = "slot", ChannelId = Guid.Empty, SlotId = pendingSlot, Intent = "tiktok_new" };
            return true;
        }

        private static bool IsProfileSlot(Guid id)
        {
            if (id == Guid.Empty) return false;
            string value = id.ToString("D");
            char version = value[14], variant = value[19];
            return version >= '1' && version <= '5' && (variant == '8' || variant == '9' || variant == 'a' || variant == 'b');
        }

        internal static string ProfileDirectory(LaunchRequest request, string localAppData)
        {
            if (String.IsNullOrEmpty(localAppData)) throw new InvalidOperationException("local_app_data_missing");
            string appRoot = Path.Combine(localAppData, "VisionD", "BrowserLauncher");
            string profilesRoot = Path.GetFullPath(Path.Combine(appRoot, "Profiles"));
            string leaf = request.Kind + "-" + request.SlotId.ToString("D");
            string candidate = Path.GetFullPath(Path.Combine(profilesRoot, leaf));
            string boundary = profilesRoot.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            if (!candidate.StartsWith(boundary, StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("profile_outside_root");
            return candidate;
        }

        internal static string TargetUrl(LaunchRequest request)
        {
            string slotId = request.SlotId.ToString("D");
            if(request.Intent=="handoff")return "https://visiondonline.com/tiktok-handoff.html#id="+request.HandoffId+"&slot_id="+slotId+"&profile_kind="+request.Kind+"&ticket="+request.Ticket;
            if (request.ChannelId == Guid.Empty || request.Intent == "view")
                return TikTokLoginUrl;
            string target = "https://visiondonline.com/tiktok-analyzer?channel_id=" + request.ChannelId.ToString("D") + "&launcher_profile=1&launcher_mode=existing";
            if (request.Kind == "slot") target += "&launcher_slot=" + slotId;
            if (request.Intent != "view") target += "&connect=" + request.Intent;
            return target;
        }

        private static string FindChrome()
        {
            string[] candidates = new string[] {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Google", "Chrome", "Application", "chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Google", "Chrome", "Application", "chrome.exe")
            };
            foreach (string candidate in candidates)
                if (!String.IsNullOrEmpty(candidate) && File.Exists(candidate)) return Path.GetFullPath(candidate);
            return null;
        }

        // Windows CommandLineToArgvW-compatible quoting. Variable values are already restricted to
        // fixed switches, the app-owned path and a fixed-origin URL containing canonical UUIDs.
        internal static string QuoteArgument(string value)
        {
            StringBuilder result = new StringBuilder();
            result.Append('"');
            int slashes = 0;
            foreach (char c in value)
            {
                if (c == '\\') { slashes++; continue; }
                if (c == '"')
                {
                    result.Append('\\', slashes * 2 + 1);
                    result.Append('"');
                    slashes = 0;
                    continue;
                }
                result.Append('\\', slashes);
                slashes = 0;
                result.Append(c);
            }
            result.Append('\\', slashes * 2);
            result.Append('"');
            return result.ToString();
        }

        private static int Fail(string code)
        {
            Console.Error.WriteLine(code);
            return 2;
        }
    }

    // Browser navigation conveys only a non-authorizing command ID. All capability
    // exchange and acknowledgement use the fixed TLS API and the DPAPI-protected key.
    internal static class LocalHelper
    {
        internal const string Origin = "https://visiondonline.com";
        private static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 8192, RecursionLimit = 8 };
        private static readonly string Root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "VisionD", "BrowserLauncher", "Transport");
        private static readonly string ConfigPath = Path.Combine(Root, "helper.dpapi");
        private static readonly object WorkLock = new object();
        private static Dictionary<string, object> config;
        internal static string Hex(byte[] value) { return BitConverter.ToString(value).Replace("-", "").ToLowerInvariant(); }
        internal static byte[] Unhex(string value) { if (!Regex.IsMatch(value ?? "", "\\A[0-9a-f]{64}\\z")) throw new InvalidDataException(); byte[] result=new byte[32]; for(int i=0;i<32;i++)result[i]=Convert.ToByte(value.Substring(i*2,2),16);return result; }
        private static string RandomHex() { byte[] value=new byte[32];using(var rng=RandomNumberGenerator.Create())rng.GetBytes(value);return Hex(value); }
        internal static string Digest(string value) { using(var hash=SHA256.Create())return Hex(hash.ComputeHash(Encoding.UTF8.GetBytes(value))); }
        internal static string Mac(string secret,string value) { using(var hmac=new HMACSHA256(Unhex(secret)))return Hex(hmac.ComputeHash(Encoding.UTF8.GetBytes(value))); }
        internal static string Canonical(string purpose,string helper,string version,string command,string nonce,string expiry,string payload) { if(version!="1")throw new InvalidDataException();return String.Join("\n",new string[]{"visiond-launcher-v1",purpose,"POST","/api/launcher/"+purpose,helper,version,command,nonce,expiry,Digest(payload)}); }
        private static string Field(Dictionary<string,object> value,string name) { object found;return value.TryGetValue(name,out found)?Convert.ToString(found,System.Globalization.CultureInfo.InvariantCulture):""; }
        private static void RestrictDirectory()
        {
            Directory.CreateDirectory(Root);
            var acl=new DirectorySecurity();acl.SetAccessRuleProtection(true,false);
            foreach(var sid in new SecurityIdentifier[]{WindowsIdentity.GetCurrent().User,new SecurityIdentifier(WellKnownSidType.LocalSystemSid,null)})
                acl.AddAccessRule(new FileSystemAccessRule(sid,FileSystemRights.FullControl,InheritanceFlags.ContainerInherit|InheritanceFlags.ObjectInherit,PropagationFlags.None,AccessControlType.Allow));
            Directory.SetAccessControl(Root,acl);
        }
        internal static int Initialize()
        {
            RestrictDirectory();
            if(File.Exists(ConfigPath)){Load();Console.WriteLine("helper_id="+Field(config,"helper_id"));Console.WriteLine("port="+Field(config,"port"));return 0;}
            int port;var listener=new TcpListener(IPAddress.Loopback,0);listener.ExclusiveAddressUse=true;listener.Start();port=((IPEndPoint)listener.LocalEndpoint).Port;listener.Stop();
            if(port<49152)throw new InvalidOperationException("ephemeral_port_outside_range");
            config=new Dictionary<string,object>{{"helper_id",Guid.NewGuid().ToString("D")},{"owner_hash",Digest(WindowsIdentity.GetCurrent().User.Value)},{"port",port},{"secret",RandomHex()},{"pair_code",RandomHex().Substring(0,8).ToUpperInvariant()}};
            byte[] plain=Encoding.UTF8.GetBytes(Json.Serialize(config)),cipher=ProtectedData.Protect(plain,null,DataProtectionScope.CurrentUser);
            using(var file=new FileStream(ConfigPath,FileMode.CreateNew,FileAccess.Write,FileShare.None)){file.Write(cipher,0,cipher.Length);file.Flush(true);}
            Console.WriteLine("helper_id="+Field(config,"helper_id"));Console.WriteLine("port="+port);return 0;
        }
        private static void Load()
        {
            byte[] cipher=File.ReadAllBytes(ConfigPath);if(cipher.Length>8192)throw new InvalidDataException();
            config=Json.Deserialize<Dictionary<string,object>>(Encoding.UTF8.GetString(ProtectedData.Unprotect(cipher,null,DataProtectionScope.CurrentUser)));
            Guid id;if(!Guid.TryParseExact(Field(config,"helper_id"),"D",out id)||id==Guid.Empty||Field(config,"owner_hash")!=Digest(WindowsIdentity.GetCurrent().User.Value))throw new InvalidDataException();
            Unhex(Field(config,"secret"));int port;if(!Int32.TryParse(Field(config,"port"),out port)||port<49152||port>65535)throw new InvalidDataException();
        }
        internal static Dictionary<string,object> Api(string action,Dictionary<string,object> payload)
        {
            if(!Regex.IsMatch(action,"\\A(?:pair-stage|pair-state|challenge|claim|status)\\z"))throw new InvalidDataException();
            ServicePointManager.SecurityProtocol=SecurityProtocolType.Tls12;
            var request=(HttpWebRequest)WebRequest.Create(Origin+"/api/launcher/"+action);
            request.Method="POST";request.ContentType="application/json";request.AllowAutoRedirect=false;request.Timeout=10000;request.ReadWriteTimeout=10000;request.Proxy=null;
            byte[] bytes=Encoding.UTF8.GetBytes(Json.Serialize(payload));request.ContentLength=bytes.Length;
            using(var stream=request.GetRequestStream())stream.Write(bytes,0,bytes.Length);
            using(var response=(HttpWebResponse)request.GetResponse())
            {if(response.StatusCode!=HttpStatusCode.OK)throw new InvalidDataException();using(var reader=new StreamReader(response.GetResponseStream())){char[] buffer=new char[8193];int n=0,count;while(n<buffer.Length&&(count=reader.Read(buffer,n,buffer.Length-n))>0)n+=count;if(n>8192)throw new InvalidDataException();return Json.Deserialize<Dictionary<string,object>>(new string(buffer,0,n));}}
        }
        internal static string PairStatus="";
        internal static int Pair()
        {
            Load();return PairLoaded();
        }
        private static int PairLoaded()
        {
            var stage=Api("pair-stage",config);if(Field(stage,"paired")=="True"){PairStatus="ตัวช่วยนี้ผูกบัญชีแล้ว กลับ VisionD ด้วยบัญชีและเบราว์เซอร์ที่ยืนยันไว้ หากยังเชื่อมไม่ได้ให้ตรวจสถานะในหน้าเว็บไซต์";Console.WriteLine("This helper is already paired.");return 0;}
            // --pair is an explicit setup action, never invoked automatically by install/serve.
            Console.WriteLine("Match this installation code before confirming: "+Field(config,"pair_code"));
            Console.WriteLine("Open VisionD and click: ยืนยันผูกตัวช่วยเครื่องนี้");
            var start=new ProcessStartInfo(Origin+"/launcher-pair.html#id="+Field(config,"helper_id"));start.UseShellExecute=true;Process.Start(start);
            PairCodeMessage(IntPtr.Zero,"รหัสตัวช่วยเครื่องนี้: "+Field(config,"pair_code")+"\nตรวจว่าตรงกับหน้า VisionD ก่อนกดยืนยันผูกตัวช่วยเครื่องนี้", "VisionD · ยืนยันตัวช่วย",0);PairStatus="ส่งคำขอเปิดหน้าผูกเครื่องแล้ว ทำตามรหัสในหน้า VisionD การปิดกล่องรหัสยังไม่ใช่การยืนยันผูกเครื่อง";return 0;
        }
        [System.Runtime.InteropServices.DllImport("user32.dll",CharSet=System.Runtime.InteropServices.CharSet.Unicode,EntryPoint="MessageBoxW")]
        private static extern int PairCodeMessage(IntPtr owner,string text,string caption,uint type);
        internal static int ReplacePair()
        {
            Load();string candidate=Path.Combine(Root,"helper.pending.dpapi");
            if(File.Exists(candidate)){
                byte[] staged=File.ReadAllBytes(candidate);if(staged.Length>8192)throw new InvalidDataException();
                var pending=Json.Deserialize<Dictionary<string,object>>(Encoding.UTF8.GetString(ProtectedData.Unprotect(staged,null,DataProtectionScope.CurrentUser)));
                if(Field(pending,"owner_hash")!=Field(config,"owner_hash")||Field(pending,"port")!=Field(config,"port"))throw new InvalidDataException();
                Unhex(Field(pending,"secret"));config=pending;
            }else{
                config["helper_id"]=Guid.NewGuid().ToString("D");config["secret"]=RandomHex();config["pair_code"]=RandomHex().Substring(0,8).ToUpperInvariant();
                byte[] data=ProtectedData.Protect(Encoding.UTF8.GetBytes(Json.Serialize(config)),null,DataProtectionScope.CurrentUser);
                using(var file=new FileStream(candidate,FileMode.CreateNew,FileAccess.Write,FileShare.None)){file.Write(data,0,data.Length);file.Flush(true);}
            }
            PairLoaded();
            // Keep the active key untouched unless the authenticated backend confirms replacement.
            for(int i=0;i<60;i++){Thread.Sleep(3000);try{var status=Signed("pair-state",Field(config,"helper_id"),"");if(Field(status,"paired")=="True"&&Field(status,"helper_id")==Field(config,"helper_id")){File.Replace(candidate,ConfigPath,null);return 0;}}catch(WebException){/* Resume the same staged key after a transient TLS/network failure. */}}
            Console.Error.WriteLine("pairing_confirmation_timeout_active_key_preserved");return 2;
        }
        private static Dictionary<string,object> Signed(string purpose,string command,string payload)
        {
            var challenge=Api("challenge",new Dictionary<string,object>{{"helper_id",Field(config,"helper_id")},{"command_id",command},{"purpose",purpose}});
            string nonce=Field(challenge,"nonce"),expiry=Field(challenge,"expires_at");Unhex(nonce);
            return Api(purpose,new Dictionary<string,object>{{"helper_id",Field(config,"helper_id")},{"key_version",1},{"command_id",command},{"nonce",nonce},{"expires_at",expiry},{"payload",payload},{"mac",Mac(Field(config,"secret"),Canonical(purpose,Field(config,"helper_id"),"1",command,nonce,expiry,payload))}});
        }
        internal static bool ParseLocalRequest(string header,int port,out string command)
        {
            command=null;if(header==null||header.Length>4096||!header.EndsWith("\r\n\r\n",StringComparison.Ordinal)||header.IndexOf('\0')>=0)return false;
            string[] lines=header.Split(new string[]{"\r\n"},StringSplitOptions.None);
            var match=Regex.Match(lines[0],"\\AGET /launch\\?command_id=([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}) HTTP/1\\.[01]\\z");if(!match.Success)return false;
            var names=new HashSet<string>(StringComparer.OrdinalIgnoreCase);string host="";
            for(int i=1;i<lines.Length;i++){if(lines[i]=="")continue;int split=lines[i].IndexOf(':');if(split<=0||Char.IsWhiteSpace(lines[i][0]))return false;string name=lines[i].Substring(0,split),value=lines[i].Substring(split+1).Trim();if(!names.Add(name)||name.Equals("Transfer-Encoding",StringComparison.OrdinalIgnoreCase)||name.Equals("Content-Length",StringComparison.OrdinalIgnoreCase)&&value!="0")return false;if(name.Equals("Host",StringComparison.OrdinalIgnoreCase))host=value;}
            if(host!="127.0.0.1:"+port)return false;command=match.Groups[1].Value;return true;
        }
        private static void Journal(string path,string state)
        {
            byte[] bytes=Encoding.ASCII.GetBytes(state);using(var file=new FileStream(path,FileMode.Create,FileAccess.Write,FileShare.None)){file.Write(bytes,0,bytes.Length);file.Flush(true);}
        }
        private static void Execute(string command)
        {
            lock(WorkLock)
            {
                Load();
                RunCommand(Root,command,delegate{return Signed("claim",command,"");},Program.Launch,delegate(string state){Signed("status",command,state);});
            }
        }
        internal static void RunCommand(string journalRoot,string command,Func<Dictionary<string,object>> claimAction,Func<LaunchRequest,int> launchAction,Action<string> reportAction)
        {
            lock(WorkLock)
            {
                Guid commandGuid;if(!Guid.TryParseExact(command,"D",out commandGuid)||commandGuid==Guid.Empty)throw new InvalidDataException();
                string path=Path.Combine(journalRoot,command+".journal");
                if(File.Exists(path)){string previous=File.ReadAllText(path);reportAction(previous=="process_started"||previous=="failed"?previous:"unknown");return;}
                var claim=claimAction();if(Field(claim,"status")!="claimed")return;
                DateTime expires;if(!DateTime.TryParseExact(Field(claim,"expires_at"),"yyyy-MM-dd HH:mm:ss",System.Globalization.CultureInfo.InvariantCulture,System.Globalization.DateTimeStyles.AssumeUniversal|System.Globalization.DateTimeStyles.AdjustToUniversal,out expires)||expires<=DateTime.UtcNow)return;
                string kind=Field(claim,"profile_kind"),slot=Field(claim,"slot_id"),id=Field(claim,"id"),ticket=Field(claim,"ticket");
                string uri=Field(claim,"intent")=="view"?"visiond-profile://open?mode=existing&channel_id="+slot+(kind=="slot"?"&slot_id="+slot:"")+"&intent=view":"visiond-profile://open?mode=handoff&profile_kind="+kind+"&slot_id="+slot+"&id="+id+"&ticket="+ticket;
                LaunchRequest launch;if((kind!="slot"&&kind!="channel")||!Program.TryParse(uri,out launch)||Field(claim,"intent")!="view"&&Field(claim,"intent")!="oauth")throw new InvalidDataException();
                // Durable reservation precedes the external side effect. A crash leaves unknown,
                // never a second Process.Start. No ticket/profile data is stored in this journal.
                using(var reserve=new FileStream(path,FileMode.CreateNew,FileAccess.Write,FileShare.None)){byte[] data=Encoding.ASCII.GetBytes("unknown");reserve.Write(data,0,data.Length);reserve.Flush(true);}
                string status="unknown";try{status=launchAction(launch)==0?"process_started":"failed";}catch{status="unknown";}
                Journal(path,status);reportAction(status);
                // Bounded retention: inspect at most 24 journal names, no profile directories.
                int checkedCount=0;foreach(string old in Directory.EnumerateFiles(journalRoot,"*.journal")){if(++checkedCount>24)break;if(File.GetLastWriteTimeUtc(old)<DateTime.UtcNow.AddDays(-1))File.Delete(old);}
            }
        }
        private static int active;
        internal static int Serve()
        {
            Load();bool created;
            using(var mutex=new Mutex(true,"Local\\VisionDLauncher-"+Field(config,"owner_hash"),out created))
            {
                if(!created)return 0;
                var listener=new TcpListener(IPAddress.Loopback,Int32.Parse(Field(config,"port")));listener.ExclusiveAddressUse=true;listener.Start(8);
                while(true){var client=listener.AcceptTcpClient();if(Interlocked.Increment(ref active)>8){Interlocked.Decrement(ref active);client.Close();continue;}
                    ThreadPool.QueueUserWorkItem(delegate{try{Handle(client,Int32.Parse(Field(config,"port")),Execute);}catch{}finally{client.Close();Interlocked.Decrement(ref active);}});}
            }
        }
        internal static void Handle(TcpClient client,int port,Action<string> dispatch)
        {
            client.ReceiveTimeout=3000;client.SendTimeout=3000;string command;
            using(var stream=client.GetStream())
            {
                var header=new StringBuilder();while(header.Length<4096){int b=stream.ReadByte();if(b<0)return;if(b>127||b==0)return;header.Append((char)b);if(header.Length>=4&&header.ToString(header.Length-4,4)=="\r\n\r\n")break;}
                bool valid=ParseLocalRequest(header.ToString(),port,out command);
                string nonce=RandomHex(),html="<!doctype html><meta charset=utf-8><title>VisionD Launcher</title><p>กลับไปดูสถานะที่ VisionD ได้เลย หน้านี้ไม่ได้ยืนยันว่าเชื่อม API แล้ว</p><script nonce=\""+nonce+"\">setTimeout(function(){window.close()},800)</script>";
                byte[] body=Encoding.UTF8.GetBytes(html),head=Encoding.ASCII.GetBytes("HTTP/1.1 "+(valid?"202 Accepted":"400 Bad Request")+"\r\nContent-Type: text/html; charset=utf-8\r\nCache-Control: no-store\r\nReferrer-Policy: no-referrer\r\nContent-Security-Policy: default-src 'none'; script-src 'nonce-"+nonce+"'; frame-ancestors 'none'\r\nX-Frame-Options: DENY\r\nConnection: close\r\nContent-Length: "+body.Length+"\r\n\r\n");stream.Write(head,0,head.Length);stream.Write(body,0,body.Length);stream.Flush();
                if(valid){try{dispatch(command);}catch{}}
            }
        }
    }
}
