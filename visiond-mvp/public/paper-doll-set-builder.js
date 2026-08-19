// PD-SET-001 — แบ่งหน้าของ PDF แต่ละไฟล์เป็นชุดตะกร้าตุ๊กตากระดาษแบบร่าง
// Input: PDF หลายไฟล์ + จำนวนตะกร้า + ราคา
// Output: products(category=paper-doll, source=paper_doll_set, status=draft)
// ห้ามรวมหน้าทุก PDF เป็นกองเดียว ห้ามทำหน้าซ้ำ/ตกหล่น และห้ามเผยแพร่อัตโนมัติ
(() => {
  const button = document.querySelector("#paperDollSetBuilderButton"),
    dialog = document.querySelector("#paperDollSetBuilderDialog"),
    form = document.querySelector("#paperDollSetBuilderForm"),
    close = document.querySelector("#paperDollSetBuilderClose"),
    sourceInput = document.querySelector("#paperDollSourceFiles"),
    basketInput = document.querySelector("#paperDollBasketCount"),
    priceMode = document.querySelector("#paperDollPriceMode"),
    commonPrice = document.querySelector("#paperDollCommonPrice"),
    commonPriceLabel = document.querySelector("#paperDollCommonPriceLabel"),
    analyzeButton = document.querySelector("#paperDollAnalyzeButton"),
    createButton = document.querySelector("#paperDollCreateButton"),
    message = document.querySelector("#paperDollSetMessage"),
    preview = document.querySelector("#paperDollSetPreview");
  if (!button || !dialog || !globalThis.PDFLib) return;

  const state = { groups: [], baskets: [], signature: "", creating: false, created: [] };
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const setMessage = (text, error = false) => {
    message.textContent = text;
    message.classList.toggle("error", error);
  };
  const signature = () => [...sourceInput.files].map((file) => `${file.name}:${file.size}:${file.lastModified}`).join("|") + `#${basketInput.value}`;
  const allocation = (pageCount, basketCount) => {
    const base = Math.floor(pageCount / basketCount), remainder = pageCount % basketCount;
    let cursor = 0;
    return Array.from({ length: basketCount }, (_, index) => {
      const count = base + (index < remainder ? 1 : 0), start = cursor;
      cursor += count;
      return { start, end: cursor - 1, count };
    });
  };
  const assertCompleteAllocation = (ranges, pageCount) => {
    if (ranges.length === 0 || ranges[0].start !== 0 || ranges.at(-1).end !== pageCount - 1) throw new Error("การแบ่งหน้า PDF ไม่ครบ");
    ranges.forEach((range, index) => {
      if (range.count < 1 || range.end - range.start + 1 !== range.count || (index > 0 && range.start !== ranges[index - 1].end + 1)) throw new Error("พบหน้าซ้ำหรือช่วงหน้าขาดหายระหว่างแบ่ง PDF");
    });
    if (ranges.reduce((sum, range) => sum + range.count, 0) !== pageCount) throw new Error("จำนวนหน้าหลังแบ่งไม่ตรงกับ PDF ต้นทาง");
  };
  const importPdfJs = async () => {
    const pdfjs = await import("/vendor/pdfjs/pdf.mjs?v=014312");
    pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.mjs?v=014312";
    return pdfjs;
  };
  const renderPage = async (bytes, pageNumber) => {
    const pdfjs = await importPdfJs(), pdf = await pdfjs.getDocument({ data: bytes.slice() }).promise,
      page = await pdf.getPage(pageNumber), viewport = page.getViewport({ scale: 0.38 }), canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    return canvas.toDataURL("image/jpeg", .78);
  };
  const renderPreview = async () => {
    preview.hidden = false;
    preview.innerHTML = `<div class="paper-doll-source-summary">${state.groups.map((group, index) => `<article><b>PDF ${index + 1}: ${esc(group.file.name)}</b><small>${group.pageCount} หน้า · แบ่งครบทุกตะกร้า</small></article>`).join("")}</div><div class="paper-doll-basket-grid">${state.baskets.map((basket, index) => `<article class="paper-doll-basket-card" data-basket="${index}"><img alt="กำลังสร้างรูปตัวอย่างชุดที่ ${index + 1}" /><div><h3>ตุ๊กตากระดาษชุดที่ ${index + 1}</h3><b>รวม ${basket.pages} หน้า</b><ul>${basket.ranges.map((range, sourceIndex) => `<li>PDF ${sourceIndex + 1}: หน้า ${range.start + 1}–${range.end + 1} (${range.count} หน้า)</li>`).join("")}</ul><label class="paper-doll-separate-price" ${priceMode.value === "same" ? "hidden" : ""}>ราคาชุดนี้ (บาท)<input type="number" min="1" step="1" value="${Number(commonPrice.value) || 59}" /></label></div></article>`).join("")}</div>`;
    await Promise.all(state.baskets.map(async (basket, index) => {
      const img = preview.querySelector(`[data-basket="${index}"] img`);
      try { img.src = await renderPage(state.groups[0].bytes, basket.ranges[0].start + 1); } catch { img.alt = "สร้างรูปตัวอย่างไม่สำเร็จ"; }
    }));
  };
  const analyze = async () => {
    const files = [...sourceInput.files], basketCount = Number(basketInput.value);
    createButton.disabled = true; preview.hidden = true; preview.innerHTML = "";
    if (!files.length) return setMessage("กรุณาเลือกไฟล์ PDF ต้นทางอย่างน้อย 1 ไฟล์", true);
    if (!Number.isInteger(basketCount) || basketCount < 2 || basketCount > 50) return setMessage("จำนวนตะกร้าต้องเป็น 2–50 ตะกร้า", true);
    if (files.some((file) => file.type !== "application/pdf" && !/\.pdf$/i.test(file.name))) return setMessage("ฟีเจอร์นี้รับเฉพาะไฟล์ PDF", true);
    analyzeButton.disabled = true; setMessage("กำลังอ่านจำนวนหน้าของ PDF แต่ละไฟล์…");
    try {
      const groups = [];
      for (let index = 0; index < files.length; index++) {
        setMessage(`กำลังตรวจ PDF ${index + 1}/${files.length}: ${files[index].name}`);
        const bytes = new Uint8Array(await files[index].arrayBuffer()), pdf = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true }), pageCount = pdf.getPageCount();
        if (!pageCount) throw new Error(`${files[index].name} ไม่มีหน้า PDF`);
        if (pageCount < basketCount) throw new Error(`${files[index].name} มี ${pageCount} หน้า น้อยกว่า ${basketCount} ตะกร้า จึงแบ่งให้ทุกตะกร้าไม่ได้`);
        const allocations = allocation(pageCount, basketCount);
        assertCompleteAllocation(allocations, pageCount);
        groups.push({ file: files[index], bytes, pdf, pageCount, allocations });
      }
      state.groups = groups;
      state.baskets = Array.from({ length: basketCount }, (_, basketIndex) => {
        const ranges = groups.map((group) => group.allocations[basketIndex]);
        return { ranges, pages: ranges.reduce((sum, range) => sum + range.count, 0) };
      });
      state.signature = signature(); state.created = [];
      await renderPreview();
      createButton.disabled = false;
      setMessage(`ตรวจครบ ${files.length} PDF · ${basketCount} ตะกร้า · ทุกหน้าถูกจัดสรรครั้งเดียว พร้อมสร้างเป็นร่าง`);
    } catch (error) {
      state.groups = []; state.baskets = [];
      setMessage(error.message || "ตรวจ PDF ไม่สำเร็จ", true);
    } finally { analyzeButton.disabled = false; }
  };
  const makeCover = async (pdfBytes, index) => {
    const pdfjs = await importPdfJs(), pdf = await pdfjs.getDocument({ data: pdfBytes.slice() }).promise, page = await pdf.getPage(1), viewport = page.getViewport({ scale: 1.25 }), canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", .84));
    if (!blob) throw new Error(`สร้างรูปปกชุดที่ ${index + 1} ไม่สำเร็จ`);
    return new File([blob], `paper-doll-set-${String(index + 1).padStart(3, "0")}-cover.jpg`, { type: "image/jpeg" });
  };
  const createDrafts = async () => {
    if (state.creating) return;
    if (!state.baskets.length || state.signature !== signature()) return setMessage("ไฟล์หรือจำนวนตะกร้าเปลี่ยนแล้ว กรุณากดตรวจไฟล์และ Preview ใหม่", true);
    const samePrice = Number(commonPrice.value), separate = [...preview.querySelectorAll(".paper-doll-separate-price input")].map((input) => Number(input.value)), prices = state.baskets.map((_, index) => priceMode.value === "same" ? samePrice : separate[index]);
    if (prices.some((price) => !Number.isInteger(price) || price < 1)) return setMessage("ราคาทุกตะกร้าต้องเป็นจำนวนเต็มอย่างน้อย 1 บาท", true);
    state.creating = true; createButton.disabled = true; analyzeButton.disabled = true;
    const startIndex = state.created.length;
    try {
      for (let basketIndex = startIndex; basketIndex < state.baskets.length; basketIndex++) {
        setMessage(`กำลังสร้าง PDF ตะกร้า ${basketIndex + 1}/${state.baskets.length}…`);
        const output = await PDFLib.PDFDocument.create();
        for (let groupIndex = 0; groupIndex < state.groups.length; groupIndex++) {
          const range = state.baskets[basketIndex].ranges[groupIndex], indices = Array.from({ length: range.count }, (_, offset) => range.start + offset), pages = await output.copyPages(state.groups[groupIndex].pdf, indices);
          pages.forEach((page) => output.addPage(page));
        }
        const pdfBytes = await output.save();
        if (pdfBytes.byteLength > 95 * 1024 * 1024) throw new Error(`PDF ตะกร้า ${basketIndex + 1} มีขนาดเกิน 95 MB กรุณาเพิ่มจำนวนตะกร้าแล้ว Preview ใหม่`);
        const cover = await makeCover(pdfBytes, basketIndex), ranges = state.baskets[basketIndex].ranges.map((range, groupIndex) => `${state.groups[groupIndex].file.name}: หน้า ${range.start + 1}–${range.end + 1}`).join("\n"), payload = new FormData();
        payload.set("source", "paper_doll_set"); payload.set("title", "ตุ๊กตากระดาษชุดใหม่"); payload.set("category", "paper-doll"); payload.set("file_type", "PDF"); payload.set("status", "draft"); payload.set("price_cents", String(prices[basketIndex] * 100)); payload.set("pages", String(state.baskets[basketIndex].pages)); payload.set("short_description", `ชุดตุ๊กตากระดาษ ${state.baskets[basketIndex].pages} หน้า จาก PDF ครบทุกกลุ่ม`); payload.set("description", `จัดชุดอัตโนมัติจาก PDF ${state.groups.length} ไฟล์\n${ranges}`); payload.set("cover", cover); payload.set("product_file", new File([pdfBytes], `paper-doll-set-${basketIndex + 1}.pdf`, { type: "application/pdf" })); payload.set("file_label", "ไฟล์ตุ๊กตากระดาษฉบับเต็ม");
        const response = await fetch("/api/admin/products", { method: "POST", body: payload }), data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `สร้างตะกร้า ${basketIndex + 1} ไม่สำเร็จ`);
        state.created.push(data.item);
      }
      setMessage(`สร้างร่างสำเร็จ ${state.created.length} ตะกร้า · ${state.created.map((item) => item.slug).join(", ")}`);
      createButton.disabled = true;
      if (typeof loadProducts === "function") await loadProducts();
    } catch (error) {
      setMessage(`${error.message || "สร้างตะกร้าไม่สำเร็จ"}${state.created.length ? ` · สำเร็จแล้ว ${state.created.length} ตะกร้า กดอีกครั้งเพื่อทำต่อจากตะกร้า ${state.created.length + 1} โดยไม่สร้างซ้ำ` : ""}`, true);
      createButton.disabled = false;
    } finally { state.creating = false; analyzeButton.disabled = false; }
  };
  button.addEventListener("click", () => dialog.showModal());
  close.addEventListener("click", () => dialog.close());
  form.addEventListener("submit", (event) => event.preventDefault());
  priceMode.addEventListener("change", () => { commonPriceLabel.hidden = priceMode.value === "separate"; preview.querySelectorAll(".paper-doll-separate-price").forEach((label) => label.hidden = priceMode.value === "same"); });
  analyzeButton.addEventListener("click", analyze);
  createButton.addEventListener("click", createDrafts);
})();
