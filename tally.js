/* =====================================================================
   LUG COUNTS – three simple counters that share one screen:
     pick  Picking: lugs out of the orchard (supervisor adds 10 now, 20 later …)
     tip   Tipping: lugs tipped into the packshed
     san   Orchard sanitation: lugs of dropped fruit picked up
   Every entry is one record (type 'tally'). The sheet keeps the entries in a log and
   keeps the day total per block up to date (Harvest and Tipped tabs of dreemFRUIT Harvest).
   ===================================================================== */
var TL = { kind: 'pick', block: '', cult: '' };
var TLK = {
  pick: { title: 'Picking – lugs out of the orchard', verb: 'picked', tile: 'Picking', sub: 'Lugs coming out of the block – add them as they come' },
  tip: { title: 'Tipping – lugs into the packshed', verb: 'tipped', tile: 'Tipping', sub: 'Lugs tipped on the line – add them as you tip' },
  san: { title: 'Orchard sanitation – fruit picked up', verb: 'collected', tile: 'Orchard sanitation', sub: 'Lugs of dropped fruit picked up off the ground' }
};
(function () {
  var d = document.createElement('div'); d.className = 'view'; d.id = 'v-tal';
  d.innerHTML = '<div class="paper"><h1 id="tTitle"></h1>' +
    '<div class="head2">' +
    '<div class="hf"><b>Date:</b><div class="v ro" id="tDate"></div></div>' +
    '<div class="hf"><b>Supervisor:</b><div class="v ro" id="tBy"></div></div>' +
    '<div class="hf" style="grid-column:1/-1"><b>Block:</b><div class="v" id="tBlock" onclick="tlPickBlock()"></div></div>' +
    '</div>' +
    '<div id="tBig"></div>' +
    '<div class="row"><button class="btn send" style="flex:2" onclick="tlKeys(1)">+ Add lugs</button><button class="btn ghost" style="flex:1" onclick="tlKeys(-1)">Take off (mistake)</button></div>' +
    '<div class="msg" id="tMsg" style="margin-top:10px"></div>' +
    '<h2>Today</h2><div id="tTotals"></div><div class="recent" id="tList"></div></div>';
  var ov = document.getElementById('ov'); ov.parentNode.insertBefore(d, ov);
  var st = document.createElement('style');
  st.textContent = '#tBig{border:2px solid #1f5f2e;border-radius:10px;padding:14px;margin:10px 0;text-align:center;font-size:18px}#tBig b{display:block;font-size:64px;line-height:1.1;color:#1f5f2e}' +
    '#tTotals table td{font-size:18px;height:40px;cursor:default}#tTotals table td.l{text-align:left;padding-left:10px}';
  document.head.appendChild(st);
  // home tiles, in front of the ones that are still to come
  var tiles = document.querySelector('.tiles'), off = tiles.querySelector('.tile.off');
  ['pick', 'tip', 'san'].forEach(function (k) {
    var b = document.createElement('button'); b.className = 'tile'; b.onclick = function () { openTally(k); };
    b.innerHTML = '<b>' + TLK[k].tile + '</b><span>' + TLK[k].sub + '</span>';
    tiles.insertBefore(b, off);
  });
})();

