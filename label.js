/* =====================================================================
   LABEL CHECK – photo of every label at the start of a run, checked against the master data.
   Rules come from Master Data – Farm through the 'lists' call (APP.lists.label): blocks, cultivars,
   fixed lines (GGN, PUC, PHC, packer), label specs per customer and the count / diameter table.
   With signal the photo is read (action 'ocr') and each line is ticked or failed automatically;
   lines that could not be read, and everything when there is no signal, are checked by eye.
   ===================================================================== */
var LB = null;
(function () {
  var d = document.createElement('div'); d.className = 'view'; d.id = 'v-lab';
  d.innerHTML = '<div class="paper"><h1>Label Check</h1>' +
    '<div class="head2">' +
    '<div class="hf"><b>Date:</b><div class="v" id="lDate" onclick="askDate(LB.date,function(v){LB.date=v;labRebuild();labDraw();})"></div></div>' +
    '<div class="hf"><b>QC:</b><div class="v ro" id="lQc"></div></div>' +
    '<div class="hf"><b>Block:</b><div class="v" id="lBlock" onclick="labPickBlock()"></div></div>' +
    '<div class="hf"><b>Cultivar:</b><div class="v ro" id="lCult"></div></div>' +
    '<div class="hf"><b>Label for:</b><div class="v" id="lType" onclick="labPickType()"></div></div>' +
    '<div class="hf"><b>Class:</b><div class="v" id="lCls" onclick="labPickCls()"></div></div>' +
    '<div class="hf"><b>Count:</b><div class="v" id="lCount" onclick="labPickCount()"></div></div>' +
    '<div class="hf"><b>Pack date code:</b><div class="v ro big" id="lCode"></div></div>' +
    '</div><div id="lTop"></div>' +
    '<div class="row"><label class="btn send" id="lPhotoBtn">📷 Photo of the label<input type="file" accept="image/*" capture="environment" style="display:none" onchange="labPhoto(this)"></label>' +
    '<div class="thumbs" id="lThumb" style="margin:0"></div><div class="msg" id="lRead"></div></div>' +
    '<table style="margin-top:10px"><colgroup><col style="width:24%"><col><col style="width:13%"><col style="width:13%"></colgroup>' +
    '<thead><tr><th>Line</th><th>The label must say</th><th>Right</th><th>Wrong</th></tr></thead><tbody id="lRows"></tbody></table>' +
    '<div id="lResult"></div>' +
    '<h2>Notes <span class="sub" style="display:inline">(what is wrong and what was fixed)</span></h2>' +
    '<textarea id="lNotes" onchange="LB.notes=this.value;labSave()"></textarea>' +
    '<div class="foot"><button class="btn ghost" onclick="labNew(true)">Clear</button><div class="msg" id="lMsg"></div><button class="btn send" onclick="labFinish()">SAVE ►</button></div>' +
    '<div class="recent" id="lRecent"></div></div>';
  var ov = document.getElementById('ov'); ov.parentNode.insertBefore(d, ov);
  var st = document.createElement('style');
  st.textContent = '#v-lab td{font-size:17px;height:46px}#v-lab td.ln{text-align:left;padding:4px 8px;font-size:15px;font-weight:bold;background:#f1f0ec;cursor:default}' +
    '#v-lab td.ex{text-align:left;padding:4px 8px;cursor:default}#v-lab td.ex small{display:block;font-size:13px;color:#8a1c10}#v-lab td.ex small.g{color:#1e7b34}' +
    '#v-lab td.pk{font-size:24px}#v-lab td.pk.yes{background:#b3261e;color:#fff}#v-lab td.pk.ok{background:#1e7b34;color:#fff}';
  document.head.appendChild(st);
})();

function labRules() { return APP.lists && APP.lists.label; }
function labBlank() { return { id: uid('LAB'), made: iso(), date: iso(), block: '', cult: '', crop: '', flesh: '', type: '', cls: '', count: '', photo: '', text: '', read: '', lines: [], notes: '', fixOf: '' }; }
function labSave() { var c = {}; for (var k in LB) c[k] = LB[k]; c.photo = ''; lsSet('dfqcLabDraft', c); }
function openLab() {
  if (!needUser()) return;
  if (!LB) { LB = lsGet('dfqcLabDraft', null) || labBlank(); if (LB.made !== iso()) LB = labBlank(); }
  go('lab'); labDraw();
}
function labNew(ask) {
  if (ask && (LB.block || LB.photo) && !confirm('Clear this label check? It has not been saved.')) return;
  LB = labBlank(); labSave(); labDraw();
}

