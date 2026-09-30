const parts = {
  hairChoice: { label: '髮型', names: { '01': '紫夜長雙馬尾', '02': '莓紫俏麗短髮' } },
  outfitChoice: { label: '衣服', names: { '01': '桃紅星焰裝', '02': '青藍月光裝' } },
  socksChoice: { label: '襪子', names: { '01': '白紫星星襪', '02': '深色星紋襪', '03': '透膚星芒長襪' } },
  shoesChoice: { label: '鞋子', names: { '01': '桃紅厚底靴', '02': '青藍厚底靴', '03': '霓虹星芒高跟鞋' } }
};
const accessoryIds = ['hairAccessoryChoice', 'necklaceChoice', 'braceletChoice'];
const accessoryLabels = { hairAccessoryChoice: '髮飾', necklaceChoice: '項鍊', braceletChoice: '手環' };
const accessoryOptions = {
  hairAccessoryChoice: { '01': '星星蝴蝶結', '02': '月光彎月髮夾', '00': '不戴髮飾' },
  necklaceChoice: { '01': '星芒項鍊', '02': '月光銀鏈', '00': '不戴項鍊' },
  braceletChoice: { '01': '星焰手環', '02': '青藍星石手環', '00': '不戴手環' }
};
const accessoryFiles = {
  hairAccessoryChoice: ['hair-accessory', 'hairAccessoryLayer'],
  necklaceChoice: ['necklace', 'necklaceLayer'],
  braceletChoice: ['bracelet', 'braceletLayer']
};
const storageKey = 'idol-stage-layered-look-v1';
const get = id => document.getElementById(id);
const defaults = {
  hairChoice: '01', outfitChoice: '01', socksChoice: '01', shoesChoice: '01',
  hairAccessoryChoice: '01', necklaceChoice: '01', braceletChoice: '01'
};
const bootSocks = ['01', '02'];
let currentChoices = { ...defaults };
let lastBootSocksChoice = '01';
const wardrobe = [
  { key: 'hairChoice', label: '髮型', options: [
    { value: '01', name: '紫夜長雙馬尾', image: 'layers/hair-01-front.png' },
    { value: '02', name: '莓紫俏麗短髮', image: 'layers/hair-02-front.png' }
  ] },
  { key: 'outfitChoice', label: '衣服', options: [
    { value: '01', name: '桃紅星焰裝', image: 'layers/outfit-01.png' },
    { value: '02', name: '青藍月光裝', image: 'layers/outfit-02.png' }
  ] },
  { key: 'socksChoice', label: '襪子', note: '高跟鞋會自動搭配透膚襪', options: [
    { value: '01', name: '白紫星星襪', image: 'layers/socks-01.png' },
    { value: '02', name: '深色星紋襪', image: 'layers/socks-02.png' },
    { value: '03', name: '透膚星芒長襪', image: 'layers/socks-03.png' }
  ] },
  { key: 'shoesChoice', label: '鞋子', options: [
    { value: '01', name: '桃紅厚底靴', image: 'layers/shoes-01.png' },
    { value: '02', name: '青藍厚底靴', image: 'layers/shoes-02.png' },
    { value: '03', name: '霓虹星芒高跟鞋', image: 'layers/shoes-03.png' }
  ] },
  { key: 'hairAccessoryChoice', label: '髮飾', options: [
    { value: '01', name: '星星蝴蝶結', image: 'layers/hair-accessory-01.png' },
    { value: '02', name: '月光彎月髮夾', image: 'layers/hair-accessory-02.png' },
    { value: '00', name: '不戴髮飾', icon: '－' }
  ] },
  { key: 'necklaceChoice', label: '項鍊', options: [
    { value: '01', name: '星芒項鍊', image: 'layers/necklace-01.png' },
    { value: '02', name: '月光銀鏈', image: 'layers/necklace-02.png' },
    { value: '00', name: '不戴項鍊', icon: '－' }
  ] },
  { key: 'braceletChoice', label: '手環', options: [
    { value: '01', name: '星焰手環', image: 'layers/bracelet-01.png' },
    { value: '02', name: '青藍星石手環', image: 'layers/bracelet-02.png' },
    { value: '00', name: '不戴手環', icon: '－' }
  ] }
];
let toastTimer;
let dragState = null;
let suppressNextClick = false;

