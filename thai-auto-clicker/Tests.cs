using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows.Forms;
namespace ThaiAutoClicker {
 public static class QaProgram {
  [STAThread] public static void Main(){Native.SetProcessDPIAware();Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);Environment.Exit(Tests.Run(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"interactive-test.txt"),true));}
 }
 public static class Tests {
  static List<string> log=new List<string>();
  static void Check(bool condition,string name){if(!condition)throw new Exception("FAIL "+name);log.Add("PASS "+name);}
  public static int Run(string output,bool interactive){Point old=Cursor.Position;try{
   var r=Screen.PrimaryScreen.Bounds;var p=new Profile{Version=1,Loops=2,Targets=new List<Target>{new Target{X=r.Left+100,Y=r.Top+100,WaitMs=120},new Target{X=r.Left+200,Y=r.Top+100,WaitMs=240}}};
   var clicks=new List<int>();var seq=new Sequence();seq.Start(p,0,3000,delegate(Target t){clicks.Add(t.X);});seq.Tick(2999);Check(clicks.Count==0,"countdown no early click");seq.Tick(3000);seq.Tick(3119);Check(clicks.Count==1,"per target wait");seq.Tick(3120);seq.Tick(3359);Check(clicks.Count==2,"second target wait");seq.Tick(3360);seq.Tick(3480);Check(!seq.Running&&seq.Completed==2&&clicks.Count==4&&clicks[0]==clicks[2]&&clicks[1]==clicks[3],"finite order and rounds");
   p.Loops=0;clicks.Clear();seq.Start(p,0,0,delegate(Target t){clicks.Add(t.X);});seq.Tick(0);seq.Stop();seq.Tick(86400000);Check(clicks.Count==1&&!seq.Running,"infinite stop interrupts wait");seq.Start(p,0,3000,delegate(Target t){clicks.Add(t.X);});seq.Stop();seq.Tick(3000);Check(clicks.Count==1,"stop during countdown");
   string path=Path.Combine(Path.GetTempPath(),"thai-clicker-"+Guid.NewGuid()+".json");try{Profiles.Save(path,p);var loaded=Profiles.Load(path);Check(loaded.Loops==0&&loaded.Targets.Count==2&&loaded.Targets[1].WaitMs==240,"profile round trip");File.WriteAllText(path,"{\"Version\":99,\"Loops\":1,\"Targets\":[]}");bool rejected=false;try{Profiles.Load(path);}catch{rejected=true;}Check(rejected,"invalid profile rejected");}finally{if(File.Exists(path))File.Delete(path);}
   bool bounds=false;p.Targets[0].X=int.MinValue;try{Profiles.Validate(p);}catch{bounds=true;}Check(bounds,"off screen coordinates rejected");
   RealClicks(interactive); GlobalStop(); log.Add("ALL TESTS PASSED");File.WriteAllLines(output,log);return 0;
  }catch(Exception ex){log.Add(ex.ToString());File.WriteAllLines(output,log);return 1;}finally{Cursor.Position=old;}}
  [StructLayout(LayoutKind.Explicit,Size=40)] struct KeyboardInput {[FieldOffset(0)]public uint Type;[FieldOffset(8)]public ushort Key;[FieldOffset(12)]public uint Flags;}
  [DllImport("user32.dll",EntryPoint="SendInput")] static extern uint SendKeysNative(uint count,KeyboardInput[] inputs,int size);
  static void EmergencyKeys(){var keys=new KeyboardInput[6];ushort[] codes={0x11,0x10,0x7B,0x7B,0x10,0x11};for(int i=0;i<6;i++)keys[i]=new KeyboardInput{Type=1,Key=codes[i],Flags=i>=3?2u:0u};if(SendKeysNative(6,keys,40)!=6){SendKeysNative(3,new KeyboardInput[]{keys[3],keys[4],keys[5]},40);throw new Exception("Cannot inject test emergency key");}}
  static void GlobalStop(){using(var main=new MainForm())using(var timer=new Timer{Interval=25}){
   var clock=new Stopwatch();Exception failure=null;int attempts=0;bool sent=false;
   main.Shown+=delegate{main.BeginInvoke(new Action(delegate{try{main.Activate();main.BeginStopTest(delegate{attempts++;});Check(main.TestRunning&&main.TestMarkersHidden,"main countdown hides markers");clock.Start();timer.Start();}catch(Exception ex){failure=ex;main.Close();}}));};
   timer.Tick+=delegate{try{if(!sent&&clock.ElapsedMilliseconds>=300){if(Native.GetForegroundWindow()!=main.Handle)throw new Exception("Stop test main not foreground; no keys sent");EmergencyKeys();sent=true;}
     if(sent&&clock.ElapsedMilliseconds>=800&&main.TestRunning)throw new Exception("Global emergency stop did not stop countdown");
     if(clock.ElapsedMilliseconds>=3400){Check(sent&&!main.TestRunning&&attempts==0,"real global Ctrl Shift F12 cancels countdown with zero clicks");Check(!main.TestMarkersHidden,"stop restores markers");timer.Stop();main.Close();}
    }catch(Exception ex){failure=ex;timer.Stop();main.Close();}};
   try{Application.Run(main);}finally{timer.Stop();}if(failure!=null)throw failure;
  }}
  static void RealClicks(bool interactive){using(var target=new Form{Text="Thai Auto Clicker — dedicated test target",StartPosition=FormStartPosition.CenterScreen,Size=new Size(550,300),TopMost=true}){
   var a=new Button{Text="TEST A",Location=new Point(40,80),Size=new Size(160,80)};var b=new Button{Text="TEST B",Location=new Point(280,80),Size=new Size(160,80)};target.Controls.Add(a);target.Controls.Add(b);var received=new List<string>();var times=new List<long>();var clock=Stopwatch.StartNew();a.Click+=delegate{received.Add("A");times.Add(clock.ElapsedMilliseconds);};b.Click+=delegate{received.Add("B");times.Add(clock.ElapsedMilliseconds);};
   var seq=new Sequence();Exception failure=null;var timer=new Timer{Interval=15};long deadline=0;Action begin=delegate{target.Activate();var pa=a.PointToScreen(new Point(80,40));var pb=b.PointToScreen(new Point(80,40));var p=new Profile{Version=1,Loops=2,Targets=new List<Target>{new Target{X=pa.X,Y=pa.Y,WaitMs=180},new Target{X=pb.X,Y=pb.Y,WaitMs=220}}};deadline=clock.ElapsedMilliseconds+7000;seq.Start(p,clock.ElapsedMilliseconds,3000,delegate(Target t){if(Native.GetForegroundWindow()!=target.Handle||Native.GetAncestor(Native.WindowFromPoint(new Point(t.X,t.Y)),2)!=target.Handle)throw new Exception("Test target not foreground; no click sent");Native.Click(t);});timer.Start();};
   if(interactive){var start=new Button{Text="BEGIN SAFE TEST",Location=new Point(150,15),Size=new Size(220,45)};start.Click+=delegate{start.Enabled=false;begin();};target.Controls.Add(start);}else target.Shown+=delegate{begin();};
   timer.Tick+=delegate{try{seq.Tick(clock.ElapsedMilliseconds);if(!seq.Running&&received.Count==4){timer.Stop();target.Close();}else if(clock.ElapsedMilliseconds>deadline)throw new Exception("Real click test timed out");}catch(Exception ex){failure=ex;seq.Stop();timer.Stop();target.Close();}};
   try{Application.Run(target);}finally{seq.Stop();timer.Stop();timer.Dispose();}if(failure!=null)throw failure;Check(string.Join("",received.ToArray())=="ABAB","SendInput real target ABAB");Check(times[1]-times[0]>=150&&times[2]-times[1]>=190,"real target wait timing");
  }}
 }
}
