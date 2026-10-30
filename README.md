# Errante del Gusto

Sito statico generato da file Markdown (stesso sistema di Vampiri Italiani).

- Articoli: `contenuti/articoli/AAAA-MM-GG-titolo.md` · foto in `img/`
- Al salvataggio GitHub rigenera il sito da solo (`.github/workflows/sito.yml`); ogni mattina pubblica gli articoli programmati.
- Editor nel browser: Pages CMS (`.pages.yml`).
- Comandi: `npm install`, poi `npm run build` (sito) o `npm run anteprima`.

## Articoli
Intestazione di un assaggio:

    ---
    titolo: "Il titolo"
    data: 2026-11-03
    categorie: ["Pizza in Pagella"]
    rubrica: "Pizza in Pagella"
    voto: 40
    produttore: "..."
    negozio: "..."
    copertina: /img/2026/11/foto.webp
    ---

Senza `rubrica` e `voto` l'articolo è un pezzo normale (cronache, appunti).
`bozza: true` = non pubblicato. Data futura = programmato.

## Passaggio al dominio vero
In `config.json` cambiare `url` in `https://www.errantedelgusto.it` e `base` in `""`, poi aggiungere un file `CNAME` con `www.errantedelgusto.it`.

`contenuti/` e `img/` sono sorgenti. Tutto il resto viene riscritto a ogni build.