/* --- pack date code: [last digit of week][day 1–7, Monday = 1][0][first digit of week] --- */
function labWeek(isoDate) {
  var p = isoDate.split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])), dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow + 3);
  var y1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return { week: 1 + Math.round(((d - y1) / 864e5 - 3 + ((y1.getUTCDay() + 6) % 7)) / 7), day: dow + 1 };
}
function labCode(isoDate) { var w = labWeek(isoDate); return String(w.week % 10) + w.day + '0' + Math.floor(w.week / 10); }

function labSpec() { var R = labRules(); return R ? R.specs.filter(function (s) { return s.type === LB.type; })[0] : null; }
function labSize() { var R = labRules(); return R ? R.sizes.filter(function (s) { return s.count === LB.count; })[0] : null; }

/* --- what the label must say --- */
function labExpect() {
  var R = labRules(), sp = labSpec(), sz = labSize(), out = [];
  if (!R || !LB.block || !sp || !LB.cls) return out;
  var F = R.fixed, w = labWeek(LB.date), days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  function add(key, name, exp, hint) { if (exp) out.push({ key: key, name: name, exp: exp, hint: hint || '', st: '', src: '', found: '' }); }
  add('packer', 'Packed by', F.PACKER);
  add('address', 'Address', F.ADDRESS);
  add('ggn', 'GGN', F.GGN);
  add('puc', 'PUC', F.PUC);
  add('phc', 'PHC', F.PHC);
  add('date', 'Packed (date code)', labCode(LB.date), 'week ' + w.week + ', ' + days[w.day - 1]);
  add('block', 'Block', LB.block);
  add('class', 'Class', 'CLASS ' + LB.cls);
  add('flesh', 'Flesh colour', LB.flesh);
  add('cult', 'Cultivar', LB.cult);
  add('crop', 'Commodity', LB.crop);
  if (sz) {
    add('diam', 'Diameter', sz.min + '-' + sz.max + 'mm ' + sz.letter);
    add('count', 'Count', sz.count + sz.letter, sz.layer + ' layer');
    if (sp.weight === 'Always' || (sp.weight === 'Single layer' && /single/i.test(sz.layer))) add('weight', 'Nett weight', 'Nett weight in kg', 'must be printed on ' + (sp.weight === 'Always' ? 'this label' : 'single-layer cartons'));
  } else {
    if (sp.size === 'Table') add('sizetable', 'Size table', 'Every count on the label has its right diameter', 'checked against the Fruit Sizes list');
    if (sp.size === 'Optional') add('nosize', 'Size (optional)', 'No size, or a count and diameter that belong together');
    if (sp.weight === 'Always') add('weight', 'Nett weight', 'Nett weight in kg');
  }
  if (sp.find.length) add('cust', 'Customer line', sp.line || sp.find.join(', '));
  if (sp.not.length) add('notcust', 'No other customer', 'Not on this label: ' + sp.not.map(function (x) { return x.split('|')[0]; }).join(', '));
  add('origin', 'Origin', F.ORIGIN);
  (sp.eye || []).forEach(function (t, i) { add('eye' + i, 'By eye ' + (i + 1), t, 'always checked by eye'); });
  add('print', 'Print and carton', 'Readable, nothing cut off, and on the right carton', 'always checked by eye');
  // keep answers already given when the expected text did not change
  var old = {}; (LB.lines || []).forEach(function (l) { old[l.key + '|' + l.exp] = l; });
  out.forEach(function (l) { var o = old[l.key + '|' + l.exp]; if (o) { l.st = o.st; l.src = o.src; l.found = o.found; } });
  return out;
}
function labRebuild() { LB.lines = labExpect(); if (LB.text) labRead(); labSave(); }

