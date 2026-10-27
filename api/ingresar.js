'use strict';

// Función de Vercel: POST /api/ingresar

const { ingresar } = require('../lib/cuentas');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Método no permitido.' });
  }
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) {
    return res.status(415).json({ ok: false, error: 'Formato no soportado.' });
  }

  let body;
  try {
    // Vercel parsea el JSON al leer req.body y lanza un error si es inválido.
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ ok: false, error: 'Solicitud inválida.' });
  }

  try {
    const result = await ingresar(body);
    res.status(result.status).json(result.body);
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Ocurrió un error. Probá de nuevo en unos minutos.' });
  }
};