function choices() {
  return { ...currentChoices, bootSocksChoice: lastBootSocksChoice };
}

function normalizeAccessory(id, value) {
  if (typeof value === 'boolean') return value ? '01' : '00';
  return Object.prototype.hasOwnProperty.call(accessoryOptions[id], value) ? value : defaults[id];
}

function setChoices(next) {
  for (const [id, part] of Object.entries(parts)) {
    currentChoices[id] = Object.prototype.hasOwnProperty.call(part.names, next[id]) ? next[id] : defaults[id];
  }
  for (const id of accessoryIds) currentChoices[id] = normalizeAccessory(id, next[id]);
  const savedBootSock = bootSocks.includes(next.bootSocksChoice) ? next.bootSocksChoice : null;
  const chosenSock = next.socksChoice;
  if (currentChoices.shoesChoice === '03') {
    lastBootSocksChoice = savedBootSock || (bootSocks.includes(chosenSock) ? chosenSock : '01');
    currentChoices.socksChoice = '03';
  } else {
    currentChoices.socksChoice = bootSocks.includes(chosenSock) ? chosenSock : (savedBootSock || '01');
    lastBootSocksChoice = currentChoices.socksChoice;
  }
  render();
}

function render() {
  const picked = choices();
  get('hairBack').src = `layers/hair-${picked.hairChoice}-back.png`;
  get('hairFront').src = `layers/hair-${picked.hairChoice}-front.png`;
  get('outfitLayer').src = `layers/outfit-${picked.outfitChoice}.png`;
  get('socksLayer').src = `layers/socks-${picked.socksChoice}.png`;
  get('shoesLayer').src = `layers/shoes-${picked.shoesChoice}.png`;
  for (const id of accessoryIds) {
    const [filePrefix, layerId] = accessoryFiles[id];
    const layer = get(layerId);
    layer.hidden = picked[id] === '00';
    if (!layer.hidden) layer.src = `layers/${filePrefix}-${picked[id]}.png`;
  }
  get('lookName').textContent = picked.outfitChoice === '01' ? '星焰偶像' : '月光偶像';
  get('lookSubtitle').textContent = `${parts.hairChoice.names[picked.hairChoice]} · ${parts.outfitChoice.names[picked.outfitChoice]}`;
  const chosenAccessories = accessoryIds.filter(id => picked[id] !== '00').map(id => accessoryLabels[id]);
  get('doll').setAttribute('aria-label', `獵魔偶像：${Object.entries(parts).map(([id, part]) => part.names[picked[id]]).join('、')}；${chosenAccessories.join('、') || '不戴飾品'}`);
  const details = get('lookDetails');
  details.replaceChildren();
  for (const [id, part] of Object.entries(parts)) {
    const chip = document.createElement('span');
    chip.textContent = `${part.label}：${part.names[picked[id]]}`;
    details.append(chip);
  }
  for (const id of accessoryIds) {
    const chip = document.createElement('span');
    chip.textContent = picked[id] === '00' ? `無${accessoryLabels[id]}` : accessoryOptions[id][picked[id]];
    details.append(chip);
  }
  document.querySelectorAll('.wardrobe-option').forEach(card => {
    const key = card.dataset.key;
    const value = card.dataset.value;
    const selected = value === picked[key];
    const incompatibleSock = key === 'socksChoice' && (picked.shoesChoice === '03' ? value !== '03' : value === '03');
    card.disabled = incompatibleSock;
    card.setAttribute('aria-pressed', String(selected));
    card.setAttribute('aria-label', incompatibleSock
      ? `${card.querySelector('strong').textContent}目前不適用；${picked.shoesChoice === '03' ? '高跟鞋搭配透膚襪' : '透膚襪需搭配高跟鞋'}`
      : `${card.querySelector('strong').textContent}，可拖曳到角色身上`);
    const hint = card.querySelector('small');
    hint.textContent = incompatibleSock
      ? (picked.shoesChoice === '03' ? '高跟鞋請搭透膚襪' : '搭配高跟鞋使用')
      : '拖曳或輕點';
  });
  const sockNote = document.querySelector('[data-key="socksChoice"] .category-note');
  if (sockNote) sockNote.textContent = picked.shoesChoice === '03'
    ? '已配合高跟鞋自動換成透膚襪'
    : '透膚襪只搭配高跟鞋；換回靴子會恢復原襪款';
  get('saveStatus').textContent = '尚未儲存目前造型';
}

