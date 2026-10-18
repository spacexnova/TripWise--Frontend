const $ = s => document.querySelector(s);
const KEY = 'tripwise.trip.v1';
const state = { all: [], loading: true, error: null, q: '', region: 'All', size: 'any', sort: 'name', shown: 24, view: 'explore' };
let trip = [];
try { trip = JSON.parse(localStorage.getItem(KEY)) || []; } catch { trip = []; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(trip)); } catch {} $('#badge').textContent = trip.length; };
const inTrip = id => trip.some(t => t.id === id);
const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : n;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.style.display = 'block'; clearTimeout(toast.id); toast.id = setTimeout(() => t.style.display = 'none', 1800); }

const BACKUP = [
['France','Paris','Europe',68e6,48.85,2.35,'fr','FRA'],['Italy','Rome','Europe',59e6,41.9,12.5,'it','ITA'],['Spain','Madrid','Europe',48e6,40.4,-3.7,'es','ESP'],
['Greece','Athens','Europe',10e6,37.98,23.72,'gr','GRC'],['Switzerland','Bern','Europe',8.7e6,46.95,7.45,'ch','CHE'],['Iceland','Reykjavik','Europe',3.8e5,64.15,-21.94,'is','ISL'],
['Japan','Tokyo','Asia',125e6,35.68,139.69,'jp','JPN'],['India','New Delhi','Asia',1.4e9,28.61,77.2,'in','IND'],['Thailand','Bangkok','Asia',70e6,13.75,100.5,'th','THA'],
['Vietnam','Hanoi','Asia',98e6,21.03,105.85,'vn','VNM'],['Nepal','Kathmandu','Asia',30e6,27.7,85.32,'np','NPL'],['Sri Lanka','Colombo','Asia',22e6,6.93,79.85,'lk','LKA'],
['Maldives','Male','Asia',5.2e5,4.17,73.51,'mv','MDV'],['Egypt','Cairo','Africa',110e6,30.04,31.24,'eg','EGY'],['Morocco','Rabat','Africa',37e6,34.02,-6.84,'ma','MAR'],
['Kenya','Nairobi','Africa',54e6,-1.29,36.82,'ke','KEN'],['South Africa','Pretoria','Africa',60e6,-25.75,28.19,'za','ZAF'],['United States','Washington, D.C.','Americas',331e6,38.9,-77.04,'us','USA'],
['Canada','Ottawa','Americas',38e6,45.42,-75.7,'ca','CAN'],['Brazil','Brasilia','Americas',213e6,-15.79,-47.88,'br','BRA'],['Peru','Lima','Americas',33e6,-12.05,-77.04,'pe','PER'],
['Australia','Canberra','Oceania',26e6,-35.28,149.13,'au','AUS'],['New Zealand','Wellington','Oceania',5.1e6,-41.29,174.78,'nz','NZL'],['Fiji','Suva','Oceania',9e5,-18.14,178.44,'fj','FJI']
].map(b=>({id:b[7],name:b[0],capital:b[1],region:b[2],sub:'',pop:b[3],flag:`https://flagcdn.com/w320/${b[6]}.png`,ll:[b[4],b[5]],langs:[],money:[]}));
state.backup = false;

async function fetchCountries(tries = 2) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 8000);
      const r = await fetch('https://restcountries.com/v3.1/all?fields=name,capital,region,subregion,population,flags,capitalInfo,cca3,languages,currencies', { signal: ctl.signal });
      clearTimeout(to);
      if (!r.ok) throw new Error('Server answered ' + r.status);
      return await r.json();
    } catch (e) { last = e; await new Promise(r => setTimeout(r, 800)); }
  }
  throw last;
}

async function load() {
  state.loading = true; state.error = null; state.backup = false; render();
  try {
    const d = await fetchCountries();
    state.all = d.map(c => ({
      id: c.cca3, name: c.name.common, capital: (c.capital || [])[0] || 'No capital',
      region: c.region || 'Other', sub: c.subregion || '', pop: c.population, flag: c.flags?.svg || c.flags?.png,
      ll: c.capitalInfo?.latlng, langs: Object.values(c.languages || {}), money: Object.values(c.currencies || {}).map(m => m.name)
    }));
  } catch (e) { state.all = BACKUP; state.backup = true; }
  state.loading = false; render();
}

function filtered() {
  const q = state.q.trim().toLowerCase();
  let r = state.all.filter(c =>
    (!q || c.name.toLowerCase().includes(q) || c.capital.toLowerCase().includes(q)) &&
    (state.region === 'All' || c.region === state.region) &&
    (state.size === 'any' || (state.size === 'small' ? c.pop < 5e6 : state.size === 'mid' ? c.pop >= 5e6 && c.pop < 5e7 : c.pop >= 5e7)));
  const s = { name: (a, b) => a.name.localeCompare(b.name), za: (a, b) => b.name.localeCompare(a.name), big: (a, b) => b.pop - a.pop, tiny: (a, b) => a.pop - b.pop };
  return r.sort(s[state.sort]);
}

