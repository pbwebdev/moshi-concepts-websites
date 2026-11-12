import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker, { handleContact, validate, issueToken, checkToken } from '../src/worker.mjs';

const ENV = { RESEND_API_KEY: 'k', CONTACT_TO: 'inbox@example.test', CONTACT_FROM: 'Site <no-reply@example.test>' };
const fields = { name: 'Ada', email: 'ada@example.test', message: 'Hello there, this is a real message.' };
/** A submission carrying a token issued `ageMs` ago, signed for `env`. */
const signed = async (body = fields, ageMs = 10_000, env = ENV) => ({ ...body, token: await issueToken(env, Date.now() - ageMs) });

const jsonReq = (body, headers = {}) => new Request('https://site.test/api/contact', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const formReq = (body) => new Request('https://site.test/api/contact', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString() });
const okFetch = () => { const calls = []; const f = async (url, init) => { calls.push({ url, init }); return new Response('{}', { status: 200 }); }; f.calls = calls; return f; };

test('validate: required, lengths, email', () => {
  assert.equal(validate({}), 'Please fill in your name, email and message.');
  assert.equal(validate({ ...fields, message: 'short' }), 'Please add a little more detail to your message.');
  assert.equal(validate({ ...fields, email: 'nope' }), "That email address doesn't look right.");
  assert.equal(validate({ ...fields, name: 'x'.repeat(101) }), 'That message is too long.');
  assert.equal(validate(fields), null);
});

test('honeypot filled: pretends success, sends nothing', async () => {
  const f = okFetch();
  const r = await handleContact(jsonReq({ ...(await signed()), website: 'spam.example' }), ENV, f);
  assert.equal(r.status, 200); assert.deepEqual(await r.json(), { ok: true }); assert.equal(f.calls.length, 0);
});

// ---- Form tokens: the check the spam got past ------------------------------

test('the reported spam, posted with no token, sends nothing', async () => {
  // The exact submission that reached the inbox: a bot posting straight at
  // the endpoint, with the old timing field left blank.
  const spam = { name: 'n', email: 'n@n.co', message: 'hellohello', ts: '' };
  const f = okFetch();
  const r = await handleContact(jsonReq(spam), ENV, f);
  assert.equal(r.status, 400); assert.equal(f.calls.length, 0);
  const r2 = await handleContact(formReq(spam), ENV, f);
  assert.equal(r2.headers.get('location'), 'https://site.test/#contact-needs-js');
  assert.equal(f.calls.length, 0);
});

test('a forged, tampered or foreign token sends nothing', async () => {
  const good = await issueToken(ENV, Date.now() - 10_000);
  const [issued, sig] = good.split('.');
  const cases = {
    forged: issued + '.' + 'a'.repeat(64),
    // Backdating the time to look older invalidates the signature.
    tampered: String(Number(issued) - 60_000) + '.' + sig,
    malformed: 'not-a-token',
    // Signed with a different key, as if lifted from another deployment.
    foreign: await issueToken({ RESEND_API_KEY: 'other' }, Date.now() - 10_000),
  };
  for (const [kind, token] of Object.entries(cases)) {
    assert.equal(await checkToken(token, ENV), 'invalid', kind);
    const f = okFetch();
    const r = await handleContact(jsonReq({ ...fields, token }), ENV, f);
    assert.equal(r.status, 400, kind); assert.equal(f.calls.length, 0, kind);
  }
});

test('a token used within 3 seconds: pretends success, sends nothing', async () => {
  const f = okFetch();
  const r = await handleContact(jsonReq(await signed(fields, 500)), ENV, f);
  assert.equal(r.status, 200); assert.deepEqual(await r.json(), { ok: true }); assert.equal(f.calls.length, 0);
});

test('an expired token is refused with a reload message', async () => {
  const f = okFetch();
  const r = await handleContact(jsonReq(await signed(fields, 25 * 60 * 60 * 1000)), ENV, f);
  assert.equal(r.status, 400); assert.match((await r.json()).error, /reload/i); assert.equal(f.calls.length, 0);
});

