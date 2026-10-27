'use strict';

// Exporta las cuentas registradas a un CSV para cargarlas en el sistema.
// Uso: npm run exportar [-- ruta/de/salida.csv]
//
// - Con BLOB_READ_WRITE_TOKEN definido, lee las cuentas guardadas en Vercel.
// - Sin él, lee las cuentas locales de data/usuarios.json.
// Las contraseñas se exportan solo como hash (nunca en texto plano).

const fs = require('node:fs');
const { readUsers, usesBlob } = require('../lib/registro');

const output = process.argv[2] || 'usuarios.csv';
const columns = ['id', 'email', 'passwordHash', 'plan', 'aceptaTerminos', 'creadoEn'];

const escape = (value) => {
  let s = String(value ?? '');
  // Evita que Excel/Sheets interprete el contenido como fórmula.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

(async () => {
  const users = await readUsers();
  if (users.length === 0) {
    console.log('Todavía no hay cuentas registradas.');
    return;
  }
  const csv = [columns.join(','), ...users.map((u) => columns.map((c) => escape(u[c])).join(','))].join('\n');
  fs.writeFileSync(output, csv + '\n', { mode: 0o600 });
  console.log(`Exportadas ${users.length} cuentas (${usesBlob() ? 'Vercel Blob' : 'archivo local'}) a ${output}`);
})().catch((err) => {
  console.error('No se pudo exportar:', err.message);
  process.exit(1);
});
