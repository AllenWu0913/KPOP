const looks = [
  {id:'original', name:'星焰主唱', subtitle:'桃紅 × 青藍・雙馬尾', image:'idol-stage-original.png', tag:'STAR FIRE', description:'深紫雙馬尾・桃紅飛行外套・短裙與厚底靴', details:['深紫雙馬尾','桃紅舞台外套','青藍飾邊短裙','深色襪子','桃紅厚底靴']},
  {id:'teal', name:'月光青', subtitle:'冷光青藍・高馬尾', image:'idol-stage-teal.png', tag:'MOON BEAT', description:'青藍高馬尾・夜色外套・閃亮舞台靴', details:['青藍高馬尾','黑青舞台外套','青色層次短裙','舞台短襪','青藍舞台靴']},
  {id:'rose', name:'玫瑰節奏', subtitle:'莓果桃紅・俏麗短髮', image:'idol-stage-rose.png', tag:'ROSE BEAT', description:'紫莓短髮・玫紅皮革舞台裝・長襪', details:['紫莓短髮','玫紅舞台外套','莓色百褶裙','圖案長襪','粉黑厚底靴']},
  {id:'aurora', name:'極光舞台', subtitle:'銀紫色・雙辮長髮', image:'idol-stage-aurora.png', tag:'AURORA', description:'銀紫雙辮・白紫舞台外套・亮白靴', details:['銀紫雙辮','白紫舞台外套','深藍百褶裙','白色短襪','白青舞台靴']}
];
const grid = document.querySelector('#lookGrid');
const model = document.querySelector('#modelImage');
const nameEl = document.querySelector('#lookName');
const subtitleEl = document.querySelector('#lookSubtitle');
const detailsEl = document.querySelector('#lookDetails');
const numberEl = document.querySelector('#lookNumber');
const statusEl = document.querySelector('#saveStatus');
const toastEl = document.querySelector('#toast');
const storageKey = 'idol-stage-saved-look-v1';
let current = 0;
let changeToken = 0;
let toastTimer;

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
}

function updateSelection(index, immediate = false) {
  const look = looks[index];
  if (!look) return;
  current = index;
  const token = ++changeToken;
  grid.querySelectorAll('button').forEach((button, buttonIndex) => {
    button.setAttribute('aria-pressed', String(buttonIndex === index));
  });
  nameEl.textContent = look.name;
  subtitleEl.textContent = look.subtitle;
  numberEl.textContent = `${String(index + 1).padStart(2, '0')} / 04`;
  detailsEl.replaceChildren();
  const chips = document.createElement('div');
  chips.className = 'detail-chips';
  for (const detail of look.details) {
    const chip = document.createElement('span');
    chip.textContent = detail;
    chips.append(chip);
  }
  detailsEl.append(chips);
  const setImage = () => {
    if (token !== changeToken) return;
    model.src = look.image;
    model.alt = `${look.name}造型：${look.description}`;
    model.classList.remove('changing');
  };
  if (immediate) setImage();
  else { model.classList.add('changing'); setTimeout(setImage, 170); }
}

looks.forEach((look, index) => {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'look-card';
  card.setAttribute('aria-label', `${look.name}，${look.description}`);
  card.setAttribute('aria-pressed', 'false');
  const thumb = document.createElement('img');
  thumb.src = look.image;
  thumb.alt = '';
  thumb.loading = index === 0 ? 'eager' : 'lazy';
  const copy = document.createElement('span');
  copy.className = 'card-copy';
  const label = document.createElement('em');
  label.textContent = look.tag;
  const title = document.createElement('strong');
  title.textContent = look.name;
  const summary = document.createElement('small');
  summary.textContent = look.subtitle;
  copy.append(label, title, summary);
  card.append(thumb, copy);
  card.addEventListener('click', () => updateSelection(index));
  grid.append(card);
});

document.querySelector('#randomLook').addEventListener('click', () => {
  updateSelection((current + 1 + Math.floor(Math.random() * (looks.length - 1))) % looks.length);
  showToast('新造型登場 ✦');
});
document.querySelector('#resetLook').addEventListener('click', () => {
  updateSelection(0);
  showToast('已回到星焰主唱造型');
});
document.querySelector('#saveLook').addEventListener('click', () => {
  try {
    localStorage.setItem(storageKey, looks[current].id);
    statusEl.textContent = `已儲存：${looks[current].name}`;
    showToast('造型已儲存在這台裝置 ♡');
  } catch {
    showToast('無法儲存；請檢查瀏覽器儲存設定');
  }
});
let savedId;
try { savedId = localStorage.getItem(storageKey); } catch { savedId = null; }
const savedIndex = looks.findIndex(look => look.id === savedId);
if (savedIndex >= 0) statusEl.textContent = `已儲存：${looks[savedIndex].name}`;
updateSelection(savedIndex >= 0 ? savedIndex : 0, true);

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
