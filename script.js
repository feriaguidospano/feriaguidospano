const CATALOG_URL = "productos.json";
const STORAGE_KEY = "ngs_carrito_v1";
// Pegá acá la URL de tu Web App de Google Apps Script (Implementar > Aplicación web)
const SHEETS_API_URL =
  "https://script.google.com/macros/s/AKfycbxeoXOPbATysq5JFP4vLbNfHxJ3ry_1VJPilgzZqB0dxgtv4EmmvEPfJ2gNeEuf6dCM2g/exec";

const state = {
  catalog: null,
  products: [],
  cart: loadCart(),
  lastSummaryText: "",
  lastWhatsAppText: ""
};

const productsGrid = document.getElementById("productsGrid");
const productsStatus = document.getElementById("productsStatus");
const catalogDate = document.getElementById("catalogDate");
const catalogNotes = document.getElementById("catalogNotes");

const cartItems = document.getElementById("cartItems");
const cartTotal = document.getElementById("cartTotal");
const cartPanel = document.getElementById("cartPanel");
const goToCartBtn = document.getElementById("goToCartBtn");
const reviewCartBtn = document.getElementById("reviewCartBtn");

const checkoutForm = document.getElementById("checkoutForm");
const formMessage = document.getElementById("formMessage");
const checkoutModal = document.getElementById("checkoutModal");
const closeCheckoutBtn = document.getElementById("closeCheckoutBtn");
const checkoutPreview = document.getElementById("checkoutPreview");
const checkoutTotal = document.getElementById("checkoutTotal");
const confirmOrderBtn = document.getElementById("confirmOrderBtn");

const orderSummary = document.getElementById("orderSummary");
const copySummaryBtn = document.getElementById("copySummaryBtn");
const whatsappBtn = document.getElementById("whatsappBtn");
const catalogFileInput = document.getElementById("catalogFileInput");

function formatCurrency(value) {
  const moneda = state.catalog?.moneda || "ARS";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: moneda,
    maximumFractionDigits: 0
  }).format(value || 0);
}

function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch (_) {
    return {};
  }
}

function saveCart() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cart));
}

function getCartArray() {
  return Object.values(state.cart);
}

function getCartTotal() {
  return getCartArray().reduce((acc, item) => acc + item.precio * item.cantidad, 0);
}

function setStatus(el, msg, type = "") {
  el.textContent = msg;
  el.classList.remove("error", "success");
  if (type) {
    el.classList.add(type);
  }
}

function findProduct(nombre) {
  return state.products.find((p) => p.nombre === nombre);
}

function getQuantityOptions(product) {
  const options = product?.cantidad_opciones;
  if (Array.isArray(options) && options.length) {
    return options;
  }
  return [0, 1, 2, 3, 4];
}

function nextQuantity(current, options, direction) {
  const index = options.indexOf(current);
  if (index === -1) {
    return direction > 0 ? options[0] : options[options.length - 1];
  }
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= options.length) {
    return current;
  }
  return options[nextIndex];
}

function applyCatalog(data) {
  if (!data || !Array.isArray(data.productos)) {
    throw new Error("El archivo de productos no es valido.");
  }

  state.catalog = data;
  state.products = data.productos;
  renderCatalogMeta();
  renderProducts();
  syncProductSelectors();
  setStatus(productsStatus, `${state.products.length} productos listos.`, "success");
}

function readCatalogFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)));
      } catch (_) {
        reject(new Error("El archivo JSON no es valido."));
      }
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsText(file, "UTF-8");
  });
}

function promptCatalogFile() {
  setStatus(
    productsStatus,
    "Selecciona productos.json (misma carpeta que index.html) para cargar la lista.",
    "error"
  );
  catalogFileInput.click();
}

