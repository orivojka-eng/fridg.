// Password reset page logic (served as a file so the strict Content-Security-Policy allows it).
(function () {
  var params = new URLSearchParams(location.search);
  var token = params.get('token');
  var err = params.get('error');
  // Remove the one-time token from the address bar and history so it is not shared or re-used by accident.
  if (token || err) history.replaceState(null, '', location.pathname);

  var m = document.getElementById('m'), f = document.getElementById('f'), b = document.getElementById('b');
  function show(text, cls) { m.textContent = text; m.className = 'msg ' + cls; }
  if (!token || err) {
    f.hidden = true;
    show('This reset link is invalid or has expired. Request a new one from the app (Log in → Forgot password).', 'err');
    return;
  }
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var p1 = document.getElementById('p1').value, p2 = document.getElementById('p2').value;
    if (p1 !== p2) return show('The two passwords do not match.', 'err');
    if (p1.length < 6) return show('Use at least 6 characters.', 'err');
    b.disabled = true;
    fetch('/api/auth/reset-password', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ newPassword: p1, token: token }) })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) throw new Error(j.code === 'INVALID_TOKEN' ? 'This reset link has expired or was already used.' : (j.message || 'Could not save the password.'));
        });
      })
      .then(function () {
        f.hidden = true;
        token = null;
        show('Done. Open FRIDGR and log in with your new password. You were signed out on your other devices.', 'ok');
      })
      .catch(function (e2) {
        show(e2.message + ' Request a new link from the app if needed.', 'err');
        b.disabled = false;
      });
  });
})();