/* --- reading the photo text --- */
function labCanon(s) {
  return String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1').replace(/S/g, '5').replace(/B/g, '8').replace(/Z/g, '2');
}
function labRead() {
  var R = labRules(), sp = labSpec(), sz = labSize(), text = LB.text || '';
  if (!text || !R || !sp) return;
  var T = labCanon(text), U = text.toUpperCase().replace(/\s+/g, ' ');
  function has(x) { var c = labCanon(x); return c !== '' && T.indexOf(c) >= 0; }
  function ok(l, found) { l.st = 'ok'; l.src = 'read'; l.found = found || ''; }
  function bad(l, found) { l.st = 'bad'; l.src = 'read'; l.found = found || ''; }
  function code(l, word, val) {
    if (has(word + val)) return ok(l);
    var m = U.match(new RegExp(word + '\\W{0,3}([A-Z0-9]{' + Math.max(1, String(val).length - 1) + ',' + (String(val).length + 2) + '})'));
    if (m) { if (labCanon(m[1]) === labCanon(val)) ok(l); else bad(l, m[1]); }
  }
  function diamOf() { var m = U.match(/(\d{2})\s*[-–—~]?\s*(\d{2})\s*MM\s*([A-D]{1,5})?(?![A-Z])/); return m ? { min: +m[1], max: +m[2], letter: m[3] || '' } : null; }
  function countOf() { var m = U.match(/COUNT\s*:?\s*(\d{1,2})\s*([A-D]{1,5})?(?![A-Z])/); return m ? { count: m[1], letter: m[2] || '' } : null; }
  LB.lines.forEach(function (l) {
    if (l.src === 'eye') return;                     // the QC already decided this line
    l.st = ''; l.src = ''; l.found = '';
    var m, i, d, c;
    switch (l.key) {
      case 'packer': if (has(l.exp)) ok(l); break;
      case 'address': if (l.exp.split(/[^A-Za-z0-9]+/).filter(function (w) { return w.length >= 3; }).every(has)) ok(l); break;
      case 'ggn': if (has(l.exp)) ok(l); else { m = U.match(/GGN\W{0,3}(\d{8,14})/); if (m) bad(l, m[1]); } break;
      case 'puc': code(l, 'PUC', l.exp); break;
      case 'phc': code(l, 'PHC', l.exp); break;
      case 'date': if (has('PACKED' + l.exp)) ok(l); else { m = U.match(/PACKED\s*:\s*([0-9OIL]{3,5})(?![0-9A-Z])/); if (m) { if (labCanon(m[1]) === labCanon(l.exp)) ok(l); else bad(l, m[1]); } } break;
      case 'block': code(l, 'BLOCK', l.exp); break;
      case 'class': m = U.match(/CLASS\W{0,3}([0-9IL])/); if (m) { c = m[1].replace(/[IL]/, '1'); if (c === String(LB.cls)) ok(l); else bad(l, 'CLASS ' + c); } break;
      case 'flesh': if (has(l.exp)) ok(l); else { ['White flesh', 'Yellow flesh'].forEach(function (x) { if (x.toUpperCase() !== l.exp.toUpperCase() && has(x)) bad(l, x); }); } break;
      case 'cult': if (has(l.exp)) ok(l); else { (R.cults || []).forEach(function (x) { if (!l.st && x !== l.exp && labCanon(l.exp).indexOf(labCanon(x)) < 0 && has(x)) bad(l, x); }); } break;
      case 'crop': if (has(l.exp)) ok(l); else { ['Nectarine', 'Peach'].forEach(function (x) { if (x !== l.exp && has(x)) bad(l, x); }); } break;
      case 'diam': d = diamOf(); if (d) { if (d.min === sz.min && d.max === sz.max && (!d.letter || d.letter === sz.letter)) ok(l); else bad(l, d.min + '-' + d.max + 'mm ' + d.letter); } break;
      case 'count': c = countOf(); if (c) { if (c.count === String(sz.count) && (!c.letter || c.letter === sz.letter)) ok(l); else bad(l, c.count + c.letter); } break;
      case 'nosize': d = diamOf(); c = countOf();
        if (!d && !c) ok(l, 'no size printed');
        else if (d && c && R.sizes.some(function (s) { return s.count === c.count && s.min === d.min && s.max === d.max && (!c.letter || c.letter === s.letter); })) ok(l, c.count + c.letter + ' · ' + d.min + '-' + d.max + 'mm');
        else if (d && c) bad(l, c.count + c.letter + ' with ' + d.min + '-' + d.max + 'mm');
        break;
      case 'sizetable':
        var ds = [], re = /(\d{2})\s*[-–—]\s*(\d{2})\s*MM/g, mm;
        while ((mm = re.exec(U))) ds.push([+mm[1], +mm[2]]);
        if (!ds.length) break;
        var wrongD = ds.filter(function (x) { return !R.sizes.some(function (s) { return s.min === x[0] && s.max === x[1]; }); })[0];
        if (wrongD) { bad(l, wrongD[0] + '-' + wrongD[1] + 'mm is not a size on the list'); break; }
        // the counts: two-digit numbers standing on their own, in the order they are printed
        var cs = (U.replace(re, ' ').match(/(?:^|[^0-9A-Z])\d{2}(?![0-9A-Z-])/g) || []).map(function (x) { return x.replace(/\D/g, ''); })
          .filter(function (c) { return R.sizes.some(function (s) { return s.count === c; }); });
        var fits = function (c, x) { return R.sizes.some(function (s) { return s.count === c && s.min === x[0] && s.max === x[1]; }); };
        if (cs.length === ds.length) {
          for (i = 0; i < ds.length; i++) if (!fits(cs[i], ds[i])) { bad(l, cs[i] + ' with ' + ds[i][0] + '-' + ds[i][1] + 'mm'); break; }
          if (!l.st) ok(l, ds.length + ' sizes read');
        } else if (ds.every(function (x) { return cs.some(function (c) { return fits(c, x); }); })) ok(l, ds.length + ' sizes read');
        break;
      case 'weight': m = U.match(/(\d+(?:[.,]\d+)?)\s*KG/); if (m) ok(l, m[1] + ' kg'); break;
      case 'cust': if (sp.find.every(function (f) { return f.split('|').some(has); })) ok(l); break;
      case 'notcust': for (i = 0; i < sp.not.length; i++) { var hit = sp.not[i].split('|').filter(has)[0]; if (hit) { bad(l, hit); break; } } if (!l.st) ok(l); break;
      case 'origin': if (has(l.exp)) ok(l); break;
    }
  });
}