function buildWardrobe() {
  const grid = get('wardrobeGrid');
  for (const category of wardrobe) {
    const section = document.createElement('section');
    section.className = 'wardrobe-category';
    section.dataset.key = category.key;
    const title = document.createElement('h2');
    title.textContent = category.label;
    const options = document.createElement('div');
    options.className = 'wardrobe-options';
    options.setAttribute('role', 'group');
    options.setAttribute('aria-label', `${category.label}選項`);
    for (const option of category.options) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'wardrobe-option';
      card.dataset.key = category.key;
      card.dataset.value = option.value;
      card.setAttribute('aria-pressed', 'false');
      const thumb = document.createElement('span');
      thumb.className = 'option-thumb';
      if (option.image) {
        const image = document.createElement('img');
        image.src = option.image;
        image.alt = '';
        image.draggable = false;
        image.loading = 'lazy';
        thumb.append(image);
      } else {
        thumb.classList.add('option-empty');
        thumb.textContent = option.icon;
      }
      const copy = document.createElement('span');
      copy.className = 'option-copy';
      const name = document.createElement('strong');
      name.textContent = option.name;
      const hint = document.createElement('small');
      hint.textContent = '拖曳或輕點';
      copy.append(name, hint);
      card.append(thumb, copy);
      options.append(card);
    }
    section.append(title);
    if (category.note) {
      const note = document.createElement('p');
      note.className = 'category-note';
      note.textContent = category.note;
      section.append(note);
    }
    section.append(options);
    grid.append(section);
  }
}

function applyOption(key, value) {
  if (key === 'shoesChoice') {
    if (value === '03') {
      if (currentChoices.shoesChoice !== '03' && bootSocks.includes(currentChoices.socksChoice)) {
        lastBootSocksChoice = currentChoices.socksChoice;
      }
      currentChoices.shoesChoice = '03';
      currentChoices.socksChoice = '03';
    } else {
      currentChoices.shoesChoice = value;
      if (currentChoices.socksChoice === '03') currentChoices.socksChoice = lastBootSocksChoice;
    }
  } else if (key === 'socksChoice') {
    if ((currentChoices.shoesChoice === '03' && value !== '03') || (currentChoices.shoesChoice !== '03' && value === '03')) return false;
    currentChoices.socksChoice = value;
    if (bootSocks.includes(value)) lastBootSocksChoice = value;
  } else {
    currentChoices[key] = value;
  }
  render();
  return true;
}

function toast(message) {
  const element = get('toast');
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('show'), 2400);
}

function clearDrag() {
  if (!dragState) return;
  get('stageDrop').classList.remove('drag-target');
  dragState.ghost?.remove();
  if (dragState.dragging) {
    suppressNextClick = true;
    setTimeout(() => { suppressNextClick = false; }, 0);
  }
  dragState = null;
}

function beginDrag(event, card) {
  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  ghost.setAttribute('aria-hidden', 'true');
  ghost.append(card.querySelector('.option-thumb').cloneNode(true), card.querySelector('.option-copy').cloneNode(true));
  document.body.append(ghost);
  dragState.dragging = true;
  dragState.ghost = ghost;
  document.body.classList.add('is-dragging');
  moveGhost(event);
}

function moveGhost(event) {
  if (!dragState?.dragging) return;
  dragState.ghost.style.left = `${event.clientX}px`;
  dragState.ghost.style.top = `${event.clientY}px`;
  const target = document.elementFromPoint(event.clientX, event.clientY);
  get('stageDrop').classList.toggle('drag-target', Boolean(target?.closest('.stage')));
}