function tlBlocks() { var L = APP.lists || {}; return (L.label && L.label.blocks && L.label.blocks.length ? L.label.blocks : L.blocks) || []; }
function openTally(kind) {
  if (!needUser()) return;
  var last = lsGet('dfqcTallyLast', {});
  TL = { kind: kind, block: (last[kind] && last[kind].date === iso()) ? last[kind].block : '', cult: (last[kind] && last[kind].date === iso()) ? last[kind].cult : '' };
  go('tal'); el('tMsg').textContent = ''; tlDraw();
}
/** Today's entries of this kind: what this device saved plus what the sheet already has (other tablets and phones). */
function tlToday(kind) {
  var seen = {}, out = [], today = iso();
  lsGet('dfqcTally', []).forEach(function (e) { if (e.kind === kind && e.date === today && !seen[e.id]) { seen[e.id] = 1; out.push(e); } });
  var srv = APP.lists && APP.lists.tally && APP.lists.tally.today === today ? (APP.lists.tally[kind] || []) : [];
  srv.forEach(function (e) { if (!seen[e.id]) { seen[e.id] = 1; out.push({ id: e.id, kind: kind, date: today, time: e.time, block: e.block, cult: e.cult, lugs: Number(e.lugs), by: e.by }); } });
  out.sort(function (a, b) { return a.time < b.time ? 1 : -1; });
  return out;
}
function tlDraw() {
  var K = TLK[TL.kind], rows = tlToday(TL.kind);
  el('tTitle').textContent = K.title; el('tDate').textContent = dmy(iso()); el('tBy').textContent = APP.user ? APP.user.name : '';
  setHead('tBlock', TL.block ? TL.block + (TL.cult ? ' · ' + TL.cult : '') : '', 'tap to pick the block');
  var mine = rows.filter(function (e) { return e.block === TL.block; }).reduce(function (s, e) { return s + e.lugs; }, 0);
  el('tBig').innerHTML = TL.block ? 'Lugs ' + K.verb + ' today – ' + esc(TL.block) + '<b>' + mine + '</b>' : '<span style="color:#b00">Pick the block first</span>';
  var per = {}, order = [];
  rows.forEach(function (e) { if (per[e.block] == null) { per[e.block] = { lugs: 0, n: 0, cult: e.cult }; order.push(e.block); } per[e.block].lugs += e.lugs; per[e.block].n++; });
  order.sort();
  var all = order.reduce(function (s, b) { return s + per[b].lugs; }, 0);
  el('tTotals').innerHTML = order.length ? '<table><colgroup><col style="width:22%"><col><col style="width:20%"><col style="width:20%"></colgroup><thead><tr><th>Block</th><th>Cultivar</th><th>Entries</th><th>Lugs</th></tr></thead><tbody>' +
    order.map(function (b) { return '<tr><td><b>' + esc(b) + '</b></td><td class="l">' + esc(per[b].cult || '') + '</td><td>' + per[b].n + '</td><td><b>' + per[b].lugs + '</b></td></tr>'; }).join('') +
    (order.length > 1 ? '<tr class="avg"><td>All</td><td></td><td>' + rows.length + '</td><td>' + all + '</td></tr>' : '') + '</tbody></table>' : '<p class="note">Nothing entered yet today.</p>';
  el('tList').innerHTML = rows.length ? '<b>Entries today</b>' + rows.slice(0, 40).map(function (e) { return '<div>' + esc(e.time) + ' · <b>' + esc(e.block) + '</b> · ' + (e.lugs > 0 ? '+' : '') + e.lugs + ' lugs · ' + esc(e.by || '') + '</div>'; }).join('') : '';
}
function tlPickBlock() {
  var B = tlBlocks();
  if (!B.length) { el('tMsg').className = 'msg err'; el('tMsg').textContent = 'The blocks are not loaded yet – connect to signal first.'; return; }
  popShow('<div class="ptop"><div class="ptitle">Block</div></div><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr))">' +
    B.map(function (b, i) { return '<button class="k sm' + (TL.block === b.block ? ' sel' : '') + '" style="height:66px" onclick="tlSetBlock(' + i + ')"><b style="font-size:20px">' + esc(b.block) + '</b><span class="sub" style="color:inherit">' + esc(b.cult) + '</span></button>'; }).join('') +
    '</div><div class="pbar"><button class="btn ghost" onclick="closePop()">Close</button></div>');
}
function tlSetBlock(i) {
  var b = tlBlocks()[i]; TL.block = b.block; TL.cult = b.cult;
  var last = lsGet('dfqcTallyLast', {}); last[TL.kind] = { date: iso(), block: b.block, cult: b.cult }; lsSet('dfqcTallyLast', last);
  closePop(); el('tMsg').textContent = ''; tlDraw();
}
var TLN = '', TLS = 1;
function tlKeys(sign) {
  if (!TL.block) return tlPickBlock();
  TLN = ''; TLS = sign; tlKeyDraw(); el('ov').className = 'show';
}
function tlKeyDraw() {
  var K = TLK[TL.kind];
  el('pop').innerHTML = '<div class="ptop"><div class="ptitle">' + (TLS > 0 ? 'Lugs ' + K.verb + ' – ' : 'Take off lugs entered by mistake – ') + esc(TL.block) + '</div></div>' +
    '<div class="pval" style="margin:0 auto 10px;max-width:420px' + (TLS < 0 ? ';background:#f8d7d3' : '') + '">' + (TLS < 0 ? '−' : '+') + (TLN || '0') + '</div><div class="keypad">' +
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'].map(function (x) { return '<button class="k' + (x === 'OK' ? ' send' : '') + '" onclick="tlKey(\'' + x + '\')">' + x + '</button>'; }).join('') +
    '</div><div class="pbar"><button class="btn ghost" onclick="closePop()">Cancel</button></div>';
}
function tlKey(x) {
  if (x === '⌫') TLN = TLN.slice(0, -1);
  else if (x === 'OK') { var n = Number(TLN); if (!n) return; if (n > 500 && !confirm(n + ' lugs in one entry – is that right?')) return; closePop(); return tlAdd(TLS * n); }
  else if (TLN.length < 4) TLN += x;
  tlKeyDraw();
}
function tlAdd(lugs) {
  var now = new Date(), K = TLK[TL.kind];
  var e = { id: uid('TAL'), kind: TL.kind, date: iso(), time: ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2), block: TL.block, cult: TL.cult, lugs: lugs, by: APP.user.name, notes: '', savedAt: now.toISOString() };
  var keep = Date.now() - 4 * 864e5, list = lsGet('dfqcTally', []).filter(function (x) { return Date.parse(x.savedAt) > keep; });
  list.push(e); lsSet('dfqcTally', list);
  tlDraw();
  var total = tlToday(TL.kind).filter(function (x) { return x.block === e.block; }).reduce(function (s, x) { return s + x.lugs; }, 0);
  el('tMsg').className = 'msg ok'; el('tMsg').textContent = 'Saved ✓ ' + (lugs > 0 ? '+' : '') + lugs + ' lugs · ' + e.block + ' today ' + total + (navigator.onLine ? '' : ' · goes to the sheet when there is signal');
  queue('tally', e, K.tile + ' ' + e.block + ' ' + (lugs > 0 ? '+' : '') + lugs + ' lugs – ' + e.time);
}