test('FORM_SECRET, when set, is the signing key', async () => {
  const env = { ...ENV, FORM_SECRET: 'rotated' };
  assert.equal(await checkToken(await issueToken(env, Date.now() - 10_000), env), 'ok');
  assert.equal(await checkToken(await issueToken(ENV, Date.now() - 10_000), env), 'invalid',
    'a token signed with the Resend-derived key must stop working once FORM_SECRET is set');
});

// ---- Request shape -----------------------------------------------------------

test('a post from another site is refused', async () => {
  const f = okFetch();
  const r = await handleContact(jsonReq(await signed(), { origin: 'https://evil.example' }), ENV, f);
  assert.equal(r.status, 403); assert.equal(f.calls.length, 0);
  // Its own origin is fine.
  const ok = await handleContact(jsonReq(await signed(), { origin: 'https://site.test' }), ENV, okFetch());
  assert.equal(ok.status, 200);
});

test('an oversized body is refused before it is parsed', async () => {
  const f = okFetch();
  const big = await signed({ ...fields, message: 'x'.repeat(40 * 1024) });
  const r = await handleContact(jsonReq(big), ENV, f);
  assert.equal(r.status, 413); assert.equal(f.calls.length, 0);
});

test('unexpected body shapes are refused', async () => {
  const req = (body, type) => new Request('https://site.test/api/contact', { method: 'POST', headers: { 'content-type': type }, body });
  assert.equal((await handleContact(req('[1,2]', 'application/json'), ENV, okFetch())).status, 400);
  assert.equal((await handleContact(req('{not json', 'application/json'), ENV, okFetch())).status, 400);
  assert.equal((await handleContact(req('a=b', 'text/plain'), ENV, okFetch())).status, 415);
});

test('the rate limit cuts a sender off before anything is parsed or sent', async () => {
  const seen = [];
  const env = { ...ENV, CONTACT_LIMITER: { limit: async ({ key }) => (seen.push(key), { success: false }) } };
  const f = okFetch();
  const r = await handleContact(new Request('https://site.test/api/contact', {
    method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.9' }, body: JSON.stringify(await signed()),
  }), env, f);
  assert.equal(r.status, 303); assert.equal(f.calls.length, 0);
  assert.deepEqual(seen, ['send:203.0.113.9'], 'limited per address, under its own key');
});

// ---- What a prober can learn -------------------------------------------------

test('unconfigured env: 503 that names nothing', async () => {
  const f = okFetch();
  const r = await handleContact(jsonReq(await signed(fields, 10_000, { RESEND_API_KEY: 'k' })), { RESEND_API_KEY: 'k' }, f);
  assert.equal(r.status, 503); assert.equal(f.calls.length, 0);
  const { error } = await r.json();
  assert.doesNotMatch(error, /CONTACT_|RESEND|bound/, 'binding names leaked to the visitor');
});

test('Resend failure: 502 that keeps Resend\'s reason out of the response', async () => {
  const r = await handleContact(jsonReq(await signed()), ENV, async () => new Response(JSON.stringify({ statusCode: 403, message: 'The example.test domain is not verified.' }), { status: 403 }));
  assert.equal(r.status, 502);
  assert.doesNotMatch((await r.json()).error, /Resend|verified|example\.test/);
});

// ---- The happy path still works ---------------------------------------------

