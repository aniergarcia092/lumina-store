const API = window.API_BASE;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const state = {
  products: [],
  categories: [],
  content: {},
  cart: JSON.parse(localStorage.getItem("cart") || "[]"),
  selected: null
};

/* =========================================================
   HELPERS
========================================================= */
const money = (n, c = "USD") => new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: c || "USD",
  maximumFractionDigits: 2
}).format(Number(n) || 0);

const img = (p) => p?.imagenes?.[0] || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80";

function toast(msg) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2500);
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

async function api(path, opts = {}) {
  const r = await fetch(API + path, opts);
  let d = {};
  try { d = await r.json(); } catch {}
  if (!r.ok) throw new Error(d.error || "Error de conexión");
  return d;
}

function whatsappUrl(text) {
  const n = String(state.content.whatsapp || "").replace(/\D/g, "");
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : "#";
}

/* =========================================================
   LIKES + ESTRELLAS — Storage
========================================================= */
const KEY_LIKES = "lumina_likes_v1";
const KEY_RATINGS = "lumina_ratings_v1";

function loadLikes() {
  try { return JSON.parse(localStorage.getItem(KEY_LIKES)) || {}; }
  catch { return {}; }
}

function saveLikes(data) {
  localStorage.setItem(KEY_LIKES, JSON.stringify(data));
}

function loadRatings() {
  try { return JSON.parse(localStorage.getItem(KEY_RATINGS)) || {}; }
  catch { return {}; }
}

function saveRatings(data) {
  localStorage.setItem(KEY_RATINGS, JSON.stringify(data));
}

function isLiked(id) {
  return !!loadLikes()[id];
}

function toggleLike(id) {
  const likes = loadLikes();
  if (likes[id]) {
    delete likes[id];
  } else {
    likes[id] = Date.now();
  }
  saveLikes(likes);
  return !!likes[id];
}

function getRating(id) {
  const r = loadRatings()[id];
  return r ? r.value : 0;
}

function setRating(id, value) {
  const ratings = loadRatings();
  ratings[id] = { value, timestamp: Date.now() };
  saveRatings(ratings);
}

/* =========================================================
   CARRITO
========================================================= */
function saveCart() {
  localStorage.setItem("cart", JSON.stringify(state.cart));
  renderCart();
}

function cartQty() {
  return state.cart.reduce((s, i) => s + i.cantidad, 0);
}

function renderCart() {
  $("#cartCount").textContent = cartQty();

  const box = $("#cartItems");
  if (!state.cart.length) {
    box.innerHTML = '<div class="empty">Tu carrito está vacío.</div>';
  } else {
    box.innerHTML = state.cart.map((i, idx) => `
      <div class="cart-item">
        <img src="${img(i)}" alt="">
        <div>
          <strong>${escapeHtml(i.nombre)}</strong>
          <div class="muted">${money(i.precio, i.moneda)}</div>
          <div class="qty">
            <button data-q="${idx}" data-d="-1">−</button>
            <span>${i.cantidad}</span>
            <button data-q="${idx}" data-d="1">+</button>
            <button data-remove="${idx}" style="border:0;background:none;color:var(--danger)">Eliminar</button>
          </div>
        </div>
        <strong>${money(i.precio * i.cantidad, i.moneda)}</strong>
      </div>
    `).join("");
  }

  box.querySelectorAll("[data-q]").forEach(b => b.onclick = () => {
    const i = state.cart[+b.dataset.q];
    i.cantidad += +b.dataset.d;
    if (i.cantidad <= 0) state.cart.splice(+b.dataset.q, 1);
    saveCart();
  });

  box.querySelectorAll("[data-remove]").forEach(b => b.onclick = () => {
    state.cart.splice(+b.dataset.remove, 1);
    saveCart();
  });

  const sub = state.cart.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const ship = Number(state.content.envio_base || 0);
  const total = sub + ship;

  $("#cartSubtotal").textContent = money(sub, state.content.moneda);
  $("#cartShipping").textContent = money(ship, state.content.moneda);
  $("#cartTotal").textContent = money(total, state.content.moneda);
}

