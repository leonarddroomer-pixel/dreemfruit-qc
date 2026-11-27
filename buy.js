/* =====================================================================
   BUY LIST – anyone signed in (Arrie, Christiaan, Brian, Natasha …) adds what must be bought;
   whoever buys it ticks it off. Records are type 'buy' with op 'add' | 'bought' | 'cancel'.
   The sheet keeps the list on the tab "Buy List" of dreemFRUIT Maturity QC; 'lists' sends back
   the open items and what was bought in the last 14 days, so every device shows the same list.
   ===================================================================== */
var BY = { item: null };
var BYFOR = ['Packshed', 'Farm', 'Workshop', 'Office', 'Cleaning', 'Other'];
(function () {
  var d = document.createElement('div'); d.className = 'view'; d.id = 'v-buy';
  d.innerHTML = '<div class="paper"><h1>Buy list</h1>' +
    '<p class="note">Add what must be bought. Whoever buys it taps <b>Bought</b>. Works without signal – it goes to the office when there is signal.</p>' +
    '<button class="btn send" style="width:100%" onclick="byNew()">+ Add something to buy</button>' +
    '<div class="msg" id="bMsg" style="margin-top:10px"></div>' +
    '<h2>Still to buy</h2><div id="bOpen"></div>' +
    '<h2>Bought (last 14 days)</h2><div id="bDone"></div></div>';
  var ov = document.getElementById('ov'); ov.parentNode.insertBefore(d, ov);
  var st = document.createElement('style');
  st.textContent = '.byi{border:1px solid #ccc;border-radius:10px;padding:10px 12px;margin:8px 0;display:flex;gap:10px;align-items:center}' +
    '.byi.urg{border:2px solid #b00;background:#fff5f4}.byi .t{flex:1;font-size:18px}.byi .t small{display:block;font-size:13px;color:#666;margin-top:2px}' +
    '.byi .btn{height:52px;padding:0 16px}.byi.done{opacity:.65}.byi .wait{font-size:12px;color:#b07a00}';
  document.head.appendChild(st);
  var tiles = document.querySelector('.tiles'), b = document.createElement('button');
  b.className = 'tile'; b.onclick = function () { openBuy(); };
  b.innerHTML = '<b>Buy list</b><span>Things the packshed and farm need – add them, tick them off when bought</span>';
  tiles.appendChild(b);
})();

function openBuy() { if (!needUser()) return; go('buy'); el('bMsg').textContent = ''; byDraw(); }

/** The list as this device knows it: the sheet's list plus what this device saved and has not seen back yet. */
function byList() {
  var by = {}, out = [], srv = (APP.lists && APP.lists.buy) || [];
  srv.forEach(function (x) { by[x.id] = { id: x.id, what: x.what, qty: x.qty, forr: x.forr, urgent: x.urgent, notes: x.notes, by: x.by, added: x.added, status: x.status || 'Open', doneBy: x.doneBy, doneOn: x.doneOn }; });
  lsGet('dfqcBuy', []).forEach(function (r) {
    if (r.op === 'add' && !by[r.id]) by[r.id] = { id: r.id, what: r.what, qty: r.qty, forr: r.forr, urgent: r.urgent, notes: r.notes, by: r.by, added: r.date, status: 'Open', local: true };
  });
  lsGet('dfqcBuy', []).forEach(function (r) {
    if ((r.op === 'bought' || r.op === 'cancel') && by[r.item] && by[r.item].status === 'Open') {
      by[r.item].status = r.op === 'bought' ? 'Bought' : 'Not needed'; by[r.item].doneBy = r.by; by[r.item].doneOn = r.date; by[r.item].local = true;
    }
  });
  Object.keys(by).forEach(function (k) { out.push(by[k]); });
  return out;
}
function byDraw() {
  var L = byList(), open = L.filter(function (x) { return x.status === 'Open'; }), done = L.filter(function (x) { return x.status !== 'Open'; });
  open.sort(function (a, b) { return (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0) || (a.added < b.added ? -1 : 1); });
  done.sort(function (a, b) { return a.doneOn < b.doneOn ? 1 : -1; });
  var line = function (x) {
    return '<div class="t"><b>' + esc(x.what) + '</b>' + (x.qty ? ' · ' + esc(x.qty) : '') + (x.urgent ? ' <span class="pill r">urgent</span>' : '') +
      '<small>' + esc(x.forr || '') + ' · ' + esc(x.by || '') + ' · ' + dmy(x.added) + (x.notes ? ' · ' + esc(x.notes) : '') + '</small>' +
      (x.local ? '<span class="wait">waiting to send</span>' : '') + '</div>';
  };
  el('bOpen').innerHTML = open.length ? open.map(function (x) {
    return '<div class="byi' + (x.urgent ? ' urg' : '') + '">' + line(x) +
      '<button class="btn send" onclick="byDone(\'' + x.id + '\',\'bought\')">Bought ✓</button>' +
      '<button class="btn ghost" onclick="byDone(\'' + x.id + '\',\'cancel\')">Not needed</button></div>';
  }).join('') : '<p class="note">Nothing on the list.</p>';
  el('bDone').innerHTML = done.length ? done.slice(0, 40).map(function (x) {
    return '<div class="byi done">' + line(x) + '<div class="t" style="flex:0 0 34%;font-size:14px">' + esc(x.status) + '<small>' + esc(x.doneBy || '') + ' · ' + dmy(x.doneOn) + '</small></div></div>';
  }).join('') : '<p class="note">Nothing bought yet.</p>';
}

