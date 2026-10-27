'use strict';

// Lógica de cuentas compartida entre el servidor local (server.js) y la
// función de Vercel (api/ingresar.js).
//
// Inicio de sesión unificado: si el email no existe, se crea la cuenta con los
// datos ingresados; si ya existe, se verifica la contraseña.
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

async function verifyPassword(password, stored) {
  const [scheme, saltHex, keyHex] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const key = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(key, expected);
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

// Serializa las escrituras para que dos operaciones simultáneas no se pisen.
let writeQueue = Promise.resolve();
function withLock(fn) {
  const run = writeQueue.then(fn, fn);
  writeQueue = run.catch(() => {});
  return run;
}

const localStore = {
  async find(email) {
    return (await readLocalUsers()).find((u) => u.email === email) || null;
  },
  create(user) {
    return withLock(async () => {
      const users = await readLocalUsers();
      if (users.some((u) => u.email === user.email)) return false;
      users.push(user);
      await writeLocalUsers(users);
      return true;
    });
  },
  update(user) {
    return withLock(async () => {
      const users = await readLocalUsers();
      const i = users.findIndex((u) => u.email === user.email);
      if (i === -1) return;
      users[i] = user;
      await writeLocalUsers(users);
    });
  },
};

// --- Almacenamiento en Vercel Blob ------------------------------------------

function blobPathname(email) {
  return `${BLOB_PREFIX}${crypto.createHash('sha256').update(email).digest('hex')}.json`;
}

async function readBlobJson(pathname) {
  const { get } = require('@vercel/blob');
  const result = await get(pathname, { access: 'private', useCache: false });
  if (result?.statusCode !== 200) return null;
  return JSON.parse(await new Response(result.stream).text());
}

function writeBlobUser(user, allowOverwrite) {
  const { put } = require('@vercel/blob');
  return put(blobPathname(user.email), JSON.stringify(user), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite,
  });
}

const blobStore = {
  find(email) {
    return readBlobJson(blobPathname(email));
  },
  async create(user) {
    try {
      // allowOverwrite: false garantiza que una alta simultánea con el mismo
      // email no pise a la otra.
      await writeBlobUser(user, false);
      return true;
    } catch (err) {
      if (/already exists/i.test(err.message)) return false;
      throw err;
    }
  },
  async update(user) {
    await writeBlobUser(user, true);
  },
};

async function readBlobUsers() {
  const { list } = require('@vercel/blob');
  const users = [];
  let cursor;
  do {
    const page = await list({ prefix: BLOB_PREFIX, cursor });
    for (const { pathname } of page.blobs) {
      const user = await readBlobJson(pathname);
      if (user) users.push(user);
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return users.sort((a, b) => a.creadoEn.localeCompare(b.creadoEn));
}

// --- Inicio de sesión ------------------------------------------------------

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
async function ingresar(body) {
  if (!body || typeof body !== 'object') {
    return { status: 400, body: { ok: false, error: 'Solicitud inválida.' } };
  }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : body.email;
  const { password, aceptaTerminos } = body;

  const error = validate({ email, password });
  if (error) return { status: 400, body: { ok: false, error } };

  const store = usesBlob() ? blobStore : localStore;
  const now = new Date().toISOString();
  let user = await store.find(email);

  if (!user) {
    if (aceptaTerminos !== true) {
      return { status: 400, body: { ok: false, error: 'Necesitamos que aceptes los términos y la política de privacidad.' } };
    }
    const nuevo = {
      id: crypto.randomUUID(),
      email,
      passwordHash: await hashPassword(password),
      plan: 'yoga-facial',
      aceptaTerminos: true,
      creadoEn: now,
      ultimoIngreso: now,
    };
    if (await store.create(nuevo)) {
      return { status: 201, body: { ok: true, nuevo: true, mensaje: '¡Tu cuenta fue creada con éxito!' } };
    }
    // Otra solicitud creó la cuenta al mismo tiempo: se verifica como ingreso.
    user = await store.find(email);
  }

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { status: 401, body: { ok: false, error: 'El email o la contraseña no son correctos.' } };
  }

  await store.update({ ...user, ultimoIngreso: now });
  return { status: 200, body: { ok: true, nuevo: false, mensaje: '¡Hola de nuevo!' } };
}

function readUsers() {
  return usesBlob() ? readBlobUsers() : readLocalUsers();
}

module.exports = { ingresar, readUsers, hashPassword, verifyPassword, usesBlob };
