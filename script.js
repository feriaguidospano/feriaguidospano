const API_URL = "https://script.google.com/macros/s/AKfycbyp5jDSmeVW9DLTVqhOy9ERkMJJ1-e6tLD_ux_5fG6YNnM-NLesX2eiEUAaD7Ld2U7m/exec";
const STORAGE_KEY = "ngs_carrito_v1";

const state = {
  products: [],
  cart: loadCart(),
  lastSummaryText: "",
  lastWhatsAppText: ""
};

const productsGrid = document.getElementById("productsGrid");
const productsStatus = document.getElementById("productsStatus");
const reloadProductsBtn = document.getElementById("reloadProductsBtn");

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

function formatCurrency(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
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

async function fetchProducts() {
  setStatus(productsStatus, "Cargando productos...");
  productsGrid.innerHTML = "";
  reloadProductsBtn.disabled = true;

  try {
    const response = await fetch(API_URL, { method: "GET" });
    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error("La respuesta de productos no es valida.");
    }

    state.products = data.filter((p) => p && p.Activo === true);
    if (!state.products.length) {
      setStatus(productsStatus, "No hay productos activos para mostrar.");
      return;
    }

    renderProducts();
    setStatus(productsStatus, `Se cargaron ${state.products.length} productos.`, "success");
  } catch (error) {
    setStatus(productsStatus, `No se pudieron cargar los productos: ${error.message}`, "error");
  } finally {
    reloadProductsBtn.disabled = false;
  }
}

function renderProducts() {
  productsGrid.innerHTML = "";

  state.products.forEach((product) => {
    const card = document.createElement("article");
    card.className = "product-card";

    const category = product.Categoria ? `Categoria: ${product.Categoria}` : "Sin categoria";

    card.innerHTML = `
      <p class="product-name">${escapeHtml(product.Nombre || "Producto")}</p>
      <p class="product-meta">${escapeHtml(category)}</p>
      <p class="product-price">${formatCurrency(Number(product.Precio) || 0)}</p>
    `;

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "primary-btn";
    addBtn.textContent = "Agregar al carrito";
    addBtn.addEventListener("click", () => addToCart(product));

    card.appendChild(addBtn);
    productsGrid.appendChild(card);
  });
}

function addToCart(product) {
  const nombre = String(product.Nombre || "").trim();
  if (!nombre) return;

  const precio = Number(product.Precio) || 0;

  if (state.cart[nombre]) {
    state.cart[nombre].cantidad += 1;
  } else {
    state.cart[nombre] = { nombre, precio, cantidad: 1 };
  }

  saveCart();
  renderCart();
}

function increaseQty(name) {
  if (!state.cart[name]) return;
  state.cart[name].cantidad += 1;
  saveCart();
  renderCart();
}

function decreaseQty(name) {
  if (!state.cart[name]) return;
  state.cart[name].cantidad -= 1;
  if (state.cart[name].cantidad <= 0) {
    delete state.cart[name];
  }
  saveCart();
  renderCart();
}

function removeFromCart(name) {
  if (!state.cart[name]) return;
  delete state.cart[name];
  saveCart();
  renderCart();
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

    const left = document.createElement("div");
    left.innerHTML = `
      <p><strong>${escapeHtml(item.nombre)}</strong></p>
      <p class="product-meta">${formatCurrency(item.precio)} x ${item.cantidad}</p>
    `;

    const actions = document.createElement("div");
    actions.className = "cart-actions";
    actions.innerHTML = `
      <button class="qty-btn" type="button" aria-label="Disminuir cantidad">-</button>
      <span>${item.cantidad}</span>
      <button class="qty-btn" type="button" aria-label="Aumentar cantidad">+</button>
      <button class="danger-btn" type="button">Eliminar</button>
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
    line.innerHTML = `
      <span>${escapeHtml(item.nombre)} x${item.cantidad}</span>
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
    cantidad: item.cantidad,
    precio: item.precio
  }));

  return {
    nombre: formDataObj.nombre.trim(),
    apellido: formDataObj.apellido.trim(),
    telefono: formDataObj.telefono.trim(),
    email: formDataObj.email.trim(),
    productos,
    total: getCartTotal()
  };
}

function buildSummaryText(payload, orderId = "sin ID") {
  const lines = [
    "Pedido - Nuevo Guido Spano",
    `ID: ${orderId}`,
    `Cliente: ${payload.nombre} ${payload.apellido}`,
    `Telefono: ${payload.telefono}`,
    `Email: ${payload.email || "-"}`,
    "",
    "Productos:"
  ];

  payload.productos.forEach((p, i) => {
    lines.push(`${i + 1}. ${p.nombre} x${p.cantidad} - ${formatCurrency(p.precio * p.cantidad)}`);
  });

  lines.push("");
  lines.push(`Total: ${formatCurrency(payload.total)}`);
  lines.push("Retiro presencial.");

  return lines.join("\n");
}

async function submitOrder(payload) {
  const response = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  const text = await response.text(); // Apps Script a veces no responde bien como JSON directo

  try {
    return JSON.parse(text);
  } catch {
    return { status: "ok", raw: text };
  }
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

  try {
    confirmOrderBtn.disabled = true;
    setStatus(formMessage, "Enviando pedido...");

    const result = await submitOrder(payload);
    const orderId = result.id || result.ID || result.pedidoId || "sin ID";

    setStatus(formMessage, `Pedido realizado con exito. ID del pedido: ${orderId}`, "success");

    const summaryText = buildSummaryText(payload, orderId);
    state.lastSummaryText = summaryText;
    state.lastWhatsAppText = encodeURIComponent(summaryText);

    orderSummary.textContent = summaryText;
    copySummaryBtn.disabled = false;
    whatsappBtn.disabled = false;

    state.cart = {};
    saveCart();
    renderCart();
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

reloadProductsBtn.addEventListener("click", fetchProducts);
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
fetchProducts();