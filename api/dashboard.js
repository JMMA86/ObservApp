// /api/dashboard — Proxy serverless para el dashboard del coordinador.
//
// Mantiene el PIN actual (no expone el service_role al navegador).
// Variables de entorno requeridas en Vercel:
//   SUPABASE_URL          -> https://xxxx.supabase.co
//   SUPABASE_SERVICE_KEY  -> service_role key (¡secreto!)
//   COORD_PIN             -> código de acceso del coordinador (ej: cali2025)

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const COORD_PIN = process.env.COORD_PIN || 'cali2025';
const TABLE = 'submissions';

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function sb(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = Object.assign(
    {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    options.headers || {}
  );
  const r = await fetch(url, { ...options, headers });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  if (!r.ok) {
    const err = new Error((data && data.message) || `Supabase ${r.status}`);
    err.status = r.status;
    err.detail = data;
    throw err;
  }
  return data;
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch (e) { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

module.exports = async (req, res) => {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return send(res, 500, { error: 'Servidor sin configurar (faltan SUPABASE_URL / SUPABASE_SERVICE_KEY).' });
  }

  // PIN puede venir en el header x-pin o en el body.
  const headerPin = req.headers['x-pin'];
  const body = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
    ? await readBody(req)
    : {};
  const pin = headerPin || body.pin || '';
  if (String(pin).trim() !== COORD_PIN) {
    return send(res, 401, { error: 'PIN incorrecto' });
  }

  const action = (req.query && req.query.action) || body.action || 'list';

  try {
    if (action === 'list') {
      const filters = [];
      const q = req.query || {};
      if (q.module) filters.push(`module=eq.${encodeURIComponent(q.module)}`);
      if (q.grp) filters.push(`grp=eq.${encodeURIComponent(q.grp)}`);
      if (q.mom) filters.push(`mom=eq.${encodeURIComponent(q.mom)}`);
      const query = `select=*&order=ts.desc` + (filters.length ? `&${filters.join('&')}` : '');
      const rows = await sb(`${TABLE}?${query}`);
      const docs = (rows || []).map((r) => Object.assign({ id: r.id, ts: r.ts }, r.payload || {}));
      return send(res, 200, { docs });
    }

    if (action === 'delete') {
      if (!body.id) return send(res, 400, { error: 'Falta id' });
      await sb(`${TABLE}?id=eq.${encodeURIComponent(body.id)}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' },
      });
      return send(res, 200, { ok: true });
    }

    if (action === 'restore') {
      const doc = body.doc;
      if (!doc || !doc.id) return send(res, 400, { error: 'Falta doc.id' });
      const row = {
        id: doc.id,
        ts: doc.ts || Date.now(),
        obs: doc.obs || null,
        grp: doc.grp || null,
        module: doc.module || null,
        mom: doc.mom || null,
        sent_at: doc.sentAt || new Date().toISOString(),
        payload: doc,
      };
      await sb(TABLE, {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(row),
      });
      return send(res, 200, { ok: true });
    }

    if (action === 'delete_all') {
      await sb(`${TABLE}?ts=gte.0`, {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' },
      });
      return send(res, 200, { ok: true });
    }

    return send(res, 400, { error: 'Acción desconocida: ' + action });
  } catch (e) {
    return send(res, e.status || 500, { error: e.message || 'Error interno', detail: e.detail || null });
  }
};
