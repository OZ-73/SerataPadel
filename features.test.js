const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./helpers');

const FOUR = [['Anna','Beppe'],['Carlo','Dario'],['Elena','Franco'],['Giulia','Hugo']];

function playTournament(app, scores, setup){
  app.resetToSetup();
  app.startFixed(FOUR, 2, 2);
  app.ev('generateRound()');
  if(setup) setup(app);
  app.submitScores(scores);
  app.ev('generateRound()');
  app.submitScores(scores);
  app.ev('finishTournament(); ratingSummary = null;');
}

test('riga Forza: mostra la probabilità attesa', () => {
  const app = loadApp();
  app.startFixed(FOUR, 2, 2);
  app.ev('generateRound()');
  assert.match(app.w.document.getElementById('app').innerHTML, /Vittoria attesa \d+% (–|&ndash;) \d+%/);
  app.close();
});

test('il risultato salvato include probabilità (pA) e lati (sides)', () => {
  const app = loadApp();
  app.startFixed(FOUR, 2, 2);
  app.ev('generateRound()');
  app.submitScores([[6, 3]]);
  const m = JSON.parse(app.ev('JSON.stringify(t.history[0].matches[0])'));
  assert.strictEqual(typeof m.pA, 'number');
  assert.ok(m.pA > 0 && m.pA < 1);
  assert.strictEqual(m.sides.a.length, 2);
  assert.strictEqual(m.sides.b.length, 2);
  app.close();
});

test('lati invertiti: la spunta capovolge Sx/Dx solo per quella squadra e quella partita', () => {
  const app = loadApp();
  app.startFixed(FOUR, 2, 2);
  app.ev('generateRound()');
  const before = JSON.parse(app.ev('JSON.stringify(t.currentMatches.map(m => [t.teams.find(x=>x.id===m[0]).players.map(resolveId), t.teams.find(x=>x.id===m[1]).players.map(resolveId)]))'));
  app.ev(`setRoundSwap(0,'A',true)`);
  app.submitScores([[6, 3]]);
  const ms = JSON.parse(app.ev('JSON.stringify(t.history[0].matches)'));
  assert.deepStrictEqual(ms[0].sides.a, [...before[0][0]].reverse());
  assert.deepStrictEqual(ms[0].sides.b, before[0][1]);
  assert.deepStrictEqual(ms[1].sides.a, before[1][0]);
  app.close();
});

test('sorpresa: vittoria con probabilità attesa ≤ 30% viene segnalata', () => {
  const app = loadApp();
  const call = (pA, s1, s2) => app.ev(`isUpset({pA:${pA}, s1:${s1}, s2:${s2}})`);
  assert.strictEqual(call(0.25, 6, 3), true);     // la squadra A, data al 25%, ha vinto
  assert.strictEqual(call(0.75, 3, 6), true);     // la squadra B, data al 25%, ha vinto
  assert.strictEqual(call(0.60, 6, 3), false);
  assert.strictEqual(call(0.25, 3, 6), false);
  assert.strictEqual(app.ev('isUpset({s1:6,s2:3})'), false, 'senza pA nessuna segnalazione');
  app.close();
});

test('provvisorio: etichetta nelle classifiche e nel profilo per chi ha poche partite', () => {
  const app = loadApp();
  playTournament(app, [[6, 3], [6, 4]]);
  app.ev('setRankMode("elo"); showRanking = true; render();');
  const html = app.w.document.getElementById('app').innerHTML;
  assert.match(html, /class="prov"/);
  const id = app.ev(`findIdByName('Anna')`);
  assert.strictEqual(app.ev(`isProvisional('${id}')`), true);
  app.ev(`roster['${id}'].matches = 12`);
  assert.strictEqual(app.ev(`isProvisional('${id}')`), false);
  app.close();
});

test('condivisione classifica: asterisco e legenda per i provvisori', () => {
  const app = loadApp();
  playTournament(app, [[6, 3], [6, 4]]);
  const box = app.captureShare();
  app.ev('setRankMode("elo"); shareRankingWhatsApp()');
  assert.match(box.text, /\*\s/);
  assert.match(box.text, /provvisorio/);
  app.close();
});

test('profilo giocatore: statistiche per lato solo con partite che hanno il lato registrato', () => {
  const app = loadApp();
  playTournament(app, [[6, 3], [6, 4]]);
  const id = app.ev(`findIdByName('Anna')`);
  app.ev(`showRanking = true; render(); openPlayerProfile('${id}');`);
  assert.match(app.w.document.getElementById('app').innerHTML, /Lato di gioco/);
  app.ev('closePlayerProfile()');
  // archivi senza "sides" (versioni precedenti): nessuna sezione, nessun errore
  app.ev(`archive.forEach(a => (a.history||[]).forEach(h => h.matches.forEach(m => { delete m.sides; })))`);
  app.ev(`openPlayerProfile('${id}')`);
  assert.doesNotMatch(app.w.document.getElementById('app').innerHTML, /Lato di gioco/);
  assert.deepStrictEqual(app.errors, []);
  app.close();
});

test('condivisione risultati: ⚡ per le sorprese e nessuna variazione Elo del torneo precedente', () => {
  const app = loadApp();
  app.startFixed(FOUR, 2, 2);
  app.ev('generateRound()');
  app.submitScores([[6, 3]]);
  app.ev(`t.history[0].matches[0].pA = 0.2; t.history[0].matches[0].s1 = 6; t.history[0].matches[0].s2 = 2;`);
  app.ev(`ratingSummary=[{id:'x',name:'Vecchio',before:1000,after:1010}]`);
  const box = app.captureShare();
  app.ev('shareLiveResults()');
  assert.match(box.text, /⚡/);
  assert.doesNotMatch(box.text, /Variazioni Elo|Vecchio/);
  app.close();
});

test('condivisioni: le righe monospace restano corte per il telefono', () => {
  const app = loadApp();
  playTournament(app, [[6, 3], [6, 4]]);
  const box = app.captureShare();
  for(const mode of ['elo', 'win', 'glicko']){
    app.ev(`setRankMode('${mode}'); shareRankingWhatsApp()`);
    const inBlock = box.text.split('```')[1] || '';
    inBlock.split('\n').forEach(l => assert.ok([...l].length <= 34, `riga troppo larga (${mode}): "${l}"`));
  }
  app.close();
});
