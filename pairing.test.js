const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./helpers');

const SIX = [['A1','A2'],['B1','B2'],['C1','C2'],['D1','D2'],['E1','E2'],['F1','F2']];

test('girone all\'italiana: dopo un abbinamento forzato il calendario si ricostruisce e nessuna coppia si ripete (60 prove)', () => {
  for(let k = 0; k < 60; k++){
    const app = loadApp();
    app.startFixed(SIX, 3, 5);            // 6 squadre, 5 turni = girone all'italiana
    app.ev('generateRound()');
    const a = Math.floor(Math.random() * 3), b = (a + 1 + Math.floor(Math.random() * 2)) % 3;
    app.ev(`openPairEdit(); setFixedTeamSlot(${a},'a', String(t.currentMatches[${b}][1])); applyPairEdit();`);
    assert.strictEqual(app.ev('t.useClassicSchedule'), true, 'il calendario classico deve restare, ricostruito');
    const seen = new Set();
    let allowRepeats = false;
    for(let r = 1; r <= 5; r++){
      if(r > 1) app.ev('generateRound()');
      if(r === 3 && Math.random() < 0.5){   // una seconda forzatura a metà torneo
        // seconda forzatura, ma solo se non ripropone una coppia già giocata (sarebbe una scelta voluta dell'utente)
        app.ev(`openPairEdit(); setFixedTeamSlot(0,'a', String(t.currentMatches[1][0]));`);
        const repeats = app.ev(`(() => { const cur = t.currentMatches.map(m => pairKey(m[0], m[1])); const prev = t.played.filter(k => !cur.includes(k)); return pairEdit.courts.some(c => prev.includes(pairKey(c.a, c.b))); })()`);
        app.ev(repeats ? 'cancelPairEdit()' : 'applyPairEdit()');
        // se questa forzatura rende impossibile completare il girone senza ripetizioni, l'app passa all'abbinamento per classifica
        if(!app.ev('t.useClassicSchedule')) allowRepeats = true;
      }
      assert.strictEqual(app.matches().length, 3);
      app.matches().forEach(m => {
        const key = [Math.min(...m), Math.max(...m)].join('-');
        assert.ok(allowRepeats || !seen.has(key), `coppia ripetuta ${key} al turno ${r}`);
        seen.add(key);
      });
      app.submitScores([[6, Math.floor(Math.random() * 5)], [3, 6], [6, 4]]);
    }
    if(!allowRepeats) assert.strictEqual(seen.size, 15);
    app.close();
  }
});

test('squadre fisse: applicare senza cambiare nulla lascia il calendario classico', () => {
  const app = loadApp();
  app.startFixed(SIX, 3, 5);
  app.ev('generateRound(); openPairEdit(); applyPairEdit();');
  assert.strictEqual(app.ev('t.useClassicSchedule'), true);
  app.close();
});

test('6 squadre, 3 campi, 3 turni, primo turno forzato: 9 coppie diverse (50 prove)', () => {
  for(let k = 0; k < 50; k++){
    const app = loadApp();
    app.startFixed(SIX, 3, 3);
    app.ev('generateRound()');
    const a = Math.floor(Math.random() * 3), b = (a + 1 + Math.floor(Math.random() * 2)) % 3;
    app.ev(`openPairEdit(); setFixedTeamSlot(${a},'a',String(t.currentMatches[${b}][1])); applyPairEdit();`);
    const seen = [];
    for(let r = 1; r <= 3; r++){
      if(r > 1) app.ev('generateRound()');
      assert.strictEqual(app.matches().length, 3);
      app.matches().forEach(m => seen.push([Math.min(...m), Math.max(...m)].join('-')));
      app.submitScores([[6, Math.floor(Math.random() * 5)]]);
    }
    assert.strictEqual(new Set(seen).size, 9);
    app.close();
  }
});

test('primo turno senza calendario classico: squadre vicine per forza (1ª-2ª, 3ª-4ª, 5ª-6ª)', () => {
  const app = loadApp();
  app.startFixed(SIX, 3, 4);
  app.ev('generateRound()');
  const pairs = app.matches().map(m => [...m].sort()).sort();
  assert.deepStrictEqual(pairs, [[0, 1], [2, 3], [4, 5]]);
  app.close();
});

test('squadre dispari: chi riposa al primo turno non è sempre la stessa', () => {
  const rests = new Set();
  for(let k = 0; k < 40; k++){
    const app = loadApp();
    app.startFixed(SIX.slice(0, 5), 2, 4);
    app.ev('generateRound()');
    rests.add(app.ev('t.restingThisRound[0]'));
    app.close();
  }
  assert.ok(rests.size > 1, 'sempre la stessa squadra a riposo');
});

test('forzatura: scegliere una squadra a riposo aggiorna riposi e contatori', () => {
  const app = loadApp();
  app.startFixed(SIX.slice(0, 5), 2, 4);
  app.ev('generateRound(); openPairEdit();');
  const rest = app.ev('t.restingThisRound[0]'), old = app.ev('t.currentMatches[0][0]');
  app.ev(`setFixedTeamSlot(0,'a',String(${rest})); applyPairEdit();`);
  assert.strictEqual(app.ev('t.restingThisRound[0]'), old);
  assert.strictEqual(app.ev(`t.restCounts[${rest}]`), 0);
  assert.strictEqual(app.ev(`t.restCounts[${old}]`), 1);
  app.close();
});
