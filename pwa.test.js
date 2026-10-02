const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ROOT, loadApp, sleep } = require('./helpers');

const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

test('i file locali citati in index.html, manifest e service worker esistono', () => {
  const html = read('index.html');
  const refs = [...html.matchAll(/(?:href|src)="((?!https?:|#|data:)[^"]+)"/g)].map(m => m[1]);
  refs.forEach(r => assert.ok(fs.existsSync(path.join(ROOT, r)), 'manca ' + r));
  const manifest = JSON.parse(read('manifest.json'));
  manifest.icons.forEach(i => assert.ok(fs.existsSync(path.join(ROOT, i.src)), 'manca ' + i.src));
  [...read('sw.js').matchAll(/'\.\/([^']*)'/g)].map(m => m[1]).filter(Boolean)
    .forEach(f => assert.ok(fs.existsSync(path.join(ROOT, f)), 'precache: manca ' + f));
});

test('versione del meta e cache del service worker coincidono (ricordati di aggiornarle insieme)', () => {
  const v = read('index.html').match(/name="app-version" content="([^"]+)"/)[1];
  const c = read('sw.js').match(/CACHE_NAME = '([^']+)'/)[1];
  assert.strictEqual(c, 'padel-' + v);
});

test('nessuna dipendenza da CDN esterne per il codice (funziona offline)', () => {
  assert.doesNotMatch(read('index.html'), /cdnjs|unpkg|jsdelivr/);
});

test('versione visibile in fondo alla pagina; avviso di aggiornamento solo se la versione online è diversa', async () => {
  const app = loadApp();
  const v = app.ev('APP_VERSION');
  assert.strictEqual(app.w.document.getElementById('appver').textContent, 'Torneo Padel ' + v);
  app.w.fetch = async () => ({ ok: true, text: async () => '<meta name="app-version" content="v999">' });
  await app.ev('checkForUpdate(true)');
  assert.strictEqual(app.w.document.getElementById('updateBar').style.display, 'flex');
  app.w.document.getElementById('updateBar').style.display = 'none';
  app.w.fetch = async () => ({ ok: true, text: async () => `<meta name="app-version" content="${v}">` });
  await app.ev('checkForUpdate(true)');
  assert.strictEqual(app.w.document.getElementById('updateBar').style.display, 'none');
  app.close();
});

test('i pulsanti delle classifiche cambiano colore quando mostrano "Torna al torneo"', () => {
  const app = loadApp();
  app.ev('showRanking = true; render();');
  assert.match(app.w.document.getElementById('app').innerHTML, /class="ghost back-active"[^>]*>Torna al torneo/);
  app.ev('showRanking = false; render();');
  assert.doesNotMatch(app.w.document.getElementById('app').innerHTML, /back-active/);
  app.close();
});

test('nessun errore JavaScript al caricamento', async () => {
  const app = loadApp();
  await sleep(100);
  assert.deepStrictEqual(app.errors, []);
  app.close();
});
