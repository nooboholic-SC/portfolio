const STORAGE_KEY = 'edi_portfolio_state_v4';
const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');

function saveState(partial) {
  Object.assign(state, partial);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

const root = document.documentElement;
const themeBtn = document.getElementById('themeToggle');
const savedTheme = state.theme || 'dark';
root.setAttribute('data-theme', savedTheme);
themeBtn.textContent = savedTheme === 'dark' ? '🌙 Dark' : '☀️ Light';
themeBtn.addEventListener('click', () => {
  const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  themeBtn.textContent = next === 'dark' ? '🌙 Dark' : '☀️ Light';
  saveState({ theme: next });
});

const subtitleTexts = ['EDI Developer • ANSI X12 • B2B Integration', 'Retail + Healthcare EDI Automation', 'Parser / Mapping / Support / Monitoring'];
let subtitleIndex = 0, charIndex = 0, deleting = false;
const subtitleEl = document.getElementById('typingSubtitle');
(function typeLoop() {
  const current = subtitleTexts[subtitleIndex];
  subtitleEl.textContent = current.slice(0, charIndex);
  if (!deleting && charIndex < current.length) charIndex++;
  else if (deleting && charIndex > 0) charIndex--;
  else if (!deleting) deleting = true;
  else { deleting = false; subtitleIndex = (subtitleIndex + 1) % subtitleTexts.length; }
  setTimeout(typeLoop, deleting ? 35 : 65);
})();

const sections = [...document.querySelectorAll('main section, #home')];
const navLinks = [...document.querySelectorAll('#navLinks a')];
const navObserver = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) {
      const id = e.target.id;
      navLinks.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + id));
      history.replaceState(null, '', '#' + id);
    }
  });
}, { rootMargin: '-40% 0px -50% 0px', threshold: .02 });
sections.forEach((s) => s.id && navObserver.observe(s));

const reveal = new IntersectionObserver((ents) => {
  ents.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('in'); reveal.unobserve(e.target); }
  });
}, { threshold: .1 });
document.querySelectorAll('.fade-up').forEach((el) => reveal.observe(el));

const bars = document.querySelectorAll('.bar i');
const barObs = new IntersectionObserver((ents)=>{
  ents.forEach((e)=>{ if(e.isIntersecting){ e.target.style.width=e.target.dataset.w; barObs.unobserve(e.target);} });
},{threshold:.4});
bars.forEach(b=>barObs.observe(b));

const filterBtns = document.querySelectorAll('#projectFilters button');
const projectCards = document.querySelectorAll('#projectGrid .flip');
filterBtns.forEach(btn => btn.addEventListener('click', () => {
  const f = btn.dataset.filter;
  projectCards.forEach(c => {
    const tags = c.dataset.tags;
    c.style.display = (f === 'all' || tags.includes(f)) ? '' : 'none';
  });
}));

const cv = document.getElementById('particles');
const cx = cv.getContext('2d');
let W, H;
const pts = Array.from({length: 60}, () => ({x:Math.random(), y:Math.random(), vx:(Math.random()-.5)*.0007, vy:(Math.random()-.5)*.0007}));
function rs(){ W=cv.width=innerWidth; H=cv.height=innerHeight; }
rs();
addEventListener('resize', rs);
(function draw(){
  cx.clearRect(0,0,W,H);
  for(const p of pts){
    p.x += p.vx; p.y += p.vy;
    if(p.x<0||p.x>1)p.vx*=-1; if(p.y<0||p.y>1)p.vy*=-1;
    cx.fillStyle='rgba(110,170,255,.45)';
    cx.beginPath(); cx.arc(p.x*W,p.y*H,1.4,0,Math.PI*2); cx.fill();
  }
  requestAnimationFrame(draw);
})();

