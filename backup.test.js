const test = require('node:test');
const assert = require('node:assert');
const NodeZip = require('jszip');
const { loadApp, sleep } = require('./helpers');

const FOUR = [['Anna','Beppe'],['Carlo','Dario'],['Elena','Franco'],['Giulia','Hugo']];

function withTournament(){
  const app = loadApp();
  app.startFixed(FOUR, 2, 1);
  app.ev('generateRound()');
  app.submitScores([[6, 3]]);
  app.ev('finishTournament(); ratingSummary = null;');
  return app;
}
const snapshot = app => app.ev(`JSON.stringify({r:Object.values(roster).map(p=>p.name+':'+p.elo).sort(), a:archive.length})`);

test('condividi backup: file di testo allegato al menu di condivisione e backup segnato come fatto', async () => {
  const app = withTournament();
  Object.defineProperty(app.w.navigator, 'canShare', { value: () => true, configurable: true });
  const box = app.captureShare();
  app.ev('localStorage.removeItem(LS_LAST_BACKUP)');
  await app.ev('shareBackup()');
  assert.ok(box.files && /^torneo-padel-backup-.*\.txt$/.test(box.files[0].name));
  assert.strictEqual(box.files[0].type, 'text/plain');
  assert.notStrictEqual(app.ev('getLastBackup()'), '');
  assert.strictEqual(app.ev('dataMsg'), 'Backup condiviso.');
  app.close();
});

test('condivisione annullata: il backup non viene segnato come fatto', async () => {
  const app = withTournament();
  Object.defineProperty(app.w.navigator, 'canShare', { value: () => true, configurable: true });
  Object.defineProperty(app.w.navigator, 'share', { value: async () => { const e = new Error('x'); e.name = 'AbortError'; throw e; }, configurable: true, writable: true });
  app.ev('localStorage.removeItem(LS_LAST_BACKUP)');
  await app.ev('shareBackup()');
  assert.strictEqual(app.ev('getLastBackup()'), '');
  assert.match(app.ev('dataMsg'), /annullata/);
  app.close();
});

test('senza condivisione di file: ripiega sullo scaricamento', async () => {
  const app = withTournament();
  Object.defineProperty(app.w.navigator, 'canShare', { value: () => false, configurable: true });
  app.ev(`saveFile = async function(fn, b){ window.__saved = fn; return true; }`);
  await app.ev('shareBackup()');
  assert.match(app.w.__saved, /\.txt$/);
  assert.notStrictEqual(app.ev('getLastBackup()'), '');
  app.close();
});

// Nel browser simulato la libreria JSZip non riesce a generare file: si usa la stessa versione in Node con la stessa API.
function useNodeZip(app){
  app.w.JSZip = function(){
    const z = new NodeZip(), g = z.generateAsync.bind(z);
    z.generateAsync = o => g(Object.assign({}, o, { type: 'nodebuffer' })).then(b => new app.w.Blob([b], { type: 'application/zip' }));
    return z;
  };
  app.w.JSZip.loadAsync = data => NodeZip.loadAsync(Buffer.from(new Uint8Array(data)));
}

test('Scarica: salva un .zip con rubrica, torneo e archivio; importandolo si ripristina tutto', async () => {
  const app = withTournament();
  useNodeZip(app);
  const before = snapshot(app);
  app.ev(`saveFile = async function(fn, b){ window.__name = fn; window.__blob = b; return true; }`);
  await app.ev('exportData()');
  assert.match(app.w.__name, /^torneo-padel-backup-.*\.zip$/);
  const bytes = await new Promise(res => { const r = new app.w.FileReader(); r.onload = () => res(Buffer.from(new Uint8Array(r.result))); r.readAsArrayBuffer(app.w.__blob); });
  const zip = await NodeZip.loadAsync(bytes);
  assert.deepStrictEqual(Object.keys(zip.files).sort(), ['archive.json', 'roster.json', 'tournament.json']);
  app.ev('roster = {}; archive = []; saveRoster(); saveArchive();');
  app.ev('handleImportFile(window.__blob)');
  await sleep(500);
  assert.strictEqual(snapshot(app), before);
  assert.strictEqual(app.ev('dataMsg'), 'Dati importati.');
  assert.notStrictEqual(app.ev('getLastBackup()'), '');
  app.close();
});

