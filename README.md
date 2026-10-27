# Torti Bienestar — Ingreso Plan Yoga Facial

Página de inicio de sesión para el **Plan de Yoga Facial** de Torti Bienestar. La persona ingresa su email y contraseña:

- **Si es la primera vez** (el email no existe), se crea la cuenta con esos datos y queda guardada para cargarla en el sistema.
- **Si ya tiene cuenta**, se verifica la contraseña y se registra la fecha de ingreso. Si la contraseña no coincide, se rechaza el ingreso y no se guarda nada.

## Cómo correrlo

Requiere Node.js 18 o superior.

```bash
npm install
npm start
```

Abrí <http://localhost:3000>. El puerto se cambia con la variable `PORT`.

## Qué hace

- **Formulario** (`public/`): email, contraseña y aceptación de términos, con un aviso de que la primera vez se crea la cuenta. Valida en el navegador (formato de email, mínimo 8 caracteres). Se adapta a celular.
- **Ingreso** (`lib/cuentas.js`): recibe los datos en `POST /api/ingresar`, los vuelve a validar y crea la cuenta o verifica la contraseña.
  - En Vercel lo atiende la función `api/ingresar.js`.
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
| `ultimoIngreso`  | `2026-10-28T09:15:00.000Z`               |

**La contraseña nunca se guarda en texto plano**: se guarda un hash `scrypt` con una sal aleatoria por usuario. Para verificarla al iniciar sesión se recalcula `scrypt(contraseña, sal, 64)` y se compara con el hash guardado. Las contraseñas de los intentos fallidos no se guardan.

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

El proyecto se despliega tal cual: `public/` se sirve como sitio estático y `api/ingresar.js` como función. Necesita un Blob store **privado** conectado al proyecto (Vercel → Storage), que es el que agrega las credenciales de acceso automáticamente.

## Pendientes

- Reemplazar los enlaces `#` de *términos y condiciones* y *política de privacidad* por las páginas reales.
- Agregar una forma de recuperar la contraseña.
- Limitar los intentos de ingreso (por ejemplo con una regla de *rate limit* en Vercel Firewall) para frenar a quien intente adivinar contraseñas.
- Para mucho volumen de registros o para consultas (buscar, filtrar), conviene pasar a una base de datos.