const heatmap = document.getElementById('heatmap');
function renderHeatmap(values) {
  heatmap.innerHTML = '';
  values.forEach(v => {
    const d = document.createElement('i');
    d.style.background = `rgba(89,195,255,${0.1 + Math.min(0.9, v)})`;
    heatmap.appendChild(d);
  });
}
function defaultHeatmap() {
  const vals = Array.from({length:140}, (_,i)=>((Math.sin(i*0.22)+1)/2)*0.75);
  renderHeatmap(vals);
}
async function loadGithubActivity(username) {
  try {
    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/events/public`);
    if (!res.ok) throw new Error('GitHub API request failed');
    const events = await res.json();
    const counts = new Map();
    const today = new Date();
    for (let i = 0; i < 140; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - (139 - i));
      counts.set(d.toISOString().slice(0,10), 0);
    }
    events.forEach(ev => {
      const day = (ev.created_at || '').slice(0,10);
      if (!counts.has(day)) return;
      const add = ev.type === 'PushEvent' ? Math.max(1, (ev.payload?.size || 1)) : 1;
      counts.set(day, counts.get(day) + add);
    });
    const max = Math.max(...counts.values(), 1);
    renderHeatmap([...counts.values()].map(v => v / max));
  } catch {
    defaultHeatmap();
  }
}
document.getElementById('loadGithubBtn').addEventListener('click', () => {
  const u = document.getElementById('githubUser').value.trim();
  if (u) loadGithubActivity(u);
});
defaultHeatmap();

const ediInput = document.getElementById('ediInput');
const lineNos = document.getElementById('lineNos');
const parsedView = document.getElementById('parsedView');
const outputView = document.getElementById('outputView');
const detailsView = document.getElementById('detailsView');
const errorList = document.getElementById('errorList');
const segmentTree = document.getElementById('segmentTree');
let pretty = true;

const samples = {
  '850': `ISA*00*          *00*          *ZZ*SENDERID       *ZZ*RECEIVERID     *260201*1200*U*00401*000000125*0*T*:~\nGS*PO*SENDER*RECEIVER*20260201*1200*125*X*004010~\nST*850*0001~\nBEG*00*NE*PO123456**20260201~\nPO1*1*100*EA*12.45**VP*ITEM001~\nCTT*1~\nSE*6*0001~\nGE*1*125~\nIEA*1*000000125~`,
  '837': `ISA*00*          *00*          *ZZ*CLM_SENDER     *ZZ*CLM_RECEIVER   *260201*1200*^*00501*000000321*1*T*:~\nGS*HC*CLM_SENDER*CLM_RECEIVER*20260201*1200*321*X*005010X222A1~\nST*837*0001*005010X222A1~\nBHT*0019*00*ABC123*20260201*1200*CH~\nSE*4*0001~\nGE*1*321~\nIEA*1*000000321~`,
  '835': `ISA*00*          *00*          *ZZ*PAYOR          *ZZ*PROVIDER       *260201*1200*^*00501*000000654*1*T*:~\nGS*HP*PAYOR*PROVIDER*20260201*1200*654*X*005010X221A1~\nST*835*1001~\nBPR*I*1500*C*CHK*01*999999999*DA*123456789*1512345678**01*987654321*DA*111111111*20260201~\nSE*3*1001~\nGE*1*654~\nIEA*1*000000654~`,
  '856': `ISA*00*          *00*          *ZZ*SHIPPER        *ZZ*RETAILER       *260201*1200*U*00401*000000777*0*T*:~\nGS*SH*SHIPPER*RETAILER*20260201*1200*777*X*004010~\nST*856*0001~\nBSN*00*SHIP12345*20260201*1200~\nSE*3*0001~\nGE*1*777~\nIEA*1*000000777~`,
  '810': `ISA*00*          *00*          *ZZ*INVSENDER      *ZZ*INVRECVR       *260201*1200*U*00401*000000888*0*T*:~\nGS*IN*INVSENDER*INVRECVR*20260201*1200*888*X*004010~\nST*810*0001~\nBIG*20260201*INV1023*PO123456~\nSE*3*0001~\nGE*1*888~\nIEA*1*000000888~`
};
ediInput.value = state.lastEdi || samples['850'];

function syncLines() {
  const lines = Math.max(1, ediInput.value.split('\n').length);
  lineNos.textContent = Array.from({length: lines}, (_, i) => i + 1).join('\n');
  lineNos.scrollTop = ediInput.scrollTop;
}
function detectDelims(s) {
  const i = s.indexOf('ISA');
  if (i === -1 || s.length < i + 106) return { e: '*', t: '~' };
  return { e: s[i + 3] || '*', t: s[i + 105] || '~' };
}
function parseEDI(raw) {
  const { e, t } = detectDelims(raw);
  const segs = raw.replace(/\r/g, '').split(t).map(v => v.trim()).filter(Boolean);
  const split = segs.map(x => x.split(e));
  return { e, t, segs, split };
}
function validate(parsed) {
  const errs = [];
  const has = (id) => parsed.split.some(s => s[0] === id);
  ['ISA','GS','ST','SE','GE','IEA'].forEach((id) => { if (!has(id)) errs.push(`Missing required segment: ${id}`); });
  const st = parsed.split.findIndex(s => s[0] === 'ST');
  const se = parsed.split.findIndex(s => s[0] === 'SE');
  if (st !== -1 && se !== -1) {
    const exp = +(parsed.split[se][1] || NaN);
    const found = se - st + 1;
    if (!Number.isNaN(exp) && exp !== found) errs.push(`SE segment count mismatch (expected ${exp}, found ${found})`);
  }
  return errs;
}
function highlight(parsed) {
  return parsed.segs.map((seg, idx) => {
    const parts = seg.split(parsed.e);
    const lead = `<span class='seg'>${parts[0]}</span>`;
    const rest = parts.slice(1).map(v => `<span class='elm'>${parsed.e}</span><span class='val'>${escapeHtml(v)}</span>`).join('');
    return `${String(idx + 1).padStart(3,'0')} ${lead}${rest}<span class='elm'>${parsed.t}</span>`;
  }).join('\n');
}
function renderTree(parsed) {
  segmentTree.innerHTML = parsed.split.map((p, i) => {
    const seg = p[0] || 'SEG';
    const elems = p.slice(1).map((v, idx) => `<li>E${idx + 1}: ${escapeHtml(v)}</li>`).join('');
    return `<details ${i<3?'open':''}><summary>${seg} (${p.length-1} elements)</summary><ul>${elems || '<li>No elements</li>'}</ul></details>`;
  }).join('');
}
function parsedToJson(parsed) { return parsed.split.map(p => ({ segment: p[0], elements: p.slice(1) })); }
function parsedToXml(parsed) {
  return `<edi>\n${parsed.split.map(p => `  <segment id="${p[0]}">\n${p.slice(1).map((v,i)=>`    <element index="${i+1}">${escapeHtml(v)}</element>`).join('\n')}\n  </segment>`).join('\n')}\n</edi>`;
}
function parsedToCsv(parsed) {
  const rows = ['segment,position,value'];
  parsed.split.forEach(p => p.slice(1).forEach((v,i)=>rows.push(`${p[0]},${i+1},"${String(v).replace(/"/g,'""')}"`)));
  return rows.join('\n');
}

