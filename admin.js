const API_BASE = "https://ganchos-blistero-production.up.railway.app/api";
const loginBlock = document.getElementById("loginBlock");
const panelBlock = document.getElementById("panelBlock");
const tokenInput = document.getElementById("tokenInput");
const loginBtn = document.getElementById("loginBtn");
const ordersBody = document.getElementById("ordersBody");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const fromDate = document.getElementById("fromDate");
const toDate = document.getElementById("toDate");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");
const refreshBtn = document.getElementById("refreshBtn");
const summaryCount = document.getElementById("summaryCount");
const statusChartEl = document.getElementById("statusChart");
const dailyChartEl = document.getElementById("dailyChart");
const topItemsChartEl = document.getElementById("topItemsChart");
const kpiSales = document.getElementById("kpiSales");
const kpiPending = document.getElementById("kpiPending");
const kpiAvg = document.getElementById("kpiAvg");
const selectAll = document.getElementById("selectAll");
const bulkPending = document.getElementById("bulkPending");
const bulkApproved = document.getElementById("bulkApproved");
const bulkCancelled = document.getElementById("bulkCancelled");
const bulkDelete = document.getElementById("bulkDelete");
const bulkExport = document.getElementById("bulkExport");
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
const pColor = document.getElementById("pColor");
const pWeight = document.getElementById("pWeight");
const pLength = document.getElementById("pLength");
const pWidth = document.getElementById("pWidth");
const pHeight = document.getElementById("pHeight");
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
let selectedOrders = new Set();
let currentPageIds = [];
let toastTimer;

const toast = document.createElement("div");
toast.className = "toast";
document.body.appendChild(toast);

