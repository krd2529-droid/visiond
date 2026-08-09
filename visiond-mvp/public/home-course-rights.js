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
      const originalPrice = document.getElementById("courseOwnerOriginalPrice");
      const cover = document.getElementById("courseOwnerCover");
      if (price) price.textContent = formatPrice(product.sale_price ?? product.price);
      if (originalPrice) originalPrice.textContent = formatPrice(product.original_price ?? 99900);
      if (cover && product.cover_url) cover.src = product.cover_url;
      const addButton = document.getElementById("courseOwnerAddCart");
      const getCart = () => { try { return JSON.parse(localStorage.getItem("vd_cart") || "[]"); } catch { return []; } };
      const syncButton = () => { if (addButton) addButton.textContent = getCart().some((item) => item.slug === slug) ? "อยู่ในรถเข็นแล้ว ✓" : "ใส่รถเข็น"; };
      if (addButton) addButton.onclick = () => {
        const cart = getCart();
        if (cart.some((item) => item.slug === slug)) { syncButton(); return; }
        if (cart.length >= 30) { alert("เลือกสินค้าได้สูงสุด 30 ตะกร้า"); return; }
        cart.push({id:product.id,slug:product.slug,title:product.title,price:Number(product.sale_price ?? product.price),original_price:Number(product.original_price ?? 99900),promotion_percent:50,standalone_promotion:true,cover_url:product.cover_url,category:"resale-rights",category_label:"สิทธิ์ลงขายคอร์สออนไลน์"});
        localStorage.setItem("vd_cart", JSON.stringify(cart));
        document.querySelectorAll("[data-cart-count]").forEach((node) => node.textContent = cart.length);
        window.visiondPixel?.track("AddToCart", {content_ids:[String(product.id || slug)],content_name:product.title,content_type:"product",value:Number(product.sale_price ?? product.price ?? 0)/100,currency:"THB"});
        syncButton();
      };
      syncButton();
    })
    .catch(() => {});
})();
