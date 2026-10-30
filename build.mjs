// Genera il sito Errante del Gusto da file Markdown.
//
//   npm run build        → scrive nella radice del repository (sito vero)
//   npm run anteprima    → include anche gli articoli programmati
//
// Sorgenti: contenuti/articoli/*.md · contenuti/pagine/*.md · contenuti/luoghi.json · img/
// Risultato: index.html, post/, category/, tag/, archiviodelgusto/, mappa/, cerca/, pagine, feed, sitemap

import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import matter from 'gray-matter';
import { Marked } from 'marked';

const CFG = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const BASE = CFG.base || '';
const SITO = CFG.url;
const NOME = CFG.nome;
const conProgrammati = process.argv.includes('--con-programmati');

// ---------- utilità ----------
const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const lista = (v) => (Array.isArray(v) ? v : v ? [v] : []).map(String);
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const dataIT = (d) => `${d.getUTCDate()} ${MESI[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
const dataBreve = (d) => `${String(d.getUTCDate()).padStart(2, '0')} ${MESI[d.getUTCMonth()].slice(0, 3).toUpperCase()} ${d.getUTCFullYear()}`;
const dataTrattini = (d) => `${String(d.getUTCDate()).padStart(2, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${d.getUTCFullYear()}`;
const dataISO = (d) => d.toISOString().slice(0, 10);
// versione dei file css/js: cambia solo se cambia il contenuto (evita cache vecchie nel browser)
const verAsset = (p) => { try { return crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex').slice(0, 8); } catch { return null; } };
const conVersioni = (html) => html.replace(/((?:src|href)=")(\/[^"?]*?)?(\/assets\/[^"?]+\.(?:css|js))(")/g, (m, a, b, f, c) => { const v = verAsset(f.slice(1)); return v ? `${a}${b || ''}${f}?v=${v}${c}` : m; });
const scrivi = (file, testo) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, file.endsWith('.html') ? conVersioni(testo) : testo); };
const noTag = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
const parole = (s, n) => { const w = s.split(/\s+/).filter(Boolean); return w.length > n ? w.slice(0, n).join(' ') + '…' : w.join(' '); };
const u = (p) => (/^(https?:|mailto:|#)/.test(p) ? p : BASE + p); // percorso interno → con base

// ---------- voto e rubriche ----------
const VOTI = {
  20: { col: '#ef4444', cls: 'bg-red-500', nome: 'Nota Dolente' },
  30: { col: '#f97316', cls: 'bg-orange-500', nome: 'Equilibrio Sospeso' },
  40: { col: '#3b82f6', cls: 'bg-blue-500', nome: 'Armonia del Gusto' },
  50: { col: '#65a30d', cls: 'bg-lime-600', nome: 'Eccellenza di Carattere' },
  60: { col: '#16a34a', cls: 'bg-green-600', nome: 'Estasi e Rarità' },
};
const ICONE = {
  'pizza-in-pagella': '🍕', 'vino-del-giovedi': '🍷', 'retrogusto': '⏰', 'nettare-di-vite': '🍇', 'essenza-di-grano': '🌾',
  'alchimie-dolci-aromi': '🍰', 'tesori-della-terra': '🧀', 'spiriti-alchimie': '🥃', 'piccoli-morsi': '🥨',
};
const icona = (slug) => ICONE[slug] || '🍴';
const RUBRICHE_VOTO = ['pizza-in-pagella', 'vino-del-giovedi', 'retrogusto', 'piccoli-morsi', 'tesori-della-terra'];
const MENU_CAT = ['alchimie-dolci-aromi', 'essenza-di-grano', 'pizza-in-pagella', 'nettare-di-vite', 'vino-del-giovedi', 'piccoli-morsi',
  'spiriti-alchimie', 'tesori-della-terra', 'retrogusto', 'a-tavola', 'dolcevita', 'leggi-mangia-bevi', 'nel-bicchiere', 'nel-piatto',
  'errante-a-new-york', 'sete', 'cronache-dell-aglio'];

// ---------- markdown ----------
const interno = (href) => href.replace(/^https?:\/\/(www\.)?errantedelgusto\.it/i, '');
const marked = new Marked({
  gfm: true,
  renderer: {
    image({ href, title, text }) {
      return `<figure><img src="${esc(u(interno(href)))}" alt="${esc(text)}" loading="lazy" decoding="async">${title ? `<figcaption>${esc(title)}</figcaption>` : ''}</figure>`;
    },
    link({ href, title, tokens }) {
      const testo = this.parser.parseInline(tokens);
      const h = interno(href);
      const esterno = /^https?:\/\//i.test(h);
      return `<a href="${esc(esterno ? h : u(h))}"${title ? ` title="${esc(title)}"` : ''}${esterno ? ' target="_blank" rel="noopener"' : ''}>${testo}</a>`;
    },
  },
});
const rendi = (md) => marked.parse(md).replace(/<p>(<figure>[\s\S]*?<\/figure>)<\/p>/g, '$1');

// ---------- lettura ----------
const movedSlugs = new Map(); // slug EDG → URL nuovo (articoli passati a Vampiri Italiani)
if (fs.existsSync('contenuti/redirect-vampiri.txt')) {
  for (const r of fs.readFileSync('contenuti/redirect-vampiri.txt', 'utf8').split('\n').filter(Boolean)) {
    const [da, a] = r.split('\t');
    const m = da.match(/\/post\/([^/]+)\/?$/);
    if (m) movedSlugs.set(m[1], a);
  }
}

function leggiArticoli() {
  const dir = 'contenuti/articoli';
  const out = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md'))) {
    const { data, content } = matter(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (data.bozza) continue;
    if (!data.titolo || !data.data) { console.warn(`! ${f}: mancano titolo o data`); continue; }
    const d = new Date(data.data);
    if (!conProgrammati && d > new Date()) { console.log(`· ${f}: programmato, non ancora pubblicato`); continue; }
    const slug = data.slug ? String(data.slug) : slugify(f.replace(/^\d{4}-\d{2}-\d{2}-?/, '').replace(/\.md$/, ''));
    const html = rendi(content);
    const categorie = lista(data.categorie).map((nome) => ({ nome, slug: slugify(nome) }));
    const tag = lista(data.tag).map((nome) => ({ nome, slug: slugify(nome) }));
    const rubrica = data.rubrica ? { nome: String(data.rubrica), slug: slugify(data.rubrica) } : null;
    const testo = noTag(html);
    out.push({
      slug, titolo: String(data.titolo), data: d, categorie, tag, rubrica, voto: data.voto ? Number(data.voto) : 0, html,
      produttore: data.produttore || '', negozio: data.negozio || '', dataAssaggio: data.data_assaggio || '', maps: data.maps || '',
      sommario: data.sommario ? String(data.sommario) : '',
      estratto: data.estratto ? String(data.estratto) : testo,
      copertina: data.copertina || '', altCopertina: data.alt_copertina || data.titolo,
      url: `/post/${slug}/`, minuti: Math.max(1, Math.round(testo.split(' ').length / 200)),
    });
  }
  const visti = new Set();
  for (const a of out) { if (visti.has(a.slug)) throw new Error(`Slug duplicato: ${a.slug}`); visti.add(a.slug); }
  return out.sort((a, b) => b.data - a.data);
}

function leggiPagine() {
  const dir = 'contenuti/pagine';
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((x) => x.endsWith('.md')).map((f) => {
    const { data, content } = matter(fs.readFileSync(path.join(dir, f), 'utf8'));
    return { slug: data.slug || f.replace(/\.md$/, ''), titolo: data.titolo, html: rendi(content) };
  });
}

// ---------- pezzi comuni ----------
const NAV_SUB = MENU_CAT;
function header(nomeCat) {
  const sub = NAV_SUB.map((s) => `<a href="${u(`/category/${s}/`)}">${esc(nomeCat.get(s) || s)}</a>`).join('');
  return `<header class="hd"><div class="hd-in">
  <a class="hd-brand" href="${u('/')}">Errante del Gusto</a>
  <a class="hd-cerca" href="${u('/cerca/')}" aria-label="Cerca"><svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor"><path d="M505 442.7L405.3 343c-4.5-4.5-10.6-7-17-7H372c27.6-35.3 44-79.7 44-128C416 93.1 322.9 0 208 0S0 93.1 0 208s93.1 208 208 208c48.3 0 92.7-16.4 128-44v16.3c0 6.4 2.5 12.5 7 17l99.7 99.7c9.4 9.4 24.6 9.4 33.9 0l28.3-28.3c9.4-9.4 9.4-24.6.1-34zM208 336c-70.7 0-128-57.2-128-128 0-70.7 57.2-128 128-128 70.7 0 128 57.2 128 128 0 70.7-57.2 128-128 128z"/></svg></a>
  <button class="hd-burger" aria-label="Menu" onclick="document.querySelector('.hd').classList.toggle('aperto')">☰</button>
  <nav class="hd-nav">
    <div class="hd-drop"><a href="${u('/archiviodelgusto/')}">Archivio del Gusto <small>▾</small></a><div class="hd-sub">${sub}</div></div>
    <a href="${u('/mappa/')}">Mappa</a>
    <a href="${u('/chi-sono/')}">Chi Sono</a>
  </nav>
</div></header>`;
}
const FOOTER = () => `<footer class="ft"><div class="ft-in">
  <div>© ${new Date().getFullYear()} Errante del Gusto &nbsp;·&nbsp; <span style="font-style:italic">Barbaric, London</span></div>
  <div class="ft-links"><a href="${u('/chi-sono/')}">Chi Sono</a><a href="${u('/leggi-un-numero-della-newsletter/')}">La newsletter</a><a href="${u('/privacy-policy/')}">Privacy</a><a href="https://vampiriitaliani.it" target="_blank" rel="noopener">Vampiri Italiani</a></div>
</div></footer>`;

function pagina({ titolo, descrizione = '', url, corpo, og = '', tipo = 'website', extraHead = '', nomeCat, bodyClass = '', noindex = false }) {
  const ogImg = og ? (og.startsWith('http') ? og : SITO + og) : '';
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(titolo)}</title>
<meta name="description" content="${esc(descrizione)}">
<link rel="canonical" href="${SITO}${url}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
<link rel="alternate" type="application/rss+xml" title="${esc(NOME)}" href="${u('/feed/index.xml')}">
<meta property="og:type" content="${tipo}"><meta property="og:locale" content="it_IT"><meta property="og:site_name" content="${esc(NOME)}">
<meta property="og:title" content="${esc(titolo)}"><meta property="og:description" content="${esc(descrizione)}"><meta property="og:url" content="${SITO}${url}">
${ogImg ? `<meta property="og:image" content="${ogImg}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${ogImg}">` : ''}
<link rel="stylesheet" href="${u('/assets/tw.css')}">
<link rel="stylesheet" href="${u('/assets/site.css')}">
${extraHead}
</head>
<body class="${bodyClass}">
${header(nomeCat)}
${corpo}
${FOOTER()}
</body>
</html>
`;
}

// ---------- blocchi ----------
const imgTag = (src, alt, cls = '') => (src ? `<img src="${esc(u(src))}" alt="${esc(alt)}" loading="lazy" decoding="async"${cls ? ` class="${cls}"` : ''}>` : '');

const FORM_NEWSLETTER = `<div class="nl-box">
  <p class="nl-k">Newsletter</p>
  <p class="nl-t">Ricevi la Newsletter di Errante del Gusto</p>
  <p class="nl-d">Editoriali esclusivi, assaggi e curiosità solo per iscritti. Due volte al mese.</p>
  <form method="POST" action="${CFG.newsletter}" data-type="subscription">
    <input type="email" name="EMAIL" placeholder="La tua mail" required autocomplete="email">
    <input type="text" name="email_address_check" value="" style="display:none">
    <input type="hidden" name="locale" value="it">
    <button type="submit">Iscriviti</button>
  </form>
</div>`;

function boxShare(a) {
  const url = encodeURIComponent(SITO + a.url), t = encodeURIComponent(a.titolo);
  return `<div class="edg-share"><span class="edg-share__label">Condividi</span><div class="edg-share__buttons">
<a class="edg-share__btn edg-share__btn--wa" href="https://wa.me/?text=${t}%20${url}" target="_blank" rel="noopener">WhatsApp</a>
<a class="edg-share__btn edg-share__btn--fb" href="https://www.facebook.com/sharer/sharer.php?u=${url}" target="_blank" rel="noopener">Facebook</a>
<a class="edg-share__btn edg-share__btn--x" href="https://x.com/intent/tweet?text=${t}&url=${url}" target="_blank" rel="noopener">X</a>
<button class="edg-share__btn edg-share__btn--copy" onclick="navigator.clipboard.writeText(location.href).then(()=>{this.textContent='Copiato!'})">Copia link</button>
</div></div>`;
}

const FIRMA = `<p class="firma">di <strong>Luca Scainelli</strong> – Errante del Gusto</p>`;
const boxQuint = () => `<div class="box box-q"><p class="box-k">Quintessenza</p><p>Il punteggio va da 20 a 60. Scopri il sistema di valutazione nell'archivio di Errante del Gusto.</p><a href="${u('/archiviodelgusto/')}">Vai all'archivio →</a></div>`;
const boxMappa = (a) => `<div class="box box-m"><p class="box-k">Mappa Errante</p><p>${a.maps ? 'Questo locale è sulla Mappa Errante. Apri la scheda su Google Maps per indicazioni stradali.' : 'Trova gli indirizzi selezionati da Errante del Gusto sul territorio.'}</p><a href="${a.maps ? esc(a.maps) : u('/mappa/')}"${a.maps ? ' target="_blank" rel="noopener"' : ''}>${a.maps ? 'Vedi su Google Maps →' : 'Apri la mappa →'}</a></div>`;

function badgeVoto(v) {
  if (!v) return '';
  const c = VOTI[v].col;
  return `<div class="badge-voto" style="border-color:${c}"><div style="color:${c}">${v}</div><span>/60</span></div>`;
}

function cardAssaggio(a) {
  const v = a.voto && VOTI[a.voto];
  return `<a href="${u(a.url)}" class="card-a group">
  <div class="card-a-img">${imgTag(a.copertina, a.altCopertina, 'group-hover:scale-105')}
    ${a.rubrica ? `<span class="card-a-rub">${icona(a.rubrica.slug)} ${esc(a.rubrica.nome)}</span>` : ''}${badgeVoto(a.voto)}</div>
  <div class="card-a-b">${v ? `<div class="card-a-lab" style="color:${v.col}">${esc(v.nome)}</div>` : ''}
    <div class="card-a-t">${esc(a.titolo)}</div><p>${esc(parole(a.estratto, 22))}</p>
    ${a.negozio || a.produttore ? `<div class="card-a-m">${esc([a.produttore, a.negozio].filter(Boolean).join(' · '))}</div>` : ''}</div></a>`;
}

const cardBlog = (a, cls = '') => `<a href="${u(a.url)}" class="card-b group ${cls}"><div class="card-b-img">${imgTag(a.copertina, a.altCopertina)}</div>
  <div class="card-b-d">${dataBreve(a.data)}</div><h3>${esc(a.titolo)}</h3><p>${esc(parole(a.estratto, 18))}</p></a>`;

function elenco({ titolo, eyebrow, articoli, url, descrizione, nomeCat, pag = 1, per = 24 }) {
  const tot = Math.max(1, Math.ceil(articoli.length / per));
  const fetta = articoli.slice((pag - 1) * per, pag * per);
  const link = (n) => u(n === 1 ? url : `${url}pagina/${n}/`);
  const nav = tot > 1 ? `<nav class="pager">${pag > 1 ? `<a href="${link(pag - 1)}">← Più recenti</a>` : '<span></span>'}<span>Pagina ${pag} di ${tot}</span>${pag < tot ? `<a href="${link(pag + 1)}">Più vecchi →</a>` : '<span></span>'}</nav>` : '';
  const corpo = `<main class="wrap"><p class="eyebrow">${esc(eyebrow)}</p><h1 class="h1-lista">${esc(titolo)}</h1>
  <p class="conta">${articoli.length} ${articoli.length === 1 ? 'articolo' : 'articoli'}</p>
  <div class="griglia-a">${fetta.map(cardAssaggio).join('')}</div>${nav}</main>`;
  return pagina({ titolo: `${titolo} — ${NOME}`, descrizione, url: pag === 1 ? url : `${url}pagina/${pag}/`, corpo, nomeCat, noindex: pag > 1 });
}

// ---------- articolo ----------
function paginaAssaggio(a, nomeCat) {
  const v = a.voto && VOTI[a.voto];
  const meta = [];
  // data_assaggio può essere una data vera (dall'editor) o testo libero ("venerdì 20 febbraio 2026"): il testo si mostra com'è
  const v0 = a.dataAssaggio;
  const dAss = v0 instanceof Date ? dataIT(v0)
    : /^\d{4}-\d{2}-\d{2}/.test(String(v0)) ? dataIT(new Date(String(v0)))
    : v0 ? String(v0).charAt(0).toUpperCase() + String(v0).slice(1) : dataIT(a.data);
  meta.push(`<div><strong>Assaggio:</strong> ${esc(dAss)}</div>`);
  if (a.produttore) meta.push(`<div><strong>Produttore:</strong> ${esc(a.produttore)}</div>`);
  if (a.negozio) meta.push(`<div><strong>Negozio:</strong> ${esc(a.negozio)}</div>`);
  const tag = a.tag.length ? `<div class="mb-8"><h3 class="text-lg font-bold text-gray-800 mb-3">🏷️ Tag</h3><div class="flex flex-wrap gap-2">${a.tag.map((t) => `<a class="tag-pill" href="${u(`/tag/${t.slug}/`)}">${esc(t.nome)}</a>`).join('')}</div></div>` : '';
  const corpo = `<main class="bg-gradient-to-br from-amber-50 via-white to-orange-50 py-12"><div class="max-w-5xl mx-auto px-4">
  <div class="mb-6"><a href="${u('/archiviodelgusto/')}" class="inline-flex items-center gap-2 text-amber-600 hover:text-amber-800 font-semibold transition-colors">← Torna alla Galleria</a></div>
  <article class="bg-white rounded-2xl shadow-2xl overflow-hidden border border-amber-200" data-pagefind-body>
    <div class="relative aspect-[3/4] md:aspect-[4/3] overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
      ${a.copertina ? `<img src="${esc(u(a.copertina))}" alt="${esc(a.altCopertina)}" class="w-full h-full object-cover" decoding="async">` : ''}${badgeVoto(a.voto)}
    </div>
    <div class="p-8 md:p-12">
      <div class="mb-8">
        <div class="flex flex-wrap items-center gap-3 mb-4">
          ${a.rubrica ? `<a href="${u(`/category/${a.rubrica.slug}/`)}" class="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-800 rounded-full text-sm font-semibold hover:bg-amber-200 transition-colors"><span>${icona(a.rubrica.slug)}</span><span>${esc(a.rubrica.nome)}</span></a>` : ''}
          ${v ? `<div class="${v.cls} text-white px-4 py-2 rounded-full text-sm font-bold shadow-md">${esc(v.nome)}</div>` : ''}
        </div>
        <h1 class="text-4xl md:text-5xl font-bold text-gray-900 mb-4" data-pagefind-meta="title">${esc(a.titolo)}</h1>
        <div class="flex flex-wrap gap-4 text-sm text-gray-600">${meta.join('')}</div>
      </div>
      <div class="border-t-2 border-amber-100 my-8"></div>
      <div class="prose-edg mb-8">${a.html}${FIRMA}${v && RUBRICHE_VOTO.includes(a.rubrica?.slug) ? boxQuint() : ''}${a.rubrica?.slug === 'pizza-in-pagella' ? boxMappa(a) : ''}${boxShare(a)}${FORM_NEWSLETTER}</div>
      ${tag}
    </div>
  </article></div></main>`;
  return pagina({
    titolo: `${a.titolo} — ${NOME}`, descrizione: a.sommario || parole(a.estratto, 28), url: a.url, corpo, og: a.copertina, tipo: 'article', nomeCat,
    extraHead: `<meta property="article:published_time" content="${dataISO(a.data)}">`,
  });
}

function paginaStandard(a, nomeCat) {
  const cats = a.categorie.filter((c) => c.slug !== 'blog');
  const tag = a.tag.length ? `<div class="art-tags">${a.tag.map((t) => `<a class="tag-pill" href="${u(`/tag/${t.slug}/`)}">${esc(t.nome)}</a>`).join('')}</div>` : '';
  const ld = { '@context': 'https://schema.org', '@type': 'Article', headline: a.titolo, datePublished: dataISO(a.data), inLanguage: 'it', author: { '@type': 'Person', name: 'Luca Scainelli' }, mainEntityOfPage: SITO + a.url };
  const corpo = `<main class="art" data-pagefind-body>
  ${a.copertina ? `<div class="art-hero"><img src="${esc(u(a.copertina))}" alt="${esc(a.altCopertina)}" decoding="async"></div>` : ''}
  <div class="art-card${a.copertina ? ' sovrapposto' : ''}">
    <div class="art-cats">${cats.map((c) => `<a href="${u(`/category/${c.slug}/`)}">${esc(c.nome)}</a>`).join(' | ')}</div>
    <h1 data-pagefind-meta="title">${esc(a.titolo)}</h1>
    <div class="art-meta">Di Luca Scainelli &nbsp;•&nbsp; <time datetime="${dataISO(a.data)}">${dataIT(a.data)}</time></div>
    <div class="prose-edg">${a.html}${FIRMA}${boxShare(a)}${FORM_NEWSLETTER}</div>
    ${tag}
  </div></main>`;
  return pagina({
    titolo: `${a.titolo} — ${NOME}`, descrizione: a.sommario || parole(a.estratto, 28), url: a.url, corpo, og: a.copertina, tipo: 'article', nomeCat,
    extraHead: `<meta property="article:published_time" content="${dataISO(a.data)}">\n<script type="application/ld+json">${JSON.stringify(ld)}</script>`,
  });
}

const redirectStub = (da, a) => `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>Questo articolo si è spostato</title>
<link rel="canonical" href="${esc(a)}"><meta http-equiv="refresh" content="0; url=${esc(a)}"><meta name="robots" content="noindex">
</head><body><p>Questo articolo si è spostato: <a href="${esc(a)}">continua a leggere</a>.</p><script>location.replace(${JSON.stringify(a)})</script></body></html>
`;

// ---------- home ----------
function home(P, nomeCat) {
  const ha = (a, c) => a.categorie.some((x) => x.slug === c);
  const ultimo = P.find((a) => a.voto && !a.tag.some((t) => t.slug === 'martedi'));
  const martedi = P.find((a) => a.tag.some((t) => t.slug === 'martedi'));
  const colonna = (slug) => P.find((a) => ha(a, slug));
  const cron = P.filter((a) => ['errante-a-new-york', 'dolcevita', 'leggi-mangia-bevi', 'a-tavola', 'nel-bicchiere', 'nel-piatto'].some((c) => ha(a, c))).slice(0, 4);
  const ny = P.filter((a) => a.tag.some((t) => t.slug === 'new-york')).slice(0, 6);

  const hero = ultimo ? (() => {
    const v = VOTI[ultimo.voto];
    return `<a href="${u(ultimo.url)}" class="group flex flex-col md:flex-row bg-white rounded-[2.5rem] overflow-hidden shadow-2xl border border-amber-100 transition-all duration-500 hover:shadow-amber-200/50">
      <div class="md:w-1/2 aspect-square overflow-hidden bg-gray-100 relative">
        ${imgTag(ultimo.copertina, ultimo.altCopertina, 'w-full h-full object-cover group-hover:scale-105 transition-transform duration-700')}${badgeVoto(ultimo.voto)}
      </div>
      <div class="md:w-1/2 p-10 flex flex-col justify-center bg-white relative">
        <span class="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-500 mb-2 italic">L'ultimo assaggio · ${dataTrattini(ultimo.data)}</span>
        <div class="text-5xl font-black text-amber-600 italic mb-4">${ultimo.voto}/60</div>
        <h2 class="text-3xl font-bold mb-4 leading-tight group-hover:text-amber-600 transition-colors uppercase tracking-tighter italic">${esc(ultimo.titolo)}</h2>
        <p class="text-gray-600 italic mb-8 font-serif">${esc(parole(ultimo.estratto, 22))}</p>
        <span class="font-bold uppercase text-[10px] tracking-[0.2em] border-b-2 border-black self-start pb-1">Leggi l'alchimia</span>
      </div></a>`;
  })() : '';

  const box = (href, grad, img, imgCls, titolo, testo, bottone, btnCol, rot) => `<a href="${href}" target="_blank" rel="noopener" class="group bg-gradient-to-br ${grad} rounded-[3rem] p-10 flex items-center gap-8 shadow-2xl transition-all hover:-translate-y-1">
      <img src="${u(img)}" class="w-32 shadow-2xl ${rot} transition-transform ${imgCls}" alt="${esc(titolo)}">
      <div class="text-white"><h3 class="text-3xl font-black italic uppercase tracking-tighter mb-2 leading-none">${titolo}</h3>
      <p class="text-white/90 text-sm mb-4 font-serif italic leading-snug">${testo}</p>
      <span class="bg-white ${btnCol} px-5 py-2 rounded-xl font-bold uppercase text-[10px] tracking-widest">${bottone}</span></div></a>`;

  const colonnaHTML = (a, titolo, hov, cta, extraImg = '', vuoto) => a ? `<a href="${u(a.url)}" class="group block">
      <div class="aspect-square rounded-[2.5rem] overflow-hidden shadow-lg mb-6 bg-gray-100">${imgTag(a.copertina, a.altCopertina, `w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ${extraImg}`)}</div>
      <h3 class="font-bold text-lg uppercase italic group-hover:${hov} transition-colors tracking-tight mb-3">${esc(a.titolo)}</h3>
      <p class="text-gray-500 text-sm font-serif italic leading-relaxed mb-6">${esc(parole(a.estratto, 30))}</p>
      <span class="text-[10px] font-bold uppercase tracking-widest border-b border-gray-900 pb-1">${cta}</span></a>` : `<p class="text-gray-400 italic">${vuoto}</p>`;

  const corpo = `<main class="bg-white font-sans antialiased text-gray-900">
  <section class="py-12 bg-gradient-to-b from-amber-50/50 to-white text-center"><div class="max-w-7xl mx-auto px-4">
    <h1 class="text-6xl md:text-8xl font-black mb-4 tracking-tighter uppercase italic">Errante del Gusto</h1>
    <p class="text-xl opacity-70 font-serif italic text-amber-800 mb-12">"Cronache di vita e visioni di sapore."</p>
    <div class="max-w-4xl mx-auto text-left">${hero}</div></div></section>

  <section class="py-12 bg-gray-950 shadow-[inset_0_0_100px_rgba(0,0,0,0.5)]"><div class="max-w-7xl mx-auto px-4"><div class="grid md:grid-cols-2 gap-8 text-left">
    ${box('https://www.amazon.it/Errante-del-gusto-Luca-Scainelli/dp/B0DQR1LL5F', 'from-amber-500 to-orange-600', '/img/home/libro.webp', '', 'Il Libro', '"Un viaggio tra sapori e vita."', 'Acquista', 'text-orange-600', 'group-hover:rotate-3')}
    ${box('https://vampiriitaliani.it/aderisci.html', 'from-violet-600 to-purple-800', '/img/home/il-morso.webp', '', 'Il Morso', 'La rivista dei soci sostenitori<br>di Vampiri Italiani.', 'Tesserati', 'text-violet-700', 'group-hover:-rotate-3')}
    ${box('https://vampiriitaliani.it/', 'from-red-600 to-rose-800', '/img/home/vampiri-italiani.webp', 'rounded-xl', 'Vampiri Italiani', 'La prima associazione italiana<br>di assaggiatori di aglio.', 'Scopri', 'text-red-700', 'group-hover:rotate-3')}
    ${box(u('/ordine/'), 'from-green-600 to-emerald-800', '/img/home/logo-ordine.webp', '', "L'Ordine della Margherita", 'Il club dei votatori<br>di pizza. Entra e giudica.', 'Vota', 'text-emerald-700', 'group-hover:-rotate-3')}
  </div></div></section>

  <section class="py-20 bg-amber-50/30 text-left"><div class="max-w-5xl mx-auto px-4">${martedi ? `
    <div class="bg-white rounded-[3rem] overflow-hidden shadow-xl flex flex-col md:flex-row border border-amber-100">
      <div class="md:w-1/2 min-h-[400px]">${imgTag(martedi.copertina, martedi.altCopertina, 'w-full h-full object-cover')}</div>
      <div class="md:w-1/2 p-12 flex flex-col justify-center">
        <span class="text-amber-600 font-bold uppercase tracking-[0.3em] text-[10px] mb-4">L'appuntamento fisso</span>
        <h2 class="text-4xl font-black text-gray-900 mb-6 italic uppercase tracking-tighter leading-none">Il Martedì</h2>
        <h3 class="text-2xl font-serif text-gray-700 mb-6 italic">${esc(martedi.titolo)}</h3>
        <p class="text-gray-500 italic mb-8 font-serif leading-relaxed">${esc(parole(martedi.estratto, 35))}</p>
        <a href="${u(martedi.url)}" class="bg-gray-950 text-white px-8 py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest self-start hover:bg-amber-600 transition-all">Leggi la storia</a>
      </div></div>` : ''}</div></section>

  <section class="py-24 bg-white text-left"><div class="max-w-7xl mx-auto px-4"><div class="grid md:grid-cols-3 gap-12">
    <div><h2 class="text-2xl font-black italic uppercase mb-8 tracking-tighter">🍕 Pizza in Pagella</h2>${colonnaHTML(colonna('pizza-in-pagella'), '', 'text-amber-600', 'Vedi il voto', '', 'La prima pizza in pagella sta per arrivare…')}</div>
    <div><h2 class="text-2xl font-black italic uppercase mb-8 tracking-tighter">🍷 Il Nettare</h2>${colonnaHTML(colonna('vino-del-giovedi'), '', 'text-purple-700', 'Versa un calice', '', 'Il prossimo nettare del giovedì si sta scegliendo…')}</div>
    <div><h2 class="text-2xl font-black italic uppercase mb-8 tracking-tighter">⏰ Retrogusto</h2>${colonnaHTML(colonna('retrogusto'), '', 'text-gray-600', 'Ricorda il sapore', 'grayscale group-hover:grayscale-0', 'I sapori del passato si stanno raccogliendo…')}</div>
  </div></div></section>

  <section class="py-20 bg-stone-50 border-y border-stone-200 text-left"><div class="max-w-7xl mx-auto px-4">
    <h2 class="text-3xl font-black italic uppercase tracking-tighter mb-12 text-center">Cronache &amp; Appunti</h2>
    <div class="grid md:grid-cols-4 gap-8">${cron.map((a) => cardBlog(a, 'bn')).join('')}</div></div></section>

  <section class="py-20 bg-white border-y border-stone-200 text-left"><div class="max-w-7xl mx-auto px-4">
    <h2 class="text-3xl font-black italic uppercase tracking-tighter text-center mb-2">🗽 Errante a New York</h2>
    <p class="text-center text-[11px] font-bold uppercase tracking-[0.25em] text-gray-400 mb-12 border-b-2 border-gray-100 pb-4">Assaggi, ristoranti, supermercati e pensieri — da giugno a settembre 2026</p>
    <div class="grid md:grid-cols-3 gap-8">${ny.map((a) => cardBlog(a, 'ny')).join('')}</div>
    <div class="text-center mt-10"><a href="${u('/category/errante-a-new-york/')}" class="inline-block border-2 border-gray-900 px-8 py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-gray-900 hover:text-white transition-all">Vedi tutto il viaggio</a></div>
  </div></section>

  <section class="py-24 bg-stone-100"><div class="max-w-5xl mx-auto px-4">
    <div class="bg-[#3d2b1f] rounded-[4rem] p-16 md:p-24 text-center relative overflow-hidden shadow-2xl border-4 border-[#c5a059]/20"><div class="relative z-10">
      <span class="text-[#c5a059] font-bold uppercase tracking-[0.5em] text-[10px] mb-6 block">Alchimie Dolci e Aromi</span>
      <h2 class="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-8 italic text-stone-100 leading-none">Archivio del Gusto</h2>
      <p class="text-stone-400 text-lg mb-12 font-serif italic max-w-xl mx-auto">"Dall'Armonia del Gusto all'Estasi della Rarità." <br>L'archivio sensoriale dell'Errante.</p>
      <a href="${u('/archiviodelgusto/')}" class="inline-block bg-[#c5a059] text-[#3d2b1f] px-12 py-5 rounded-2xl font-black uppercase tracking-[0.2em] hover:bg-stone-100 transition-all text-xs shadow-xl">Esplora l'Archivio</a></div>
      <div class="absolute -bottom-12 -right-12 text-[25rem] font-black opacity-[0.03] italic text-stone-100 pointer-events-none">60</div></div></div></section>

  ${newsletterHome()}
</main>`;
  return pagina({
    titolo: 'Errante del Gusto — Luca Scainelli',
    descrizione: 'Luca Scainelli — 35 anni di degustazione. Vino, pizza e critica gastronomica italiana. Onesta, diretta, con un metodo di valutazione proprio.',
    url: '/', corpo, nomeCat, og: ultimo?.copertina || '',
    extraHead: `<link rel="stylesheet" href="https://sibforms.com/forms/end-form/build/sib-styles.css"><link rel="stylesheet" href="${u('/assets/newsletter.css')}">`,
  });
}

function newsletterHome() {
  const voce = (i, t, d) => `<li class="flex items-start gap-4 py-4"><span class="text-2xl leading-none shrink-0 w-8 text-center">${i}</span><div><span class="text-stone-100 font-bold italic uppercase tracking-tight">${t}</span><span class="text-stone-400 font-serif italic"> — ${d}</span></div></li>`;
  return `<section class="py-24 bg-stone-100 text-center"><div class="max-w-5xl mx-auto px-4">
  <div class="bg-[#0d0303] rounded-[4rem] p-12 md:p-20 relative overflow-hidden shadow-2xl border-4 border-[#c5a059]/20">
    <div class="absolute -bottom-20 -right-10 text-[22rem] leading-none font-black italic opacity-[0.04] text-stone-100 pointer-events-none select-none">60</div>
    <div class="relative z-10">
      <div class="inline-block mb-8"><div style="background:#111;border:2px solid #c5a059;border-radius:14px;padding:10px 22px;text-align:center;">
        <div style="font-size:2.2rem;font-weight:900;line-height:1;color:#c5a059;font-style:italic;">60<span style="font-size:1.1rem;">/60</span></div>
        <div style="font-size:.55rem;letter-spacing:.25em;text-transform:uppercase;color:#999;margin-top:4px;">Voto pieno</div></div></div>
      <span class="block text-[#c5a059] font-bold uppercase tracking-[0.5em] text-[10px] mb-6">La newsletter dell'Errante</span>
      <h2 class="text-4xl md:text-6xl font-black uppercase tracking-tighter italic text-stone-100 leading-none mb-6">Mettiti a tavola<br>con l'Errante</h2>
      <p class="text-stone-400 text-lg font-serif italic max-w-xl mx-auto mb-12">Critica enogastronomica indipendente: pizza, vino e buona tavola, con un metodo di voto da 20 a 60 e nessuna marchetta. La via più diretta per seguirla.</p>
      <p class="text-[#c5a059] font-bold uppercase tracking-[0.3em] text-[10px] mb-8">In ogni numero trovi</p>
      <ul class="max-w-xl mx-auto text-left mb-12 divide-y divide-stone-100/10">
        ${voce('🍕', 'Pizza in Pagella', 'il verdetto della settimana, voto e giudizio per esteso.')}
        ${voce('🍷', 'Il Nettare', 'il vino scelto, assaggiato e raccontato.')}
        ${voce('⏰', 'Retrogusto', "l'assaggio ripescato dal passato e riletto.")}
        ${voce('🛒', 'Prodotto dal supermercato', 'lo scaffale passato al setaccio: cosa vale e cosa no.')}
        <li class="flex items-start gap-4 py-4"><span class="text-2xl leading-none shrink-0 w-8 text-center">✦</span><div><span class="block text-[#c5a059] font-bold uppercase tracking-[0.2em] text-[10px] mb-1">In più</span><span class="text-stone-100 font-bold italic uppercase tracking-tight">Un editoriale inedito</span><span class="text-stone-400 font-serif italic"> — riservato solo a chi è iscritto.</span></div></li>
      </ul>
      <div class="max-w-xl mx-auto mb-10 text-center"><a href="${u('/leggi-un-numero-della-newsletter/')}" class="inline-flex items-center gap-2 text-[#c5a059] font-bold uppercase tracking-[0.15em] text-[11px] border-b-2 border-[#c5a059]/40 pb-1 hover:border-[#c5a059] transition-colors">📩 Non sai cosa aspettarti? Leggi un numero intero →</a></div>
      <div class="max-w-xl mx-auto mb-6"><form class="nl-home" method="POST" action="${CFG.newsletter}" data-type="subscription">
        <label for="EMAIL">La tua mail</label>
        <input class="input" type="email" id="EMAIL" name="EMAIL" autocomplete="email" placeholder="nome@email.com" required>
        <input type="text" name="email_address_check" value="" style="display:none"><input type="hidden" name="locale" value="it">
        <button type="submit">ISCRIVITI</button></form></div>
      <p class="text-stone-500 text-[13px] font-serif italic">Due numeri al mese — il 15 e l'ultimo giorno. Niente pubblicità, niente spam — ti cancelli quando vuoi.</p>
    </div></div></div></section>`;
}

// ---------- archivio e mappa ----------
function archivio(P, nomeCat) {
  const conta = new Map();
  for (const a of P) for (const c of a.categorie) conta.set(c.slug, (conta.get(c.slug) || 0) + 1);
  const cats = [...conta.keys()].filter((s) => s !== 'blog').sort((x, y) => (nomeCat.get(x) || x).localeCompare(nomeCat.get(y) || y, 'it'));
  const dati = P.map((a) => ({
    t: a.titolo, u: u(a.url), i: a.copertina ? u(a.copertina) : '', r: a.rubrica?.nome || a.categorie[0]?.nome || '', rs: a.rubrica?.slug || a.categorie[0]?.slug || '',
    c: a.categorie.map((c) => c.slug), v: a.voto || 0, x: parole(a.estratto, 20), p: [a.produttore, a.negozio].filter(Boolean).join(' · '), d: dataISO(a.data),
  }));
  scrivi('assets/archivio.json', JSON.stringify(dati));
  const corpo = `<main class="wrap-arch">
  <input id="q" class="arch-q" type="search" placeholder="🔍 Cerca per nome, negozio…" autocomplete="off">
  <div class="arch-lab">CATEGORIA:</div>
  <div class="arch-chips" id="chip-cat"><button class="on" data-c="">Tutti</button>${cats.map((s) => `<button data-c="${s}">${icona(s)} ${esc(nomeCat.get(s) || s)}</button>`).join('')}</div>
  <div class="arch-lab inline">VOTO:</div>
  <span class="arch-chips inline" id="chip-voto"><button class="on gold" data-v="0">Tutti</button>${[20, 30, 40, 50, 60].map((v) => `<button data-v="${v}">${v}${v === 60 ? ' ⭐' : ''}</button>`).join('')}</span>
  <hr class="arch-hr"><p class="conta" id="conta"></p>
  <div class="griglia-a" id="griglia"></div>
  <div class="text-center" style="margin:2rem 0"><button id="altri" class="btn-altri">Carica altri</button></div>
</main>`;
  const voti = Object.fromEntries(Object.entries(VOTI).map(([k, v]) => [k, { c: v.col, n: v.nome }]));
  return pagina({
    titolo: `Archivio del Gusto — ${NOME}`, descrizione: "L'archivio sensoriale dell'Errante: tutti gli assaggi con voto da 20 a 60.", url: '/archiviodelgusto/', corpo, nomeCat,
    extraHead: `<script>window.EDG={base:${JSON.stringify(BASE)},voti:${JSON.stringify(voti)},icone:${JSON.stringify(ICONE)}}</script><script defer src="${u('/assets/archivio.js')}"></script>`,
  });
}

function mappa(nomeCat) {
  // le coordinate stanno già nel link di Google Maps (@lat,lng)
  const L = JSON.parse(fs.readFileSync('contenuti/luoghi.json', 'utf8')).map((l) => {
    const m = (l.maps || '').match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || (l.maps || '').match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    return { ...l, lat: m ? Number(m[1]) : null, lng: m ? Number(m[2]) : null };
  });
  scrivi('assets/luoghi.json', JSON.stringify(L));
  const corpo = `<main class="wrap-arch"><p class="eyebrow">Mappa Errante</p><h1 class="h1-lista">I luoghi dell'Errante</h1>
  <p class="conta">${L.length} indirizzi selezionati. Cerca per nome, città o tipo di cucina.</p>
  <input id="q" class="arch-q" type="search" placeholder="🔍 Cerca un luogo…" autocomplete="off">
  <div id="mappa" class="mappa-box"></div>
  <div class="griglia-m" id="luoghi"></div></main>`;
  return pagina({
    titolo: `Mappa Errante — ${NOME}`, descrizione: 'Gli indirizzi selezionati da Errante del Gusto.', url: '/mappa/', corpo, nomeCat,
    extraHead: `<link rel="stylesheet" href="${u('/assets/leaflet/leaflet.css')}"><script src="${u('/assets/leaflet/leaflet.js')}"></script>
<script>window.EDG={base:${JSON.stringify(BASE)}}</script><script defer src="${u('/assets/mappa.js')}"></script>`,
  });
}

const cerca = (nomeCat) => pagina({
  titolo: `Cerca — ${NOME}`, url: '/cerca/', nomeCat, noindex: true,
  corpo: `<main class="wrap-arch"><h1 class="h1-lista">Cerca</h1><div id="search"></div></main>`,
  extraHead: `<link href="${u('/pagefind/pagefind-ui.css')}" rel="stylesheet"><script src="${u('/pagefind/pagefind-ui.js')}"></script>
<script>addEventListener('DOMContentLoaded',()=>{new PagefindUI({element:'#search',showSubResults:false,baseUrl:${JSON.stringify(BASE + '/')},translations:{placeholder:'Cerca nel sito'}});const i=document.querySelector('.pagefind-ui__search-input');if(i)i.focus()})</script>`,
});

// ---------- feed e sitemap ----------
const feed = (P) => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>${esc(NOME)}</title><link>${SITO}/</link><description>Cronache di vita e visioni di sapore.</description><language>it</language>
${P.slice(0, 20).map((a) => `<item><title>${esc(a.titolo)}</title><link>${SITO}${a.url}</link><guid isPermaLink="true">${SITO}${a.url}</guid><pubDate>${a.data.toUTCString()}</pubDate><description>${esc(parole(a.estratto, 40))}</description></item>`).join('\n')}
</channel></rss>
`;
const sitemap = (urls) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([l, d]) => `<url><loc>${SITO}${l}</loc>${d ? `<lastmod>${d}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;

// ---------- main ----------
function pulisci() {
  for (const d of ['post', 'category', 'tag', 'archiviodelgusto', 'mappa', 'cerca', 'feed', 'chi-sono', 'privacy-policy', 'leggi-un-numero-della-newsletter', 'leggi-un-numero'])
    fs.rmSync(d, { recursive: true, force: true });
}

function main() {
  pulisci();
  const tutti = leggiArticoli();
  const P = tutti.filter((a) => !movedSlugs.has(a.slug));
  const nomeCat = new Map();
  for (const a of tutti) for (const c of a.categorie) if (!nomeCat.has(c.slug)) nomeCat.set(c.slug, c.nome);

  scrivi('index.html', home(P, nomeCat));
  for (const a of P) scrivi(path.join('post', a.slug, 'index.html'), a.voto || a.rubrica ? paginaAssaggio(a, nomeCat) : paginaStandard(a, nomeCat));
  for (const [slug, nuovo] of movedSlugs) scrivi(path.join('post', slug, 'index.html'), redirectStub(slug, nuovo));

  const cat = new Map(), tag = new Map();
  for (const a of P) {
    for (const c of a.categorie) (cat.get(c.slug) || cat.set(c.slug, { c, a: [] }).get(c.slug)).a.push(a);
    for (const t of a.tag) (tag.get(t.slug) || tag.set(t.slug, { c: t, a: [] }).get(t.slug)).a.push(a);
  }
  const lista = (mappaDati, tipo, eyebrow) => {
    for (const { c, a } of mappaDati.values()) {
      const tot = Math.max(1, Math.ceil(a.length / 24));
      for (let p = 1; p <= tot; p++) {
        const url = `/${tipo}/${c.slug}/`;
        scrivi(path.join(tipo, c.slug, ...(p === 1 ? [] : ['pagina', String(p)]), 'index.html'),
          elenco({ titolo: tipo === 'tag' ? `#${c.nome}` : c.nome, eyebrow, articoli: a, url, descrizione: `Articoli di Errante del Gusto: ${c.nome}.`, nomeCat, pag: p }));
      }
    }
  };
  lista(cat, 'category', 'Categoria');
  lista(tag, 'tag', 'Tag');

  scrivi('archiviodelgusto/index.html', archivio(P, nomeCat));
  // elenco "ultimi articoli" per la pagina /ordine/ (prima veniva dall'API di WordPress)
  {
    const fmt = (a) => ({ id: a.slug, title: { rendered: a.titolo }, link: u(a.url), date: a.data.toISOString(), excerpt: { rendered: a.sommario || a.estratto || '' } });
    const inCat = (a, slugs) => a.categorie.some((c) => slugs.includes(c.slug));
    scrivi('assets/ultimi.json', JSON.stringify({
      assaggi: P.filter((a) => inCat(a, ['piccoli-morsi', 'tesori-della-terra'])).slice(0, 4).map(fmt),
      articoli: P.filter((a) => inCat(a, ['dolcevita'])).slice(0, 3).map(fmt),
    }));
    fs.mkdirSync('ordine', { recursive: true });
    fs.copyFileSync('contenuti/ordine/index.html', 'ordine/index.html');
  }
  scrivi('mappa/index.html', mappa(nomeCat));
  scrivi('cerca/index.html', cerca(nomeCat));

  const pagine = leggiPagine();
  for (const p of pagine) {
    const html = pagina({
      titolo: `${p.titolo} — ${NOME}`, url: `/${p.slug}/`, nomeCat,
      corpo: `<main class="art"><div class="art-card"><h1>${esc(p.titolo)}</h1><div class="prose-edg">${p.html}</div></div></main>`,
    });
    scrivi(path.join(p.slug, 'index.html'), html);
  }
  if (pagine.some((p) => p.slug === 'leggi-un-numero-della-newsletter'))
    scrivi('leggi-un-numero/index.html', redirectStub('leggi-un-numero', u('/leggi-un-numero-della-newsletter/')));

  scrivi('404.html', pagina({ titolo: `Pagina non trovata — ${NOME}`, url: '/404.html', nomeCat, noindex: true,
    corpo: `<main class="art"><div class="art-card"><h1>Pagina non trovata</h1><p>Questa pagina non esiste o si è spostata. <a href="${u('/')}">Torna alla home</a> o <a href="${u('/cerca/')}">cerca nel sito</a>.</p></div></main>` }));
  scrivi('feed/index.xml', feed(P));
  scrivi('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITO}/sitemap.xml\n`);
  scrivi('sitemap.xml', sitemap([['/', dataISO(P[0].data)], ['/archiviodelgusto/'], ['/mappa/'], ['/chi-sono/']]
    .concat(P.map((a) => [a.url, dataISO(a.data)])).concat([...cat.values()].map(({ c }) => [`/category/${c.slug}/`]))));

  console.log(`✓ ${P.length} articoli, ${cat.size} categorie, ${tag.size} tag, ${pagine.length} pagine, ${movedSlugs.size} rimandi a Vampiri Italiani`);
}
main();
