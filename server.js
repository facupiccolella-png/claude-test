'use strict';

// Servidor de registro de Torti Bienestar — Plan Yoga Facial.
// Sin dependencias externas: usa solo módulos nativos de Node.

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'usuarios.json');
const MAX_BODY_BYTES = 10 * 1024;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy':
    "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'",
};

// --- Almacenamiento -------------------------------------------------------

async function readUsers() {
  try {
    return JSON.parse(await fs.readFile(USERS_FILE, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function writeUsers(users) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  // Escritura atómica: se escribe un temporal y se renombra.
  const tmp = `${USERS_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(users, null, 2), { mode: 0o600 });
  await fs.rename(tmp, USERS_FILE);
}

// Serializa las escrituras para que dos registros simultáneos no se pisen.
let writeQueue = Promise.resolve();
function withLock(fn) {
  const run = writeQueue.then(fn, fn);
  writeQueue = run.catch(() => {});
  return run;
}

// --- Contraseñas -----------------------------------------------------------

// Nunca se guarda la contraseña en texto plano: se guarda un hash scrypt con sal.
async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

// --- Registro --------------------------------------------------------------

function validate({ email, password }) {
  if (typeof email !== 'string' || typeof password !== 'string') {
    return 'Completá tu email y contraseña.';
  }
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return 'Ingresá un email válido.';
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `La contraseña no puede superar los ${MAX_PASSWORD_LENGTH} caracteres.`;
  }
  return null;
}

async function registerUser(body) {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : body.email;
  const { password, aceptaTerminos } = body;

  const error = validate({ email, password });
  if (error) return { status: 400, body: { ok: false, error } };
  if (aceptaTerminos !== true) {
    return { status: 400, body: { ok: false, error: 'Necesitamos que aceptes los términos y la política de privacidad.' } };
  }

  const passwordHash = await hashPassword(password);

  return withLock(async () => {
    const users = await readUsers();
    if (users.some((u) => u.email === email)) {
      return { status: 409, body: { ok: false, error: 'Ya existe una cuenta con ese email.' } };
    }
    users.push({
      id: crypto.randomUUID(),
      email,
      passwordHash,
      plan: 'yoga-facial',
      aceptaTerminos: true,
      creadoEn: new Date().toISOString(),
    });
    await writeUsers(users);
    return { status: 201, body: { ok: true, mensaje: '¡Tu cuenta fue creada con éxito!' } };
  });
}

// --- HTTP ------------------------------------------------------------------

function send(res, status, body, headers = {}) {
  const isJson = typeof body !== 'string' && !Buffer.isBuffer(body);
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    ...(isJson ? { 'Content-Type': 'application/json; charset=utf-8' } : {}),
    ...headers,
  });
  res.end(isJson ? JSON.stringify(body) : body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Body demasiado grande'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleRegister(req, res) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) {
    return send(res, 415, { ok: false, error: 'Formato no soportado.' });
  }
  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch (err) {
    return send(res, err.status || 400, { ok: false, error: 'Solicitud inválida.' });
  }
  if (!body || typeof body !== 'object') {
    return send(res, 400, { ok: false, error: 'Solicitud inválida.' });
  }
  const result = await registerUser(body);
  send(res, result.status, result.body);
}

async function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const relative = urlPath === '/' ? 'index.html' : urlPath.slice(1);
  const filePath = path.resolve(PUBLIC_DIR, relative);
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    return send(res, 404, 'No encontrado', { 'Content-Type': 'text/plain; charset=utf-8' });
  }
  try {
    const content = await fs.readFile(filePath);
    const type = MIME_TYPES[path.extname(filePath)] || 'application/octet-stream';
    send(res, 200, content, { 'Content-Type': type });
  } catch {
    send(res, 404, 'No encontrado', { 'Content-Type': 'text/plain; charset=utf-8' });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/api/registro') {
      if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Método no permitido.' }, { Allow: 'POST' });
      return await handleRegister(req, res);
    }
    if (req.method === 'GET' || req.method === 'HEAD') return await serveStatic(req, res);
    send(res, 405, { ok: false, error: 'Método no permitido.' });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) send(res, 500, { ok: false, error: 'Ocurrió un error. Probá de nuevo en unos minutos.' });
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Torti Bienestar — registro disponible en http://localhost:${PORT}`);
  });
}

module.exports = { server, registerUser, hashPassword };
