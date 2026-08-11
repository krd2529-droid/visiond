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
    if (show) episodeForm.elements.title.focus();
  }

  function renderEpisodes() {
    episodeList.innerHTML = episodes.length
      ? episodes.map((episode, index) => `<article class="seller-ep"><div class="seller-ep-number">${index + 1}</div><div><b>EP.${index + 1} · ${esc(episode.title)}</b><small>${episode.has_video ? "มีวิดีโอ" : ""}${episode.has_video && episode.file_count ? " · " : ""}${episode.file_count ? `ไฟล์ประกอบ ${episode.file_count} ไฟล์` : ""}${!episode.has_video && !episode.file_count ? "ยังไม่มีสื่อ" : ""}</small>${episode.description ? `<p>${esc(episode.description)}</p>` : ""}<div class="seller-file-list">${(episode.files || []).map((file) => `<span>${esc(file.file_name)} <button type="button" data-delete-file="${file.id}" data-lesson="${episode.id}" ${episodesEditable ? "" : "disabled"}>ลบไฟล์</button></span>`).join("")}</div></div><div class="seller-ep-actions"><button type="button" data-edit-episode="${episode.id}" ${episodesEditable ? "" : "disabled"}>แก้ไข EP</button><button type="button" data-delete-episode="${episode.id}" ${episodesEditable ? "" : "disabled"}>ลบ EP</button></div></article>`).join("")
      : '<div class="seller-course-empty"><b>ยังไม่มี EP</b><p>กด “+ สร้าง EP เพิ่ม” เพื่อสร้างบทเรียนแรก</p></div>';
    episodeList.querySelectorAll("[data-edit-episode]").forEach((button) => button.onclick = () => {
      const episode = episodes.find((entry) => String(entry.id) === button.dataset.editEpisode);
      if (!episode) return;
      episodeForm.hidden = false;
      episodeTitle.textContent = `แก้ไข EP.${episodes.indexOf(episode) + 1}`;
      episodeForm.elements.lesson_id.value = episode.id;
      episodeForm.elements.title.value = episode.title || "";
      episodeForm.elements.description.value = episode.description || "";
      episodeForm.elements.duration_seconds.value = Number(episode.duration_seconds) || 0;
      episodeForm.querySelector('button[type="submit"]').textContent = "บันทึกการแก้ไข EP";
      episodeForm.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    episodeList.querySelectorAll("[data-delete-episode]").forEach((button) => button.onclick = async () => {
      if (!confirm("ลบ EP และไฟล์ทั้งหมดใช่ไหม")) return;
      await episodeAction(`/api/course-seller/${id}/lessons/${button.dataset.deleteEpisode}`, { method: "DELETE" });
    });
    episodeList.querySelectorAll("[data-delete-file]").forEach((button) => button.onclick = async () => {
      if (!confirm("ลบไฟล์ประกอบนี้ใช่ไหม")) return;
      await episodeAction(`/api/course-seller/${id}/lessons/${button.dataset.lesson}/files/${button.dataset.deleteFile}`, { method: "DELETE" });
    });
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

  addEpisode.onclick = () => {
    if (!episodesEditable) return;
    resetEpisodeForm(true);
    episodeForm.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  cancelEpisode.onclick = () => resetEpisodeForm(false);
  episodeForm.onsubmit = async (event) => {
    event.preventDefault();
    const button = event.submitter, lessonId = episodeForm.elements.lesson_id.value;
    button.disabled = true;
    try {
      await episodeAction(
        lessonId ? `/api/course-seller/${id}/lessons/${lessonId}` : `/api/course-seller/${id}/lessons`,
        { method: lessonId ? "PUT" : "POST", body: new FormData(episodeForm) },
      );
    } finally {
      button.disabled = false;
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
      file.size > 5 * 1024 * 1024
    ) {
      editCoverInput.value = "";
      message.textContent = "รูปปกต้องเป็น JPG, PNG หรือ WEBP และไม่เกิน 5 MB";
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
