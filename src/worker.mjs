/* Moshi Concepts — Cloudflare Worker.
   Static assets are served by the ASSETS binding; the only dynamic route is
   POST /api/contact, which validates a contact-form submission and sends it
   via Resend. Configuration (never committed):
     RESEND_API_KEY  secret — Resend API key
     CONTACT_TO      address the messages are delivered to
     CONTACT_FROM    verified Resend sender, e.g. "Moshi Concepts <hello@yourdomain>" */

const MAX = { name: 100, email: 200, message: 5000 };
const MIN_MESSAGE = 10;
const MIN_FILL_MS = 3000;                       // faster than this is a bot
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const OK_URL = '/#contact-sent';
const ERR_URL = '/#contact-error';

async function readBody(request) {
  const ct = request.headers.get('content-type') || '';
  if (ct.includes('application/json')) return { data: await request.json(), json: true };
  const fd = await request.formData();          // plain <form> POST (no JavaScript)
  return { data: Object.fromEntries(fd.entries()), json: false };
}

function respond(request, json, ok, payload, redirectTo) {
  const wantsJson = json || (request.headers.get('accept') || '').includes('application/json');
  if (wantsJson) {
    return new Response(JSON.stringify(payload), {
      status: ok ? 200 : (payload.status || 400),
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
  return Response.redirect(new URL(redirectTo, request.url).toString(), 303);
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
  let body;
  try { body = await readBody(request); }
  catch { return respond(request, true, false, { ok: false, error: 'Bad request', status: 400 }, ERR_URL); }
  const { data, json } = body;

  // Honeypot: humans never see the field; bots fill it. Pretend success.
  if (data.website) return respond(request, json, true, { ok: true }, OK_URL);
  // Timing: contact.js stamps the form when it loads; a submit within 3s is a bot.
  const ts = Number(data.ts);
  if (ts && Date.now() - ts < MIN_FILL_MS) return respond(request, json, true, { ok: true }, OK_URL);

  const err = validate(data);
  if (err) return respond(request, json, false, { ok: false, error: err, status: 400 }, ERR_URL);

  // Name (never the value) any missing configuration so a misnamed or
  // undeployed secret is obvious from the form itself.
  const missing = ['RESEND_API_KEY', 'CONTACT_TO', 'CONTACT_FROM'].filter((k) => !env[k]);
  if (missing.length) {
    // Also list which bindings the deployed version *does* have (names only),
    // so a secret saved on the wrong Worker or version is obvious.
    const bound = Object.keys(env).sort().join(', ') || 'none';
    console.error('contact form not configured; missing: ' + missing.join(', ') + '; bound: ' + bound);
    return respond(request, json, false, { ok: false, error: "The contact form isn't configured yet (missing " + missing.join(', ') + '; bound: ' + bound + ').', status: 503 }, ERR_URL);
  }

  const name = String(data.name).trim().replace(/[\r\n]+/g, ' ');
  const email = String(data.email).trim();
  const message = String(data.message).trim();

  const r = await fetchImpl('https://api.resend.com/emails', {
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
  if (!r.ok) {
    return respond(request, json, false, { ok: false, error: 'Something went wrong sending that. Please try again in a moment.', status: 502 }, ERR_URL);
  }
  return respond(request, json, true, { ok: true }, OK_URL);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/contact') {
      if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: { allow: 'POST' } });
      return handleContact(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};
