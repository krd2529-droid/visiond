using System;
using System.IO;

static class VRecordPackageVerify {
 static int Main(string[] args) {
  if(args.Length!=2)return 2;
  try { PackageIntegrity.Verify(args[0],File.ReadAllText(args[1]));Console.WriteLine("V-Record package integrity PASS");return 0; }
  catch(Exception error) { Console.Error.WriteLine(error.Message);return 1; }
 }
}