function render() {
  $('#tExplore').classList.toggle('on', state.view === 'explore');
  $('#tTrip').classList.toggle('on', state.view === 'trip');
  $('#badge').textContent = trip.length;
  state.view === 'explore' ? renderExplore() : renderTrip();
}

function renderExplore() {
  const app = $('#app');
  const regions = ['All', ...new Set(state.all.map(c => c.region).filter(r => r !== 'Other')).values()].sort((a, b) => a === 'All' ? -1 : a.localeCompare(b));
  // keep the controls alive between renders so typing doesn't lose focus
  if (!$('#q')) {
    app.innerHTML = `<div class="bar">
      <input id="q" placeholder="Search a country or capital…" autocomplete="off">
      <select id="size"><option value="any">Any size</option><option value="small">Small (&lt;5M people)</option><option value="mid">Medium (5–50M)</option><option value="large">Large (50M+)</option></select>
      <select id="sort"><option value="name">Name A→Z</option><option value="za">Name Z→A</option><option value="big">Most populous</option><option value="tiny">Least populous</option></select>
      <button class="btn alt" id="reset" style="margin:0">Reset</button></div>
      <div class="chips" id="chips"></div><p class="count" id="count"></p><div id="results"></div>`;
    $('#q').oninput = e => { state.q = e.target.value; state.shown = 24; renderResults(); };
    $('#size').onchange = e => { state.size = e.target.value; state.shown = 24; renderResults(); };
    $('#sort').onchange = e => { state.sort = e.target.value; renderResults(); };
    $('#reset').onclick = () => { Object.assign(state, { q: '', region: 'All', size: 'any', sort: 'name', shown: 24 }); $('#q').value = ''; $('#size').value = 'any'; $('#sort').value = 'name'; renderChips(regions); renderResults(); };
  }
  renderChips(regions); renderResults();
}

function renderChips(regions) {
  $('#chips').innerHTML = regions.map(r => `<button class="${state.region === r ? 'on' : ''}" data-r="${r}">${r}</button>`).join('');
  $('#chips').onclick = e => { const r = e.target.dataset.r; if (r) { state.region = r; state.shown = 24; renderChips(regions); renderResults(); } };
}

function renderResults() {
  const box = $('#results'), count = $('#count');
  if (state.loading) { count.textContent = 'Unfolding the map…'; box.innerHTML = '<div class="grid">' + '<div class="sk"></div>'.repeat(8) + '</div>'; return; }
  if (state.error) { count.textContent = ''; box.innerHTML = `<div class="state"><h2>Lost signal 📡</h2><p>${esc(state.error)}</p><button class="btn" id="retry">Try again</button></div>`; $('#retry').onclick = load; return; }
  const list = filtered();
  count.textContent = `${list.length} destination${list.length === 1 ? '' : 's'} found` + (state.backup ? ' · live country API unreachable, showing a short offline list' : '');
  if (!list.length) { box.innerHTML = `<div class="state"><h2>Nothing on this map</h2><p>No place matches “${esc(state.q)}” with these filters. Try loosening them.</p></div>`; return; }
  box.innerHTML = '<div class="grid">' + list.slice(0, state.shown).map(c => `
    <button class="card" data-id="${c.id}">
      ${inTrip(c.id) ? '<span class="pin">PINNED</span>' : ''}
      <img src="${esc(c.flag)}" alt="Flag of ${esc(c.name)}" loading="lazy">
      <div class="in"><h3><img class="fl" src="${esc(c.flag)}" alt="">${esc(c.name)}</h3><span class="tag">${esc(c.region)}${c.sub ? ' · ' + esc(c.sub) : ''}</span>
      <div class="meta"><span>★ ${esc(c.capital)}</span><span>${fmt(c.pop)} people</span></div></div></button>`).join('') + '</div>' +
    (list.length > state.shown ? '<button class="btn more" id="more">Show more</button>' : '');
  box.onclick = e => { const c = e.target.closest('.card'); if (c) openDetails(c.dataset.id); };
  if ($('#more')) $('#more').onclick = () => { state.shown += 24; renderResults(); };
}