function formatAddress(o) {
  const lines = [];
  if (o.address_street) lines.push(`Calle y número: ${o.address_street}`);
  if (o.address_floor) lines.push(`Piso/Depto: ${o.address_floor}`);
  if (o.address_city) lines.push(`Ciudad: ${o.address_city}`);
  if (o.address_state) lines.push(`Provincia: ${o.address_state}`);
  if (o.address_country) lines.push(`Paí­s: ${o.address_country}`);
  if (o.address_zip) lines.push(`CP: ${o.address_zip}`);
  return lines.length ? lines.join("<br>") : "Sin dirección declarada";
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
  const from = fromDate?.value ? new Date(fromDate.value) : null;
  const to = toDate?.value ? new Date(`${toDate.value}T23:59:59`) : null;
  // Limpio seleccion que ya no existe
  const validIds = new Set(orders.map((o) => o.order_id));
  selectedOrders = new Set([...selectedOrders].filter((id) => validIds.has(id)));

  const filtered = orders
    .slice()
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .filter((o) => {
      const matchTerm =
        !term ||
        (o.email || "").toLowerCase().includes(term) ||
        (o.order_id || "").toLowerCase().includes(term);
      const matchStatus = !status || o.status === status;
      const d = o.created_at ? new Date(o.created_at) : null;
      const matchDate =
        (!from && !to) ||
        (d && (from ? d >= from : true) && (to ? d <= to : true));
      return matchTerm && matchStatus && matchDate;
    });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  currentPage = Math.min(currentPage, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);
  currentPageIds = pageItems.map((o) => o.order_id);

  summaryCount.textContent = `${filtered.length} pedidos`;
  if (pageInfo) pageInfo.textContent = `Pag ${currentPage}/${totalPages}`;
  if (prevPageBtn) prevPageBtn.disabled = currentPage <= 1;
  if (nextPageBtn) nextPageBtn.disabled = currentPage >= totalPages;

  // KPIs
  const todayStr = new Date().toISOString().slice(0, 10);
  const todaySales = filtered
    .filter((o) => (o.created_at || "").startsWith(todayStr))
    .reduce((acc, o) => acc + Number(o.total || 0), 0);
  const pendingCount = filtered.filter((o) => o.status === "pending").length;
  const avg = filtered.length > 0 ? filtered.reduce((acc, o) => acc + Number(o.total || 0), 0) / filtered.length : 0;
  if (kpiSales) kpiSales.textContent = formatCurrency(todaySales);
  if (kpiPending) kpiPending.textContent = pendingCount;
  if (kpiAvg) kpiAvg.textContent = formatCurrency(avg);

  ordersBody.innerHTML = pageItems
    .map((o) => {
      const items = safeItems(o.items_json);
      const isPickup = (o.notes || "").toLowerCase().includes("Retiro en local");
      return `
        <tr>
          <td><input type="checkbox" class="row-check" data-id="${o.order_id}" ${
            selectedOrders.has(o.order_id) ? "checked" : ""
          }></td>
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
            <button class="btn btn--ghost" data-track="${o.order_id}" style="margin-top:6px;">Ver tracking</button>
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
  document.querySelectorAll("[data-track]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.track;
      await openTracking(id, btn);
    });
  });
  document.querySelectorAll(".row-check").forEach((chk) => {
    chk.addEventListener("change", () => {
      const id = chk.dataset.id;
      if (chk.checked) {
        selectedOrders.add(id);
      } else {
        selectedOrders.delete(id);
      }
      updateSelectAllState();
    });
  });
  updateSelectAllState();
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
    const res = await fetch(`${API_BASE}/orders/label/${id}`, {
      headers: { "x-admin-token": adminToken || "" },
    });
    if (!res.ok) throw new Error("No autorizado o sin etiqueta");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  } catch (err) {
    alert("No se pudo obtener la etiqueta interna.");
  }
}

async function openTracking(id, btn) {
  const originalText = btn?.textContent || "Ver tracking";
  try {
    if (btn) btn.textContent = "Consultando...";
    const res = await fetch(`${API_BASE}/pago/tracking/${id}?token=${adminToken || ""}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    const status = data?.status || data?.substatus || "sin estado";
    const trackingNum = data?.tracking_number || "n/a";
    const url = data?.tracking_url || "";
    if (url) {
      window.open(url, "_blank");
    } else {
      alert(`Estado: ${status}\nTracking: ${trackingNum}`);
    }
  } catch (err) {
    alert("No se pudo obtener el tracking.");
  } finally {
    if (btn) btn.textContent = originalText;
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
    const colorName = (pColor?.value || "Negro").trim() || "Negro";
    const colorHex = colorName.toLowerCase() === "blanco" ? "#f3f3f3" : "#111";
    const weight = Number(pWeight?.value || 0);
    const length = Number(pLength?.value || 0);
    const width = Number(pWidth?.value || 0);
    const height = Number(pHeight?.value || 0);
    if (weight < 0 || length < 0 || width < 0 || height < 0) {
      alert("Peso y dimensiones deben ser positivos.");
      return;
    }
    if (weight > 100000 || length > 200 || width > 200 || height > 200) {
      alert("Revisa peso/dimensiones: los valores son demasiado grandes.");
      return;
    }
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
      colors: [{ name: colorName, hex: colorHex }],
    };
    if (weight) payload.weight_g = weight;
    if (length) payload.length_cm = length;
    if (width) payload.width_cm = width;
    if (height) payload.height_cm = height;
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
  if (pColor) pColor.value = "Negro";
  if (pWeight) pWeight.value = "";
  if (pLength) pLength.value = "";
  if (pWidth) pWidth.value = "";
  if (pHeight) pHeight.value = "";
  if (pImageFile) pImageFile.value = "";
  setTimeout(() => (productMsg.style.display = "none"), 2000);
}

async function deleteProduct(id) {
  if (!confirm("¿Eliminar este producto?")) return;
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
  if (pColor) {
    const c = Array.isArray(p.colors) && p.colors[0] ? p.colors[0].name : "Negro";
    pColor.value = c && c.toLowerCase() === "blanco" ? "Blanco" : "Negro";
  }
  if (pWeight) pWeight.value = p.weight_g || "";
  if (pLength) pLength.value = p.length_cm || "";
  if (pWidth) pWidth.value = p.width_cm || "";
  if (pHeight) pHeight.value = p.height_cm || "";
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
      const hidden = p.badge === "__hidden__";
      const status = hidden ? "No publicado" : "Publicado";
      const weightLabel = p.weight_g ? `${p.weight_g} g` : "sin peso";
      const hasDims = p.length_cm || p.width_cm || p.height_cm;
      const dims = hasDims ? `${p.length_cm || "-"}x${p.width_cm || "-"}x${p.height_cm || "-"} cm` : "";
      const colorLabel = Array.isArray(p.colors) && p.colors[0] ? p.colors[0].name : "Sin color";
      return `<div class="product-row">
        <div class="product-row__media">${img}</div>
        <div class="product-row__info">
          <div class="product-row__title">${p.name || "-"}</div>
          <div class="product-row__meta">${p.size || ""} - ${p.type || ""} - ${formatCurrency(p.price || 0)}</div>
          <div class="product-row__meta">Color: ${colorLabel} · Peso: ${weightLabel}${dims ? ` · ${dims}` : ""}</div>
          <div class="product-row__desc">${p.description || ""}</div>
          <div class="product-row__status ${hidden ? "status-pill status-pill--off" : "status-pill status-pill--on"}">${status}${hidden ? " · No se muestra en catálogo" : ""}</div>
        </div>
        <div class="product-row__actions">
          <button class="btn btn--ghost" data-edit="${p.id}">Editar</button>
          <button class="btn btn--ghost" data-duplicate="${p.id}">Duplicar</button>
          <button class="btn ${hidden ? "" : "btn--ghost"}" data-toggle="${p.id}">${hidden ? "Publicar" : "Ocultar"}</button>
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
  productList.querySelectorAll("[data-duplicate]").forEach((btn) =>
    btn.addEventListener("click", () => duplicateProduct(btn.dataset.duplicate))
  );
  productList.querySelectorAll("[data-toggle]").forEach((btn) =>
    btn.addEventListener("click", () => togglePublish(btn.dataset.toggle))
  );
}

function getAdminToken() {
  return adminToken || tokenInput?.value?.trim() || "";
}

async function togglePublish(id) {
  try {
    const prod = products.find((p) => p.id === id);
    if (!prod) return;
    const hidden = prod.badge === "__hidden__";
    const payload = { badge: hidden ? "" : "__hidden__" };
    await fetch(`${API_BASE}/products/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": getAdminToken(),
      },
      body: JSON.stringify(payload),
    });
    await fetchProducts();
  } catch (err) {
    alert("No se pudo actualizar publicación");
  }
}