/* --- drawing --- */
function labDraw() {
  var R = labRules(), sp = labSpec(), sz = labSize();
  el('lDate').textContent = dmy(LB.date); el('lQc').textContent = APP.user ? APP.user.name : '';
  setHead('lBlock', LB.block, 'tap to pick'); el('lCult').textContent = LB.cult ? LB.cult + ' · ' + LB.crop + (LB.flesh ? ' · ' + LB.flesh : '') : '';
  setHead('lType', LB.type, 'tap to pick'); setHead('lCls', LB.cls ? 'Class ' + LB.cls : '', 'tap to pick');
  setHead('lCount', sz ? sz.count + sz.letter + ' · ' + sz.min + '–' + sz.max + ' mm · ' + sz.layer.toLowerCase() : (LB.count === '-' ? (sp && sp.size === 'Table' ? 'All sizes are on the label' : 'No size on label') : ''), 'tap to pick');
  el('lCode').textContent = labCode(LB.date);
  el('lNotes').value = LB.notes || '';
  var top = '';
  if (!R) top = '<div class="banner amber">The label rules are not loaded yet. Connect to signal and tap the sync button › “Update blocks and names”.' + (APP.lists && APP.lists.labelError ? '<br><small>' + esc(APP.lists.labelError) + '</small>' : '') + '</div>';
  else if (LB.fixOf) top = '<div class="banner grey">Re-check after a rejected label.</div>';
  top += notToday(LB.date);
  el('lTop').innerHTML = top;
  el('lThumb').innerHTML = LB.photo ? '<img src="' + LB.photo + '" onclick="labShowPhoto()">' : '';
  el('lRead').textContent = LB.read || '';
  el('lRows').innerHTML = LB.lines.length ? LB.lines.map(function (l, i) {
    return '<tr><td class="ln">' + esc(l.name) + '</td><td class="ex"><b>' + esc(l.exp) + '</b>' + (l.hint ? ' <span class="sub" style="display:inline">(' + esc(l.hint) + ')</span>' : '') +
      (l.st === 'bad' && l.found ? '<small>Label says: ' + esc(l.found) + '</small>' : '') +
      (l.st === 'ok' && l.src === 'read' ? '<small class="g">read from the photo' + (l.found ? ': ' + esc(l.found) : '') + '</small>' : '') +
      (l.st === '' && LB.text && l.key !== 'print' ? '<small>could not read – check by eye</small>' : '') + '</td>' +
      '<td class="pk' + (l.st === 'ok' ? ' ok' : '') + '" onclick="labSet(' + i + ',\'ok\')">' + (l.st === 'ok' ? '✓' : '') + '</td>' +
      '<td class="pk' + (l.st === 'bad' ? ' yes' : '') + '" onclick="labSet(' + i + ',\'bad\')">' + (l.st === 'bad' ? '✗' : '') + '</td></tr>';
  }).join('') : '<tr><td colspan="4" style="font-size:15px;color:#555;cursor:default">Pick the block, who the label is for, the class and the count. The lines to check appear here.</td></tr>';
  var r = labResult(), h = '';
  if (LB.lines.length) {
    if (r.bad) h = '<div class="banner red">REJECTED – ' + r.bad + ' line' + (r.bad > 1 ? 's' : '') + ' wrong. Do not use this label.</div>';
    else if (r.open) h = '<div class="banner amber">' + r.open + ' line' + (r.open > 1 ? 's' : '') + ' still to check – tap Right or Wrong.</div>';
    else h = '<div class="banner green">PASS – the label is right.</div>';
  }
  el('lResult').innerHTML = h;
  labRecent();
}
function labResult() { var bad = 0, open = 0; LB.lines.forEach(function (l) { if (l.st === 'bad') bad++; else if (l.st !== 'ok') open++; }); return { bad: bad, open: open }; }
function labSet(i, st) {
  var l = LB.lines[i];
  if (l.st === st && l.src === 'eye') { l.st = ''; l.src = ''; }
  else { if (st === 'ok' && l.st === 'bad' && l.src === 'read' && !confirm('The photo reads "' + (l.found || '?') + '" for ' + l.name + '. Mark it as right anyway?')) return; l.st = st; l.src = 'eye'; }
  labSave(); labDraw();
}
function labShowPhoto() { popShow('<img src="' + LB.photo + '" style="width:100%"><div class="pbar"><button class="btn ghost" onclick="closePop()">Close</button></div>'); }

