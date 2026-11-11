import assert from 'node:assert/strict';
import { once } from 'node:events';
import { Worker } from 'node:worker_threads';
import { Battle } from '../battle.js';
import { Battle as BattleV13 } from '../_compat/v13/battle.js';

const entry = new URL('../battle-worker.js', import.meta.url).href;
const adapter = `
  import { parentPort } from 'node:worker_threads';
  globalThis.self = { postMessage: data => parentPort.postMessage(data) };
  await import(${JSON.stringify(entry)});
  parentPort.on('message', data => self.onmessage({ data }));
`;
const worker = new Worker(new URL('data:text/javascript,' + encodeURIComponent(adapter)));

async function request(state) {
  const reply = once(worker, 'message', { signal: AbortSignal.timeout(10000) });
  worker.postMessage(state);
  return (await reply)[0];
}

try {
  for (const [rulesVersion, Engine, boss] of [[14, Battle, 'warlock'], [13, BattleV13, 'iron']]) {
    const game = new Engine({ boss, difficulty: 'hard' });
    game.apply({ from: 'e2', to: 'e4' });
    let replies = 0;
    while (game.side === 'b' && !game.isOver()) {
      assert.ok(replies++ < 5, 'bot should finish its turn');
      const reply = await request({
        rulesVersion, boss, difficulty: 'hard', actions: game.actions, loadout: game.loadout,
      });
      assert.equal(reply.error, undefined);
      assert.equal(reply.rulesVersion, rulesVersion);
      game.apply(reply.action);
    }
    assert.equal(game.side, 'w');
  }
  const mismatch = await request({ rulesVersion: 14, actions: [{ from: 'a4', to: 'a5' }] });
  assert.equal(mismatch.code, 'HISTORY_MISMATCH');
  console.log('PASS worker plays complete bot turns with current rules and v13 saves');
} finally {
  await worker.terminate();
}