async function openDetails(id) {
  const c = state.all.find(x => x.id === id); if (!c) return;
  const dr = $('#drawer'); $('#veil').classList.add('open');
  const draw = () => dr.innerHTML = `<button class="x" id="close" aria-label="Close">✕</button>
    <img class="hero" src="${esc(c.flag)}" alt="">
    <div class="body"><span class="tag">${esc(c.region)} · ${esc(c.sub)}</span><h2 style="font-size:2rem"><img class="fl" style="height:30px" src="${esc(c.flag)}" alt="Flag of ${esc(c.name)}">${esc(c.name)}</h2>
      <div class="facts">
        <div><span>Capital</span>${esc(c.capital)}</div><div><span>Population</span>${c.pop.toLocaleString()}</div>
        <div><span>Languages</span>${esc(c.langs.join(', ') || '—')}</div><div><span>Currency</span>${esc(c.money.join(', ') || '—')}</div></div>
      <div class="wx" id="wx">Checking the sky…</div>
      <p class="about" id="about">Loading the story…</p>
      <button class="btn ${inTrip(c.id) ? 'alt' : ''}" id="toggle">${inTrip(c.id) ? 'Remove from my trip' : '+ Add to my trip'}</button></div>`;
  draw();
  const bind = () => {
    $('#close').onclick = closeDrawer;
    $('#toggle').onclick = () => { toggleTrip(c); draw(); bind(); fill(); };
  };
  const cache = {};
  const fill = () => { if (cache.wx) $('#wx').innerHTML = cache.wx; if (cache.about) $('#about').innerHTML = cache.about; };
  bind();
  // weather + wiki load separately so one failing doesn't kill the other
  if (c.ll) fetch(`https://api.open-meteo.com/v1/forecast?latitude=${c.ll[0]}&longitude=${c.ll[1]}&current=temperature_2m,wind_speed_10m`)
    .then(r => { if (!r.ok) throw 0; return r.json(); })
    .then(w => { cache.wx = `Right now in ${esc(c.capital)}: <b>${Math.round(w.current.temperature_2m)}°C</b> · wind ${w.current.wind_speed_10m} km/h`; fill(); })
    .catch(() => { cache.wx = 'Weather unavailable right now.'; fill(); });
  else { cache.wx = 'No weather coordinates for this place.'; fill(); }
  fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(c.name.replace(/ /g, '_')))
    .then(r => { if (!r.ok) throw 0; return r.json(); })
    .then(w => { if (w.thumbnail?.source) $('.hero').src = w.thumbnail.source; cache.about = esc(w.extract); fill(); })
    .catch(() => { cache.about = 'Couldn’t load a description for this place.'; fill(); });
}
function closeDrawer() { $('#veil').classList.remove('open'); if (state.view === 'explore') renderResults(); else renderTrip(); }
$('#veil').onclick = e => { if (e.target.id === 'veil') closeDrawer(); };
document.onkeydown = e => { if (e.key === 'Escape') closeDrawer(); };

function toggleTrip(c) {
  if (inTrip(c.id)) { trip = trip.filter(t => t.id !== c.id); toast(c.name + ' removed'); }
  else { trip.push({ id: c.id, name: c.name, capital: c.capital, flag: c.flag, region: c.region, note: '' }); toast(c.name + ' pinned to your trip'); }
  save(); $('#badge').textContent = trip.length;
}

function renderTrip() {
  const app = $('#app');
  if (!trip.length) { app.innerHTML = `<div class="state"><h2>Your passport is blank</h2><p>Pin a few destinations from Explore and they’ll show up here as tickets.</p><button class="btn" id="go">Start exploring</button></div>`; $('#go').onclick = () => setView('explore'); return; }
  app.innerHTML = `<div class="tools"><h2>My Trip · ${trip.length} stop${trip.length > 1 ? 's' : ''}</h2><button class="btn alt" id="clr" style="margin:0">Clear all</button></div>` +
    trip.map((t, i) => `<div class="ticket"><img src="${esc(t.flag)}" alt="">
      <div><span class="no">STOP ${String(i + 1).padStart(2, '0')} · ${esc(t.region)}</span><h3><img class="fl" src="${esc(t.flag)}" alt="">${esc(t.name)}</h3><span class="tag">via ${esc(t.capital)}</span>
      <textarea rows="1" data-id="${t.id}" placeholder="scribble a note…">${esc(t.note)}</textarea></div>
      <button class="rm" data-rm="${t.id}">Remove</button></div>`).join('');
  app.onclick = e => {
    const id = e.target.dataset.rm;
    if (id) { trip = trip.filter(t => t.id !== id); save(); renderTrip(); toast('Stop removed'); }
    if (e.target.id === 'clr' && confirm('Remove every stop from your trip?')) { trip = []; save(); renderTrip(); }
  };
  app.oninput = e => { const t = trip.find(x => x.id === e.target.dataset.id); if (t) { t.note = e.target.value; save(); } };
}

function setView(v) { state.view = v; $('#app').innerHTML = ''; $('#app').onclick = $('#app').oninput = null; render(); }
$('#tExplore').onclick = () => setView('explore');
$('#tTrip').onclick = () => setView('trip');
save(); load();
