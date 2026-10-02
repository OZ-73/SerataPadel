// Carica index.html in un browser simulato (jsdom) e offre qualche scorciatoia per i test.
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function readIndex(){
  // i font remoti non servono ai test (e non c'è rete)
  return fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/<link[^>]*fonts\.g[^>]*>/g, '');
}

function loadApp(){
  const dom = new JSDOM(readIndex(), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/app/' });
  const w = dom.window;
  const errors = [];
  w.addEventListener('error', e => errors.push(e.message));
  w.TextDecoder = require('util').TextDecoder;   // jsdom non lo espone; i browser veri sì
  w.alert = () => {};
  w.confirm = () => true;
  w.prompt = () => null;
  const ev = code => w.eval(code);
  const app = { dom, w, ev, errors, sleep };

  app.addPlayers = names => { ev(`${JSON.stringify(names)}.forEach(n => upsertPlayer(n));`); };
  // squadre fisse: teams = [['A1','A2'], ...]
  app.startFixed = (teams, courts, rounds) => {
    app.addPlayers(teams.flat());
    ev(`t.courts=${courts}; t.maxRounds=${rounds}; draftTeams=${JSON.stringify(teams.map((p, i) => ({ id: i, p1: p[0], p2: p[1] })))}; startTournament();`);
  };
  app.matches = () => JSON.parse(ev('JSON.stringify(t.currentMatches)'));
  // inserisce i punteggi del turno corrente: scores = [[6,3],[6,4],...] e salva
  app.submitScores = scores => {
    const n = ev('t.currentMatches.length');
    for(let i = 0; i < n; i++){
      const [a, b] = scores[i % scores.length];
      w.document.getElementById('s1_' + i).value = String(a);
      w.document.getElementById('s2_' + i).value = String(b);
    }
    ev('submitResults()');
  };
  app.resetToSetup = () => {
    ev(`t={phase:'setup',courts:3,maxRounds:5,teams:[],round:0,played:[],currentMatches:[],history:[],restCounts:{},extras:[]}; saveTournament(); render();`);
  };
  // primo "tocco" dell'utente: crea la voce di cronologia per il tasto indietro
  app.touch = async () => { w.document.dispatchEvent(new w.Event('pointerdown')); await sleep(20); };
  // cattura l'ultimo testo passato al menu di condivisione
  app.captureShare = () => {
    const box = { text: null, files: null };
    Object.defineProperty(w.navigator, 'share', { value: o => { box.text = o.text; box.files = o.files; return Promise.resolve(); }, configurable: true, writable: true });
    return box;
  };
  app.close = () => { try { w.close(); } catch(e) {} };
  return app;
}

module.exports = { loadApp, sleep, ROOT, readIndex };
