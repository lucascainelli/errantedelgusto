(async () => {
  const B = window.EDG.base, VOTI = window.EDG.voti, ICONE = window.EDG.icone;
  const dati = await (await fetch(B + '/assets/archivio.json')).json();
  const $ = (s) => document.querySelector(s);
  let cat = '', voto = 0, q = '', mostra = 30;
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const card = (a) => {
    const v = a.v && VOTI[a.v];
    return `<a href="${a.u}" class="card-a"><div class="card-a-img">${a.i ? `<img src="${a.i}" alt="" loading="lazy">` : ''}
      ${a.r ? `<span class="card-a-rub">${ICONE[a.rs] || '🍴'} ${esc(a.r)}</span>` : ''}
      ${v ? `<div class="badge-voto" style="border-color:${v.c}"><div style="color:${v.c}">${a.v}</div><span>/60</span></div>` : ''}</div>
      <div class="card-a-b">${v ? `<div class="card-a-lab" style="color:${v.c}">${v.n}</div>` : ''}<div class="card-a-t">${esc(a.t)}</div>
      <p>${esc(a.x)}</p>${a.p ? `<div class="card-a-m">${esc(a.p)}</div>` : ''}</div></a>`;
  };
  const rendi = () => {
    const nq = norm(q);
    const f = dati.filter((a) => (!cat || a.c.includes(cat)) && (!voto || a.v === voto) && (!nq || norm(a.t + ' ' + a.p + ' ' + a.x).includes(nq)));
    $('#conta').textContent = `${f.length} assaggi nell'archivio`;
    $('#griglia').innerHTML = f.slice(0, mostra).map(card).join('');
    $('#altri').style.display = f.length > mostra ? '' : 'none';
  };
  $('#q').addEventListener('input', (e) => { q = e.target.value; mostra = 30; rendi(); });
  $('#chip-cat').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; cat = b.dataset.c; mostra = 30;
    document.querySelectorAll('#chip-cat button').forEach((x) => x.classList.toggle('on', x === b)); rendi(); });
  $('#chip-voto').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; voto = Number(b.dataset.v); mostra = 30;
    document.querySelectorAll('#chip-voto button').forEach((x) => x.classList.toggle('on', x === b)); rendi(); });
  $('#altri').addEventListener('click', () => { mostra += 30; rendi(); });
  rendi();
})();
