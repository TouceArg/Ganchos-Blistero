// Cat├ílogo inicial local. Ser├í reemplazado por datos desde la API/Sheet.
let products = [
  {
    id: "hook-pro",
    name: "Hook Pro 12cm",
    price: 5900,
    size: "12 cm",
    badge: "Top seller",
    description: "Gancho blistero galvanizado para retail y exhibidores de alto tr├ífico.",
    imageLabel: "PRO",
    colors: [
      { name: "Negro", hex: "#121212" },
      { name: "Blanco", hex: "#f7f7f9" },
      { name: "Rojo", hex: "#ef2b2d" }
    ],
    images: ["Vista frontal", "Vista lateral", "Detalle de punta"]
  },
  {
    id: "hook-heavy",
    name: "Hook Heavy Duty",
    price: 7900,
    size: "12 cm",
    badge: "Nueva l├¡nea",
    description: "Acero reforzado con punta de seguridad. Ideal para cargas pesadas.",
    imageLabel: "HD",
    colors: [
      { name: "Negro", hex: "#0d0d0f" },
      { name: "Rojo", hex: "#d82027" }
    ],
    images: ["Vista frontal", "Vista trasera", "Detalle refuerzo"]
  },
  {
    id: "hook-dual",
    name: "Hook Dual Lock",
    price: 6800,
    size: "8 cm",
    badge: "Seguro",
    description: "Doble anclaje anti-retail loss. Compatible con panel ranurado y grid.",
    imageLabel: "DUAL",
    colors: [
      { name: "Negro", hex: "#1b1b21" },
      { name: "Blanco", hex: "#ffffff" }
    ],
    images: ["Frente", "Lateral", "Cierre dual"]
  },
  {
    id: "kit-50",
    name: "Kit 50 unidades",
    price: 32900,
    size: "12 cm",
    badge: "Bundle",
    description: "Pack optimizado para tiendas completas con ahorro por volumen.",
    imageLabel: "KIT",
    colors: [
      { name: "Negro", hex: "#121212" },
      { name: "Rojo", hex: "#ef2b2d" }
    ],
    images: ["Pack completo", "Detalle blister", "Aplicaci├│n en g├│ndola"]
  },
  {
    id: "display-led",
    name: "Display LED Rack",
    price: 45900,
    size: "8 cm",
    badge: "Premium",
    description: "Rack con iluminaci├│n integrada y passthrough de cables oculto.",
    imageLabel: "LED",
    colors: [
      { name: "Negro", hex: "#0e0e12" },
      { name: "Blanco", hex: "#f7f7f9" }
    ],
    images: ["Vista frontal", "Back panel", "Detalle iluminaci├│n"]
  },
  {
    id: "gancho-mini",
    name: "Hook Mini 7cm",
    price: 4200,
    size: "8 cm",
    badge: "Compacto",
    description: "Para accesorios livianos y exhibidores en mostrador.",
    imageLabel: "MINI",
    colors: [
      { name: "Negro", hex: "#111111" },
      { name: "Rojo", hex: "#e03232" },
      { name: "Blanco", hex: "#f0f0f5" }
    ],
    images: ["Mini frontal", "Mini lateral", "Mini detalle"]
  }
];
let combos = [
  { id: "combo-8-50", name: "Combo 50 ganchos 8cm", price: 180000, size: "8 cm", badge: "Combo", description: "Pack de 50 ganchos blistero de 8cm listo para PDV.", imageLabel: "50x 8cm", colors: [{ name: "Negro", hex: "#111" }, { name: "Rojo", hex: "#e03232" }], images: ["Combo 50", "Detalle color", "Aplicaci├│n"] },
  { id: "combo-8-100", name: "Combo 100 ganchos 8cm", price: 340000, size: "8 cm", badge: "Combo", description: "Pack de 100 ganchos blistero de 8cm con ahorro extra.", imageLabel: "100x 8cm", colors: [{ name: "Negro", hex: "#111" }, { name: "Rojo", hex: "#e03232" }], images: ["Combo 100", "Detalle color", "Aplicaci├│n"] },
  { id: "combo-8-200", name: "Combo 200 ganchos 8cm", price: 650000, size: "8 cm", badge: "Combo", description: "Pack de 200 ganchos blistero de 8cm para grandes vol├║menes.", imageLabel: "200x 8cm", colors: [{ name: "Negro", hex: "#111" }, { name: "Rojo", hex: "#e03232" }], images: ["Combo 200", "Detalle color", "Aplicaci├│n"] },
  { id: "combo-12-50", name: "Combo 50 ganchos 12cm", price: 210000, size: "12 cm", badge: "Combo", description: "Pack de 50 ganchos blistero de 12cm para reposici├│n r├ípida.", imageLabel: "50x 12cm", colors: [{ name: "Negro", hex: "#121212" }, { name: "Rojo", hex: "#ef2b2d" }], images: ["Combo 50", "Detalle color", "Aplicaci├│n"] },
  { id: "combo-12-100", name: "Combo 100 ganchos 12cm", price: 380000, size: "12 cm", badge: "Combo", description: "Pack de 100 ganchos blistero de 12cm con mejor precio por unidad.", imageLabel: "100x 12cm", colors: [{ name: "Negro", hex: "#121212" }, { name: "Rojo", hex: "#ef2b2d" }], images: ["Combo 100", "Detalle color", "Aplicaci├│n"] },
  { id: "combo-12-200", name: "Combo 200 ganchos 12cm", price: 720000, size: "12 cm", badge: "Combo", description: "Pack de 200 ganchos blistero de 12cm para proyectos grandes.", imageLabel: "200x 12cm", colors: [{ name: "Negro", hex: "#121212" }, { name: "Rojo", hex: "#ef2b2d" }], images: ["Combo 200", "Detalle color", "Aplicaci├│n"] }
];