/* --- pickers --- */
function labNeedRules() { if (labRules()) return true; el('lMsg').className = 'msg err'; el('lMsg').textContent = 'The label rules are not loaded yet – connect to signal first.'; return false; }
function labPickBlock() {
  if (!labNeedRules()) return; var B = labRules().blocks;
  popShow('<div class="ptop"><div class="ptitle">Block being packed</div></div><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr))">' +
    B.map(function (b, i) { return '<button class="k sm' + (LB.block === b.block ? ' sel' : '') + '" style="height:66px" onclick="labSetBlock(' + i + ')"><b style="font-size:20px">' + esc(b.block) + '</b><span class="sub" style="color:inherit">' + esc(b.cult) + '</span></button>'; }).join('') +
    '</div><div class="pbar"><button class="btn ghost" onclick="closePop()">Close</button></div>');
}
function labSetBlock(i) { var b = labRules().blocks[i]; LB.block = b.block; LB.cult = b.cult; LB.crop = b.crop; LB.flesh = b.flesh; closePop(); labRebuild(); labDraw(); }
function labPickType() {
  if (!labNeedRules()) return; var S2 = labRules().specs;
  popShow('<div class="ptop"><div class="ptitle">Who is this label for?</div></div><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">' +
    S2.map(function (s, i) { return '<button class="k sm' + (LB.type === s.type ? ' sel' : '') + '" style="font-size:20px;height:70px" onclick="labSetType(' + i + ')">' + esc(s.type) + '</button>'; }).join('') +
    '</div><div class="pbar"><button class="btn ghost" onclick="closePop()">Close</button></div>');
}
function labSetType(i) {
  var s = labRules().specs[i]; LB.type = s.type;
  if (s.classes.indexOf(String(LB.cls)) < 0) LB.cls = s.classes.length === 1 ? s.classes[0] : '';
  if (s.size === 'No' || s.size === 'Table') LB.count = '-'; else if (LB.count === '-' && s.size !== 'Optional') LB.count = '';
  closePop(); labRebuild(); labDraw();
}
function labPickCls() {
  var s = labSpec(); if (!s) return labPickType();
  popShow('<div class="ptop"><div class="ptitle">Class on this label</div></div><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">' +
    s.classes.map(function (c) { return '<button class="k' + (String(LB.cls) === c ? ' sel' : '') + '" style="height:70px" onclick="labSetCls(\'' + esc(c) + '\')">Class ' + esc(c) + '</button>'; }).join('') +
    '</div><div class="pbar"><button class="btn ghost" onclick="closePop()">Close</button></div>');
}
function labSetCls(c) { LB.cls = c; closePop(); labRebuild(); labDraw(); }
function labPickCount() {
  var s = labSpec(); if (!s) return labPickType();
  if (s.size === 'No' || s.size === 'Table') return;
  var Z = labRules().sizes, grp = function (layer) {
    var rows = Z.filter(function (z) { return z.layer === layer; });
    return rows.length ? '<p class="note" style="margin:8px 0 4px"><b>' + esc(layer) + ' layer</b></p><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr))">' +
      rows.map(function (z) { return '<button class="k sm' + (LB.count === z.count ? ' sel' : '') + '" style="height:66px" onclick="labSetCount(\'' + esc(z.count) + '\')"><b style="font-size:21px">' + esc(z.count + z.letter) + '</b><span class="sub" style="color:inherit">' + z.min + '–' + z.max + ' mm</span></button>'; }).join('') + '</div>' : '';
  };
  var layers = []; Z.forEach(function (z) { if (layers.indexOf(z.layer) < 0) layers.push(z.layer); });
  popShow('<div class="ptop"><div class="ptitle">Count on this label</div></div>' + layers.map(grp).join('') +
    (s.size === 'Optional' ? '<div class="pbar"><button class="btn ghost" onclick="labSetCount(\'-\')">No size on this label</button></div>' : '') +
    '<div class="pbar"><button class="btn ghost" onclick="closePop()">Close</button></div>');
}
function labSetCount(c) { LB.count = c; closePop(); labRebuild(); labDraw(); }

