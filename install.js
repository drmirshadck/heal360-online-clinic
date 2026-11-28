/* Install-app button for patients and doctors. Any element with data-install is shown only when the site can be installed. */
(function () {
  var deferred = null;
  var standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var done = false;
  try { done = localStorage.getItem("h360-installed") === "1"; } catch (e) {}
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});
  var st = document.createElement("style");
  st.textContent = "[data-install][hidden]{display:none!important}#instDlg{border:0;border-radius:18px;padding:22px;max-width:92vw;width:380px;font-family:inherit;color:#173B3D;box-shadow:0 20px 60px rgba(0,0,0,.3)}#instDlg::backdrop{background:rgba(0,0,0,.45)}#instDlg h3{margin:0 0 8px}#instDlg ol{padding-left:20px;line-height:1.6;margin:8px 0 14px}#instDlg button{border:0;border-radius:999px;padding:10px 20px;font-weight:700;background:#173B3D;color:#fff;width:100%;font-size:15px}";
  document.head.appendChild(st);
  function items() { return document.querySelectorAll("[data-install]"); }
  function show() {
    var ok = !standalone && !done;
    items().forEach(function (el) { el.hidden = !ok; });
  }
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; show(); });
  window.addEventListener("appinstalled", function () { done = true; deferred = null; try { localStorage.setItem("h360-installed", "1"); } catch (e) {} show(); });
  function help() {
    var d = document.getElementById("instDlg");
    if (!d) { d = document.createElement("dialog"); d.id = "instDlg"; document.body.appendChild(d); }
    d.innerHTML = ios
      ? "<h3>Install Heal 360</h3><ol><li>Open this page in <b>Safari</b>.</li><li>Tap the <b>Share</b> button (square with an arrow).</li><li>Tap <b>Add to Home Screen</b>, then <b>Add</b>.</li></ol><button>OK</button>"
      : "<h3>Install Heal 360</h3><ol><li>Open this page in <b>Chrome</b> or <b>Edge</b>.</li><li>Tap the browser menu (three dots).</li><li>Tap <b>Install app</b> or <b>Add to Home screen</b>.</li></ol><button>OK</button>";
    d.querySelector("button").onclick = function () { d.close(); };
    d.showModal();
  }
  document.addEventListener("click", function (ev) {
    var el = ev.target.closest && ev.target.closest("[data-install]");
    if (!el) return;
    ev.preventDefault();
    var nav = document.getElementById("nav"); if (nav) nav.classList.remove("open");
    if (deferred) { var p = deferred; deferred = null; p.prompt(); p.userChoice.then(function (c) { if (c.outcome !== "accepted") deferred = p; }); }
    else help();
  });
  document.addEventListener("DOMContentLoaded", show);
  show();
})();