async function loadCatalog() {
  setStatus(productsStatus, "Cargando productos...");
  productsGrid.innerHTML = "";

  try {
    const response = await fetch(CATALOG_URL);
    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status}`);
    }
    applyCatalog(await response.json());
  } catch (error) {
    if (location.protocol === "file:") {
      promptCatalogFile();
      return;
    }
    setStatus(productsStatus, `No se pudieron cargar los productos: ${error.message}`, "error");
  }
}

catalogFileInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;

  try {
    applyCatalog(await readCatalogFile(file));
  } catch (error) {
    setStatus(productsStatus, error.message, "error");
  }
});

function renderCatalogMeta() {
  const { fecha, notas_generales: notas } = state.catalog || {};

  if (fecha) {
    catalogDate.textContent = `Lista del ${fecha}`;
  } else {
    catalogDate.textContent = "";
  }

  catalogNotes.innerHTML = "";
  if (!Array.isArray(notas) || !notas.length) {
    catalogNotes.hidden = true;
    return;
  }

  const list = document.createElement("ul");
  notas.forEach((nota) => {
    const item = document.createElement("li");
    item.textContent = nota;
    list.appendChild(item);
  });

  catalogNotes.appendChild(list);
  catalogNotes.hidden = false;
}

function groupProductsByCategory() {
  const groups = new Map();
  state.products.forEach((product) => {
    const categoria = product.categoria || "Otros";
    if (!groups.has(categoria)) {
      groups.set(categoria, []);
    }
    groups.get(categoria).push(product);
  });
  return groups;
}

function renderProducts() {
  productsGrid.innerHTML = "";
  const groups = groupProductsByCategory();

  groups.forEach((products, categoria) => {
    const section = document.createElement("section");
    section.className = "category-block";

    const heading = document.createElement("h3");
    heading.className = "category-title";
    heading.textContent = categoria;
    section.appendChild(heading);

    const grid = document.createElement("div");
    grid.className = "products-grid";

    products.forEach((product) => {
      grid.appendChild(createProductCard(product));
    });

    section.appendChild(grid);
    productsGrid.appendChild(section);
  });
}

function createProductCard(product) {
  const card = document.createElement("article");
  card.className = "product-card";

  const metaParts = [product.unidad ? `Unidad: ${product.unidad}` : null];
  if (product.procedencia) {
    metaParts.push(`Procedencia: ${product.procedencia}`);
  }

  const detalleHtml = product.detalle
    ? `<p class="product-detail">${escapeHtml(product.detalle)}</p>`
    : "";

  card.innerHTML = `
    <p class="product-name">${escapeHtml(product.nombre || "Producto")}</p>
    <p class="product-meta">${escapeHtml(metaParts.filter(Boolean).join(" · "))}</p>
    ${detalleHtml}
    <p class="product-price">${formatCurrency(Number(product.precio) || 0)}</p>
  `;

  const options = getQuantityOptions(product);
  const qtyField = document.createElement("label");
  qtyField.className = "qty-field";
  qtyField.innerHTML = "Cantidad ";

  const qtySelect = document.createElement("select");
  qtySelect.className = "qty-select";
  options.forEach((qty) => {
    const option = document.createElement("option");
    option.value = String(qty);
    option.textContent = String(qty);
    qtySelect.appendChild(option);
  });

  const cartItem = state.cart[product.nombre];
  if (cartItem) {
    qtySelect.value = String(cartItem.cantidad);
  }

  qtyField.appendChild(qtySelect);

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "primary-btn";
  addBtn.textContent = "Actualizar carrito";
  addBtn.addEventListener("click", () => {
    const cantidad = Number(qtySelect.value);
    setCartQuantity(product, cantidad);
  });

  qtySelect.addEventListener("change", () => {
    const cantidad = Number(qtySelect.value);
    setCartQuantity(product, cantidad);
  });

  card.appendChild(qtyField);
  card.appendChild(addBtn);
  return card;
}

function setCartQuantity(product, cantidad) {
  const nombre = String(product.nombre || "").trim();
  if (!nombre) return;

  const precio = Number(product.precio) || 0;
  const opciones = getQuantityOptions(product);

  if (!opciones.includes(cantidad)) {
    return;
  }

  if (cantidad <= 0) {
    delete state.cart[nombre];
  } else {
    state.cart[nombre] = {
      nombre,
      precio,
      cantidad,
      unidad: product.unidad || "",
      categoria: product.categoria || ""
    };
  }

  saveCart();
  renderCart();
  syncProductSelectors();
}

function syncProductSelectors() {
  state.products.forEach((product) => {
    const cards = productsGrid.querySelectorAll(".product-card");
    cards.forEach((card) => {
      const nameEl = card.querySelector(".product-name");
      if (!nameEl || nameEl.textContent !== product.nombre) return;
      const select = card.querySelector(".qty-select");
      if (!select) return;
      const qty = state.cart[product.nombre]?.cantidad ?? 0;
      if ([...select.options].some((opt) => opt.value === String(qty))) {
        select.value = String(qty);
      }
    });
  });
}

function increaseQty(name) {
  const item = state.cart[name];
  const product = findProduct(name);
  if (!item || !product) return;

  const opciones = getQuantityOptions(product);
  const nueva = nextQuantity(item.cantidad, opciones, 1);
  setCartQuantity(product, nueva);
}

function decreaseQty(name) {
  const item = state.cart[name];
  const product = findProduct(name);
  if (!item || !product) return;

  const opciones = getQuantityOptions(product);
  const nueva = nextQuantity(item.cantidad, opciones, -1);
  setCartQuantity(product, nueva);
}

function removeFromCart(name) {
  const product = findProduct(name);
  if (!product) {
    delete state.cart[name];
    saveCart();
    renderCart();
    return;
  }
  setCartQuantity(product, 0);
}

function renderCart() {
  cartItems.innerHTML = "";
  const items = getCartArray();

  if (!items.length) {
    cartItems.innerHTML = "<p class='product-meta'>Todavia no agregaste productos.</p>";
    cartTotal.textContent = formatCurrency(0);
    reviewCartBtn.disabled = true;
    closeCheckoutModal();
    renderCheckoutPreview();
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "cart-row";

    const unidadLabel = item.unidad ? ` (${item.unidad})` : "";

    const left = document.createElement("div");
    left.innerHTML = `
      <p><strong>${escapeHtml(item.nombre)}</strong></p>
      <p class="product-meta">${formatCurrency(item.precio)} x ${item.cantidad}${escapeHtml(unidadLabel)}</p>
    `;

    const actions = document.createElement("div");
    actions.className = "cart-actions";
    actions.innerHTML = `
      <button class="qty-btn" type="button" aria-label="Disminuir cantidad">-</button>
      <span>${item.cantidad}</span>
      <button class="qty-btn" type="button" aria-label="Aumentar cantidad">+</button>
      <button class="danger-btn" type="button">Quitar</button>
    `;

    const [minusBtn, , plusBtn, removeBtn] = actions.children;
    minusBtn.addEventListener("click", () => decreaseQty(item.nombre));
    plusBtn.addEventListener("click", () => increaseQty(item.nombre));
    removeBtn.addEventListener("click", () => removeFromCart(item.nombre));

    row.appendChild(left);
    row.appendChild(actions);
    cartItems.appendChild(row);
  });

  cartTotal.textContent = formatCurrency(getCartTotal());
  reviewCartBtn.disabled = false;
  renderCheckoutPreview();
}

function openCheckoutModal() {
  checkoutModal.classList.remove("hidden");
  checkoutModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeCheckoutModal() {
  checkoutModal.classList.add("hidden");
  checkoutModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function renderCheckoutPreview() {
  const items = getCartArray();
  checkoutPreview.innerHTML = "";
  checkoutTotal.textContent = formatCurrency(getCartTotal());

  if (!items.length) {
    checkoutPreview.innerHTML = "<p class='product-meta'>Tu resumen aparecera aca cuando tengas productos en el carrito.</p>";
    return;
  }

  items.forEach((item) => {
    const line = document.createElement("div");
    line.className = "checkout-line";
    const unidad = item.unidad ? ` · ${item.unidad}` : "";
    line.innerHTML = `
      <span>${escapeHtml(item.nombre)} x${item.cantidad}${escapeHtml(unidad)}</span>
      <strong>${formatCurrency(item.precio * item.cantidad)}</strong>
    `;
    checkoutPreview.appendChild(line);
  });
}

function validateForm({ nombre, apellido, telefono, email }) {
  if (!nombre.trim() || !apellido.trim() || !telefono.trim()) {
    return "Completá nombre, apellido y telefono.";
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "El email no tiene un formato valido.";
  }

  if (!getCartArray().length) {
    return "Agregá al menos un producto antes de confirmar.";
  }

  return "";
}

function buildOrderPayload(formDataObj) {
  const productos = getCartArray().map((item) => ({
    nombre: item.nombre,
    categoria: item.categoria || "",
    cantidad: item.cantidad,
    precio: item.precio,
    unidad: item.unidad,
    subtotal: item.precio * item.cantidad
  }));

  return {
    nombre: formDataObj.nombre.trim(),
    apellido: formDataObj.apellido.trim(),
    telefono: formDataObj.telefono.trim(),
    email: formDataObj.email.trim(),
    productos,
    total: getCartTotal(),
    fecha_lista: state.catalog?.fecha || ""
  };
}

function submitOrderToSheet(payload) {
  if (!SHEETS_API_URL || SHEETS_API_URL.includes("TU_URL")) {
    return Promise.reject(new Error("Falta configurar SHEETS_API_URL en script.js"));
  }

  const form = document.getElementById("sheetsForm");
  const iframe = document.getElementById("sheetsFrame");
  const input = document.getElementById("sheetsPayload");

  if (!form || !iframe || !input) {
    return Promise.reject(new Error("Falta el formulario de envio a Google Sheets."));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const referencia = payload.referencia || createOrderReference();

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      iframe.removeEventListener("load", onLoad);
      delete form.dataset.submitted;
      resolve(result);
    };

    const fail = (message) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      iframe.removeEventListener("load", onLoad);
      delete form.dataset.submitted;
      reject(new Error(message));
    };

    const onLoad = () => {
      if (!form.dataset.submitted) return;
      finish({
        ok: true,
        id: referencia,
        referencia
      });
    };

    const timer = setTimeout(() => {
      fail("Tiempo de espera agotado. Revisa la planilla por si el pedido llego igual.");
    }, 20000);

    form.action = SHEETS_API_URL;
    input.value = JSON.stringify({ ...payload, referencia });
    form.dataset.submitted = "1";
    iframe.addEventListener("load", onLoad);
    form.submit();
  });
}

function buildSummaryText(payload, orderId = "sin referencia") {
  const lines = [
    "Pedido - Nuevo Guido Spano",
    `Referencia: ${orderId}`,
    state.catalog?.fecha ? `Lista: ${state.catalog.fecha}` : "",
    `Cliente: ${payload.nombre} ${payload.apellido}`,
    `Telefono: ${payload.telefono}`,
    `Email: ${payload.email || "-"}`,
    "",
    "Productos:"
  ].filter(Boolean);

  payload.productos.forEach((p, i) => {
    const unidad = p.unidad ? ` (${p.unidad})` : "";
    lines.push(`${i + 1}. ${p.nombre} x${p.cantidad}${unidad} - ${formatCurrency(p.precio * p.cantidad)}`);
  });

  lines.push("");
  lines.push(`Total: ${formatCurrency(payload.total)}`);
  lines.push("Retiro presencial.");

  return lines.join("\n");
}

function createOrderReference() {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  return `NGS-${stamp}`;
}

checkoutForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus(formMessage, "");

  const formData = new FormData(checkoutForm);
  const formValues = Object.fromEntries(formData.entries());
  const validationError = validateForm(formValues);

  if (validationError) {
    setStatus(formMessage, validationError, "error");
    return;
  }

  const payload = buildOrderPayload(formValues);
  const orderId = createOrderReference();
  const sheetPayload = {
    referencia: orderId,
    fecha_pedido: new Date().toISOString(),
    ...payload
  };

  try {
    confirmOrderBtn.disabled = true;
    setStatus(formMessage, "Enviando pedido a Google Sheets...");

    const result = await submitOrderToSheet(sheetPayload);
    if (result.ok === false) {
      throw new Error(result.error || "No se pudo guardar el pedido.");
    }

    const savedId = result.id || result.referencia || orderId;
    setStatus(
      formMessage,
      `Pedido guardado en la planilla. Referencia: ${savedId}`,
      "success"
    );

    const summaryText = buildSummaryText(payload, savedId);
    state.lastSummaryText = summaryText;
    state.lastWhatsAppText = encodeURIComponent(summaryText);

    orderSummary.textContent = summaryText;
    copySummaryBtn.disabled = false;
    whatsappBtn.disabled = false;

    state.cart = {};
    saveCart();
    renderCart();
    syncProductSelectors();
    closeCheckoutModal();
    checkoutForm.reset();
  } catch (error) {
    setStatus(formMessage, `No se pudo enviar el pedido: ${error.message}`, "error");
  } finally {
    confirmOrderBtn.disabled = false;
  }
});

copySummaryBtn.addEventListener("click", async () => {
  if (!state.lastSummaryText) return;
  try {
    await navigator.clipboard.writeText(state.lastSummaryText);
    setStatus(formMessage, "Resumen copiado al portapapeles.", "success");
  } catch (_) {
    setStatus(formMessage, "No se pudo copiar automaticamente. Seleccionalo manualmente.", "error");
  }
});

whatsappBtn.addEventListener("click", () => {
  if (!state.lastWhatsAppText) return;
  window.open(`https://wa.me/?text=${state.lastWhatsAppText}`, "_blank");
});

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

goToCartBtn.addEventListener("click", () => {
  cartPanel.scrollIntoView({ behavior: "smooth", block: "start" });
});
reviewCartBtn.addEventListener("click", () => {
  if (!getCartArray().length) {
    setStatus(formMessage, "Agrega productos antes de continuar.", "error");
    closeCheckoutModal();
    return;
  }
  renderCheckoutPreview();
  setStatus(formMessage, "");
  openCheckoutModal();
  document.getElementById("nombre").focus();
});
closeCheckoutBtn.addEventListener("click", closeCheckoutModal);
checkoutModal.addEventListener("click", (event) => {
  if (event.target.dataset.closeModal === "true") {
    closeCheckoutModal();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !checkoutModal.classList.contains("hidden")) {
    closeCheckoutModal();
  }
});

renderCart();
loadCatalog();