test('Scarica senza la libreria zip: ripiega sul .json, che si importa lo stesso', async () => {
  const app = withTournament();
  const before = snapshot(app);
  app.ev('window.JSZip = undefined');
  app.ev(`saveFile = async function(fn, b){ window.__name = fn; window.__blob = b; return true; }`);
  await app.ev('exportData()');
  assert.match(app.w.__name, /\.json$/);
  app.ev('roster = {}; archive = []; saveRoster(); saveArchive();');
  app.ev('handleImportFile(window.__blob)');
  await sleep(500);
  assert.strictEqual(snapshot(app), before);
  app.close();
});

test('il file condiviso (.txt) si importa come gli altri formati', async () => {
  const app = withTournament();
  const before = snapshot(app);
  Object.defineProperty(app.w.navigator, 'canShare', { value: () => true, configurable: true });
  const box = app.captureShare();
  await app.ev('shareBackup()');
  app.ev('roster = {}; archive = []; saveRoster(); saveArchive();');
  app.w.__shared = box.files[0];
  app.ev('handleImportFile(window.__shared)');
  await sleep(500);
  assert.strictEqual(snapshot(app), before);
  app.close();
});

test('importa anche i vecchi backup .zip', async () => {
  const app = withTournament();
  const before = snapshot(app);
  const zip = new NodeZip();
  zip.file('roster.json', app.ev('JSON.stringify(roster)'));
  zip.file('tournament.json', app.ev('JSON.stringify(t)'));
  zip.file('archive.json', app.ev('JSON.stringify(archive)'));
  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  // nel browser simulato la libreria si carica da file locale: qui si usa la stessa versione in Node
  app.w.JSZip = { loadAsync: data => NodeZip.loadAsync(Buffer.from(new Uint8Array(data))) };
  app.ev('roster = {}; archive = []; saveRoster(); saveArchive();');
  app.ev(`handleImportFile(new Blob([new Uint8Array(${JSON.stringify([...buf])})]))`);
  await sleep(500);
  assert.strictEqual(snapshot(app), before);
  app.close();
});

test('file non valido: messaggio chiaro, dati intatti', async () => {
  const app = withTournament();
  const before = snapshot(app);
  app.ev(`handleImportFile(new Blob(['questo non è un backup']))`);
  await sleep(300);
  assert.match(app.ev('dataMsg'), /File non valido/);
  assert.strictEqual(snapshot(app), before);
  app.close();
});

test('pannello Dati: Condividi, Scarica e Importa, con Importa separato', () => {
  const app = loadApp();
  const html = app.w.document.getElementById('app').innerHTML;
  assert.match(html, /shareBackup\(\)/);
  assert.match(html, /exportData\(\)/);
  assert.match(html, /Scarica \(\.zip\)/);
  assert.match(html, /class="data-row data-sep"/);
  assert.match(html, /accept="\.txt,\.json,\.zip/);
  app.close();
});

test('memoria persistente: richiesta e indicazione', async () => {
  const app = loadApp();
  let called = 0;
  Object.defineProperty(app.w.navigator, 'storage', { value: { persisted: async () => false, persist: async () => { called++; return true; } } });
  app.ev('storagePersisted = null; requestPersistentStorage()');
  await sleep(30);
  assert.strictEqual(called, 1);
  assert.strictEqual(app.ev('storagePersisted'), true);
  app.ev('render()');
  assert.match(app.w.document.getElementById('app').innerHTML, /memoria dell'app protetta/);
  app.close();
});