async function duplicateProduct(id) {
  try {
    const prod = products.find((p) => p.id === id);
    if (!prod) return;
    const images = Array.isArray(prod.images) ? prod.images : prod.images ? [prod.images] : [];
    const body = {
      name: `${prod.name || "Producto"} (copia)`,
      price: prod.price || 0,
      size: prod.size || "",
      type: prod.type || "product",
      badge: prod.badge === "__hidden__" ? "" : prod.badge || "",
      description: prod.description || "",
      images,
    };
    if (prod.weight_g) body.weight_g = prod.weight_g;
    if (prod.length_cm) body.length_cm = prod.length_cm;
    if (prod.width_cm) body.width_cm = prod.width_cm;
    if (prod.height_cm) body.height_cm = prod.height_cm;
    await fetch(`${API_BASE}/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": getAdminToken(),
      },
      body: JSON.stringify(body),
    });
    await fetchProducts();
  } catch (err) {
    alert("No se pudo duplicar el producto");
  }
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

// ---------- Selecciones masivas ----------
selectAll?.addEventListener("change", () => {
  if (!currentPageIds.length) return;
  if (selectAll.checked) {
    currentPageIds.forEach((id) => selectedOrders.add(id));
  } else {
    currentPageIds.forEach((id) => selectedOrders.delete(id));
  }
  renderOrders();
});

async function bulkStatus(status) {
  const ids = Array.from(selectedOrders);
  if (!ids.length) return showToast("Selecciona al menos una orden");
  await Promise.all(
    ids.map((id) =>
      fetch(`${API_BASE}/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
        body: JSON.stringify({ status }),
      })
    )
  );
  showToast(`Estado actualizado (${status})`);
  await fetchOrders();
}

async function bulkDeleteOrders() {
  const ids = Array.from(selectedOrders);
  if (!ids.length) return showToast("Selecciona al menos una orden");
  if (!confirm(`Eliminar ${ids.length} pedido(s)?`)) return;
  await Promise.all(
    ids.map((id) =>
      fetch(`${API_BASE}/orders/${id}`, {
        method: "DELETE",
        headers: { "x-admin-token": adminToken },
      })
    )
  );
  selectedOrders.clear();
  showToast("Pedidos eliminados");
  await fetchOrders();
}

function bulkExportCsv() {
  const ids = Array.from(selectedOrders);
  if (!ids.length) return showToast("Selecciona al menos una orden");
  const byId = new Map(orders.map((o) => [o.order_id, o]));
  const rows = ids.map((id) => byId.get(id)).filter(Boolean);
  if (!rows.length) return showToast("No hay datos para exportar");
  const header = [
    "order_id",
    "nombre",
    "email",
    "telefono",
    "total",
    "estado",
    "creado",
    "notas",
    "items",
  ];
  const csv = [
    header.join(","),
    ...rows.map((o) => {
      const items = safeItems(o.items_json)
        .map((i) => `${(i.title || i.name || "").replace(/,/g, " ")} x${i.quantity || i.qty || 1}`)
        .join(" | ");
      const cols = [
        o.order_id || "",
        (o.name || "").replace(/,/g, " "),
        (o.email || "").replace(/,/g, " "),
        (o.phone || "").replace(/,/g, " "),
        o.total || "",
        o.status || "",
        o.created_at || "",
        (o.notes || "").replace(/,/g, " "),
        items,
      ];
      return cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",");
    }),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pedidos-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("CSV generado");
}

bulkPending?.addEventListener("click", () => bulkStatus("pending"));
bulkApproved?.addEventListener("click", () => bulkStatus("approved"));
bulkCancelled?.addEventListener("click", () => bulkStatus("cancelled"));
bulkDelete?.addEventListener("click", bulkDeleteOrders);
bulkExport?.addEventListener("click", bulkExportCsv);

function updateSelectAllState() {
  if (!selectAll) return;
  const checks = Array.from(document.querySelectorAll(".row-check"));
  if (!checks.length) {
    selectAll.checked = false;
    selectAll.indeterminate = false;
    return;
  }
  const checkedCount = checks.filter((c) => c.checked).length;
  selectAll.checked = checkedCount === checks.length;
  selectAll.indeterminate = checkedCount > 0 && checkedCount < checks.length;
}

function showToast(message = "") {
  if (!toast) return alert(message);
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}
