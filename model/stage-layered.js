const parts = {
  hairChoice: { label: '髮型', names: { '01': '紫夜長雙馬尾', '02': '莓紫俏麗短髮' } },
  outfitChoice: { label: '衣服', names: { '01': '桃紅星焰裝', '02': '青藍月光裝' } },
  socksChoice: { label: '襪子', names: { '01': '白紫星星襪', '02': '深色星紋襪' } },
  shoesChoice: { label: '鞋子', names: { '01': '桃紅厚底靴', '02': '青藍厚底靴' } }
};
const accessoryIds = ['hairAccessoryChoice', 'necklaceChoice', 'braceletChoice'];
const accessoryNames = { hairAccessoryChoice: '髮飾', necklaceChoice: '項鍊', braceletChoice: '手環' };
const storageKey = 'idol-stage-layered-look-v1';
const get = id => document.getElementById(id);
const defaults = { hairChoice: '01', outfitChoice: '01', socksChoice: '01', shoesChoice: '01', hairAccessoryChoice: true, necklaceChoice: true, braceletChoice: true };
let currentChoices = { ...defaults };
const wardrobe = [
  { key: 'hairChoice', label: '髮型', options: [
    { value: '01', name: '紫夜長雙馬尾', image: 'layers/hair-01-front.png' },
    { value: '02', name: '莓紫俏麗短髮', image: 'layers/hair-02-front.png' }
  ] },
  { key: 'outfitChoice', label: '衣服', options: [
    { value: '01', name: '桃紅星焰裝', image: 'layers/outfit-01.png' },
    { value: '02', name: '青藍月光裝', image: 'layers/outfit-02.png' }
  ] },
  { key: 'socksChoice', label: '襪子', options: [
    { value: '01', name: '白紫星星襪', image: 'layers/socks-01.png' },
    { value: '02', name: '深色星紋襪', image: 'layers/socks-02.png' }
  ] },
  { key: 'shoesChoice', label: '鞋子', options: [
    { value: '01', name: '桃紅厚底靴', image: 'layers/shoes-01.png' },
    { value: '02', name: '青藍厚底靴', image: 'layers/shoes-02.png' }
  ] },
  { key: 'hairAccessoryChoice', label: '髮飾', options: [
    { value: 'on', name: '星星蝴蝶結', image: 'layers/hair-accessory-01.png' },
    { value: 'off', name: '不戴髮飾', icon: '－' }
  ] },
  { key: 'necklaceChoice', label: '項鍊', options: [
    { value: 'on', name: '星芒項鍊', image: 'layers/necklace-01.png' },
    { value: 'off', name: '不戴項鍊', icon: '－' }
  ] },
  { key: 'braceletChoice', label: '手環', options: [
    { value: 'on', name: '星焰手環', image: 'layers/bracelet-01.png' },
    { value: 'off', name: '不戴手環', icon: '－' }
  ] }
];
let toastTimer;
let dragState = null;
let suppressNextClick = false;

function choices() {
  return { ...currentChoices };
}

function setChoices(next) {
  for (const [id, part] of Object.entries(parts)) {
    currentChoices[id] = Object.prototype.hasOwnProperty.call(part.names, next[id]) ? next[id] : defaults[id];
  }
  for (const id of accessoryIds) currentChoices[id] = typeof next[id] === 'boolean' ? next[id] : defaults[id];
  render();
}

function render() {
  const picked = choices();
  get('hairBack').src = `layers/hair-${picked.hairChoice}-back.png`;
  get('hairFront').src = `layers/hair-${picked.hairChoice}-front.png`;
  get('outfitLayer').src = `layers/outfit-${picked.outfitChoice}.png`;
  get('socksLayer').src = `layers/socks-${picked.socksChoice}.png`;
  get('shoesLayer').src = `layers/shoes-${picked.shoesChoice}.png`;
  get('hairAccessoryLayer').hidden = !picked.hairAccessoryChoice;
  get('necklaceLayer').hidden = !picked.necklaceChoice;
  get('braceletLayer').hidden = !picked.braceletChoice;
  get('lookName').textContent = picked.outfitChoice === '01' ? '星焰偶像' : '月光偶像';
  get('lookSubtitle').textContent = `${parts.hairChoice.names[picked.hairChoice]} · ${parts.outfitChoice.names[picked.outfitChoice]}`;
  get('doll').setAttribute('aria-label', `獵魔偶像：${Object.entries(parts).map(([id, part]) => part.names[picked[id]]).join('、')}；${accessoryIds.filter(id => picked[id]).map(id => accessoryNames[id]).join('、') || '不戴飾品'}`);
  const details = get('lookDetails');
  details.replaceChildren();
  for (const [id, part] of Object.entries(parts)) {
    const chip = document.createElement('span');
    chip.textContent = `${part.label}：${part.names[picked[id]]}`;
    details.append(chip);
  }
  for (const id of accessoryIds) {
    const chip = document.createElement('span');
    chip.textContent = picked[id] ? accessoryNames[id] : `無${accessoryNames[id]}`;
    details.append(chip);
  }
  document.querySelectorAll('.wardrobe-option').forEach(card => {
    const selected = accessoryIds.includes(card.dataset.key)
      ? (card.dataset.value === 'on') === picked[card.dataset.key]
      : card.dataset.value === picked[card.dataset.key];
    card.setAttribute('aria-pressed', String(selected));
  });
  get('saveStatus').textContent = '尚未儲存目前造型';
}

function buildWardrobe() {
  const grid = get('wardrobeGrid');
  for (const category of wardrobe) {
    const section = document.createElement('section');
    section.className = 'wardrobe-category';
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
      card.setAttribute('aria-label', `${category.label}：${option.name}，可拖曳到角色身上`);
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
    section.append(title, options);
    grid.append(section);
  }
}

function applyOption(key, value) {
  if (accessoryIds.includes(key)) currentChoices[key] = value === 'on';
  else currentChoices[key] = value;
  render();
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
    if (target?.closest('.stage')) {
      applyOption(active.card.dataset.key, active.card.dataset.value);
      toast(`已替換${wardrobe.find(category => category.key === active.card.dataset.key).label}！`);
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
  if (card) applyOption(card.dataset.key, card.dataset.value);
});
get('wardrobeGrid').addEventListener('pointerdown', event => {
  const card = event.target.closest('.wardrobe-option');
  if (!card || (event.pointerType === 'mouse' && event.button !== 0)) return;
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
  const random = Object.fromEntries(Object.keys(parts).map(id => [id, Math.random() < .5 ? '01' : '02']));
  for (const id of accessoryIds) random[id] = Math.random() < .5;
  setChoices(random);
  toast('新造型登場！');
});
get('resetLook').addEventListener('click', () => {
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
