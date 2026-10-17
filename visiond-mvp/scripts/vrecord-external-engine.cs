using System;
using System.IO;
using System.Security.Cryptography;

static class ExternalEngine {
 const string ExpectedHash="3256173f3f8bffd7df12227c68adf68025edb1832273a9530688a7bb1ed8edec";
 const long ExpectedSize=105423872;
 internal static bool Ready(string path){
  try {
   var file=new FileInfo(path);
   if(!file.Exists||file.Length!=ExpectedSize||(file.Attributes&FileAttributes.ReparsePoint)!=0)return false;
   using(var stream=file.OpenRead())using(var sha=SHA256.Create())
    return BitConverter.ToString(sha.ComputeHash(stream)).Replace("-","").ToLowerInvariant()==ExpectedHash;
  } catch { return false; }
 }
}
