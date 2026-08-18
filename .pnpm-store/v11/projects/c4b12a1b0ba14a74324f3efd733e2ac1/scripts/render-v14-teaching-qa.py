from pathlib import Path
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

root=Path(__file__).resolve().parents[1]
output=root/'output'/'pdf'/'v14-teaching-pdf-layout-qa.pdf'
output.parent.mkdir(parents=True,exist_ok=True)
pdfmetrics.registerFont(TTFont('Tahoma',r'C:\Windows\Fonts\tahoma.ttf'))
styles=getSampleStyleSheet()
title=ParagraphStyle('ThaiTitle',parent=styles['Title'],fontName='Tahoma',fontSize=24,leading=32,textColor=HexColor('#073f3c'),spaceAfter=18)
head=ParagraphStyle('ThaiHead',parent=styles['Heading2'],fontName='Tahoma',fontSize=17,leading=24,textColor=HexColor('#08756f'),spaceAfter=12)
body=ParagraphStyle('ThaiBody',parent=styles['BodyText'],fontName='Tahoma',fontSize=12,leading=20,textColor=HexColor('#183d3b'),spaceAfter=10)
doc=SimpleDocTemplate(str(output),pagesize=A4,rightMargin=46,leftMargin=46,topMargin=48,bottomMargin=46,title='Vision 14 Teaching PDF Layout QA')
story=[Paragraph('VISIOND - เอกสารสอนของจาวิส',title),Paragraph('ตัวอย่างหนังสือสำหรับตรวจรูปแบบภาษาไทย',head),Paragraph('Coverage 12/12 หน้า · สถานะสิทธิ์: owned',body),Paragraph('ภาพรวม',head),Paragraph('เอกสารนี้ใช้ตรวจว่าตัวอักษรไทย ระยะบรรทัด หัวข้อ และเลขหน้าอ้างอิงแสดงผลครบถ้วนโดยไม่ถูกตัดหรือซ้อนกัน',body),PageBreak(),Paragraph('เนื้อหาหน้า 1-4',title),Paragraph('• แนวคิดสำคัญข้อแรก พร้อมแหล่งอ้างอิง [หน้า 1]',body),Paragraph('• ตัวอย่างการนำความรู้ไปใช้ในการสอนอย่างเป็นขั้นตอน [หน้า 3]',body),Spacer(1,16),Paragraph('คำสำคัญ: การเรียนรู้ · แบบฝึกหัด · การพัฒนา',head)]
doc.build(story,onFirstPage=lambda c,d:(c.setFont('Tahoma',9),c.drawString(46,24,'VisionD v0.14.230 · หน้า 1')),onLaterPages=lambda c,d:(c.setFont('Tahoma',9),c.drawString(46,24,f'VisionD v0.14.230 · หน้า {d.page}')))
print(output)
