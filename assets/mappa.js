(async () => {
  const B = window.EDG.base;
  const luoghi = await (await fetch(B + '/assets/luoghi.json')).json();
  const $ = (s) => document.querySelector(s);
  const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const esc = (s) => (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const COL = { 20: '#ef4444', 30: '#f97316', 40: '#3b82f6', 50: '#65a30d', 60: '#16a34a' };
  const colore = (l) => COL[Number(l.voto)] || '#6b7280';
  const links = (l) => `${l.maps ? `<a href="${esc(l.maps)}" target="_blank" rel="noopener">Google Maps →</a>` : ''}${l.sito ? `<a href="${esc(l.sito)}" target="_blank" rel="noopener">Sito →</a>` : ''}${l.recensione ? `<a href="${esc(l.recensione)}" target="_blank" rel="noopener">Recensione →</a>` : ''}`;
  const card = (l, i) => `<div class="luogo" data-i="${i}"><h3>${l.voto ? `<span class="v">${esc(String(l.voto))}/60</span>` : ''}${esc(l.nome)}</h3>
    ${l.tag ? `<div class="l-m">${esc(l.tag)}</div>` : ''}${l.note ? `<p>${esc(l.note)}</p>` : ''}${links(l)}</div>`;

  const mappa = L.map('mappa', { scrollWheelZoom: false }).setView([42.5, 12.5], 6);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(mappa);
  mappa.on('focus', () => mappa.scrollWheelZoom.enable()); mappa.on('blur', () => mappa.scrollWheelZoom.disable());
  const gruppo = L.layerGroup().addTo(mappa);
  const marker = new Map();

  const rendi = () => {
    const q = norm($('#q').value);
    const f = luoghi.map((l, i) => [l, i]).filter(([l]) => !q || norm(l.nome + ' ' + l.tag + ' ' + l.note).includes(q));
    $('#luoghi').innerHTML = f.map(([l, i]) => card(l, i)).join('');
    gruppo.clearLayers(); marker.clear();
    const punti = [];
    for (const [l, i] of f) {
      if (l.lat == null) continue;
      const m = L.circleMarker([l.lat, l.lng], { radius: 9, color: '#fff', weight: 2, fillColor: colore(l), fillOpacity: 0.95 })
        .bindPopup(`<strong>${l.voto ? esc(String(l.voto)) + '/60 · ' : ''}${esc(l.nome)}</strong>${l.tag ? `<br><small>${esc(l.tag)}</small>` : ''}<div class="pop-l">${links(l)}</div>`)
        .addTo(gruppo);
      marker.set(i, m); punti.push([l.lat, l.lng]);
    }
    if (punti.length) mappa.fitBounds(punti, { padding: [30, 30], maxZoom: 13 });
  };
  $('#q').addEventListener('input', rendi);
  $('#luoghi').addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    const c = e.target.closest('.luogo'); if (!c) return;
    const m = marker.get(Number(c.dataset.i)); if (!m) return;
    mappa.setView(m.getLatLng(), 15); m.openPopup(); $('#mappa').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  rendi();
})();