const cart = JSON.parse(localStorage.getItem("gb-cart") || "{}");
let activeFilter = "all";
let modalColorIndex = 0;
let modalImageIndex = 0;
let searchTerm = "";

const catalogGrid = document.getElementById("catalogGrid");
const featuredGrid = document.getElementById("featuredGrid");
const combosGrid = document.getElementById("combosGrid");
const cartList = document.getElementById("cartList");
const cartCount = document.getElementById("cartCount");
const subtotalText = document.getElementById("subtotalText");
const shippingText = document.getElementById("shippingText");
const totalText = document.getElementById("totalText");
const checkoutBtn = document.getElementById("checkoutBtn");
const finalizeBtn = document.getElementById("finalizeBtn");
const cartDrawer = document.getElementById("cartDrawer");
const checkoutSummary = document.getElementById("checkoutSummary");
const checkoutTotals = document.getElementById("checkoutTotals");
const checkoutPageBtn = document.getElementById("checkoutPageBtn");
const continueBtn = document.getElementById("continueBtn");
const filterBar = document.getElementById("filterBar");
const filterToggle = document.getElementById("filterToggle");
const catalogSidebar = document.getElementById("catalogSidebar");
const productModal = document.getElementById("productModal");
const modalContent = document.getElementById("modalContent");
const modalOverlay = document.getElementById("modalOverlay");
const emailInput = document.getElementById("email");
const paisSelect = document.getElementById("pais");
const cpInput = document.getElementById("cp");
let currentStep = 1;
const navToggle = document.getElementById("navToggle");
const navElement = document.querySelector(".nav");
const searchInput = document.getElementById("searchInput");
const API_URL = "https://ganchos-blistero-production.up.railway.app/api/catalogo";
const API_FALLBACK = null;
const CONTACT_URL = "https://ganchos-blistero-production.up.railway.app/api/contacto";
const ORDER_URL = "https://ganchos-blistero-production.up.railway.app/api/orders";
const PAY_URL = "https://ganchos-blistero-production.up.railway.app/api/pago/create";
const nombreInput = document.getElementById("nombre");
const telInput = document.getElementById("tel");
const calleInput = document.getElementById("calle");
const numeroInput = document.getElementById("numero");
const pisoInput = document.getElementById("piso");
const ciudadInput = document.getElementById("ciudad");
const provinciaInput = document.getElementById("provincia");
const stepBlocks = document.querySelectorAll(".step-block");
const loaderOverlay = document.getElementById("loaderOverlay");
const brandEl = document.querySelector(".brand");
const pickupToggle = document.getElementById("pickupToggle");
let isLoadingCatalog = true;

function formatCurrency(value) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

function getShipping(subtotal) {
  // Envío desactivado: siempre $0
  return 0;
}

function normalizeImageUrl(url) {
  if (!url) return "";
  const driveMatch = url.match(/https?:\/\/drive\.google\.com\/file\/d\/([^/]+)/);
  if (driveMatch) {
    return `https://drive.google.com/uc?export=view&id=${driveMatch[1]}`;
  }
  return url.trim();
}

