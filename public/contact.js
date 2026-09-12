/* Contact form: submit in place via fetch and show the result inline.
   Without JavaScript the form still POSTs to /api/contact and the worker
   redirects back with a :target message. */
(function () {
  var form = document.querySelector('.form');
  if (!form) return;
  var ts = form.querySelector('[name="ts"]');
  var status = form.querySelector('.form__status');
  var btn = form.querySelector('button[type="submit"]');
  if (ts) ts.value = String(Date.now());        // for the worker's timing check

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
    fetch(form.action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(data),
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (out) {
        if (res.ok && out.ok) {
          show("Thanks — your message is on its way. We'll be in touch.", 'ok');
          form.reset();
          if (ts) ts.value = String(Date.now());
        } else {
          show(out.error || 'Something went wrong sending that. Please try again in a moment.', 'err');
        }
      });
    }).catch(function () {
      show('Network error — please try again.', 'err');
    }).then(function () { btn.disabled = false; });
  });
})();