/* =========================================================
   PRODUCT CARD — con Like + Estrellas
========================================================= */
function productCard(p) {
  const hasOffer = p.precio_oferta != null && p.precio_oferta < p.precio;
  const price = hasOffer ? p.precio_oferta : p.precio;

  const liked = isLiked(p.id);
  const rating = getRating(p.id);

  const starsHtml = [1, 2, 3, 4, 5].map(i => `
    <button
      class="star ${i <= rating ? 'filled' : ''}"
      data-star="${i}"
      data-product="${p.id}"
      aria-label="Calificar con ${i} estrellas"
      title="Calificar con ${i} estrellas"
    >★</button>
  `).join("");

  return `
    <article class="product-card" data-product-id="${p.id}">
      <div class="product-image">
        <img loading="lazy" src="${img(p)}" alt="${escapeHtml(p.nombre)}">
        ${hasOffer ? '<span class="badge">OFERTA</span>' : ""}
        ${p.stock <= 0 ? '<span class="badge" style="background:var(--danger);color:white">AGOTADO</span>' : ""}

        <button
          class="like-btn ${liked ? 'liked' : ''}"
          data-like="${p.id}"
          aria-label="${liked ? 'Quitar de favoritos' : 'Añadir a favoritos'}"
          title="${liked ? 'Quitar de favoritos' : 'Añadir a favoritos'}"
        >${liked ? "♥" : "♡"}</button>
      </div>

      <div class="product-info">
        <div class="product-cat">${escapeHtml(p.categoria_nombre || "Producto")}</div>
        <div class="product-name">${escapeHtml(p.nombre)}</div>

        <div class="stars" data-stars-for="${p.id}">
          ${starsHtml}
          <span class="stars-count">
            ${rating > 0 ? `${rating}/5` : 'Sin calificar'}
          </span>
        </div>

        <div class="prices">
          <span class="price">${money(price, p.moneda)}</span>
          ${hasOffer ? `<span class="old">${money(p.precio, p.moneda)}</span>` : ""}
        </div>

        <div class="product-actions">
          <button class="btn btn-ghost" data-detail="${p.id}">Ver</button>
          <button class="btn btn-primary" data-add="${p.id}" ${p.stock <= 0 ? "disabled" : ""}>Añadir</button>
        </div>
      </div>
    </article>
  `;
}

function renderGrid(list, selector) {
  const el = $(selector);
  if (!el) return;
  el.innerHTML = list.length
    ? list.map(productCard).join("")
    : '<div class="empty">No encontramos productos con esos filtros.</div>';
  bindProducts(el);
}

/* =========================================================
   BIND — Productos, Likes y Estrellas
========================================================= */
function bindProducts(el = document) {
  el.querySelectorAll("[data-detail]").forEach(b => b.onclick = () => openProduct(+b.dataset.detail));
  el.querySelectorAll("[data-add]").forEach(b => b.onclick = () => addProduct(+b.dataset.add));

  // ✅ Likes (solo productos)
  el.querySelectorAll("[data-like]").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const id = +btn.dataset.like;
      const nowLiked = toggleLike(id);

      btn.classList.toggle("liked", nowLiked);
      btn.textContent = nowLiked ? "♥" : "♡";
      btn.setAttribute("aria-label", nowLiked ? "Quitar de favoritos" : "Añadir a favoritos");
      btn.setAttribute("title", nowLiked ? "Quitar de favoritos" : "Añadir a favoritos");

      btn.classList.add("pulse");
      setTimeout(() => btn.classList.remove("pulse"), 500);

      toast(nowLiked ? "❤️ Añadido a favoritos" : "Quitado de favoritos");
    };
  });

  // ✅ Estrellas (solo productos)
  el.querySelectorAll(".stars [data-star]").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const id = +btn.dataset.product;
      const value = +btn.dataset.star;

      setRating(id, value);

      const container = el.querySelector(`.stars[data-stars-for="${id}"]`);
      if (container) {
        container.querySelectorAll("[data-star]").forEach((s, i) => {
          s.classList.toggle("filled", (i + 1) <= value);
        });

        const countEl = container.querySelector(".stars-count");
        if (countEl) countEl.textContent = `${value}/5`;
      }

      toast(`⭐ Calificado con ${value} ${value === 1 ? 'estrella' : 'estrellas'}`);
    };

    btn.onmouseenter = () => {
      const id = +btn.dataset.product;
      const value = +btn.dataset.star;
      const container = el.querySelector(`.stars[data-stars-for="${id}"]`);
      if (!container) return;

      container.querySelectorAll("[data-star]").forEach((s, i) => {
        s.classList.toggle("filled", (i + 1) <= value);
      });
    };

    btn.onmouseleave = () => {
      const id = +btn.dataset.product;
      const rating = getRating(id);
      const container = el.querySelector(`.stars[data-stars-for="${id}"]`);
      if (!container) return;

      container.querySelectorAll("[data-star]").forEach((s, i) => {
        s.classList.toggle("filled", (i + 1) <= rating);
      });
    };
  });
}

