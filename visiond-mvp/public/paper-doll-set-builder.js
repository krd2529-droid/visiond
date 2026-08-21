// PD-SET-001 — แปลง PNG/PDF/ZIP เป็นกลุ่มหน้าแล้วแบ่งเป็นตะกร้าตุ๊กตากระดาษแบบร่าง
// Input: PNG, PDF, ZIP(PNG), ZIP(PDF) + จำนวนตะกร้า + ราคา
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

  const state = { groups: [], baskets: [], signature: "", creating: false, results: [] };
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const setMessage = (text, error = false) => {
    message.textContent = text;
    message.classList.toggle("error", error);
  };
  const setBasketStatus = (index, status, detail = "") => {
    state.results[index] = { ...state.results[index], status, detail };
    const badge = preview.querySelector(`[data-basket="${index}"] .paper-doll-queue-status`);
    if (!badge) return;
    badge.dataset.status = status;
    badge.textContent = ({ queued: "รอคิว", running: "กำลังสร้าง", success: "สำเร็จ", error: "ไม่สำเร็จ" })[status] || status;
    badge.title = detail;
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
    const pdfjs = await import("/vendor/pdfjs/pdf.mjs?v=014407");
    pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.mjs?v=014407";
    return pdfjs;
  };
  const isPdf = (name, type = "") => type === "application/pdf" || /\.pdf$/i.test(name);
  const isPng = (name, type = "") => type === "image/png" || /\.png$/i.test(name);
  const isZip = (name, type = "") => ["application/zip", "application/x-zip-compressed"].includes(type) || /\.zip$/i.test(name);
  const readU16 = (view, offset) => view.getUint16(offset, true), readU32 = (view, offset) => view.getUint32(offset, true);
  const unzipEntries = async (file) => {
    const bytes = new Uint8Array(await file.arrayBuffer()), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let eocd = -1;
    for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset--) if (readU32(view, offset) === 0x06054b50) { eocd = offset; break; }
    if (eocd < 0) throw new Error(`${file.name} ไม่ใช่ ZIP ที่สมบูรณ์`);
    const total = readU16(view, eocd + 10), centralOffset = readU32(view, eocd + 16);
    if (!total) throw new Error(`${file.name} ไม่มีรายการไฟล์`);
    const decoder = new TextDecoder(), entries = []; let cursor = centralOffset;
    for (let index = 0; index < total; index++) {
      if (readU32(view, cursor) !== 0x02014b50) throw new Error(`${file.name} มีสารบัญ ZIP ไม่ถูกต้อง`);
      const method = readU16(view, cursor + 10), compressedSize = readU32(view, cursor + 20), size = readU32(view, cursor + 24), nameLength = readU16(view, cursor + 28), extraLength = readU16(view, cursor + 30), commentLength = readU16(view, cursor + 32), localOffset = readU32(view, cursor + 42), name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
      cursor += 46 + nameLength + extraLength + commentLength;
      if (name.endsWith("/") || name.startsWith("__MACOSX/") || /(^|\/)\._/.test(name)) continue;
      if (readU32(view, localOffset) !== 0x04034b50) throw new Error(`${name} มีส่วนหัว ZIP ไม่ถูกต้อง`);
      const localNameLength = readU16(view, localOffset + 26), localExtraLength = readU16(view, localOffset + 28), start = localOffset + 30 + localNameLength + localExtraLength, compressed = bytes.slice(start, start + compressedSize);
      let data;
      if (method === 0) data = compressed;
      else if (method === 8 && globalThis.DecompressionStream) {
        const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        data = new Uint8Array(await new Response(stream).arrayBuffer());
      } else throw new Error(`${name} ใช้วิธีบีบอัด ZIP ที่เบราว์เซอร์นี้ไม่รองรับ`);
      if (data.length !== size) throw new Error(`${name} แตก ZIP ได้ขนาดไม่ตรงต้นฉบับ`);
      entries.push({ name, data });
    }
    if (!entries.length) throw new Error(`${file.name} ไม่มี PNG หรือ PDF`);
    return entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  };
  const pngsToPdf = async (items) => {
    const output = await PDFLib.PDFDocument.create();
    for (const item of items) {
      const image = await output.embedPng(item.data), page = output.addPage([image.width, image.height]);
      page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    }
    return new Uint8Array(await output.save());
  };
  const pdfsToPdf = async (items) => {
    const output = await PDFLib.PDFDocument.create();
    for (const item of items) {
      const source = await PDFLib.PDFDocument.load(item.data, { ignoreEncryption: true }), pages = await output.copyPages(source, source.getPageIndices());
      pages.forEach((page) => output.addPage(page));
    }
    return new Uint8Array(await output.save());
  };
  const makeGroup = async (label, bytes) => {
    const pdf = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true }), pageCount = pdf.getPageCount();
    if (!pageCount) throw new Error(`${label} ไม่มีหน้าสำหรับแบ่ง`);
    return { label, bytes, pdf, pageCount };
  };
  const normalizeSources = async (files) => {
    const groups = [], loosePngs = [];
    for (const file of files) {
      if (isPng(file.name, file.type)) { loosePngs.push({ name: file.name, data: new Uint8Array(await file.arrayBuffer()) }); continue; }
      if (isPdf(file.name, file.type)) { groups.push(await makeGroup(file.name, new Uint8Array(await file.arrayBuffer()))); continue; }
      if (!isZip(file.name, file.type)) throw new Error(`${file.name} ต้องเป็น PNG, PDF หรือ ZIP`);
      const entries = await unzipEntries(file), pngs = entries.filter((entry) => isPng(entry.name)), pdfs = entries.filter((entry) => isPdf(entry.name));
      if (pngs.length + pdfs.length !== entries.length || (pngs.length && pdfs.length)) throw new Error(`${file.name} ต้องมีเฉพาะ PNG หรือเฉพาะ PDF อย่างใดอย่างหนึ่ง`);
      groups.push(await makeGroup(file.name, pngs.length ? await pngsToPdf(pngs) : await pdfsToPdf(pdfs)));
    }
    if (loosePngs.length) groups.unshift(await makeGroup(`PNG ${loosePngs.length} รูป`, await pngsToPdf(loosePngs)));
    return groups;
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
    preview.innerHTML = `<div class="paper-doll-source-summary">${state.groups.map((group, index) => `<article><b>กลุ่ม ${index + 1}: ${esc(group.label)}</b><small>${group.pageCount} หน้า · แบ่งครบทุกตะกร้า</small></article>`).join("")}</div><div class="paper-doll-basket-grid">${state.baskets.map((basket, index) => `<article class="paper-doll-basket-card" data-basket="${index}"><img alt="กำลังสร้างรูปตัวอย่างชุดที่ ${index + 1}" /><div><div class="paper-doll-card-heading"><h3>ตุ๊กตากระดาษชุดที่ ${index + 1}</h3><span class="paper-doll-queue-status" data-status="${state.results[index]?.status || "queued"}">${state.results[index]?.status === "success" ? "สำเร็จ" : "รอคิว"}</span></div><b>รวม ${basket.pages} หน้า</b><ul>${basket.ranges.map((range, sourceIndex) => `<li>${esc(state.groups[sourceIndex].label)}: หน้า ${range.start + 1}–${range.end + 1} (${range.count} หน้า)</li>`).join("")}</ul><label class="paper-doll-separate-price" ${priceMode.value === "same" ? "hidden" : ""}>ราคาชุดนี้ (บาท)<input type="number" min="1" step="1" value="${Number(commonPrice.value) || 59}" /></label></div></article>`).join("")}</div>`;
    await Promise.all(state.baskets.map(async (basket, index) => {
      const img = preview.querySelector(`[data-basket="${index}"] img`);
      try { img.src = await renderPage(state.groups[0].bytes, basket.ranges[0].start + 1); } catch { img.alt = "สร้างรูปตัวอย่างไม่สำเร็จ"; }
    }));
  };
  const analyze = async () => {
    const files = [...sourceInput.files], basketCount = Number(basketInput.value);
    createButton.disabled = true; preview.hidden = true; preview.innerHTML = "";
    if (!files.length) return setMessage("กรุณาเลือก PNG, PDF หรือ ZIP อย่างน้อย 1 ไฟล์", true);
    if (!Number.isInteger(basketCount) || basketCount < 2 || basketCount > 50) return setMessage("จำนวนตะกร้าต้องเป็น 2–50 ตะกร้า", true);
    analyzeButton.disabled = true; setMessage("กำลังแปลงไฟล์ต้นทางเป็นกลุ่มหน้า…");
    try {
      const groups = await normalizeSources(files);
      for (let index = 0; index < groups.length; index++) {
        const { pageCount, label } = groups[index];
        setMessage(`กำลังแบ่งกลุ่ม ${index + 1}/${groups.length}: ${label}`);
        if (pageCount < basketCount) throw new Error(`${label} มี ${pageCount} หน้า น้อยกว่า ${basketCount} ตะกร้า จึงแบ่งให้ทุกตะกร้าไม่ได้`);
        const allocations = allocation(pageCount, basketCount);
        assertCompleteAllocation(allocations, pageCount);
        groups[index].allocations = allocations;
      }
      state.groups = groups;
      state.baskets = Array.from({ length: basketCount }, (_, basketIndex) => {
        const ranges = groups.map((group) => group.allocations[basketIndex]);
        return { ranges, pages: ranges.reduce((sum, range) => sum + range.count, 0) };
      });
      state.signature = signature(); state.results = state.baskets.map(() => ({ status: "queued", detail: "", item: null }));
      await renderPreview();
      createButton.textContent = "สร้างตะกร้าร่างทั้งหมด";
      createButton.disabled = false;
      setMessage(`ตรวจครบ ${groups.length} กลุ่ม · ${basketCount} ตะกร้า · ทุกหน้าถูกจัดสรรครั้งเดียว พร้อมสร้างเป็นร่าง`);
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
    const pendingIndexes = state.results.map((result, index) => result.status === "success" ? -1 : index).filter((index) => index >= 0);
    if (!pendingIndexes.length) { state.creating = false; analyzeButton.disabled = false; return setMessage("ตะกร้าทุกรายการสร้างสำเร็จแล้ว ไม่มีรายการต้องสร้างซ้ำ"); }
    state.results.forEach((result, index) => { if (result.status !== "success") setBasketStatus(index, "queued"); });
    const failures = [];
    try {
      for (const basketIndex of pendingIndexes) {
        setBasketStatus(basketIndex, "running");
        setMessage(`กำลังสร้างตะกร้า ${basketIndex + 1}/${state.baskets.length} ตามคิว…`);
        try {
          const output = await PDFLib.PDFDocument.create();
          for (let groupIndex = 0; groupIndex < state.groups.length; groupIndex++) {
            const range = state.baskets[basketIndex].ranges[groupIndex], indices = Array.from({ length: range.count }, (_, offset) => range.start + offset), pages = await output.copyPages(state.groups[groupIndex].pdf, indices);
            pages.forEach((page) => output.addPage(page));
          }
          const pdfBytes = await output.save();
          if (pdfBytes.byteLength > 95 * 1024 * 1024) throw new Error(`PDF ตะกร้า ${basketIndex + 1} มีขนาดเกิน 95 MB กรุณาเพิ่มจำนวนตะกร้าแล้ว Preview ใหม่`);
          const cover = await makeCover(pdfBytes, basketIndex), ranges = state.baskets[basketIndex].ranges.map((range, groupIndex) => `${state.groups[groupIndex].label}: หน้า ${range.start + 1}–${range.end + 1}`).join("\n"), payload = new FormData();
          payload.set("source", "paper_doll_set"); payload.set("title", "ตุ๊กตากระดาษชุดใหม่"); payload.set("category", "paper-doll"); payload.set("file_type", "PDF"); payload.set("status", "draft"); payload.set("price_cents", String(prices[basketIndex] * 100)); payload.set("pages", String(state.baskets[basketIndex].pages)); payload.set("short_description", `ชุดตุ๊กตากระดาษ ${state.baskets[basketIndex].pages} หน้า ครบทุกกลุ่ม`); payload.set("description", `จัดชุดอัตโนมัติจาก ${state.groups.length} กลุ่มต้นทาง\n${ranges}`); payload.set("cover", cover); payload.set("product_file", new File([pdfBytes], `paper-doll-${basketIndex + 1}.pdf`, { type: "application/pdf" })); payload.set("file_label", "ไฟล์ตุ๊กตากระดาษฉบับเต็ม");
          const response = await fetch("/api/admin/products", { method: "POST", body: payload }), data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || `สร้างตะกร้า ${basketIndex + 1} ไม่สำเร็จ`);
          state.results[basketIndex] = { status: "success", detail: data.item?.slug || "สร้างร่างแล้ว", item: data.item || null };
          setBasketStatus(basketIndex, "success", state.results[basketIndex].detail);
        } catch (error) {
          const detail = error.message || `สร้างตะกร้า ${basketIndex + 1} ไม่สำเร็จ`;
          failures.push({ index: basketIndex, detail });
          setBasketStatus(basketIndex, "error", detail);
        }
      }
      const successes = state.results.filter((result) => result.status === "success"), slugs = successes.map((result) => result.item?.slug).filter(Boolean);
      if (failures.length) {
        setMessage(`สร้างสำเร็จ ${successes.length}/${state.baskets.length} ตะกร้า · ไม่สำเร็จ ${failures.length} ตะกร้า กด “ลองใหม่เฉพาะที่ไม่สำเร็จ” ได้โดยไม่สร้างรายการสำเร็จซ้ำ`, true);
        createButton.textContent = "ลองใหม่เฉพาะที่ไม่สำเร็จ";
        createButton.disabled = false;
      } else {
        setMessage(`สร้างร่างสำเร็จ ${successes.length} ตะกร้า${slugs.length ? ` · ${slugs.join(", ")}` : ""}`);
        createButton.textContent = "สร้างตะกร้าร่างครบแล้ว";
        createButton.disabled = true;
      }
      if (successes.length && typeof loadProducts === "function") await loadProducts();
    } finally { state.creating = false; analyzeButton.disabled = false; }
  };
  button.addEventListener("click", () => dialog.showModal());
  close.addEventListener("click", () => dialog.close());
  form.addEventListener("submit", (event) => event.preventDefault());
  priceMode.addEventListener("change", () => { commonPriceLabel.hidden = priceMode.value === "separate"; preview.querySelectorAll(".paper-doll-separate-price").forEach((label) => label.hidden = priceMode.value === "same"); });
  analyzeButton.addEventListener("click", analyze);
  createButton.addEventListener("click", createDrafts);
})();
