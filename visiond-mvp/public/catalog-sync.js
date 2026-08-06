import("/facebook-chat.js?v=01195");
(() => {
  document.querySelectorAll('a[href="/cart.html"]').forEach((link) => link.setAttribute("href", "/cart"));
  document.querySelectorAll('a[href^="/digital-products.html"]').forEach((link) => link.setAttribute("href", link.getAttribute("href").replace("/digital-products.html", "/digital-products")));
  const grid = document.querySelector(".vd-grid");
  if (!grid) return;
  let productPointerStart = null;
  grid.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button !== 0) return;
      const productLink = event.target.closest('a[href*="/product.html?slug="]');
      productPointerStart = productLink
        ? { link: productLink, x: event.clientX, y: event.clientY }
        : null;
    },
    true,
  );
  grid.addEventListener(
    "pointerup",
    (event) => {
      const start = productPointerStart;
      productPointerStart = null;
      if (!start || event.button !== 0) return;
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const productLink = event.target.closest('a[href*="/product.html?slug="]');
      if (productLink !== start.link) return;
      if (Math.abs(event.clientX - start.x) > 12 || Math.abs(event.clientY - start.y) > 12)
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      location.assign(productLink.href);
    },
    true,
  );
  // Product links must always respond to a normal left click. Handle them in
  // the capture phase so slider/pointer state restored by Back cannot cancel
  // navigation. Modified clicks and right clicks keep native browser behavior.
  grid.addEventListener(
    "click",
    (event) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
        return;
      const productLink = event.target.closest('a[href*="/product.html?slug="]');
      if (!productLink || !grid.contains(productLink)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      location.assign(productLink.href);
    },
    true,
  );
  if (!grid.children.length) grid.innerHTML = '<div class="product-loading"><b>กำลังเปิดแคตตาล็อก…</b><p>กำลังโหลดรายการสินค้า กรุณารอสักครู่</p></div>';
  document.head.insertAdjacentHTML(
    "beforeend",
    "<style>.vd-card[hidden]{display:none!important}.vd-cover>a{display:block;width:100%;height:100%}.vd-cover img[hidden]{display:none!important}.vd-cover-slider{touch-action:pan-y;user-select:none}.vd-image-total{position:absolute;z-index:4;right:8px;bottom:8px;padding:7px 10px;border:2px solid rgba(255,255,255,.9);border-radius:999px;background:#087d77;color:#fff;box-shadow:0 5px 16px rgba(0,0,0,.24);font-size:12px;font-weight:900}.vd-cover-slider .vd-image-total{bottom:34px}.vd-cover-slider .vd-slide-prev,.vd-cover-slider .vd-slide-next{position:absolute;z-index:3;top:50%;transform:translateY(-50%);display:grid;place-items:center;width:30px;height:42px;border:0;background:rgba(7,63,61,.78);color:#fff;font-size:24px;cursor:pointer}.vd-cover-slider .vd-slide-prev{left:0;border-radius:0 8px 8px 0}.vd-cover-slider .vd-slide-next{right:0;border-radius:8px 0 0 8px}.vd-slide-count{position:absolute;z-index:3;left:50%;bottom:7px;transform:translateX(-50%);padding:4px 7px;border-radius:999px;background:rgba(7,63,61,.8);color:#fff;font-size:9px;font-weight:900}@media(pointer:coarse){.vd-cover-slider .vd-slide-prev,.vd-cover-slider .vd-slide-next{opacity:.82}}</style>",
  );
  const filters = document.createElement("div");
  filters.className = "catalog-category-filters";
  filters.innerHTML =
    '<button class="active" data-category="all" type="button">ทั้งหมด</button>';
  grid.before(filters);
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const money = (n) =>
    new Intl.NumberFormat("th-TH").format((Number(n) || 0) / 100) + " บาท";
  const imageCount = (product) => {
    const stored = Number(product.bundle_pages) || Number(product.pages) || 0;
    if (stored > 0) return Math.floor(stored);
    const text = `${product.title || ""} ${product.short_description || ""} ${product.description || ""}`;
    const match = text.match(/(\d{1,5})\s*(?:รูป|ภาพ|แผ่น|หน้า)/i);
    return match ? Number(match[1]) : 0;
  };
  const previewUrls = (product) => {
    let saved = [];
    try {
      saved = JSON.parse(product.preview_urls || "[]");
    } catch (error) {
      saved = [];
    }
    return [...new Set([product.cover_url, ...saved].filter(Boolean))].slice(
      0,
      30,
    );
  };
  const coverMarkup = (product) => {
    const images = previewUrls(product),
      hasSlider = images.length > 1,
      count = imageCount(product);
    return `<div class="vd-cover${hasSlider ? " vd-cover-slider" : ""}" data-catalog-slider="0"><span class="vd-tag">${esc(product.file_type || "DIGITAL")}</span><span class="vd-ready">พร้อมดาวน์โหลด</span><strong class="vd-image-total" aria-label="จำนวนรูปในชุด">${count ? new Intl.NumberFormat("th-TH").format(count) : "—"} รูป</strong><a href="/product.html?slug=${encodeURIComponent(product.slug)}">${images.map((url, index) => `<img loading="lazy" decoding="async" src="${esc(url)}" alt="${esc(product.title)} รูป ${index + 1}" data-slide="${index}" ${index ? "hidden" : ""}>`).join("")}</a>${hasSlider ? `<button class="vd-slide-prev" type="button" aria-label="รูปก่อนหน้า">‹</button><button class="vd-slide-next" type="button" aria-label="รูปถัดไป">›</button><small class="vd-slide-count">1/${images.length}</small>` : ""}</div>`;
  };
  const normalizeCart = (items) => {
    const unique = new Map();
    for (const item of Array.isArray(items) ? items : [])
      if (item?.slug && !unique.has(item.slug)) unique.set(item.slug, item);
    return [...unique.values()].slice(0, 30);
  };
  const getCart = () => {
    try {
      const saved = JSON.parse(localStorage.getItem("vd_cart") || "[]"),
        clean = normalizeCart(saved);
      if (clean.length !== (Array.isArray(saved) ? saved.length : 0))
        localStorage.setItem("vd_cart", JSON.stringify(clean));
      return clean;
    } catch {
      return [];
    }
  };
  const updateCartCount = () =>
    document
      .querySelectorAll("[data-cart-count]")
      .forEach((node) => (node.textContent = getCart().length));
  const discountRate = (count) =>
    count >= 30 ? 20 : count >= 20 ? 15 : count >= 10 ? 10 : count >= 5 ? 5 : 0;
  let bundlePanel = null,
    blockedSlugs = new Set();
  if (location.pathname.includes("digital-products")) {
    document.head.insertAdjacentHTML(
      "beforeend",
      "<style>.vd-bundle-layout{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:22px;align-items:start}.vd-bundle-cart{position:sticky;top:18px;border:2px solid #078b85;border-radius:16px;background:#f5fffe;padding:15px;color:#073f3d}.vd-bundle-cart h3{margin:0 0 5px}.vd-bundle-cart>p{margin:0 0 12px;font-size:11px;color:#547572}.vd-discount-levels{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-bottom:12px}.vd-discount-levels span{padding:6px 2px;border-radius:7px;background:#dcefed;text-align:center;font-size:9px;font-weight:800}.vd-discount-levels span.active{background:#078b85;color:#fff}.vd-bundle-items{display:grid;gap:5px;max-height:300px;overflow:auto}.vd-bundle-item{display:grid;grid-template-columns:36px 1fr auto;gap:7px;align-items:center;padding:5px;background:#fff;border:1px solid #d3e8e6;border-radius:8px}.vd-bundle-item img{width:36px;height:42px;object-fit:cover}.vd-bundle-item b{font-size:10px;line-height:1.25}.vd-bundle-item button{border:0;background:none;color:#b52f32;font-size:17px;cursor:pointer}.vd-bundle-empty{padding:18px 8px;text-align:center;color:#69827f;font-size:11px}.vd-bundle-summary{display:grid;gap:6px;margin-top:12px;padding-top:11px;border-top:1px solid #b9dcda}.vd-bundle-summary div{display:flex;justify-content:space-between}.vd-bundle-summary .discount{color:#078b85}.vd-bundle-summary strong{font-size:19px}.vd-bundle-cart>a{display:block;margin-top:11px;padding:10px;border-radius:9px;background:#078b85;color:#fff;text-align:center;font-weight:900}@media(max-width:980px){.vd-bundle-layout{display:block}.vd-bundle-cart{position:relative;top:auto;margin-top:18px}.vd-bundle-items{max-height:210px}}</style>",
    );
    const layout = document.createElement("div");
    layout.className = "vd-bundle-layout";
    grid.before(layout);
    layout.append(grid);
    bundlePanel = document.createElement("aside");
    bundlePanel.className = "vd-bundle-cart";
    layout.append(bundlePanel);
  }
  const catalogPager = document.createElement("nav");
  catalogPager.className = "catalog-pagination";
  catalogPager.setAttribute("aria-label", "หน้าแคตตาล็อก");
  (bundlePanel?.parentElement || grid).insertAdjacentElement("afterend", catalogPager);
  document.head.insertAdjacentHTML(
    "beforeend",
    '<style>.catalog-pagination{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin:28px 0 8px}.catalog-pagination a{display:grid;place-items:center;min-width:42px;height:42px;padding:0 11px;border:1px solid #8bc8c4;border-radius:10px;background:#fff;color:#08756f;font-weight:900}.catalog-pagination a.active{background:#08756f;color:#fff;border-color:#08756f}.catalog-pagination a:first-child{padding-inline:16px}</style>',
  );
  const renderBundlePanel = () => {
    if (!bundlePanel) return;
    const items = getCart(),
      count = items.length,
      subtotal = items.reduce((sum, item) => sum + Number(item.price || 0), 0),
      rate = discountRate(count),
      discount = Math.round((subtotal * rate) / 100),
      next =
        count < 5
          ? 5
          : count < 10
            ? 10
            : count < 20
              ? 20
              : count < 30
                ? 30
                : null;
    bundlePanel.innerHTML = `<h3>จัดชุดส่วนลด</h3><p>${next ? `เลือกอีก ${next - count} ตะกร้า เพื่อรับส่วนลด ${discountRate(next)}%` : "ครบ 30 ตะกร้า · รับส่วนลดสูงสุดแล้ว"}</p><div class="vd-discount-levels">${[5, 10, 20, 30].map((level) => `<span class="${count >= level ? "active" : ""}">${level} ชุด<br>ลด ${discountRate(level)}%</span>`).join("")}</div><div class="vd-bundle-items">${items.length ? items.map((item, index) => `<article class="vd-bundle-item"><img src="${esc(item.cover_url || "/assets/product-placeholder.svg")}" alt=""><b>${esc(item.title)}</b><button type="button" data-bundle-remove="${index}" aria-label="นำออก">×</button></article>`).join("") : '<div class="vd-bundle-empty">ยังไม่ได้เลือกสินค้า<br>เลือกได้สูงสุด 30 ตะกร้า</div>'}</div><div class="vd-bundle-summary"><div><span>${count} ตะกร้า</span><b>${money(subtotal)}</b></div><div class="discount"><span>ส่วนลด ${rate}%</span><b>- ${money(discount)}</b></div><div><strong>ยอดสุทธิ</strong><strong>${money(subtotal - discount)}</strong></div></div><a href="/cart.html">ดูตะกร้าและชำระเงิน</a>`;
    bundlePanel.querySelector('a[href="/cart.html"]')?.setAttribute("href", "/cart");
    bundlePanel.querySelectorAll("[data-bundle-remove]").forEach(
      (button) =>
        (button.onclick = () => {
          const cart = getCart();
          cart.splice(Number(button.dataset.bundleRemove), 1);
          localStorage.setItem("vd_cart", JSON.stringify(cart));
          renderBundlePanel();
          updateCartCount();
          syncCartButtons();
        }),
    );
  };
  const syncCartButtons = () =>
    grid
      .querySelectorAll("[data-add-cart]")
      .forEach(
        (button) =>
          (button.textContent = getCart().some(
            (item) => item.slug === button.dataset.addCart,
          )
            ? "อยู่ในรถเข็นแล้ว"
            : "ใส่รถเข็น"),
      );
  updateCartCount();
  renderBundlePanel();
  Promise.all([
    fetch("/api/products").then((r) => (r.ok ? r.json() : Promise.reject())),
    fetch("/api/categories").then((r) => (r.ok ? r.json() : { items: [] })),
    fetch("/api/orders", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .catch(() => ({ items: [] })),
  ])
    .then(([data, categoryData, orderData]) => {
      grid.querySelector(".product-loading")?.remove();
      const products = [...(data.items || [])].sort((a, b) => {
          const tattooRank = (item) =>
            /tattoo|รอยสัก|แบบสัก/.test(
              `${item.category || ""} ${item.category_label || ""} ${item.title || ""}`.toLowerCase(),
            )
              ? 0
              : 1;
          return tattooRank(a) - tattooRank(b) || Number(b.id) - Number(a.id);
        }),
        bySlug = new Map(products.map((p) => [p.slug, p])),
        categoryMap = new Map(
          (categoryData.items || []).map((category) => [
            category.slug,
            category,
          ]),
        ),
        catalogGroup = (productOrSlug) => {
          const product =
              typeof productOrSlug === "object" ? productOrSlug : null,
            slug = String(product?.category || productOrSlug || "").toLowerCase(),
            rootGroup = (value) => {
              const text = String(value || "").toLowerCase();
              if (/tattoo|รอยสัก|แบบสัก/.test(text)) return "tattoo";
              if (/coloring|ระบายสี/.test(text)) return "coloring";
              if (/worksheet|แบบฝึก|ฝึกหัด/.test(text)) return "worksheet";
              return "";
            };
          let current = categoryMap.get(slug),
            guard = 0,
            matched = rootGroup(slug) || rootGroup(current?.name);
          while (!matched && current?.parent_slug && guard++ < 10) {
            matched = rootGroup(current.parent_slug);
            current = categoryMap.get(current.parent_slug);
            matched ||= rootGroup(current?.slug) || rootGroup(current?.name);
          }
          if (matched) return matched;
          return (
            rootGroup(product?.category_label) ||
            rootGroup(product?.title) ||
            "worksheet"
          );
        };
      [...grid.querySelectorAll(".vd-card")].forEach((card) => {
        const link = card.querySelector('a[href*="slug="]');
        const slug =
            link &&
            new URL(link.href, location.origin).searchParams.get("slug"),
          product = bySlug.get(slug);
        card.dataset.category = catalogGroup(product || "worksheet");
        if (product) {
          const oldCover = card.querySelector(".vd-cover");
          if (oldCover) oldCover.outerHTML = coverMarkup(product);
        }
      });
      const existing = new Set(
        [...grid.querySelectorAll('a[href*="slug="]')].map((a) =>
          new URL(a.href, location.origin).searchParams.get("slug"),
        ),
      );
      grid.insertAdjacentHTML(
        "beforeend",
        products
          .filter((p) => !existing.has(p.slug))
          .map(
            (p) =>
              `<article class="vd-card" data-category="${esc(catalogGroup(p))}">${coverMarkup(p)}<div class="vd-info"><small>VD-${String(p.id).padStart(3, "0")} · ผู้เข้าชม ${new Intl.NumberFormat("th-TH").format(Number(p.view_count) || 0)} ครั้ง</small><h2><a href="/product.html?slug=${encodeURIComponent(p.slug)}">${esc(p.title)}</a></h2><div class="vd-bottom"><b>${money(p.price)}</b><div class="vd-card-actions"><button type="button" data-add-cart="${esc(p.slug)}">ใส่รถเข็น</button><a href="/product.html?slug=${encodeURIComponent(p.slug)}">ดูสินค้า</a></div></div></div></article>`,
          )
          .join(""),
      );
      grid.querySelectorAll(".vd-cover-slider").forEach((slider) => {
        const slides = [...slider.querySelectorAll("[data-slide]")],
          counter = slider.querySelector(".vd-slide-count"),
          link = slider.querySelector("a"),
          show = (next) => {
            const index = (next + slides.length) % slides.length;
            slider.dataset.catalogSlider = index;
            slides.forEach((image, i) => (image.hidden = i !== index));
            counter.textContent = `${index + 1}/${slides.length}`;
          };
        let startX = 0,
          startY = 0,
          dragging = false,
          didSwipe = false;
        slider.querySelector(".vd-slide-prev").onclick = (event) => {
          event.preventDefault();
          event.stopPropagation();
          show(Number(slider.dataset.catalogSlider) - 1);
        };
        slider.querySelector(".vd-slide-next").onclick = (event) => {
          event.preventDefault();
          event.stopPropagation();
          show(Number(slider.dataset.catalogSlider) + 1);
        };
        slider.addEventListener("pointerdown", (event) => {
          if (event.target.closest("button")) return;
          startX = event.clientX;
          startY = event.clientY;
          dragging = true;
          didSwipe = false;
          slider.setPointerCapture?.(event.pointerId);
        });
        slider.addEventListener("pointerup", (event) => {
          if (!dragging) return;
          dragging = false;
          const dx = event.clientX - startX,
            dy = event.clientY - startY;
          if (Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy)) {
            didSwipe = true;
            show(Number(slider.dataset.catalogSlider) + (dx < 0 ? 1 : -1));
            event.preventDefault();
            event.stopPropagation();
          }
        });
        slider.addEventListener("pointercancel", () => {
          dragging = false;
        });
        link.addEventListener("click", (event) => {
          if (didSwipe) {
            event.preventDefault();
            event.stopPropagation();
            didSwipe = false;
            return;
          }
          event.preventDefault();
          location.assign(link.href);
        });
      });
      grid.querySelectorAll("[data-add-cart]").forEach((button) => {
        const slug = button.dataset.addCart;
        if (getCart().some((item) => item.slug === slug))
          button.textContent = "อยู่ในรถเข็นแล้ว";
        button.onclick = () => {
          const cart = getCart(),
            product = bySlug.get(slug);
          if (!product) return;
          if (blockedSlugs.has(slug))
            return alert("สินค้านี้ซื้อแล้วหรือมีคำสั่งซื้ออยู่ จึงเพิ่มซ้ำไม่ได้");
          if (cart.some((item) => item.slug === slug))
            return alert("สินค้าดิจิทัลแต่ละตะกร้าเพิ่มได้เพียง 1 ชิ้น");
          if (cart.length >= 30) return alert("เลือกสินค้าได้สูงสุด 30 ตะกร้า");
          cart.push({
            id: product.id,
            slug: product.slug,
            title: product.title,
            price: product.price,
            cover_url: product.cover_url,
            category: product.category,
            category_label: product.category_label,
          });
          window.visiondPixel?.track("AddToCart", {
            content_ids: [String(product.id || product.slug)],
            content_name: product.title,
            content_type: "product",
            value: Number(product.price || 0) / 100,
            currency: "THB",
          });
          localStorage.setItem("vd_cart", JSON.stringify(cart));
          button.textContent = "อยู่ในรถเข็นแล้ว";
          updateCartCount();
          renderBundlePanel();
        };
      });
      const purchaseBySlug = new Map();
      (orderData.items || []).forEach((order) =>
        (order.items || []).forEach((item) => {
          const current = purchaseBySlug.get(item.slug),
            rank = {
              paid: 4,
              pending_review: 3,
              awaiting_payment: 2,
              rejected: 1,
            };
          if (
            !current ||
            (rank[order.status] || 0) > (rank[current.status] || 0)
          )
            purchaseBySlug.set(item.slug, order);
        }),
      );
      grid.querySelectorAll(".vd-card").forEach((card) => {
        const link = card.querySelector('a[href*="slug="]');
        if (!link) return;
        const slug = new URL(link.href, location.origin).searchParams.get(
            "slug",
          ),
          order = purchaseBySlug.get(slug);
        if (!order) return;
        const ready = card.querySelector(".vd-ready"),
          action = card.querySelector(".vd-bottom a"),
          cartButton = card.querySelector("[data-add-cart]");
        if (cartButton) cartButton.hidden = true;
        card.classList.add("customer-purchased", `purchase-${order.status}`);
        if (order.status === "paid") {
          if (ready) ready.textContent = "ซื้อแล้ว · พร้อมดาวน์โหลด";
          if (action) {
            action.textContent = "เปิดไฟล์";
            action.href = "/product.html?slug=" + encodeURIComponent(slug);
          }
        } else if (order.status === "pending_review") {
          if (ready) ready.textContent = "ซื้อแล้ว · รอตรวจสลิป";
          if (action) {
            action.textContent = "ดูสถานะ";
            action.href = "/dashboard.html#orders";
          }
        } else if (order.status === "awaiting_payment") {
          if (ready) ready.textContent = "มีคำสั่งซื้อแล้ว · รอชำระเงิน";
          if (action) {
            action.textContent = "ชำระเงิน/ส่งสลิป";
            action.href = "/dashboard.html#orders";
          }
        } else if (order.status === "rejected") {
          if (ready) ready.textContent = "สลิปไม่ผ่าน · ส่งใหม่";
          if (action) {
            action.textContent = "ส่งสลิปใหม่";
            action.href = "/dashboard.html#orders";
          }
        }
      });
      blockedSlugs = new Set(
        [...purchaseBySlug.entries()]
          .filter(([, order]) =>
            ["paid", "pending_review", "awaiting_payment"].includes(order.status),
          )
          .map(([slug]) => slug),
      );
      const currentCart = getCart(),
        availableCart = currentCart.filter((item) => !blockedSlugs.has(item.slug));
      if (availableCart.length !== currentCart.length) {
        localStorage.setItem("vd_cart", JSON.stringify(availableCart));
        updateCartCount();
        renderBundlePanel();
        syncCartButtons();
      }
      const categoryCounts = [...grid.querySelectorAll(".vd-card")].reduce(
        (counts, card) => {
          counts.all += 1;
          if (counts[card.dataset.category] !== undefined)
            counts[card.dataset.category] += 1;
          return counts;
        },
        { all: 0, worksheet: 0, coloring: 0, tattoo: 0 },
      );
      const requestedCategory = new URLSearchParams(location.search).get("category"),
        initialCategory = ["all", "tattoo", "coloring", "worksheet"].includes(requestedCategory)
          ? requestedCategory
          : "all";
      filters.innerHTML = `<button data-category="all" type="button">ทั้งหมด ${categoryCounts.all}</button><button data-category="tattoo" type="button">แบบรอยสัก ${categoryCounts.tattoo}</button><button data-category="coloring" type="button">ระบายสี ${categoryCounts.coloring}</button><button data-category="worksheet" type="button">แบบฝึกหัด ${categoryCounts.worksheet}</button>`;
      const pageSize = 8,
        requestedPage = location.pathname === "/" ? 1 : Number(new URLSearchParams(location.search).get("page")) || 2;
      const applyCategory = (category) => {
        const matchingCards = [...grid.querySelectorAll(".vd-card")].filter(
            (card) => category === "all" || card.dataset.category === category,
          ),
          totalPages = Math.max(1, Math.min(5, Math.ceil(matchingCards.length / pageSize))),
          currentPage = Math.max(1, Math.min(totalPages, requestedPage)),
          start = (currentPage - 1) * pageSize,
          visibleCards = new Set(matchingCards.slice(start, start + pageSize));
        filters
          .querySelectorAll("button")
          .forEach((button) => button.classList.toggle("active", button.dataset.category === category));
        grid
          .querySelectorAll(".vd-card")
          .forEach((card) => (card.hidden = !visibleCards.has(card)));
        const categoryQuery = category === "all" ? "" : `&category=${encodeURIComponent(category)}`;
        catalogPager.innerHTML = Array.from({ length: totalPages }, (_, index) => index + 1)
          .map((page) => `<a class="${page === currentPage ? "active" : ""}" href="${page === 1 ? "/" : `/digital-products?page=${page}${categoryQuery}`}" aria-label="แคตตาล็อกหน้า ${page}">${page === 1 ? "หน้าแรก · 1" : page}</a>`)
          .join("");
      };
      filters.querySelectorAll("button").forEach(
        (button) =>
          (button.onclick = () => {
            applyCategory(button.dataset.category);
          }),
      );
      applyCategory(initialCategory);
    })
    .catch(() => {
      grid.innerHTML = '<div class="product-loading"><b>โหลดแคตตาล็อกไม่สำเร็จ</b><p>การเชื่อมต่อใช้เวลานาน กรุณากดลองใหม่</p><button type="button" onclick="location.reload()">ลองโหลดอีกครั้ง</button></div>';
    });
})();
import("/nav-account.js?v=01176").then((module) => module.initAccountNav());
