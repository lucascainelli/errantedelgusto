(async () => {
  const B = window.EDG.base;
  const L = await (await fetch(B + '/assets/luoghi.json')).json();
  const $ = (s) => document.querySelector(s);
  const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const esc = (s) => (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const card = (l) => `<div class="luogo"><h3>${l.voto ? `<span class="v">${esc(String(l.voto))}/60</span>` : ''}${esc(l.nome)}</h3>
    ${l.tag ? `<div class="l-m">${esc(l.tag)}</div>` : ''}${l.note ? `<p>${esc(l.note)}</p>` : ''}
    ${l.maps ? `<a href="${esc(l.maps)}" target="_blank" rel="noopener">Google Maps →</a>` : ''}${l.sito ? `<a href="${esc(l.sito)}" target="_blank" rel="noopener">Sito →</a>` : ''}${l.recensione ? `<a href="${esc(l.recensione)}" target="_blank" rel="noopener">Recensione →</a>` : ''}</div>`;
  const rendi = () => { const q = norm($('#q').value); $('#luoghi').innerHTML = L.filter((l) => !q || norm(l.nome + ' ' + l.tag + ' ' + l.note).includes(q)).map(card).join(''); };
  $('#q').addEventListener('input', rendi); rendi();
})();