function normalizeImages(arr) {
  const out = [];
  const buildDrive = (id) => `https://drive.google.com/uc?export=view&id=${id}`;
  (arr || []).forEach(img => {
    if (!img) return;
    const raw = String(img);
    // Si viene como string con array adentro
    if (raw.trim().startsWith("[")) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach(p => out.push(normalizeImageUrl(String(p))));
          return;
        }
      } catch (_) {}
    }
    // Si incluye http en el string, extraemos el primer match
    const match = raw.match(/https?:\/\/[^\s'"]+/);
    if (match) {
      out.push(normalizeImageUrl(match[0]));
    } else {
      // Si solo llega un ID de Drive, lo convertimos
      if (/^[A-Za-z0-9_-]{20,}$/.test(raw.trim())) {
        out.push(buildDrive(raw.trim()));
      } else {
        out.push(normalizeImageUrl(raw));
      }
    }
  });
  return out.filter(Boolean);
}

function renderCatalog() {
  if (!catalogGrid) return;
  if (isLoadingCatalog) {
    catalogGrid.innerHTML = renderSkeleton(6);
    return;
  }
  const filtered = products.filter(p => {
    const sizeMatch = activeFilter === "all" ? true : p.size === activeFilter;
    const text = (p.name + " " + p.description).toLowerCase();
    const term = searchTerm.toLowerCase();
    const searchMatch = term ? text.includes(term) : true;
    return sizeMatch && searchMatch;
  });
  catalogGrid.innerHTML = filtered.map(p => `
    <article class="card" data-view="${p.id}">
      <div class="card__tag">${p.badge}</div>
      <div class="card__image" data-view="${p.id}">
        ${p.images?.[0] && /^https?:\/\//.test(p.images[0])
          ? `<img src="${p.images[0]}" alt="${p.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">`
          : `<span class="card__label">${p.imageLabel || (p.name?.charAt(0) || "G")}</span>`}
        <span class="card__pill">${p.size}</span>
      </div>
      <h3 class="card__title">${p.name}</h3>
      <p class="card__desc">${p.description}</p>
      <div class="swatches">
        ${p.colors.map(c => `<span class="swatch" style="background:${c.hex}" title="${c.name}"></span>`).join("")}
      </div>
      <div class="card__footer">
        <div class="card__price">${formatCurrency(p.price)} <small>+ IVA</small></div>
        <button class="minimal-btn" data-action="view" data-id="${p.id}">Ver</button>
      </div>
    </article>
  `).join("");
  catalogGrid.querySelectorAll("button[data-action='view']").forEach(btn => {
    btn.addEventListener("click", () => openProductModal(btn.dataset.id));
  });
  catalogGrid.querySelectorAll("[data-view]").forEach(el => {
    el.addEventListener("click", (e) => {
      if (e.target.closest("button[data-action='view']")) return;
      openProductModal(el.dataset.view);
    });
  });
}

function renderFeatured() {
  if (!featuredGrid) return;
  if (isLoadingCatalog) {
    featuredGrid.innerHTML = renderSkeleton(3);
    return;
  }
  const featured = products.slice(0, 3);
  featuredGrid.innerHTML = featured.map(p => `
    <article class="card" data-view="${p.id}">
      <div class="card__tag">${p.badge}</div>
      <div class="card__image" data-view="${p.id}">
        ${p.images?.[0] && /^https?:\/\//.test(p.images[0])
          ? `<img src="${p.images[0]}" alt="${p.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">`
          : `<span class="card__label">${p.imageLabel || (p.name?.charAt(0) || "G")}</span>`}
        <span class="card__pill">${p.size}</span>
      </div>
      <h3 class="card__title">${p.name}</h3>
      <p class="card__desc">${p.description}</p>
      <div class="swatches">
        ${p.colors.map(c => `<span class="swatch" style="background:${c.hex}" title="${c.name}"></span>`).join("")}
      </div>
      <div class="card__footer">
        <div class="card__price">${formatCurrency(p.price)} <small>+ IVA</small></div>
        <button class="minimal-btn" data-action="view" data-id="${p.id}">Ver</button>
      </div>
    </article>
  `).join("");
  featuredGrid.querySelectorAll("button[data-action='view']").forEach(btn => {
    btn.addEventListener("click", () => openProductModal(btn.dataset.id));
  });
  featuredGrid.querySelectorAll("[data-view]").forEach(el => {
    el.addEventListener("click", (e) => {
      if (e.target.closest("button[data-action='view']")) return;
      openProductModal(el.dataset.view);
    });
  });
}

