$ErrorActionPreference = "Stop"
$repo = (Get-Location).Path
$gitDir = Join-Path $repo ".git"
$oldFile = Join-Path $repo "visiond-mvp\migrations\0029_veasy_conversation_isolation.sql"
$keptFile = Join-Path $repo "visiond-mvp\migrations\0032_veasy_conversation_isolation.sql"

if (-not (Test-Path -LiteralPath $gitDir -PathType Container)) {
  throw "กรุณารันสคริปต์จากโฟลเดอร์ Repository visiond ที่มี .git เท่านั้น"
}
if (-not (Test-Path -LiteralPath $keptFile -PathType Leaf)) {
  throw "หยุด: ไม่พบไฟล์ 0032 ที่ต้องเก็บไว้"
}
if (Test-Path -LiteralPath $oldFile -PathType Leaf) {
  $oldHash = (Get-FileHash -LiteralPath $oldFile -Algorithm SHA256).Hash
  $keptHash = (Get-FileHash -LiteralPath $keptFile -Algorithm SHA256).Hash
  if ($oldHash -ne $keptHash) {
    throw "หยุด: ไฟล์ 0029 และ 0032 ไม่เหมือนกัน จึงไม่ลบ"
  }
  Remove-Item -LiteralPath $oldFile
  Write-Host "ลบไฟล์ซ้ำที่ยืนยัน hash ตรงกันแล้ว: visiond-mvp/migrations/0029_veasy_conversation_isolation.sql"
} else {
  Write-Host "ไฟล์ซ้ำถูกลบไปแล้ว ไม่ต้องทำซ้ำ"
}
Write-Host "เสร็จแล้ว เปิด GitHub Desktop ตรวจว่ามีไฟล์ 0029 แสดงเป็น Deleted ก่อน Commit"
