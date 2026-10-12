const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./helpers');

// S è forte e gioca con tutti; P gioca sempre e solo in coppia con S, quindi vince solo "per induzione".
function scenario(){
  const app = loadApp();
  app.addPlayers(['S','P','X','Y']);
  const id = n => app.ev(`findIdByName(${JSON.stringify(n)})`);
  const mk = (a, b, s1, s2) => ({ aId:0, bId:1, a:a.join(' & '), b:b.join(' & '), s1, s2, pa:a.map(id), pb:b.map(id) });
  const ms = [];
  for(let i = 0; i < 3; i++){ ms.push(mk(['S','P'], ['X','Y'], 6, 2)); ms.push(mk(['S','X'], ['P','Y'], 6, 2)); ms.push(mk(['S','Y'], ['P','X'], 6, 2)); }
  app.ev(`archive = [{ date:'2026-10-01T10:00:00Z', courts:1, maxRounds:1, roundsPlayed:1, teams:[], extras:[], history:[{ round:1, matches:${JSON.stringify(ms)} }] }]; recomputeRatings();`);
  return app;
}

test('classifica avanzata: chi vince solo in coppia con il forte vale meno di lui e converge', () => {
  const app = scenario();
  const rows = JSON.parse(app.ev('JSON.stringify(computeAdvanced(archive))'));
  const r = n => rows.find(x => x.name === n);
  assert.ok(r('S').rating > r('P').rating + 40, 'S deve distaccare P');
  assert.ok(r('S').rating > r('X').rating && r('S').rating > r('Y').rating);
  assert.ok(r('P').rating > r('X').rating, 'P vince con S, ma non quanto basta a superare chi ha battuto S');
  assert.ok(rows.every(x => x.sweeps < 500 && x.se > 0), 'calcolo convergente, con incertezza');
  assert.strictEqual(r('S').partners, 3);
  assert.strictEqual(r('P').partners, 3);
  app.close();
});

test('classifica avanzata: un giocatore congelato resta fisso', () => {
  const app = scenario();
  app.ev(`roster[findIdByName('S')].frozen = true; roster[findIdByName('S')].elo0 = 1200;`);
  const rows = JSON.parse(app.ev('JSON.stringify(computeAdvanced(archive))'));
  assert.strictEqual(Math.round(rows.find(x => x.name === 'S').rating), 1200);
  app.close();
});

test('classifica avanzata: la vista si disegna con Δ Elo e il pulsante è nel selettore', () => {
  const app = scenario();
  const html = app.ev(`rankMode = 'adv'; rankingView()`);
  assert.ok(html.includes('Individuale') && html.includes('Δ Elo') && html.includes('Forza individuale'));
  assert.ok(html.includes('shareRankingWhatsApp') && !html.includes('shareTrendsWhatsApp'));
  assert.deepStrictEqual(app.errors, []);
  app.close();
});

test('condivisione: classifica individuale e classifica squadre', () => {
  const app = scenario();
  const box = app.captureShare();
  app.ev(`setRankMode('adv'); shareRankingWhatsApp()`);
  assert.ok(box.text.includes('CLASSIFICA INDIVIDUALE') && box.text.includes('ΔElo'));
  app.ev(`archive[0].mode = 'americano'; archive[0].players = Object.keys(roster); calc.teamRot = true; shareTeamRankingWhatsApp()`);
  assert.ok(box.text.includes('CLASSIFICA SQUADRE') && /\d+% \(/.test(box.text), box.text);
  assert.ok(app.ev('teamRankingView()').includes('shareTeamRankingWhatsApp'));
  assert.deepStrictEqual(app.errors, []);
  app.close();
});