function finishDrag(event, cancelled = false) {
  if (!dragState) return;
  const active = dragState;
  if (active.dragging && !cancelled) {
    const target = document.elementFromPoint(event.clientX, event.clientY);
    if (target?.closest('.stage') && applyOption(active.card.dataset.key, active.card.dataset.value)) {
      const category = wardrobe.find(item => item.key === active.card.dataset.key);
      toast(`已替換${category.label}！`);
    }
  }
  document.body.classList.remove('is-dragging');
  clearDrag();
}

buildWardrobe();
get('wardrobeGrid').addEventListener('click', event => {
  if (suppressNextClick) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  const card = event.target.closest('.wardrobe-option');
  if (!card || card.disabled) return;
  applyOption(card.dataset.key, card.dataset.value);
});
get('wardrobeGrid').addEventListener('pointerdown', event => {
  const card = event.target.closest('.wardrobe-option');
  if (!card || card.disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
  dragState = { card, startX: event.clientX, startY: event.clientY, pointerId: event.pointerId, dragging: false, ghost: null };
});
window.addEventListener('pointermove', event => {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  if (!dragState.dragging && Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY) < 8) return;
  if (!dragState.dragging) beginDrag(event, dragState.card);
  event.preventDefault();
  moveGhost(event);
}, { passive: false });
window.addEventListener('pointerup', event => {
  if (dragState?.pointerId === event.pointerId) finishDrag(event);
});
window.addEventListener('pointercancel', event => {
  if (dragState?.pointerId === event.pointerId) finishDrag(event, true);
});
get('randomLook').addEventListener('click', () => {
  const shoesChoice = ['01', '02', '03'][Math.floor(Math.random() * 3)];
  const bootSocksChoice = bootSocks[Math.floor(Math.random() * bootSocks.length)];
  const random = {
    hairChoice: Math.random() < .5 ? '01' : '02',
    outfitChoice: Math.random() < .5 ? '01' : '02',
    shoesChoice,
    socksChoice: shoesChoice === '03' ? '03' : bootSocksChoice,
    bootSocksChoice,
    hairAccessoryChoice: ['01', '02', '00'][Math.floor(Math.random() * 3)],
    necklaceChoice: ['01', '02', '00'][Math.floor(Math.random() * 3)],
    braceletChoice: ['01', '02', '00'][Math.floor(Math.random() * 3)]
  };
  setChoices(random);
  toast('新造型登場！');
});
get('resetLook').addEventListener('click', () => {
  lastBootSocksChoice = defaults.socksChoice;
  setChoices(defaults);
  toast('已恢復預設造型');
});
get('saveLook').addEventListener('click', () => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(choices()));
    get('saveStatus').textContent = '已儲存在這台裝置';
    toast('造型已儲存！');
  } catch {
    toast('無法儲存，請檢查瀏覽器設定');
  }
});