/* =========================================================
   AÑADIR AL CARRITO
========================================================= */
function addProduct(id, opts = {}) {
  const p = state.products.find(x => x.id === id);
  if (!p || p.stock <= 0) return toast("Producto agotado");

  const price = p.precio_oferta != null && p.precio_oferta < p.precio
    ? p.precio_oferta
    : p.precio;

  const key = `${id}|${opts.talla || ""}|${opts.color || ""}`;
  const found = state.cart.find(x => x.key === key);

  if (found) {
    if (found.cantidad >= p.stock) return toast("No hay más unidades disponibles");
    found.cantidad++;
  } else {
    state.cart.push({
      key,
      id: p.id,
      nombre: p.nombre,
      precio: price,
      moneda: p.moneda,
      imagen: img(p),
      imagenes: p.imagenes,
      cantidad: 1,
      talla: opts.talla || "",
      color: opts.color || ""
    });
  }

  saveCart();
  toast("Añadido al carrito");
}

/* =========================================================
   MODAL PRODUCTO
========================================================= */
function openProduct(id) {
  const p = state.products.find(x => x.id === id);
  if (!p) return;

  state.selected = {
    p,
    talla: p.tallas?.[0] || "",
    color: p.colores?.[0] || "",
    cantidad: 1
  };

  const hasOffer = p.precio_oferta != null && p.precio_oferta < p.precio;
  const price = hasOffer ? p.precio_oferta : p.precio;

  $("#productDetail").innerHTML = `
    <div>
      <div class="gallery-main">
        <img id="mainProductImg" src="${img(p)}" alt="">
      </div>
      <div class="thumbs">
        ${(p.imagenes || [img(p)]).map((u, i) => `
          <img src="${u}" data-thumb="${u}" class="${i === 0 ? "selected" : ""}" alt="">
        `).join("")}
      </div>
    </div>
    <div class="detail">
      <div class="product-cat">${escapeHtml(p.categoria_nombre || "")}</div>
      <h2>${escapeHtml(p.nombre)}</h2>
      <div class="prices">
        <span class="price">${money(price, p.moneda)}</span>
        ${hasOffer ? `<span class="old">${money(p.precio, p.moneda)}</span>` : ""}
      </div>
      <p class="muted">${escapeHtml(p.descripcion_larga || p.descripcion_corta || "")}</p>

      ${p.tallas?.length ? `
        <div class="choice">
          <label>Talla</label>
          <div class="choices">
            ${p.tallas.map(x => `
              <button data-choice="talla" data-value="${escapeHtml(x)}">${escapeHtml(x)}</button>
            `).join("")}
          </div>
        </div>
      ` : ""}

      ${p.colores?.length ? `
        <div class="choice">
          <label>Color</label>
          <div class="choices">
            ${p.colores.map(x => `
              <button data-choice="color" data-value="${escapeHtml(x)}">${escapeHtml(x)}</button>
            `).join("")}
          </div>
        </div>
      ` : ""}

      <div class="choice">
        <label>Cantidad</label>
        <div class="qty">
          <button id="decDetail">−</button>
          <strong id="detailQty">1</strong>
          <button id="incDetail">+</button>
        </div>
      </div>

      <button class="btn btn-primary" id="detailAdd" style="width:100%" ${p.stock <= 0 ? "disabled" : ""}>
        Añadir al carrito
      </button>

      <a class="btn btn-ghost" id="detailWhats" target="_blank" rel="noopener" style="width:100%;margin-top:8px">
        Comprar por WhatsApp
      </a>
    </div>
  `;

  $("#productModal").classList.add("open");

  const setChoice = () => {
    $$("#productDetail [data-choice]").forEach(b => {
      b.classList.toggle("selected", b.dataset.value === state.selected[b.dataset.choice]);
    });
  };

  $$("#productDetail [data-choice]").forEach(b => b.onclick = () => {
    state.selected[b.dataset.choice] = b.dataset.value;
    setChoice();
  });

  setChoice();

  $$("#productDetail [data-thumb]").forEach(b => b.onclick = () => {
    $("#mainProductImg").src = b.dataset.thumb;
  });

  $("#decDetail").onclick = () => {
    state.selected.cantidad = Math.max(1, state.selected.cantidad - 1);
    $("#detailQty").textContent = state.selected.cantidad;
  };

  $("#incDetail").onclick = () => {
    state.selected.cantidad = Math.min(p.stock, state.selected.cantidad + 1);
    $("#detailQty").textContent = state.selected.cantidad;
  };

  $("#detailAdd").onclick = () => {
    for (let i = 0; i < state.selected.cantidad; i++) {
      addProduct(p.id, { talla: state.selected.talla, color: state.selected.color });
    }
    $("#productModal").classList.remove("open");
  };

  $("#detailWhats").href = whatsappUrl(
    `Hola, quiero comprar: ${p.nombre}` +
    `${state.selected.talla ? ` | Talla: ${state.selected.talla}` : ""}` +
    `${state.selected.color ? ` | Color: ${state.selected.color}` : ""}`
  );
}

