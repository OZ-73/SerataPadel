# Torneo Padel (PWA)

App a file singolo per gestire i tornei di padel: `index.html` (+ `sw.js`, `manifest.json`, `jszip.min.js`, icone).

## Aggiornare l'app
1. Modifica `index.html`.
2. Cambia **insieme** `<meta name="app-version" content="vNN">` e `CACHE_NAME = 'padel-vNN'` in `sw.js` (un test lo controlla).
3. Lancia i test: `npm install` (solo la prima volta) e poi `npm test`.
4. Carica i file su GitHub.

## Test
`npm test` carica l'app in un browser simulato (jsdom) e prova abbinamenti, tabellone, tasto indietro, backup, condivisioni e file della PWA. Non sostituisce una prova sul telefono: condivisione, suono, schermo acceso e installazione vanno controllati a mano.