let lastParsed = null;
let lastType = 'txt';
function doParse() {
  const raw = ediInput.value.trim();
  if (!raw) return;
  const parsed = parseEDI(raw);
  lastParsed = parsed;
  parsedView.innerHTML = highlight(parsed);
  renderTree(parsed);
  const errs = validate(parsed);
  errorList.innerHTML = errs.length ? errs.map(e => `<li>${e}</li>`).join('') : '<li style="color:var(--success)">No validation errors detected.</li>';
  const st = parsed.split.find(x => x[0] === 'ST') || [];
  const isa = parsed.split.find(x => x[0] === 'ISA') || [];
  detailsView.textContent = [
    `Transaction Set: ${st[1] || 'N/A'}`,
    `Control Number: ${st[2] || 'N/A'}`,
    `Sender ID: ${isa[6] || 'N/A'}`,
    `Receiver ID: ${isa[8] || 'N/A'}`,
    `Segments: ${parsed.segs.length}`,
    `Delimiters: element='${parsed.e}', terminator='${parsed.t}'`
  ].join('\n');
  saveState({ lastEdi: ediInput.value });
  confettiBurst();
}
function showOutput(type) {
  if (!lastParsed) doParse();
  if (!lastParsed) return;
  let out = '';
  if (type === 'json') out = pretty ? JSON.stringify(parsedToJson(lastParsed), null, 2) : JSON.stringify(parsedToJson(lastParsed));
  if (type === 'xml') out = parsedToXml(lastParsed);
  if (type === 'csv') out = parsedToCsv(lastParsed);
  outputView.textContent = out;
  lastType = type;
}

const debounced = (fn, ms = 320) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const onRealtime = debounced(() => doParse(), 320);
ediInput.addEventListener('input', () => { syncLines(); onRealtime(); });
ediInput.addEventListener('scroll', () => { lineNos.scrollTop = ediInput.scrollTop; });
syncLines(); doParse();

