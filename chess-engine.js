import * as ort from '/vendor/onnxruntime-web/dist/ort.all.bundle.min.mjs';
import { Chess } from '/vendor/chess.js';

const modelDirectory = '/models/LFM2.5-230M-Chess-ONNX';
const firstAddedTokenId = 64402;
const castlingCombinations = ['-', 'q', 'k', 'kq', 'Q', 'Qq', 'Qk', 'Qkq', 'K', 'Kq', 'Kk', 'Kkq', 'KQ', 'KQq', 'KQk', 'KQkq'];
let sessionPromise;
let tokenIdsPromise;

function getTokenIds() {
  tokenIdsPromise ||= fetch(`${modelDirectory}/token_ids.json`)
    .then((response) => {
      if (!response.ok) throw new Error('Не удалось загрузить таблицу токенов ChessLFM.');
      return response.json();
    });
  return tokenIdsPromise;
}

function getSession(onStatus) {
  sessionPromise ||= (async () => {
    ort.env.logLevel = 'warning';
    ort.env.wasm.wasmPaths = '/vendor/onnxruntime-web/dist/';
    ort.env.wasm.numThreads = 1;
    const modelUrl = `${modelDirectory}/onnx/model_q4.onnx`;
    const providers = navigator.gpu ? ['webgpu', 'wasm'] : ['wasm'];
    let lastError;
    for (const provider of providers) {
      try {
        onStatus(provider === 'webgpu' ? 'Загружаю ChessLFM · WebGPU…' : 'Загружаю ChessLFM · CPU…');
        return await ort.InferenceSession.create(modelUrl, {
          executionProviders: [provider],
          externalData: [{ path: 'model_q4.onnx_data', data: `${modelDirectory}/onnx/model_q4.onnx_data` }],
        });
      } catch (error) {
        lastError = error;
        if (provider === 'webgpu') continue;
      }
    }
    throw new Error(`Не удалось загрузить ChessLFM: ${lastError?.message || 'ошибка ONNX Runtime'}`);
  })();
  return sessionPromise;
}

export async function initializeChessEngine(onStatus = () => {}) {
  await Promise.all([getSession(onStatus), getTokenIds()]);
  onStatus('ChessLFM готова · 230M');
}

function tokenId(token, tokenIds) {
  const originalId = tokenIds[token];
  if (typeof originalId !== 'number') throw new Error(`В словаре ChessLFM нет токена ${token}.`);
  return originalId - firstAddedTokenId;
}

function encodePosition(fen, repetitionCount, history, tokenIds) {
  const [placement, sideToMove, castling, enPassant, halfmove] = fen.split(' ');
  const tokens = ['<|pos|>'];
  let cells = '';
  for (const row of placement.split('/')) {
    for (const cell of row) cells += /^[1-8]$/.test(cell) ? '.'.repeat(Number(cell)) : cell;
  }
  if (cells.length !== 64) throw new Error('ChessLFM получила некорректную шахматную позицию.');
  for (const cell of cells) tokens.push(`<c:${cell}>`);

  let castlingBits = 0;
  if (castling !== '-') {
    for (const symbol of castling) castlingBits |= ({ K: 8, Q: 4, k: 2, q: 1 })[symbol] || 0;
  }
  tokens.push(`<stm:${sideToMove}>`);
  tokens.push(`<cast:${castlingCombinations[castlingBits]}>`);
  tokens.push(`<ep:${enPassant === '-' ? '-' : enPassant[0]}>`);
  tokens.push(`<hm:${Math.floor(Math.min(Number(halfmove), 100) / 4)}>`);
  tokens.push(`<rep:${Math.min(Math.max(repetitionCount, 0), 2)}>`);
  tokens.push('<|hist|>');

  const recentMoves = history.slice(-8);
  for (let index = 0; index < 8 - recentMoves.length; index += 1) tokens.push('<m:0000>');
  for (const move of recentMoves) tokens.push(`<m:${move}>`);
  tokens.push('<|eval|>');
  if (tokens.length !== 80) throw new Error(`ChessLFM сформировала ${tokens.length} токенов позиции вместо 80.`);
  return tokens.map((token) => tokenId(token, tokenIds));
}

function positionKey(fen) {
  return fen.split(' ').slice(0, 4).join(' ');
}

function repetitionCount(chess) {
  const replay = new Chess();
  const positions = [positionKey(replay.fen())];
  for (const move of chess.history({ verbose: true })) {
    replay.move({ from: move.from, to: move.to, ...(move.promotion ? { promotion: move.promotion } : {}) });
    positions.push(positionKey(replay.fen()));
  }
  const current = positions.pop();
  return Math.min(2, positions.filter((position) => position === current).length);
}

function asTensor(values) {
  const data = BigInt64Array.from(values, (value) => BigInt(value));
  return new ort.Tensor('int64', data, [1, values.length]);
}

async function lastLogits(session, tokenValues) {
  const outputs = await session.run({
    input_ids: asTensor(tokenValues),
    attention_mask: asTensor(tokenValues.map(() => 1)),
    position_ids: asTensor(tokenValues.map((_, index) => index)),
  });
  const outputName = session.outputNames.find((name) => name.includes('logits')) || session.outputNames[0];
  const logits = outputs[outputName];
  if (!logits?.dims?.length) throw new Error('ONNX Runtime не вернул logits ChessLFM.');
  const sequenceLength = logits.dims[logits.dims.length - 2];
  const vocabularySize = logits.dims[logits.dims.length - 1];
  return logits.data.slice((sequenceLength - 1) * vocabularySize, sequenceLength * vocabularySize);
}

function bestValueBin(logits, tokenIds) {
  let bestBin = 0;
  let bestLogit = -Infinity;
  for (let value = 0; value < 64; value += 1) {
    const logit = logits[tokenId(`<v:${value}>`, tokenIds)];
    if (logit > bestLogit) {
      bestBin = value;
      bestLogit = logit;
    }
  }
  return bestBin;
}

export async function chooseChessMove(chess, onStatus = () => {}) {
  const [session, tokenIds] = await Promise.all([getSession(onStatus), getTokenIds()]);
  const legalMoves = chess.moves({ verbose: true });
  if (legalMoves.length === 0) throw new Error('В этой позиции легальных ходов нет.');

  const history = chess.history({ verbose: true }).map((move) => `${move.from}${move.to}${move.promotion || ''}`);
  const prompt = encodePosition(chess.fen(), repetitionCount(chess), history, tokenIds);
  const valueLogits = await lastLogits(session, prompt);
  const valueBin = bestValueBin(valueLogits, tokenIds);
  const movePrompt = [
    ...prompt,
    tokenId(`<v:${valueBin}>`, tokenIds),
    tokenId('<|bestmove|>', tokenIds),
  ];
  const moveLogits = await lastLogits(session, movePrompt);

  let bestMove = null;
  let bestLogit = -Infinity;
  for (const move of legalMoves) {
    const uci = `${move.from}${move.to}${move.promotion || ''}`;
    const logit = moveLogits[tokenId(`<m:${uci}>`, tokenIds)];
    if (logit > bestLogit) {
      bestMove = uci;
      bestLogit = logit;
    }
  }
  if (!bestMove) throw new Error('ChessLFM не выбрала ход из легальных вариантов.');
  return bestMove;
}