function renderCombos() {
  if (!combosGrid) return;
  if (isLoadingCatalog) {
    combosGrid.innerHTML = renderSkeleton(3);
    return;
  }
  combosGrid.innerHTML = combos.map(p => `
    <article class="card" data-view="${p.id}">
      <div class="card__tag">${p.badge}</div>
      <div class="card__image" data-view="${p.id}">
        ${p.images?.[0] && /^https?:\/\//.test(p.images[0])
          ? `<img src="${p.images[0]}" alt="${p.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">`
          : `<span class="card__label">${p.imageLabel || (p.name?.charAt(0) || "G")}</span>`}
        <span class="card__pill">${p.size}</span>
      </div>
      <h3 class="card__title">${p.name}</h3>
      <p class="card__desc">${p.description}</p>
      <div class="swatches">
        ${p.colors.map(c => `<span class="swatch" style="background:${c.hex}" title="${c.name}"></span>`).join("")}
      </div>
      <div class="card__footer">
        <div class="card__price">${formatCurrency(p.price)} <small>+ IVA</small></div>
        <button class="minimal-btn" data-action="view" data-id="${p.id}">Ver</button>
      </div>
    </article>
  `).join("");
  combosGrid.querySelectorAll("button[data-action='view']").forEach(btn => {
    btn.addEventListener("click", () => openProductModal(btn.dataset.id));
  });
  combosGrid.querySelectorAll("[data-view]").forEach(el => {
    el.addEventListener("click", (e) => {
      if (e.target.closest("button[data-action='view']")) return;
      openProductModal(el.dataset.view);
    });
  });
}

function addToCart(id) {
  const product = [...products, ...combos].find(p => p.id === id);
  if (!product) return;
  const color = product.colors?.[modalColorIndex] || product.colors?.[0] || { name: "" };
  const cartKey = color.name ? `${id}__${color.name}` : id;
  const displayName = color.name ? `${product.name} (${color.name.toUpperCase()})` : product.name;
  cart[cartKey] = cart[cartKey]
    ? { ...cart[cartKey], qty: cart[cartKey].qty + 1 }
    : { ...product, id: cartKey, baseId: product.id, colorName: color.name, name: displayName, qty: 1 };
  persistCart();
  renderCart();
  renderCheckoutSummary();
  toggleCart(true);
}

function changeQty(id, delta) {
  if (!cart[id]) return;
  cart[id].qty += delta;
  if (cart[id].qty <= 0) delete cart[id];
  persistCart();
  renderCart();
  renderCheckoutSummary();
}

function persistCart() {
  localStorage.setItem("gb-cart", JSON.stringify(cart));
}

function renderCart() {
  if (!cartList || !cartCount || !subtotalText || !shippingText || !totalText) return;
  const items = Object.values(cart);
  cartCount.textContent = items.reduce((acc, item) => acc + item.qty, 0);
  if (!items.length) {
    cartList.innerHTML = '<div class="empty">Todav├¡a no agregaste productos.</div>';
    subtotalText.textContent = "$0";
    shippingText.textContent = "$0";
    totalText.textContent = "$0";
    return;
  }
  cartList.innerHTML = items.map(item => `
    <div class="cart-item">
      <div class="cart-item__row">
        <strong>${item.name}</strong>
        <span>${formatCurrency(item.price)}</span>
      </div>
      <div class="cart-item__row">
        <div class="qty-group">
          <button class="qty-btn" data-qty="${item.id}" data-delta="-1">-</button>
          <input class="qty-input" type="number" min="1" value="${item.qty}" data-qty-input="${item.id}">
          <button class="qty-btn" data-qty="${item.id}" data-delta="1">+</button>
        </div>
        <strong>${formatCurrency(item.qty * item.price)}</strong>
      </div>
    </div>
  `).join("");
  cartList.querySelectorAll("[data-qty]").forEach(btn => {
    btn.addEventListener("click", () => changeQty(btn.dataset.qty, Number(btn.dataset.delta)));
  });
  cartList.querySelectorAll("[data-qty-input]").forEach(input => {
    input.addEventListener("change", () => {
      const val = Math.max(1, Number(input.value) || 1);
      const id = input.dataset.qtyInput;
      if (cart[id]) {
        cart[id].qty = val;
        persistCart();
        renderCart();
        renderCheckoutSummary();
      }
    });
  });
  const subtotal = items.reduce((acc, i) => acc + i.qty * i.price, 0);
  const shipping = getShipping(subtotal);
  subtotalText.textContent = formatCurrency(subtotal);
  shippingText.textContent = shipping === 0 ? "Gratis" : formatCurrency(shipping);
  totalText.textContent = formatCurrency(subtotal + shipping);
}