/* --- photo → read --- */
function labPhoto(inp) {
  var f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
  var img = new Image(), url = URL.createObjectURL(f);
  img.onload = function () {
    var s = Math.min(1, 1800 / Math.max(img.width, img.height)), c = document.createElement('canvas');
    c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
    LB.photo = c.toDataURL('image/jpeg', 0.85); LB.text = ''; LB.read = '';
    LB.lines.forEach(function (l) { if (l.src === 'read') { l.st = ''; l.src = ''; l.found = ''; } });
    labDraw(); labOcr();
  };
  img.src = url;
}
function labOcr() {
  if (!LB.photo) return;
  if (!navigator.onLine || !syncUrl()) { LB.read = 'No signal – check every line by eye.'; return labDraw(); }
  var id = LB.id; LB.read = 'Reading the label…'; labDraw();
  post({ action: 'ocr', name: APP.user.name, pin: APP.user.pin, photo: LB.photo }).then(function (r) {
    if (!LB || LB.id !== id) return;
    if (!r || !r.ok) throw new Error(r && r.error === 'PIN' ? 'sign in again' : (r && r.error) || 'no answer');
    LB.text = String(r.text || '').trim();
    if (LB.text.length < 20) { LB.text = ''; LB.read = 'Could not read this photo – take it again, closer and straight, or check by eye.'; }
    else { labRead(); var n = LB.lines.filter(function (l) { return l.src === 'read'; }).length; LB.read = 'Photo read: ' + n + ' of ' + LB.lines.length + ' lines checked automatically.'; }
    labSave(); labDraw();
  }).catch(function (e) { if (!LB || LB.id !== id) return; LB.read = 'Could not read the photo (' + e.message + ') – check by eye.'; labDraw(); });
}