test('valid JSON submit: calls Resend correctly and returns ok', async () => {
  const f = okFetch();
  const r = await handleContact(jsonReq(await signed()), ENV, f);
  assert.equal(r.status, 200); assert.deepEqual(await r.json(), { ok: true });
  assert.equal(f.calls.length, 1);
  const { url, init } = f.calls[0];
  assert.equal(url, 'https://api.resend.com/emails');
  assert.equal(init.headers.authorization, 'Bearer k');
  const sent = JSON.parse(init.body);
  assert.equal(sent.from, ENV.CONTACT_FROM); assert.deepEqual(sent.to, [ENV.CONTACT_TO]);
  assert.equal(sent.reply_to, fields.email); assert.match(sent.subject, /Ada/); assert.match(sent.text, /real message/);
  assert.doesNotMatch(sent.text, /token/, 'the token is not part of the message');
});

test('newlines in name cannot inject headers', async () => {
  const f = okFetch();
  await handleContact(jsonReq(await signed({ ...fields, name: 'Ada\r\nBcc: x@y' })), ENV, f);
  assert.doesNotMatch(JSON.parse(f.calls[0].init.body).subject, /[\r\n]/);
});

test('plain form POST with a token: redirects back with the success anchor', async () => {
  const r = await handleContact(formReq(await signed()), ENV, okFetch());
  assert.equal(r.status, 303); assert.equal(r.headers.get('location'), 'https://site.test/#contact-sent');
});

test('plain form POST with bad input: redirects to the error anchor', async () => {
  const r = await handleContact(formReq(await signed({ ...fields, message: 'hi' })), ENV, okFetch());
  assert.equal(r.status, 303); assert.equal(r.headers.get('location'), 'https://site.test/#contact-error');
});

// ---- Router ------------------------------------------------------------------

test('router: the token endpoint issues a usable, uncached token', async () => {
  const r = await worker.fetch(new Request('https://site.test/api/contact/token'), ENV);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  const { token } = await r.json();
  assert.equal(await checkToken(token, ENV), 'early', 'a token straight from the endpoint must be too new to use');
  assert.equal((await worker.fetch(new Request('https://site.test/api/contact/token', { method: 'POST' }), ENV)).status, 405);
  assert.equal((await worker.fetch(new Request('https://site.test/api/contact/token'), {})).status, 503);
});

test('router: probes under /api/ get a 404 from the Worker, not the static files', async () => {
  let touched = false;
  const env = { ...ENV, ASSETS: { fetch: async () => { touched = true; return new Response('asset'); } } };
  for (const path of ['/api', '/api/', '/api/admin', '/api/v1/users', '/api/contact/../token']) {
    const r = await worker.fetch(new Request('https://site.test' + path), env);
    assert.ok([404, 200, 405].includes(r.status), path);
  }
  for (const path of ['/api', '/api/admin', '/api/v1/users']) {
    assert.equal((await worker.fetch(new Request('https://site.test' + path), env)).status, 404, path);
  }
  assert.equal(touched, false, 'an /api/ probe reached the static files');
});

test('router: GET /api/contact is 405; other paths go to ASSETS', async () => {
  let served = null;
  const env = { ASSETS: { fetch: async (req) => { served = new URL(req.url).pathname; return new Response('asset'); } } };
  assert.equal((await worker.fetch(new Request('https://site.test/api/contact'), env)).status, 405);
  assert.equal(await (await worker.fetch(new Request('https://site.test/styles.css'), env)).text(), 'asset');
  assert.equal(served, '/styles.css');
});

// ---- The page ----------------------------------------------------------------

test('the page no longer ships the forgeable timing field, and explains the no-JS case', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /name="ts"/);
  assert.match(html, /id="contact-needs-js"/);
  const js = readFileSync(new URL('../public/contact.js', import.meta.url), 'utf8');
  assert.match(js, /\/api\/contact\/token/);
  // The visitor reads these strings; the brief rules out em dashes.
  assert.doesNotMatch(js, /—/, 'em dash in a message the visitor sees');
});

test('Resend unreachable: the form\'s own 502, not an uncaught exception', async () => {
  const r = await handleContact(jsonReq(await signed()), ENV, async () => { throw new TypeError('network down'); });
  assert.equal(r.status, 502); assert.match((await r.json()).error, /try again/);
});
