import { calculateBattleTurn } from './battle-turn.js';

self.onmessage = ({ data }) => {
  try {
    self.postMessage(calculateBattleTurn(data));
  } catch (error) {
    self.postMessage({ error: error.message || 'Не получилось получить ход.', code: error.code });
  }
};