function renderCheckoutSummary() {
  if (!checkoutSummary || !checkoutTotals) return;
  const items = Object.values(cart);
  if (!items.length) {
    checkoutSummary.innerHTML = '<div class="empty">El carrito está vacío.</div>';
    checkoutTotals.innerHTML = "";
    return;
  }
  checkoutSummary.innerHTML = items.map(i => `
    <div class="checkout-summary__item">
      <div class="checkout-summary__title">${i.name}</div>
      <div class="checkout-summary__actions">
        <button class="qty-btn" data-qty="${i.id}" data-delta="-1">-</button>
        <span style="margin:0 8px;">${i.qty}</span>
        <button class="qty-btn" data-qty="${i.id}" data-delta="1">+</button>
        <strong>${formatCurrency(i.qty * i.price)}</strong>
      </div>
    </div>
  `).join("");
  const subtotal = items.reduce((acc, i) => acc + i.qty * i.price, 0);
  const shipping = getShipping(subtotal);
  checkoutTotals.innerHTML = `
    <div class="totals__row"><span>Subtotal</span><strong>${formatCurrency(subtotal)}</strong></div>
    <div class="totals__row"><span>Envío</span><strong>${shipping === 0 ? "Gratis" : formatCurrency(shipping)}</strong></div>
    <div class="totals__row totals__row--highlight"><span>Total</span><strong>${formatCurrency(subtotal + shipping)}</strong></div>
  `;
  checkoutSummary.querySelectorAll("[data-qty]").forEach(btn => {
    btn.addEventListener("click", () => changeQty(btn.dataset.qty, Number(btn.dataset.delta)));
  });
  updatePayButtonState();
}

function toggleCart(open) {
  if (!cartDrawer) return;
  cartDrawer.classList[open ? "add" : "remove"]("drawer--open");
}

function renderFilters() {
  if (!filterBar) return;
  const filters = ["all", "12 cm", "8 cm"];
  filterBar.innerHTML = `
    <div class="filter-group">
      ${filters.map(f => `
        <button class="filter-chip ${activeFilter === f ? "filter-chip--active" : ""}" data-filter="${f}">
          ${f === "all" ? "Todos" : f}
        </button>
      `).join("")}
    </div>
  `;
  filterBar.querySelectorAll("[data-filter]").forEach(btn => {
    btn.addEventListener("click", () => {
      activeFilter = btn.dataset.filter;
      renderFilters();
      renderCatalog();
    });
  });
}

function isCheckoutReady() {
  if (!emailInput || !paisSelect || !cpInput) return true;
  const email = emailInput.value.trim();
  const cp = cpInput.value.trim();
  const nombre = nombreInput?.value.trim() || "";
  const tel = telInput?.value.trim() || "";
  const calle = calleInput?.value.trim() || "";
  const numero = numeroInput?.value.trim() || "";
  const city = ciudadInput?.value.trim() || "";
  const prov = provinciaInput?.value.trim() || "";
  const pickup = pickupToggle?.checked;
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validCp = cp.length >= 3;
  const datosOk = validEmail && nombre.length > 1 && tel.length > 5;
  const direccionOk =
    validCp &&
    paisSelect.value.length > 0 &&
    calle.length > 2 &&
    numero.length > 0 &&
    city.length > 1 &&
    prov.length > 1;
  if (currentStep === 1) return true;
  if (currentStep === 2) return datosOk;
  return datosOk && (pickup ? true : direccionOk);
}

function updatePayButtonState() {
  if (!checkoutPageBtn) return;
  const ready = isCheckoutReady();
  const showPay = ready && currentStep === 3;
  checkoutPageBtn.disabled = !showPay;
  checkoutPageBtn.classList.toggle("pay-btn--hidden", !showPay);
  if (continueBtn) {
    continueBtn.style.display = currentStep === 3 ? "none" : "inline-flex";
  }
  document.querySelectorAll(".stepper__step")?.forEach(step => {
    const stepNum = Number(step.dataset.step);
    step.classList.toggle("stepper__step--active", stepNum === currentStep);
  });
}

