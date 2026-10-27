# Torti Bienestar — Registro Plan Yoga Facial

Página de creación de cuenta para el **Plan de Yoga Facial** de Torti Bienestar. La persona ingresa su email y una contraseña, y la cuenta queda guardada para cargarla en el sistema.

## Cómo correrlo

Requiere Node.js 18 o superior.

```bash
npm install
npm start
```

Abrí <http://localhost:3000>. El puerto se cambia con la variable `PORT`.

## Qué hace

- **Formulario** (`public/`): email, contraseña, confirmación de contraseña y aceptación de términos. Valida en el navegador (formato de email, mínimo 8 caracteres, que las contraseñas coincidan) y muestra un medidor de seguridad de la contraseña. Se adapta a celular.
- **Registro** (`lib/registro.js`): recibe el registro en `POST /api/registro`, vuelve a validar los datos, rechaza emails repetidos y guarda la cuenta.
  - En Vercel lo atiende la función `api/registro.js`.
  - En tu computadora lo atiende `server.js`.

## Dónde quedan los datos

- **En Vercel:** cada cuenta se guarda como un archivo **privado** en Vercel Blob (`usuarios/<hash del email>.json`). Solo se puede leer con el token del Blob store; no hay ninguna dirección pública para verlas.
- **En tu computadora:** en `data/usuarios.json` (la carpeta se crea sola y está en `.gitignore`, así que nunca se sube al repositorio).

Cada registro tiene:

| Campo            | Ejemplo                                  |
|------------------|------------------------------------------|
| `id`             | `3f2b…` (UUID)                           |
| `email`          | `nombre@gmail.com` (en minúsculas)       |
| `passwordHash`   | `scrypt$<sal>$<hash>`                    |
| `plan`           | `yoga-facial`                            |
| `aceptaTerminos` | `true`                                   |
| `creadoEn`       | `2026-10-27T14:03:00.000Z`               |

**La contraseña nunca se guarda en texto plano**: se guarda un hash `scrypt` con una sal aleatoria por usuario. Para verificarla al iniciar sesión, se recalcula `scrypt(contraseña, sal, 64)` y se compara con el hash guardado.

### Exportar para cargar en el sistema

```bash
npm run exportar                 # genera usuarios.csv con las cuentas locales
npm run exportar -- salida.csv   # o en la ruta que indiques
```

Para exportar las cuentas guardadas **en Vercel**, copiá el `BLOB_READ_WRITE_TOKEN` del Blob store (Vercel → Storage → tu store → `.env.local`) y corré:

```bash
BLOB_READ_WRITE_TOKEN=... npm run exportar
```

## Despliegue en Vercel

El proyecto se despliega tal cual: `public/` se sirve como sitio estático y `api/registro.js` como función. Necesita un Blob store **privado** conectado al proyecto (Vercel → Storage), que es el que agrega las credenciales de acceso automáticamente.

## Pendientes

- Reemplazar los enlaces `#` de *términos y condiciones*, *política de privacidad* e *iniciar sesión* por las páginas reales.
- Para mucho volumen de registros o para consultas (buscar, filtrar), conviene pasar a una base de datos.