function byNew() {
  BY.item = { what: '', qty: '', forr: '', urgent: false, notes: '' };
  popShow('<div class="ptop"><div class="ptitle">Add something to buy</div></div>' +
    '<p><b>What</b></p><input type="text" id="bWhat" placeholder="e.g. blue plasters, hairnets, 20 L Cratewash">' +
    '<p><b>How many</b></p><input type="text" id="bQty" placeholder="e.g. 2 boxes">' +
    '<p><b>For</b></p><div class="grid" style="grid-template-columns:repeat(3,1fr)">' +
    BYFOR.map(function (f, i) { return '<button class="k sm" id="bF' + i + '" onclick="byFor(' + i + ')">' + f + '</button>'; }).join('') + '</div>' +
    '<p><button class="k sm" id="bUrg" style="width:100%;height:56px" onclick="byUrg()">Urgent – needed today / tomorrow</button></p>' +
    '<p><b>Notes</b> (shop, size, brand …)</p><textarea id="bNotes"></textarea>' +
    '<div class="pbar"><button class="btn ghost" onclick="closePop()">Cancel</button><button class="btn send" onclick="bySave()">Add to the list</button></div>');
  setTimeout(function () { var i = el('bWhat'); if (i) i.focus(); }, 100);
}
function byFor(i) { BY.item.forr = BYFOR[i]; BYFOR.forEach(function (f, k) { el('bF' + k).className = 'k sm' + (k === i ? ' sel' : ''); }); }
function byUrg() { BY.item.urgent = !BY.item.urgent; el('bUrg').className = 'k sm' + (BY.item.urgent ? ' sel' : ''); }
function bySave() {
  var what = el('bWhat').value.trim();
  if (!what) { el('bWhat').focus(); return; }
  var now = new Date(), r = { id: uid('BUY'), op: 'add', date: iso(), what: what, qty: el('bQty').value.trim(), forr: BY.item.forr, urgent: BY.item.urgent,
    notes: el('bNotes').value.trim(), by: APP.user.name, savedAt: now.toISOString() };
  byKeep(r); closePop(); byDraw();
  el('bMsg').className = 'msg ok'; el('bMsg').textContent = 'Added ✓ ' + what + (navigator.onLine ? '' : ' · goes to the office when there is signal');
  queue('buy', r, 'Buy list + ' + what);
}
function byDone(id, op) {
  var x = byList().filter(function (y) { return y.id === id; })[0]; if (!x) return;
  if (op === 'cancel' && !confirm('Take "' + x.what + '" off the list – not needed any more?')) return;
  var r = { id: uid('BUY'), op: op, item: id, date: iso(), by: APP.user.name, savedAt: new Date().toISOString() };
  byKeep(r); byDraw();
  el('bMsg').className = 'msg ok'; el('bMsg').textContent = (op === 'bought' ? 'Bought ✓ ' : 'Taken off ✓ ') + x.what;
  queue('buy', r, 'Buy list ' + (op === 'bought' ? '✓ bought ' : '– not needed ') + x.what);
}
/** Keep this device's own changes 14 days, so the list is right even before the sheet answers. */
function byKeep(r) {
  var keep = Date.now() - 14 * 864e5, list = lsGet('dfqcBuy', []).filter(function (x) { return Date.parse(x.savedAt) > keep; });
  list.push(r); lsSet('dfqcBuy', list);
}