function goToStep(step) {
  currentStep = step;
  stepBlocks.forEach((blk) => {
    const isStep2 = blk.classList.contains("step-2");
    const isStep3 = blk.classList.contains("step-3");
    if (isStep2) blk.style.display = step >= 2 ? "grid" : "none";
    if (isStep3) blk.style.display = step >= 3 ? "grid" : "none";
  });
  updatePayButtonState();
}

function openProductModal(id) {
  if (!productModal || !modalContent) return;
  const product = [...products, ...combos].find(p => p.id === id);
  if (!product) return;
  modalColorIndex = 0;
  modalImageIndex = 0;
  renderProductModal(product);
  productModal.classList.add("modal--open");
}

function renderProductModal(product) {
  const color = product.colors[modalColorIndex] || product.colors[0];
  // Normaliza imágenes: admite arrays anidados o string de array
  let images = normalizeImages(product.images && product.images.length ? product.images : ["Imagen no disponible"]);
  if (!images.length) images = ["Imagen no disponible"];
  if (modalImageIndex >= images.length) modalImageIndex = 0;
  const currentImage = images[modalImageIndex];
  const isImageUrl = /^https?:\/\//.test(currentImage);

  modalContent.innerHTML = `
    <div class="modal__header">
      <div>
        <div class="section__eyebrow">${product.badge}</div>
        <h3 class="section__title" style="margin:6px 0 0;">${product.name}</h3>
        <p class="section__subtitle" style="margin:4px 0 0;">${product.description}</p>
      </div>
      <button class="ghost-btn" onclick="closeProductModal()">Cerrar</button>
    </div>
    <div class="modal__body">
      <div class="modal__gallery">
        <div class="gallery__label"><span class="color-dot" style="background:${color.hex};"></span>${color.name}</div>
        ${isImageUrl ? `<img class="gallery__main" src="${currentImage}" alt="${product.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">` : ""}
        <div class="gallery__placeholder" style="${isImageUrl ? "display:none;" : ""}">${isImageUrl ? "Imagen no disponible" : currentImage}</div>
        ${images.length > 1 ? `<div class="gallery__thumbs">${images.map((img, idx) => `<button class="gallery__thumb ${idx === modalImageIndex ? "gallery__thumb--active" : ""}" data-img="${idx}" aria-label="Imagen ${idx + 1}"></button>`).join("")}</div>` : ""}
      </div>
      <div class="modal__info">
        <div class="card__price" style="font-size:26px;">${formatCurrency(product.price)} <small>+ IVA</small></div>
        <div class="badge">Medida: ${product.size}</div>
        <div class="modal__actions">
          <button class="minimal-btn" onclick="addToCart('${product.id}')">Agregar al carrito</button>
        </div>
      </div>
    </div>
  `;
  modalContent.querySelectorAll("[data-img]").forEach(btn => {
    btn.addEventListener("click", () => {
      modalImageIndex = Number(btn.dataset.img);
      renderProductModal(product);
    });
  });
}

function closeProductModal() {
  if (!productModal) return;
  productModal.classList.remove("modal--open");
}

async function createPreference(items) {
  return null;
}