let saved = null;
try { saved = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch {}
setChoices(saved && typeof saved === 'object' ? saved : defaults);
if (saved && typeof saved === 'object') get('saveStatus').textContent = '已載入儲存造型';

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
const albumKey = 'idol-stage-lookbook-v1';
const creativeKey = 'idol-stage-creative-v1';
const questKey = 'idol-stage-quest-v1';
const albumLimit = 24;
const scenes = ['moon', 'dream', 'forest'];
const stickerChoices = ['✦', '♫', '☾', ''];
const lights = ['rose', 'cyan', 'starlight'];
const questCards = [
  { id: 'moonlight', title: '月光演唱會', description: '青藍月光裝配上月光飾品，準備閃亮登台。', goals: [
    { label: '穿上青藍月光裝', test: c => c.outfitChoice === '02' },
    { label: '戴月光髮夾或銀鏈', test: c => c.hairAccessoryChoice === '02' || c.necklaceChoice === '02' },
    { label: '選青藍厚底靴或高跟鞋', test: c => c.shoesChoice === '02' || c.shoesChoice === '03' }
  ] },
  { id: 'star-flame', title: '星焰首場演出', description: '用桃紅星焰裝和星星配件點亮第一場舞台。', goals: [
    { label: '穿上桃紅星焰裝', test: c => c.outfitChoice === '01' },
    { label: '戴星星蝴蝶結或星焰手環', test: c => c.hairAccessoryChoice === '01' || c.braceletChoice === '01' },
    { label: '穿上桃紅厚底靴', test: c => c.shoesChoice === '01' }
  ] },
  { id: 'night-patrol', title: '夜色巡演任務', description: '換上俏麗髮型，穿好高跟鞋與透膚襪出發。', goals: [
    { label: '換成莓紫俏麗短髮', test: c => c.hairChoice === '02' },
    { label: '搭配霓虹星芒高跟鞋', test: c => c.shoesChoice === '03' },
    { label: '穿上高跟鞋專屬透膚襪', test: c => c.socksChoice === '03' }
  ] },
  { id: 'neon-remix', title: '霓虹混搭派對', description: '試試青藍衣裝和星石手環，再加一點自己的創意。', goals: [
    { label: '穿上青藍月光裝', test: c => c.outfitChoice === '02' },
    { label: '戴上青藍星石手環', test: c => c.braceletChoice === '02' },
    { label: '選擇一款高跟鞋', test: c => c.shoesChoice === '03' }
  ] },
  { id: 'wish-upon-star', title: '星星許願舞台', description: '把星芒項鍊和你最喜歡的造型放在一起。', goals: [
    { label: '戴上星芒項鍊', test: c => c.necklaceChoice === '01' },
    { label: '使用長雙馬尾', test: c => c.hairChoice === '01' },
    { label: '選月光屋頂或魔法森林', test: c => currentScene === 'moon' || currentScene === 'forest' }
  ] },
  { id: 'grand-finale', title: '最後安可舞台', description: '自由設計造型，挑背景和貼紙完成安可演出。', goals: [
    { label: '搭配兩件或以上配飾', test: c => accessoryIds.filter(id => c[id] !== '00').length >= 2 },
    { label: '選擇音符拍照貼紙', test: c => currentSticker === '♫' },
    { label: '把舞台換成星雲背景', test: c => currentScene === 'dream' }
  ] }
];
function readStored(key, fallback) {
  try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return value == null ? fallback : value; }
  catch { return fallback; }
}
const savedCreative = readStored(creativeKey, {});
const savedQuest = readStored(questKey, {});
const storedAlbum = readStored(albumKey, []);
let album = (Array.isArray(storedAlbum) ? storedAlbum : []).filter(item => item && typeof item === 'object' && item.choices).slice(0, albumLimit);
let currentScene = scenes.includes(savedCreative.scene) ? savedCreative.scene : 'moon';
let currentSticker = stickerChoices.includes(savedCreative.sticker) ? savedCreative.sticker : '✦';
let currentLight = lights.includes(savedCreative.light) ? savedCreative.light : 'rose';
let currentQuestId = questCards.some(card => card.id === savedQuest.current) ? savedQuest.current : 'moonlight';
let completedQuests = new Set((Array.isArray(savedQuest.completed) ? savedQuest.completed : []).filter(id => questCards.some(card => card.id === id)));
let performanceTimer = 0;
let pulseTimer = 0;
let beatIndex = 0;
let beatHits = 0;
let beatActive = false;

