'use strict';

// Lógica de registro compartida entre el servidor local (server.js) y la
// función de Vercel (api/registro.js).
//
// Almacenamiento:
// - En Vercel (o si hay credenciales de Blob) cada cuenta se guarda como un
//   archivo privado en Vercel Blob: usuarios/<sha256(email)>.json
// - En desarrollo local se guarda todo en data/usuarios.json

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const BLOB_PREFIX = 'usuarios/';

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'usuarios.json');

function usesBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

// --- Contraseñas -----------------------------------------------------------

// Nunca se guarda la contraseña en texto plano: se guarda un hash scrypt con sal.
async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

// --- Almacenamiento local --------------------------------------------------

async function readLocalUsers() {
  try {
    return JSON.parse(await fs.readFile(USERS_FILE, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function writeLocalUsers(users) {
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

function saveLocalUser(user) {
  return withLock(async () => {
    const users = await readLocalUsers();
    if (users.some((u) => u.email === user.email)) return false;
    users.push(user);
    await writeLocalUsers(users);
    return true;
  });
}

// --- Almacenamiento en Vercel Blob ------------------------------------------

function blobPathname(email) {
  return `${BLOB_PREFIX}${crypto.createHash('sha256').update(email).digest('hex')}.json`;
}

async function saveBlobUser(user) {
  const { put, head, BlobNotFoundError } = require('@vercel/blob');
  const pathname = blobPathname(user.email);
  try {
    await head(pathname);
    return false;
  } catch (err) {
    if (!(err instanceof BlobNotFoundError)) throw err;
  }
  try {
    // allowOverwrite: false garantiza que un registro simultáneo con el mismo
    // email no pise al otro.
    await put(pathname, JSON.stringify(user), {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: false,
    });
    return true;
  } catch (err) {
    if (/already exists/i.test(err.message)) return false;
    throw err;
  }
}

async function readBlobUsers() {
  const { list, get } = require('@vercel/blob');
  const users = [];
  let cursor;
  do {
    const page = await list({ prefix: BLOB_PREFIX, cursor });
    for (const { pathname } of page.blobs) {
      const result = await get(pathname, { access: 'private' });
      if (result?.statusCode === 200) {
        users.push(JSON.parse(await new Response(result.stream).text()));
      }
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return users.sort((a, b) => a.creadoEn.localeCompare(b.creadoEn));
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

// Devuelve { status, body } listo para responder por HTTP.
async function registerUser(body) {
  if (!body || typeof body !== 'object') {
    return { status: 400, body: { ok: false, error: 'Solicitud inválida.' } };
  }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : body.email;
  const { password, aceptaTerminos } = body;

  const error = validate({ email, password });
  if (error) return { status: 400, body: { ok: false, error } };
  if (aceptaTerminos !== true) {
    return { status: 400, body: { ok: false, error: 'Necesitamos que aceptes los términos y la política de privacidad.' } };
  }

  const user = {
    id: crypto.randomUUID(),
    email,
    passwordHash: await hashPassword(password),
    plan: 'yoga-facial',
    aceptaTerminos: true,
    creadoEn: new Date().toISOString(),
  };

  const created = usesBlob() ? await saveBlobUser(user) : await saveLocalUser(user);
  if (!created) {
    return { status: 409, body: { ok: false, error: 'Ya existe una cuenta con ese email.' } };
  }
  return { status: 201, body: { ok: true, mensaje: '¡Tu cuenta fue creada con éxito!' } };
}

function readUsers() {
  return usesBlob() ? readBlobUsers() : readLocalUsers();
}

module.exports = { registerUser, readUsers, hashPassword, usesBlob };
