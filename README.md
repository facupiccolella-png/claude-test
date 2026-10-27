# Torti Bienestar — Registro Plan Yoga Facial

Página de creación de cuenta para el **Plan de Yoga Facial** de Torti Bienestar. La persona ingresa su email y una contraseña, y la cuenta queda guardada para cargarla en el sistema.

## Cómo correrlo

Requiere Node.js 18 o superior. No tiene dependencias externas.

```bash
npm start
```

Abrí <http://localhost:3000>. El puerto se cambia con la variable `PORT`.

## Qué hace

- **Formulario** (`public/`): email, contraseña, confirmación de contraseña y aceptación de términos. Valida en el navegador (formato de email, mínimo 8 caracteres, que las contraseñas coincidan) y muestra un medidor de seguridad de la contraseña. Se adapta a celular.
- **Servidor** (`server.js`): recibe el registro en `POST /api/registro`, vuelve a validar los datos, rechaza emails repetidos y guarda la cuenta.

## Dónde quedan los datos

Las cuentas se guardan en `data/usuarios.json` (la carpeta se crea sola y está en `.gitignore`, así que nunca se sube al repositorio). Cada registro tiene:

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
npm run exportar                 # genera data/usuarios.csv
npm run exportar -- salida.csv   # o en la ruta que indiques
```

## Antes de publicarlo

- Servirlo siempre con **HTTPS** (por ejemplo detrás de un proxy o en un hosting que lo provea).
- Reemplazar los enlaces `#` de *términos y condiciones*, *política de privacidad* e *iniciar sesión* por las páginas reales.
- Para mucho volumen de registros, conviene pasar de `usuarios.json` a una base de datos.
