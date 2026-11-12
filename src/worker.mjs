/* Moshi Concepts — Cloudflare Worker.
   Static assets are served by the ASSETS binding; the only dynamic route is
   POST /api/contact, which validates a contact-form submission and sends it
   via Resend. Configuration (never committed):
     RESEND_API_KEY  secret — Resend API key
     CONTACT_TO      address the messages are delivered to
     CONTACT_FROM    verified Resend sender, e.g. "Moshi Concepts <hello@yourdomain>"
     FORM_SECRET     optional secret — signs form tokens; falls back to RESEND_API_KEY */

const MAX = { name: 100, email: 200, message: 5000 };
const MIN_MESSAGE = 10;
const MIN_FILL_MS = 3000;                       // faster than this is a bot
const TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;   // a tab left open overnight still works
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const OK_URL = '/#contact-sent';
const ERR_URL = '/#contact-error';
const NEEDS_JS_URL = '/#contact-needs-js';

/* Form tokens.

   A submission must carry a token this Worker signed, which contact.js asks
   for when a visitor first touches the form. It is the check that matters:
   the spam that got through was posted straight at /api/contact by bots that
   never run the page's script, and a bot cannot sign a token without the key.

   The token is the time it was issued plus an HMAC of that time, so it also
   carries the timing check. The client used to stamp its own time, which
   any bot could forge and which, when left blank, skipped the check
   entirely.

   The key is derived from FORM_SECRET if it is set, otherwise from
   RESEND_API_KEY, so this works with no new configuration. Deriving from the
   Resend key reveals nothing about it: only the HMAC output leaves the
   Worker. Set FORM_SECRET if you ever want to rotate one without the other. */
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function tokenKey(env) {
  const secret = env.FORM_SECRET || env.RESEND_API_KEY;
  if (!secret) return null;
  return crypto.subtle.importKey('raw', enc.encode('contact-form-token:' + secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function issueToken(env, now = Date.now()) {
  const key = await tokenKey(env);
  if (!key) return null;
  return now + '.' + hex(await crypto.subtle.sign('HMAC', key, enc.encode(String(now))));
}

/** 'ok', 'early' (a bot moving faster than a person types), or why it fails:
    'missing', 'invalid', 'expired'. 'unchecked' when there is no key, in
    which case nothing can be sent anyway and the config error explains why. */
export async function checkToken(token, env, now = Date.now()) {
  const key = await tokenKey(env);
  if (!key) return 'unchecked';
  if (!token) return 'missing';
  const m = /^(\d{10,16})\.([0-9a-f]{64})$/.exec(String(token));
  if (!m) return 'invalid';
  const sig = new Uint8Array(m[2].match(/../g).map((h) => parseInt(h, 16)));
  // verify(), not a string comparison: it takes the same time however much
  // of a forged signature happens to match.
  if (!(await crypto.subtle.verify('HMAC', key, sig, enc.encode(m[1])))) return 'invalid';
  const age = now - Number(m[1]);
  if (age < MIN_FILL_MS) return 'early';
  if (age > TOKEN_MAX_AGE_MS) return 'expired';
  return 'ok';
}

// The largest legitimate submission is about 5.5 KB of fields. Anything far
// past that is not a contact message, and is refused before it is parsed.
const MAX_BODY_BYTES = 32 * 1024;

class BodyError extends Error {
  constructor(status) { super(String(status)); this.status = status; }
}

async function readBody(request) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_BODY_BYTES) throw new BodyError(413);
  // Read as text and parse it ourselves, so the cap also holds for a body
  // sent without a Content-Length.
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) throw new BodyError(413);
  const ct = request.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new BodyError(400);
    return { data, json: true };
  }
  // The page's form posts urlencoded, which is the only other shape accepted.
  if (ct.includes('application/x-www-form-urlencoded')) {
    return { data: Object.fromEntries(new URLSearchParams(raw)), json: false };
  }
  throw new BodyError(415);
}

/** Headers on every response the Worker writes itself. _headers covers the
    static files only, so without these the API answers bare. */
const API_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-robots-tag': 'noindex',
};

function json(payload, status) {
  return new Response(JSON.stringify(payload), { status, headers: API_HEADERS });
}

function respond(request, isJson, ok, payload, redirectTo) {
  const wantsJson = isJson || (request.headers.get('accept') || '').includes('application/json');
  if (wantsJson) return json(payload, ok ? 200 : (payload.status || 400));
  return Response.redirect(new URL(redirectTo, request.url).toString(), 303);
}

/** A browser always sends Origin on a POST. One naming another site is that
    site posting the form on its visitors' behalf. No Origin is a script or a
    bot, and the token check deals with those. */
function foreignOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try { return new URL(origin).host !== new URL(request.url).host; }
  catch { return true; }
}

/** Per-address limit, through the Workers rate-limiting binding declared in
    wrangler.jsonc. Absent in tests and local runs, where it is skipped. */
async function overLimit(request, env, kind) {
  if (!env.CONTACT_LIMITER) return false;
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const { success } = await env.CONTACT_LIMITER.limit({ key: kind + ':' + ip });
  return !success;
}

