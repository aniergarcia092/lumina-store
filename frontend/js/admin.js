const API = window.API_BASE;
const $ = s => document.querySelector(s);
const $all = s => [...document.querySelectorAll(s)];

let token = localStorage.getItem("admin_token");
let categories = [];
let products = [];
let content = {};

const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;"
}[m]));

const toast = m => {
  const x = $("#toast");
  x.textContent = m;
  x.classList.add("show");
  setTimeout(() => x.classList.remove("show"), 2300);
};

/* =========================================================
   API HELPER — Lee el token SIEMPRE de localStorage
========================================================= */
async function api(path, opts = {}) {
  const currentToken = localStorage.getItem("admin_token");

  opts.headers = {
    ...(opts.headers || {}),
    ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {})
  };

  const r = await fetch(API + path, opts);

  let d = {};
  try { d = await r.json(); } catch {}

  if (r.status === 401 || r.status === 403) {
    localStorage.removeItem("admin_token");
    token = null;
    $("#loginScreen").classList.remove("hidden");
    $("#adminApp").classList.add("hidden");
    throw Error(d.error || "Sesión expirada");
  }

  if (!r.ok) throw Error(d.error || "Error");
  return d;
}

/* =========================================================
   MODAL
========================================================= */
function openModal(title, html) {
  $("#modalTitle").textContent = title;
  $("#adminModalBody").innerHTML = html;
  $("#adminModal").classList.add("open");
}

function closeModal() {
  $("#adminModal").classList.remove("open");
}

$("#closeAdminModal").onclick = closeModal;

/* =========================================================
   LOGIN
========================================================= */
$("#loginForm").onsubmit = async e => {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(e.target));
  try {
    const r = await api("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(d)
    });
    token = r.token;
    localStorage.setItem("admin_token", token);
    boot();
  } catch (err) {
    $("#loginError").textContent = err.message;
  }
};

$("#logout").onclick = () => {
  localStorage.removeItem("admin_token");
  location.reload();
};

/* =========================================================
   NAVEGACIÓN
========================================================= */
$all(".nav-list button").forEach(b => b.onclick = () => {
  $all(".nav-list button").forEach(x => x.classList.remove("active"));
  b.classList.add("active");
  $all(".admin-section").forEach(x => x.classList.remove("active"));
  $("#" + b.dataset.section).classList.add("active");
  $("#sectionTitle").textContent = b.textContent;

  if (b.dataset.section === "dashboard") loadDashboard();
  if (b.dataset.section === "productos") loadProducts();
  if (b.dataset.section === "categorias") loadCategories();
  if (b.dataset.section === "pedidos") loadOrders();
  if (b.dataset.section === "contenido") loadContent();
  if (b.dataset.section === "mensajes") loadMessages();
});

/* =========================================================
   BOOT — Verifica si hay sesión activa
========================================================= */
async function boot() {
  try {
    await api("/productos?admin=1");
    $("#loginScreen").classList.add("hidden");
    $("#adminApp").classList.remove("hidden");
    loadDashboard();
    loadCategories();
  } catch {
    localStorage.removeItem("admin_token");
    token = null;
    $("#loginScreen").classList.remove("hidden");
    $("#adminApp").classList.add("hidden");
  }
}

/* =========================================================
   DASHBOARD
========================================================= */
async function loadDashboard() {
  try {
    const d = await api("/pedidos/stats/dashboard");
    $("#sProducts").textContent = d.productos;
    $("#sOrders").textContent = d.pedidos;
    $("#sPending").textContent = d.pendientes;
    $("#sSales").textContent = new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "USD"
    }).format(d.ventasMes);
    $("#sOut").textContent = d.sinStock;
    drawChart(d.ventasDiarias);
  } catch (e) {
    toast(e.message);
  }
}