async function handleCheckout() {
  if (!isCheckoutReady()) {
    alert("Completa email y código postal antes de enviar.");
    return;
  }
  const items = Object.values(cart);
  if (!items.length) {
    alert("Agrega productos al carrito antes de enviar.");
    return;
  }
  const subtotal = items.reduce((acc, i) => acc + i.qty * i.price, 0);
  const shipping = getShipping(subtotal);
  const payload = {
    name: nombreInput?.value || "Checkout web",
    email: emailInput?.value || "",
    phone: telInput?.value || "",
    total: subtotal + shipping,
    cp: cpInput?.value || "",
    pais: paisSelect?.value || "",
    address: {
      street: `${calleInput?.value || ""} ${numeroInput?.value || ""}`.trim(),
      floor: pisoInput?.value || "",
      city: ciudadInput?.value || "",
      state: provinciaInput?.value || "",
      country: paisSelect?.value || "",
      zip: cpInput?.value || "",
    },
    pickup: pickupToggle?.checked || false,
    items: items.map((i) => ({
      title: i.name,
      quantity: i.qty,
      unit_price: i.price,
      size: i.size,
    })),
    notes: pickupToggle?.checked ? "Retiro en local" : "Pedido web pendiente de confirmaci¾n",
  };
  try {
    showLoader();
    const res = await fetch(ORDER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    const payRes = await fetch(PAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order_id: data.order_id,
        email: emailInput?.value || "",
        total: subtotal + shipping,
        items: [
          { title: `Pedido ${data.order_id}`, quantity: 1, unit_price: subtotal + shipping },
        ],
      }),
    });
    if (!payRes.ok) throw new Error();
    const payData = await payRes.json();
    if (payData.init_point) {
      window.location.href = payData.init_point;
      return;
    }
    alert(`Pedido enviado. ID: ${data.order_id || "pendiente"}`);
    Object.keys(cart).forEach((k) => delete cart[k]);
    persistCart();
    renderCart();
    renderCheckoutSummary();
  } catch (err) {
    alert("No se pudo enviar el pedido o crear el pago. Reintenta o contßctanos.");
  } finally {
    hideLoader();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // muestra skeletons de entrada
  renderCatalog();
  renderFeatured();
  renderCombos();
  fetchCatalog();
  renderFilters();
  if (checkoutBtn) checkoutBtn.addEventListener("click", handleCheckout);
  if (finalizeBtn) finalizeBtn.addEventListener("click", () => { location.href = "checkout.html"; });
  if (checkoutPageBtn) checkoutPageBtn.addEventListener("click", handleCheckout);
  [emailInput, paisSelect, cpInput, nombreInput, telInput, calleInput, numeroInput, pisoInput, ciudadInput, provinciaInput].forEach(el => {
    if (el) el.addEventListener("input", updatePayButtonState);
  });
  if (pickupToggle) {
    pickupToggle.addEventListener("change", () => {
      renderCart();
      renderCheckoutSummary();
      updatePayButtonState();
    });
  }
  if (continueBtn) {
    continueBtn.addEventListener("click", () => {
      if (currentStep === 1) {
        goToStep(2);
        return;
      }
      if (currentStep === 2) {
        if (!isCheckoutReady()) {
          alert("Completa nombre, teléfono y email antes de continuar.");
          return;
        }
        goToStep(3);
      }
    });
  }
  const contactForm = document.getElementById("contactForm");
  if (contactForm) {
    contactForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const formData = new FormData(contactForm);
      const payload = Object.fromEntries(formData.entries());
      fetch(CONTACT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(res => res.ok ? res.json() : Promise.reject())
        .then(() => {
          alert("Gracias por tu mensaje. Te responderemos en minutos.");
          contactForm.reset();
        }).catch(() => {
          alert("No se pudo enviar. Reintenta o escr├¡benos a ventas@ganchosblistero.com");
        });
    });
  }
  const floatingCart = document.querySelector(".floating-cart");
  if (floatingCart) floatingCart.addEventListener("click", () => toggleCart(true));
  if (modalOverlay) modalOverlay.addEventListener("click", closeProductModal);
  if (filterToggle && catalogSidebar) {
    filterToggle.addEventListener("click", () => {
      catalogSidebar.classList.toggle("is-open");
      filterToggle.textContent = catalogSidebar.classList.contains("is-open") ? "Ocultar filtros" : "Mostrar filtros";
    });
  }
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      searchTerm = searchInput.value || "";
      renderCatalog();
    });
  }
  if (navToggle && navElement) {
    navToggle.addEventListener("click", () => {
      navElement.classList.toggle("nav--open");
    });
    document.querySelectorAll(".nav__links a").forEach(link => {
      link.addEventListener("click", () => navElement.classList.remove("nav--open"));
    });
  }

  const revealItems = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });
    revealItems.forEach(el => observer.observe(el));
  } else {
    revealItems.forEach(el => el.classList.add("is-visible"));
  }
  // Collage slider
  const collageTrack = document.getElementById("collageTrack");
  const collageDots = document.getElementById("collageDots");
  const collagePrev = document.getElementById("collagePrev");
  const collageNext = document.getElementById("collageNext");
  if (collageTrack && collageDots) {
    const slides = Array.from(collageTrack.children);
    let current = 0;
    collageDots.innerHTML = slides.map((_, idx) => `<span class="collage__dot ${idx === 0 ? "is-active" : ""}" data-collage="${idx}"></span>`).join("");
    const dots = collageDots.querySelectorAll("[data-collage]");
    const goTo = (idx) => {
      current = (idx + slides.length) % slides.length;
      collageTrack.style.transform = `translateX(-${current * 100}%)`;
      dots.forEach((d, i) => d.classList.toggle("is-active", i === current));
    };
    dots.forEach(d => d.addEventListener("click", () => goTo(Number(d.dataset.collage))));
    if (collagePrev) collagePrev.addEventListener("click", () => goTo(current - 1));
    if (collageNext) collageNext.addEventListener("click", () => goTo(current + 1));
    goTo(0);
    let timer = setInterval(() => goTo(current + 1), 4000);
    const stop = () => clearInterval(timer);
    const resume = () => { stop(); timer = setInterval(() => goTo(current + 1), 4000); };
    collageTrack.parentElement.addEventListener("mouseenter", stop);
    collageTrack.parentElement.addEventListener("mouseleave", resume);
  }
  goToStep(1);
  if (brandEl) {
    brandEl.style.cursor = "pointer";
    brandEl.addEventListener("click", () => (location.href = "index.html"));
  }
});

