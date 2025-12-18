const API_BASE = "https://ganchos-blistero-production.up.railway.app/api";
const loginBlock = document.getElementById("loginBlock");
const panelBlock = document.getElementById("panelBlock");
const tokenInput = document.getElementById("tokenInput");
const loginBtn = document.getElementById("loginBtn");
const ordersBody = document.getElementById("ordersBody");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const refreshBtn = document.getElementById("refreshBtn");
const summaryCount = document.getElementById("summaryCount");
const statusChartEl = document.getElementById("statusChart");
const dailyChartEl = document.getElementById("dailyChart");
const topItemsChartEl = document.getElementById("topItemsChart");
// Productos
const pName = document.getElementById("pName");
const pPrice = document.getElementById("pPrice");
const pSize = document.getElementById("pSize");
const pType = document.getElementById("pType");
const pBadge = document.getElementById("pBadge");
const pDescription = document.getElementById("pDescription");
const pImageUrl = document.getElementById("pImageUrl");
const pImageFile = document.getElementById("pImageFile");
const uploadImageBtn = document.getElementById("uploadImageBtn");
const createProductBtn = document.getElementById("createProductBtn");
const uploadStatus = document.getElementById("uploadStatus");
const productMsg = document.getElementById("productMsg");
const productList = document.getElementById("productList");
const tabOrders = document.getElementById("tabOrders");
const tabProducts = document.getElementById("tabProducts");
const ordersSection = document.getElementById("ordersSection");
const productsSection = document.getElementById("productsSection");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const pageInfo = document.getElementById("pageInfo");
const PAGE_SIZE = 10;

let adminToken = localStorage.getItem("gb-admin-token") || "";
let orders = [];
let products = [];
let statusChart;
let dailyChart;
let topItemsChart;
let editingId = null;
let currentPage = 1;

function formatAddress(o) {
  const lines = [];
  if (o.address_street) lines.push(`Calle y nÃºmero: ${o.address_street}`);
  if (o.address_floor) lines.push(`Piso/Depto: ${o.address_floor}`);
  if (o.address_city) lines.push(`Ciudad: ${o.address_city}`);
  if (o.address_state) lines.push(`Provincia: ${o.address_state}`);
  if (o.address_country) lines.push(`PaÃ­s: ${o.address_country}`);
  if (o.address_zip) lines.push(`CP: ${o.address_zip}`);
  return lines.length ? lines.join("<br>") : "Sin direcciÃ³n";
}

