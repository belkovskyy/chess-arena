export const abilities = {
  r: { name: 'Сквозняк', hint: 'Ладья перепрыгивает ровно одну фигуру и берёт вражескую за ней.' },
  n: { name: 'Дальний прыжок', hint: 'Конь прыгает на три клетки в одну сторону и на одну вбок.' },
  b: { name: 'Смена масти', hint: 'Слон шагает на соседнюю пустую клетку по прямой и меняет цвет поля.' },
  q: { name: 'За углом', hint: 'Ферзь огибает угол: две клетки по прямой, одна вбок, со взятием. Путь должен быть свободен.' },
  k: { name: 'Размен отменяется', hint: 'Король меняется местами с соседней своей фигурой. Король должен остаться в безопасности.' },
  p: { name: 'Форсаж', hint: 'Пешка вне стартового ряда проходит две пустые клетки вперёд, не доходя до края.' },
};

const files = 'abcdefgh';
const axes = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const near = [...axes, [1, 1], [1, -1], [-1, 1], [-1, -1]];
const enemy = (color) => color === 'w' ? 'b' : 'w';
const shift = (square, dx, dy) => {
  const file = files.indexOf(square[0]) + dx;
  const rank = Number(square[1]) + dy;
  return file >= 0 && file < 8 && rank >= 1 && rank <= 8 ? files[file] + rank : null;
};

function patterns(chess, from, piece) {
  const result = [];
  const get = (square) => square ? chess.get(square) : undefined;
  const canTake = (target) => target && target.color !== piece.color && target.type !== 'k';
  const add = (to, via = []) => result.push({ from, to, via, piece: piece.type, color: piece.color, ultimate: true });
  if (piece.type === 'r') {
    for (const [dx, dy] of axes) {
      const via = [];
      let jumped = false;
      for (let to = shift(from, dx, dy); to; to = shift(to, dx, dy)) {
        const target = get(to);
        if (target && jumped) {
          if (canTake(target)) add(to, via);
          break;
        }
        if (target) jumped = true;
        via.push(to);
      }
    }
  } else if (piece.type === 'n') {
    for (const [dx, dy] of axes) {
      for (const sign of [-1, 1]) {
        const to = shift(from, 3 * dx + sign * dy, 3 * dy + sign * dx);
        if (to && (!get(to) || canTake(get(to)))) add(to);
      }
    }
  } else if (piece.type === 'b') {
    for (const [dx, dy] of axes) {
      const to = shift(from, dx, dy);
      if (to && !get(to)) add(to);
    }
  } else if (piece.type === 'q') {
    for (const [dx, dy] of axes) {
      const first = shift(from, dx, dy);
      const bend = shift(from, 2 * dx, 2 * dy);
      if (!bend || get(first) || get(bend)) continue;
      for (const sign of [-1, 1]) {
        const to = shift(bend, sign * dy, sign * dx);
        if (canTake(get(to))) add(to, [first, bend]);
      }
    }
  } else if (piece.type === 'k') {
    for (const [dx, dy] of near) {
      const to = shift(from, dx, dy);
      const target = get(to);
      if (target?.color === piece.color && !(target.type === 'p' && /[18]$/.test(from))) add(to);
    }
  } else if (piece.type === 'p' && from[1] !== (piece.color === 'w' ? '2' : '7')) {
    const direction = piece.color === 'w' ? 1 : -1;
    const through = shift(from, 0, direction);
    const to = shift(from, 0, 2 * direction);
    if (to && !/[18]$/.test(to) && !get(through) && !get(to)) add(to, [through]);
  }
  return result;
}

function ultimatePosition(Chess, fen, move) {
  const board = new Chess(fen);
  const piece = board.remove(move.from);
  const target = board.remove(move.to);
  if (!board.put(piece, move.to)) return null;
  if (piece.type === 'k' && !board.put(target, move.from)) return null;
  const [placement, turn, castling, , halfmove, fullmove] = board.fen().split(' ');
  const king = board.findPiece({ type: 'k', color: turn })[0];
  if (board.isAttacked(king, enemy(turn))) return null;
  const irreversible = piece.type === 'p' || (target && target.color !== turn);
  return [placement, enemy(turn), castling, '-', irreversible ? 0 : Number(halfmove) + 1,
    Number(fullmove) + (turn === 'b' ? 1 : 0)].join(' ');
}

export const moveCode = (move) => move.from + move.to + (move.ultimate ? '!' : (move.promotion || ''));

export class ArcadeGame {
  constructor(Chess, fen) {
    this.Chess = Chess;
    this.reset(fen);
  }

  reset(fen) {
    this.chess = fen ? new this.Chess(fen) : new this.Chess();
    this.used = new Set();
    this.log = [];
    this.positions = [this.positionKey()];
    this.cachedAbilities = null;
  }

  fen() { return this.chess.fen(); }
  turn() { return this.chess.turn(); }
  get(square) { return this.chess.get(square); }
  moves(options) { return this.chess.moves(options); }
  history({ verbose = false } = {}) { return this.log.map(({ move }) => verbose ? move : moveCode(move)); }
  hasCharge(color = this.turn()) { return !this.used.has(color); }
  positionKey() { return this.fen().split(' ').slice(0, 4).join(' ') + ' ' + ['w', 'b'].map((color) => Number(this.hasCharge(color))).join(''); }
  repetition() { const key = this.positionKey(); return this.positions.filter((entry) => entry === key).length - 1; }

  ultMoves(square) {
    if (!this.hasCharge()) return [];
    if (!this.cachedAbilities) {
      const color = this.turn();
      const fen = this.fen();
      this.cachedAbilities = this.chess.board().flat().filter((piece) => piece?.color === color)
        .flatMap((piece) => patterns(this.chess, piece.square, piece))
        .map((move) => ({ ...move, after: ultimatePosition(this.Chess, fen, move) }))
        .filter((move) => move.after);
    }
    return square ? this.cachedAbilities.filter((move) => move.from === square) : this.cachedAbilities;
  }

  move({ from, to, promotion, ultimate = false }) {
    let move;
    let previous;
    if (ultimate) {
      move = this.ultMoves(from).find((candidate) => candidate.to === to);
      if (!move) throw new Error('Недопустимый ход ультой.');
      previous = this.chess;
      this.chess = new this.Chess(move.after);
      this.used.add(move.color);
    } else {
      move = this.chess.move({ from, to, promotion });
    }
    this.log.push({ move, previous });
    this.cachedAbilities = null;
    this.positions.push(this.positionKey());
    return move;
  }

  undo() {
    const entry = this.log.pop();
    if (!entry) return null;
    if (entry.previous) {
      this.chess = entry.previous;
      this.used.delete(entry.move.color);
    } else {
      this.chess.undo();
    }
    this.positions.pop();
    this.cachedAbilities = null;
    return entry.move;
  }

  isCheckmate() { return this.chess.isCheckmate() && this.ultMoves().length === 0; }
  isDraw() {
    return this.chess.isDrawByFiftyMoves() || this.chess.isInsufficientMaterial() ||
      this.repetition() >= 2 || (this.chess.isStalemate() && this.ultMoves().length === 0);
  }
  isGameOver() { return this.isCheckmate() || this.isDraw(); }
}
