const encoder = new TextEncoder();
const SESSION_SECONDS = 60 * 60 * 24 * 14;
const ITERATIONS = 310000;

const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
const bytes = length => crypto.getRandomValues(new Uint8Array(length));
const fromHex = value => new Uint8Array(value.match(/.{2}/g).map(part => parseInt(part, 16)));

async function digest(value) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}

async function derive(password, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2', hash:'SHA-256', salt:fromHex(salt), iterations:ITERATIONS}, key, 256)));
}

export const response = (data, status = 200, extra = {}) => Response.json(data, {
  status,
  headers: {'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', ...extra}
});
export const unavailable = () => response({error:'El servicio de cuentas todavía no está habilitado.'}, 503);
// A D1 binding alone must never open public registration by accident.
export const ready = env => Boolean(env?.DB?.prepare && env?.AUTH_ENABLED === 'true');
export const sameOrigin = request => {
  const origin=request.headers.get('Origin');
  return Boolean(origin && origin===new URL(request.url).origin);
};
export const throttle = async (db,request,scope,maximum=6) => {
  const ip=request.headers.get('CF-Connecting-IP')||'unknown';
  const key=await digest(`${scope}:${ip}`);
  const now=Math.floor(Date.now()/1000);
  await db.prepare(`INSERT INTO auth_attempts (key,count,window_start) VALUES (?,1,?)
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window_start<? THEN 1 ELSE count+1 END,
    window_start=CASE WHEN window_start<? THEN excluded.window_start ELSE window_start END`)
    .bind(key,now,now-900,now-900).run();
  const row=await db.prepare('SELECT count FROM auth_attempts WHERE key=?').bind(key).first();
  return row.count<=maximum;
};
export const body = async request => {
  if (Number(request.headers.get('content-length') || 0) > 8192) throw Error('body_too_large');
  const raw = await request.text();
  if (raw.length > 8192) throw Error('body_too_large');
  return JSON.parse(raw);
};
export const hashPassword = async password => {
  const salt = hex(bytes(16));
  return {salt, hash:await derive(password,salt)};
};
export const verifyPassword = async (password, salt, expected) => {
  const actual = fromHex(await derive(password,salt)), target = fromHex(expected);
  if (actual.length !== target.length) return false;
  let difference = 0;
  for(let i=0;i<actual.length;i++) difference |= actual[i] ^ target[i];
  return difference === 0;
};
export const createSession = async (db, userId) => {
  const token = hex(bytes(32));
  await db.prepare('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)')
    .bind(await digest(token),userId,Math.floor(Date.now()/1000)+SESSION_SECONDS).run();
  return token;
};
export const sessionCookie = token => `dw_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}`;
export const deleteCookie = 'dw_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';
export const currentUser = async (request,db) => {
  const token = request.headers.get('Cookie')?.match(/(?:^|;\s*)dw_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (!token) return null;
  return db.prepare(`SELECT users.id,users.email,users.display_name AS displayName,users.role
    FROM sessions JOIN users ON users.id=sessions.user_id
    WHERE sessions.token_hash=? AND sessions.expires_at>?`)
    .bind(await digest(token),Math.floor(Date.now()/1000)).first();
};
export const invalidateSession = async (request,db) => {
  const token = request.headers.get('Cookie')?.match(/(?:^|;\s*)dw_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if(token) await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(token)).run();
};
export const slugify = name => name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48);
export const validEmail = value => typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
