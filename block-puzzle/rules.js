(function (root) {
  'use strict';
  const SIZE = 8;
  const entries = [
    ['小星點', ['1'], '#ffd278', 1],
    ['橫向雙格', ['11'], '#81ded3', 1],
    ['直向雙格', ['1', '1'], '#81ded3', 1],
    ['橫向三格', ['111'], '#8cb9ff', 1],
    ['直向三格', ['1', '1', '1'], '#8cb9ff', 1],
    ['小轉角一', ['10', '11'], '#ffac86', 1],
    ['小轉角二', ['01', '11'], '#ffac86', 1],
    ['小轉角三', ['11', '10'], '#ffac86', 1],
    ['小轉角四', ['11', '01'], '#ffac86', 1],
    ['小正方形', ['11', '11'], '#c3a2f3', 1],
    ['橫向四格', ['1111'], '#8cb9ff', 1],
    ['直向四格', ['1', '1', '1', '1'], '#8cb9ff', 1],
    ['L 形一', ['10', '10', '11'], '#ffac86', 1],
    ['L 形二', ['111', '100'], '#ffac86', 1],
    ['L 形三', ['11', '01', '01'], '#ffac86', 1],
    ['L 形四', ['001', '111'], '#ffac86', 1],
    ['反 L 形一', ['01', '01', '11'], '#ffac86', 1],
    ['反 L 形二', ['100', '111'], '#ffac86', 1],
    ['反 L 形三', ['11', '10', '10'], '#ffac86', 1],
    ['反 L 形四', ['111', '001'], '#ffac86', 1],
    ['T 形一', ['111', '010'], '#eda5ce', 1],
    ['T 形二', ['10', '11', '10'], '#eda5ce', 1],
    ['T 形三', ['010', '111'], '#eda5ce', 1],
    ['T 形四', ['01', '11', '01'], '#eda5ce', 1],
    ['階梯一', ['011', '110'], '#81ded3', 1],
    ['階梯二', ['110', '011'], '#81ded3', 1],
    ['階梯三', ['10', '11', '01'], '#81ded3', 1],
    ['階梯四', ['01', '11', '10'], '#81ded3', 1],
    ['橫向五格', ['11111'], '#8cb9ff', 2],
    ['直向五格', ['1', '1', '1', '1', '1'], '#8cb9ff', 2],
    ['小十字', ['010', '111', '010'], '#ffd278', 2],
    ['小山谷', ['101', '111'], '#c3a2f3', 2],
    ['倒山谷', ['111', '101'], '#c3a2f3', 2],
    ['大轉角', ['100', '100', '111'], '#ffac86', 2],
    ['橫向長方形', ['111', '111'], '#eda5ce', 3],
    ['直向長方形', ['11', '11', '11'], '#eda5ce', 3],
    ['大正方形', ['111', '111', '111'], '#c3a2f3', 3]
  ];
  const shapes = entries.map(([name, rows, color, unlock], id) => ({
    id, name, color, unlock, width: rows[0].length, height: rows.length,
    cells: rows.flatMap((row, y) => [...row].flatMap((value, x) => value === '1' ? [{ x, y }] : []))
  }));
  function emptyBoard() { return Array.from({ length: SIZE }, () => Array(SIZE).fill(null)); }
  function canPlace(board, shape, x, y) {
    return Number.isInteger(x) && Number.isInteger(y) && shape.cells.every(cell => {
      const cx = x + cell.x, cy = y + cell.y;
      return cx >= 0 && cx < SIZE && cy >= 0 && cy < SIZE && !board[cy][cx];
    });
  }
  function place(board, shape, x, y) {
    if (!canPlace(board, shape, x, y)) return null;
    const next = board.map(row => row.slice());
    for (const cell of shape.cells) next[y + cell.y][x + cell.x] = shape.color;
    return next;
  }
  function fullRows(board) { return board.flatMap((row, y) => row.every(Boolean) ? [y] : []); }
  function clearRows(board, rows) {
    const cleared = new Set(rows);
    return board.map((row, y) => cleared.has(y) ? Array(SIZE).fill(null) : row.slice());
  }
  function fitsAnywhere(board, shape) {
    for (let y = 0; y <= SIZE - shape.height; y++) {
      for (let x = 0; x <= SIZE - shape.width; x++) if (canPlace(board, shape, x, y)) return true;
    }
    return false;
  }
  function rewards(blocks, rows, level, allClear) {
    return { placement: blocks * 5, lines: rows * rows * 100 * level, bonus: allClear && rows > 0 ? 1200 * level : 0 };
  }
  root.BlockPuzzleRules = { SIZE, shapes, emptyBoard, canPlace, place, fullRows, clearRows, fitsAnywhere, rewards };
})(typeof window !== 'undefined' ? window : globalThis);
