import {Battle as BattleV13} from './_compat/v13/battle.js';
import {chooseMove as chooseMoveV13} from './_compat/v13/bot.js';
import {Battle as BattleV12} from './_compat/v12/battle.js';
import {chooseMove as chooseMoveV12} from './_compat/v12/bot.js';
import {chooseMove,cleanDifficulty} from './bot.js';
import {chooseMove as legacyChooseMove} from './_compat/v5/bot.js';
import {Battle as LegacyBattle} from './_compat/v5/battle.js';
import {Battle as BattleV6} from './_compat/v6/battle.js';
import {Battle as BattleV7} from './_compat/v7/battle.js';
import {Battle as BattleV8} from './_compat/v8/battle.js';
import {Battle as BattleV11} from './_compat/v11/battle.js';
import {chooseMove as chooseMoveV11} from './_compat/v11/bot.js';
import {Battle as BattleV10} from './_compat/v10/battle.js';
import {chooseMove as chooseMoveV10} from './_compat/v10/bot.js';
import {Battle as BattleV9} from './_compat/v9/battle.js';
import {chooseMove as chooseMoveV9} from './_compat/v9/bot.js';
import {chooseMove as chooseMoveV8} from './_compat/v8/bot.js';
import {chooseMove as chooseMoveV7} from './_compat/v7/bot.js';
import {chooseMove as chooseMoveV6} from './_compat/v6/bot.js';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { Chess } from 'chess.js';
import { ArcadeGame, abilities } from './arcade.js';
import { Battle, localMove } from './battle.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const hfModel = 'hf:mlabonne/LFM2.5-230M-Chess';
let worker;
let workerBuffer = '';
let workerError = '';
let nextWorkerId = 0;
const pending = new Map();

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 100_000) throw new Error('Слишком большой запрос');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function startWorker() {
  if (worker) return worker;
  const condaPython = 'D:\\Conda\\python.exe';
  const executable = process.env.HF_PYTHON || (process.platform === 'win32' && existsSync(condaPython) ? condaPython : (process.platform === 'win32' ? 'py' : 'python3'));
  worker = spawn(executable, ['-u', path.join(root, 'hf_worker.py')], { stdio: ['pipe', 'pipe', 'pipe'] });
  workerBuffer = '';
  workerError = '';
  worker.stdout.setEncoding('utf8');
  worker.stderr.setEncoding('utf8');
  worker.stdout.on('data', (chunk) => {
    workerBuffer += chunk;
    let newline;
    while ((newline = workerBuffer.indexOf('\n')) !== -1) {
      const line = workerBuffer.slice(0, newline);
      workerBuffer = workerBuffer.slice(newline + 1);
      try {
        const result = JSON.parse(line);
        const item = pending.get(result.id);
        if (item) {
          pending.delete(result.id);
          clearTimeout(item.timer);
          result.error ? item.reject(new Error(result.error)) : item.resolve(result);
        }
      } catch { /* Ignore non-protocol output. */ }
    }
  });
  worker.stderr.on('data', (chunk) => { workerError = (workerError + chunk).slice(-2000); });
  const fail = (error) => {
    if (!worker) return;
    worker = null;
    const message = error?.message || workerError || 'Процесс модели завершился.';
    for (const item of pending.values()) {
      clearTimeout(item.timer);
      item.reject(new Error(message));
    }
    pending.clear();
  };
  worker.on('error', fail);
  worker.on('exit', (code) => fail(new Error(`Процесс модели завершился (${code}). ${workerError}`)));
  return worker;
}

function hfMove(position, legalMoves, history, repetition) {
  const process = startWorker();
  const id = ++nextWorkerId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      process.kill();
      reject(new Error('Модель слишком долго загружается или думает. Проверь Python и соединение с Hugging Face.'));
    }, 600_000);
    pending.set(id, { resolve, reject, timer });
    process.stdin.write(`${JSON.stringify({ id, fen: position, legalMoves, history, repetition })}\n`);
  });
}

