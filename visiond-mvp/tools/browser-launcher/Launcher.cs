using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;

namespace VisionDBrowserLauncher
{
    internal sealed class LaunchRequest
    {
        internal string Kind;
        internal Guid ChannelId;
        internal Guid SlotId;
        internal string Intent;
    }

    internal static class Program
    {
        private const string SchemePrefix = "visiond-profile://open";
        private const string TikTokLoginUrl = "https://www.tiktok.com/login";
        private static readonly Regex ExistingPattern = new Regex(
            @"\Avisiond-profile://open/?\?mode=existing&channel_id=([0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12})(?:&intent=(view|tiktok|shop))?\z",
            RegexOptions.CultureInvariant);
        private static readonly Regex BoundExistingPattern = new Regex(
            @"\Avisiond-profile://open/?\?mode=existing&channel_id=([0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12})&slot_id=([0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12})&intent=(view|tiktok|shop)\z",
            RegexOptions.CultureInvariant);
        private static readonly Regex NewPattern = new Regex(
            @"\Avisiond-profile://open/?\?mode=new&slot_id=([0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12})\z",
            RegexOptions.CultureInvariant);

        private static int Main(string[] args)
        {
            try
            {
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

                Directory.CreateDirectory(profileDirectory);
                string chrome = FindChrome();
                if (chrome == null) return Fail("chrome_not_found");

                ProcessStartInfo start = new ProcessStartInfo();
                start.FileName = chrome;
                start.UseShellExecute = false;
                start.CreateNoWindow = true;
                start.Arguments = QuoteArgument("--user-data-dir=" + profileDirectory)
                    + " " + QuoteArgument("--new-window")
                    + " " + QuoteArgument(target);
                Process.Start(start);
                return 0;
            }
            catch
            {
                return Fail("launch_failed");
            }
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

            Match match = BoundExistingPattern.Match(raw);
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
            if (request.ChannelId == Guid.Empty)
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
}