async function fetchCatalog() {
  showLoader();
  isLoadingCatalog = true;
  renderCatalog();
  renderFeatured();
  renderCombos();
  const sanitizeItem = (item) => {
    if (!item || !item.id) return null;
    const name = item.name || "Producto";
    const type = item.type === "combo" ? "combo" : "product";
    const price = Number(item.price) || 0;
    const size = item.size || "8 cm";
    const description = item.description || "";
    const badge = item.badge || "";
    const parseField = (val, fallback = []) => {
      if (!val) return fallback;
      if (Array.isArray(val)) return val;
      if (typeof val === "string") {
        const trimmed = val.trim();
        if (trimmed.startsWith("[")) {
          try { const parsed = JSON.parse(trimmed); if (Array.isArray(parsed)) return parsed; } catch (_) {}
        }
        // Si es string plano (ID o URL), lo devolvemos como array de 1
        return [trimmed];
      }
      return fallback;
    };
    const colorsRaw = parseField(item.colors, []);
    let colors = colorsRaw
      .map((c) =>
        typeof c === "string"
          ? { name: c, hex: "#111" }
          : { name: c.name || "Color", hex: c.hex || "#111" }
      )
      .filter(Boolean);
    if (!colors.length) colors = [{ name: "Negro", hex: "#111" }];

    const images = normalizeImages(parseField(item.images, []));
    const imageLabel =
      item.imageLabel ||
      (!images.length || images[0] === "Imagen no disponible" ? name.charAt(0) || "GB" : "");
    return { ...item, name, badge, type, price, size, description, colors, images: images.length ? images : ["Imagen no disponible"], imageLabel };
  };
  try {
    let data = [];
    const res = await fetch(API_URL);
    const text = await res.text();
    // Si viene HTML (error), lanzamos para usar fallback
    if (text.trim().startsWith("<")) throw new Error("Respuesta no JSON");
    data = JSON.parse(text);
    const sanitized = (Array.isArray(data) ? data : []).map(sanitizeItem).filter(Boolean);
    products = sanitized.filter(d => d.type === "product");
    combos = sanitized.filter(d => d.type === "combo");
  } catch (error) {
    console.warn("No se pudo obtener el catálogo remoto, se usan datos locales.", error);
  } finally {
    isLoadingCatalog = false;
    renderCatalog();
    renderFeatured();
    renderCombos();
    renderCart();
    renderCheckoutSummary();
    hideLoader();
  }
}

function renderSkeleton(count = 3) {
  return Array.from({ length: count })
    .map(
      () => `
      <article class="skeleton-card">
        <div class="skeleton-pill" style="width:80px;"></div>
        <div class="skeleton-thumb"></div>
        <div class="skeleton-bar" style="width:70%; height:14px;"></div>
        <div class="skeleton-bar" style="width:90%;"></div>
        <div class="skeleton-bar" style="width:50%;"></div>
      </article>
    `
    )
    .join("");
}

function showLoader() {
  if (!loaderOverlay) return;
  loaderOverlay.classList.add("is-visible");
}
function hideLoader() {
  if (!loaderOverlay) return;
  loaderOverlay.classList.remove("is-visible");
}
