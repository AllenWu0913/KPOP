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