export function validate(d) {
  const name = String(d.name || '').trim();
  const email = String(d.email || '').trim();
  const message = String(d.message || '').trim();
  if (!name || !email || !message) return 'Please fill in your name, email and message.';
  if (name.length > MAX.name || email.length > MAX.email || message.length > MAX.message) return 'That message is too long.';
  if (message.length < MIN_MESSAGE) return 'Please add a little more detail to your message.';
  if (!EMAIL_RE.test(email)) return "That email address doesn't look right.";
  return null;
}

export async function handleContact(request, env, fetchImpl = fetch) {
  if (foreignOrigin(request)) return json({ ok: false, error: 'Forbidden' }, 403);
  if (await overLimit(request, env, 'send')) {
    return respond(request, false, false, { ok: false, error: 'Too many attempts. Please wait a minute and try again.', status: 429 }, ERR_URL);
  }

  let body;
  try { body = await readBody(request); }
  catch (e) {
    const status = e instanceof BodyError ? e.status : 400;
    return json({ ok: false, error: 'Bad request' }, status);
  }
  const { data, json: isJson } = body;

  // Honeypot: humans never see the field; bots fill it. Pretend success.
  if (data.website) return respond(request, isJson, true, { ok: true }, OK_URL);

  const token = await checkToken(data.token, env);
  // Signed, then posted faster than anyone types: a bot driving the page.
  // Pretend success, as for the honeypot, so it learns nothing.
  if (token === 'early') return respond(request, isJson, true, { ok: true }, OK_URL);
  // No token at all is almost always a bot posting directly, but it is also
  // what a person with JavaScript off sends. So this one answers honestly
  // rather than pretending: that person is told why, instead of believing a
  // message went that never did.
  if (token === 'missing') {
    return respond(request, isJson, false, { ok: false, error: 'This form needs JavaScript turned on, which is how it keeps spam out. Please enable it and try again.', status: 400 }, NEEDS_JS_URL);
  }
  if (token === 'invalid' || token === 'expired') {
    return respond(request, isJson, false, { ok: false, error: 'This form has expired. Please reload the page and try again.', status: 400 }, ERR_URL);
  }

  const err = validate(data);
  if (err) return respond(request, isJson, false, { ok: false, error: err, status: 400 }, ERR_URL);

  // Name (never the value) any missing configuration so a misnamed or
  // undeployed secret is obvious from the form itself.
  const missing = ['RESEND_API_KEY', 'CONTACT_TO', 'CONTACT_FROM'].filter((k) => !env[k]);
  if (missing.length) {
    // The names, and which bindings the deployed version does have, go to the
    // Worker's logs only. They used to be in the response, which helped the
    // first setup and told every prober what the Worker is wired to.
    const bound = Object.keys(env).sort().join(', ') || 'none';
    console.error('contact form not configured; missing: ' + missing.join(', ') + '; bound: ' + bound);
    return respond(request, isJson, false, { ok: false, error: 'The contact form is unavailable right now. Please try again later.', status: 503 }, ERR_URL);
  }

  const name = String(data.name).trim().replace(/[\r\n]+/g, ' ');
  const email = String(data.email).trim();
  const message = String(data.message).trim();

  let r;
  try {
    r = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: env.CONTACT_FROM,
        to: [env.CONTACT_TO],
        reply_to: email,
        subject: 'Website contact from ' + name,
        text: 'Name: ' + name + '\nEmail: ' + email + '\n\n' + message + '\n',
      }),
    });
  } catch (e) {
    // Resend unreachable, rather than refusing. Uncaught, this would be a
    // bare Cloudflare error page in place of the form's own message.
    console.error('resend unreachable: ' + (e && e.message));
    return respond(request, isJson, false, { ok: false, error: 'Something went wrong sending that. Please try again in a moment.', status: 502 }, ERR_URL);
  }
  if (!r.ok) {
    // Resend's reason (e.g. "domain is not verified") is what fixes this, so
    // it goes to the Worker's logs. Not to the visitor: it describes the
    // mail setup to anyone who triggers it.
    let reason = '';
    try { const e = await r.json(); reason = String(e.message || e.error || '').slice(0, 200); } catch {}
    console.error('resend rejected the send: HTTP ' + r.status + (reason ? ': ' + reason : ''));
    return respond(request, isJson, false, { ok: false, error: 'Something went wrong sending that. Please try again in a moment.', status: 502 }, ERR_URL);
  }
  return respond(request, isJson, true, { ok: true }, OK_URL);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/contact') {
      if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: { allow: 'POST', ...API_HEADERS, 'content-type': 'text/plain; charset=utf-8' } });
      return handleContact(request, env);
    }
    if (url.pathname === '/api/contact/token') {
      if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET', ...API_HEADERS, 'content-type': 'text/plain; charset=utf-8' } });
      if (await overLimit(request, env, 'token')) return json({ error: 'Too many attempts. Please wait a minute and try again.' }, 429);
      const token = await issueToken(env);
      // no-store, from API_HEADERS: a cached token would be shared between
      // visitors and grow stale.
      return token ? json({ token }, 200) : json({ error: 'The contact form is unavailable right now.' }, 503);
    }
    // Anything else under /api/ is a probe for an endpoint that does not
    // exist. Answer it here rather than pass it on to the static files.
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return json({ error: 'Not found' }, 404);
    return env.ASSETS.fetch(request);
  },
};
