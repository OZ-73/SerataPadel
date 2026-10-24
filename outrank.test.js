const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./helpers');

const FOUR = [['Anna','Beppe'],['Carlo','Dario'],['Elena','Franco'],['Giulia','Hugo']];
function withTournament(){
  const app = loadApp();
  app.startFixed(FOUR, 2, 1);
  app.ev('generateRound()');
  app.submitScores([[6, 3]]);
  app.ev('finishTournament(); ratingSummary = null;');
  return app;
}
const names = (app, mode) => JSON.parse(app.ev(`JSON.stringify((function(){ rankMode='${mode}'; const o=[]; const rows = rankMode==='elo' ? positionsElo(archive,1) : rankMode==='glicko' ? positionsGlicko(archive,1) : rankMode==='adv' ? positionsAdv(archive,1) : positionsWin(archive); Object.keys(rows).forEach(id=>o.push(roster[id].name)); return o; })())`));

test('fuori classifica: sparisce da tutte le classifiche ma il rating continua a essere calcolato', () => {
  const app = withTournament();
  const before = JSON.parse(app.ev(`JSON.stringify(Object.fromEntries(Object.values(roster).map(p=>[p.name,p.elo])))`));
  app.ev(`roster[findIdByName('Anna')].outRank = true;`);
  ['elo','win','glicko','adv'].forEach(m => {
    assert.ok(!names(app, m).includes('Anna'), m + ': Anna non deve comparire');
    if(m !== 'win') assert.ok(names(app, m).includes('Beppe'), m + ': Beppe resta');   // % vittorie richiede un minimo di partite
  });
  // il rating di Anna non cambia (a differenza del congelato) e quello degli altri nemmeno
  app.ev('recomputeRatings()');
  const after = JSON.parse(app.ev(`JSON.stringify(Object.fromEntries(Object.values(roster).map(p=>[p.name,p.elo])))`));
  assert.deepStrictEqual(after, before);
  app.close();
});

test('fuori classifica: la spunta nella modifica del giocatore si salva e sopravvive al backup', () => {
  const app = withTournament();
  const id = app.ev(`findIdByName('Carlo')`);
  app.ev(`editingKey='${id}'; render();`);
  const cb = app.w.document.getElementById('outedit_' + id);
  assert.ok(cb, 'checkbox presente');
  cb.checked = true;
  app.ev(`saveRename('${id}')`);
  assert.strictEqual(app.ev(`roster['${id}'].outRank`), true);
  const bk = JSON.parse(app.ev(`JSON.stringify(backupObject())`));
  assert.strictEqual(bk.roster[id].outRank, true);
  app.ev(`roster = normalizeRoster(${JSON.stringify(bk.roster)})`);
  assert.strictEqual(app.ev(`roster['${id}'].outRank`), true);
  app.close();
});

test('vecchi backup senza il campo: nessuno è fuori classifica', () => {
  const app = withTournament();
  const r = JSON.parse(app.ev(`JSON.stringify(roster)`));
  Object.values(r).forEach(p => delete p.outRank);
  app.ev(`roster = normalizeRoster(${JSON.stringify(r)})`);
  assert.strictEqual(app.ev(`Object.values(roster).some(p => p.outRank)`), false);
  app.close();
});

test('export Excel: colonna Fuori classifica nel foglio Giocatori', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(src, /'Lato','Fuori classifica'\]/);
});

test('fuori classifica: le squadre con quel giocatore spariscono dalla classifica squadre', () => {
  const app = withTournament();
  const n = () => app.ev(`teamRankList().list.map(x => x.name)`);
  assert.ok(n().some(x => x.includes('Anna')), 'prima: la squadra di Anna c\'è');
  app.ev(`roster[findIdByName('Anna')].outRank = true;`);
  assert.ok(!n().some(x => x.includes('Anna')), 'dopo: la squadra di Anna non c\'è');
  assert.ok(n().some(x => x.includes('Carlo')), 'le altre squadre restano');
  app.close();
});
