# Lumina Store — E-commerce multi-categoría

Proyecto full-stack en Node.js + Express + Turso + Cloudinary y frontend en HTML/CSS/JavaScript vanilla.

## 1. Estructura

- `backend/`: API REST, autenticación JWT, Turso y subida de imágenes.
- `frontend/`: tienda pública y panel administrativo.
- `.github/workflows/keep-alive.yml`: ping programado para Render.

## 2. Requisitos

- Node.js 22+
- Cuenta Turso
- Cuenta Cloudinary
- Un hosting para backend (por ejemplo Render)
- Un hosting para frontend (por ejemplo Netlify)

## 3. Configuración local

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Edita `.env` con tus credenciales.

Para generar el hash de la contraseña del administrador:

```bash
node -e "const bcrypt=require('bcryptjs'); console.log(bcrypt.hashSync('TU_CONTRASEÑA',12))"
```

Copia el resultado en `ADMIN_PASSWORD_HASH`.

La API queda en `http://localhost:3000`.

Para abrir el frontend localmente puedes usar VS Code Live Server, o cualquier servidor estático. El frontend usa por defecto:

`http://localhost:3000/api`

También puedes cambiarlo guardando otra URL en `localStorage`:

```js
localStorage.setItem("STORE_API","https://tu-backend.onrender.com/api")
```

## 4. Turso

Crea una base de datos en Turso y configura:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`

Las tablas se crean automáticamente al iniciar el backend.

## 5. Cloudinary

Configura:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Las imágenes de productos y categorías se almacenan en Cloudinary.

## 6. Primer acceso

Usuario: el valor de `ADMIN_USER`.

Contraseña: la contraseña original cuyo hash colocaste en `ADMIN_PASSWORD_HASH`.

El JWT del panel dura 7 días.

## 7. Render

Configura el servicio del backend:

- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`

Agrega todas las variables de `.env.example` como Environment Variables.

Para CORS, establece `FRONTEND_URL` con la URL exacta de tu frontend de Netlify. Si tienes más de un origen, sepáralos por comas.

## 8. Netlify

Publica la carpeta `frontend/` como sitio estático. Si usas Netlify CLI, el directorio de publicación es `frontend`.

Después de desplegar, abre la consola del navegador y ejecuta:

```js
localStorage.setItem("STORE_API","https://TU-BACKEND.onrender.com/api")
```

Recarga la página.

## 9. Keep-alive

En GitHub crea un Secret llamado `BACKEND_URL` con la URL del backend, por ejemplo:

`https://tu-backend.onrender.com`

El workflow ejecuta un ping cada 14 minutos y también puede lanzarse manualmente.

## 10. Funciones incluidas

### Tienda pública
- Categorías destacadas.
- Productos destacados.
- Ofertas.
- Búsqueda.
- Filtros por categoría, precio y stock.
- Ordenación.
- Modal de detalle.
- Tallas y colores.
- Carrito persistente con LocalStorage.
- Checkout.
- Validación de stock y precio en servidor.
- Métodos de pago: efectivo, transferencia y WhatsApp.
- WhatsApp directo.
- Modo oscuro/claro.
- Responsive y lazy loading.

### Panel
- Login JWT.
- Dashboard con estadísticas.
- Gráfico de ventas.
- CRUD de productos.
- Subida múltiple a Cloudinary.
- CRUD de categorías.
- Gestión de pedidos y estados.
- Enlace WhatsApp del cliente.
- Textos y datos de contacto editables.
- Mensajes de contacto.

## 11. Seguridad

- Contraseñas con bcrypt.
- JWT con expiración.
- Rate limit para API y login.
- Validación básica de entradas.
- Revalidación de precio y stock en servidor antes de crear un pedido.
- CORS configurable.
- Secretos fuera del repositorio mediante `.env`.

## 12. Nota sobre pagos

Los métodos de pago incluidos son de gestión del pedido. No se integra una pasarela de cobro real ni se almacenan datos de tarjetas. Para pagos online reales habría que conectar un proveedor compatible con el país y las condiciones del negocio.
