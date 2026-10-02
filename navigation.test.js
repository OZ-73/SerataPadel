const test = require('node:test');
const assert = require('node:assert');
const { loadApp, sleep } = require('./helpers');

const FOUR = [['A','B'],['C','D'],['E','F'],['G','H']];
const back = async app => { app.w.history.back(); await sleep(60); };

async function ready(){ const app = loadApp(); await sleep(30); await app.touch(); return app; }

test('la voce di cronologia si crea solo al primo tocco', async () => {
  const app = loadApp(); await sleep(30);
  assert.strictEqual(app.ev('navReady'), false);
  await app.touch();
  assert.strictEqual(app.ev('navReady'), true);
  assert.strictEqual(app.ev('navIdx'), 1);
  app.close();
});

test('classifiche, squadre, archivio: indietro torna al torneo senza avvisi', async () => {
  const app = await ready();
  for(const flag of ['showRanking', 'showTeamRanking', 'showArchive']){
    app.ev(`${flag} = true; render();`);
    assert.strictEqual(app.ev('navIdx'), 2, flag);
    await back(app);
    assert.strictEqual(app.ev(flag), false, flag);
    assert.strictEqual(app.ev('navIdx'), 1);
    assert.strictEqual(app.w.document.getElementById('toast').style.display === 'block', false);
  }
  app.close();
});

test('grafici/profilo → classifica → torneo; diagnostica → classifica', async () => {
  const app = await ready();
  app.addPlayers(['A', 'B']);
  const id = app.ev(`findIdByName('A')`);
  app.ev(`showRanking = true; render(); openPlayerProfile('${id}');`);
  assert.strictEqual(app.ev('navIdx'), 3);
  await back(app);
  assert.strictEqual(app.ev('viewingPlayerId'), null);
  assert.strictEqual(app.ev('showRanking'), true);
  await back(app);
  assert.strictEqual(app.ev('showRanking'), false);
  app.ev('showDiag = true; showRanking = false; render();');
  await back(app);
  assert.strictEqual(app.ev('showDiag'), false);
  assert.strictEqual(app.ev('showRanking'), true);
  app.close();
});

test('chiudere con i pulsanti dell\'app riallinea la cronologia', async () => {
  const app = await ready();
  app.ev('showRanking = true; render(); showRanking = false; render();');
  await sleep(60);
  assert.strictEqual(app.ev('navIdx'), 1);
  assert.strictEqual(app.w.history.state.nav, 1);
  app.ev('showRanking = true; render(); showRanking = false; showArchive = true; render();');
  assert.strictEqual(app.ev('navIdx'), 2, 'passare da una sezione all\'altra non accumula livelli');
  app.close();
});

test('tabellone e modifica abbinamenti sono livelli', async () => {
  const app = await ready();
  app.startFixed(FOUR, 2, 2);
  app.ev('generateRound(); openKiosk();');
  assert.strictEqual(app.ev('navIdx'), 2);
  await back(app);
  assert.strictEqual(app.ev('kioskIsOpen()'), false);
  app.ev('openPairEdit()');
  await back(app);
  assert.strictEqual(app.ev('pairEdit'), null);
  app.close();
});

test('dal torneo: indietro mostra l\'avviso, senza altre azioni dopo 2 s si torna sul torneo', async () => {
  const app = await ready();
  await back(app);
  assert.strictEqual(app.ev('navIdx'), 0);
  assert.strictEqual(app.w.document.getElementById('toast').style.display, 'block');
  assert.match(app.w.document.getElementById('toast').textContent, /di nuovo indietro/);
  await sleep(2150);
  assert.strictEqual(app.w.document.getElementById('toast').style.display, 'none');
  assert.strictEqual(app.ev('navIdx'), 1);
  assert.strictEqual(app.w.history.state.nav, 1);
  app.close();
});

test('se si usa l\'app mentre l\'avviso è attivo, l\'avviso decade e la navigazione resta coerente', async () => {
  const app = await ready();
  await back(app);
  app.ev('showRanking = true; render();');
  assert.strictEqual(app.w.document.getElementById('toast').style.display, 'none');
  assert.strictEqual(app.ev('navIdx'), 2);
  await back(app);
  assert.strictEqual(app.ev('showRanking'), false);
  assert.strictEqual(app.ev('navIdx'), 1);
  app.close();
});
