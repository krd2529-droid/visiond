(() => {
  const button = document.getElementById("vision2Button");
  const host = document.querySelector("#productsPanel .product-admin-layout");
  if (!button || !host) return;

  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  const workspace = document.createElement("section");
  workspace.id = "vision2Workspace";
  workspace.className = "vision2-workspace";
  workspace.hidden = true;
  workspace.innerHTML = `
    <div id="v2ResumeNotice" class="v2-resume-notice" hidden><div><b>พบงาน Vision 2 ที่ยังไม่เสร็จ</b><small id="v2ResumeText">สามารถกลับมาทำงานต่อจากคิวเดิมได้</small></div><button id="v2ResumeSaved" type="button">ทำงานต่อ</button><button id="v2DiscardSaved" type="button">เริ่มงานใหม่</button></div>
    <div class="v2-head"><div><small>VISION 2 · DIGITAL PRODUCT FACTORY</small><h3>สร้างไฟล์และเพิ่มสินค้าในหน้าเดียว</h3><p>สำหรับ Boss และ Admin เท่านั้น · ทำงานจากการกำหนดโจทย์ไปจนถึงเปิดขาย</p></div><div class="v2-head-actions"><button class="v2-history-button" id="v2UsageButton" type="button">ประวัติ Prompt และเครดิต</button><button class="v2-close" type="button" aria-label="ปิด">×</button></div></div>
    <section class="v2-usage-panel" id="v2UsagePanel" hidden><div class="v2-usage-head"><div><small>VISION 2 USAGE LEDGER</small><h4>ประวัติการสร้าง Prompt</h4><p>เลือกช่วงวันเพื่อดูจำนวนครั้ง จำนวน Prompt จำนวนรูป และทดลองคำนวณต้นทุนเครดิต</p></div><button class="v2-secondary" id="v2CloseUsage" type="button">ปิดรายงาน</button></div><div class="v2-usage-filters"><label>ตั้งแต่วันที่<input id="v2UsageFrom" type="date"></label><label>ถึงวันที่<input id="v2UsageTo" type="date"></label><label>เครดิตต่อรูป<input id="v2CreditPerImage" type="number" min="0" step="0.01" value="1"></label><label>ต้นทุนต่อเครดิต (บาท)<input id="v2CostPerCredit" type="number" min="0" step="0.0001" value="0"></label><button class="v2-primary" id="v2LoadUsage" type="button">คำนวณช่วงวันที่</button></div><div class="v2-usage-summary" id="v2UsageSummary"></div><p class="v2-usage-status" id="v2UsageStatus"></p><div class="v2-usage-table" id="v2UsageTable"></div></section>
    <div class="v2-steps"><span class="v2-step active">1 กำหนดงาน</span><span class="v2-step">2 เตรียม Prompt</span><span class="v2-step">3 สร้างภาพ</span><span class="v2-step">4 เลือกรูปทำตัวอย่าง</span><span class="v2-step">5 รวมภาพทั้งหมดเป็น PDF</span><span class="v2-step">6 เพิ่มรายละเอียดสินค้า</span><span class="v2-step">7 ตรวจงานและเปิดขาย</span></div>
    <section class="v2-panel active" data-v2-panel="1"><form id="v2BriefForm" class="v2-card"><div class="v2-two"><label>ชื่อโครงการ<input name="project_name" required placeholder="เช่น ชุดระบายสีสัตว์ทะเล 50 ภาพ"></label><label>หัวข้อหลัก<input name="topic" required placeholder="เช่น สัตว์ทะเลสำหรับเด็ก"></label></div><div class="v2-two"><label>จำนวนภาพ<input name="count" type="number" min="1" max="200" value="30" required><small>สูงสุด 200 รูปต่อหนึ่งโครงการ</small></label><label>API สร้างภาพ<select name="image_api" id="v2ImageApi" required><option value="" selected>เลือก API สำหรับงานนี้</option><option value="google-imagen">Gemini Image API</option><option value="openai">OpenAI Image API</option><option value="stability">Stability AI</option><option value="replicate">Replicate</option><option value="custom">Custom API</option></select><small>เลือกใหม่ได้ทุกโครงการหรือทุกธีม</small></label></div><div class="v2-api-summary"><div><small>API ที่เลือก</small><b id="v2ApiName">ยังไม่ได้เลือก API</b></div><span>คิว รูปที่สำเร็จ และ Log จะบันทึกตาม API ของงานนี้</span></div><div class="v2-size-config"><div class="v2-orientation-row v2-required-choice"><b>การระบุขนาด</b><div class="v2-orientation"><button class="active" id="v2PresetMode" type="button">เลือกขนาด</button><button id="v2CustomMode" type="button">ระบุขนาดเอง</button></div><small id="v2SizeModePreview">เลือกจากขนาดมาตรฐาน</small></div><div class="v2-two v2-size-row"><label id="v2PresetSizeLabel">ขนาดงาน<select name="size" id="v2SizeSelect"><option value="A4|210 × 297 มม.|297 × 210 มม.">A4</option><option value="A5|148 × 210 มม.|210 × 148 มม.">A5</option><option value="โปสการ์ด 4 × 6 นิ้ว|4 × 6 นิ้ว|6 × 4 นิ้ว">โปสการ์ด 4 × 6 นิ้ว</option><option value="โปสการ์ด|100 × 148 มม.|148 × 100 มม.">โปสการ์ด 100 × 148 มม.</option><option value="นามบัตร|54 × 90 มม.|90 × 54 มม.">นามบัตร 90 × 54 มม.</option><option value="สี่เหลี่ยมจัตุรัส|1 × 1|1 × 1">สี่เหลี่ยมจัตุรัส</option></select></label><label id="v2CustomSizeLabel">ระบุขนาดที่ต้องการ<input name="custom_size" placeholder="เช่น 12 × 18 ซม., 5 × 7 นิ้ว หรือ 1080 × 1350 px"><small>ใส่หน่วย มม., ซม., นิ้ว หรือ px ได้</small></label></div><div class="v2-orientation-row v2-required-choice"><b>แนวภาพ <em>* ต้องเลือก</em></b><div class="v2-orientation"><button id="v2Portrait" type="button">แนวตั้ง</button><button id="v2Landscape" type="button">แนวนอน</button></div><small id="v2SizePreview">กรุณาเลือกแนวภาพ</small></div><div class="v2-orientation-row v2-required-choice"><b>เส้นกรอบรูป <em>* ต้องเลือก</em></b><div class="v2-orientation"><button id="v2WithFrame" type="button">มีเส้นกรอบรูป</button><button id="v2WithoutFrame" type="button">ไม่มีเส้นกรอบรูป</button></div><small id="v2FramePreview">กรุณาเลือกรูปแบบกรอบ</small></div></div><div class="v2-two"><label>รูปแบบภาพ<select name="style"><option>ภาพการ์ตูนเส้นหนา ขาวดำ ไม่ลงสี</option><option>ภาพเส้นรายละเอียดปานกลางสำหรับระบายสี</option><option>ภาพลายเส้นเรียบง่ายสำหรับเด็กเล็ก</option></select></label><label>กลุ่มเป้าหมาย<input name="audience" value="เด็กและครอบครัว"></label></div><label>คำสั่งเพิ่มเติม<textarea name="instructions" rows="3" placeholder="เช่น ฉากธรรมชาติ ไม่มีตัวอักษร ไม่มีกรอบตกขอบ"></textarea></label><div class="v2-actions"><button class="v2-primary" type="submit">สร้างโครงการและไปขั้น Prompt →</button></div></form></section>
    <section class="v2-panel" data-v2-panel="2"><div class="v2-card"><div class="v2-prompt-stats"><div><h4>ตาราง Prompt สำหรับสร้างภาพ</h4><p>1 แถวเท่ากับ 1 รูป · ข้อมูลทั้งหมดสร้างจากช่วงที่ 1 และแก้ไขแต่ละแถวได้</p></div><b id="v2PromptCount"></b></div><textarea id="v2PromptList" hidden></textarea><div class="v2-prompt-table"><div class="v2-prompt-table-head"><b>รูป</b><b>ตัวละคร/รายละเอียด</b><b>Prompt ที่จะส่งสร้างภาพ</b></div><div id="v2PromptRows"></div></div><div class="v2-actions"><button class="v2-secondary" data-v2-back="1" type="button">← ย้อนกลับ</button><button class="v2-primary" id="v2PrepareSlots" type="button">สร้างรูปทั้งหมดและไปข้อ 3 →</button></div></div></section>
    <section class="v2-panel" data-v2-panel="3"><div class="v2-card"><div class="v2-coming"><b>คิวสร้างภาพอัตโนมัติครั้งละ 1 รูป</b><br>ระบบหน่วงสุ่ม 10–20 วินาทีระหว่างรูป หากรูปใดไม่สำเร็จจะพักและข้ามไปทำรูปถัดไปให้ครบหนึ่งรอบ แล้วจึงให้สั่งสร้างซ้ำเฉพาะรูปที่ยังไม่สำเร็จ</div><div class="v2-generation-status"><b id="v2GeneratedCount">รูปเสร็จแล้ว 0/0 รูป</b><span id="v2QueueStatus">คิวพร้อมทำงาน</span><button class="v2-queue-toggle" id="v2QueueToggle" type="button">หยุดคิวชั่วคราว</button><button class="v2-retry-failed" id="v2RetryFailed" type="button" hidden>สร้างซ้ำเฉพาะรูปที่สร้างไม่ได้</button></div><section class="v2-job-log"><div class="v2-job-log-head"><div><b>Activity Log</b><small>เวลา · รูป · แอ็กชัน</small></div><button id="v2ClearLog" type="button">ล้าง Log</button></div><div id="v2JobLog" class="v2-job-log-list"></div></section><div id="v2ImageSlots" class="v2-image-slots"></div><div class="v2-actions"><button class="v2-secondary" data-v2-back="2" type="button">← แก้ Prompt</button><button class="v2-primary" id="v2GoSampleSelection" type="button">รูปเสร็จแล้ว ไปเลือกทำตัวอย่าง →</button></div></div></section>
    <section class="v2-panel" data-v2-panel="4"><div class="v2-card"><div><h4>เลือกรูปจากข้อ 3 จำนวน 3 รูป</h4><p>รูปที่เสร็จทั้งหมดจะแสดงในขั้นนี้ เลือก 3 รูปเพื่อทำ SAMPLE โดยไฟล์ต้นฉบับไม่ถูกแก้ไข</p></div><div class="v2-selection-bar"><b id="v2SelectedCount">เลือกทำตัวอย่างแล้ว 0/3 รูป</b><span>เลือกรูปที่ชอบให้ครบ 3 รูป</span></div><div id="v2SampleSelection" class="v2-sample-selection"></div><div id="v2SampleGallery" class="v2-sample-gallery"></div><div class="v2-actions"><button class="v2-secondary" data-v2-back="3" type="button">← กลับไปดูรูปทั้งหมด</button><button class="v2-primary" id="v2OpenSamples" type="button">ทำ SAMPLE จาก 3 รูปที่เลือก</button><button class="v2-primary" id="v2GoPdf" type="button" hidden>ยืนยันตัวอย่างและนำภาพทั้งหมดไปรวม PDF →</button></div></div></section>
    <section class="v2-panel" data-v2-panel="5"><div class="v2-card"><div class="v2-coming"><b>รวมภาพต้นฉบับทั้งหมดจากขั้นที่ 3 เป็น PDF</b><br>ระบบจะเรียงภาพต้นฉบับทั้งหมดตามลำดับเพื่อทำ PDF ส่วนรูป SAMPLE 3 รูปจากขั้นที่ 4 ใช้แสดงหน้าสินค้าเท่านั้น</div><div id="v2PdfSummary" class="v2-summary"></div><section id="v2PdfFilePreview" class="v2-pdf-file-preview" hidden></section><div class="v2-actions"><button class="v2-secondary" data-v2-back="4" type="button">← กลับรูปตัวอย่าง</button><button class="v2-secondary" id="v2DownloadPdf" type="button" disabled>ดาวน์โหลด PDF ลงเครื่อง</button><button class="v2-secondary" id="v2FinishWithoutProduct" type="button" disabled>จบงานโดยไม่สร้างสินค้า</button><button class="v2-primary" id="v2ContinueProduct" type="button" disabled>กำลังรวม PDF…</button></div></div></section>`;
  host.before(workspace);
  workspace
    .querySelector(".v2-head")
    .insertAdjacentHTML(
      "afterend",
      `<section class="v2-external-upload"><header><b>มี ZIP หรือ PDF พร้อมขายแล้ว?</b><small>ข้ามการเจนภาพ · เลือกหน้าจาก PDF หรือรูปจาก ZIP มาทำ SAMPLE แล้วแนบไฟล์ต้นฉบับเข้าตะกร้าขายทันที</small></header><label class="v2-external-name">ชื่อสินค้า<input id="v2ExternalName" placeholder="เช่น ชุดแบบฝึกหัด A–Z 200 หน้า"></label><div class="v2-external-source"><label><span>อัปโหลดรูป 3–200 รูป</span><input id="v2ExternalFiles" type="file" accept="image/jpeg,image/png,image/webp" multiple><small>รองรับ JPG, PNG, WEBP · ระบบเรียงตามชื่อไฟล์และสร้าง PDF ใหม่</small></label><button class="v2-upload-action" id="v2ExternalStart" type="button">ใช้รูปที่เลือก → เลือก SAMPLE</button></div><div class="v2-external-source v2-zip-pdf-source"><label><span>รับ ZIP / PDF พร้อมขาย</span><input id="v2ExternalZip" type="file" accept=".zip,.pdf,application/pdf,application/zip,application/x-zip-compressed"><small>PDF: เลือกหน้ามาทำตัวอย่าง · ZIP: ดึงรูปหรือหน้า PDF ภายในมาทำตัวอย่าง · แนบไฟล์เดิมโดยไม่สร้างซ้ำ</small></label><label>หน้าที่จะนำมาเลือก SAMPLE<input id="v2ExternalPdfPages" value="1-30" placeholder="เช่น 1-30, 55, 100-110"><small>เปิดเฉพาะหน้าที่ระบุ สูงสุด 200 หน้า ป้องกัน PDF หลายพันหน้าทำเครื่องค้าง</small></label><button class="v2-upload-action" id="v2ExternalZipStart" type="button">อ่าน ZIP / PDF → เลือก SAMPLE</button></div><p id="v2ExternalStatus"></p></section>`,
    );

  const steps = [...workspace.querySelectorAll(".v2-step")];
  const panels = [...workspace.querySelectorAll(".v2-panel")];
  const slotImages = new Map();
  const selected = new Set();
  let brief = {},
    pdfFile = null,
    pdfObjectUrl = "",
    sampleFiles = [],
    sampleProjectKey = "";
  let importedProductFile = null,
    importedPageCount = 0,
    importedCandidateCount = 0;
  let usageData = { summary: { runs: 0, images: 0, prompts: 0 }, items: [] };
  const show = (number) => {
    steps.forEach((step, index) =>
      step.classList.toggle("active", index === number - 1),
    );
    panels.forEach((panel) =>
      panel.classList.toggle(
        "active",
        Number(panel.dataset.v2Panel) === number,
      ),
    );
    workspace.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  let promptItems = [];
  const cleanPrompt = (value) =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  const syncPromptStore = () => {
    v2PromptList.value = promptItems.map((item) => item.prompt).join("\n");
    v2PromptCount.textContent = `${promptItems.length} Prompt = ${promptItems.length} รูป`;
  };
  const renderPromptTable = (prompts, characters = []) => {
    promptItems = prompts
      .slice(0, 200)
      .map((prompt, index) => ({
        character: cleanPrompt(characters[index] || `ภาพที่ ${index + 1}`),
        prompt: cleanPrompt(prompt),
      }));
    v2PromptRows.innerHTML = promptItems
      .map(
        (item, index) =>
          `<div class="v2-prompt-row"><b>${index + 1}</b><span>${esc(item.character)}</span><textarea data-v2-prompt-row="${index}" rows="3">${esc(item.prompt)}</textarea></div>`,
      )
      .join("");
    syncPromptStore();
  };
  v2PromptRows.addEventListener("input", (event) => {
    const field = event.target.closest("[data-v2-prompt-row]");
    if (!field) return;
    const index = Number(field.dataset.v2PromptRow);
    promptItems[index].prompt = cleanPrompt(field.value);
    syncPromptStore();
  });
  const setSizeMode = (custom) => {
    v2PresetMode.classList.toggle("active", !custom);
    v2CustomMode.classList.toggle("active", custom);
    v2PresetSizeLabel.classList.toggle("is-disabled", custom);
    v2CustomSizeLabel.classList.toggle("is-disabled", !custom);
    v2SizeSelect.disabled = custom;
    v2BriefForm.elements.custom_size.disabled = !custom;
    v2BriefForm.elements.custom_size.required = custom;
  };
  let orientation = "",
    frameStyle = "";
  const projectField = v2BriefForm.elements.project_name,
    projectLabel = projectField.closest("label"),
    oldTopicField = v2BriefForm.elements.topic,
    topicLabel = oldTopicField.closest("label"),
    firstBriefRow = projectLabel.parentElement;
  projectLabel.childNodes[0].textContent = "ชื่อสินค้า";
  projectLabel.style.gridColumn = "1 / -1";
  projectField.placeholder = "เช่น ชุดระบายสีแมลง 30 ชนิด";
  topicLabel.childNodes[0].textContent =
    "รายละเอียดตัวละคร หรือชื่อตัวละคร (สูงสุด 200 ชื่อ)";
  topicLabel.style.gridColumn = "1 / -1";
  const topicArea = document.createElement("textarea");
  topicArea.name = "topic";
  topicArea.required = true;
  topicArea.rows = 12;
  topicArea.maxLength = 60000;
  topicArea.placeholder =
    "กรอกบรรทัดละ 1 ตัวละคร เช่น\nผีเสื้อโมนาร์ก\nด้วงกว่าง\nผึ้งหลวง\n... สูงสุด 200 รายการ";
  oldTopicField.replaceWith(topicArea);
  firstBriefRow.insertAdjacentHTML(
    "afterend",
    `<section class="v2-card v2-jarvis-character"><div><b>จาวิสช่วยคิดรายชื่อตัวละคร</b><small>จาวิสจะกรอกเฉพาะช่องรายละเอียดตัวละครด้านบน</small></div><div class="v2-two"><label>บอกสิ่งที่ต้องการให้จาวิสช่วย<textarea id="v2JarvisRequest" rows="3" placeholder="เช่น ขอชื่อแมลง 30 ชื่อไม่ซ้ำ"></textarea></label><div><button class="v2-primary" id="v2JarvisFill" type="button">ให้จาวิสช่วยกรอก</button><p id="v2JarvisStatus"></p></div></div></section><section class="v2-card v2-character-reference"><div><b>รูปตัวละครต้นแบบ (ไม่บังคับ)</b><small>ถ้าแนบ ระบบจะใช้ตัวละครนี้เป็นต้นแบบในการสร้างทุกรูป หากไม่แนบจะใช้ Prompt ตามปกติ</small></div><label>แนบรูปตัวละคร<input id="v2CharacterReference" type="file" accept="image/jpeg,image/png,image/webp"></label><div id="v2ReferencePreview"></div><small>หากปิดหน้าเว็บระหว่างงาน ต้องกลับมาแนบรูปต้นแบบใหม่ก่อนทำงานต่อ</small></section>`,
  );
  const jarvisSection = firstBriefRow.nextElementSibling,
    characterDetailsSection = document.createElement("section");
  characterDetailsSection.className = "v2-card v2-character-details";
  characterDetailsSection.append(topicLabel);
  jarvisSection.insertAdjacentElement("afterend", characterDetailsSection);
  const v2JarvisRequest = document.getElementById("v2JarvisRequest"),
    v2JarvisFill = document.getElementById("v2JarvisFill"),
    v2JarvisStatus = document.getElementById("v2JarvisStatus"),
    v2CharacterReference = document.getElementById("v2CharacterReference"),
    v2ReferencePreview = document.getElementById("v2ReferencePreview");
  let referenceImagePayload = null;
  const originalFetch = window.fetch.bind(window);
  const fetch = (input, init = {}) => {
    if (input === "/api/admin/vision2/generate" && init.body) {
      const payload = JSON.parse(init.body);
      if (String(payload.prompt || "").includes("รูปแนวนอน"))
        payload.aspect_ratio = "4:3";
      if (String(payload.prompt || "").includes("รูปแนวตั้ง"))
        payload.aspect_ratio = "3:4";
      if (brief.reference_image_required && !referenceImagePayload)
        return Promise.resolve(
          new Response(
            JSON.stringify({
              code: "provider_not_connected",
              error:
                "งานนี้กำหนดให้ใช้รูปตัวละครต้นแบบ แต่ไม่พบข้อมูลรูปแนบ กรุณากลับไป Step 1 และแนบรูปใหม่",
            }),
            { status: 400, headers: { "content-type": "application/json" } },
          ),
        );
      if (referenceImagePayload)
        payload.reference_image = referenceImagePayload;
      return originalFetch(input, { ...init, body: JSON.stringify(payload) });
    }
    return originalFetch(input, init);
  };
  v2CharacterReference.onchange = () => {
    const file = v2CharacterReference.files?.[0];
    referenceImagePayload = null;
    v2ReferencePreview.innerHTML = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      v2CharacterReference.value = "";
      return alert("รูปต้นแบบต้องมีขนาดไม่เกิน 10 MB");
    }
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || ""),
        comma = value.indexOf(",");
      referenceImagePayload = {
        mime_type: file.type || "image/png",
        data: value.slice(comma + 1),
      };
      v2ReferencePreview.innerHTML = `<img src="${value}" alt="รูปตัวละครต้นแบบ" style="max-width:180px;max-height:180px;object-fit:contain"><b>จะใช้รูปนี้เป็นต้นแบบทุกรูป</b>`;
    };
    reader.readAsDataURL(file);
  };
  v2JarvisFill.onclick = async () => {
    const request = v2JarvisRequest.value.trim();
    if (!request) return alert("กรุณาบอกสิ่งที่ต้องการให้จาวิสช่วย");
    v2JarvisFill.disabled = true;
    v2JarvisStatus.textContent = "จาวิสกำลังจัดรายการ…";
    try {
      const response = await originalFetch("/api/admin/vision2/characters", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ request, max_items: 200 }),
        }),
        data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || "จาวิสจัดรายการไม่สำเร็จ");
      topicArea.value = data.items.join("\n");
      v2BriefForm.elements.count.value = data.items.length;
      v2JarvisStatus.textContent = `กรอกให้แล้ว ${data.items.length} รายการ`;
    } catch (error) {
      v2JarvisStatus.textContent = error.message;
    } finally {
      v2JarvisFill.disabled = false;
    }
  };
  const instructionsField = v2BriefForm.elements.instructions;
  instructionsField
    .closest("label")
    .insertAdjacentHTML(
      "beforebegin",
      `<div class="v2-orientation-row v2-required-choice v2-text-choice"><b>ข้อความในภาพ <em>* ต้องเลือก</em></b><div class="v2-orientation"><button id="v2NoText" type="button">ไม่ใส่ข้อความ</button><button id="v2WithText" type="button">ใส่ข้อความ</button></div><small id="v2TextPreview">กรุณาเลือกรูปแบบข้อความ</small><input name="text_mode" id="v2TextMode" type="hidden" required></div><label id="v2CustomTextLabel" hidden>ข้อความที่ต้องการให้แสดง<input name="image_text" id="v2ImageText" maxlength="300" placeholder="พิมพ์ข้อความที่ต้องการให้ปรากฏในภาพ"></label>`,
    );
  const v2TextMode = v2BriefForm.elements.text_mode,
    v2ImageText = v2BriefForm.elements.image_text,
    v2CustomTextLabel = document.getElementById("v2CustomTextLabel"),
    v2NoText = document.getElementById("v2NoText"),
    v2WithText = document.getElementById("v2WithText"),
    v2TextPreview = document.getElementById("v2TextPreview");
  const setTextMode = (value) => {
    v2TextMode.value = value;
    const custom = value === "custom";
    v2NoText.classList.toggle("active", value === "none");
    v2WithText.classList.toggle("active", custom);
    v2TextPreview.textContent = custom ? "ใส่ข้อความที่กำหนด" : "ไม่ใส่ข้อความ";
    v2CustomTextLabel.hidden = !custom;
    v2ImageText.required = custom;
    if (!custom) v2ImageText.value = "";
  };
  v2NoText.onclick = () => setTextMode("none");
  v2WithText.onclick = () => setTextMode("custom");
  const rebuildPromptTableFromStep1 = () => {
    if (!brief.output_size) return false;
    const characters = topicArea.value
        .split("\n")
        .map((value) => cleanPrompt(value))
        .filter(Boolean)
        .slice(0, 200),
      count = Math.min(
        200,
        Math.max(1, Number(v2BriefForm.elements.count.value) || 1),
      ),
      base = cleanPrompt(
        `สร้างภาพขนาด ${brief.output_size} ${brief.frame_style} เป็น${brief.style} เหมาะสำหรับ${brief.audience}${brief.instructions ? " " + brief.instructions : ""}`,
      ),
      prompts = Array.from(
        { length: count },
        (_, index) =>
          `${base} ตัวละครหรือตัวแบบ: ${characters[index] || `ตัวละครภาพที่ ${index + 1}`} ภาพที่ ${index + 1} จากทั้งหมด ${count} ภาพ องค์ประกอบและท่าทางไม่ซ้ำกับภาพอื่น${referenceImagePayload ? " ใช้ตัวละครจากรูปอ้างอิงที่แนบเป็นต้นแบบหลัก รักษารูปร่าง ใบหน้า สี และลักษณะสำคัญให้เหมือนเดิม" : ""}`,
      );
    renderPromptTable(prompts, characters);
    brief.topic = characters.join("\n");
    brief.has_reference_image = Boolean(referenceImagePayload);
    return true;
  };
  v2BriefForm.addEventListener(
    "submit",
    () => {
      const marker = " [ข้อกำหนดข้อความ:";
      instructionsField.value = instructionsField.value
        .replace(/ \[ข้อกำหนดข้อความ:[\s\S]*?\]$/, "")
        .trim();
      const rule =
        v2TextMode.value === "custom"
          ? `ใส่ข้อความในภาพว่า "${v2ImageText.value.trim()}" และต้องสะกดตามนี้ทุกตัวอักษร`
          : "ห้ามมีตัวอักษร คำบรรยาย ตัวเลข หรือลายน้ำใดๆ ในภาพ";
      instructionsField.value =
        `${instructionsField.value}${marker} ${rule}]`.trim();
      queueMicrotask(() => {
        if (!brief.output_size) return;
        const characters = topicArea.value
            .split("\n")
            .map((value) => value.trim())
            .filter(Boolean)
            .slice(0, 200),
          requested = Math.min(200, Math.max(1, Number(brief.count) || 1)),
          count = requested,
          base = cleanPrompt(
            `สร้างภาพขนาด ${brief.output_size} ${brief.frame_style} เป็น${brief.style} เหมาะสำหรับ${brief.audience}${brief.instructions ? " " + brief.instructions : ""}`,
          ),
          prompts = Array.from(
            { length: count },
            (_, index) =>
              `${base} ตัวละครหรือตัวแบบ: ${characters[index] || `ตัวละครภาพที่ ${index + 1}`} ภาพที่ ${index + 1} องค์ประกอบและท่าทางไม่ซ้ำกับภาพอื่น${referenceImagePayload ? " ใช้ตัวละครจากรูปอ้างอิงที่แนบเป็นต้นแบบหลัก รักษารูปร่าง ใบหน้า สี และลักษณะสำคัญให้เหมือนเดิม" : ""}`,
          );
        renderPromptTable(prompts, characters);
        brief.topic = characters.join("\n");
        brief.has_reference_image = Boolean(referenceImagePayload);
      });
    },
    true,
  );
  const JOB_KEY = "vision2_active_job_v2",
    MAX_RETRIES = 1,
    queueStates = [],
    retryCounts = [],
    activeQueue = new Set(),
    queueTimers = new Map();
  let queuePaused = false,
    jobLogs = [],
    editProductTarget = null,
    launchingProductEdit = false;
  const nowLabel = () =>
    new Date().toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  const renderJobLog = () => {
    v2JobLog.innerHTML = jobLogs.length
      ? jobLogs
          .map(
            (item) =>
              `<div class="v2-job-log-row ${esc(item.type)}"><time>${esc(item.time)}</time><b>${item.index === null ? "ระบบ" : `ภาพ ${item.index + 1}`}</b><span>${esc(item.action)}</span></div>`,
          )
          .join("")
      : '<div class="v2-job-log-empty">ยังไม่มีการทำงาน</div>';
  };
  const completedCount = () =>
    queueStates.filter(
      (state) => state === "เสร็จแล้ว" || state === "รอนำรูปกลับเข้าระบบ",
    ).length;
  const unfinishedCount = () => queueStates.length - completedCount();
  const persistJob = () => {
    if (!queueStates.length) return;
    const results = [...slotImages.entries()]
      .filter(([, item]) => item.key && item.remoteUrl)
      .map(([index, item]) => ({
        index,
        key: item.key,
        url: item.remoteUrl,
        mimeType: item.mimeType,
        apiSlot: item.apiSlot || apiSlotFor(index),
      }));
    localStorage.setItem(
      JOB_KEY,
      JSON.stringify({
        brief,
        prompts: v2PromptList.value,
        statuses: queueStates.map((state, index) =>
          slotImages.has(index)
            ? "เสร็จแล้ว"
            : state === "กำลังสร้าง" ||
                state === "กำลังเริ่ม" ||
                state === "กำลังลองใหม่"
              ? "รอคิว"
              : state,
        ),
        retries: retryCounts,
        results,
        completed: completedCount(),
        logs: jobLogs,
        savedAt: new Date().toISOString(),
      }),
    );
  };
  const addJobLog = (action, index = null, type = "info") => {
    jobLogs.unshift({ time: nowLabel(), action, index, type });
    jobLogs = jobLogs.slice(0, 150);
    renderJobLog();
    persistJob();
  };
  const clearQueueTimers = () => {
    queueTimers.forEach((timer) => clearTimeout(timer));
    queueTimers.clear();
    activeQueue.clear();
  };
  const setSlotState = (index, state, message) => {
    queueStates[index] = state;
    const card = workspace.querySelector(`[data-slot="${index}"]`);
    if (card) {
      card.querySelector(".v2-slot-state").textContent = state;
      if (message)
        card.querySelector(".v2-slot-preview").innerHTML =
          `<span>${esc(message)}</span>`;
    }
    persistJob();
  };
  const apiLabel = () =>
    v2ImageApi.options[v2ImageApi.selectedIndex]?.text || "ยังไม่ได้เลือก API";
  const concurrentLimit = () => (brief.turbo_mode ? 2 : 1);
  const apiSlotFor = (index) =>
    brief.turbo_mode ? (index % 2 === 0 ? 1 : 2) : 1;
  const randomDelay = () => 10000 + Math.floor(Math.random() * 10001);
  const updateQueueSummary = () => {
    const waiting = queueStates.filter((state) => state === "รอคิว").length,
      failed = queueStates.filter((state) => state === "ข้ามชั่วคราว").length,
      roundFinished =
        queueStates.length &&
        waiting === 0 &&
        activeQueue.size === 0 &&
        failed > 0;
    v2RetryFailed.hidden = !roundFinished;
    if (queueStates.length && !unfinishedCount()) {
      v2QueueStatus.textContent = "งานเสร็จครบแล้ว";
      v2QueueToggle.textContent = "งานเสร็จแล้ว";
      v2QueueToggle.disabled = true;
      return;
    }
    if (roundFinished) {
      v2QueueStatus.textContent = `จบรอบนี้ · สำเร็จ ${completedCount()}/${queueStates.length} รูป · ไม่สำเร็จ ${failed} รูป`;
      v2QueueToggle.textContent = "จบรอบแล้ว";
      v2QueueToggle.disabled = true;
      return;
    }
    v2QueueToggle.disabled = false;
    v2QueueStatus.textContent = queuePaused
      ? `พักงานที่ ${completedCount()}/${queueStates.length} รูป · เหลือ ${unfinishedCount()} รูป`
      : `${brief.turbo_mode ? "Turbo Mode · " : ""}กำลังทำงาน ${activeQueue.size}/${concurrentLimit()} · รอคิว ${waiting}`;
    v2QueueToggle.textContent = queuePaused ? "▶ ทำงานต่อ" : "หยุดคิวชั่วคราว";
  };
  const displayGeneratedImage = async (index, result) => {
    const response = await fetch(result.url, { cache: "no-store" });
    if (!response.ok) throw new Error("โหลดรูปจาก R2 ไม่สำเร็จ");
    const blob = await response.blob(),
      file = new File(
        [blob],
        `vision2-image-${index + 1}.${result.mimeType?.includes("jpeg") ? "jpg" : result.mimeType?.includes("webp") ? "webp" : "png"}`,
        { type: result.mimeType || blob.type || "image/png" },
      ),
      url = URL.createObjectURL(file),
      old = slotImages.get(index);
    if (old?.url) URL.revokeObjectURL(old.url);
    slotImages.set(index, {
      file,
      url,
      key: result.key,
      remoteUrl: result.url,
      mimeType: result.mimeType,
      apiSlot: result.apiSlot || apiSlotFor(index),
    });
    const card = workspace.querySelector(`[data-slot="${index}"]`);
    if (card) {
      card.querySelector(".v2-slot-preview").innerHTML =
        `<img src="${url}" alt="ภาพ ${index + 1}">`;
      card.querySelector(".v2-slot-state").textContent = "เสร็จแล้ว";
    }
    queueStates[index] = "เสร็จแล้ว";
    retryCounts[index] = 0;
    activeQueue.delete(index);
    addJobLog(
      `API ${result.apiSlot || apiSlotFor(index)} สร้างภาพสำเร็จและเก็บใน R2 (${result.model || "Gemini"})`,
      index,
      "success",
    );
    updateGeneratedCount();
    dispatchQueue();
  };
  const generateImage = async (index) => {
    if (queuePaused) return;
    const prompt = v2PromptList.value
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean)[index],
      apiSlot = apiSlotFor(index);
    if (!prompt) {
      activeQueue.delete(index);
      return handleQueueFailure(
        index,
        "invalid_prompt",
        0,
        "ไม่พบ Prompt สำหรับภาพนี้",
      );
    }
    const startedAt = Date.now();
    setSlotState(
      index,
      "กำลังสร้าง",
      `Gemini API ${apiSlot} กำลังสร้างภาพ · เริ่มจับเวลาแล้ว`,
    );
    addJobLog(
      `ส่ง Prompt ไป Gemini API ${apiSlot} แล้ว · เริ่มจับเวลา`,
      index,
      "running",
    );
    updateQueueSummary();
    const controller = new AbortController(),
      timeout = setTimeout(() => controller.abort(), 130000);
    try {
      const response = await fetch("/api/admin/vision2/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            provider: brief.image_api,
            prompt,
            project_name: brief.project_name,
            index,
            api_slot: apiSlot,
            aspect_ratio: brief.orientation === "แนวนอน" ? "4:3" : "3:4",
          }),
        }),
        result = await response.json().catch(() => ({})),
        elapsed = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      clearTimeout(timeout);
      if (!response.ok) {
        const detail =
          result.error ||
          `เซิร์ฟเวอร์ตอบ HTTP ${response.status} หลัง ${elapsed} วินาที`;
        if (response.status === 429 || result.code === "rate_limit")
          return handleQueueFailure(
            index,
            "rate_limit",
            result.retryAfter || response.headers.get("retry-after"),
            detail,
          );
        if (result.code === "timeout" || response.status === 504)
          return handleQueueFailure(
            index,
            "timeout",
            0,
            `${detail} · ใช้เวลา ${elapsed} วินาที`,
          );
        activeQueue.delete(index);
        if (
          [
            "api_key_missing",
            "api_key_2_missing",
            "provider_not_connected",
            "storage_missing",
          ].includes(result.code)
        ) {
          queuePaused = true;
          clearQueueTimers();
          setSlotState(index, "พักงานชั่วคราว", detail);
          addJobLog(detail, index, "error");
          return updateQueueSummary();
        }
        return handleQueueFailure(
          index,
          result.code || "generation_failed",
          0,
          `${detail} · ตอบกลับใน ${elapsed} วินาที`,
        );
      }
      await displayGeneratedImage(index, result);
    } catch (error) {
      clearTimeout(timeout);
      const elapsed = Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
        isTimeout = error?.name === "AbortError";
      handleQueueFailure(
        index,
        isTimeout ? "timeout" : "network_error",
        0,
        isTimeout
          ? `หมดเวลาหลังรอ ${elapsed} วินาที`
          : `เชื่อมต่อขัดข้องหลัง ${elapsed} วินาที: ${error?.message || "Network error"}`,
      );
    }
  };
  const dispatchQueue = () => {
    if (queuePaused) return updateQueueSummary();
    while (activeQueue.size < concurrentLimit()) {
      const occupiedSlots = new Set([...activeQueue].map(apiSlotFor)),
        index = queueStates.findIndex(
          (state, i) =>
            state === "รอคิว" &&
            !activeQueue.has(i) &&
            !occupiedSlots.has(apiSlotFor(i)),
        );
      if (index < 0) break;
      activeQueue.add(index);
      const delay = randomDelay(),
        apiSlot = apiSlotFor(index);
      setSlotState(
        index,
        "กำลังเริ่ม",
        `API ${apiSlot} · สุ่มหน่วง ${(delay / 1000).toFixed(1)} วินาทีก่อนสร้าง`,
      );
      addJobLog(
        `API ${apiSlot} เตรียมเริ่มงาน (หน่วง ${(delay / 1000).toFixed(1)} วินาที)`,
        index,
      );
      const timer = setTimeout(() => {
        queueTimers.delete(index);
        if (queuePaused) {
          activeQueue.delete(index);
          setSlotState(index, "รอคิว", "หยุดชั่วคราว รอกดทำงานต่อ");
          return updateQueueSummary();
        }
        generateImage(index);
      }, delay);
      queueTimers.set(index, timer);
    }
    updateQueueSummary();
    persistJob();
  };
  const pauseQueue = () => {
    queuePaused = true;
    clearQueueTimers();
    queueStates.forEach((state, index) => {
      if (state === "กำลังเริ่ม" || state === "กำลังสร้าง")
        setSlotState(index, "รอคิว", "หยุดชั่วคราว รอกดทำงานต่อ");
    });
    addJobLog("หยุดคิวชั่วคราว", null, "warning");
    updateQueueSummary();
  };
  const resumeQueue = () => {
    clearQueueTimers();
    queueStates.forEach((state, index) => {
      if (state !== "เสร็จแล้ว" && !slotImages.has(index)) {
        retryCounts[index] = 0;
        setSlotState(
          index,
          "รอคิว",
          "เริ่มรอบใหม่จากรูปที่ยังไม่สำเร็จ · ครั้งที่ 1/3",
        );
      }
    });
    queuePaused = false;
    addJobLog(
      "เริ่มทำงานต่อ · รีเซ็ต Retry เฉพาะรูปที่ยังไม่สำเร็จ",
      null,
      "success",
    );
    dispatchQueue();
  };
  const handleQueueFailure = (
    index,
    reason = "timeout",
    retryAfter = 0,
    detail = "",
  ) => {
    if (!queueStates[index] || queueStates[index] === "เสร็จแล้ว") return;
    activeQueue.delete(index);
    retryCounts[index] = (retryCounts[index] || 0) + 1;
    const message = detail || `สร้างภาพไม่สำเร็จ (${reason})`;
    setSlotState(
      index,
      "ข้ามชั่วคราว",
      `${message} · พักรูปนี้ไว้ กดลองใหม่เฉพาะรูปภายหลัง`,
    );
    addJobLog(`${message} · พักรูปนี้และข้ามไปทำรูปถัดไป`, index, "error");
    updateQueueSummary();
    persistJob();
    dispatchQueue();
  };
  window.Vision2Queue = {
    reportRateLimit: (index, retryAfter) =>
      handleQueueFailure(Number(index), "rate_limit", retryAfter),
    reportTimeout: (index) => handleQueueFailure(Number(index), "timeout"),
    reportFailure: (index, reason, retryAfter) =>
      handleQueueFailure(Number(index), reason, retryAfter),
  };
  const updateSizePreview = () => {
    if (!orientation) {
      v2SizePreview.textContent = "กรุณาเลือกแนวภาพ";
      return;
    }
    const custom = v2CustomMode.classList.contains("active");
    if (custom) {
      v2SizePreview.textContent = `${v2BriefForm.elements.custom_size.value.trim() || "กรอกขนาดเอง"} · ${orientation}`;
      return;
    }
    const [name, portrait, landscape] = v2SizeSelect.value.split("|");
    v2SizePreview.textContent =
      name === "สี่เหลี่ยมจัตุรัส"
        ? `${name} · ${portrait}`
        : `${name} ${orientation} · ${orientation === "แนวตั้ง" ? portrait : landscape}`;
  };
  const setOrientation = (value) => {
    orientation = value;
    v2Portrait.classList.toggle("active", value === "แนวตั้ง");
    v2Landscape.classList.toggle("active", value === "แนวนอน");
    updateSizePreview();
  };
  const setFrameStyle = (value) => {
    frameStyle = value;
    v2WithFrame.classList.toggle("active", value === "มีเส้นกรอบรูป");
    v2WithoutFrame.classList.toggle("active", value === "ไม่มีเส้นกรอบรูป");
    v2FramePreview.textContent = value;
  };
  const renderUsage = () => {
    const summary = usageData.summary || {},
      credits =
        (Number(summary.images) || 0) * (Number(v2CreditPerImage.value) || 0),
      cost = credits * (Number(v2CostPerCredit.value) || 0);
    v2UsageSummary.innerHTML = `<article><small>สร้าง Prompt</small><b>${Number(summary.runs) || 0} ครั้ง</b></article><article><small>Prompt รวม</small><b>${Number(summary.prompts) || 0} Prompt</b></article><article><small>รูปที่วางแผนสร้าง</small><b>${Number(summary.images) || 0} รูป</b></article><article><small>เครดิตประมาณการ</small><b>${credits.toLocaleString("th-TH", { maximumFractionDigits: 2 })} เครดิต</b></article><article><small>ต้นทุนประมาณการ</small><b>${cost.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท</b></article>`;
    v2UsageTable.innerHTML = (usageData.items || []).length
      ? `<div class="v2-usage-row v2-usage-row-head"><b>วันเวลา</b><b>โครงการ</b><b>ผู้ใช้งาน</b><b>จำนวน</b></div>${usageData.items.map((item) => `<div class="v2-usage-row"><time>${esc(String(item.local_created_at || item.created_at).replace("T", " "))}</time><div><b>${esc(item.project_name || "ไม่ระบุชื่อ")}</b><small>${esc(item.topic || "-")}</small></div><div><b>${esc(item.user_name)}</b><small>${esc(item.user_role)}</small></div><div><b>${Number(item.prompt_count) || 0} Prompt</b><small>${Number(item.image_count) || 0} รูป</small></div></div>`).join("")}`
      : '<div class="v2-usage-empty">ช่วงวันที่เลือกยังไม่มีประวัติการสร้าง Prompt</div>';
  };
  const loadPromptUsage = async () => {
    v2UsageStatus.textContent = "กำลังโหลดประวัติ…";
    const params = new URLSearchParams({
        from: v2UsageFrom.value,
        to: v2UsageTo.value,
      }),
      response = await fetch("/api/admin/prompt-usage?" + params, {
        cache: "no-store",
      }),
      data = await response.json().catch(() => ({}));
    if (!response.ok) {
      v2UsageStatus.textContent = data.error || "โหลดประวัติไม่สำเร็จ";
      return;
    }
    usageData = data;
    v2UsageStatus.textContent = `ช่วง ${data.from} ถึง ${data.to}`;
    renderUsage();
  };
  const recordPromptUsage = async (data) => {
    v2UsageStatus.textContent = "กำลังบันทึกประวัติ Prompt…";
    const response = await fetch("/api/admin/prompt-usage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      }),
      result = await response.json().catch(() => ({}));
    v2UsageStatus.textContent = response.ok
      ? "บันทึกประวัติการสร้าง Prompt แล้ว"
      : result.error || "บันทึกประวัติ Prompt ไม่สำเร็จ";
    if (response.ok && !v2UsagePanel.hidden) loadPromptUsage();
  };
  const updateGeneratedCount = () => {
    const total = v2PromptList.value
      .split("\n")
      .filter((value) => value.trim()).length;
    v2GeneratedCount.textContent = `รูปเสร็จแล้ว ${slotImages.size}/${total} รูป`;
    updateQueueSummary();
    if (total && slotImages.size === total) {
      localStorage.removeItem(JOB_KEY);
      v2ResumeNotice.hidden = true;
    } else persistJob();
  };
  const updateSelection = () => {
    v2SelectedCount.textContent = `เลือกทำตัวอย่างแล้ว ${selected.size}/3 รูป`;
    v2SampleSelection
      .querySelectorAll("[data-v2-select]")
      .forEach(
        (input) =>
          (input.checked = selected.has(Number(input.dataset.v2Select))),
      );
  };
  const currentProjectKey = () =>
    `${brief.project_name || ""}|${brief.topic || ""}|${v2PromptList.value}`;
  const renderSampleSelection = () => {
    selected.clear();
    sampleFiles = [];
    sampleProjectKey = "";
    pdfFile = null;
    if (pdfObjectUrl) {
      URL.revokeObjectURL(pdfObjectUrl);
      pdfObjectUrl = "";
    }
    v2SampleGallery.innerHTML = "";
    v2GoPdf.hidden = true;
    v2OpenSamples.hidden = false;
    v2SampleSelection.innerHTML = [...slotImages.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(
        ([index, item]) =>
          `<article class="v2-sample-choice"><label><input type="checkbox" data-v2-select="${index}"><img src="${item.url}" alt="ภาพ ${index + 1}"><span>ภาพ ${index + 1}</span></label></article>`,
      )
      .join("");
    updateSelection();
  };
  const externalName = document.getElementById("v2ExternalName"),
    externalFiles = document.getElementById("v2ExternalFiles"),
    externalStart = document.getElementById("v2ExternalStart"),
    externalZip = document.getElementById("v2ExternalZip"),
    externalZipStart = document.getElementById("v2ExternalZipStart"),
    externalStatus = document.getElementById("v2ExternalStatus");
  const naturalFileSort = (a, b) =>
    a.name.localeCompare(b.name, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  const startExternalImages = (name, files, sourceLabel = "อัปโหลดรูป") => {
    files = [...files].sort(naturalFileSort);
    if (!name) throw new Error("กรุณากรอกชื่อสินค้า");
    if (files.length < 3 || files.length > 200)
      throw new Error("ต้องมีรูปตั้งแต่ 3–200 รูป");
    if (
      files.some(
        (file) =>
          !["image/jpeg", "image/png", "image/webp"].includes(file.type),
      )
    )
      throw new Error("รองรับเฉพาะ JPG, PNG และ WEBP");
    if (files.some((file) => file.size > 15 * 1024 * 1024))
      throw new Error("รูปแต่ละไฟล์ต้องมีขนาดไม่เกิน 15 MB");
    slotImages.forEach((item) => {
      if (item.url?.startsWith("blob:")) URL.revokeObjectURL(item.url);
    });
    slotImages.clear();
    files.forEach((file, index) =>
      slotImages.set(index, { file, url: URL.createObjectURL(file) }),
    );
    brief = {
      project_name: name,
      topic: "งานอัปโหลดจากภายนอก",
      count: files.length,
      output_size: "ตามขนาดไฟล์ต้นฉบับ",
      orientation: "ตามไฟล์ต้นฉบับ",
      frame_style: "ตามไฟล์ต้นฉบับ",
      style: "งานอัปโหลดจากภายนอก",
      audience: "ตามงานต้นฉบับ",
      instructions: "",
      image_api: "external-upload",
      image_api_name: sourceLabel,
      source: "external-upload",
    };
    importedProductFile = null;
    importedPageCount = 0;
    importedCandidateCount = 0;
    promptItems = [];
    v2PromptList.value = files
      .map((file, index) => `รูป ${index + 1}: ${file.name}`)
      .join("\n");
    v2PromptCount.textContent = `${files.length} รูปจากภายนอก`;
    queueStates.length = 0;
    retryCounts.length = 0;
    activeQueue.clear();
    externalStatus.textContent = `รับไฟล์แล้ว ${files.length} รูปจาก${sourceLabel} · พร้อมเลือก 3 รูปทำ SAMPLE`;
    renderSampleSelection();
    show(4);
  };
  const unzipImageFiles = async (zipFile, selectionSpec = "1-30") => {
    if (!zipFile) throw new Error("กรุณาเลือกไฟล์ ZIP");
    if (zipFile.size > 500 * 1024 * 1024)
      throw new Error("ไฟล์ ZIP ต้องมีขนาดไม่เกิน 500 MB");
    const bytes = new Uint8Array(await zipFile.arrayBuffer()),
      view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let eocd = -1;
    for (
      let index = bytes.length - 22;
      index >= Math.max(0, bytes.length - 65557);
      index--
    )
      if (view.getUint32(index, true) === 0x06054b50) {
        eocd = index;
        break;
      }
    if (eocd < 0) throw new Error("ไฟล์ ZIP ไม่สมบูรณ์หรืออ่านไม่ได้");
    const entryCount = view.getUint16(eocd + 10, true),
      centralOffset = view.getUint32(eocd + 16, true);
    if (
      entryCount === 0xffff ||
      centralOffset === 0xffffffff ||
      entryCount > 30000
    )
      throw new Error("ZIP นี้มีรูปแบบหรือจำนวนไฟล์ที่ระบบยังไม่รองรับ");
    const decoder = new TextDecoder("utf-8"),
      entries = [];
    let position = centralOffset,
      totalSize = 0;
    for (let entryIndex = 0; entryIndex < entryCount; entryIndex++) {
      if (
        position + 46 > bytes.length ||
        view.getUint32(position, true) !== 0x02014b50
      )
        throw new Error("ตารางไฟล์ภายใน ZIP ไม่สมบูรณ์");
      const flags = view.getUint16(position + 8, true),
        method = view.getUint16(position + 10, true),
        compressedSize = view.getUint32(position + 20, true),
        size = view.getUint32(position + 24, true),
        nameLength = view.getUint16(position + 28, true),
        extraLength = view.getUint16(position + 30, true),
        commentLength = view.getUint16(position + 32, true),
        localOffset = view.getUint32(position + 42, true),
        name = decoder.decode(
          bytes.subarray(position + 46, position + 46 + nameLength),
        );
      position += 46 + nameLength + extraLength + commentLength;
      if (
        !/\.(jpe?g|png|webp|pdf)$/i.test(name) ||
        name.includes("__MACOSX/") ||
        name.endsWith("/")
      )
        continue;
      if (flags & 1)
        throw new Error(`ไฟล์ ${name} ถูกเข้ารหัสผ่าน ระบบเปิดไม่ได้`);
      if (![0, 8].includes(method))
        throw new Error(`ไฟล์ ${name} ใช้วิธีบีบอัดที่ไม่รองรับ`);
      const isPdf = /\.pdf$/i.test(name);
      if (size > (isPdf ? 100 : 15) * 1024 * 1024)
        throw new Error(`${isPdf ? "PDF" : "รูป"} ${name} มีขนาดใหญ่เกินไป`);
      entries.push({ name, method, compressedSize, size, localOffset });
    }
    if (!entries.length || entries.length > 30000)
      throw new Error(`ไม่พบรูปหรือ PDF ที่ระบบรองรับภายใน ZIP`);
    const sortedEntries = entries.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      ),
      pdfEntries = sortedEntries.filter((entry) => /\.pdf$/i.test(entry.name)),
      imageEntries = sortedEntries.filter((entry) => !/\.pdf$/i.test(entry.name)),
      chosenEntries = pdfEntries.length
        ? pdfEntries.slice(0, 50)
        : candidatePages(selectionSpec, imageEntries.length).map(
            (page) => imageEntries[page - 1],
          );
    if (pdfEntries.length > 50)
      throw new Error("ZIP มี PDF เกิน 50 ไฟล์ กรุณาแบ่ง ZIP ก่อนนำเข้า");
    const files = [];
    totalSize = 0;
    for (const entry of chosenEntries) {
      totalSize += entry.size;
      if (totalSize > 750 * 1024 * 1024)
        throw new Error("ไฟล์ที่เลือกจาก ZIP มีขนาดรวมเกิน 750 MB");
      const offset = entry.localOffset;
      if (
        offset + 30 > bytes.length ||
        view.getUint32(offset, true) !== 0x04034b50
      )
        throw new Error(`อ่านไฟล์ ${entry.name} ไม่สำเร็จ`);
      const nameLength = view.getUint16(offset + 26, true),
        extraLength = view.getUint16(offset + 28, true),
        dataStart = offset + 30 + nameLength + extraLength,
        dataEnd = dataStart + entry.compressedSize;
      if (dataEnd > bytes.length)
        throw new Error(`ข้อมูลไฟล์ ${entry.name} ไม่ครบ`);
      const compressed = bytes.slice(dataStart, dataEnd);
      let raw;
      if (entry.method === 0) raw = compressed;
      else {
        if (typeof DecompressionStream !== "function")
          throw new Error(
            "เบราว์เซอร์นี้ยังเปิด ZIP ไม่ได้ กรุณาใช้ Chrome เวอร์ชันล่าสุด",
          );
        try {
          raw = new Uint8Array(
            await new Response(
              new Blob([compressed])
                .stream()
                .pipeThrough(new DecompressionStream("deflate-raw")),
            ).arrayBuffer(),
          );
        } catch (error) {
          throw new Error(`แตกไฟล์ ${entry.name} ไม่สำเร็จ`);
        }
      }
      if (raw.length !== entry.size)
        throw new Error(`ขนาดไฟล์ ${entry.name} ไม่ตรงกับข้อมูล ZIP`);
      const extension = entry.name.split(".").pop().toLowerCase(),
        type =
          extension === "pdf"
            ? "application/pdf"
            : extension === "png"
            ? "image/png"
            : extension === "webp"
              ? "image/webp"
              : "image/jpeg",
        safeName =
          entry.name.split("/").pop() ||
          `image-${files.length + 1}.${extension}`;
      files.push(new File([raw], safeName, { type }));
    }
    return {
      files,
      totalEntries: pdfEntries.length ? pdfEntries.length : imageEntries.length,
    };
  };
  externalStart.onclick = () => {
    try {
      startExternalImages(
        externalName.value.trim(),
        externalFiles.files,
        "การอัปโหลดรูป",
      );
    } catch (error) {
      externalStatus.textContent = error.message;
      alert(error.message);
    }
  };
  let pdfJsPromise = null;
  const loadPdfJs = async () => {
    if (!pdfJsPromise)
      pdfJsPromise = import("/vendor/pdfjs/pdf.mjs?v=014240").then((pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc =
          "/vendor/pdfjs/pdf.worker.mjs?v=014240";
        return pdfjs;
      });
    return pdfJsPromise;
  };
  const candidatePages = (value, total) => {
    const pages = new Set();
    for (const token of String(value || "1-30").split(",")) {
      const match = token.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
      if (!match) throw new Error(`รูปแบบเลขหน้า “${token.trim()}” ไม่ถูกต้อง`);
      let start = Number(match[1]),
        end = Number(match[2] || match[1]);
      if (start > end) [start, end] = [end, start];
      if (start < 1 || start > total)
        throw new Error(`ไฟล์มี ${total} หน้า/รูป แต่ระบุเริ่มที่ ${start}`);
      end = Math.min(end, total);
      for (let page = start; page <= end; page++) {
        pages.add(page);
        if (pages.size > 200)
          throw new Error("เลือกหน้าสำหรับคัด SAMPLE ได้สูงสุด 200 หน้า");
      }
    }
    return [...pages];
  };
  const renderPdfCandidates = async (pdfFiles, pageSpec) => {
    const pdfjs = await loadPdfJs(),
      rendered = [],
      documents = [];
    let totalPages = 0;
    for (const file of pdfFiles) {
      const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }),
        documentPdf = await task.promise;
      documents.push({ file, documentPdf, firstPage: totalPages + 1 });
      totalPages += documentPdf.numPages;
    }
    const pages = candidatePages(pageSpec, totalPages);
    for (const globalPage of pages) {
      const source = [...documents]
          .reverse()
          .find((item) => globalPage >= item.firstPage),
        pageNumber = globalPage - source.firstPage + 1;
        externalStatus.textContent = `กำลังเปิด ${source.file.name} · หน้า ${pageNumber}/${source.documentPdf.numPages}…`;
        const page = await source.documentPdf.getPage(pageNumber),
          base = page.getViewport({ scale: 1 }),
          scale = Math.min(2, 1400 / Math.max(base.width, base.height)),
          viewport = page.getViewport({ scale }),
          canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(viewport.width));
        canvas.height = Math.max(1, Math.round(viewport.height));
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("เบราว์เซอร์เปิดหน้ากระดาษไม่ได้");
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: context, viewport }).promise;
        const blob = await new Promise((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", 0.86),
        );
        page.cleanup();
        if (!blob) throw new Error(`แปลงหน้า ${pageNumber} เป็นรูปไม่สำเร็จ`);
        rendered.push(
          new File([blob], `${source.file.name.replace(/\.pdf$/i, "")}-page-${String(pageNumber).padStart(5, "0")}.jpg`, {
            type: "image/jpeg",
          }),
        );
    }
    for (const item of documents) await item.documentPdf.destroy();
    return { files: rendered, totalPages };
  };
  const startImportedProduct = (
    name,
    previewFiles,
    productFile,
    totalPages,
    sourceLabel,
  ) => {
    if (/\.zip$/i.test(productFile.name) && productFile.type !== "application/zip")
      productFile = new File([productFile], productFile.name, {
        type: "application/zip",
        lastModified: productFile.lastModified,
      });
    startExternalImages(name, previewFiles, sourceLabel);
    importedProductFile = productFile;
    importedPageCount = totalPages || previewFiles.length;
    importedCandidateCount = previewFiles.length;
    brief.source = "ready-file-import";
    brief.product_file_name = productFile.name;
    brief.product_file_type = productFile.type;
    externalStatus.textContent = `พร้อมแล้ว · มีตัวเลือก ${previewFiles.length} รูป · ไฟล์ขาย ${productFile.name} จะถูกแนบเข้าตะกร้าโดยตรง`;
  };
  externalZipStart.onclick = async () => {
    externalZipStart.disabled = true;
    externalZipStart.textContent = "กำลังอ่าน ZIP / PDF…";
    externalStatus.textContent = "กำลังตรวจไฟล์และเตรียมหน้าสำหรับเลือก SAMPLE…";
    try {
      const source = externalZip.files?.[0];
      if (!source) throw new Error("กรุณาเลือกไฟล์ ZIP หรือ PDF");
      if (source.size > 100 * 1024 * 1024)
        throw new Error("ไฟล์สำหรับตะกร้าต้องมีขนาดไม่เกิน 100 MB");
      const name = externalName.value.trim();
      if (!name) throw new Error("กรุณากรอกชื่อสินค้า");
      const isPdf = source.type === "application/pdf" || /\.pdf$/i.test(source.name);
      if (isPdf) {
        const result = await renderPdfCandidates(
          [source],
          document.getElementById("v2ExternalPdfPages").value,
        );
        startImportedProduct(name, result.files, source, result.totalPages, "หน้า PDF");
      } else {
        const unpacked = await unzipImageFiles(
            source,
            document.getElementById("v2ExternalPdfPages").value,
          ),
          pdfs = unpacked.files.filter((file) => file.type === "application/pdf"),
          images = unpacked.files.filter((file) => file.type.startsWith("image/"));
        if (pdfs.length) {
          const result = await renderPdfCandidates(
            pdfs,
            document.getElementById("v2ExternalPdfPages").value,
          );
          startImportedProduct(name, result.files, source, result.totalPages, "PDF ภายใน ZIP");
        } else {
          startImportedProduct(name, images, source, unpacked.totalEntries, "รูปภายใน ZIP");
        }
      }
    } catch (error) {
      externalStatus.textContent = error.message;
      alert(error.message);
    } finally {
      externalZipStart.disabled = false;
      externalZipStart.textContent = "อ่าน ZIP / PDF → เลือก SAMPLE";
    }
  };

  const usageToday = new Date().toISOString().slice(0, 10),
    usageFrom = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  v2UsageFrom.value = usageFrom;
  v2UsageTo.value = usageToday;
  v2UsageButton.onclick = () => {
    v2UsagePanel.hidden = false;
    loadPromptUsage();
  };
  v2CloseUsage.onclick = () => (v2UsagePanel.hidden = true);
  v2LoadUsage.onclick = loadPromptUsage;
  v2CreditPerImage.oninput = renderUsage;
  v2CostPerCredit.oninput = renderUsage;

  v2ImageApi.onchange = () => {
    v2ApiName.textContent = apiLabel();
  };
  v2PresetMode.onclick = () => {
    setSizeMode(false);
    v2SizeModePreview.textContent = "เลือกจากขนาดมาตรฐาน";
    updateSizePreview();
  };
  v2CustomMode.onclick = () => {
    setSizeMode(true);
    v2SizeModePreview.textContent = "ระบุขนาดด้วยตัวเอง";
    updateSizePreview();
  };
  v2Portrait.onclick = () => setOrientation("แนวตั้ง");
  v2Landscape.onclick = () => setOrientation("แนวนอน");
  v2WithFrame.onclick = () => setFrameStyle("มีเส้นกรอบรูป");
  v2WithoutFrame.onclick = () => setFrameStyle("ไม่มีเส้นกรอบรูป");
  v2SizeSelect.onchange = updateSizePreview;
  v2BriefForm.elements.custom_size.oninput = updateSizePreview;
  setSizeMode(false);
  updateSizePreview();
  button.onclick = () => {
    if(!launchingProductEdit)editProductTarget=null;
    workspace.hidden = false;
    document.body.classList.remove("product-editor-active");
    let saved = localStorage.getItem(JOB_KEY);
    if (saved) {
      try {
        const oldPrompts = String(JSON.parse(saved)?.prompts || "")
          .split("\n")
          .filter((value) => value.trim());
        if (oldPrompts.length > 200) {
          localStorage.removeItem(JOB_KEY);
          saved = null;
          alert(
            `ล้างงานค้างรูปแบบเก่า ${oldPrompts.length} งานแล้ว กรุณาเริ่มจากช่วงที่ 1 ใหม่`,
          );
        }
      } catch (error) {
        localStorage.removeItem(JOB_KEY);
        saved = null;
      }
    }
    v2ResumeNotice.hidden = !saved;
    show(saved ? 3 : 1);
  };
  window.startVision2ProductEdit=(target)=>{
    editProductTarget={...target};
    launchingProductEdit=true;
    button.click();
    launchingProductEdit=false;
    externalName.value=target.title||'';
    externalStatus.textContent=`กำลังแก้ตะกร้าเดิม: ${target.title||target.slug} · เลือก ZIP รูปใหม่ด้านล่าง`;
    show(1);
    requestAnimationFrame(()=>externalZip.closest('.v2-external-source')?.scrollIntoView({behavior:'smooth',block:'center'}));
  };
  workspace.querySelector(".v2-close").onclick = () =>
    (workspace.hidden = true);
  workspace
    .querySelectorAll("[data-v2-back]")
    .forEach(
      (back) => (back.onclick = () => show(Number(back.dataset.v2Back))),
    );
  v2BriefForm.addEventListener(
    "submit",
    (event) => {
      if (v2TextMode.value) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      alert("กรุณาเลือกว่าจะใส่ข้อความหรือไม่ใส่ข้อความ");
    },
    true,
  );
  v2PrepareSlots.addEventListener(
    "click",
    (event) => {
      const expected = Math.min(
          200,
          Math.max(1, Number(v2BriefForm.elements.count.value) || 1),
        ),
        stored = v2PromptList.value.split("\n").filter((value) => value.trim());
      if (stored.length <= 200 && promptItems.length === expected) return;
      if (!rebuildPromptTableFromStep1()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        alert(
          "ข้อมูล Prompt ไม่ถูกต้อง กรุณากลับไปช่วงที่ 1 แล้วสร้างตารางใหม่",
        );
      }
    },
    true,
  );
  v2BriefForm.onsubmit = (event) => {
    event.preventDefault();
    if (!v2ImageApi.value) return alert("กรุณาเลือก API สร้างภาพสำหรับงานนี้");
    if (!orientation) return alert("กรุณาเลือกแนวตั้งหรือแนวนอน");
    if (!frameStyle)
      return alert("กรุณาเลือกว่าต้องการมีเส้นกรอบรูปหรือไม่มีเส้นกรอบรูป");
    const custom = v2CustomMode.classList.contains("active");
    brief = Object.fromEntries(new FormData(v2BriefForm));
    brief.image_api_name = apiLabel();
    if (custom) {
      brief.output_size = `${brief.custom_size.trim()} ${orientation}`;
    } else {
      const [name, portrait, landscape] = brief.size.split("|");
      brief.output_size =
        name === "สี่เหลี่ยมจัตุรัส"
          ? `${name} ${portrait}`
          : `${name} ${orientation} ${orientation === "แนวตั้ง" ? portrait : landscape}`;
    }
    brief.orientation = orientation;
    brief.frame_style = frameStyle;
    const count = Math.min(200, Math.max(1, Number(brief.count) || 1));
    const base = `สร้างภาพขนาด ${brief.output_size} ${brief.frame_style} เป็น${brief.style} หัวข้อ ${brief.topic} เหมาะสำหรับ${brief.audience}${brief.instructions ? " " + brief.instructions : ""}`;
    v2PromptList.value = Array.from(
      { length: count },
      (_, index) =>
        `${base} แบบที่ ${index + 1} องค์ประกอบและท่าทางไม่ซ้ำกับภาพอื่น`,
    ).join("\n");
    v2PromptCount.textContent = `${count} Prompt`;
    show(2);
  };
  const renderQueueSlots = (prompts, statuses = [], retries = []) => {
    queueStates.splice(
      0,
      queueStates.length,
      ...prompts.map((_, index) => statuses[index] || "รอคิว"),
    );
    retryCounts.splice(
      0,
      retryCounts.length,
      ...prompts.map((_, index) => Number(retries[index]) || 0),
    );
    v2ImageSlots.innerHTML = prompts
      .map(
        (prompt, index) =>
          `<article class="v2-image-slot" data-slot="${index}"><div class="v2-slot-title"><b>ภาพ ${index + 1}</b><span class="v2-slot-state">${esc(queueStates[index])}</span></div><div class="v2-slot-preview"><span>${queueStates[index] === "รอนำรูปกลับเข้าระบบ" ? "กรุณานำไฟล์รูปกลับเข้าช่อง" : queueStates[index] === "พักงานชั่วคราว" ? "งานนี้ถูกพัก กดลองใหม่เฉพาะรูป" : "รอเริ่มสร้างอัตโนมัติ"}</span></div><small>${esc(prompt)}</small><div class="v2-slot-actions v2-slot-actions-three"><button type="button" data-v2-generate="${index}">ลองใหม่เฉพาะรูป</button><button type="button" data-v2-regenerate="${index}">↻ สร้างใหม่เฉพาะรูปนี้</button><label>นำรูปเข้าช่อง<input type="file" data-v2-upload="${index}" accept="image/jpeg,image/png,image/webp"></label></div></article>`,
      )
      .join("");
    updateGeneratedCount();
  };
  v2PrepareSlots.onclick = () => {
    const prompts = v2PromptList.value
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean);
    if (!prompts.length) return alert("ยังไม่มี Prompt สำหรับสร้างรูป");
    clearQueueTimers();
    selected.clear();
    slotImages.forEach((item) => URL.revokeObjectURL(item.url));
    slotImages.clear();
    jobLogs = [];
    queuePaused = false;
    renderQueueSlots(prompts);
    v2PromptCount.textContent = `${prompts.length} Prompt`;
    const mode = brief.turbo_mode
      ? "Turbo Mode · API 1 รูปเลขคี่ + API 2 รูปเลขคู่ · พร้อมกันสูงสุด 2 รูป"
      : "โหมดปกติ · API 1 · ทำทีละ 1 รูป";
    workspace.querySelector(".v2-coming").innerHTML =
      `<b>${brief.turbo_mode ? "Turbo Mode · สร้างพร้อมกันรอบละ 2 รูป" : "คิวสร้างภาพอัตโนมัติครั้งละ 1 รูป"}</b><br>${brief.turbo_mode ? "API 1 รับรูปเลขคี่ และ API 2 รับรูปเลขคู่ · " : ""}ระบบหน่วงสุ่ม 10–20 วินาที หากรูปใดไม่สำเร็จจะพักและข้ามไปทำรูปถัดไปให้ครบหนึ่งรอบ แล้วจึงให้สั่งสร้างซ้ำเฉพาะรูปที่ยังไม่สำเร็จ`;
    addJobLog(
      `ใช้ ${brief.image_api_name || brief.image_api || "API ที่เลือก"} · ${mode} · สร้างคิว ${prompts.length} รูป · หน่วง 10–20 วินาที`,
      null,
      "success",
    );
    recordPromptUsage({
      project_name: brief.project_name,
      topic: brief.topic,
      image_count: prompts.length,
      prompt_count: prompts.length,
    });
    show(3);
    dispatchQueue();
  };
  v2RetryFailed.onclick = () => {
    const failedIndexes = [];
    queueStates.forEach((state, index) => {
      if (state === "ข้ามชั่วคราว" && !slotImages.has(index)) {
        failedIndexes.push(index);
        retryCounts[index] = 0;
        setSlotState(index, "รอคิว", "เข้าคิวสร้างซ้ำเฉพาะรูปที่ไม่สำเร็จ");
      }
    });
    if (!failedIndexes.length) return alert("ไม่มีรูปที่ต้องสร้างซ้ำ");
    queuePaused = false;
    v2QueueToggle.disabled = false;
    v2RetryFailed.hidden = true;
    addJobLog(
      `เริ่มรอบสร้างซ้ำเฉพาะ ${failedIndexes.length} รูปที่ไม่สำเร็จ`,
      null,
      "warning",
    );
    dispatchQueue();
  };
  v2ImageSlots.addEventListener("change", (event) => {
    const upload = event.target.closest("[data-v2-upload]");
    if (!upload || !upload.files[0]) return;
    const index = Number(upload.dataset.v2Upload),
      old = slotImages.get(index);
    if (old) URL.revokeObjectURL(old.url);
    const file = upload.files[0],
      url = URL.createObjectURL(file);
    slotImages.set(index, { file, url });
    const card = workspace.querySelector(`[data-slot="${index}"]`);
    card.querySelector(".v2-slot-preview").innerHTML =
      `<img src="${url}" alt="ภาพ ${index + 1}">`;
    card.querySelector(".v2-slot-state").textContent = "เสร็จแล้ว";
    queueStates[index] = "เสร็จแล้ว";
    retryCounts[index] = 0;
    activeQueue.delete(index);
    const timer = queueTimers.get(index);
    if (timer) clearTimeout(timer);
    queueTimers.delete(index);
    addJobLog("ได้รับรูปและบันทึกสำเร็จ", index, "success");
    updateGeneratedCount();
    dispatchQueue();
  });
  v2ImageSlots.addEventListener("click", (event) => {
    const generate = event.target.closest("[data-v2-generate]"),
      regenerate = event.target.closest("[data-v2-regenerate]"),
      button = regenerate || generate;
    if (!button) return;
    const index = Number(
        regenerate
          ? regenerate.dataset.v2Regenerate
          : generate.dataset.v2Generate,
      ),
      old = slotImages.get(index);
    if (old) URL.revokeObjectURL(old.url);
    slotImages.delete(index);
    selected.delete(index);
    activeQueue.delete(index);
    retryCounts[index] = 0;
    const timer = queueTimers.get(index);
    if (timer) clearTimeout(timer);
    queueTimers.delete(index);
    if (queuePaused) queuePaused = false;
    setSlotState(
      index,
      "รอคิว",
      regenerate ? "เข้าคิวสร้างใหม่เฉพาะภาพนี้" : "เข้าคิวลองใหม่เฉพาะภาพนี้",
    );
    addJobLog(
      regenerate ? "สั่งสร้างใหม่เฉพาะรูป" : "สั่งลองใหม่เฉพาะรูป",
      index,
      "warning",
    );
    dispatchQueue();
    recordPromptUsage({
      project_name: `${brief.project_name || brief.topic || "Vision 2"} · ภาพ ${index + 1}`,
      topic: brief.topic,
      image_count: 1,
      prompt_count: 1,
    });
    updateGeneratedCount();
  });

  v2QueueToggle.onclick = () => (queuePaused ? resumeQueue() : pauseQueue());
  v2ClearLog.onclick = () => {
    jobLogs = [];
    renderJobLog();
    persistJob();
  };
  v2ResumeSaved.onclick = async () => {
    const saved = JSON.parse(localStorage.getItem(JOB_KEY) || "null");
    if (!saved) return;
    brief = {
      image_api: "google-imagen",
      image_api_name: "Gemini Image API (ค่าเริ่มต้น)",
      ...(saved.brief || {}),
    };
    v2PromptList.value = saved.prompts || "";
    jobLogs = Array.isArray(saved.logs) ? saved.logs : [];
    renderJobLog();
    const prompts = v2PromptList.value
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean),
      results = Array.isArray(saved.results) ? saved.results : [],
      resultIndexes = new Set(results.map((item) => Number(item.index)));
    clearQueueTimers();
    slotImages.clear();
    queuePaused = false;
    const statuses = prompts.map((_, index) =>
      resultIndexes.has(index) ? "เสร็จแล้ว" : "รอคิว",
    );
    renderQueueSlots(prompts, statuses, []);
    v2ResumeNotice.hidden = true;
    show(3);
    for (const result of results) {
      try {
        await displayGeneratedImage(Number(result.index), {
          ...result,
          model: "R2",
        });
      } catch (error) {
        setSlotState(
          Number(result.index),
          "รอคิว",
          "โหลดรูปเดิมจาก R2 ไม่สำเร็จ ระบบจะสร้างใหม่",
        );
      }
    }
    addJobLog(
      `เปิดงานค้างจากจุดล่าสุด ${slotImages.size}/${prompts.length} · รีเซ็ต Retry ของรูปที่ยังไม่สำเร็จ`,
      null,
      "success",
    );
    dispatchQueue();
  };
  v2DiscardSaved.onclick = () => {
    if (!confirm("ล้างงานค้างและเริ่มโครงการใหม่ใช่หรือไม่")) return;
    clearQueueTimers();
    localStorage.removeItem(JOB_KEY);
    queueStates.length = 0;
    jobLogs = [];
    v2ResumeNotice.hidden = true;
    show(1);
  };
  window.addEventListener("beforeunload", (event) => {
    if (queueStates.length && unfinishedCount() > 0) {
      persistJob();
      event.preventDefault();
      event.returnValue = "";
    }
  });
  const oldBriefForm = v2BriefForm,
    newBuilder = document.createElement("section");
  oldBriefForm.hidden = true;
  steps[0].textContent = "Step 1 ตาราง Prompt";
  steps[1].hidden = true;
  steps[2].textContent = "Step 2 สร้างภาพ";
  steps[3].textContent = "Step 3 เลือกรูปทำตัวอย่าง";
  steps[4].textContent = "Step 4 รวมภาพทั้งหมดเป็น PDF";
  steps[5].textContent = "Step 5 เพิ่มสินค้าและจบงาน";
  steps[6].hidden = true;
  workspace.querySelectorAll('[data-v2-back="2"]').forEach((back) => {
    back.dataset.v2Back = "1";
    back.textContent = "← กลับ Step 1 ตาราง Prompt";
  });
  panels[3].querySelector("h4").textContent = "เลือกรูปจาก Step 2 จำนวน 3 รูป";
  panels[3].querySelector("h4+p").textContent =
    "รูปที่เสร็จทั้งหมดจาก Step 2 จะแสดงที่นี่ เลือก 3 รูปเพื่อทำ SAMPLE โดยไฟล์ต้นฉบับไม่ถูกแก้ไข";
  panels[4].querySelector(".v2-coming").innerHTML =
    "<b>รวมภาพต้นฉบับทั้งหมดจาก Step 2 เป็น PDF</b><br>ระบบจะเรียงภาพต้นฉบับทั้งหมดตามลำดับเพื่อทำ PDF ส่วนรูป SAMPLE 3 รูปจาก Step 3 ใช้แสดงหน้าสินค้าเท่านั้น";
  const selectOptions = (items, selected = "") =>
    items
      .map(
        (item) =>
          `<option${item === selected ? " selected" : ""}>${esc(item)}</option>`,
      )
      .join("");
  const sizeOptions = [
    "A4 · 210 × 297 มม.",
    "A5 · 148 × 210 มม.",
    "โปสการ์ด · 100 × 148 มม.",
    "นามบัตร · 54 × 90 มม.",
  ];
  const orientationOptions = ["รูปแนวตั้ง", "รูปแนวนอน"];
  const styleOptions = [
    "การ์ตูนเด็กเส้นหนา",
    "ธีมงานแต่ง",
    "ธีมงานบวช",
    "ธีมงานศพ",
    "โมเดลการ์ตูนกระดาษพับ",
    "ตุ๊กตากระดาษ",
    "แบบสัก",
    "แบบสักดุดัน",
    "แบบสักเศร้า",
    "แบบสักเท่",
    "แบบสักวินเทจ",
    "แบบสักสดใส",
    "แบบสัก Minimal — ลายเรียบง่าย ใช้เส้นและองค์ประกอบน้อย เหมาะกับแบบสักขนาดเล็ก",
    "แบบสัก Fine Line — ใช้เส้นบางละเอียด ให้ความรู้สึกอ่อนโยน สะอาด และประณีต",
    "แบบสัก Line Art — สร้างภาพจากเส้นเป็นหลัก ลดการลงเงาและพื้นที่ทึบ เน้นรูปทรงที่ชัดเจน",
    "แบบสัก Geometric — ประกอบด้วยรูปทรงเรขาคณิต เส้นตรง วงกลม และลวดลายที่มีความสมมาตร",
    "แบบสัก Dotwork — ใช้จุดจำนวนมากสร้างรูปทรง น้ำหนัก แสง และเงาแทนการระบายแบบทั่วไป",
    "แบบสัก Blackwork — ใช้หมึกสีดำเป็นหลัก มีทั้งเส้นหนา พื้นที่ดำทึบ และลวดลายตัดกับผิว",
    "แบบสัก Silhouette — แสดงรูปร่างเป็นภาพเงาดำ เน้นโครงร่างที่มองแล้วเข้าใจได้ทันที",
    "แบบสัก Tribal — ใช้เส้นดำหนา รูปทรงโค้ง และปลายแหลมต่อเนื่องกันเป็นลวดลายโดดเด่น",
    "แบบสัก Mandala — ลวดลายวงกลมที่มีความสมมาตรและรายละเอียดซ้ำอย่างเป็นระเบียบ",
    "แบบสัก Ornamental — ลายประดับที่ได้รับแรงบันดาลใจจากลูกไม้ เครื่องประดับ และลวดลายตกแต่ง",
    "แบบสัก American Traditional — เส้นขอบหนา สีชัด และใช้ภาพคลาสสิก เช่น กุหลาบ สมอเรือ หรือนกอินทรี",
    "แบบสัก Neo-Traditional — พัฒนาจาก American Traditional เพิ่มรายละเอียด มิติ และชุดสีที่หลากหลายขึ้น",
    "แบบสัก Japanese / Irezumi — ศิลปะแบบสักญี่ปุ่นที่นิยมใช้มังกร ปลาคาร์ป เสือ คลื่น และดอกไม้",
    "แบบสักไทยประเพณี — ใช้ลายไทยและตัวละครจากศิลปวัฒนธรรมไทย เช่น พญานาค ครุฑ และหนุมาน",
    "แบบสัก Realism — ถ่ายทอดคน สัตว์ ธรรมชาติ หรือวัตถุให้มีรายละเอียดและสัดส่วนใกล้เคียงภาพจริง",
    "แบบสัก Micro Realism — ภาพสมจริงในขนาดเล็ก ใช้รายละเอียดและการไล่น้ำหนักอย่างประณีต",
    "แบบสัก Watercolor — ใช้สีฟุ้ง สีไหล และรอยปาดเลียนแบบงานวาดสีน้ำ",
    "แบบสัก Sketch — มีลักษณะเหมือนภาพร่างด้วยดินสอ ใช้เส้นขีดซ้อน เส้นโครง และรอยปาดอย่างเป็นธรรมชาติ",
    "แบบสัก Abstract — ใช้เส้น สี และรูปทรงอิสระ ไม่จำเป็นต้องแสดงวัตถุอย่างตรงไปตรงมา",
    "แบบสัก Trash Polka — ผสมภาพเหมือน ตัวอักษร ลายกราฟิก และรอยปาด โดยนิยมใช้สีดำกับแดง",
    "แบบสัก Cyber Sigilism — ใช้เส้นบางแหลมและสัญลักษณ์คล้ายวงจรหรืออักขระดิจิทัล ให้บรรยากาศล้ำอนาคต",
    "แบบสัก Biomechanical — ผสมโครงสร้างร่างกาย กล้ามเนื้อ กระดูก สายไฟ และชิ้นส่วนเครื่องจักรเข้าด้วยกัน",
    "แบบสัก Dark Art / Gothic — เน้นบรรยากาศลึกลับ มืดหม่น และน่ากลัว เช่น กะโหลก ปีศาจ และสถาปัตยกรรมโกธิก",
    "แบบสัก Chicano — งานขาวดำที่ได้รับอิทธิพลจากวัฒนธรรมเม็กซิกัน–อเมริกัน นิยมภาพบุคคล ศาสนา และตัวอักษร",
    "แบบสัก Lettering — ใช้ตัวอักษร คำพูด ชื่อ วันที่ หรือลายเซ็นเป็นองค์ประกอบสำคัญของงาน",
    "แบบสัก Cute / Cartoon — ใช้รูปทรงน่ารัก สีสด หรือเส้นเรียบง่าย เหมาะกับลายที่ดูเป็นมิตรและสนุกสนาน",
    "แบบสักเส้นเดียวต่อเนื่อง — ใช้เส้นสีดำต่อเนื่องวาดภาพตั้งแต่ต้นจนจบ ลดรายละเอียด ไม่มีการลงสีและแสงเงา เน้นรูปทรงที่เรียบง่ายแต่ดูออกว่าเป็นภาพอะไร",
    "แบบสักเส้นบางละเอียด — ใช้เส้นขนาดเล็กคล้ายภาพวาดด้วยดินสอ เหมาะกับสัตว์ ดอกไม้ ดวงดาว และรูปขนาดเล็ก ให้ความรู้สึกสะอาด เบา และประณีต",
    "แบบสักเรขาคณิตตามสรีระ — ใช้เส้นตรง เส้นโค้ง วงกลม จุด และรูปทรงเรขาคณิต จัดวางให้ไหลไปตามส่วนโค้งของแขน ขา ไหล่ หรือแผ่นหลัง",
    "แบบสักญี่ปุ่นดั้งเดิม — ใช้เส้นขอบชัดและองค์ประกอบขนาดใหญ่ เช่น มังกร ปลาคาร์ป เสือ งู คลื่น เมฆ และดอกไม้ จัดเป็นฉากที่มีเรื่องราวและเต็มพื้นที่",
    "แบบสักสีน้ำเรขาคณิต — ลดรูปสัตว์ ดอกไม้ หรือบุคคลให้เป็นรูปทรงเหลี่ยม ผสมสีสดแบบโปร่งและรอยปาดคล้ายสีน้ำ โดยใช้เส้นขอบน้อยหรือไม่มีเส้นขอบ",
    "แบบสักกราฟิกคอลลาจ — ผสมภาพเหมือน ภาพร่าง ตัวอักษร รูปทรงเรขาคณิต และรอยหมึกซ้อนกัน บางส่วนดูเหมือนภาพวาดหรือวาดไม่เสร็จ ให้ความรู้สึกทันสมัยและเหนือจริง",
    "แบบสักเข็มเดียวขาวดำ — ใช้เส้นละเอียดร่วมกับการไล่เงาสีดำและเทา เหมาะกับภาพบุคคล ศาสนา สัตว์ และตัวอักษร ให้รายละเอียดมากแต่ยังดูนุ่มนวล",
    "แบบสักอเมริกันผสมญี่ปุ่น — ใช้เส้นขอบหนา สีชัด และรูปทรงแข็งแรง ผสมภาพอย่างเสือ มังกร กะโหลก กุหลาบ คลื่น และเปลวไฟให้เป็นองค์ประกอบขนาดใหญ่",
  ];
  const colorOptions = ["ไม่ลงสี", "ลงสี"];
  const frameOptions = [
    "ไม่มีเส้นกรอบ",
    "เส้นกรอบแบบเส้นตรงขนาด 3pt",
    "เส้นกรอบแบบมีลวดลาย",
  ];
  const fontOptions = [
    "ไม่มีฟ้อน",
    "มีฟ้อนเป็นชื่อตัวละคร ขนาด 128 เป็นฟ้อนไม่ลงสี",
    "มีฟ้อนตามธีมรูป",
  ];
  const cameraAngleOptions = [
    "Front View · มุมตรงด้านหน้า",
    "3/4 Front View · มุมเฉียงด้านหน้า",
    "Side View · มุมด้านข้าง",
    "3/4 Back View · มุมเฉียงด้านหลัง",
    "Back View · มุมตรงด้านหลัง",
  ];
  const cameraAngleHeaderOptions = [
    ...cameraAngleOptions,
    "สุ่มมุมภาพ · สุ่มแยกแต่ละรูป",
  ];
  newBuilder.className = "v2-card v2-sheet-builder";
  newBuilder.innerHTML = `<div class="v2-sheet-top"><label>ชื่อชุดสินค้า<input id="v2SheetName" placeholder="เช่น ชุดระบายสีแมลง 30 รูป"></label><label>จำนวนรูป<input id="v2SheetCount" type="number" min="1" max="200" value="30"><small>ใส่ได้ 1–200 รูป</small></label><label>API<select id="v2SheetApi"><option value="google-imagen">Gemini Image API</option><option value="openai">OpenAI Image API</option><option value="stability">Stability AI</option><option value="replicate">Replicate</option><option value="custom">Custom API</option></select></label></div><section class="v2-sheet-tools"><div><b>จาวิสช่วยกรอกตัวละคร</b><small>กรอกชื่อไม่ซ้ำลงคอลัมน์ตัวละครตามจำนวนรูป</small></div><div class="v2-sheet-jarvis"><input id="v2SheetJarvisRequest" placeholder="เช่น ขอชื่อแมลง 30 ชื่อไม่ซ้ำ"><button class="v2-primary" id="v2SheetJarvis" type="button">ให้จาวิสช่วยกรอก</button></div><p id="v2SheetJarvisStatus"></p><div id="v2SheetReference"></div></section><div class="v2-sheet-actions"><button class="v2-secondary" id="v2CopyFirstRow" type="button">คัดลอกค่ารูปที่ 1 ไปทุกรูป</button><span id="v2SheetSummary">30 แถว = 30 รูป</span></div><div class="v2-sheet-table"><div class="v2-sheet-head"><b>รูปที่</b><b>ตัวละคร</b><b>จาวิส</b><b>มุมภาพ</b><b>ขนาดรูป</b><b>แนวรูป</b><b>สไตล์</b><b>สี</b><b>เส้นกรอบ</b><b>ฟ้อน</b><b>ฉาก</b><b>เพิ่มเติม</b><b>ชุด Prompt</b></div><div id="v2SheetRows">${Array.from({ length: 200 }, (_, index) => `<div class="v2-sheet-row" data-v2-sheet-row="${index}"><b>${index + 1}</b><input data-field="character" placeholder="ชื่อตัวละคร"><textarea data-field="jarvis_variation" rows="2" placeholder="ท่าทาง มุมกล้อง องค์ประกอบ"></textarea><select data-field="camera_angle">${selectOptions(cameraAngleOptions, cameraAngleOptions[0])}</select><select data-field="size">${selectOptions(sizeOptions, sizeOptions[0])}</select><select data-field="orientation">${selectOptions(orientationOptions, orientationOptions[0])}</select><select data-field="style">${selectOptions(styleOptions, styleOptions[0])}</select><select data-field="color">${selectOptions(colorOptions, colorOptions[0])}</select><select data-field="frame">${selectOptions(frameOptions, frameOptions[0])}</select><select data-field="font">${selectOptions(fontOptions, fontOptions[0])}</select><input data-field="scene" value="ฉากผจญภัย" placeholder="ระบุฉาก"><input data-field="extra" value="ตัวละครต้องอยู่ครบทั้งตัว ห้ามส่วนใดตกเฟรม" placeholder="คำสั่งเพิ่มเติม"><textarea data-field="prompt" rows="2" readonly></textarea></div>`).join("")}</div></div><div class="v2-actions"><button class="v2-primary" id="v2SheetGenerate" type="button">ส่ง Prompt ไปสร้างรูปในช่วงที่ 3 →</button></div>`;
  newBuilder.querySelector(".v2-sheet-head").innerHTML =
    `<b>รูปที่</b><label><b>ตัวละคร</b><textarea id="v2CharacterLines" rows="1" title="1 บรรทัดใช้กับทุกรูป · หลายบรรทัดแยกตามลำดับ" placeholder="กรอกตัวละคร"></textarea><small>1 บรรทัดใช้ซ้ำทุกแถว</small></label><div class="v2-variation-head"><b>จาวิส</b><button id="v2JarvisVariations" type="button">สร้างทั้งคอลัมน์</button><small>บังคับท่า มุมกล้อง และองค์ประกอบไม่ซ้ำ</small></div><label><b>มุมภาพ</b><select data-v2-column-fill="camera_angle">${selectOptions(cameraAngleHeaderOptions, cameraAngleOptions[0])}</select><small>เลือกสุ่มเพื่อกระจายมุมทุกแถว</small></label><label><b>ขนาดรูป</b><select data-v2-column-fill="size">${selectOptions(sizeOptions, sizeOptions[0])}</select></label><label><b>แนวรูป</b><select data-v2-column-fill="orientation">${selectOptions(orientationOptions, orientationOptions[0])}</select></label><label><b>สไตล์</b><select data-v2-column-fill="style">${selectOptions(styleOptions, styleOptions[0])}</select></label><label><b>สี</b><select data-v2-column-fill="color">${selectOptions(colorOptions, colorOptions[0])}</select></label><label><b>เส้นกรอบ</b><select data-v2-column-fill="frame">${selectOptions(frameOptions, frameOptions[0])}</select></label><label><b>ฟ้อน</b><select data-v2-column-fill="font">${selectOptions(fontOptions, fontOptions[0])}</select></label><label><b>ฉาก</b><input data-v2-column-fill="scene" value="ฉากผจญภัย" placeholder="ใช้ทั้งคอลัมน์"></label><label><b>เพิ่มเติม</b><input data-v2-column-fill="extra" value="ตัวละครต้องอยู่ครบทั้งตัว ห้ามส่วนใดตกเฟรม" placeholder="ใช้ทั้งคอลัมน์"></label><div><b>ชุด Prompt</b><small>สร้างอัตโนมัติรายแถว</small></div>`;
  newBuilder.querySelector("#v2SheetGenerate").textContent =
    "ส่ง Prompt ไปสร้างรูปใน Step 2 →";
  newBuilder
    .querySelector(".v2-sheet-top")
    .insertAdjacentHTML(
      "afterend",
      `<section class="v2-turbo-card"><div><b>Turbo Mode</b><small>ใช้ Gemini API 2 คีย์จากคนละ Google Account/Project</small></div><label class="v2-turbo-switch"><input id="v2TurboMode" type="checkbox"><span></span><b id="v2TurboLabel">ปิด · สร้างทีละ 1 รูป</b></label><p id="v2TurboDetail">โหมดปกติใช้ GEMINI_API_KEY และสุ่มหน่วง 10–20 วินาที</p></section>`,
    );
  newBuilder
    .querySelector(".v2-sheet-actions")
    .insertAdjacentHTML(
      "afterend",
      `<div class="v2-sheet-red-notes"><p><b>ตัวละคร · อัปโหลด:</b> เพิ่มปุ่มอัปโหลดและระบุว่า “ใช้ตัวละครนี้กับทุกรูป” การทำงานคือระบบจะแนบรูปไว้ในคอลัมน์ตัวละคร และเพิ่ม Prompt ว่าให้ใช้รูปนี้ในการเจน ดังนั้นคอลัมน์ตัวละครจะมีรูปแนบหรือไม่มีก็ได้ และยังมีช่อง Prompt ในคอลัมน์ตามปกติ</p><p><b>ชุด Prompt:</b> แสดงว่ามีหรือไม่มีรูปแนบจากคอลัมน์ตัวละคร แล้วรวมกับ Prompt จากคอลัมน์อื่นตามปกติ</p></div>`,
    );
  panels[0].append(newBuilder);
  newBuilder
    .querySelector("#v2SheetReference")
    .append(v2CharacterReference.closest(".v2-character-reference"));
  const stepGuides = {
    1: [
      "กรอกชื่อชุดสินค้า จำนวนรูป 1–200 รูป และเลือก API",
      "กรอกตัวละครเองทีละบรรทัด หรือให้จาวิสช่วยสร้างรายชื่อและความแตกต่าง",
      "ตั้งค่าหัวคอลัมน์เพื่อใช้ค่าเดียวกันทั้งคอลัมน์ แล้วตรวจชุด Prompt ก่อนส่ง",
    ],
    2: [
      "ระบบสร้างทีละรูปและหน่วงตามโหมดที่เลือก สามารถสลับหน้าเว็บได้แต่ต้องเปิดแท็บนี้ค้างไว้",
      "ดูสถานะและสาเหตุจาก Activity Log ซึ่งเลื่อนดูย้อนหลังได้",
      "เมื่อครบรอบ ให้กดสร้างซ้ำเฉพาะรูปที่ไม่สำเร็จ แล้วไป Step 3 เมื่อรูปครบ",
    ],
    3: [
      "เลือกรูปที่ชอบให้ครบ 3 รูป",
      "กดทำ SAMPLE ระบบจะใส่ลายน้ำเฉพาะรูปตัวอย่าง โดยไม่แก้ไฟล์ต้นฉบับ",
      "ตรวจรูปทั้ง 3 รูป แล้วกดยืนยันเพื่อไปสร้าง PDF",
    ],
    4: [
      "ระบบรวมรูปต้นฉบับทั้งหมดตามลำดับเป็น PDF",
      "เปิดตรวจ PDF จริงหรือดาวน์โหลดเก็บลงเครื่องได้",
      "เลือกจบงานโดยไม่สร้างสินค้า หรือแนบ PDF แล้วไป Step 5",
    ],
    5: [
      "ตรวจชื่อ ราคา หมวดหมู่ สถานะ และรายละเอียดสินค้า",
      "ตรวจรูปปก รูปตัวอย่าง 2–3 และไฟล์ PDF สำหรับลูกค้าให้ครบ",
      "กดบันทึกสินค้าเพื่อจบงานและนำสินค้าเข้าสู่ระบบ",
    ],
  };
  const guideHtml = (number) =>
    `<details class="v2-step-guide" open><summary><span>วิธีใช้งาน Step ${number}</span><small>กดเพื่อย่อ / ดูคำแนะนำ</small></summary><ol>${stepGuides[number].map((item) => `<li>${item}</li>`).join("")}</ol></details>`;
  newBuilder.insertAdjacentHTML("afterbegin", guideHtml(1));
  panels[2]
    .querySelector(".v2-card")
    .insertAdjacentHTML("afterbegin", guideHtml(2));
  panels[3]
    .querySelector(".v2-card")
    .insertAdjacentHTML("afterbegin", guideHtml(3));
  panels[4]
    .querySelector(".v2-card")
    .insertAdjacentHTML("afterbegin", guideHtml(4));
  const ensureProductGuide = () => {
    let guide = productEditor.querySelector(".v2-step-guide-product");
    if (!guide) {
      productEditor.insertAdjacentHTML("afterbegin", guideHtml(5));
      guide = productEditor.querySelector(".v2-step-guide");
      guide.classList.add("v2-step-guide-product");
    }
    guide.hidden = false;
  };
  v2ContinueProduct.addEventListener("click", ensureProductGuide);
  const sheetRows = [...newBuilder.querySelectorAll("[data-v2-sheet-row]")],
    sheetCount = document.getElementById("v2SheetCount"),
    sheetSummary = document.getElementById("v2SheetSummary"),
    characterLinesInput = document.getElementById("v2CharacterLines"),
    turboMode = document.getElementById("v2TurboMode"),
    turboLabel = document.getElementById("v2TurboLabel"),
    turboDetail = document.getElementById("v2TurboDetail");
  turboMode.onchange = () => {
    turboLabel.textContent = turboMode.checked
      ? "เปิด · สร้างพร้อมกัน 2 รูป"
      : "ปิด · สร้างทีละ 1 รูป";
    turboDetail.textContent = turboMode.checked
      ? "รูปเลขคี่ใช้ GEMINI_API_KEY · รูปเลขคู่ใช้ GEMINI_API_KEY_2 · ทั้งสองฝั่งสุ่มหน่วง 10–20 วินาที"
      : "โหมดปกติใช้ GEMINI_API_KEY และสุ่มหน่วง 10–20 วินาที";
  };
  sheetRows.forEach((row) => {
    const field = row.querySelector('[data-field="character"]'),
      cell = document.createElement("div"),
      promptField = row.querySelector('[data-field="prompt"]'),
      promptCell = document.createElement("div");
    cell.className = "v2-sheet-character";
    field.before(cell);
    cell.innerHTML =
      '<div class="v2-sheet-character-preview"><span>ไม่มีรูปแนบ</span></div>';
    cell.append(field);
    promptCell.className = "v2-sheet-prompt-cell";
    promptField.before(promptCell);
    promptCell.innerHTML =
      '<div class="v2-sheet-prompt-reference"><span>Prompt แบบไม่มีรูปแนบ</span></div>';
    promptCell.append(promptField);
  });
  const updateSheetPrompt = (row) => {
    const values = Object.fromEntries(
        [...row.querySelectorAll("[data-field]")]
          .filter((field) => field.dataset.field !== "prompt")
          .map((field) => [field.dataset.field, cleanPrompt(field.value)]),
      ),
      referenceRule = v2CharacterReference.files?.[0]
        ? "ใช้รูปตัวละครต้นแบบที่แนบเป็นต้นแบบหลักของภาพนี้ รักษาใบหน้า รูปร่าง สี และลักษณะสำคัญให้เหมือนรูปแนบ"
        : "",
      cameraRule = values.camera_angle
        ? `กำหนดมุมภาพเป็น ${values.camera_angle} และให้ยึดมุมนี้เป็นหลัก`
        : "",
      parts = [
        values.character,
        referenceRule,
        values.jarvis_variation,
        cameraRule,
        values.size,
        values.orientation,
        values.style,
        values.color,
        values.frame,
        values.font,
        values.scene,
        values.extra,
      ].filter(Boolean);
    row.querySelector('[data-field="prompt"]').value = parts.join(" ");
  };
  const shuffledCameraAngles = (count) => {
    const values = Array.from(
      { length: count },
      (_, index) => cameraAngleOptions[index % cameraAngleOptions.length],
    );
    for (let index = values.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [values[index], values[other]] = [values[other], values[index]];
    }
    return values;
  };
  const applyHeaderToColumn = (control) => {
    const fieldName = control.dataset.v2ColumnFill,
      randomAngles =
        fieldName === "camera_angle" && control.value.startsWith("สุ่มมุมภาพ")
          ? shuffledCameraAngles(sheetRows.length)
          : null;
    sheetRows.forEach((row, index) => {
      row.querySelector(`[data-field="${fieldName}"]`).value = randomAngles
        ? randomAngles[index]
        : control.value;
      updateSheetPrompt(row);
    });
  };
  newBuilder.querySelectorAll("[data-v2-column-fill]").forEach((control) => {
    control.addEventListener(
      control.tagName === "SELECT" ? "change" : "input",
      () => applyHeaderToColumn(control),
    );
  });
  characterLinesInput.addEventListener("input", () => {
    const names = characterLinesInput.value
        .replace(/\r/g, "")
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 200),
      repeatOne = names.length === 1;
    sheetRows.forEach((row, index) => {
      row.querySelector('[data-field="character"]').value = repeatOne
        ? names[0]
        : names[index] || "";
      updateSheetPrompt(row);
    });
  });
  const variationTemplates = [
    "ท่าพุ่งเข้าหาผู้ชม มุมกล้องระดับสายตาด้านหน้า องค์ประกอบทแยงจากซ้ายไปขวา",
    "ท่าทะยานขึ้น มุมกล้องเงยจากด้านล่าง องค์ประกอบสามเหลี่ยมเน้นความสูง",
    "ท่าหันข้างกำลังเคลื่อนไหว มุมกล้องด้านข้าง องค์ประกอบเว้นพื้นที่ด้านหน้าตัวละคร",
    "ท่าหยุดนิ่งสง่างาม มุมกล้องตรงแบบสมมาตร องค์ประกอบกึ่งกลางเต็มภาพ",
    "ท่ากระโจนลง มุมกล้องสูงมองเฉียง องค์ประกอบเส้นนำสายตาลงสู่มุมล่าง",
    "ท่าหันกลับมามอง มุมกล้องด้านหลังสามส่วนสี่ องค์ประกอบโค้งเป็นวง",
    "ภาพระยะใกล้เน้นใบหน้า มุมกล้องเฉียงเล็กน้อย องค์ประกอบครึ่งตัวไม่เห็นท่าเดิม",
    "ภาพเต็มตัวกำลังเคลื่อนที่ มุมกล้องกว้าง องค์ประกอบตัวละครอยู่หนึ่งในสามของภาพ",
    "ท่ากางออกเต็มที่ มุมกล้องจากด้านบน องค์ประกอบรัศมีแผ่ออกจากจุดศูนย์กลาง",
    "ท่าบิดลำตัวอย่างมีพลัง มุมกล้องสามส่วนสี่ด้านหน้า องค์ประกอบรูปตัวเอส",
    "ท่ากำลังต่อสู้กับแรงต้าน มุมกล้องต่ำด้านข้าง องค์ประกอบทแยงสวนสองทิศทาง",
    "ท่าเกาะหรือยืนบนฐาน มุมกล้องตรงด้านข้าง องค์ประกอบแนวนอนสมดุล",
    "ท่าพุ่งออกจากฉากหลัง มุมกล้องโคลสอัปแบบมีมิติ องค์ประกอบหน้าชัดหลังลึก",
    "ท่าหมุนตัวกลางอากาศ มุมกล้องเอียงเล็กน้อย องค์ประกอบวงกลมแบบเคลื่อนไหว",
    "ท่าก้มเตรียมโจมตี มุมกล้องระดับพื้น องค์ประกอบฐานกว้างและยอดแคบ",
    "ท่าเชิดหน้ามองไกล มุมกล้องครึ่งตัวด้านข้าง องค์ประกอบมีพื้นที่ว่างเหนือศีรษะ",
    "ท่ากำลังลงสู่พื้น มุมกล้องด้านหน้าสามส่วนสี่ องค์ประกอบเส้นเฉียงลง",
    "ท่ากำลังออกตัวจากพื้น มุมกล้องด้านหลังต่ำ องค์ประกอบเส้นเฉียงขึ้น",
    "ท่าประจันหน้ากับวัตถุประกอบ มุมกล้องด้านข้างระยะกลาง องค์ประกอบสองจุดสมดุล",
    "ท่าล้อมรอบวัตถุกลางภาพ มุมกล้องตรง องค์ประกอบวงรีซ้อนชั้น",
    "ท่าเคลื่อนจากขวาไปซ้าย มุมกล้องแพนด้านข้าง องค์ประกอบเว้นทางเคลื่อนที่",
    "ท่าเคลื่อนจากซ้ายไปขวา มุมกล้องแพนต่ำ องค์ประกอบเส้นนำสายตาต่อเนื่อง",
    "ท่าสงบนิ่งแต่ตึงเครียด มุมกล้องใกล้ระดับอก องค์ประกอบพื้นที่มืดสลับว่าง",
    "ท่ากำลังเปล่งพลัง มุมกล้องเงยตรง องค์ประกอบรัศมีและเส้นพุ่งรอบตัว",
    "ภาพเงารูปร่างเต็ม มุมกล้องระยะไกล องค์ประกอบย้อนแสงกึ่งกลาง",
    "รายละเอียดเฉพาะส่วนสำคัญ มุมกล้องมาโคร องค์ประกอบตัดขอบภาพอย่างตั้งใจ",
    "ท่าคู่กับองค์ประกอบธรรมชาติ มุมกล้องกว้างระดับสายตา องค์ประกอบสามชั้นหน้า-กลาง-หลัง",
    "ท่าอยู่ท่ามกลางลวดลายเรขาคณิต มุมกล้องตรง องค์ประกอบสมมาตรหลายชั้น",
    "ท่าทะลุผ่านกรอบหรือวงแหวน มุมกล้องด้านหน้ามีมิติ องค์ประกอบซ้อนกรอบ",
    "ท่าปิดท้ายทรงพลัง มุมกล้องสามส่วนสี่จากล่าง องค์ประกอบไม่เหมือนทุกภาพก่อนหน้า",
  ];
  document.getElementById("v2JarvisVariations").onclick = () => {
    const count = Math.min(200, Math.max(1, Number(sheetCount.value) || 1));
    sheetRows.slice(0, count).forEach((row, index) => {
      row.querySelector('[data-field="jarvis_variation"]').value =
        `${variationTemplates[index % variationTemplates.length]} ต้องแตกต่างจากรูปอื่นอย่างชัดเจนทั้งท่าทาง มุมกล้อง รูปทรง และองค์ประกอบ ห้ามซ้ำกัน`;
      updateSheetPrompt(row);
    });
    document.getElementById("v2JarvisVariations").textContent =
      `กรอกแล้ว ${count} แถว ✓`;
  };
  const updateSheetReferencePreviews = (url) => {
    sheetRows.forEach((row) => {
      const preview = row.querySelector(".v2-sheet-character-preview"),
        promptReference = row.querySelector(".v2-sheet-prompt-reference");
      preview.innerHTML = url
        ? `<img src="${url}" alt="รูปตัวละครต้นแบบ"><small>ใช้รูปนี้</small>`
        : "<span>ไม่มีรูปแนบ</span>";
      promptReference.innerHTML = url
        ? `<img src="${url}" alt="รูปแนบในชุด Prompt"><b>แนบรูปนี้ไปกับ Prompt</b>`
        : "<span>Prompt แบบไม่มีรูปแนบ</span>";
      updateSheetPrompt(row);
    });
  };
  v2CharacterReference.addEventListener("change", () => {
    const file = v2CharacterReference.files?.[0];
    if (!file) return updateSheetReferencePreviews("");
    const reader = new FileReader();
    reader.onload = () =>
      updateSheetReferencePreviews(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
  const updateSheetCount = () => {
    const count = Math.min(200, Math.max(1, Number(sheetCount.value) || 1));
    sheetCount.value = count;
    sheetRows.forEach((row, index) => (row.hidden = index >= count));
    sheetSummary.textContent = `${count} แถว = ${count} รูป`;
  };
  newBuilder
    .querySelector("#v2SheetRows")
    .addEventListener("input", (event) => {
      const row = event.target.closest("[data-v2-sheet-row]");
      if (!row) return;
      updateSheetPrompt(row);
      if (event.target.dataset.field === "character")
        characterLinesInput.value = sheetRows
          .slice(0, Number(sheetCount.value))
          .map((item) =>
            item.querySelector('[data-field="character"]').value.trim(),
          )
          .join("\n");
    });
  newBuilder
    .querySelector("#v2SheetRows")
    .addEventListener("change", (event) => {
      const row = event.target.closest("[data-v2-sheet-row]");
      if (row) updateSheetPrompt(row);
    });
  sheetCount.onchange = updateSheetCount;
  sheetCount.oninput = updateSheetCount;
  sheetRows.forEach(updateSheetPrompt);
  updateSheetCount();
  document.getElementById("v2CopyFirstRow").onclick = () => {
    const source = sheetRows[0];
    sheetRows.slice(1).forEach((row) => {
      [
        "camera_angle",
        "size",
        "orientation",
        "style",
        "color",
        "frame",
        "font",
        "scene",
        "extra",
      ].forEach(
        (name) =>
          (row.querySelector(`[data-field="${name}"]`).value =
            source.querySelector(`[data-field="${name}"]`).value),
      );
      updateSheetPrompt(row);
    });
  };
  const sheetJarvis = document.getElementById("v2SheetJarvis"),
    sheetJarvisStatus = document.getElementById("v2SheetJarvisStatus");
  sheetJarvis.onclick = async () => {
    const request = document
        .getElementById("v2SheetJarvisRequest")
        .value.trim(),
      count = Number(sheetCount.value);
    if (!request) return alert("กรุณาบอกสิ่งที่ต้องการให้จาวิสช่วย");
    sheetJarvis.disabled = true;
    sheetJarvisStatus.textContent = "จาวิสกำลังคิดรายชื่อ…";
    try {
      const response = await originalFetch("/api/admin/vision2/characters", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ request, max_items: count }),
        }),
        data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || "จาวิสจัดรายการไม่สำเร็จ");
      characterLinesInput.value = data.items.slice(0, count).join("\n");
      characterLinesInput.dispatchEvent(new Event("input"));
      sheetJarvisStatus.textContent = `กรอกให้แล้ว ${Math.min(count, data.items.length)} รายการ`;
    } catch (error) {
      sheetJarvisStatus.textContent = error.message;
    } finally {
      sheetJarvis.disabled = false;
    }
  };
  const loadReferenceForGeneration = (file) =>
    new Promise((resolve, reject) => {
      if (!file) return resolve(null);
      if (file.size > 10 * 1024 * 1024)
        return reject(new Error("รูปต้นแบบต้องมีขนาดไม่เกิน 10 MB"));
      const reader = new FileReader();
      reader.onerror = () =>
        reject(new Error("อ่านไฟล์รูปตัวละครต้นแบบไม่สำเร็จ"));
      reader.onload = () => {
        const value = String(reader.result || ""),
          comma = value.indexOf(",");
        if (comma < 0 || !value.slice(comma + 1))
          return reject(new Error("ข้อมูลรูปตัวละครต้นแบบไม่สมบูรณ์"));
        resolve({
          mime_type: file.type || "image/png",
          data: value.slice(comma + 1),
        });
      };
      reader.readAsDataURL(file);
    });
  const sheetGenerateButton = document.getElementById("v2SheetGenerate");
  sheetGenerateButton.onclick = async () => {
    const originalLabel = sheetGenerateButton.textContent,
      name = document.getElementById("v2SheetName").value.trim(),
      count = Number(sheetCount.value),
      api = document.getElementById("v2SheetApi").value,
      rows = sheetRows.slice(0, count),
      file = v2CharacterReference.files?.[0] || null;
    if (!name) return alert("กรุณากรอกชื่อชุดสินค้า");
    sheetGenerateButton.disabled = true;
    sheetGenerateButton.textContent = file
      ? "กำลังตรวจและแนบรูปให้ทุก Prompt…"
      : "กำลังตรวจ Prompt…";
    try {
      if (file) {
        referenceImagePayload = await loadReferenceForGeneration(file);
        if (!referenceImagePayload?.data)
          throw new Error("ยังแนบรูปตัวละครต้นแบบไม่สำเร็จ");
      }
      rows.forEach(updateSheetPrompt);
      const characters = rows.map((row) =>
          cleanPrompt(row.querySelector('[data-field="character"]').value),
        ),
        prompts = rows.map((row) =>
          cleanPrompt(row.querySelector('[data-field="prompt"]').value),
        ),
        missing = characters.findIndex((value) => !value);
      if (missing >= 0)
        throw new Error(`กรุณากรอกตัวละครของรูปที่ ${missing + 1}`);
      if (prompts.some((value) => !value))
        throw new Error("มี Prompt ว่าง กรุณาตรวจตาราง");
      if (
        file &&
        prompts.some((prompt) => !prompt.includes("ใช้รูปตัวละครต้นแบบที่แนบ"))
      )
        throw new Error(
          "Prompt บางแถวยังไม่มีคำสั่งใช้รูปแนบ ระบบจึงหยุดไว้ก่อน",
        );
      brief = {
        project_name: name,
        count,
        image_api: api,
        image_api_name:
          document.getElementById("v2SheetApi").selectedOptions[0].textContent,
        turbo_mode: turboMode.checked,
        topic: characters.join("\n"),
        output_size: "กำหนดแยกตามตาราง",
        orientation: "กำหนดแยกตามตาราง",
        frame_style: "กำหนดแยกตามตาราง",
        style: "กำหนดแยกตามตาราง",
        audience: "ตาม Prompt รายรูป",
        instructions: "",
        has_reference_image: Boolean(file),
        reference_image_required: Boolean(file),
        reference_image_name: file?.name || "",
      };
      oldBriefForm.elements.project_name.value = name;
      oldBriefForm.elements.count.value = count;
      oldBriefForm.elements.image_api.value = api;
      renderPromptTable(prompts, characters);
      v2PrepareSlots.click();
    } catch (error) {
      alert(error.message || "ตรวจ Prompt ก่อนสร้างภาพไม่สำเร็จ");
    } finally {
      sheetGenerateButton.disabled = false;
      sheetGenerateButton.textContent = originalLabel;
    }
  };
  const savedJob = localStorage.getItem(JOB_KEY);
  if (savedJob) {
    try {
      const saved = JSON.parse(savedJob);
      v2ResumeText.textContent = `งาน ${saved.brief?.project_name || "Vision 2"} ยังทำไม่เสร็จ · บันทึกล่าสุด ${new Date(saved.savedAt).toLocaleString("th-TH")}`;
      v2ResumeNotice.hidden = false;
    } catch (error) {
      localStorage.removeItem(JOB_KEY);
    }
  }
  renderJobLog();

  v2GoSampleSelection.onclick = () => {
    const total = v2PromptList.value
      .split("\n")
      .filter((value) => value.trim()).length;
    if (slotImages.size !== total)
      return alert(
        `รูปยังไม่ครบ ขณะนี้เสร็จแล้ว ${slotImages.size}/${total} รูป`,
      );
    renderSampleSelection();
    show(4);
  };
  v2SampleSelection.addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-v2-select]");
    if (!checkbox) return;
    const index = Number(checkbox.dataset.v2Select);
    if (checkbox.checked) {
      if (selected.size >= 3) {
        checkbox.checked = false;
        return alert("เลือกทำรูปตัวอย่างได้ 3 รูป");
      }
      selected.add(index);
    } else selected.delete(index);
    updateSelection();
    if (selected.size === 3) v2OpenSamples.click();
  });

  const loadDrawable = async (file) => {
    if (!file) throw new Error("ไม่พบไฟล์ภาพ");
    if (typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(file);
        return {
          source: bitmap,
          width: bitmap.width,
          height: bitmap.height,
          close: () => bitmap.close?.(),
        };
      } catch (error) {}
    }
    const url = URL.createObjectURL(file),
      image = new Image();
    image.decoding = "async";
    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () =>
          reject(new Error("เบราว์เซอร์ถอดรหัสไฟล์ภาพไม่ได้"));
        image.src = url;
      });
      return {
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        close: () => URL.revokeObjectURL(url),
      };
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
  };
  const watermarked = async (item, index) => {
    const drawable = await loadDrawable(item?.file);
    try {
      const max = 1800,
        scale = Math.min(1, max / drawable.width),
        canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(drawable.width * scale));
      canvas.height = Math.max(1, Math.round(drawable.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("เบราว์เซอร์ไม่สามารถเปิดพื้นที่วาดภาพได้");
      context.drawImage(drawable.source, 0, 0, canvas.width, canvas.height);
      const fontSize = Math.max(64, Math.round(canvas.width * 0.2));
      try {
        await document.fonts?.load(`400 ${fontSize}px Anton`);
      } catch (error) {}
      context.save();
      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate(-Math.PI / 7);
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = `400 ${fontSize}px Anton, Impact, sans-serif`;
      context.lineJoin = "round";
      context.lineWidth = Math.max(3, Math.round(fontSize * 0.035));
      context.strokeStyle = "rgba(255,255,255,.82)";
      context.fillStyle = "rgba(220,0,0,.58)";
      [-canvas.height * 0.28, 0, canvas.height * 0.28].forEach((y) => {
        context.strokeText("SAMPLE", 0, y);
        context.fillText("SAMPLE", 0, y);
      });
      context.restore();
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.92),
      );
      if (!blob) throw new Error("แปลงภาพ SAMPLE เป็น JPG ไม่สำเร็จ");
      const file = new File([blob], `vision2-sample-${index + 1}.jpg`, {
        type: "image/jpeg",
      });
      return { index, file, url: URL.createObjectURL(file) };
    } finally {
      drawable.close();
    }
  };
  v2OpenSamples.onclick = async () => {
    if (selected.size !== 3) return alert("กรุณาเลือกรูปที่ชอบให้ครบ 3 รูป");
    v2OpenSamples.disabled = true;
    v2OpenSamples.textContent = "กำลังทำลายน้ำ SAMPLE…";
    try {
      const samples = [];
      for (const index of selected) {
        try {
          samples.push(await watermarked(slotImages.get(index), index));
        } catch (error) {
          throw new Error(
            `ภาพ ${index + 1}: ${error.message || "สร้าง SAMPLE ไม่สำเร็จ"}`,
          );
        }
      }
      sampleFiles = samples.map((sample) => sample.file);
      sampleProjectKey = currentProjectKey();
      v2SampleGallery.innerHTML = samples
        .map(
          (sample, position) =>
            `<article><img src="${sample.url}" alt="Sample ${sample.index + 1}"><b>รูปตัวอย่าง ${position + 1}${position === 0 ? " · ใช้เป็นรูปปกด้วย" : ""}</b><a href="${sample.url}" download="${sample.file.name}">ดาวน์โหลด SAMPLE</a></article>`,
        )
        .join("");
      v2OpenSamples.hidden = true;
      v2GoPdf.hidden = false;
    } catch (error) {
      sampleFiles = [];
      sampleProjectKey = "";
      alert(`ทำรูปตัวอย่างไม่สำเร็จ\n${error.message || "กรุณาตรวจไฟล์ภาพ"}`);
    } finally {
      v2OpenSamples.disabled = false;
      v2OpenSamples.textContent = "ทำ SAMPLE จาก 3 รูปที่เลือก";
    }
  };
  const ascii = (value) => new TextEncoder().encode(value),
    joinBytes = (parts) => {
      const size = parts.reduce((sum, part) => sum + part.length, 0),
        output = new Uint8Array(size);
      let offset = 0;
      parts.forEach((part) => {
        output.set(part, offset);
        offset += part.length;
      });
      return output;
    };
  const imageToJpeg = async (file, compact = false) => {
    const drawable = await loadDrawable(file);
    try {
      const canvas = document.createElement("canvas"),
        max = compact ? 1600 : 2200,
        scale = Math.min(1, max / Math.max(drawable.width, drawable.height));
      canvas.width = Math.max(1, Math.round(drawable.width * scale));
      canvas.height = Math.max(1, Math.round(drawable.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("เบราว์เซอร์ไม่สามารถเปิดพื้นที่วาดภาพได้");
      context.drawImage(drawable.source, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", compact ? 0.78 : 0.9),
      );
      if (!blob) throw new Error("แปลงภาพสำหรับ PDF ไม่สำเร็จ");
      return {
        bytes: new Uint8Array(await blob.arrayBuffer()),
        width: canvas.width,
        height: canvas.height,
      };
    } finally {
      drawable.close();
    }
  };
  const buildPdf = async () => {
    const compact = slotImages.size > 100,
      images = [];
    for (const [, item] of [...slotImages.entries()].sort(
      (a, b) => a[0] - b[0],
    ))
      images.push(await imageToJpeg(item.file, compact));
    const count = images.length,
      totalObjects = 2 + count * 3,
      objects = new Array(totalObjects + 1);
    objects[1] = ascii("<< /Type /Catalog /Pages 2 0 R >>");
    const pageRefs = images.map((_, index) => `${3 + index * 3} 0 R`).join(" ");
    objects[2] = ascii(
      `<< /Type /Pages /Count ${count} /Kids [${pageRefs}] >>`,
    );
    images.forEach((image, index) => {
      const pageId = 3 + index * 3,
        imageId = pageId + 1,
        contentId = pageId + 2,
        portrait = image.height >= image.width,
        pageWidth = portrait ? 595 : 842,
        pageHeight = portrait ? 842 : 595,
        content = `q ${pageWidth} 0 0 ${pageHeight} 0 0 cm /Im${index + 1} Do Q`;
      objects[pageId] = ascii(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im${index + 1} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
      );
      objects[imageId] = joinBytes([
        ascii(
          `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`,
        ),
        image.bytes,
        ascii("\nendstream"),
      ]);
      objects[contentId] = ascii(
        `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
      );
    });
    const parts = [ascii("%PDF-1.4\n%VISIOND\n")],
      offsets = new Array(totalObjects + 1).fill(0);
    let length = parts[0].length;
    for (let id = 1; id <= totalObjects; id++) {
      const object = joinBytes([
        ascii(`${id} 0 obj\n`),
        objects[id],
        ascii("\nendobj\n"),
      ]);
      offsets[id] = length;
      parts.push(object);
      length += object.length;
    }
    const xrefOffset = length,
      xref = ["xref", `0 ${totalObjects + 1}`, "0000000000 65535 f "];
    for (let id = 1; id <= totalObjects; id++)
      xref.push(`${String(offsets[id]).padStart(10, "0")} 00000 n `);
    xref.push(
      `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
    );
    parts.push(ascii(xref.join("\n")));
    return new Blob([joinBytes(parts)], { type: "application/pdf" });
  };
  const safePdfName = () =>
    `${(brief.project_name || "vision2-product").replace(/[\\/:*?"<>|]+/g, "-").trim() || "vision2-product"}.pdf`;
  v2GoPdf.onclick = async () => {
    const promptCount = v2PromptList.value
      .split("\n")
      .filter((value) => value.trim()).length;
    v2PdfSummary.innerHTML = `<article><small>กำลังรวมไฟล์</small><b>โปรดรอสักครู่…</b></article>`;
    v2PdfFilePreview.hidden = true;
    v2PdfFilePreview.innerHTML = "";
    v2DownloadPdf.disabled = true;
    v2FinishWithoutProduct.disabled = true;
    v2ContinueProduct.disabled = true;
    show(5);
    try {
      if (importedProductFile) {
        pdfFile = importedProductFile;
        if (pdfObjectUrl) URL.revokeObjectURL(pdfObjectUrl);
        pdfObjectUrl = URL.createObjectURL(pdfFile);
        const isPdf = pdfFile.type === "application/pdf" || /\.pdf$/i.test(pdfFile.name),
          typeLabel = isPdf ? "PDF" : "ZIP";
        v2PdfSummary.innerHTML = `<article><small>รูปที่เปิดให้เลือก SAMPLE</small><b>${importedCandidateCount} รูป</b></article><article><small>${typeLabel} สำหรับลูกค้า</small><b>${(pdfFile.size / 1024 / 1024).toFixed(1)} MB</b></article><article><small>จำนวนหน้าที่ตรวจพบ</small><b>${importedPageCount || "—"} หน้า</b></article>`;
        v2PdfFilePreview.hidden = false;
        v2PdfFilePreview.innerHTML = `<div><b>✓ พร้อมแนบไฟล์ต้นฉบับโดยไม่สร้างซ้ำ</b><strong>${esc(pdfFile.name)}</strong><small>${isPdf ? `${importedPageCount} หน้า · ` : ""}${(pdfFile.size / 1024 / 1024).toFixed(2)} MB · จะส่งไฟล์นี้ให้ลูกค้าเมื่อซื้อสำเร็จ</small><a href="${pdfObjectUrl}" target="_blank" rel="noopener">${isPdf ? "เปิดดู PDF จริง" : "ดาวน์โหลด ZIP เพื่อตรวจ"}</a></div>${isPdf ? `<iframe src="${pdfObjectUrl}#page=1&view=FitH" title="ตัวอย่างไฟล์ PDF"></iframe>` : '<div class="v2-zip-ready"><b>ไฟล์ ZIP พร้อมแนบ</b><span>ระบบเก็บ ZIP เดิมครบทั้งไฟล์และไม่แก้ข้อมูลภายใน</span></div>'}`;
        v2DownloadPdf.disabled = false;
        v2FinishWithoutProduct.disabled = false;
        v2ContinueProduct.disabled = false;
        v2DownloadPdf.textContent = `ดาวน์โหลด ${typeLabel} ลงเครื่อง`;
        v2ContinueProduct.textContent = `แนบ ${typeLabel} และไปตั้งตะกร้าขาย →`;
        return;
      }
      v2DownloadPdf.textContent = "ดาวน์โหลด PDF ลงเครื่อง";
      const blob = await buildPdf();
      pdfFile = new File([blob], safePdfName(), { type: "application/pdf" });
      if (pdfObjectUrl) URL.revokeObjectURL(pdfObjectUrl);
      pdfObjectUrl = URL.createObjectURL(pdfFile);
      v2PdfSummary.innerHTML = `<article><small>ไฟล์ต้นฉบับพร้อม</small><b>${slotImages.size}/${promptCount} ภาพ</b></article><article><small>PDF สำหรับลูกค้า</small><b>${(pdfFile.size / 1024 / 1024).toFixed(1)} MB</b></article><article><small>ขนาดงาน</small><b>${esc(brief.output_size)}</b></article>`;
      v2PdfFilePreview.hidden = false;
      v2PdfFilePreview.innerHTML = `<div><b>✓ สร้างไฟล์ PDF จริงแล้ว</b><strong>${esc(pdfFile.name)}</strong><small>${promptCount} หน้า · ${(pdfFile.size / 1024 / 1024).toFixed(2)} MB · พร้อมแนบเป็นไฟล์สำหรับลูกค้า</small><a href="${pdfObjectUrl}" target="_blank" rel="noopener">เปิดดู PDF จริง</a></div><iframe src="${pdfObjectUrl}#page=1&view=FitH" title="ตัวอย่างไฟล์ PDF"></iframe>`;
      v2DownloadPdf.disabled = false;
      v2FinishWithoutProduct.disabled = false;
      v2ContinueProduct.disabled = false;
      v2ContinueProduct.textContent = "แนบ PDF และไปฟอร์มสินค้า →";
      v2ContinueProduct.style.scrollMarginBlock = "120px";
      requestAnimationFrame(() =>
        setTimeout(
          () =>
            v2ContinueProduct.scrollIntoView({
              behavior: "smooth",
              block: "center",
              inline: "nearest",
            }),
          100,
        ),
      );
    } catch (error) {
      v2PdfSummary.innerHTML =
        "<article><small>รวม PDF ไม่สำเร็จ</small><b>กรุณาลองใหม่</b></article>";
      v2ContinueProduct.textContent = "รวม PDF ไม่สำเร็จ";
      alert("รวม PDF ไม่สำเร็จ กรุณาตรวจไฟล์รูปแล้วลองใหม่");
    }
  };
  v2DownloadPdf.onclick = () => {
    if (!pdfObjectUrl) return alert("ยังไม่มีไฟล์ PDF");
    const link = document.createElement("a");
    link.href = pdfObjectUrl;
    link.download = pdfFile.name;
    link.click();
  };
  v2FinishWithoutProduct.onclick = () => {
    if (
      !confirm(
        "จบกระบวนการ Vision 2 โดยไม่สร้างสินค้าใช่หรือไม่? ไฟล์ที่ดาวน์โหลดไว้ในเครื่องจะไม่ถูกลบ",
      )
    )
      return;
    clearQueueTimers();
    localStorage.removeItem(JOB_KEY);
    queueStates.length = 0;
    retryCounts.length = 0;
    activeQueue.clear();
    jobLogs = [];
    v2ResumeNotice.hidden = true;
    workspace.hidden = true;
    alert("จบงาน Vision 2 แล้ว งานนี้จะไม่แสดงเป็นงานค้าง");
  };
  v2ContinueProduct.onclick = () => {
    if (!pdfFile) return alert("กรุณารอให้รวม PDF สำเร็จก่อน");
    if (sampleFiles.length !== 3) return alert("ยังไม่มีรูปตัวอย่างครบ 3 รูป");
    if (sampleProjectKey !== currentProjectKey())
      return alert(
        "รูปตัวอย่างไม่ใช่ของงานปัจจุบัน กรุณากลับไปเลือกและทำ SAMPLE ใหม่",
      );
    const prompts = v2PromptList.value
        .split("\n")
        .filter((value) => value.trim()),
      title = brief.project_name || brief.topic || "สินค้า Vision 2",
      pageTotal = importedProductFile ? importedPageCount : prompts.length,
      productType = pdfFile.type === "application/zip" || /\.zip$/i.test(pdfFile.name) ? "ZIP" : "PDF";
    const editingTarget=editProductTarget;
    if(!editingTarget)resetProductForm();
    else{
      workspace.hidden=false;
      document.body.classList.add('product-editor-active');
      editorTitle.textContent=`แก้ไขรูปและ PDF · ${editingTarget.title||editingTarget.slug}`;
      deleteProductButton.hidden=false;
      editProductWithVision2.hidden=false;
    }
    workspace.hidden = false;
    if(!editingTarget){
      productEditor.elements.title.value = title;
      productEditor.elements.slug.value = "";
    }
    productEditor.elements.pages.value = pageTotal;
    if(!editingTarget){
      productEditor.elements.short_description.value = `${title} · ${pageTotal} หน้า`;
      productEditor.elements.description.value = importedProductFile
        ? `ไฟล์ ${productType} พร้อมใช้งาน จำนวน ${pageTotal} หน้า พร้อมรูปตัวอย่างติดลายน้ำ SAMPLE 3 รูป`
        : `สร้างด้วย Vision 2 ขนาด ${brief.output_size || "A4"} จำนวน ${prompts.length} ภาพ พร้อมรูปตัวอย่างติดลายน้ำ SAMPLE 3 รูป`;
    }
    productEditor.elements.file_type.value = productType;
    productEditor.elements.file_label.value = `ไฟล์ ${productType} ฉบับเต็ม`;
    setVision2PendingProductFiles({
      cover: sampleFiles[0],
      preview_2: sampleFiles[1],
      preview_3: sampleFiles[2],
      product_file: pdfFile,
    });
    const pdfTransfer = new DataTransfer();
    pdfTransfer.items.add(pdfFile);
    productEditor.elements.product_file.files = pdfTransfer.files;
    productEditor.elements.product_file.dispatchEvent(new Event("change"));
    ["cover", "preview_2", "preview_3"].forEach((name, index) => {
      const transfer = new DataTransfer();
      transfer.items.add(sampleFiles[index]);
      productEditor.elements[name].files = transfer.files;
      productEditor.elements[name].dispatchEvent(new Event("change"));
    });
    existingProductImages.innerHTML = sampleFiles
      .map(
        (file, index) =>
          `<article><img src="${URL.createObjectURL(file)}" alt="รูปตัวอย่าง ${index + 1}"><b>รูป ${index + 1}${index === 0 ? " · ปกสินค้า" : ""}</b></article>`,
      )
      .join("");
    existingFiles.innerHTML = `<article class="attached-pdf-card"><b>✓ แนบไฟล์ ${productType} จริงแล้ว</b><span>${esc(pdfFile.name)}</span><small>${pageTotal} หน้า · ${(pdfFile.size / 1024 / 1024).toFixed(2)} MB · จะอัปโหลดเมื่อกดบันทึกสินค้า</small><a href="${pdfObjectUrl}" target="_blank" rel="noopener">${productType === "PDF" ? "เปิดดู PDF ที่แนบ" : "ดาวน์โหลด ZIP ที่แนบเพื่อตรวจ"}</a></article>`;
    steps.forEach((step, index) =>
      step.classList.toggle("active", index === 5),
    );
    productEditor.scrollIntoView({ behavior: "smooth", block: "start" });
  };
})();