function setVisible(el, show) {
  if (!el) return;
  el.classList[show ? "remove" : "add"]("hidden");
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function renderOrders() {
  if (!ordersBody) return;
  const term = (searchInput?.value || "").toLowerCase();
  const status = statusFilter?.value || "";
  const filtered = orders
    .slice()
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .filter((o) => {
      const matchTerm =
        !term ||
        (o.email || "").toLowerCase().includes(term) ||
        (o.order_id || "").toLowerCase().includes(term);
      const matchStatus = !status || o.status === status;
      return matchTerm && matchStatus;
    });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  currentPage = Math.min(currentPage, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  summaryCount.textContent = `${filtered.length} pedidos`;
  if (pageInfo) pageInfo.textContent = `Pág ${currentPage}/${totalPages}`;
  if (prevPageBtn) prevPageBtn.disabled = currentPage <= 1;
  if (nextPageBtn) nextPageBtn.disabled = currentPage >= totalPages;

  ordersBody.innerHTML = pageItems
    .map((o) => {
      const items = safeItems(o.items_json);
      const isPickup = (o.notes || "").toLowerCase().includes("retiro en local");
      return `
        <tr>
          <td>
            <div><strong>${o.order_id || "-"}</strong></div>
            <div class="notes">${new Date(o.created_at || Date.now()).toLocaleString()}</div>
          </td>
          <td>
            <div>${o.name || "Sin nombre"}</div>
            <div class="notes">${o.email || ""}</div>
            <div class="notes">${o.phone || ""}</div>
            <div class="notes">${formatAddress(o)}</div>
          </td>
          <td>${formatCurrency(o.total)}</td>
          <td>
            <select data-id="${o.order_id}" class="status-select">
              <option value="pending" ${o.status === "pending" ? "selected" : ""}>Pendiente</option>
              <option value="approved" ${o.status === "approved" ? "selected" : ""}>Pago aprobado</option>
              <option value="cancelled" ${o.status === "cancelled" ? "selected" : ""}>Cancelado</option>
            </select>
          </td>
          <td>
            <div class="notes">${items.map((i) => `${i.title || i.name} x${i.quantity || i.qty || 1}`).join("<br>")}</div>
          </td>
          <td>
            <textarea rows="2" data-notes="${o.order_id}" class="notes-input">${o.notes || ""}</textarea>
            <button class="btn btn--ghost" data-save="${o.order_id}" style="margin-top:6px;">Guardar</button>
            <button class="btn btn--ghost" data-del="${o.order_id}" style="margin-top:6px;">Eliminar</button>
            <button class="btn btn--ghost" data-label="${o.order_id}" style="margin-top:6px;">Imprimir etiqueta</button>
            ${isPickup ? '<div class="pill" style="margin-top:6px;background:rgba(59,209,111,0.18);color:#3bd16f;">Retiro en local</div>' : ""}
          </td>
        </tr>
      `;
    })
    .join("");
  wireActions();
  updateCharts(filtered);
}

function safeItems(str) {
  try {
    return JSON.parse(str || "[]");
  } catch (e) {
    return [];
  }
}

async function fetchOrders() {
  if (!adminToken) return;
  try {
    const res = await fetch(`${API_BASE}/orders?token=${adminToken}`);
    if (!res.ok) throw new Error("No autorizado");
    orders = await res.json();
    renderOrders();
    setVisible(panelBlock, true);
    setVisible(loginBlock, false);
  } catch (err) {
    alert("Token incorrecto o error obteniendo pedidos.");
    localStorage.removeItem("gb-admin-token");
    adminToken = "";
    setVisible(panelBlock, false);
    setVisible(loginBlock, true);
  }
}

function wireActions() {
  document.querySelectorAll(".status-select").forEach((sel) => {
    sel.addEventListener("change", async () => {
      await updateOrder(sel.dataset.id, { status: sel.value });
      setSelectColor(sel);
    });
    setSelectColor(sel);
  });
  document.querySelectorAll("[data-save]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.save;
      const notes = document.querySelector(`[data-notes="${id}"]`)?.value || "";
      await updateOrder(id, { notes });
    });
  });
  document.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.del;
      if (!confirm(`¿Eliminar la orden ${id}?`)) return;
      await deleteOrder(id);
    });
  });
  document.querySelectorAll("[data-label]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.label;
      await openLabel(id);
    });
  });
}

async function updateOrder(id, payload) {
  try {
    const res = await fetch(`${API_BASE}/orders/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": adminToken,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("No se pudo actualizar");
    await fetchOrders();
  } catch (err) {
    alert("Error guardando cambios");
  }
}

async function deleteOrder(id) {
  try {
    const res = await fetch(`${API_BASE}/orders/${id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": adminToken,
      },
    });
    if (!res.ok) throw new Error();
    await fetchOrders();
  } catch (err) {
    alert("No se pudo eliminar la orden");
  }
}

