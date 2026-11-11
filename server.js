import { calculateBattleTurn } from './battle-turn.js';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { Chess } from 'chess.js';
import { ArcadeGame, abilities } from './arcade.js';

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
      return send(res, 200, calculateBattleTurn(await readJson(req)));
    } catch (error) {
      return send(res, error.status || 502, {
        error: error.message || 'Не получилось получить ход.',
        code: error.code,
        rulesVersion: error.rulesVersion,
      });
    }
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
  if (!['/index.html', '/app.js', '/style.css', '/arcade.js', '/battle.js', '/battle-v6.js', '/battle-v7.js', '/bot.js', '/sniper-fx.js', '/giant-rules.js', '/encounter-rules.js', '/tuning.js', '/battle-turn.js', '/battle-worker.js', '/room.js', '/vendor/peerjs.min.js'].includes(requested)
    && !/^\/_compat\/v(?:[5-9]|1[0-3])\/(?:battle|bot|encounter-rules|giant-rules|tuning)\.js$/.test(requested)
    && !/^\/pieces\/[wb][kqrbnp]\.svg$/.test(requested)
    && !/^\/assets\/(?:boss-(?:hunter|iron|warlock|horde|giant)|hunter-(?:wolf|bush))\.svg$/.test(requested)) {
    return send(res, 404, { error: 'Не найдено' });
  }
  const filename = requested === '/vendor/peerjs.min.js'
    ? path.join(root, 'node_modules/peerjs/dist/peerjs.min.js')
    : path.join(root, requested==='/battle-v6.js'?'_compat/v6/battle.js':requested==='/battle-v7.js'?'_compat/v7/battle.js':requested.slice(1));
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
