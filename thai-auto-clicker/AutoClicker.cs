using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Web.Script.Serialization;
using System.Windows.Forms;
[assembly: System.Reflection.AssemblyVersion("1.0.1.0")]
[assembly: System.Reflection.AssemblyFileVersion("1.0.1.0")]
[assembly: System.Reflection.AssemblyTitle("V auto")]
[assembly: System.Reflection.AssemblyProduct("V auto")]

namespace ThaiAutoClicker {
 public sealed class Target { public Target(){X=int.MinValue;Y=int.MinValue;} public int X {get;set;} public int Y {get;set;} public int WaitMs {get;set;} }
 public sealed class Profile { public Profile(){Loops=-1;} public int Version {get;set;} public int Loops {get;set;} public List<Target> Targets {get;set;} }
 public static class Profiles {
  public static void Validate(Profile p) {
   if(p==null || p.Version!=1 || p.Loops<0 || p.Loops>1000000 || p.Targets==null || p.Targets.Count==0) throw new Exception("ชุดพิกัดไม่ถูกต้อง");
   foreach(var t in p.Targets) if(t==null || t.WaitMs<50 || t.WaitMs>86400000 || !OnScreen(t.X,t.Y)) throw new Exception("พิกัดอยู่นอกจอ หรือเวลารอต้องเป็น 50–86400000 มิลลิวินาที");
  }
  public static bool OnScreen(int x,int y) { foreach(var s in Screen.AllScreens) if(s.Bounds.Contains(x,y)) return true; return false; }
  public static Profile Load(string path) { if(new FileInfo(path).Length>4*1024*1024) throw new Exception("ไฟล์ใหญ่เกิน 4 MB"); var p=new JavaScriptSerializer{MaxJsonLength=4*1024*1024}.Deserialize<Profile>(File.ReadAllText(path)); Validate(p); return p; }
  public static void Save(string path,Profile p) { Validate(p); string tmp=path+".tmp"; File.WriteAllText(tmp,new JavaScriptSerializer{MaxJsonLength=4*1024*1024}.Serialize(p)); if(File.Exists(path)) File.Replace(tmp,path,null); else File.Move(tmp,path); }
 }
 public sealed class Sequence {
  public bool Running {get;private set;} public int Completed {get;private set;}
  List<Target> points; int loops,index; long due; Action<Target> click;
  public void Start(Profile p,long now,int countdown,Action<Target> action) { Profiles.Validate(p); points=new List<Target>(); foreach(var t in p.Targets) points.Add(new Target{X=t.X,Y=t.Y,WaitMs=t.WaitMs}); loops=p.Loops; index=0;Completed=0;click=action;due=now+countdown;Running=true; }
  public void Stop() {Running=false;}
  public long Remaining(long now) {return Math.Max(0,due-now);}
  public void Tick(long now) {if(!Running || now<due)return; var t=points[index]; click(t); if(!Running)return; due=now+t.WaitMs; index++; if(index==points.Count){ index=0;Completed++; if(loops>0 && Completed>=loops)Running=false;}}
 }
 public static class Native {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool RegisterHotKey(IntPtr h,int id,uint mods,uint key);
  [DllImport("user32.dll")] public static extern bool UnregisterHotKey(IntPtr h,int id);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
  [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(Point p);
  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr h,uint flags);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint SendInput(uint n,INPUT[] inputs,int size);
  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public MOUSEINPUT mouse; }
  [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx,dy; public uint data,flags,time; public UIntPtr extra; }
  public static void Click(Target t) { if(!SetCursorPos(t.X,t.Y))throw new Exception("ย้ายเมาส์ไม่ได้"); var input=new INPUT[2];input[0].mouse.flags=2;input[1].mouse.flags=4; if(SendInput(2,input,Marshal.SizeOf(typeof(INPUT)))!=2){SendInput(1,new INPUT[]{input[1]},Marshal.SizeOf(typeof(INPUT)));throw new Exception("Windows ไม่อนุญาตให้คลิกหน้าต่างนี้");} }
 }
 public sealed class Marker:Form {
  Point drag; bool moving; public Target Target; public event Action Moved;
  public Marker(Target t,int number) {Target=t;Text=number.ToString();AutoScaleMode=AutoScaleMode.None;FormBorderStyle=FormBorderStyle.None;ShowInTaskbar=false;TopMost=true;StartPosition=FormStartPosition.Manual;ClientSize=new Size(44,44);BackColor=Color.FromArgb(0,108,210);ForeColor=Color.White;Cursor=Cursors.SizeAll;Location=new Point(t.X-22,t.Y-22);SetStyle(ControlStyles.UserPaint|ControlStyles.AllPaintingInWmPaint|ControlStyles.OptimizedDoubleBuffer,true);using(var shape=new System.Drawing.Drawing2D.GraphicsPath()){shape.AddEllipse(0,0,44,44);Region=new Region(shape);} }
  protected override bool ShowWithoutActivation {get{return true;}}
  protected override void OnPaint(PaintEventArgs e) {base.OnPaint(e);using(var font=new Font("Segoe UI",Text.Length>2?10:13,FontStyle.Bold))using(var brush=new SolidBrush(Color.White))using(var format=new StringFormat{Alignment=StringAlignment.Center,LineAlignment=StringAlignment.Center})e.Graphics.DrawString(Text,font,brush,new RectangleF(0,0,44,44),format);}
  protected override void OnMouseDown(MouseEventArgs e){base.OnMouseDown(e);if(e.Button==MouseButtons.Left){moving=true;drag=e.Location;Capture=true;}}
  protected override void OnMouseMove(MouseEventArgs e){base.OnMouseMove(e);if(moving){var p=Cursor.Position;Location=new Point(p.X-drag.X,p.Y-drag.Y);Target.X=Left+22;Target.Y=Top+22;if(Moved!=null)Moved();}}
  protected override void OnMouseUp(MouseEventArgs e){moving=false;Capture=false;base.OnMouseUp(e);}
 }
 public sealed class MainForm:Form {
  readonly List<Target> targets=new List<Target>(); readonly List<Marker> markers=new List<Marker>();
  readonly Sequence sequence=new Sequence(); readonly Stopwatch clock=Stopwatch.StartNew(); readonly Timer timer=new Timer{Interval=15};
  readonly DataGridView grid=new DataGridView(); readonly NumericUpDown loops=new NumericUpDown{Minimum=0,Maximum=1000000,Value=1,Width=90}; readonly Label status=new Label{AutoSize=true};
  readonly FlowLayoutPanel actions=new FlowLayoutPanel{Dock=DockStyle.Top,AutoSize=true,Padding=new Padding(10)};
  Button start; bool hotkey; bool wasRunning; long countdownEnd; Form floating; Action<Target> testClick;
  internal bool TestRunning {get{return sequence.Running;}}
  internal bool TestMarkersHidden {get{foreach(var m in markers)if(m.Visible)return false;return true;}}
  internal void BeginStopTest(Action<Target> capture){if(!hotkey)throw new Exception("Test cannot reserve emergency hotkey");var p=PointToScreen(new Point(50,50));targets.Add(new Target{X=p.X,Y=p.Y,WaitMs=86400000});loops.Value=0;testClick=capture;RefreshTargets();StartRun();}
  public MainForm(){Text="V auto • 1.0.1";Icon=Icon.ExtractAssociatedIcon(Application.ExecutablePath);Font=new Font("Leelawadee UI",10);Size=new Size(760,540);MinimumSize=new Size(620,410);StartPosition=FormStartPosition.CenterScreen;
   AddButton(actions,"＋ เพิ่มจุด",AddTarget);AddButton(actions,"ลบจุดที่เลือก",RemoveTarget);AddButton(actions,"↑ ขึ้น",delegate{MoveSelected(-1);});AddButton(actions,"↓ ลง",delegate{MoveSelected(1);});AddButton(actions,"บันทึกชุด",Save);AddButton(actions,"เปิดชุด",LoadProfile);
   var bottom=new FlowLayoutPanel{Dock=DockStyle.Bottom,Height=110,Padding=new Padding(10)};bottom.Controls.Add(new Label{Text="จำนวนรอบ (0 = จนกว่าจะหยุด)",AutoSize=true,Padding=new Padding(0,8,0,0)});bottom.Controls.Add(loops);start=AddButton(bottom,"▶ เริ่ม",StartRun);AddButton(bottom,"■ หยุด",StopRun);AddButton(bottom,"แถบลอย",ShowFloating);bottom.SetFlowBreak(bottom.Controls[bottom.Controls.Count-1],true);bottom.Controls.Add(status);
   var hint=new Label{Dock=DockStyle.Top,Height=58,Padding=new Padding(12,4,12,4),Text="ลากวงกลมหมายเลขไปยังตำแหน่งที่ต้องการ • คลิกตามลำดับจากบนลงล่าง\nเวลารอ = หน่วงหลังคลิกจุดนั้น (มิลลิวินาที) • หยุดฉุกเฉิน Ctrl + Shift + F12"};
   grid.Dock=DockStyle.Fill;grid.AllowUserToAddRows=false;grid.AllowUserToDeleteRows=false;grid.RowHeadersVisible=false;grid.SelectionMode=DataGridViewSelectionMode.FullRowSelect;grid.MultiSelect=false;grid.AutoSizeColumnsMode=DataGridViewAutoSizeColumnsMode.Fill;
   grid.Columns.Add("n","ลำดับ");grid.Columns.Add("x","X");grid.Columns.Add("y","Y");grid.Columns.Add("wait","รอหลังคลิก (ms)");grid.Columns[0].ReadOnly=true;grid.CellValidating+=ValidateCell;grid.CellEndEdit+=EditCell;grid.DataError+=delegate(object s,DataGridViewDataErrorEventArgs e){e.ThrowException=false;};
   Controls.Add(grid);Controls.Add(hint);Controls.Add(actions);Controls.Add(bottom);status.Text="พร้อม • เพิ่มจุดแล้วลากวงกลมไปวาง";
   timer.Tick+=delegate{try{sequence.Tick(clock.ElapsedMilliseconds);if(sequence.Running)status.Text=clock.ElapsedMilliseconds<countdownEnd?"เริ่มใน "+Math.Ceiling((countdownEnd-clock.ElapsedMilliseconds)/1000.0)+" วินาที • Ctrl+Shift+F12 หยุด":"กำลังทำงาน • สำเร็จ "+sequence.Completed+" รอบ • Ctrl+Shift+F12 หยุด";if(wasRunning&&!sequence.Running)Finish("จบแล้ว • "+sequence.Completed+" รอบ");}catch(Exception ex){StopRun();MessageBox.Show(this,ex.Message,"หยุดการทำงาน");}};timer.Start();
  }
  protected override void OnShown(EventArgs e){base.OnShown(e);hotkey=Native.RegisterHotKey(Handle,1,0x4006,0x7B);if(!hotkey){start.Enabled=false;status.Text="จองปุ่มหยุดไม่ได้ ปิดแอปที่ใช้ Ctrl+Shift+F12 แล้วเปิดใหม่";}}
  protected override void WndProc(ref Message m){if(m.Msg==0x312&&m.WParam.ToInt32()==1)StopRun();base.WndProc(ref m);}
  protected override void OnFormClosing(FormClosingEventArgs e){sequence.Stop();timer.Stop();Native.UnregisterHotKey(Handle,1);foreach(var m in markers)m.Close();if(floating!=null)floating.Close();base.OnFormClosing(e);}
  static Button AddButton(Control p,string text,Action action){var b=new Button{Text=text,AutoSize=true,Height=36,Margin=new Padding(3)};b.Click+=delegate{action();};p.Controls.Add(b);return b;}
  void AddTarget(){if(sequence.Running)return;var area=Screen.FromControl(this).WorkingArea;targets.Add(new Target{X=area.Left+area.Width/2,Y=area.Top+area.Height/2,WaitMs=1000});RefreshTargets();}
  void RemoveTarget(){if(sequence.Running||grid.CurrentRow==null)return;targets.RemoveAt(grid.CurrentRow.Index);RefreshTargets();}
  void MoveSelected(int delta){if(sequence.Running||grid.CurrentRow==null)return;int from=grid.CurrentRow.Index,to=from+delta;if(to<0||to>=targets.Count)return;var t=targets[from];targets.RemoveAt(from);targets.Insert(to,t);RefreshTargets();grid.CurrentCell=grid.Rows[to].Cells[0];}
  void RefreshTargets(){foreach(var m in markers)m.Close();markers.Clear();grid.Rows.Clear();for(int i=0;i<targets.Count;i++){var t=targets[i];grid.Rows.Add(i+1,t.X,t.Y,t.WaitMs);var marker=new Marker(t,i+1);int row=i;marker.Moved+=delegate{grid.Rows[row].Cells[1].Value=t.X;grid.Rows[row].Cells[2].Value=t.Y;};markers.Add(marker);marker.Show(this);}}
  void ValidateCell(object s,DataGridViewCellValidatingEventArgs e){if(e.ColumnIndex==0)return;int value;if(!int.TryParse(Convert.ToString(e.FormattedValue),out value)||(e.ColumnIndex==3&&(value<50||value>86400000))){e.Cancel=true;grid.Rows[e.RowIndex].ErrorText="กรอกจำนวนเต็ม; เวลารอ 50–86400000 ms";}else grid.Rows[e.RowIndex].ErrorText="";}
  void EditCell(object s,DataGridViewCellEventArgs e){if(e.RowIndex<0)return;var row=grid.Rows[e.RowIndex];var t=targets[e.RowIndex];t.X=Convert.ToInt32(row.Cells[1].Value);t.Y=Convert.ToInt32(row.Cells[2].Value);t.WaitMs=Convert.ToInt32(row.Cells[3].Value);markers[e.RowIndex].Location=new Point(t.X-22,t.Y-22);}
  Profile Current(){return new Profile{Version=1,Loops=(int)loops.Value,Targets=targets};}
  void Save(){if(sequence.Running||!grid.EndEdit())return;using(var d=new SaveFileDialog{Filter="ชุดพิกัด (*.json)|*.json",FileName="ชุดพิกัด.json"})if(d.ShowDialog(this)==DialogResult.OK)try{Profiles.Save(d.FileName,Current());status.Text="บันทึกแล้ว";}catch(Exception ex){MessageBox.Show(this,ex.Message,"บันทึกไม่ได้");}}
  void LoadProfile(){if(sequence.Running)return;using(var d=new OpenFileDialog{Filter="ชุดพิกัด (*.json)|*.json"})if(d.ShowDialog(this)==DialogResult.OK)try{var p=Profiles.Load(d.FileName);targets.Clear();targets.AddRange(p.Targets);loops.Value=p.Loops;RefreshTargets();status.Text="เปิดชุดแล้ว • ตรวจพิกัดก่อนเริ่ม";}catch(Exception ex){MessageBox.Show(this,ex.Message,"เปิดชุดไม่ได้");}}
  public void StartRun(){if(sequence.Running||!hotkey||!grid.EndEdit())return;try{var p=Current();Profiles.Validate(p);foreach(var m in markers)m.Hide();countdownEnd=clock.ElapsedMilliseconds+3000;sequence.Start(p,clock.ElapsedMilliseconds,3000,ClickExternal);wasRunning=true;grid.Enabled=false;actions.Enabled=false;loops.Enabled=false;start.Enabled=false;status.Text="เริ่มใน 3 วินาที • สลับไปยังหน้าต่างเป้าหมาย";}catch(Exception ex){MessageBox.Show(this,ex.Message,"เริ่มไม่ได้");}}
  void ClickExternal(Target t){if(testClick!=null){testClick(t);return;}var root=Native.GetAncestor(Native.WindowFromPoint(new Point(t.X,t.Y)),2);if(root==Handle||(floating!=null&&!floating.IsDisposed&&root==floating.Handle))throw new Exception("จุดคลิกทับหน้าต่างควบคุม กรุณาย้ายหน้าต่างควบคุมออกก่อน");Native.Click(t);}
  public void StopRun(){sequence.Stop();if(wasRunning)Finish("หยุดแล้ว • "+sequence.Completed+" รอบ");}
  void Finish(string text){wasRunning=false;grid.Enabled=true;actions.Enabled=true;loops.Enabled=true;start.Enabled=hotkey;status.Text=text;foreach(var m in markers)m.Show(this);}
  void ShowFloating(){if(floating!=null&&!floating.IsDisposed){floating.Show();return;}floating=new Form{Text="แถบควบคุม • ลากย้ายได้",Icon=Icon,TopMost=true,ShowInTaskbar=false,FormBorderStyle=FormBorderStyle.FixedToolWindow,ClientSize=new Size(310,90),Font=Font};var p=new FlowLayoutPanel{Dock=DockStyle.Fill};AddButton(p,"＋ จุด",AddTarget);AddButton(p,"▶ เริ่ม",StartRun);AddButton(p,"■ หยุด",StopRun);p.Controls.Add(new Label{Text="หยุดฉุกเฉิน Ctrl + Shift + F12",AutoSize=true});floating.Controls.Add(p);floating.Show();}
 }
 public static class Program {
  [STAThread] public static void Main(string[] args){Native.SetProcessDPIAware();Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);if(args.Length>0&&(args[0]=="--self-test"||args[0]=="--interactive-test")){Environment.Exit(Tests.Run(args.Length>1?args[1]:"self-test.txt",args[0]=="--interactive-test"));return;}Application.Run(new MainForm());}
 }
}
