using System;

internal static class VRecordClientSmoke {
  static int Main(string[] args) {
    if(args.Length!=5)return 2;
    try {
      var client=new LicenseClient(System.IO.File.ReadAllText(args[0]),args[1],args[2],args[3]);
      client.ActivateAsync(args[4]).GetAwaiter().GetResult();
      if(client.Current()==null||!client.EnsureAsync(true).GetAwaiter().GetResult())throw new Exception("V-Record client did not activate and refresh");
      Console.WriteLine("C# client activation and refresh PASS");
      return 0;
    } catch(Exception error) { Console.Error.WriteLine(error);return 1; }
  }
}