/* =========================================================
   LOAD — Carga inicial
========================================================= */
async function load() {
  try {
    state.content = await api("/contenido");
    document.documentElement.style.setProperty("--accent", state.content.color_acento || "#a3e635");

    const heroTitle = $("#heroTitle");
    const heroSubtitle = $("#heroSubtitle");
    const heroBtn = $("#heroBtn");
    const heroBg = $("#heroBg");
    const heroProductImg = $("#heroProductImg");

    if (heroTitle) {
      const titulo = state.content.hero_titulo || "Power Up Your World.";
      if (/world/i.test(titulo)) {
        const partes = titulo.split(/(world\.?)/i);
        heroTitle.innerHTML = partes.map(p =>
          /world/i.test(p) ? `<span class="hero-script">${p}</span>` : p
        ).join("");
      } else {
        heroTitle.textContent = titulo;
      }
    }

    if (heroSubtitle) {
      heroSubtitle.textContent = state.content.hero_subtitulo ||
        "Smart. Sleek. Reliable. Gadgets that keep you ahead.";
    }

    if (heroBtn) {
      const btnText = state.content.hero_boton || "SHOP NOW";
      heroBtn.innerHTML = `${btnText} <span class="arrow">→</span>`;
    }

    if (heroProductImg && state.content.logo) {
      heroProductImg.src = state.content.logo;
    }

    if (heroBg && state.content.logo) {
      heroBg.style.backgroundImage = `linear-gradient(90deg,rgba(15,15,18,.92),rgba(15,15,18,.25)),url("${state.content.logo}")`;
    }

    $("#topContact").textContent = state.content.contacto_telefono || "";
    $("#footerPhone").textContent = state.content.contacto_telefono || "";
    $("#footerEmail").textContent = state.content.contacto_email || "";
    $("#footerAddress").textContent = state.content.contacto_direccion || "";

    $("#instagramLink").href = state.content.instagram || "#";
    $("#whatsappBtn").href = whatsappUrl("Hola, quiero información sobre sus productos.");

    state.categories = await api("/categorias");
    state.products = await api("/productos");

    /* =========================================================
       RENDERIZAR CATEGORÍAS — SIN like ni estrellas
    ========================================================= */
    $("#categoryGrid").innerHTML = state.categories.map((c, i) => {
      const tieneImagen = c.imagen_url && c.imagen_url.trim() !== "";
      const bgStyle = tieneImagen
        ? `background-image: url('${c.imagen_url}')`
        : `background: linear-gradient(135deg, hsl(${(i * 40) % 360}, 60%, 55%), hsl(${(i * 40 + 40) % 360}, 70%, 35%))`;

      return `
        <a class="category-card" href="#catalogo" data-cat="${c.id}" style="${bgStyle}">
          <div class="category-overlay"></div>
          <div class="category-name">${escapeHtml(c.nombre)}</div>
        </a>
      `;
    }).join("");

    $("#categoryFilter").innerHTML = '<option value="">Todas las categorías</option>' +
      state.categories.map(c => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join("");

    $$("#categoryGrid [data-cat]").forEach(a => a.onclick = () => {
      $("#categoryFilter").value = a.dataset.cat;
      applyFilters();
    });

    renderGrid(state.products.filter(p => p.destacado), "#featuredGrid");
    renderGrid(state.products.filter(p => p.precio_oferta != null && p.precio_oferta < p.precio), "#offersGrid");
    renderGrid(state.products, "#productGrid");

    renderCart();
    iniciarCountdown();

  } catch (e) {
    console.error("Error en load():", e);
    toast(e.message);
  }
}

/* =========================================================
   FILTROS
========================================================= */
async function applyFilters() {
  const params = new URLSearchParams();
  const q = $("#catalogSearch").value.trim();
  if (q) params.set("q", q);
  if ($("#categoryFilter").value) params.set("categoria", $("#categoryFilter").value);
  if ($("#stockFilter").value) params.set("stock", $("#stockFilter").value);
  if ($("#minPrice").value) params.set("min", $("#minPrice").value);
  if ($("#maxPrice").value) params.set("max", $("#maxPrice").value);
  params.set("sort", $("#sortFilter").value);

  try {
    const productos = await api("/productos?" + params.toString());
    renderGrid(productos, "#productGrid");
  } catch (e) {
    toast(e.message);
  }
}

/* =========================================================
   COUNTDOWN TIMER
========================================================= */
function iniciarCountdown() {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 2);
  targetDate.setHours(targetDate.getHours() + 15);
  targetDate.setMinutes(45);
  targetDate.setSeconds(30);

  function update() {
    const now = new Date();
    const diff = targetDate - now;

    if (diff <= 0) return;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    const pad = (n) => String(n).padStart(2, "0");

    const cdDays = document.getElementById("cdDays");
    const cdHours = document.getElementById("cdHours");
    const cdMinutes = document.getElementById("cdMinutes");
    const cdSeconds = document.getElementById("cdSeconds");

    if (cdDays) cdDays.textContent = pad(days);
    if (cdHours) cdHours.textContent = pad(hours);
    if (cdMinutes) cdMinutes.textContent = pad(minutes);
    if (cdSeconds) cdSeconds.textContent = pad(seconds);

    const topCountdown = document.getElementById("topCountdown");
    if (topCountdown) {
      topCountdown.textContent = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
  }

  update();
  setInterval(update, 1000);
}

/* =========================================================
   EVENT LISTENERS
========================================================= */
$$("[data-close]").forEach(b => b.onclick = () => $("#" + b.dataset.close).classList.remove("open"));

$("#cartBtn").onclick = () => $("#cartDrawer").classList.add("open");

$("#checkoutBtn").onclick = () => {
  if (!state.cart.length) return toast("Tu carrito está vacío");
  $("#cartDrawer").classList.remove("open");
  $("#checkoutModal").classList.add("open");
};

["catalogSearch", "categoryFilter", "stockFilter", "sortFilter"].forEach(id => {
  const el = $("#" + id);
  if (el) el.addEventListener("input", applyFilters);
});

$("#filterBtn").onclick = applyFilters;

$("#checkoutForm").onsubmit = async e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const data = Object.fromEntries(fd.entries());
  data.items = state.cart;
  data.envio = Number(state.content.envio_base || 0);

  try {
    const r = await api("/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    state.cart = [];
    saveCart();
    e.target.reset();
    $("#checkoutModal").classList.remove("open");
    toast(`Pedido ${r.codigo} recibido`);

    setTimeout(() => {
      if (state.content.whatsapp) {
        location.href = whatsappUrl(`Hola, acabo de realizar el pedido ${r.codigo}. Total: ${money(r.total, r.moneda)}.`);
      }
    }, 800);
  } catch (err) {
    toast(err.message);
  }
};

$("#newsletterForm").onsubmit = e => {
  e.preventDefault();
  toast("¡Gracias! Te has suscrito.");
  e.target.reset();
};

$("#themeBtn").onclick = () => {
  const light = document.documentElement.dataset.theme === "light";
  document.documentElement.dataset.theme = light ? "" : "light";
  localStorage.setItem("theme", light ? "dark" : "light");
};

if (localStorage.getItem("theme") === "light") {
  document.documentElement.dataset.theme = "light";
}

$("#searchInput").oninput = e => {
  $("#catalogSearch").value = e.target.value;
  applyFilters();
};

/* =========================================================
   INICIALIZACIÓN
========================================================= */
load();