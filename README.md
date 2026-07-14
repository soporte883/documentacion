# Documentacion Soporte - Fundacion Luker

Portal interno de documentacion operativa por modulos:

- Almera SGI
- Google Forms + Apps Script
- ClickUp
- Login autenticado
- Base de datos PostgreSQL
- Panel de administracion de usuarios (crear, activar, inactivar)
- Panel de administracion de modulos (crear y publicar en la vista principal)

## Estructura

- `index.html`: interfaz principal
- `login.html`: pantalla de login
- `styles.css`: estilos y diseno responsive
- `app.js`: interactividad (tabs, busqueda, acordeones, notas locales)
- `login.js`: flujo de autenticacion del frontend
- `api/`: backend serverless para login/sesion en Vercel
- `db/schema.sql`: estructura SQL para usuarios y sesiones
- `secrets.local.json.example`: plantilla de credenciales para uso local
- `secrets.local.json`: archivo local privado (ignorado por git)

## Seguridad

No subir credenciales reales al repositorio.

Medidas implementadas:

- Contrasenas con hash bcrypt (nunca en texto plano).
- Rate limiting en el login (bloqueo temporal tras varios intentos fallidos).
- Proteccion CSRF (double-submit cookie) en todas las acciones que modifican datos.
- Cookies de sesion `HttpOnly` + `SameSite=Lax` y `Secure` en produccion.
- Limpieza automatica de sesiones expiradas e intentos de login antiguos.
- Validacion de entrada y bloqueo de URLs peligrosas (solo http/https) para evitar XSS.
- Auditoria de acciones sensibles en la tabla `audit_logs`.
- Cabeceras de seguridad HTTP (CSP, HSTS, X-Frame-Options, etc.) via `vercel.json`.
- El administrador se siembra con `npm run seed:admin` usando variables de entorno; no hay claves en el repo.

Recomendado:

1. Mantener claves en gestor de secretos.
2. Usar variables de entorno para backend/login.
3. Nunca commitear `.env.local` ni `secrets.local.json`.

## Configurar Base De Datos (PostgreSQL)

1. Crea una base PostgreSQL (Neon, Supabase, Railway, etc.).
2. Copia `.env.example` a `.env.local` y define `DATABASE_URL`, `ADMIN_EMAIL` y `ADMIN_PASSWORD`.
3. Aplica el esquema:

```bash
npm run db:setup
```

4. Siembra (o actualiza) el usuario administrador de forma segura:

```bash
npm run seed:admin
```

Esto toma `ADMIN_EMAIL`, `ADMIN_NAME` y `ADMIN_PASSWORD` desde `.env.local` y guarda la clave con hash bcrypt. No se guardan claves en texto plano en el repositorio.

Nota: el esquema incluye columnas `role`, `is_active` y `must_change_password` en `users`, la tabla `modules`, ademas de `login_attempts` (rate limiting) y `audit_logs` (auditoria). Si ya tenias una base creada, vuelve a correr `npm run db:setup` para aplicar los cambios de forma incremental.

## Variables En Vercel

Configura en Project Settings -> Environment Variables:

- `DATABASE_URL` = cadena de conexion PostgreSQL
- `PGSSLMODE` = `disable` (solo si tu BD local no usa SSL)

## Publicacion en Vercel

### Opcion A: Desde GitHub (recomendada)

1. Subir este proyecto a GitHub.
2. Entrar a Vercel y seleccionar `Add New Project`.
3. Importar el repositorio `documentacion`.
4. Framework preset: `Other`.
5. Build command: vacio.
6. Output directory: vacio (sitio estatico en raiz).
7. Deploy.

### Opcion B: Desde Vercel CLI

```bash
npm i -g vercel
vercel
vercel --prod
```

## Desarrollo local

1. Copia `.env.example` como `.env.local` y define `DATABASE_URL` (y `ADMIN_EMAIL`/`ADMIN_PASSWORD` si vas a sembrar el admin).
2. Inicia entorno local:

```bash
npm run dev
```

3. Abre `http://localhost:3000/login.html`.

## Gestion De Usuarios (Admin)

- Solo usuarios con rol `admin` pueden ver la pestaña `Admin Usuarios`.
- Desde esa pestaña se puede:
  - Crear usuarios nuevos (correo, nombre, clave inicial y rol).
  - Editar nombre y rol de un usuario existente.
  - Resetear la clave de un usuario.
  - Activar/Inactivar usuarios existentes.
  - Buscar usuarios por nombre o correo (busqueda en el servidor).
- Los usuarios inactivos no pueden iniciar sesion.

## Gestion De Modulos (Admin)

- Solo usuarios `admin` pueden crear, editar y eliminar modulos.
- Los modulos se guardan en base de datos y se muestran en la pestana `Modulos` para todos los usuarios autenticados.
- Campos incluidos: titulo, descripcion, enlace, etiqueta/valor de detalle, uso, estado visual y tags de busqueda.
- Desde cada tarjeta de modulo dinamico, un admin puede usar los botones **Editar** y **Eliminar**.

## Cambio De Contrasena

- Cualquier usuario autenticado puede cambiar su clave con el boton **Cambiar clave** (barra superior).
- Los usuarios nuevos y aquellos a quienes un admin les reseteo la clave deben cambiarla en el primer ingreso (se solicita automaticamente).
- Un admin puede resetear la clave de cualquier usuario desde **Admin Usuarios** (boton **Resetear clave**); esto cierra las sesiones activas de ese usuario.

> Nota: la recuperacion self-service por correo ("olvide mi clave") requiere configurar un proveedor de email (SMTP) y no esta incluida. El flujo soportado es el reset por administrador.

## Calidad Y Pruebas

```bash
npm test          # tests unitarios (node:test)
npm run lint      # ESLint
npm run format    # Prettier (formatea)
npm run format:check
```

El workflow de GitHub Actions en `.github/workflows/ci.yml` corre lint, formato y tests en cada push/PR a `main`.