async function openLabel(id) {
  try {
    const res = await fetch(`${API_BASE}/pago/label/${id}?token=${adminToken || ""}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    if (data?.url) {
      window.open(data.url, "_blank");
    } else {
      alert("No se encontró etiqueta para esta orden.");
    }
  } catch (err) {
    alert("No se pudo obtener la etiqueta.");
  }
}

function setSelectColor(sel) {
  const v = sel.value;
  sel.style.background =
    v === "approved"
      ? "rgba(59,209,111,0.18)"
      : v === "pending"
      ? "rgba(247,183,49,0.2)"
      : "rgba(255,107,107,0.2)";
  sel.style.color =
    v === "approved" ? "#3bd16f" : v === "pending" ? "#f7b731" : "#ff6b6b";
  sel.style.border = "1px solid rgba(255,255,255,0.08)";
}

function computeStatusData(data) {
  const counts = { pending: 0, approved: 0, cancelled: 0 };
  data.forEach((o) => {
    const s = o.status || "pending";
    if (counts[s] !== undefined) counts[s] += 1;
  });
  return counts;
}

function computeDailyTotals(data) {
  const map = {};
  data.forEach((o) => {
    const d = (o.created_at || "").slice(0, 10);
    const total = Number(o.total || 0);
    if (!d) return;
    map[d] = (map[d] || 0) + total;
  });
  const entries = Object.entries(map).sort((a, b) => (a[0] > b[0] ? 1 : -1));
  return { labels: entries.map((e) => e[0]), values: entries.map((e) => e[1]) };
}

function computeTopItems(data) {
  const map = {};
  data.forEach((o) => {
    const items = safeItems(o.items_json);
    items.forEach((it) => {
      const name = it.title || it.name || "Sin nombre";
      const qty = Number(it.quantity || it.qty || 1);
      map[name] = (map[name] || 0) + (Number.isFinite(qty) ? qty : 0);
    });
  });
  const entries = Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  if (!entries.length) {
    return { labels: ["Sin datos"], values: [0], colors: ["#f7b731"] };
  }
  const palette = ["#ef2b2d", "#f7b731", "#3bd16f", "#4aa3ff", "#9b59b6", "#ff6b6b"];
  const labels = entries.map((e) => e[0]);
  const values = entries.map((e) => e[1]);
  const colors = values.map((_, idx) => palette[idx % palette.length]);
  return { labels, values, colors };
}

function updateCharts(data) {
  if (statusChartEl) {
    const c = computeStatusData(data);
    const labels = ["Pendiente", "Cerrado", "Cancelado"];
    const values = [c.pending, c.approved, c.cancelled];
    if (statusChart) statusChart.destroy();
    statusChart = new Chart(statusChartEl, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: ["#f7b731", "#3bd16f", "#ff6b6b"],
            borderWidth: 0,
          },
        ],
      },
      options: { plugins: { legend: { display: true, labels: { color: "#e5e7ef" } } } },
    });
  }
  if (dailyChartEl) {
    const d = computeDailyTotals(data);
    if (dailyChart) dailyChart.destroy();
    dailyChart = new Chart(dailyChartEl, {
      type: "bar",
      data: {
        labels: d.labels,
        datasets: [
          {
            label: "ARS",
            data: d.values,
            backgroundColor: "#ef2b2d",
          },
        ],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#cfd4e5" } },
          y: { ticks: { color: "#cfd4e5" } },
        },
      },
    });
  }
  if (topItemsChartEl) {
    const t = computeTopItems(data);
    if (topItemsChart) topItemsChart.destroy();
    topItemsChart = new Chart(topItemsChartEl, {
      type: "bar",
      data: {
        labels: t.labels,
        datasets: [
          {
            label: "Cantidad",
            data: t.values,
            backgroundColor: t.colors,
          },
        ],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#cfd4e5" } },
          y: { ticks: { color: "#cfd4e5" } },
        },
      },
    });
  }
}

loginBtn?.addEventListener("click", async () => {
  const t = tokenInput?.value?.trim();
  if (!t) return alert("Ingresa el token admin");
  adminToken = t;
  localStorage.setItem("gb-admin-token", adminToken);
  await fetchOrders();
});

refreshBtn?.addEventListener("click", fetchOrders);
searchInput?.addEventListener("input", renderOrders);
statusFilter?.addEventListener("change", renderOrders);

if (adminToken) {
  tokenInput.value = adminToken;
  fetchOrders();
}

prevPageBtn?.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage -= 1;
    renderOrders();
  }
});
nextPageBtn?.addEventListener("click", () => {
  currentPage += 1;
  renderOrders();
});

// ---------- Productos ----------
async function uploadImage() {
  try {
    if (!pImageFile?.files?.length && !pImageUrl?.value) {
      alert("Sube un archivo o pega una URL.");
      return null;
    }
    uploadStatus.style.display = "inline-flex";
    uploadStatus.textContent = "Subiendo...";
    const body = {};
    if (pImageFile?.files?.length) {
      const file = pImageFile.files[0];
      const base64 = await fileToBase64(file);
      body.image = base64;
    } else {
      body.image = pImageUrl.value.trim();
    }
    body.folder = "ganchos";
    const res = await fetch(`${API_BASE}/upload-image`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": adminToken || tokenInput?.value?.trim() || "",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      uploadStatus.textContent = errText || "Error subiendo";
      return null;
    }
    const data = await res.json();
    uploadStatus.textContent = "Imagen subida";
    return data.url;
  } catch (err) {
    uploadStatus.textContent = "Error subiendo";
    return null;
  } finally {
    setTimeout(() => (uploadStatus.style.display = "none"), 2000);
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function saveProduct() {
  try {
    const name = pName?.value.trim();
    const price = Number(pPrice?.value || 0);
    const size = pSize?.value.trim();
    const type = pType?.value || "product";
    const badge = pBadge?.value.trim();
    const description = pDescription?.value.trim();
    if (!name || !price || !size) {
      alert("Nombre, precio y medida son obligatorios.");
      return;
    }
    let imageUrl = pImageUrl?.value.trim() || "";
    if (!imageUrl && pImageFile?.files?.length) {
      imageUrl = await uploadImage();
      if (!imageUrl) return;
    }
    const payload = {
      name,
      price,
      size,
      type,
      badge,
      description,
      images: imageUrl ? [imageUrl] : [],
    };
    const url = editingId ? `${API_BASE}/products/${editingId}` : `${API_BASE}/products`;
    const method = editingId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", "x-admin-token": adminToken || "" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error();
    productMsg.style.display = "inline-flex";
    productMsg.textContent = editingId ? "Producto actualizado" : "Producto creado";
    await fetchProducts();
    resetProductForm();
  } catch (err) {
    productMsg.style.display = "inline-flex";
    productMsg.textContent = "Error al guardar";
    setTimeout(() => (productMsg.style.display = "none"), 2000);
  }
}

function resetProductForm() {
  editingId = null;
  createProductBtn.textContent = "Crear producto";
  pName.value = "";
  pPrice.value = "";
  pSize.value = "";
  pBadge.value = "";
  pDescription.value = "";
  pImageUrl.value = "";
  if (pImageFile) pImageFile.value = "";
  setTimeout(() => (productMsg.style.display = "none"), 2000);
}

async function deleteProduct(id) {
  if (!confirm("Â¿Eliminar este producto?")) return;
  try {
    const res = await fetch(`${API_BASE}/products/${id}`, {
      method: "DELETE",
      headers: { "x-admin-token": adminToken || "" },
    });
    if (!res.ok) throw new Error();
    await fetchProducts();
  } catch (err) {
    alert("No se pudo eliminar");
  }
}

function startEditProduct(id) {
  const p = products.find((x) => x.id === id);
  if (!p) return;
  editingId = id;
  pName.value = p.name || "";
  pPrice.value = p.price || "";
  pSize.value = p.size || "";
  pType.value = p.type || "product";
  pBadge.value = p.badge || "";
  pDescription.value = p.description || "";
  pImageUrl.value = Array.isArray(p.images) && p.images[0] ? p.images[0] : "";
  createProductBtn.textContent = "Actualizar producto";
  productMsg.style.display = "inline-flex";
  productMsg.textContent = "Editando producto";
  setTimeout(() => (productMsg.style.display = "none"), 2000);
}

async function fetchProducts() {
  try {
    const res = await fetch(`${API_BASE}/catalogo`);
    if (!res.ok) throw new Error();
    products = await res.json();
    renderProductsList();
  } catch (err) {
    productList.innerHTML = "<div class=\"notes\">No se pudieron cargar productos</div>";
  }
}

function renderProductsList() {
  if (!productList) return;
  const rows = products
    .map((p) => {
      const img =
        Array.isArray(p.images) && p.images[0]
          ? `<img src="${p.images[0]}" alt="${p.name}" class="admin-thumb">`
          : `<div class="admin-thumb admin-thumb--empty">Sin imagen</div>`;
      return `<div class="product-row">
        <div class="product-row__media">${img}</div>
        <div class="product-row__info">
          <div class="product-row__title">${p.name || "-"}</div>
          <div class="product-row__meta">${p.size || ""} - ${p.type || ""} - ${formatCurrency(p.price || 0)}</div>
          <div class="product-row__desc">${p.description || ""}</div>
        </div>
        <div class="product-row__actions">
          <button class="btn btn--ghost" data-edit="${p.id}">Editar</button>
          <button class="btn" data-delete="${p.id}">Eliminar</button>
        </div>
      </div>`;
    })
    .join("");
  productList.innerHTML = rows || '<div class="notes">Sin productos</div>';
  productList.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => startEditProduct(btn.dataset.edit))
  );
  productList.querySelectorAll("[data-delete]").forEach((btn) =>
    btn.addEventListener("click", () => deleteProduct(btn.dataset.delete))
  );
}
uploadImageBtn?.addEventListener("click", uploadImage);
createProductBtn?.addEventListener("click", saveProduct);
refreshBtn?.addEventListener("click", () => {
  fetchOrders();
  fetchProducts();
});

tabOrders?.addEventListener("click", () => {
  ordersSection?.classList.remove("hidden");
  productsSection?.classList.add("hidden");
  tabOrders.classList.remove("btn--ghost");
  tabProducts?.classList.add("btn--ghost");
});
tabProducts?.addEventListener("click", () => {
  ordersSection?.classList.add("hidden");
  productsSection?.classList.remove("hidden");
  tabProducts.classList.remove("btn--ghost");
  tabOrders?.classList.add("btn--ghost");
  fetchProducts();
});
