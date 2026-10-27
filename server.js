'use strict';

// Servidor local de desarrollo de Torti Bienestar — Plan Yoga Facial.
// En Vercel, la página se sirve desde public/ y el ingreso desde api/ingresar.js.

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { ingresar } = require('./lib/cuentas');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY_BYTES = 10 * 1024;

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

async function handleLogin(req, res) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) {
    return send(res, 415, { ok: false, error: 'Formato no soportado.' });
  }
  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch (err) {
    return send(res, err.status || 400, { ok: false, error: 'Solicitud inválida.' });
  }
  const result = await ingresar(body);
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
    if (req.url === '/api/ingresar') {
      if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Método no permitido.' }, { Allow: 'POST' });
      return await handleLogin(req, res);
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
    console.log(`Torti Bienestar — página disponible en http://localhost:${PORT}`);
  });
}

module.exports = { server };
