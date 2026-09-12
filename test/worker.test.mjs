import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { handleContact, validate } from '../src/worker.mjs';

const ENV = { RESEND_API_KEY: 'k', CONTACT_TO: 'inbox@example.test', CONTACT_FROM: 'Site <no-reply@example.test>' };
const valid = { name: 'Ada', email: 'ada@example.test', message: 'Hello there, this is a real message.', ts: String(Date.now() - 10_000) };
const jsonReq = (body) => new Request('https://site.test/api/contact', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const formReq = (body) => new Request('https://site.test/api/contact', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString() });
const okFetch = () => { const calls = []; const f = async (url, init) => { calls.push({ url, init }); return new Response('{}', { status: 200 }); }; f.calls = calls; return f; };

test('validate: required, lengths, email', () => {
  assert.equal(validate({}), 'Please fill in your name, email and message.');
  assert.equal(validate({ ...valid, message: 'short' }), 'Please add a little more detail to your message.');
  assert.equal(validate({ ...valid, email: 'nope' }), "That email address doesn't look right.");
  assert.equal(validate({ ...valid, name: 'x'.repeat(101) }), 'That message is too long.');
  assert.equal(validate(valid), null);
});

test('honeypot filled: pretends success, sends nothing', async () => {
  const f = okFetch();
  const r = await handleContact(jsonReq({ ...valid, website: 'spam.example' }), ENV, f);
  assert.equal(r.status, 200); assert.deepEqual(await r.json(), { ok: true }); assert.equal(f.calls.length, 0);
});

test('submitted too fast: pretends success, sends nothing', async () => {
  const f = okFetch();
  const r = await handleContact(jsonReq({ ...valid, ts: String(Date.now() - 500) }), ENV, f);
  assert.equal(r.status, 200); assert.equal(f.calls.length, 0);
});

test('invalid input: 400 with a message, sends nothing', async () => {
  const f = okFetch();
  const r = await handleContact(jsonReq({ ...valid, email: 'bad' }), ENV, f);
  assert.equal(r.status, 400); assert.match((await r.json()).error, /email/); assert.equal(f.calls.length, 0);
});

test('unconfigured env: 503 naming the missing variables, sends nothing', async () => {
  const f = okFetch();
  const r = await handleContact(jsonReq(valid), { RESEND_API_KEY: 'k' }, f);
  assert.equal(r.status, 503); assert.equal(f.calls.length, 0);
  const { error } = await r.json();
  assert.match(error, /missing CONTACT_TO, CONTACT_FROM; bound: RESEND_API_KEY/); assert.doesNotMatch(error, /\bk\b/);
});

test('valid JSON submit: calls Resend correctly and returns ok', async () => {
  const f = okFetch();
  const r = await handleContact(jsonReq(valid), ENV, f);
  assert.equal(r.status, 200); assert.deepEqual(await r.json(), { ok: true });
  assert.equal(f.calls.length, 1);
  const { url, init } = f.calls[0];
  assert.equal(url, 'https://api.resend.com/emails');
  assert.equal(init.headers.authorization, 'Bearer k');
  const sent = JSON.parse(init.body);
  assert.equal(sent.from, ENV.CONTACT_FROM); assert.deepEqual(sent.to, [ENV.CONTACT_TO]);
  assert.equal(sent.reply_to, valid.email); assert.match(sent.subject, /Ada/); assert.match(sent.text, /real message/);
});

test('newlines in name cannot inject headers', async () => {
  const f = okFetch();
  await handleContact(jsonReq({ ...valid, name: 'Ada\r\nBcc: x@y' }), ENV, f);
  assert.doesNotMatch(JSON.parse(f.calls[0].init.body).subject, /[\r\n]/);
});

test('plain form POST (no JS): redirects back with the success anchor', async () => {
  const f = okFetch();
  const r = await handleContact(formReq(valid), ENV, f);
  assert.equal(r.status, 303); assert.equal(r.headers.get('location'), 'https://site.test/#contact-sent');
});

test('plain form POST with bad input: redirects to the error anchor', async () => {
  const r = await handleContact(formReq({ ...valid, message: 'hi' }), ENV, okFetch());
  assert.equal(r.status, 303); assert.equal(r.headers.get('location'), 'https://site.test/#contact-error');
});

test('Resend failure: 502 that passes Resend\'s reason through', async () => {
  const r = await handleContact(jsonReq(valid), ENV, async () => new Response(JSON.stringify({ statusCode: 403, message: 'The example.test domain is not verified.' }), { status: 403 }));
  assert.equal(r.status, 502); assert.match((await r.json()).error, /Resend: The example.test domain is not verified/);
  const r2 = await handleContact(jsonReq(valid), ENV, async () => new Response('x', { status: 500 }));
  assert.equal(r2.status, 502); assert.match((await r2.json()).error, /HTTP 500/);
});

test('router: GET /api/contact is 405; other paths go to ASSETS', async () => {
  let served = null;
  const env = { ASSETS: { fetch: async (req) => { served = new URL(req.url).pathname; return new Response('asset'); } } };
  assert.equal((await worker.fetch(new Request('https://site.test/api/contact'), env)).status, 405);
  assert.equal(await (await worker.fetch(new Request('https://site.test/styles.css'), env)).text(), 'asset');
  assert.equal(served, '/styles.css');
});
