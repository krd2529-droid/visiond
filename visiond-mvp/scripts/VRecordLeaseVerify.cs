using System;
using System.IO;
using System.Web.Script.Serialization;

internal static class VRecordLeaseVerify {
  static int Main(string[] args) {
    if(args.Length!=3)return 2;
    try {
      var key=File.ReadAllText(args[0]);
      var envelope=new JavaScriptSerializer().Deserialize<LicenseEnvelope>(File.ReadAllText(args[1]));
      var lease=LicenseClient.Verify(envelope,key,args[2],DateTime.UtcNow);
      Console.WriteLine(lease.ExpiresUtc.ToString("o"));
      return 0;
    } catch(Exception error) { Console.Error.WriteLine(error.Message);return 1; }
  }
}
