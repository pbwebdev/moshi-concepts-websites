/*
  The cookie banner, and the only thing that ever starts analytics.

  The default is no tracking: analytics.js does nothing until this file calls
  window.startAnalytics, which happens only on an explicit accept, so nobody
  is measured before they answer. Declining is remembered too, so the banner
  does not ask again. With JavaScript off there is no banner and no analytics,
  which is the safe way round.

  The choice is kept in localStorage rather than a cookie, so asking for
  consent does not itself set the thing being consented to. Every access is
  wrapped, because storage throws in a locked-down browser rather than
  returning nothing.
*/
(function () {
  var KEY = "moshi.consent";
  var VERSION = 1;

  var banner = document.getElementById("consent");
  var reopen = document.getElementById("consent-reopen");
  if (!banner) return;

  function readChoice() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return null;
      var saved = JSON.parse(raw);
      // A version bump retires old answers, for when what we ask changes.
      return saved && saved.version === VERSION ? saved.choice : null;
    } catch (err) {
      return null;
    }
  }

  function saveChoice(choice) {
    try {
      window.localStorage.setItem(
        KEY,
        JSON.stringify({ choice: choice, version: VERSION, at: new Date().toISOString() }),
      );
    } catch (err) {
      // Storage is unavailable, so the banner asks again next time. That is
      // the right failure: it never silently assumes a yes.
    }
  }

  function apply(choice) {
    if (choice === "granted" && typeof window.startAnalytics === "function") {
      window.startAnalytics();
    }
  }

  function show() {
    banner.hidden = false;
  }

  banner.addEventListener("click", function (event) {
    var button = event.target.closest("[data-consent]");
    if (!button) return;
    var choice = button.getAttribute("data-consent");
    saveChoice(choice);
    banner.hidden = true;
    apply(choice);
    // Hiding the banner would otherwise drop focus to the top of the page.
    if (reopen) reopen.focus();
  });

  if (reopen) {
    reopen.addEventListener("click", function () {
      show();
      var first = banner.querySelector("[data-consent]");
      if (first) first.focus();
    });
  }

  var stored = readChoice();
  if (stored) apply(stored);
  else show();
})();
