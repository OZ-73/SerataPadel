const test = require('node:test');
const assert = require('node:assert');
const { loadApp, sleep } = require('./helpers');

const FOUR = [['A','B'],['C','D'],['E','F'],['G','H']];

function setup(){
  const app = loadApp();
  app.startFixed(FOUR, 2, 2);
  app.ev('generateRound()');
  const spy = { osc: 0, resumed: 0, wlAcq: 0, wlRel: 0, vib: 0, now: 1_000_000 };
  app.spy = spy;
  app.w.AudioContext = function(){
    this.state = 'suspended'; this.currentTime = 0; this.destination = {};
    this.resume = () => { spy.resumed++; this.state = 'running'; };
    this.createOscillator = () => { spy.osc++; return { type: '', frequency: { value: 0 }, connect(){}, start(){}, stop(){} }; };
    this.createGain = () => ({ gain: { setValueAtTime(){}, exponentialRampToValueAtTime(){} }, connect(){} });
  };
  Object.defineProperty(app.w.navigator, 'wakeLock', { value: { request: async () => { spy.wlAcq++; return { release(){ spy.wlRel++; }, addEventListener(){} }; } } });
  app.w.navigator.vibrate = () => { spy.vib++; return true; };
  app.w.Date.now = () => spy.now;
  return app;
}

test('tabellone: schermo acceso e audio sbloccato all\'apertura, rilasciato alla chiusura', async () => {
  const app = setup();
  app.ev('openKiosk()'); await sleep(10);
  assert.strictEqual(app.spy.wlAcq, 1);
  assert.strictEqual(app.spy.resumed, 1);
  app.ev('closeKiosk()');
  assert.strictEqual(app.spy.wlRel, 1);
  app.close();
});

test('timer: scorre sull\'orologio, pausa, regolazioni, allarme con 3 bip e vibrazione una sola volta', () => {
  const app = setup(), spy = app.spy;
  app.ev('openKiosk(); toggleTimer()');
  assert.strictEqual(app.ev('kioskRemaining()'), 900);
  spy.now += 61_000;
  assert.strictEqual(app.ev('kioskRemaining()'), 839);
  app.ev('adjustTimer(1)');
  assert.strictEqual(app.ev('kioskRemaining()'), 899);
  app.ev('toggleTimer()');                                    // pausa
  spy.now += 300_000;
  assert.strictEqual(app.ev('kioskRemaining()'), 899, 'in pausa il tempo non scorre');
  app.ev('toggleTimer()');
  spy.now += 20 * 60_000;                                    // telefono in standby a lungo
  app.ev('kioskTick()');
  assert.strictEqual(app.ev('kioskRemaining()'), 0);
  assert.strictEqual(spy.osc, 3);
  assert.strictEqual(spy.vib, 1);
  assert.match(app.w.document.getElementById('kioskOverlay').textContent, /tempo scaduto/);
  app.ev('kioskTick()');
  assert.strictEqual(spy.osc, 3, 'nessun secondo allarme');
  app.close();
});

test('chiudere il tabellone ferma il timer; salvare i risultati lo chiude; nuovo turno riparte da 15:00', () => {
  const app = setup();
  app.ev('openKiosk(); toggleTimer()');
  app.ev('closeKiosk()');
  assert.strictEqual(app.ev('kioskTimerInterval'), null);
  app.ev('openKiosk()');
  app.submitScores([[6, 3]]);
  assert.strictEqual(app.w.document.getElementById('kioskOverlay').style.display, 'none');
  app.ev('generateRound(); openKiosk()');
  assert.match(app.w.document.getElementById('kioskOverlay').textContent, /Turno 2/);
  assert.match(app.w.document.getElementById('kioskOverlay').textContent, /15:00/);
  app.close();
});