function drawChart(rows) {
  const c = $("#salesCanvas");
  const ctx = c.getContext("2d");
  const dpr = devicePixelRatio || 1;
  const w = c.clientWidth;
  const h = c.clientHeight;
  c.width = w * dpr;
  c.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  if (!rows || !rows.length) {
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--muted");
    ctx.fillText("Aún no hay ventas para mostrar.", 20, 40);
    return;
  }

  const vals = rows.map(x => Number(x.total));
  const max = Math.max(...vals, 1);
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--accent");
  ctx.lineWidth = 3;
  ctx.beginPath();
  rows.forEach((r, i) => {
    const x = 20 + (w - 40) * (i / (rows.length - 1 || 1));
    const y = h - 25 - (h - 50) * (Number(r.total) / max);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.stroke();
}

/* =========================================================
   CATEGORÍAS
========================================================= */
async function loadCategories() {
  try {
    categories = await api("/categorias?admin=1");
    $("#categoriesTable").innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Imagen</th>
            <th>Nombre</th>
            <th>Slug</th>
            <th>Orden</th>
            <th>Activa</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${categories.map(c => `
            <tr>
              <td>${c.imagen_url ? `<img src="${c.imagen_url}">` : "—"}</td>
              <td>${esc(c.nombre)}</td>
              <td>${esc(c.slug)}</td>
              <td>${c.orden}</td>
              <td>${c.activa ? "Sí" : "No"}</td>
              <td>
                <button class="btn btn-ghost" data-edit-cat="${c.id}">Editar</button>
                <button class="btn btn-ghost" data-del-cat="${c.id}">Eliminar</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
    $all("[data-edit-cat]").forEach(b => b.onclick = () => categoryForm(categories.find(c => c.id == b.dataset.editCat)));
    $all("[data-del-cat]").forEach(b => b.onclick = () => deleteCategory(+b.dataset.delCat));
  } catch (e) {
    toast(e.message);
  }
}

$("#newCategory").onclick = () => categoryForm();

function categoryForm(c = {}) {
  openModal(c.id ? "Editar categoría" : "Nueva categoría", `
    <form id="categoryForm" class="admin-form">
      <input type="hidden" name="id" value="${c.id || ""}">
      <div><label>Nombre</label><input class="field" name="nombre" required value="${esc(c.nombre)}"></div>
      <div><label>Slug</label><input class="field" name="slug" value="${esc(c.slug)}"></div>
      <div class="full"><label>Descripción</label><textarea class="field" name="descripcion">${esc(c.descripcion)}</textarea></div>
      <div><label>Orden</label><input class="field" type="number" name="orden" value="${c.orden || 0}"></div>
      <div><label>Imagen banner</label><input class="field" type="file" name="imagen" accept="image/*"></div>
      <div class="check-row full">
        <label><input type="checkbox" name="activa" ${c.activa !== false ? "checked" : ""}> Activa</label>
      </div>
      <button class="btn btn-primary full">Guardar</button>
    </form>
  `);

  $("#categoryForm").onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    fd.set("activa", fd.get("activa") ? "1" : "0");
    const id = fd.get("id");
    try {
      await api("/categorias" + (id ? "/" + id : ""), {
        method: id ? "PUT" : "POST",
        body: fd
      });
      closeModal();
      loadCategories();
      toast("Categoría guardada");
    } catch (err) {
      toast(err.message);
    }
  };
}

async function deleteCategory(id) {
  if (!confirm("¿Eliminar esta categoría?")) return;
  try {
    await api("/categorias/" + id, { method: "DELETE" });
    loadCategories();
    toast("Eliminada");
  } catch (e) {
    toast(e.message);
  }
}

/* =========================================================
   PRODUCTOS
========================================================= */
async function loadProducts() {
  try {
    products = await api("/productos?admin=1");
    $("#productsTable").innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Imagen</th>
            <th>Nombre</th>
            <th>Precio</th>
            <th>Stock</th>
            <th>Categoría</th>
            <th>Activo</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${products.map(p => `
            <tr>
              <td>${p.imagenes?.[0] ? `<img src="${p.imagenes[0]}">` : "—"}</td>
              <td>${esc(p.nombre)}</td>
              <td>${p.precio_oferta ?? p.precio} ${esc(p.moneda)}</td>
              <td>${p.stock}</td>
              <td>${esc(p.categoria_nombre || "—")}</td>
              <td>${p.activo ? "Sí" : "No"}</td>
              <td>
                <button class="btn btn-ghost" data-edit-p="${p.id}">Editar</button>
                <button class="btn btn-ghost" data-del-p="${p.id}">Eliminar</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
    $all("[data-edit-p]").forEach(b => b.onclick = () => productForm(products.find(p => p.id == b.dataset.editP)));
    $all("[data-del-p]").forEach(b => b.onclick = () => deleteProduct(+b.dataset.delP));
  } catch (e) {
    toast(e.message);
  }
}

$("#newProduct").onclick = () => productForm();

function productForm(p = {}) {
  const sizes = ["XS", "S", "M", "L", "XL", "XXL"];
  openModal(p.id ? "Editar producto" : "Nuevo producto", `
    <form id="productForm" class="admin-form">
      <input type="hidden" name="id" value="${p.id || ""}">
      <div><label>Nombre</label><input class="field" name="nombre" required value="${esc(p.nombre)}"></div>
      <div><label>Marca</label><input class="field" name="marca" value="${esc(p.marca)}"></div>
      <div class="full"><label>Descripción corta</label><input class="field" name="descripcion_corta" value="${esc(p.descripcion_corta)}"></div>
      <div class="full"><label>Descripción larga</label><textarea class="field textarea" name="descripcion_larga">${esc(p.descripcion_larga)}</textarea></div>
      <div><label>Precio</label><input class="field" type="number" step=".01" name="precio" required value="${p.precio || 0}"></div>
      <div><label>Precio oferta</label><input class="field" type="number" step=".01" name="precio_oferta" value="${p.precio_oferta ?? ""}"></div>
      <div>
        <label>Moneda</label>
        <select class="field" name="moneda">
          <option ${p.moneda === "CUP" ? "selected" : ""}>CUP</option>
          <option ${p.moneda !== "CUP" ? "selected" : ""}>USD</option>
        </select>
      </div>
      <div><label>Stock</label><input class="field" type="number" name="stock" min="0" value="${p.stock || 0}"></div>
      <div>
        <label>Categoría</label>
        <select class="field" name="categoria_id">
          <option value="">Sin categoría</option>
          ${categories.map(c => `<option value="${c.id}" ${p.categoria_id == c.id ? "selected" : ""}>${esc(c.nombre)}</option>`).join("")}
        </select>
      </div>
      <div><label>Colores separados por coma</label><input class="field" name="colores" value="${esc((p.colores || []).join(", "))}"></div>
      <div class="full">
        <label>Tallas</label>
        <div class="check-row">
          ${sizes.map(s => `<label><input type="checkbox" name="talla" value="${s}" ${(p.tallas || []).includes(s) ? "checked" : ""}>${s}</label>`).join("")}
        </div>
      </div>
      <div class="full">
        <label>Imágenes nuevas</label>
        <input class="field" type="file" name="imagenes" accept="image/*" multiple>
      </div>
      <div class="full">
        <label>URLs de imágenes existentes (una por línea)</label>
        <textarea class="field" name="imagenes_urls">${esc((p.imagenes || []).join("\n"))}</textarea>
      </div>
      <div class="check-row full">
        <label><input type="checkbox" name="destacado" ${p.destacado ? "checked" : ""}> Destacado</label>
        <label><input type="checkbox" name="activo" ${p.activo !== false ? "checked" : ""}> Activo</label>
        <label><input type="checkbox" name="reemplazar_imagenes"> Reemplazar imágenes existentes</label>
      </div>
      <button class="btn btn-primary full">Guardar producto</button>
    </form>
  `);

  $("#productForm").onsubmit = saveProduct;
}

async function saveProduct(e) {
  e.preventDefault();
  const f = e.target;
  const fd = new FormData(f);
  const id = fd.get("id");

  fd.delete("talla");
  $all("#productForm input[name=talla]:checked").forEach(x => fd.append("tallas", x.value));
  fd.set("tallas", JSON.stringify($all("#productForm input[name=talla]:checked").map(x => x.value)));
  fd.set("colores", JSON.stringify(String(fd.get("colores") || "").split(",").map(x => x.trim()).filter(Boolean)));
  fd.set("destacado", f.destacado.checked ? "1" : "0");
  fd.set("activo", f.activo.checked ? "1" : "0");
  fd.set("imagenes_urls", JSON.stringify(String(f.imagenes_urls.value || "").split("\n").map(x => x.trim()).filter(Boolean)));
  fd.set("reemplazar_imagenes", f.reemplazar_imagenes.checked ? "true" : "false");

  try {
    await api("/productos" + (id ? "/" + id : ""), {
      method: id ? "PUT" : "POST",
      body: fd
    });
    closeModal();
    loadProducts();
    toast("Producto guardado");
  } catch (err) {
    toast(err.message);
  }
}

async function deleteProduct(id) {
  if (!confirm("¿Eliminar este producto?")) return;
  try {
    await api("/productos/" + id, { method: "DELETE" });
    loadProducts();
    toast("Eliminado");
  } catch (e) {
    toast(e.message);
  }
}

/* =========================================================
   PEDIDOS
========================================================= */
async function loadOrders() {
  const q = $("#orderStatusFilter").value;
  try {
    const orders = await api("/pedidos" + (q ? "?estado=" + q : ""));
    $("#ordersTable").innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Cliente</th>
            <th>Total</th>
            <th>Pago</th>
            <th>Estado</th>
            <th>Fecha</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${orders.map(o => `
            <tr>
              <td><strong>${esc(o.codigo)}</strong></td>
              <td>${esc(o.nombre_cliente)}<br><small>${esc(o.telefono)}</small></td>
              <td>${o.total} ${esc(o.moneda)}</td>
              <td>${esc(o.metodo_pago)}</td>
              <td>
                <span class="status ${o.estado}">${o.estado}</span>
                <select class="field" data-state="${o.id}" style="margin-top:5px">
                  ${["pendiente", "confirmado", "enviado", "entregado", "cancelado"].map(s => `<option ${s === o.estado ? "selected" : ""}>${s}</option>`).join("")}
                </select>
              </td>
              <td>${new Date(o.creado_en).toLocaleString()}</td>
              <td>
                <button class="btn btn-ghost" data-wa-order="${o.id}">WhatsApp</button>
                <button class="btn btn-ghost" data-del-order="${o.id}">Eliminar</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
    $all("[data-state]").forEach(s => s.onchange = async () => {
      try {
        await api("/pedidos/" + s.dataset.state + "/estado", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ estado: s.value })
        });
        toast("Estado actualizado");
        loadOrders();
      } catch (e) { toast(e.message); }
    });
    $all("[data-del-order]").forEach(b => b.onclick = async () => {
      if (confirm("¿Eliminar pedido?")) {
        await api("/pedidos/" + b.dataset.delOrder, { method: "DELETE" });
        loadOrders();
      }
    });
    $all("[data-wa-order]").forEach(b => b.onclick = () => {
      const o = orders.find(x => x.id == b.dataset.waOrder);
      window.open(`https://wa.me/${String(o.telefono).replace(/\D/g, "")}?text=${encodeURIComponent(`Hola ${o.nombre_cliente}, te contactamos sobre tu pedido ${o.codigo}.`)}`, "_blank");
    });
  } catch (e) { toast(e.message); }
}

$("#orderStatusFilter").onchange = loadOrders;

/* =========================================================
   CONTENIDO
========================================================= */
async function loadContent() {
  try {
    content = await api("/contenido");
    const labels = {
      negocio_nombre: "Nombre del negocio",
      hero_titulo: "Título del hero",
      hero_subtitulo: "Subtítulo del hero",
      hero_boton: "Texto del botón",
      contacto_telefono: "Teléfono",
      contacto_email: "Email",
      contacto_direccion: "Dirección",
      whatsapp: "WhatsApp (con código de país)",
      instagram: "URL Instagram",
      logo: "URL logo/banner",
      color_acento: "Color de acento",
      envio_base: "Costo de envío",
      moneda: "Moneda"
    };
    $("#contentForm").innerHTML = Object.entries(labels).map(([k, l]) => `
      <div class="${k.includes("hero") || k === "logo" ? "full" : ""}">
        <label>${l}</label>
        <input class="field" name="${k}" value="${esc(content[k] || "")}">
      </div>
    `).join("") + '<button class="btn btn-primary full">Guardar cambios</button>';

    $("#contentForm").onsubmit = async e => {
      e.preventDefault();
      try {
        await api("/contenido", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(Object.fromEntries(new FormData(e.target)))
        });
        toast("Contenido guardado");
      } catch (err) { toast(err.message); }
    };
  } catch (e) { toast(e.message); }
}

/* =========================================================
   MENSAJES
========================================================= */
async function loadMessages() {
  try {
    const ms = await api("/mensajes");
    $("#messagesTable").innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Teléfono</th>
            <th>Mensaje</th>
            <th>Leído</th>
            <th>Fecha</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${ms.map(m => `
            <tr>
              <td>${esc(m.nombre)}</td>
              <td>${esc(m.telefono)}</td>
              <td>${esc(m.mensaje)}</td>
              <td>${m.leido ? "Sí" : "No"}</td>
              <td>${new Date(m.creado_en).toLocaleString()}</td>
              <td>
                <button class="btn btn-ghost" data-read="${m.id}">Marcar leído</button>
                <button class="btn btn-ghost" data-del-msg="${m.id}">Eliminar</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
    $all("[data-read]").forEach(b => b.onclick = async () => {
      await api("/mensajes/" + b.dataset.read + "/leido", { method: "PATCH" });
      loadMessages();
    });
    $all("[data-del-msg]").forEach(b => b.onclick = async () => {
      if (confirm("¿Eliminar mensaje?")) {
        await api("/mensajes/" + b.dataset.delMsg, { method: "DELETE" });
        loadMessages();
      }
    });
  } catch (e) { toast(e.message); }
}

/* =========================================================
   INICIALIZACIÓN
========================================================= */
boot();