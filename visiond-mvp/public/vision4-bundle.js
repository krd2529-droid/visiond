(() => {
  const queue = document.getElementById("v3PendingQueue"),
    start = document.getElementById("v4StartBundle"),
    count = document.getElementById("v4BundleSelectedCount"),
    workspace = document.getElementById("v4BundleWorkspace"),
    message = document.getElementById("v4BundleMessage"),
    picker = document.getElementById("v4SamplePicker"),
    form = document.getElementById("v4ManualProductForm"),
    createState = document.getElementById("v4CreateState");
  if (!queue || !start || !workspace || !form || !window.PDFLib) return;
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
  const legacy = new Set([
    "dinosaur",
    "paper-doll",
    "document",
    "set-coloring",
    "set-tattoo",
  ]);
  let mergedFile = null,
    candidates = [],
    selectedIds = [];
  const chosen = () =>
    [...queue.querySelectorAll("[data-v4-bundle-select]:checked")].map(
      (input) => Number(input.value),
    );
  const updateCount = () =>
    (count.textContent = `เลือกแล้ว ${chosen().length} ไฟล์`);
  const decorate = () => {
    queue.querySelectorAll("[data-v4-pending-detail]").forEach((detail) => {
      const id = Number(detail.dataset.v4PendingDetail),
        card = detail.closest(".v3-review-card");
      if (!id || !card || card.dataset.bundleReady) return;
      card.dataset.bundleReady = "1";
      const label = document.createElement("label");
      label.className = "v4-bundle-select";
      label.title = "เลือกไฟล์นี้ไปรวมชุด";
      label.innerHTML = `<input type="checkbox" data-v4-bundle-select value="${id}" aria-label="เลือกไฟล์นี้ไปรวมชุด">`;
      card.prepend(label);
      card.style.gridTemplateColumns = "38px 58px minmax(0,1fr) auto";
      label.querySelector("input").onchange = updateCount;
    });
  };
  new MutationObserver(decorate).observe(queue, {
    childList: true,
    subtree: true,
  });
  decorate();
  let pdfjsPromise;
  const pdfjs = () =>
    pdfjsPromise ||
    (pdfjsPromise = import("/vendor/pdfjs/pdf.mjs?v=014247").then((lib) => {
      lib.GlobalWorkerOptions.workerSrc =
        "/vendor/pdfjs/pdf.worker.mjs?v=014247";
      return lib;
    }));
  const canvasFile = (canvas, name, quality = 0.82) =>
    new Promise((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(new File([blob], name, { type: "image/jpeg" }))
            : reject(new Error("สร้างรูปตัวอย่างไม่ได้")),
        "image/jpeg",
        quality,
      ),
    );
  const watermark = async (file, name) => {
    const bitmap = await createImageBitmap(file),
      scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height)),
      canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    context.save();
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(-Math.PI / 6);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = `900 ${Math.max(38, Math.round(canvas.width / 7))}px Arial`;
    context.lineWidth = Math.max(3, canvas.width / 260);
    context.strokeStyle = "rgba(255,255,255,.9)";
    context.strokeText("SAMPLE", 0, 0);
    context.fillStyle = "rgba(220,20,35,.64)";
    context.fillText("SAMPLE", 0, 0);
    context.restore();
    return canvasFile(canvas, name);
  };
  const renderPdfSamples = async (bytes, sourceName, limit = 3) => {
    const lib = await pdfjs(),
      documentPdf = await lib.getDocument({ data: bytes.slice().buffer })
        .promise,
      total = documentPdf.numPages,
      indexes = [1];
    if (total > 1) indexes.push(Math.ceil(total / 2));
    if (total > 2) indexes.push(total);
    const unique = [...new Set(indexes)].slice(0, Math.min(limit, total)),
      files = [];
    for (const pageNumber of unique) {
      const page = await documentPdf.getPage(pageNumber),
        base = page.getViewport({ scale: 1 }),
        scale = Math.min(2, 1200 / Math.max(base.width, base.height)),
        viewport = page.getViewport({ scale }),
        canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const context = canvas.getContext("2d", { alpha: false });
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: context, viewport }).promise;
      files.push(
        await watermark(
          await canvasFile(canvas, "page.jpg"),
          `${sourceName}-${pageNumber}-sample.jpg`,
        ),
      );
      page.cleanup();
    }
    await documentPdf.destroy();
    return files;
  };
  const zipDirectory = async (file) => {
    const bytes = new Uint8Array(await file.arrayBuffer()),
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
    if (eocd < 0) throw new Error(`ZIP ${file.name} อ่านไม่ได้`);
    const total = view.getUint16(eocd + 10, true),
      offset = view.getUint32(eocd + 16, true),
      decoder = new TextDecoder(),
      entries = [];
    let position = offset;
    for (let index = 0; index < total; index++) {
      if (view.getUint32(position, true) !== 0x02014b50)
        throw new Error("ตาราง ZIP ไม่สมบูรณ์");
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
        !/\.(pdf|jpe?g|png|webp)$/i.test(name) ||
        name.includes("__MACOSX/") ||
        name.endsWith("/")
      )
        continue;
      if (flags & 1 || ![0, 8].includes(method))
        throw new Error(`ZIP ${file.name} ใช้รูปแบบที่ไม่รองรับ`);
      entries.push({ name, method, compressedSize, size, localOffset });
    }
    return { bytes, view, entries };
  };
  const extractEntry = async (zip, entry) => {
    const offset = entry.localOffset,
      nameLength = zip.view.getUint16(offset + 26, true),
      extraLength = zip.view.getUint16(offset + 28, true),
      begin = offset + 30 + nameLength + extraLength,
      compressed = zip.bytes.slice(begin, begin + entry.compressedSize),
      raw =
        entry.method === 0
          ? compressed
          : new Uint8Array(
              await new Response(
                new Blob([compressed])
                  .stream()
                  .pipeThrough(new DecompressionStream("deflate-raw")),
              ).arrayBuffer(),
            ),
      ext = entry.name.split(".").pop().toLowerCase(),
      type =
        ext === "pdf"
          ? "application/pdf"
          : ext === "png"
            ? "image/png"
            : ext === "webp"
              ? "image/webp"
              : "image/jpeg";
    return new File([raw], entry.name.split("/").pop(), { type });
  };
  const imageAsJpeg = async (file) => {
    if (file.type === "image/jpeg") return file;
    const bitmap = await createImageBitmap(file),
      canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    return canvasFile(canvas, file.name.replace(/\.[^.]+$/, ".jpg"), 0.92);
  };
  const addImagePage = async (out, file) => {
    const normalized =
        file.type === "image/png" ? file : await imageAsJpeg(file),
      bytes = await normalized.arrayBuffer(),
      image =
        normalized.type === "image/png"
          ? await out.embedPng(bytes)
          : await out.embedJpg(bytes),
      size = image.scale(1),
      page = out.addPage([size.width, size.height]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: size.width,
      height: size.height,
    });
  };
  const addPdf = async (out, bytes) => {
    const source = await PDFLib.PDFDocument.load(bytes, {
        ignoreEncryption: true,
      }),
      pages = await out.copyPages(source, source.getPageIndices());
    pages.forEach((page) => out.addPage(page));
    return pages.length;
  };
  const processSource = async (out, item, file) => {
    let pages = 0,
      samples = [];
    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      pages = await addPdf(out, bytes);
      samples = await renderPdfSamples(bytes, item.file_name, 3);
    } else {
      const zip = await zipDirectory(file);
      for (const entry of zip.entries) {
        const inside = await extractEntry(zip, entry);
        if (inside.type === "application/pdf") {
          const bytes = new Uint8Array(await inside.arrayBuffer()),
            added = await addPdf(out, bytes);
          if (samples.length < 3)
            samples.push(
              ...(await renderPdfSamples(
                bytes,
                item.file_name,
                3 - samples.length,
              )),
            );
          pages += added;
        } else {
          await addImagePage(out, inside);
          pages++;
          if (samples.length < 3)
            samples.push(
              await watermark(inside, `${item.file_name}-${pages}-sample.jpg`),
            );
        }
      }
    }
    return { pages, samples: samples.slice(0, Math.min(3, pages)) };
  };
  const loadCategories = async () => {
    const response = await fetch("/api/admin/categories", {
        cache: "no-store",
      }),
      data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "โหลดหมวดหมู่ไม่สำเร็จ");
    const categories = (data.items || []).filter(
      (item) =>
        Number(item.active) && !item.parent_slug && !legacy.has(item.slug),
    );
    form.elements.category.innerHTML = categories
      .map(
        (item) =>
          `<option value="${esc(item.slug)}">${esc(item.name)}</option>`,
      )
      .join("");
    if (!categories.length) throw new Error("ยังไม่มีหมวดหลักสำหรับลงสินค้า");
  };
  start.onclick = async () => {
    selectedIds = chosen();
    if (!selectedIds.length) return alert("กรุณาติ๊กเลือกไฟล์รอรวมก่อน");
    start.disabled = true;
    workspace.hidden = false;
    picker.innerHTML = "";
    createState.textContent = "";
    message.textContent = "กำลังดาวน์โหลดและรวมไฟล์ กรุณารอ…";
    workspace.scrollIntoView({ behavior: "smooth", block: "start" });
    try {
      const response = await fetch("/api/admin/vision4-review", {
          cache: "no-store",
        }),
        data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || "โหลดรายการไฟล์ไม่สำเร็จ");
      const map = new Map(
          (data.pending || []).map((item) => [Number(item.id), item]),
        ),
        items = selectedIds.map((id) => map.get(id));
      if (items.some((item) => !item))
        throw new Error("มีไฟล์บางรายการไม่อยู่ในรอรวมแล้ว กรุณาโหลดใหม่");
      const out = await PDFLib.PDFDocument.create();
      candidates = [];
      let pages = 0;
      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        message.textContent = `กำลังรวมไฟล์ ${index + 1}/${items.length}: ${item.file_name}`;
        const fileResponse = await fetch(
          `/api/admin/vision4-pending-file/${item.id}`,
        );
        if (!fileResponse.ok)
          throw new Error(`เปิดไฟล์ ${item.file_name} ไม่สำเร็จ`);
        const blob = await fileResponse.blob(),
          file = new File([blob], item.file_name, {
            type: item.mime_type || blob.type,
          });
        const result = await processSource(out, item, file);
        pages += result.pages;
        result.samples.forEach((sample) =>
          candidates.push({ file: sample, source: item.file_name }),
        );
      }
      if (pages < 1) throw new Error("ไม่พบหน้าที่นำมารวมได้");
      if (candidates.length < 3)
        throw new Error(
          `มีรูปตัวอย่างเพียง ${candidates.length} รูป กรุณาเลือกไฟล์เพิ่มให้รวมแล้วได้อย่างน้อย 3 หน้า`,
        );
      const bytes = await out.save({ useObjectStreams: true });
      mergedFile = new File([bytes], `vision4-combined-${Date.now()}.pdf`, {
        type: "application/pdf",
      });
      if (mergedFile.size > 1024 * 1024 * 1024)
        throw new Error("PDF รวมมีขนาดเกิน 1 GB กรุณาแบ่งชุด");
      picker.innerHTML = candidates
        .map(
          (candidate, index) =>
            `<label class="v4-sample-choice"><input type="checkbox" name="sample" value="${index}"${index < 3 ? " checked" : ""}><img src="${URL.createObjectURL(candidate.file)}" alt="รูปตัวอย่าง"><small>${esc(candidate.source)}</small></label>`,
        )
        .join("");
      picker.querySelectorAll("input").forEach(
        (input) =>
          (input.onchange = () => {
            const checked = [...picker.querySelectorAll("input:checked")];
            if (checked.length > 3) {
              input.checked = false;
              alert("เลือกตัวอย่างได้ 3 รูปเท่านั้น");
            }
            message.textContent = `PDF รวม ${pages} หน้า · เลือกรูปตัวอย่างแล้ว ${[...picker.querySelectorAll("input:checked")].length}/3 รูป`;
          }),
      );
      await loadCategories();
      const price = pages <= 100 && pages % 10 === 0 ? pages - 1 : pages;
      form.elements.pages.value = pages;
      form.elements.price.value = price;
      form.elements.title.value = "";
      form.elements.short_description.value = `ไฟล์ PDF รวม ${pages} หน้า`;
      form.elements.description.value = `ไฟล์ดิจิทัล PDF รวมทั้งหมด ${pages} หน้า พร้อมดาวน์โหลดหลังชำระเงินและได้รับการอนุมัติ`;
      message.textContent = `รวมสำเร็จ ${pages} หน้า · กรุณาเลือกรูปตัวอย่างให้ครบ 3 รูปและกรอกตะกร้า`;
    } catch (error) {
      message.textContent = `ไม่สำเร็จ: ${error.message}`;
      mergedFile = null;
    } finally {
      start.disabled = false;
    }
  };
  const upload = async (file, productId) => {
    let response = await fetch("/api/admin/product-multipart/init", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "product",
          product_id: productId,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
        }),
      }),
      data = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(data.error || "เริ่มอัปโหลด PDF ไม่สำเร็จ");
    const parts = [],
      chunk = data.chunk_size || 50 * 1024 * 1024,
      total = Math.ceil(file.size / chunk);
    for (let index = 0; index < total; index++) {
      message.textContent = `กำลังอัปโหลด PDF ส่วน ${index + 1}/${total}`;
      response = await fetch(
        `/api/admin/product-multipart/part?key=${encodeURIComponent(data.key)}&upload_id=${encodeURIComponent(data.upload_id)}&part_number=${index + 1}`,
        {
          method: "PUT",
          headers: { "content-type": "application/octet-stream" },
          body: file.slice(
            index * chunk,
            Math.min(file.size, (index + 1) * chunk),
          ),
        },
      );
      const part = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(part.error || "อัปโหลด PDF ไม่สำเร็จ");
      parts.push(part);
    }
    response = await fetch("/api/admin/product-multipart/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "product",
        product_id: productId,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        key: data.key,
        upload_id: data.upload_id,
        label: "ไฟล์ PDF รวมฉบับเต็ม",
        parts,
      }),
    });
    data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "ประกอบ PDF ไม่สำเร็จ");
  };
  form.onsubmit = async (event) => {
    event.preventDefault();
    const fail = (reason) => {
      createState.textContent = `ยังสร้างไม่ได้: ${reason}`;
      createState.scrollIntoView({ behavior: "smooth", block: "center" });
      alert(reason);
    };
    if (!mergedFile) return fail("กรุณารวมไฟล์ก่อน");
    const selected = [...picker.querySelectorAll("input:checked")].map(
      (input) => candidates[Number(input.value)],
    );
    if (selected.length !== 3)
      return fail(`กรุณาเลือกรูปตัวอย่างให้ครบ 3 รูป (ตอนนี้เลือก ${selected.length} รูป)`);
    const button = document.getElementById("v4CreateProduct");
    button.disabled = true;
    createState.textContent = "กำลังสร้างสินค้า กรุณาอย่าปิดหน้านี้…";
    try {
      const payload = new FormData();
      payload.set("title", form.elements.title.value.trim());
      payload.set("slug", "");
      payload.set("category", form.elements.category.value);
      payload.set("file_type", "PDF");
      payload.set("status", "draft");
      payload.set(
        "price_cents",
        String(Math.round(Number(form.elements.price.value) * 100)),
      );
      payload.set("pages", form.elements.pages.value);
      payload.set(
        "short_description",
        form.elements.short_description.value.trim(),
      );
      payload.set("description", form.elements.description.value.trim());
      payload.set("cover", selected[0].file);
      payload.set("preview_2", selected[1].file);
      payload.set("preview_3", selected[2].file);
      message.textContent = "กำลังสร้างสินค้าและอัปโหลด PDF…";
      let response = await fetch("/api/admin/products", {
          method: "POST",
          body: payload,
        }),
        data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "สร้างสินค้าไม่สำเร็จ");
      await upload(mergedFile, data.item.id);
      const publish = new FormData();
      publish.set("title", form.elements.title.value.trim());
      publish.set("slug", data.item.slug);
      publish.set("category", form.elements.category.value);
      publish.set("file_type", "PDF");
      publish.set("status", "published");
      publish.set(
        "price_cents",
        String(Math.round(Number(form.elements.price.value) * 100)),
      );
      publish.set("pages", form.elements.pages.value);
      publish.set(
        "short_description",
        form.elements.short_description.value.trim(),
      );
      publish.set("description", form.elements.description.value.trim());
      message.textContent = "อัปโหลดครบแล้ว กำลังเปิดขายสินค้า…";
      response = await fetch(`/api/admin/products/${data.item.id}`, {
        method: "PUT",
        body: publish,
      });
      const published = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(published.error || "เปิดขายสินค้าไม่สำเร็จ");
      response = await fetch("/api/admin/vision4-pending/consume", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, product_id: data.item.id }),
      });
      const consumed = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(consumed.error || "ย้ายไฟล์ออกจากรอรวมไม่สำเร็จ");
      sessionStorage.setItem(
        "visiond_admin_notice",
        `สร้างสินค้า “${form.elements.title.value.trim()}” และเปิดขายแล้ว`,
      );
      location.href = "/admin?preview_tab=vision3&done=" + Date.now();
    } catch (error) {
      const reason = error?.message || "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
      message.textContent = `ไม่สำเร็จ: ${reason}`;
      createState.textContent = `สร้างไม่สำเร็จ: ${reason}`;
      createState.scrollIntoView({ behavior: "smooth", block: "center" });
      alert(`สร้างสินค้าไม่สำเร็จ\n${reason}`);
    } finally {
      button.disabled = false;
    }
  };
})();