function validateGame(fen, history, botColor, arcade) {
  if (typeof fen !== 'string' || !Array.isArray(history) || history.length > 1000) {
    throw new Error('Некорректная позиция.');
  }
  const game = arcade ? new ArcadeGame(Chess) : new Chess();
  for (const uci of history) {
    if (typeof uci !== 'string' || !/^[a-h][1-8][a-h][1-8][qrbn!]?$/.test(uci) || (!arcade && uci.endsWith('!'))) {
      throw new Error('Некорректная история ходов.');
    }
    try {
      game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] === '!' ? undefined : uci[4], ultimate: uci[4] === '!' });
    }
    catch { throw new Error('История содержит недопустимый ход.'); }
  }
  if (game.fen() !== fen || game.turn() !== botColor || game.isGameOver()) {
    throw new Error('Позиция не соответствует партии.');
  }
  return { game, repetition: arcade ? game.repetition() : Number(game.isThreefoldRepetition()) * 2 };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'POST' && url.pathname === '/api/battle') {
    try {
      const { actions, loadout, boss, difficulty, rulesVersion } = await readJson(req);
      if(rulesVersion!==undefined&&![5,6,7,8,9,10,11,12,13,14].includes(rulesVersion))return send(res,409,{code:'RULES_VERSION',error:'Версия правил в этой вкладке не поддерживается сервером. Обнови страницу перед новой партией.'});
      const version=rulesVersion??5,Engine=version===14?Battle:version===13?BattleV13:version===12?BattleV12:version===11?BattleV11:version===10?BattleV10:version===9?BattleV9:version===8?BattleV8:version===7?BattleV7:version===6?BattleV6:LegacyBattle,selectMove=version===14?chooseMove:version===13?chooseMoveV13:version===12?chooseMoveV12:version===11?chooseMoveV11:version===10?chooseMoveV10:version===9?chooseMoveV9:version===8?chooseMoveV8:version===7?chooseMoveV7:version===6?chooseMoveV6:legacyChooseMove;
      if (!Array.isArray(actions) || actions.length > 1600) return send(res,400,{error:'Некорректная история.'});
      const game = new Engine({ ...(loadout && typeof loadout === 'object' ? loadout : {}), boss: typeof boss === 'string' ? boss : null, difficulty: cleanDifficulty(difficulty) });
      for (let i=0;i<actions.length;i++)try{game.apply(actions[i]);}catch{return send(res,409,{code:'HISTORY_MISMATCH',rulesVersion:version,error:`Правила вкладки и история партии несовместимы (действие ${i+1}). Повтор запроса не исправит это. Обнови страницу и начни новую партию; старое сохранение останется в браузере.`});}
      if (game.isOver()) return send(res,400,{error:'Партия завершена.'});
      // The bot plays from its own view: a hidden bishop is invisible to it as well.
      const view = game.view(game.side);
      const move = selectMove(version>=13?game:view,cleanDifficulty(difficulty),version>=13?{timeMs:2500}:undefined);
      if(!move)throw new Error('Нет доступного хода.');
      // Check the answer against the full replay before returning it to the browser.
      game.apply(move);
      // The full move (with its area) lets the client animate the ability before applying it.
      return send(res,200,{action:move,rulesVersion:version,source:move.power?'Тактика способностей':'Бот арены'});
    } catch(error) { return send(res,502,{error:error.message||'Не получилось получить ход.'}); }
  }

  if (req.method === 'GET' && url.pathname === '/api/models') {
    let models = ['arena', hfModel];
    let ollamaAvailable = false;
    try {
      const response = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(4000) });
      if (!response.ok) throw new Error(`Ollama ответила ${response.status}`);
      const data = await response.json();
      models = ['arena', hfModel, ...(data.models || []).filter((item) => !item.name.includes('embedding')).map((item) => item.name)];
      ollamaAvailable = true;
    } catch { /* Hugging Face model remains available. */ }
    return send(res, 200, { models, ollamaAvailable });
  }

  if (req.method === 'POST' && url.pathname === '/api/move') {
    try {
      const { fen, history, legalMoves: legacyMoves, model, botColor = 'b', variant } = await readJson(req);
      if (typeof model !== 'string' || (!/^[\w.:\/-]{1,100}$/.test(model) && model !== hfModel)) {
        return send(res, 400, { error: 'Выбери доступную модель.' });
      }
      if (botColor !== 'w' && botColor !== 'b') {
        return send(res, 400, { error: 'Некорректная сторона модели.' });
      }
      let game;
      let arcade = false;
      let repetition = 0;
      let moveHistory = history;
      if (Array.isArray(history)) {
        arcade = variant === 'abilities';
        ({ game, repetition } = validateGame(fen, history, botColor, arcade));
        moveHistory = history.slice(history.findLastIndex((move) => move.endsWith('!')) + 1);
      } else if (Array.isArray(legacyMoves) && typeof fen === 'string') {
        // Keep a game already open in an older browser tab playable after an update.
        try { game = new Chess(fen); }
        catch { throw new Error('Некорректная позиция.'); }
        if (game.turn() !== botColor || game.isGameOver()) throw new Error('Некорректная позиция.');
        moveHistory = [];
      } else {
        throw new Error('Некорректная позиция.');
      }
      const legalMoves = game.moves({ verbose: true }).map((move) => ({
        uci: `${move.from}${move.to}${move.promotion || ''}`, san: move.san,
      }));
      if (arcade) {
        legalMoves.push(...game.ultMoves().map((move) => ({
          uci: move.from + move.to, ultimate: true, ability: abilities[move.piece].name,
        })));
      }

      if (model === hfModel) {
        const result = await hfMove(fen, legalMoves.map((move) => move.uci), moveHistory, repetition);
        const selected = legalMoves.find((move) => move.uci === result.move);
        if (!selected) {
          return send(res, 502, { error: 'Модель вернула недопустимый ход.' });
        }
        return send(res, 200, { move: selected.uci, ultimate: Boolean(selected.ultimate), comment: result.comment });
      }

      const moveList = legalMoves.map((move) => move.uci).join(', ');
      const prompt = [
        `Ты играешь в шахматы за ${botColor === 'w' ? 'белых' : 'чёрных'} против человека.`,
        'Выбери один сильный ход из списка. Верни только JSON с полем move, содержащим точный UCI из списка.',
        `FEN: ${fen}`,
        `Допустимые ходы UCI: ${moveList}`,
        ...legalMoves.filter((move) => move.ultimate).map((move) => move.uci + ': ульта «' + move.ability + '» (тратит единственный заряд).'),
      ].join('\n');

      const response = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(120_000),
        body: JSON.stringify({
          model,
          stream: false,
          think: false,
          format: {
            type: 'object',
            properties: { move: { type: 'string' } },
            required: ['move'],
            additionalProperties: false,
          },
          options: { temperature: 0.2, num_predict: 40 },
          messages: [
            { role: 'system', content: 'Верни только JSON с одним полем move. Значение должно быть ходом UCI из списка.' },
            { role: 'user', content: prompt },
          ],
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        return send(res, 502, { error: data.error || `Ошибка Ollama (${response.status})` });
      }
      let answer;
      try { answer = JSON.parse(data.message?.content || '{}'); } catch { answer = {}; }
      const candidate = String(answer.move || '').trim().toLowerCase();
      const selected = legalMoves.find((item) => item.uci === candidate);
      if (!selected) {
        const fallback = legalMoves[Math.floor(Math.random() * legalMoves.length)];
        return send(res, 200, { move: fallback.uci, ultimate: Boolean(fallback.ultimate), comment: 'Модель не разобрала ход, сыгран случайный допустимый ход.' });
      }
      return send(res, 200, {
        move: selected.uci,
        ultimate: Boolean(selected.ultimate),
        comment: 'Ход сделан.',
      });
    } catch (error) {
      const message = error.name === 'TimeoutError'
        ? 'Модель долго думает. Попробуй ещё раз или выбери модель поменьше.'
        : (error.message || 'Не удалось получить ход от модели.');
      const status = error instanceof SyntaxError || /Некоррект|не соответствует|недопустимый ход|Слишком большой/.test(message) ? 400 : 502;
      return send(res, status, { error: message });
    }
  }

  if (req.method === 'GET' && url.pathname === '/vendor/chess.js') {
    try {
      const contents = await readFile(path.join(root, 'node_modules', 'chess.js', 'dist', 'esm', 'chess.js'));
      return send(res, 200, contents.toString(), 'text/javascript; charset=utf-8');
    } catch {
      return send(res, 503, { error: 'Зависимость chess.js не установлена. Выполни npm install.' });
    }
  }

  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  if (!['/_compat/v13/battle.js','/_compat/v13/bot.js','/_compat/v13/giant-rules.js','/_compat/v13/encounter-rules.js','/_compat/v13/tuning.js','/index.html', '/app.js', '/style.css', '/arcade.js', '/battle.js', '/battle-v6.js', '/battle-v7.js', '/bot.js', '/sniper-fx.js', '/giant-rules.js', '/_compat/v8/battle.js', '/_compat/v8/giant-rules.js', '/_compat/v9/battle.js', '/_compat/v9/giant-rules.js', '/_compat/v10/battle.js', '/_compat/v10/giant-rules.js', '/_compat/v11/battle.js', '/_compat/v11/giant-rules.js', '/encounter-rules.js', '/tuning.js', '/_compat/v12/battle.js', '/_compat/v12/giant-rules.js', '/_compat/v12/encounter-rules.js'].includes(requested)
    && !/^\/pieces\/[wb][kqrbnp]\.svg$/.test(requested)
    && !/^\/assets\/(?:boss-(?:hunter|iron|warlock|horde|giant)|hunter-(?:wolf|bush))\.svg$/.test(requested)) {
    return send(res, 404, { error: 'Не найдено' });
  }
  const filename = path.join(root, requested==='/battle-v6.js'?'_compat/v6/battle.js':requested==='/battle-v7.js'?'_compat/v7/battle.js':requested.slice(1));
  try {
    const info = await stat(filename);
    if (!info.isFile()) return send(res, 404, { error: 'Не найдено' });
    const contents = await readFile(filename);
    return send(res, 200, contents, mime[path.extname(filename)] || 'application/octet-stream');
  } catch {
    return send(res, 404, { error: 'Не найдено' });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Шахматы открыты: http://127.0.0.1:${port}`);
});
