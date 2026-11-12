/* Contact form: submit in place via fetch and show the result inline.

   Every submission carries a token the Worker signed. It is fetched the first
   time a visitor touches the form, not on page load, so nobody who only reads
   the page pays for the request. Without JavaScript there is no token, and
   the Worker redirects back to a message saying the form needs it. */
(function () {
  var form = document.querySelector('.form');
  if (!form) return;
  var status = form.querySelector('.form__status');
  var btn = form.querySelector('button[type="submit"]');

  // The Worker treats a token younger than 3s as a bot and quietly drops the
  // message while reporting success. So a real message must never be sent on
  // a token that fresh: if one has to be fetched at submit time, wait out
  // the difference, with a margin for the trip.
  var MIN_AGE_MS = 3300;
  // The Worker accepts tokens up to 24 hours old. Refresh well before that.
  var MAX_AGE_MS = 20 * 60 * 60 * 1000;

  var token = null;
  var receivedAt = 0;
  var pending = null;

  function fetchToken() {
    if (pending) return pending;
    pending = fetch('/api/contact/token', { headers: { 'Accept': 'application/json' } })
      .then(function (res) { return res.json().then(function (out) { return { res: res, out: out }; }); })
      .then(function (r) {
        if (!r.res.ok || !r.out.token) throw new Error(r.out.error || 'token');
        token = r.out.token;
        receivedAt = Date.now();
        return token;
      })
      .then(function (t) { pending = null; return t; }, function (e) { pending = null; throw e; });
    return pending;
  }

  /** A token that is safe to submit with, waiting if it is too new. */
  function ready() {
    var stale = !token || Date.now() - receivedAt > MAX_AGE_MS;
    return (stale ? fetchToken() : Promise.resolve(token)).then(function (t) {
      var wait = MIN_AGE_MS - (Date.now() - receivedAt);
      if (wait <= 0) return t;
      return new Promise(function (resolve) { setTimeout(function () { resolve(t); }, wait); });
    });
  }

  function warm() {
    form.removeEventListener('focusin', warm);
    form.removeEventListener('pointerdown', warm);
    fetchToken().catch(function () {});   // retried at submit if this fails
  }
  form.addEventListener('focusin', warm);
  form.addEventListener('pointerdown', warm);

  function show(text, kind) {
    status.textContent = text;
    status.className = 'form__status' + (kind ? ' form__status--' + kind : '');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();                          // native validation has already passed
    show('Sending…');
    btn.disabled = true;
    var data = {};
    new FormData(form).forEach(function (v, k) { data[k] = v; });

    ready().then(function (t) {
      data.token = t;
      return fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(data),
      });
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (out) {
        if (res.ok && out.ok) {
          show("Thanks, your message is on its way. We'll be in touch.", 'ok');
          form.reset();
        } else {
          // An expired or rejected token is replaced before the next try.
          if (res.status === 400) token = null;
          show(out.error || 'Something went wrong sending that. Please try again in a moment.', 'err');
        }
      });
    }).catch(function () {
      show('Network error. Please check your connection and try again.', 'err');
    }).then(function () { btn.disabled = false; });
  });
})();
