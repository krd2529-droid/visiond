(function (global) {
  const safeText = (value, limit = 120) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, limit);
  const money = (amount, currency) => new Intl.NumberFormat("th-TH", { style: "currency", currency: safeText(currency, 3) || "THB", maximumFractionDigits: 2 }).format(Number(amount) || 0);
  function drawCommissionCard(model) {
    const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
    canvas.width = 1080; canvas.height = 1350;
    const gradient = ctx.createLinearGradient(0, 0, 1080, 1350);
    gradient.addColorStop(0, "#073f3b"); gradient.addColorStop(1, "#0aa89f");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.beginPath(); ctx.arc(930, 180, 270, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "700 46px sans-serif"; ctx.fillText("VisionD · สรุปค่าคอม", 80, 120);
    ctx.font = "700 58px sans-serif"; ctx.fillText(safeText(model.owner || "ช่องของฉัน", 34), 80, 235);
    ctx.font = "400 34px sans-serif"; ctx.fillStyle = "#dffcf8"; ctx.fillText(safeText(model.range || "", 40), 80, 300);
    ctx.fillStyle = "#fff"; ctx.font = "700 112px sans-serif"; ctx.fillText(money(model.total, model.currency), 80, 500);
    ctx.font = "500 34px sans-serif"; ctx.fillStyle = "#dffcf8"; ctx.fillText("ค่าคอมจากข้อมูล TikTok Shop ในช่วงที่เลือก", 80, 565);
    const channels = Array.isArray(model.channels) ? model.channels.slice(0, 6) : [];
    ctx.font = "700 38px sans-serif"; ctx.fillStyle = "#fff"; ctx.fillText("แยกตามช่อง", 80, 680);
    channels.forEach((item, index) => {
      const y = 755 + index * 74;
      ctx.font = "500 31px sans-serif"; ctx.fillStyle = "#fff"; ctx.fillText(safeText(item.channel, 28), 80, y);
      ctx.textAlign = "right"; ctx.font = "700 31px sans-serif"; ctx.fillText(money(item.amount, model.currency), 1000, y); ctx.textAlign = "left";
    });
    if (model.referralUrl) {
      ctx.fillStyle = "rgba(255,255,255,.14)"; ctx.fillRect(60, 1180, 960, 100);
      ctx.font = "500 27px sans-serif"; ctx.fillStyle = "#fff"; ctx.fillText(safeText(model.referralUrl, 68), 85, 1243);
    }
    ctx.font = "400 24px sans-serif"; ctx.fillStyle = "#dffcf8"; ctx.fillText("ยอดอาจเปลี่ยนตามการคืนสินค้าและการยืนยันของ TikTok", 80, 1320);
    return canvas;
  }
  async function shareCommissionCard(model) {
    const canvas = drawCommissionCard(model), blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("สร้างรูปไม่สำเร็จ");
    const file = new File([blob], `visiond-commission-${Date.now()}.png`, { type: "image/png" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: "สรุปค่าคอม VisionD", text: model.referralUrl || "", files: [file] });
      return "shared";
    }
    const link = document.createElement("a"); link.download = file.name; link.href = URL.createObjectURL(blob); link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    return "downloaded";
  }
  global.VisionDCommissionCard = { drawCommissionCard, shareCommissionCard };
})(window);
