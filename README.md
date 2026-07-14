# Documentacion Soporte - Fundacion Luker

Portal interno de documentacion operativa por modulos:
- Almera SGI
- Google Forms + Apps Script
- ClickUp
- Login autenticado
- Base de datos PostgreSQL

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

Recomendado:
1. Mantener claves en gestor de secretos.
2. Usar variables de entorno para backend/login.
3. Mantener `secrets.local.json` solo en local.

## Configurar Base De Datos (PostgreSQL)

1. Crea una base PostgreSQL (Neon, Supabase, Railway, etc.).
2. Copia tu connection string en variable `DATABASE_URL`.
3. Ejecuta el SQL de `db/schema.sql` en tu motor.
4. Genera hash bcrypt para tu clave real:

```bash
npm run hash -- "TuClaveReal"
```

5. Reemplaza `REEMPLAZAR_HASH_BCRYPT` en `db/schema.sql` por el hash generado y vuelve a ejecutar el `INSERT` (o inserta manualmente).

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

1. Copia `.env.example` como `.env` y define `DATABASE_URL`.
2. Inicia entorno local:

```bash
npm run dev
```

3. Abre `http://localhost:3000/login.html`.
