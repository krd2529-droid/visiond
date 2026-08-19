(() => {
  const id = Number(new URLSearchParams(location.search).get("id")),
    form = document.querySelector("#courseBasketEditForm"),
    message = document.querySelector("#courseBasketEditMessage"),
    episodeForm = document.querySelector("#basketEpisodeForm"),
    episodeList = document.querySelector("#basketEpisodeList"),
    episodeMessage = document.querySelector("#basketEpisodeMessage"),
    episodeTitle = document.querySelector("#basketEpisodeFormTitle"),
    addEpisode = document.querySelector("#basketAddEpisode"),
    cancelEpisode = document.querySelector("#basketCancelEpisode"),
    publishButton = document.querySelector("#basketPublish"),
    publishHelp = document.querySelector("#basketPublishHelp"),
    publishMessage = document.querySelector("#basketPublishMessage"),
    names = [
      "Shopee",
      "TikTok",
      "Lazada",
      "Kalodata",
      "YouTube",
      "Gemini",
      "Grok",
      "ChatGPT",
      "Facebook",
      "Canva",
      "อื่น ๆ",
    ];
  editPlatformTags.innerHTML = names
    .map(
      (x) =>
        `<label><input type="checkbox" name="platform_tags" value="${x}"> ${x}</label>`,
    )
    .join("");
  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[char]);
  let item,
    episodes = [],
    episodesEditable = true,
    coverObjectUrl = "";

  function resetEpisodeForm(show = false) {
    episodeForm.reset();
    episodeForm.elements.lesson_id.value = "";
    episodeTitle.textContent = "สร้าง EP ใหม่";
    episodeForm.querySelector('button[type="submit"]').textContent = "บันทึก EP";
    episodeMessage.textContent = "";
    episodeForm.hidden = !show;
    episodeForm.classList.remove("is-editing");
    if (show) episodeForm.elements.title.focus();
  }

  function openEpisodeEditor(episode) {
    const index = episodes.findIndex((entry) => String(entry.id) === String(episode.id));
    episodeForm.hidden = false;
    episodeForm.removeAttribute("hidden");
    episodeForm.classList.add("is-editing");
    episodeTitle.textContent = `แก้ไข EP.${index + 1}`;
    episodeForm.elements.lesson_id.value = episode.id;
    episodeForm.elements.title.value = episode.title || "";
    episodeForm.elements.description.value = episode.description || "";
    episodeForm.elements.duration_seconds.value = Number(episode.duration_seconds) || 0;
    episodeForm.querySelector('button[type="submit"]').textContent = "บันทึกการแก้ไข EP";
    requestAnimationFrame(() => {
      episodeForm.scrollIntoView({ behavior: "auto", block: "center" });
      episodeForm.elements.title.focus({ preventScroll: true });
    });
  }

  function renderEpisodes() {
    episodeList.innerHTML = episodes.length
      ? episodes.map((episode, index) => `<article class="seller-ep"><div class="seller-ep-number">${index + 1}</div><div><b>EP.${index + 1} · ${esc(episode.title)}</b><small>${episode.has_video ? "มีวิดีโอ" : ""}${episode.has_video && episode.file_count ? " · " : ""}${episode.file_count ? `ไฟล์ประกอบ ${episode.file_count} ไฟล์` : ""}${!episode.has_video && !episode.file_count ? "ยังไม่มีสื่อ" : ""}</small>${episode.description ? `<p>${esc(episode.description)}</p>` : ""}<div class="seller-file-list">${(episode.files || []).map((file) => `<span>${esc(file.file_name)} <button type="button" data-delete-file="${file.id}" data-lesson="${episode.id}" ${episodesEditable ? "" : "disabled"}>ลบไฟล์</button></span>`).join("")}</div></div><div class="seller-ep-actions"><button type="button" data-edit-episode="${episode.id}" ${episodesEditable ? "" : "disabled"}>แก้ไข EP</button><button type="button" data-delete-episode="${episode.id}" ${episodesEditable ? "" : "disabled"}>ลบ EP</button></div></article>`).join("")
      : '<div class="seller-course-empty"><b>ยังไม่มี EP</b><p>กด “+ สร้าง EP เพิ่ม” เพื่อสร้างบทเรียนแรก</p></div>';
    episodeList.querySelectorAll("[data-edit-episode]").forEach((button) => button.onclick = () => {
      const episode = episodes.find((entry) => String(entry.id) === button.dataset.editEpisode);
      if (!episode) return;
      openEpisodeEditor(episode);
    });
    episodeList.querySelectorAll("[data-delete-episode]").forEach((button) => button.onclick = async () => {
      if (!confirm("ลบ EP และไฟล์ทั้งหมดใช่ไหม")) return;
      await episodeAction(`/api/course-seller/${id}/lessons/${button.dataset.deleteEpisode}`, { method: "DELETE" });
    });
    episodeList.querySelectorAll("[data-delete-file]").forEach((button) => button.onclick = async () => {
      if (!confirm("ลบไฟล์ประกอบนี้ใช่ไหม")) return;
      await episodeAction(`/api/course-seller/${id}/lessons/${button.dataset.lesson}/files/${button.dataset.deleteFile}`, { method: "DELETE" });
    });
    const ready = episodes.length > 0 && episodes.every((episode) => episode.has_video || episode.has_pdf || Number(episode.file_count) > 0);
    publishButton.disabled = !ready || !episodesEditable;
    publishHelp.textContent = ready
      ? `พร้อมเผยแพร่ ${episodes.length} EP · เมื่อส่งแล้วจะรอ Boss อนุมัติก่อนเปิดขาย`
      : episodes.length
        ? "ยังมี EP ที่ไม่มีวิดีโอหรือไฟล์ประกอบ กรุณาเพิ่มสื่อให้ครบก่อนส่ง"
        : "ต้องมีอย่างน้อย 1 EP และทุก EP ต้องมีวิดีโอหรือไฟล์ประกอบ";
  }

  async function loadEpisodes() {
    const response = await fetch(`/api/course-seller/${id}/lessons`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      episodeList.textContent = data.error || "โหลด EP ไม่สำเร็จ";
      return;
    }
    episodes = Array.isArray(data.items) ? data.items : [];
    episodesEditable = Boolean(data.editable) && !item?.content_locked;
    addEpisode.disabled = !episodesEditable;
    document.querySelector("#basketEpisodeHelp").textContent = episodesEditable
      ? "สร้าง แก้ไข หรือลบ EP ได้จากหน้าเดียวกับข้อมูลตะกร้าคอร์ส"
      : "เนื้อหา EP ถูกล็อกแล้ว เนื่องจากหมดเวลาแก้ไขหรือคอร์สมีผู้ซื้อ";
    renderEpisodes();
  }

  async function episodeAction(url, options) {
    episodeMessage.textContent = "กำลังบันทึก…";
    const response = await fetch(url, options), data = await response.json().catch(() => ({}));
    episodeMessage.textContent = data.error || data.message || (response.ok ? "บันทึกแล้ว" : "ดำเนินการไม่สำเร็จ");
    if (response.ok) {
      resetEpisodeForm(false);
      await loadEpisodes();
    }
    return response.ok;
  }

  async function uploadEpisodeVideo(lessonId, file, quality) {
    const initResponse = await fetch(`/api/course-seller/${id}/lesson-video-multipart/init`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lesson_id: Number(lessonId), file_name: file.name, file_type: file.type, file_size: file.size, quality: Number(quality) }),
    });
    const init = await initResponse.json().catch(() => ({}));
    if (!initResponse.ok) throw new Error(init.error || "เริ่มอัปโหลดวิดีโอไม่สำเร็จ");
    const parts = [];
    try {
      for (let offset = 0, partNumber = 1; offset < file.size; offset += init.chunk_size, partNumber += 1) {
        const end = Math.min(file.size, offset + init.chunk_size);
        episodeMessage.textContent = `กำลังอัปโหลดวิดีโอ ${Math.round((offset / file.size) * 100)}% กรุณาอย่าปิดหน้านี้…`;
        const partResponse = await fetch(`/api/course-seller/${id}/lesson-video-multipart/part?key=${encodeURIComponent(init.key)}&upload_id=${encodeURIComponent(init.upload_id)}&part_number=${partNumber}`, {
          method: "PUT",
          body: file.slice(offset, end),
        });
        const part = await partResponse.json().catch(() => ({}));
        if (!partResponse.ok) throw new Error(part.error || `อัปโหลดส่วนที่ ${partNumber} ไม่สำเร็จ`);
        parts.push(part);
      }
      const completeResponse = await fetch(`/api/course-seller/${id}/lesson-video-multipart/complete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: init.key, upload_id: init.upload_id, file_size: file.size, parts }),
      });
      const complete = await completeResponse.json().catch(() => ({}));
      if (!completeResponse.ok) throw new Error(complete.error || "รวมไฟล์วิดีโอไม่สำเร็จ");
    } catch (error) {
      await fetch(`/api/course-seller/${id}/lesson-video-multipart/abort`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: init.key, upload_id: init.upload_id }),
      }).catch(() => {});
      throw error;
    }
  }

  addEpisode.onclick = () => {
    if (!episodesEditable) return;
    resetEpisodeForm(true);
    episodeForm.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  cancelEpisode.onclick = () => resetEpisodeForm(false);
  episodeForm.onsubmit = async (event) => {
    event.preventDefault();
    const button = event.submitter, lessonId = episodeForm.elements.lesson_id.value,
      video = episodeForm.elements.video.files?.[0];
    if (video && (video.size > 2 * 1024 * 1024 * 1024 || !["video/mp4", "video/webm"].includes(video.type))) {
      episodeMessage.textContent = "คลิปต้องเป็น MP4/WEBM และมีขนาดไม่เกิน 2 GB";
      return;
    }
    button.disabled = true;
    try {
      const lessonData = new FormData(episodeForm);
      lessonData.delete("video");
      if (video) lessonData.set("video_upload_pending", "1");
      episodeMessage.textContent = "กำลังบันทึกข้อมูล EP…";
      const response = await fetch(
        lessonId ? `/api/course-seller/${id}/lessons/${lessonId}` : `/api/course-seller/${id}/lessons`,
        { method: lessonId ? "PUT" : "POST", body: lessonData },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "บันทึกข้อมูล EP ไม่สำเร็จ");
      if (video) await uploadEpisodeVideo(data.id || lessonId, video, episodeForm.elements.video_quality.value);
      resetEpisodeForm(false);
      await loadEpisodes();
      episodeMessage.textContent = video ? "บันทึก EP และอัปโหลดวิดีโอสำเร็จ" : (data.message || "บันทึก EP แล้ว");
    } catch (error) {
      episodeMessage.textContent = `${error.message}${video ? " · ข้อมูล EP ถูกเก็บเป็นร่างแล้ว กดบันทึกใหม่เพื่ออัปโหลดซ้ำ" : ""}`;
    } finally {
      button.disabled = false;
    }
  };
  publishButton.onclick = async () => {
    if (publishButton.disabled || !item) return;
    if (!confirm("ส่งตะกร้าคอร์สนี้ให้ Boss ตรวจอนุมัติก่อนเปิดขายใช่ไหม? หลังมียอดขาย เนื้อหา EP จะถูกล็อก")) return;
    publishButton.disabled = true;
    publishMessage.textContent = "กำลังส่งเผยแพร่…";
    try {
      const response = await fetch(`/api/course-seller/${id}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ price_baht: Number(item.price) / 100, contact_info: item.contact_info, confirm_permanent: true }),
      });
      const data = await response.json().catch(() => ({}));
      publishMessage.textContent = data.error || data.message || (response.ok ? "ส่งเผยแพร่แล้ว" : "ส่งเผยแพร่ไม่สำเร็จ");
      if (data.payment_profile_required) return void (location.href = "/course-center#paymentProfilePanel");
      if (data.slip_api_required) return void (location.href = "/course-center#slipApiPanel");
      if (response.ok) {
        publishHelp.textContent = "ส่งแล้ว · กำลังรอ Boss ตรวจอนุมัติก่อนเปิดขาย";
        publishButton.textContent = "เผยแพร่แล้ว · รอตรวจสอบ";
        return;
      }
    } finally {
      if (publishButton.textContent !== "เผยแพร่แล้ว · รอตรวจสอบ") publishButton.disabled = false;
    }
  };
  function showCover(url) {
    editCoverPreview.querySelector("img").src =
      url || "/assets/product-placeholder.svg";
  }
  editCoverInput.onchange = () => {
    const file = editCoverInput.files?.[0];
    if (!file) return showCover(item?.cover_url);
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 8 * 1024 * 1024
    ) {
      editCoverInput.value = "";
      message.textContent = "รูปปกต้องเป็น JPG, PNG หรือ WEBP และไม่เกิน 8 MB";
      return;
    }
    if (coverObjectUrl) URL.revokeObjectURL(coverObjectUrl);
    coverObjectUrl = URL.createObjectURL(file);
    showCover(coverObjectUrl);
    message.textContent = "";
  };
  changeEditCover.onclick = () => editCoverInput.click();
  restoreEditCover.onclick = () => {
    if (coverObjectUrl) URL.revokeObjectURL(coverObjectUrl);
    coverObjectUrl = "";
    editCoverInput.value = "";
    showCover(item?.cover_url);
  };
  function lockContent() {
    const allowed = new Set(["price_baht", "contact_info"]);
    form.querySelectorAll("input,textarea,select").forEach((control) => {
      if (!allowed.has(control.name)) {
        if (control.matches('input[type="text"],input[type="number"],textarea'))
          control.readOnly = true;
        else control.disabled = true;
      }
    });
    message.textContent =
      "คอร์สนี้มียอดขายแล้ว เปลี่ยนแปลงเนื้อหาทั้งหมดไม่ได้ หากพบข้อผิดพลาดภายในให้ติดต่อ VisionD เท่านั้น แก้ได้เฉพาะราคาและช่องทางติดต่อซึ่งเป็นข้อมูลการขาย";
  }
  async function load() {
    const response = await fetch(`/api/course-seller/${id}`, {
        cache: "no-store",
      }),
      data = await response.json().catch(() => ({}));
    if (!response.ok) {
      message.textContent = data.error || "เปิดตะกร้าไม่สำเร็จ";
      return;
    }
    item = { ...data.item, content_locked: Boolean(data.content_locked) };
    showCover(item.cover_url);
    for (const [name, value] of Object.entries({
      title: item.title,
      teacher_name: item.teacher_name,
      short_description: item.short_description || "",
      description: item.description || "",
      price_baht: Number(item.price) / 100,
      learner_level: "all",
      contact_info: item.contact_info || "",
    }))
      form.elements[name].value = value;
    let tags = [];
    try {
      tags = JSON.parse(item.platform_tags || "[]");
    } catch {}
    form
      .querySelectorAll('[name="platform_tags"]')
      .forEach((input) => (input.checked = tags.includes(input.value)));
    const custom = tags.find((x) => !names.includes(x));
    if (custom) {
      form.querySelector('[value="อื่น ๆ"]').checked = true;
      form.elements.platform_other.value = custom;
    }
    editExpiry.textContent = item.edit_expires_at
      ? "แก้ไขฟรีได้ถึง " +
        new Date(item.edit_expires_at).toLocaleString("th-TH")
      : "แก้ไขได้ตลอดอายุระบบ";
    if (data.content_locked) lockContent();
    else if (!data.editable) {
      message.textContent = "หมดระยะเวลาแก้ไขแล้ว";
      form.querySelector("button").disabled = true;
    }
    await loadEpisodes();
  }
  form.onsubmit = async (event) => {
    event.preventDefault();
    const button = event.submitter;
    button.disabled = true;
    message.textContent = "กำลังบันทึก…";
    try {
      const response = await fetch(`/api/course-seller/${id}`, {
          method: "PUT",
          body: new FormData(form),
        }),
        data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      message.textContent = data.message + " · ข้อมูล EP อยู่ด้านล่าง";
      await load();
    } catch (error) {
      message.textContent = error.message;
      button.disabled = false;
    }
  };
  load();
})();