function persistCreative() {
  try { localStorage.setItem(creativeKey, JSON.stringify({ scene: currentScene, sticker: currentSticker, light: currentLight })); } catch {}
}
function persistQuest() {
  try { localStorage.setItem(questKey, JSON.stringify({ current: currentQuestId, completed: Array.from(completedQuests) })); } catch {}
}
function setScene(scene) {
  currentScene = scenes.includes(scene) ? scene : 'moon';
  get('stageDrop').dataset.scene = currentScene;
  get('performanceScene').dataset.scene = currentScene;
  get('savePreview').dataset.scene = currentScene;
  document.querySelectorAll('#sceneChoices button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.scene === currentScene)));
  persistCreative();
}
function setSticker(sticker) {
  currentSticker = stickerChoices.includes(sticker) ? sticker : '';
  get('performanceSticker').textContent = currentSticker;
  const stageSticker = get('stageSticker');
  if (stageSticker) { stageSticker.textContent = currentSticker; stageSticker.hidden = !currentSticker; }
  document.querySelectorAll('#stickerChoices button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.sticker === currentSticker)));
  persistCreative();
}
function setLight(light) {
  currentLight = lights.includes(light) ? light : 'rose';
  for (const id of ['stageDrop', 'performanceScene', 'savePreview']) get(id).dataset.light = currentLight;
  document.querySelectorAll('#lightChoices button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.light === currentLight)));
  persistCreative();
}
function createAvatar(container, look) {
  container.replaceChildren();
  const avatar = container.classList.contains('performance-avatar') ? container : document.createElement('div');
  if (avatar !== container) { avatar.className = 'performance-avatar'; container.append(avatar); }
  const hair = look.hairChoice || '01';
  const layers = [
    'layers/hair-' + hair + '-back.png',
    'layers/base.png',
    'layers/socks-' + (look.socksChoice || '01') + '.png',
    'layers/shoes-' + (look.shoesChoice || '01') + '.png',
    'layers/outfit-' + (look.outfitChoice || '01') + '.png',
    look.necklaceChoice === '00' ? '' : 'layers/necklace-' + (look.necklaceChoice || '01') + '.png',
    look.braceletChoice === '00' ? '' : 'layers/bracelet-' + (look.braceletChoice || '01') + '.png',
    'layers/hair-' + hair + '-front.png',
    look.hairAccessoryChoice === '00' ? '' : 'layers/hair-accessory-' + (look.hairAccessoryChoice || '01') + '.png'
  ];
  for (const src of layers) {
    if (!src) continue;
    const image = document.createElement('img');
    image.src = src; image.alt = ''; image.setAttribute('aria-hidden', 'true'); image.draggable = false;
    avatar.append(image);
  }
}
function selectedQuest() { return questCards.find(card => card.id === currentQuestId) || questCards[0]; }
function renderQuest() {
  const quest = selectedQuest();
  const picked = choices();
  get('questTitle').textContent = quest.title;
  get('questDescription').textContent = quest.description;
  const goals = get('questGoals');
  goals.replaceChildren();
  let matches = 0;
  for (const goal of quest.goals) {
    const done = goal.test(picked);
    if (done) matches++;
    const row = document.createElement('div');
    row.className = 'quest-goal' + (done ? ' done' : '');
    const mark = document.createElement('span');
    mark.className = 'quest-goal-mark'; mark.setAttribute('aria-hidden', 'true'); mark.textContent = done ? '✓' : '·';
    const text = document.createElement('span'); text.textContent = goal.label;
    row.append(mark, text); goals.append(row);
  }
  const alreadyDone = completedQuests.has(quest.id);
  get('questProgress').textContent = '靈感 ' + matches + '/3 · 任務紀錄 ' + completedQuests.size + '/6' + (alreadyDone ? ' · 已完成過' : '');
  return { quest, matches };
}
function chooseQuest() {
  const others = questCards.filter(card => card.id !== currentQuestId);
  currentQuestId = others[Math.floor(Math.random() * others.length)].id;
  persistQuest(); renderQuest();
}
function syncStageSticker() {
  let stageSticker = get('stageSticker');
  if (!stageSticker) {
    stageSticker = document.createElement('span');
    stageSticker.id = 'stageSticker'; stageSticker.className = 'stage-selected-sticker'; stageSticker.setAttribute('aria-hidden', 'true');
    get('stageDrop').insertBefore(stageSticker, document.querySelector('.stage-vignette'));
  }
  stageSticker.textContent = currentSticker; stageSticker.hidden = !currentSticker;
}
function refreshCreativeUI() {
  get('stageDrop').dataset.scene = currentScene;
  get('performanceScene').dataset.scene = currentScene;
  get('savePreview').dataset.scene = currentScene;
  get('performanceSticker').textContent = currentSticker;
  for (const id of ['stageDrop', 'performanceScene', 'savePreview']) get(id).dataset.light = currentLight;
  syncStageSticker();
  document.querySelectorAll('#sceneChoices button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.scene === currentScene)));
  document.querySelectorAll('#stickerChoices button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.sticker === currentSticker)));
}
  document.querySelectorAll('#lightChoices button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.light === currentLight)));
function updateAlbumCount() { get('albumCount').textContent = album.length + '/' + albumLimit; }
function openSaveDialog() {
  if (album.length >= albumLimit) { toast('造型冊已滿，先刪除一套收藏再加入新造型。'); return; }
  createAvatar(get('savePreview'), choices());
  get('savePreview').dataset.scene = currentScene;
  get('lookTitleInput').value = '';
  get('saveDialog').showModal();
  get('lookTitleInput').focus();
}
function renderAlbum() {
  const grid = get('albumGrid');
  grid.replaceChildren();
  get('albumEmpty').hidden = album.length > 0;
  for (const look of album) {
    const card = document.createElement('article'); card.className = 'album-card';
    const preview = document.createElement('div'); preview.className = 'album-preview'; preview.dataset.scene = scenes.includes(look.scene) ? look.scene : 'moon'; preview.dataset.light = lights.includes(look.light) ? look.light : 'rose';
    createAvatar(preview, look.choices);
    const sticker = document.createElement('span'); sticker.className = 'photo-sticker'; sticker.textContent = stickerChoices.includes(look.sticker) ? look.sticker : ''; preview.append(sticker);
    const copy = document.createElement('div'); copy.className = 'album-card-copy';
    const title = document.createElement('strong'); title.textContent = look.name || '我的舞台造型';
    const date = document.createElement('small'); date.textContent = look.created ? new Date(look.created).toLocaleDateString() : '收藏造型'; copy.append(title, date);
    const actions = document.createElement('div'); actions.className = 'album-card-actions';
    const wear = document.createElement('button'); wear.type = 'button'; wear.dataset.albumAction = 'wear'; wear.dataset.id = String(look.id); wear.textContent = '穿上這套';
    const remove = document.createElement('button'); remove.type = 'button'; remove.dataset.albumAction = 'remove'; remove.dataset.id = String(look.id); remove.textContent = '刪除';
    actions.append(wear, remove); card.append(preview, copy, actions); grid.append(card);
  }
  updateAlbumCount();
}
function persistAlbum() {
  try { localStorage.setItem(albumKey, JSON.stringify(album)); return true; }
  catch { toast('裝置儲存空間不足，請刪除幾套造型再試。'); return false; }
}
function saveLookToAlbum(event) {
  event.preventDefault();
  if (album.length >= albumLimit) { get('saveDialog').close(); toast('造型冊已滿，先刪除一套收藏再加入新造型。'); return; }
  const name = get('lookTitleInput').value.trim().slice(0, 24) || '舞台造型 ' + (album.length + 1);
  const before = album;
  album = [{ id: String(Date.now()) + '-' + Math.random().toString(36).slice(2, 7), name, choices: choices(), scene: currentScene, sticker: currentSticker, light: currentLight, created: Date.now() }, ...album].slice(0, albumLimit);
  if (!persistAlbum()) { album = before; return; }
  try { localStorage.setItem(storageKey, JSON.stringify(choices())); } catch {}
  get('saveDialog').close(); get('saveStatus').textContent = '造型冊已收藏 ' + album.length + '/' + albumLimit + ' 套';
  renderAlbum(); toast('已收藏到造型冊！');
}
function startPerformance() {
  const dialog = get('performanceDialog');
  if (dialog.open) return;
  createAvatar(get('performanceAvatar'), choices());
  get('performanceScene').dataset.scene = currentScene; get('performanceScene').dataset.light = currentLight; get('performanceSticker').textContent = currentSticker;
  beatIndex = 0; beatHits = 0; beatActive = false;
  get('beatButton').disabled = true; get('beatButton').classList.remove('beat-ready'); get('beatBar').style.width = '0%';
  get('beatClock').textContent = '準備開始！'; get('beatScore').textContent = '點亮 0 顆星星';
  get('performanceResult').hidden = true; get('skipPerformance').hidden = false;
  get('beatButton').hidden = false; get('performanceInstruction').hidden = false;
  dialog.showModal(); performanceTimer = setTimeout(nextBeat, 500);
}
function nextBeat() {
  if (beatIndex >= 16) { finishPerformance(false); return; }
  beatIndex++; beatActive = true;
  const button = get('beatButton'); button.disabled = false; button.classList.add('beat-ready');
  get('beatClock').textContent = '第 ' + beatIndex + '/16 拍 · ' + Math.max(0, Math.ceil((16 - beatIndex) * 1.2)) + ' 秒';
  get('beatBar').style.width = Math.round(beatIndex / 16 * 100) + '%';
  pulseTimer = setTimeout(() => {
    if (beatActive) { beatActive = false; button.disabled = true; button.classList.remove('beat-ready'); }
  }, 700);
  performanceTimer = setTimeout(nextBeat, 1200);
}
function tapBeat() {
  if (!beatActive) return;
  beatActive = false; beatHits++;
  get('beatButton').disabled = true; get('beatButton').classList.remove('beat-ready');
  get('beatScore').textContent = '點亮 ' + beatHits + ' 顆星星';
  get('performanceScene').classList.add('stage-pop');
  setTimeout(() => get('performanceScene').classList.remove('stage-pop'), 180);
}
function finishPerformance(skipped) {
  clearTimeout(performanceTimer); clearTimeout(pulseTimer); beatActive = false;
  get('beatButton').disabled = true; get('beatButton').classList.remove('beat-ready');
  get('skipPerformance').hidden = true; get('beatButton').hidden = true; get('performanceInstruction').hidden = true;
  get('beatBar').style.width = '100%';
  const result = renderQuest();
  if (result.matches >= 2) {
    completedQuests.add(result.quest.id); persistQuest(); renderQuest();
    get('resultTitle').textContent = '任務完成！';
    get('resultMessage').textContent = '你完成了「' + result.quest.title + '」的造型靈感，還在表演中點亮 ' + beatHits + ' 顆星星！';
  } else {
    get('resultTitle').textContent = '演出完成！';
    get('resultMessage').textContent = skipped
      ? '「' + result.quest.title + '」的舞台已準備好，想換造型時可以再來玩。'
      : '你在舞台上點亮了 ' + beatHits + ' 顆星星！也可以試試任務卡上的造型靈感。';
  }
  get('performanceResult').hidden = false;
}
function stopPerformance() {
  clearTimeout(performanceTimer); clearTimeout(pulseTimer); beatActive = false;
}
function useAlbumLook(id, action) {
  const item = album.find(look => String(look.id) === id);
  if (!item) return;
  if (action === 'remove') {
    album = album.filter(look => String(look.id) !== id);
    if (persistAlbum()) { renderAlbum(); toast('已從造型冊移除。'); }
    return;
  }
  setChoices(item.choices); setScene(item.scene); setSticker(item.sticker); setLight(item.light);
  get('albumDialog').close(); toast('已穿上收藏造型！');
}

const originalRender = render;
render = function () { originalRender(); renderQuest(); refreshCreativeUI(); };
get('drawQuest').addEventListener('click', chooseQuest);
get('performQuest').addEventListener('click', startPerformance);
get('beatButton').addEventListener('click', tapBeat);
get('skipPerformance').addEventListener('click', () => finishPerformance(true));
get('savePerformanceLook').addEventListener('click', openSaveDialog);
get('saveLook').addEventListener('click', event => { event.stopImmediatePropagation(); openSaveDialog(); }, true);
get('openAlbum').addEventListener('click', () => { renderAlbum(); get('albumDialog').showModal(); });
get('sceneChoices').addEventListener('click', event => { const button = event.target.closest('[data-scene]'); if (button) setScene(button.dataset.scene); });
get('stickerChoices').addEventListener('click', event => { const button = event.target.closest('[data-sticker]'); if (button) setSticker(button.dataset.sticker); });
get('saveLookForm').addEventListener('submit', saveLookToAlbum);
get('albumGrid').addEventListener('click', event => { const button = event.target.closest('[data-album-action]'); if (button) useAlbumLook(button.dataset.id, button.dataset.albumAction); });
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => get(button.dataset.close).close()));
get('performanceDialog').addEventListener('close', stopPerformance);
get('lightChoices').addEventListener('click', event => { const button = event.target.closest('[data-light]'); if (button) setLight(button.dataset.light); });
setScene(currentScene); setSticker(currentSticker); setLight(currentLight); renderQuest(); renderAlbum(); refreshCreativeUI();
