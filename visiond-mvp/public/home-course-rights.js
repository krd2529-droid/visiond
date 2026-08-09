(() => {
  const slug = "course-selling-rights-30-days";
  const formatPrice = (satang) =>
    `${new Intl.NumberFormat("th-TH").format((Number(satang) || 0) / 100)} บาท`;
  fetch("/api/products", { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : Promise.reject()))
    .then((data) => {
      const product = (data.items || []).find((item) => item.slug === slug);
      if (!product) return;
      const price = document.getElementById("courseOwnerPrice");
      const cover = document.getElementById("courseOwnerCover");
      if (price) price.textContent = formatPrice(product.sale_price ?? product.price);
      if (cover && product.cover_url) cover.src = product.cover_url;
    })
    .catch(() => {});
})();
