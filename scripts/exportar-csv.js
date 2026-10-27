'use strict';

// Exporta las cuentas registradas a un CSV para cargarlas en el sistema.
// Uso: npm run exportar [-- ruta/de/salida.csv]
// Las contraseñas se exportan solo como hash (nunca en texto plano).

const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'usuarios.json');
const output = process.argv[2] || path.join(DATA_DIR, 'usuarios.csv');

if (!fs.existsSync(USERS_FILE)) {
  console.log('Todavía no hay cuentas registradas.');
  process.exit(0);
}

const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
const columns = ['id', 'email', 'passwordHash', 'plan', 'aceptaTerminos', 'creadoEn'];

const escape = (value) => {
  let s = String(value ?? '');
  // Evita que Excel/Sheets interprete el contenido como fórmula.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const csv = [columns.join(','), ...users.map((u) => columns.map((c) => escape(u[c])).join(','))].join('\n');
fs.writeFileSync(output, csv + '\n', { mode: 0o600 });
console.log(`Exportadas ${users.length} cuentas a ${output}`);