/* --- save --- */
function labFinish() {
  var m = el('lMsg'); m.className = 'msg err';
  if (!labNeedRules()) return;
  if (!LB.block) return m.textContent = 'Pick the block.';
  if (!LB.type) return m.textContent = 'Pick who the label is for.';
  if (!LB.cls) return m.textContent = 'Pick the class.';
  var sp = labSpec();
  if (!LB.count && sp.size !== 'No' && sp.size !== 'Table') return m.textContent = 'Pick the count.';
  if (!LB.photo) return m.textContent = 'Take a photo of the label.';
  var r = labResult();
  if (r.open) return m.textContent = r.open + ' line' + (r.open > 1 ? 's' : '') + ' still to check.';
  LB.notes = el('lNotes').value.trim();
  if (r.bad && !LB.notes) return m.textContent = 'Write in Notes what is wrong on the label.';
  var sz = labSize(), result = r.bad ? 'REJECTED' : 'Pass', now = new Date();
  var read = LB.lines.filter(function (l) { return l.src === 'read'; }).length;
  var data = { id: LB.id, date: LB.date, time: ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2), block: LB.block, cult: LB.cult, type: LB.type, cls: LB.cls,
    count: sz ? sz.count + sz.letter : '', code: labCode(LB.date), result: result, lines: LB.lines.map(function (l) { return { name: l.name, exp: l.exp, st: l.st, src: l.src, found: l.found }; }),
    how: LB.text ? 'Photo read (' + read + ' lines) + by eye (' + (LB.lines.length - read) + ')' : 'By eye – photo not read', qc: APP.user.name, notes: LB.notes, photo: LB.photo,
    fixOf: LB.fixOf || '', text: LB.text || '', savedAt: now.toISOString() };
  var local = lsGet('dfqcLabLocal', []); local.push({ id: data.id, date: data.date, time: data.time, block: data.block, cult: data.cult, type: data.type, count: data.count, result: result }); lsSet('dfqcLabLocal', local.slice(-40));
  var wrong = LB.lines.filter(function (l) { return l.st === 'bad'; });
  queue('label', data, 'Label ' + data.block + ' ' + data.type + ' ' + data.count + ' – ' + result + ' – ' + dmy(data.date)).then(function () {
    popShow('<div class="banner ' + (r.bad ? 'red' : 'green') + '">' + esc(data.block) + ' ' + esc(data.cult) + ' · ' + esc(data.type) + ' ' + esc(data.count) + ' – ' + (r.bad ? 'REJECTED' : 'PASS') + '</div>' +
      (r.bad ? '<p style="font-size:18px"><b>Do not use this label.</b> Wrong:</p><ul style="font-size:17px">' + wrong.map(function (l) { return '<li>' + esc(l.name) + ' must be <b>' + esc(l.exp) + '</b>' + (l.found ? ' – label says ' + esc(l.found) : '') + '</li>'; }).join('') + '</ul><p style="font-size:17px">Fix the label on the label computer, print a new one, then check it again.</p>'
             : '<p style="font-size:18px">This label may be used. Check again when the block, the count or the label roll changes.</p>') +
      '<p class="note">Saved on the tablet' + (navigator.onLine ? ' – sending now.' : ' – it goes to the sheet when there is signal.') + '</p>' +
      '<div class="pbar">' + (r.bad ? '<button class="btn send" onclick="labAgain(true)">Check the fixed label</button>' : '<button class="btn send" onclick="labAgain(false)">Next label (same block)</button>') +
      '<button class="btn ghost" onclick="closePop();labNew(false);go(\'home\')">Done</button></div>');
  });
}
/** Keep the block and label type for the next check; after a reject keep the count too and link the two records. */
function labAgain(fix) {
  var o = LB; LB = labBlank(); LB.block = o.block; LB.cult = o.cult; LB.crop = o.crop; LB.flesh = o.flesh; LB.type = o.type; LB.cls = o.cls;
  if (fix) { LB.count = o.count; LB.fixOf = o.id; } else if (o.count === '-') LB.count = '-';
  LB.lines = labExpect(); labSave(); closePop(); labDraw(); window.scrollTo(0, 0);
}
function labRecent() {
  var rows = lsGet('dfqcLabLocal', []).filter(function (r) { return r.date === iso(); }).reverse();
  el('lRecent').innerHTML = rows.length ? '<b>Labels checked today on this tablet</b>' + rows.map(function (r) { return '<div>' + esc(r.time) + ' · <b>' + esc(r.block) + '</b> ' + esc(r.cult) + ' · ' + esc(r.type) + ' ' + esc(r.count) + ' · ' + (r.result === 'Pass' ? '<span class="pill g">pass</span>' : '<span class="pill r">rejected</span>') + '</div>'; }).join('') : '';
}