document.getElementById('parseBtn').addEventListener('click', doParse);
document.getElementById('toJsonBtn').addEventListener('click', () => showOutput('json'));
document.getElementById('toXmlBtn').addEventListener('click', () => showOutput('xml'));
document.getElementById('toCsvBtn').addEventListener('click', () => showOutput('csv'));
document.getElementById('prettyToggle').addEventListener('click', (e) => {
  pretty = !pretty;
  e.target.textContent = `Pretty: ${pretty ? 'ON' : 'OFF'}`;
  if (lastType === 'json') showOutput('json');
});
document.getElementById('sampleSelect').addEventListener('change', (e) => {
  ediInput.value = samples[e.target.value];
  syncLines();
  doParse();
});
document.getElementById('clearBtn').addEventListener('click', () => {
  ediInput.value = '';
  syncLines();
  parsedView.textContent = 'Waiting for parse...';
  outputView.textContent = 'Choose conversion (JSON/XML/CSV)';
  detailsView.textContent = 'N/A';
  segmentTree.innerHTML = '';
  errorList.innerHTML = '';
});

document.getElementById('fileInput').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => { ediInput.value = String(r.result || ''); syncLines(); doParse(); };
  r.readAsText(f);
});
const drop = document.getElementById('dropZone');
['dragenter','dragover'].forEach(ev => drop.addEventListener(ev, (e)=>{ e.preventDefault(); drop.style.outline='2px dashed var(--accent)'; }));
['dragleave','drop'].forEach(ev => drop.addEventListener(ev, (e)=>{ e.preventDefault(); drop.style.outline='none'; }));
drop.addEventListener('drop', (e)=>{
  const f = e.dataTransfer.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => { ediInput.value = String(r.result || ''); syncLines(); doParse(); };
  r.readAsText(f);
});

document.getElementById('copyOut').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(outputView.textContent); } catch {}
});
document.getElementById('downloadOut').addEventListener('click', () => {
  const map = { json: 'application/json', xml: 'application/xml', csv: 'text/csv', txt: 'text/plain' };
  const ext = lastType || 'txt';
  const blob = new Blob([outputView.textContent], { type: map[ext] || 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `edi-output.${ext}`;
  a.click();
  URL.revokeObjectURL(a.href);
});

document.addEventListener('keydown', (e) => {
  if (!e.ctrlKey) return;
  if (e.key === 'Enter') { e.preventDefault(); doParse(); }
  if (e.key.toLowerCase() === 'j') { e.preventDefault(); showOutput('json'); }
  if (e.key.toLowerCase() === 'm') { e.preventDefault(); showOutput('xml'); }
  if (e.key.toLowerCase() === 'l') { e.preventDefault(); showOutput('csv'); }
});

const panel = document.getElementById('workbenchPanel');
const handle = document.getElementById('dragHandle');
let dragging = false, ox = 0, oy = 0;
handle.addEventListener('pointerdown', (e) => {
  dragging = true;
  panel.style.position = 'absolute';
  const r = panel.getBoundingClientRect();
  ox = e.clientX - r.left; oy = e.clientY - r.top;
  handle.setPointerCapture(e.pointerId);
});
handle.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const parent = document.querySelector('.workbench-wrap').getBoundingClientRect();
  const x = Math.min(Math.max(0, e.clientX - parent.left - ox), parent.width - panel.offsetWidth);
  const y = Math.min(Math.max(0, e.clientY - parent.top - oy), Math.max(0, parent.height - 80));
  panel.style.left = x + 'px'; panel.style.top = y + 'px';
});
handle.addEventListener('pointerup', () => { dragging = false; });

document.getElementById('printResume').addEventListener('click', () => window.print());

function confettiBurst() {
  const burst = document.createElement('div');
  burst.style.position = 'fixed'; burst.style.inset = '0'; burst.style.pointerEvents='none'; burst.style.zIndex='30';
  for(let i=0;i<18;i++){
    const p=document.createElement('i');
    p.style.position='absolute'; p.style.left=(45+Math.random()*10)+'%'; p.style.top='20%';
    p.style.width='5px'; p.style.height='10px'; p.style.background=['#59c3ff','#8a7dff','#34d399','#f59e0b'][i%4];
    p.style.transform=`translate(${(Math.random()-0.5)*100}px, ${(Math.random()*130)+30}px) rotate(${Math.random()*360}deg)`;
    p.style.opacity='0'; p.style.transition='all .55s ease';
    burst.appendChild(p); requestAnimationFrame(()=>{p.style.opacity='1'; p.style.transform += ' scale(.1)';});
  }
  document.body.appendChild(burst); setTimeout(()=>burst.remove(), 600);
}
