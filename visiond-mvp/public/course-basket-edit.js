(() => {
  const id = Number(new URLSearchParams(location.search).get("id")),
    form = document.querySelector("#courseBasketEditForm"),
    message = document.querySelector("#courseBasketEditMessage"),
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
  let item,
    coverObjectUrl = "";
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
    item = data.item;
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
      message.textContent = data.message;
      setTimeout(() => (location.href = "/course-seller.html"), 700);
    } catch (error) {
      message.textContent = error.message;
      button.disabled = false;
    }
  };
  load();
})();
