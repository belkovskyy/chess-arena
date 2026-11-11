import { Battle } from './battle.js';
import { chooseMove, cleanDifficulty } from './bot.js';
import { Battle as BattleV5 } from './_compat/v5/battle.js';
import { chooseMove as chooseV5 } from './_compat/v5/bot.js';
import { Battle as BattleV6 } from './_compat/v6/battle.js';
import { chooseMove as chooseV6 } from './_compat/v6/bot.js';
import { Battle as BattleV7 } from './_compat/v7/battle.js';
import { chooseMove as chooseV7 } from './_compat/v7/bot.js';
import { Battle as BattleV8 } from './_compat/v8/battle.js';
import { chooseMove as chooseV8 } from './_compat/v8/bot.js';
import { Battle as BattleV9 } from './_compat/v9/battle.js';
import { chooseMove as chooseV9 } from './_compat/v9/bot.js';
import { Battle as BattleV10 } from './_compat/v10/battle.js';
import { chooseMove as chooseV10 } from './_compat/v10/bot.js';
import { Battle as BattleV11 } from './_compat/v11/battle.js';
import { chooseMove as chooseV11 } from './_compat/v11/bot.js';
import { Battle as BattleV12 } from './_compat/v12/battle.js';
import { chooseMove as chooseV12 } from './_compat/v12/bot.js';
import { Battle as BattleV13 } from './_compat/v13/battle.js';
import { chooseMove as chooseV13 } from './_compat/v13/bot.js';

const engines = new Map([
  [5, [BattleV5, chooseV5]], [6, [BattleV6, chooseV6]], [7, [BattleV7, chooseV7]],
  [8, [BattleV8, chooseV8]], [9, [BattleV9, chooseV9]], [10, [BattleV10, chooseV10]],
  [11, [BattleV11, chooseV11]], [12, [BattleV12, chooseV12]],
  [13, [BattleV13, chooseV13]], [14, [Battle, chooseMove]],
]);

export function calculateBattleTurn({ actions, loadout, boss, difficulty, rulesVersion = 5 }) {
  const engine = engines.get(rulesVersion);
  if (!engine) {
    throw Object.assign(new Error('Версия правил этой партии не поддерживается. Обнови страницу перед новой партией.'), {
      code: 'RULES_VERSION', status: 409,
    });
  }
  if (!Array.isArray(actions) || actions.length > 1600) {
    throw Object.assign(new Error('Некорректная история.'), { status: 400 });
  }
  const [Engine, selectMove] = engine;
  const level = cleanDifficulty(difficulty);
  const game = new Engine({
    ...(loadout && typeof loadout === 'object' ? loadout : {}),
    boss: typeof boss === 'string' ? boss : null,
    difficulty: level,
  });
  for (const [index, action] of actions.entries()) {
    try {
      game.apply(action);
    } catch {
      throw Object.assign(new Error(
        `Правила и история партии несовместимы (действие ${index + 1}). Начни новую партию.`,
      ), { code: 'HISTORY_MISMATCH', status: 409, rulesVersion });
    }
  }
  if (game.isOver()) throw Object.assign(new Error('Партия завершена.'), { status: 400 });

  // Current bots project their own view during search. Older bots receive it here.
  const action = rulesVersion >= 13
    ? selectMove(game, level, { timeMs: 2500 })
    : selectMove(game.view(game.side), level);
  if (!action) throw new Error('Нет доступного хода.');
  game.apply(action);
  return { action, rulesVersion, source: action.power ? 'Тактика способностей' : 'Бот арены' };
}
