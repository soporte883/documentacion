# Documentacion Soporte - Fundacion Luker

Portal interno de documentacion operativa por modulos:
- Almera SGI
- Google Forms + Apps Script
- ClickUp

## Estructura

- `index.html`: interfaz principal
- `styles.css`: estilos y diseno responsive
- `app.js`: interactividad (tabs, busqueda, acordeones, notas locales)
- `secrets.local.json.example`: plantilla de credenciales para uso local
- `secrets.local.json`: archivo local privado (ignorado por git)

## Seguridad

No subir credenciales reales al repositorio.

Recomendado:
1. Mantener claves en gestor de secretos.
2. Usar variables de entorno para backend/login.
3. Mantener `secrets.local.json` solo en local.

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

## Proximo paso (login + BD)

Cuando quieras activar login real:
1. Crear backend (API routes) para autenticacion.
2. Guardar usuarios/password hash en base de datos.
3. Consumir API desde frontend.
4. Cargar credenciales/strings por variables de entorno en Vercel.
