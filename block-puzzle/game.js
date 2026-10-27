(function () {
  'use strict';
  const R = window.BlockPuzzleRules;
  const $ = id => document.getElementById(id);
  const boardEl = $('board'), trayEl = $('tray'), ghost = $('dragGhost');
  const dialog = $('gameDialog'), effectCanvas = $('effects');
  const effectCtx = effectCanvas.getContext('2d');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const colors = ['#81ded3', '#ffd278', '#eda5ce', '#8cb9ff', '#c3a2f3', '#ffac86'];
  const timers = new Set();
  let board = R.emptyBoard(), tray = [], selected = null, score = 0, lines = 0, best = 0;
  let state = 'playing', busy = false, gesture = null, preview = null, focusedCell = 0;
  let sound = false, audio = null, dialogMode = 'help', suppressClickUntil = 0;
  let particles = [], effectFrame = 0, effectLastTime = 0;
  const cells = [];
  const level = () => Math.floor(lines / 5) + 1;
  try {
    const saved = Number(localStorage.getItem('block-puzzle-best-v1'));
    if (Number.isFinite(saved) && saved >= 0) best = saved;
  } catch {}

  function later(callback, delay) {
    const id = setTimeout(() => { timers.delete(id); callback(); }, delay);
    timers.add(id);
    return id;
  }
  function message(text, warning = false) {
    $('message').textContent = text;
    $('message').classList.toggle('warning', warning);
  }
  function renderStats() {
    $('score').textContent = score.toLocaleString();
    $('best').textContent = best.toLocaleString();
    $('lines').textContent = lines;
    $('level').textContent = '第 ' + level() + ' 關';
    $('levelGoal').textContent = '再消除 ' + (5 - lines % 5) + ' 行升關';
    $('progressFill').style.width = (lines % 5) * 20 + '%';
    $('progress').setAttribute('aria-valuenow', lines % 5);
    $('bonusValue').textContent = '+' + (1200 * level()).toLocaleString() + ' 分';
  }
  function addScore(amount) {
    score += amount;
    if (score > best) {
      best = score;
      try { localStorage.setItem('block-puzzle-best-v1', String(best)); } catch {}
    }
    const scoreEl = $('score');
    scoreEl.classList.remove('score-pop');
    void scoreEl.offsetWidth;
    scoreEl.classList.add('score-pop');
    renderStats();
  }
  function renderBoard() {
    cells.forEach((cell, index) => {
      const x = index % R.SIZE, y = Math.floor(index / R.SIZE), value = board[y][x];
      cell.className = value ? 'cell filled' : 'cell';
      cell.style.setProperty('--block', value || 'transparent');
      cell.setAttribute('aria-label', '第 ' + (y + 1) + ' 行，第 ' + (x + 1) + ' 格，' + (value ? '已有方塊' : '空格'));
      cell.tabIndex = index === focusedCell ? 0 : -1;
    });
    paintPreview();
  }
  function shapeElement(shape, pitch, className) {
    const wrapper = document.createElement('div');
    wrapper.className = 'piece-shape';
    wrapper.style.width = shape.width * pitch - 3 + 'px';
    wrapper.style.height = shape.height * pitch - 3 + 'px';
    for (const cell of shape.cells) {
      const block = document.createElement('span');
      block.className = className;
      block.style.cssText = 'left:' + cell.x * pitch + 'px;top:' + cell.y * pitch + 'px;width:' + (pitch - 3) + 'px;height:' + (pitch - 3) + 'px;--block:' + shape.color;
      wrapper.append(block);
    }
    return wrapper;
  }
  function renderTray() {
    trayEl.replaceChildren();
    const pitch = Math.max(11, Math.min(19, (trayEl.getBoundingClientRect().width / 3 - 28) / 5));
    tray.forEach((shape, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'piece-slot';
      button.dataset.slot = index;
      if (!shape) {
        button.classList.add('used');
        button.disabled = true;
        const check = document.createElement('span'); check.textContent = '✓';
        const label = document.createElement('small'); label.textContent = '已拼上';
        button.append(check, label);
      } else {
        button.setAttribute('aria-label', shape.name + '，' + shape.cells.length + ' 小格；拖曳或點選後放到棋盤');
        button.setAttribute('aria-pressed', String(index === selected));
        button.classList.toggle('selected', index === selected);
        button.classList.toggle('no-fit', !R.fitsAnywhere(board, shape));
        button.disabled = busy || state !== 'playing';
        const label = document.createElement('span');
        label.className = 'piece-label'; label.textContent = shape.name;
        button.append(shapeElement(shape, pitch, 'piece-block'), label);
      }
      trayEl.append(button);
    });
  }
  function paintPreview() {
    cells.forEach(cell => cell.classList.remove('preview', 'invalid'));
    const shape = gesture?.dragging ? gesture.shape : tray[selected];
    if (!shape || !preview) return;
    const valid = R.canPlace(board, shape, preview.x, preview.y);
    for (const part of shape.cells) {
      const x = preview.x + part.x, y = preview.y + part.y;
      if (x >= 0 && x < R.SIZE && y >= 0 && y < R.SIZE) {
        const cell = cells[y * R.SIZE + x];
        cell.classList.add('preview');
        cell.classList.toggle('invalid', !valid);
      }
    }
  }
  function selectPiece(index) {
    if (busy || state !== 'playing' || !tray[index]) return;
    selected = index; preview = null;
    renderTray(); paintPreview();
    message(R.fitsAnywhere(board, tray[index]) ? '已選「' + tray[index].name + '」；拖曳，或點棋盤空格放下。' : '這個圖形目前放不下，試試另外一個。', !R.fitsAnywhere(board, tray[index]));
  }
  function deal() {
    const pool = R.shapes.filter(shape => shape.unlock <= level());
    const unused = pool.slice();
    tray = Array.from({ length: 3 }, () => unused.splice(Math.floor(Math.random() * unused.length), 1)[0]);
    // A fresh hand always offers at least one legal placement when one exists.
    if (!tray.some(shape => R.fitsAnywhere(board, shape))) {
      const fitting = pool.filter(shape => R.fitsAnywhere(board, shape));
      if (fitting.length) tray[0] = fitting[Math.floor(Math.random() * fitting.length)];
    }
    selected = null;
  }
  function finishTurn(text) {
    busy = false;
    if (tray.every(shape => !shape)) deal();
    if (!tray.some(shape => shape && R.fitsAnywhere(board, shape))) {
      state = 'over';
      renderTray();
      message('剩下的圖形都放不下了，再挑戰一次吧。');
      openDialog('over', '這回合，拼得很棒！', '得分 ' + score.toLocaleString() + ' 分\n消除 ' + lines + ' 行 · 抵達第 ' + level() + ' 關\n剩下的圖形都沒有空間可以放了。', '再玩一次');
      return;
    }
    renderTray();
    message(text);
  }
  function placePiece(index, x, y) {
    if (busy || state !== 'playing' || !tray[index]) return false;
    const shape = tray[index], next = R.place(board, shape, x, y);
    if (!next) {
      message('這裡有重疊或超出邊界，換個位置試試。', true);
      playNotes([180], .06);
      return false;
    }
    board = next; tray[index] = null; selected = null; preview = null; busy = true;
    const clearedRows = R.fullRows(board), oldLevel = level();
    const afterClear = R.clearRows(board, clearedRows);
    const allClear = clearedRows.length > 0 && afterClear.every(row => row.every(cell => !cell));
    const reward = R.rewards(shape.cells.length, clearedRows.length, oldLevel, allClear);
    addScore(reward.placement);
    renderBoard(); renderTray();
    playNotes([330, 440], .055);
    if (!clearedRows.length) {
      finishTurn('拼上了！+' + reward.placement + ' 分，接著選下一個圖形。');
      return true;
    }
    for (const yRow of clearedRows) {
      for (let xCol = 0; xCol < R.SIZE; xCol++) {
        const cell = cells[yRow * R.SIZE + xCol];
        cell.classList.add('clearing');
        const rect = cell.getBoundingClientRect();
        emit(rect.x + rect.width / 2, rect.y + rect.height / 2, 3, board[yRow][xCol], false);
      }
    }
    $('boardFrame').classList.remove('bump');
    void $('boardFrame').offsetWidth;
    $('boardFrame').classList.add('bump');
    playNotes([520, 660, 880], .11);
    later(() => {
      board = afterClear;
      lines += clearedRows.length;
      addScore(reward.lines + reward.bonus);
      renderBoard();
      let text = '消除 ' + clearedRows.length + ' 行！+' + reward.lines.toLocaleString() + ' 分。';
      if (level() > oldLevel) text += ' 升到第 ' + level() + ' 關！';
      if (allClear) {
        celebrate(reward.bonus);
        later(() => {
          $('celebration').hidden = true;
          finishTurn('全盤清空！額外 +' + reward.bonus.toLocaleString() + ' 分。' + (level() > oldLevel ? ' 現在是第 ' + level() + ' 關！' : '繼續拼出下一個高分。'));
        }, 2000);
      } else finishTurn(text);
    }, 320);
    return true;
  }

  function cancelGesture() {
    const active = gesture;
    gesture = null;
    if (active) {
      const button = trayEl.querySelector('[data-slot="' + active.slot + '"]');
      if (button) {
        button.classList.remove('dragging');
        if (button.hasPointerCapture(active.id)) button.releasePointerCapture(active.id);
      }
    }
    preview = null; ghost.hidden = true;
    paintPreview();
  }
  function startDrag(event) {
    gesture.dragging = true;
    selected = gesture.slot;
    const first = cells[0].getBoundingClientRect(), second = cells[1].getBoundingClientRect();
    gesture.pitch = second.left - first.left;
    gesture.cellSize = first.width;
    gesture.width = (gesture.shape.width - 1) * gesture.pitch + first.width;
    gesture.height = (gesture.shape.height - 1) * gesture.pitch + first.height;
    ghost.replaceChildren();
    ghost.style.width = gesture.width + 'px'; ghost.style.height = gesture.height + 'px';
    for (const cell of gesture.shape.cells) {
      const block = document.createElement('span');
      block.className = 'ghost-block';
      block.style.cssText = 'left:' + cell.x * gesture.pitch + 'px;top:' + cell.y * gesture.pitch + 'px;width:' + first.width + 'px;height:' + first.height + 'px;--block:' + gesture.shape.color;
      ghost.append(block);
    }
    trayEl.querySelector('[data-slot="' + gesture.slot + '"]').classList.add('dragging');
    ghost.hidden = false;
    updateDrag(event);
  }
  function updateDrag(event) {
    const rect = boardEl.getBoundingClientRect();
    const left = event.clientX - gesture.width / 2;
    const top = event.clientY - (gesture.touch ? gesture.height + 24 : gesture.height / 2);
    const x = Math.round((left - rect.left) / gesture.pitch), y = Math.round((top - rect.top) / gesture.pitch);
    const nearBoard = left + gesture.width > rect.left - gesture.pitch / 2 && left < rect.right + gesture.pitch / 2 && top + gesture.height > rect.top - gesture.pitch / 2 && top < rect.bottom + gesture.pitch / 2;
    preview = nearBoard ? { x, y } : null;
    const valid = preview && R.canPlace(board, gesture.shape, x, y);
    ghost.style.left = (valid ? rect.left + x * gesture.pitch : left) + 'px';
    ghost.style.top = (valid ? rect.top + y * gesture.pitch : top) + 'px';
    for (const block of ghost.children) block.classList.toggle('invalid', !valid);
    paintPreview();
  }
  trayEl.addEventListener('pointerdown', event => {
    const button = event.target.closest('[data-slot]');
    if (!button || button.disabled || gesture || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const index = Number(button.dataset.slot);
    if (!tray[index] || busy || state !== 'playing') return;
    event.preventDefault();
    gesture = { id: event.pointerId, slot: index, shape: tray[index], startX: event.clientX, startY: event.clientY, dragging: false, touch: event.pointerType !== 'mouse' };
    button.setPointerCapture(event.pointerId);
  });
  window.addEventListener('pointermove', event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    if (!gesture.dragging && Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) < 7) return;
    event.preventDefault();
    if (!gesture.dragging) startDrag(event);
    else updateDrag(event);
  }, { passive: false });
  window.addEventListener('pointerup', event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const index = gesture.slot, dragged = gesture.dragging;
    if (dragged) updateDrag(event);
    const target = preview;
    suppressClickUntil = performance.now() + 250;
    cancelGesture();
    if (!dragged) selectPiece(index);
    else if (target) {
      if (!placePiece(index, target.x, target.y)) renderTray();
    } else {
      selected = index; renderTray();
      message('圖形已退回，拖到棋盤上放下就可以了。');
    }
  });
  window.addEventListener('pointercancel', event => { if (gesture?.id === event.pointerId) cancelGesture(); });
  trayEl.addEventListener('lostpointercapture', event => { if (gesture?.id === event.pointerId) cancelGesture(); });
  trayEl.addEventListener('click', event => {
    if (performance.now() < suppressClickUntil) return;
    const button = event.target.closest('[data-slot]');
    if (button && !button.disabled) selectPiece(Number(button.dataset.slot));
  });

  for (let index = 0; index < R.SIZE * R.SIZE; index++) {
    const button = document.createElement('button');
    button.className = 'cell'; button.type = 'button';
    button.dataset.x = index % R.SIZE; button.dataset.y = Math.floor(index / R.SIZE);
    button.setAttribute('role', 'gridcell');
    button.setAttribute('aria-rowindex', Math.floor(index / R.SIZE) + 1);
    button.setAttribute('aria-colindex', index % R.SIZE + 1);
    boardEl.append(button); cells.push(button);
  }
  boardEl.addEventListener('click', event => {
    if (gesture || busy || state !== 'playing') return;
    const cell = event.target.closest('.cell');
    if (!cell) return;
    if (selected === null) { message('先點下方一個圖形，再點棋盤空格，或直接把圖形拖上來。'); return; }
    placePiece(selected, Number(cell.dataset.x), Number(cell.dataset.y));
  });
  boardEl.addEventListener('pointermove', event => {
    if (gesture || busy || selected === null || event.pointerType !== 'mouse') return;
    const cell = event.target.closest('.cell');
    if (cell) { preview = { x: Number(cell.dataset.x), y: Number(cell.dataset.y) }; paintPreview(); }
  });
  boardEl.addEventListener('pointerleave', () => { if (!gesture) { preview = null; paintPreview(); } });
  boardEl.addEventListener('focusin', event => {
    const cell = event.target.closest('.cell');
    if (!cell) return;
    focusedCell = Number(cell.dataset.y) * R.SIZE + Number(cell.dataset.x);
    cells.forEach((entry, index) => { entry.tabIndex = index === focusedCell ? 0 : -1; });
    if (selected !== null) { preview = { x: Number(cell.dataset.x), y: Number(cell.dataset.y) }; paintPreview(); }
  });
  boardEl.addEventListener('keydown', event => {
    const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -R.SIZE, ArrowDown: R.SIZE };
    if (!(event.key in offsets)) return;
    event.preventDefault();
    focusedCell = Math.min(R.SIZE * R.SIZE - 1, Math.max(0, focusedCell + offsets[event.key]));
    cells[focusedCell].focus({ preventScroll: true });
  });
  for (const element of [trayEl, boardEl]) {
    element.addEventListener('dblclick', event => event.preventDefault());
    element.addEventListener('contextmenu', event => event.preventDefault());
  }
  window.addEventListener('keydown', event => { if (event.key === 'Escape') { cancelGesture(); selected = null; renderTray(); } });

  function resizeEffects() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    effectCanvas.width = Math.round(window.innerWidth * dpr);
    effectCanvas.height = Math.round(window.innerHeight * dpr);
    effectCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function emit(x, y, amount, color, big) {
    if (reducedMotion.matches) return;
    for (let i = 0; i < amount; i++) {
      const angle = Math.random() * Math.PI * 2, speed = big ? 150 + Math.random() * 400 : 70 + Math.random() * 140;
      const duration = big ? 1.1 + Math.random() * 1.1 : .45 + Math.random() * .5;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - (big ? 180 : 50), life: duration, duration, color: color || colors[i % colors.length], size: big ? 4 + Math.random() * 6 : 3 + Math.random() * 3, angle, spin: (Math.random() - .5) * 12 });
    }
    if (!effectFrame) { effectLastTime = performance.now(); effectFrame = requestAnimationFrame(drawEffects); }
  }
  function drawEffects(now) {
    const dt = Math.max(0, Math.min(.05, (now - effectLastTime) / 1000));
    effectLastTime = now;
    effectCtx.clearRect(0, 0, innerWidth, innerHeight);
    particles = particles.filter(p => {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 230 * dt; p.angle += p.spin * dt;
      if (p.life <= 0) return false;
      effectCtx.save(); effectCtx.translate(p.x, p.y); effectCtx.rotate(p.angle);
      effectCtx.globalAlpha = Math.min(1, p.life / .35); effectCtx.fillStyle = p.color;
      effectCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * .65); effectCtx.restore();
      return true;
    });
    effectFrame = particles.length ? requestAnimationFrame(drawEffects) : 0;
  }
  function celebrate(bonus) {
    $('celebrationPoints').textContent = '額外 +' + bonus.toLocaleString() + ' 分';
    $('celebration').hidden = false;
    const rect = boardEl.getBoundingClientRect();
    emit(rect.left + rect.width / 2, Math.min(innerHeight * .55, rect.top + rect.height / 2), 180, null, true);
    playNotes([523, 659, 784, 1047, 1319], .18);
  }
  function playNotes(notes, duration) {
    if (!sound) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume().catch(() => {});
      notes.forEach((frequency, index) => {
        const start = audio.currentTime + index * duration * .65;
        const oscillator = audio.createOscillator(), gain = audio.createGain();
        oscillator.type = 'sine'; oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(.0001, start);
        gain.gain.exponentialRampToValueAtTime(.055, start + .01);
        gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
        oscillator.connect(gain); gain.connect(audio.destination);
        oscillator.start(start); oscillator.stop(start + duration);
      });
    } catch {}
  }
  function openDialog(mode, title, text, confirm) {
    cancelGesture(); dialogMode = mode;
    $('dialogTitle').textContent = title; $('dialogText').textContent = text;
    $('dialogConfirm').textContent = confirm;
    $('dialogCancel').hidden = mode === 'over' || mode === 'help';
    if (!dialog.open) dialog.showModal();
  }
  function newGame() {
    for (const id of timers) clearTimeout(id);
    timers.clear(); cancelGesture();
    $('celebration').hidden = true;
    $('boardFrame').classList.remove('bump');
    particles = []; selected = null; board = R.emptyBoard(); score = 0; lines = 0;
    busy = false; state = 'playing';
    if (dialog.open) dialog.close();
    deal(); renderStats(); renderBoard(); renderTray();
    message('拖一個圖形上來，從任何位置開始。');
  }
  $('newGameButton').addEventListener('click', () => {
    if (!score || state === 'over') newGame();
    else openDialog('restart', '重新開始這一局？', '目前得分 ' + score.toLocaleString() + ' 分。\n最高紀錄會保留，新一局從第 1 關開始。', '重新開始');
  });
  $('helpButton').addEventListener('click', () => openDialog('help', '慢慢拼，也能拿高分', '圖形不下落，方向也不會改變。\n拖曳到空格，或先選圖形再點棋盤放置。\n只消除橫行，上方方塊留在原處。\n每消除 5 行升一關；全盤清空再拿額外獎勵！', '知道了'));
  $('soundButton').addEventListener('click', () => {
    sound = !sound; $('soundButton').textContent = '♪ 音效：' + (sound ? '開' : '關');
    $('soundButton').setAttribute('aria-pressed', String(sound));
    if (sound) playNotes([440, 660], .12);
  });
  $('dialogCancel').addEventListener('click', () => dialog.close());
  $('dialogConfirm').addEventListener('click', () => { if (dialogMode === 'help') dialog.close(); else newGame(); });
  dialog.addEventListener('cancel', event => { if (state === 'over') event.preventDefault(); });
  window.addEventListener('resize', () => { cancelGesture(); resizeEffects(); if (!busy) renderTray(); });
  window.addEventListener('blur', cancelGesture);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelGesture(); });
  resizeEffects(); newGame();
})();
