(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const h = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const icons = { food: '♨', transport: '↔', stay: '⌂', tickets: '✳', shopping: '◇', other: '⋯' };
  const API_BASE = String(window.TRIP_CONFIG?.apiBase || '').trim().replace(/\/+$/, '');
  const AUTH_KEY = 'trip-split-account:' + (API_BASE || location.origin);
  const state = { config: null, trips: [], data: null, tab: 'expenses', key: '', token: '', user: null, register: false, pendingInvite: '', loadId: 0, shareDraft: {}, formMode: 'equal' };
  try { state.token = sessionStorage.getItem(AUTH_KEY) || ''; } catch {}
  if (location.hash.startsWith('#invite=')) {
    state.pendingInvite = new URLSearchParams(location.hash.slice(1)).get('invite') || '';
    history.replaceState(null, '', location.pathname + location.search);
  }
  let toastTimer, pendingDelete = null;
  try { state.key = sessionStorage.getItem('trip-split-key') || ''; } catch {}
  const params = new URLSearchParams(location.search);
  if (params.has('key')) {
    state.key = params.get('key') || '';
    try { sessionStorage.setItem('trip-split-key', state.key); } catch {}
    params.delete('key');
    history.replaceState(null, '', location.pathname + (params.size ? '?' + params.toString() : '') + location.hash);
  }
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const uid = () => { const bytes = new Uint8Array(16); crypto.getRandomValues(bytes); return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join(''); };
  const currency = () => state.data?.trip.currency || 'TWD';
  const digits = (code = currency()) => state.config?.currencies[code]?.decimals ?? 2;
  const inputAmount = (minor, code = currency()) => { const exp = digits(code), factor = 10 ** exp; return exp ? Math.floor(minor / factor) + '.' + String(minor % factor).padStart(exp, '0') : String(minor); };
  const formatMoney = (minor, code = currency()) => new Intl.NumberFormat('zh-TW', { style: 'currency', currency: code, minimumFractionDigits: 0, maximumFractionDigits: digits(code) }).format(minor / 10 ** digits(code));
  const member = id => state.data?.members.find(entry => entry.id === id);
  const name = id => member(id)?.name || '成員';
  const avatar = (id, label = name(id)) => '<span class="avatar" data-color="' + Math.max(0, state.data.members.findIndex(m => m.id === id)) % 4 + '" aria-hidden="true">' + h([...label][0] || '旅') + '</span>';
  function parseAmount(value, code = currency()) {
    const exp = digits(code), raw = String(value).trim();
    if (!(new RegExp('^\\d{1,12}' + (exp ? '(?:\\.\\d{1,' + exp + '})?' : '') + '$')).test(raw)) return null;
    const [whole, fraction = ''] = raw.split('.');
    const result = Number(whole) * 10 ** exp + Number(fraction.padEnd(exp, '0') || 0);
    return Number.isSafeInteger(result) && result <= 1e12 ? result : null;
  }
  function toast(text) {
    $('toast').textContent = text; $('toast').hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3500);
  }
  function offline(error) {
    $('connectionText').textContent = error?.message || '無法連線到帳本，請確認啟動視窗仍開著。';
    $('connectionBanner').hidden = false; $('connectionStatus').textContent = '連線中斷 · 請重新連線';
  }
  function online() {
    $('connectionBanner').hidden = true;
    $('connectionStatus').textContent = state.config?.account_auth ? 'SQLite · 每 5 秒同步旅伴更新' : 'SQLite · 資料保存在電腦';
  }
  function saveToken(token) {
    state.token = token;
    try { if (token) sessionStorage.setItem(AUTH_KEY, token); else sessionStorage.removeItem(AUTH_KEY); } catch {}
  }
  function clearPrivateView() {
    state.data = null; state.trips = []; state.user = null; state.loadId++;
    $('tripPage').hidden = $('welcome').hidden = $('accountBar').hidden = true;
    $('tripList').replaceChildren(); $('tripPicker').replaceChildren();
    ['expenseList', 'balanceCards', 'transferList', 'settlementList', 'accessList', 'payerRows', 'shareRows', 'memberList'].forEach(id => $(id).replaceChildren());
    ['tripTitle', 'tripMeta', 'totalAmount', 'averageAmount', 'outstandingAmount', 'expenseCount', 'accountName'].forEach(id => { $(id).textContent = ''; });
    document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
    $('expenseForm').reset(); $('tripForm').reset(); $('settlementForm').reset();
    $('shareLink').value = ''; $('joinInvite').value = '';
  }
  function showLogin() {
    saveToken(''); clearPrivateView(); $('loginPanel').hidden = false;
    document.querySelectorAll('[data-action="create-trip"]').forEach(button => { button.disabled = true; });
    $('loginInvite').value = state.pendingInvite;
    setRegister(Boolean(state.pendingInvite));
  }
  function setRegister(enabled) {
    state.register = enabled;
    $('loginNameLabel').hidden = $('loginInviteLabel').hidden = !enabled;
    $('loginName').required = $('loginInvite').required = enabled;
    $('loginPassword').minLength = enabled ? 12 : 1;
    $('loginPassword').autocomplete = enabled ? 'new-password' : 'current-password';
    $('loginSubmit').textContent = enabled ? '建立帳號並加入旅程' : '登入帳本';
    $('toggleRegister').textContent = enabled ? '已有帳號？直接登入' : '收到邀請？建立帳號';
    $('loginError').textContent = '';
  }
  function inviteCode(value) {
    const raw = value.trim();
    try { return raw.startsWith('https://') || raw.startsWith('http://') ? new URLSearchParams(new URL(raw).hash.slice(1)).get('invite') || '' : raw; } catch { return ''; }
  }
  async function api(path, method = 'GET', body, raw = false) {
    const headers = {};
    const sentToken = state.token;
    if (sentToken) headers.Authorization = 'Bearer ' + sentToken;
    if (state.key && !API_BASE && !state.config?.account_auth) headers['X-Trip-Key'] = state.key;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let response;
    try { response = await fetch(API_BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' }); }
    catch { throw new Error('無法連線到帳本。請確認主辦人的電腦、Python 和 HTTPS 通道仍開著，並檢查網路及 API 網址。'); }
    if (sentToken !== state.token) throw new Error('登入狀態已變更，請重新操作。');
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      if (response.status === 401 && !path.startsWith('/api/auth/login')) {
        if (state.config?.account_auth) showLogin();
        else if (!$('accessDialog').open) $('accessDialog').showModal();
      }
      throw new Error(result.error || '無法完成操作，請稍後再試。');
    }
    online();
    if (!raw && !response.headers.get('Content-Type')?.includes('application/json')) throw new Error('找不到 API。若使用 GitHub Pages，請先設定 static/config.js 的 apiBase。');
    return raw ? response : response.json();
  }
  function options(entries, selected) { return entries.map(([value, label]) => '<option value="' + h(value) + '"' + (selected === value ? ' selected' : '') + '>' + h(label) + '</option>').join(''); }
  function empty(title, detail, action = '', button = '') {
    return '<div class="empty-state"><span class="empty-symbol" aria-hidden="true">✳</span><h2>' + h(title) + '</h2><p>' + h(detail) + '</p>' + (action ? '<button type="button" class="primary" data-action="' + h(action) + '">' + h(button) + '</button>' : '') + '</div>';
  }
  function renderTripList() {
    $('tripList').innerHTML = state.trips.length ? state.trips.map(trip => '<button type="button" class="trip-item' + (state.data?.trip.id === trip.id ? ' active' : '') + '" data-trip="' + h(trip.id) + '" aria-current="' + (state.data?.trip.id === trip.id ? 'page' : 'false') + '"><span class="trip-mark" aria-hidden="true">↗</span><span><strong>' + h(trip.name) + '</strong><small>' + trip.member_count + ' 位旅伴 · ' + trip.expense_count + ' 筆帳目</small></span></button>').join('') : '<p class="muted">還沒有旅程。<br>從上方建立第一本帳吧。</p>';
    $('tripPicker').innerHTML = state.trips.length ? options(state.trips.map(trip => [trip.id, trip.name]), state.data?.trip.id) : '<option>尚無旅程</option>';
  }
  async function refreshTrips() {
    state.trips = (await api('/api/trips')).trips;
    renderTripList();
  }
  function applyDetail(data) {
    state.data = data;
    history.replaceState(null, '', location.pathname + location.search + '#' + data.trip.id);
    try { localStorage.setItem('trip-split-current', data.trip.id); } catch {}
    $('welcome').hidden = true; $('tripPage').hidden = false;
    $('settingsButton').disabled = Boolean(state.config?.account_auth && data.role !== 'owner');
    $('shareButton').hidden = Boolean(state.config?.account_auth && data.role !== 'owner');
    $('tripTitle').textContent = data.trip.name;
    $('tripMeta').textContent = [data.trip.destination, data.trip.start_date, data.members.length + ' 位旅伴', data.trip.currency].filter(Boolean).join('  ·  ');
    $('totalAmount').textContent = formatMoney(data.total);
    $('averageAmount').textContent = formatMoney(Math.round(data.total / data.members.length));
    $('outstandingAmount').textContent = formatMoney(data.outstanding);
    $('expenseCount').textContent = data.expenses.length + ' 筆共同回憶';
    $('savedAt').textContent = '已與 SQLite 帳本同步';
    renderTripList(); renderExpenses(); renderBalances(); renderSettlements();
  }
  function acceptDetail(data) {
    applyDetail(data);
    refreshTrips().catch(offline);
  }
  async function loadTrip(id) {
    const serial = ++state.loadId;
    const result = await api('/api/trips/' + encodeURIComponent(id));
    if (serial === state.loadId) applyDetail(result);
  }
  async function boot() {
    if (location.protocol === 'file:') { $('fileNotice').hidden = false; $('tripList').textContent = '請先啟動伺服器'; return; }
    try {
      state.config = await api('/api/config');
      if (state.config.account_auth) {
        if (!state.token) { showLogin(); return; }
        state.user = (await api('/api/auth/me')).user;
        $('accountName').textContent = state.user.name;
        $('accountBar').hidden = false; $('loginPanel').hidden = true;
        document.querySelectorAll('[data-action="create-trip"]').forEach(button => { button.disabled = false; });
        if (state.pendingInvite) {
          try {
            const joined = await api('/api/join', 'POST', { invite: state.pendingInvite });
            history.replaceState(null, '', location.pathname + location.search + '#' + joined.trip_id);
            state.pendingInvite = ''; toast('已加入旅程。');
          } catch (error) {
            $('joinInvite').value = state.pendingInvite; state.pendingInvite = '';
            $('joinError').textContent = error.message; $('joinDialog').showModal();
          }
        }
      }
      $('tripCurrency').innerHTML = options(Object.entries(state.config.currencies).map(([code, info]) => [code, code + ' · ' + info.name]), 'TWD');
      $('expenseCategory').innerHTML = options(Object.entries(state.config.categories));
      $('categoryFilter').innerHTML = '<option value="">所有分類</option>' + options(Object.entries(state.config.categories));
      await refreshTrips();
      let last = location.hash.slice(1);
      if (!last) { try { last = localStorage.getItem('trip-split-current'); } catch {} }
      const chosen = state.trips.find(trip => trip.id === last) || state.trips[0];
      if (chosen) await loadTrip(chosen.id);
      else { state.data = null; $('tripPage').hidden = true; $('welcome').hidden = false; }
    } catch (error) { offline(error); }
  }
  function showTab(tab) {
    state.tab = tab;
    document.querySelectorAll('[data-tab]').forEach(button => {
      const active = button.dataset.tab === tab;
      button.setAttribute('aria-selected', String(active));
      $('panel-' + button.dataset.tab).hidden = !active;
    });
  }
  function renderExpenses() {
    if (!state.data) return;
    const search = $('expenseSearch').value.trim().toLocaleLowerCase(), category = $('categoryFilter').value;
    const expenses = state.data.expenses.filter(expense => {
      const haystack = [expense.title, expense.note, ...expense.payments.map(p => name(p.member_id)), ...expense.shares.map(p => name(p.member_id))].join(' ').toLocaleLowerCase();
      return (!category || expense.category === category) && (!search || haystack.includes(search));
    });
    if (!expenses.length) {
      $('expenseList').innerHTML = state.data.expenses.length ? empty('這裡還找不到符合的帳目', '試著換個關鍵字，或選擇所有分類。') : empty('先記下旅程的第一筆花費', '從一頓午餐、一張車票開始，把每個人的代墊都記下來。', 'add-expense', '＋ 記一筆支出');
      return;
    }
    const groups = new Map();
    for (const expense of expenses) { if (!groups.has(expense.spent_on)) groups.set(expense.spent_on, []); groups.get(expense.spent_on).push(expense); }
    $('expenseList').innerHTML = [...groups].map(([day, rows]) => '<section class="expense-group"><h2 class="date-label"><span>' + h(day) + '</span><span>' + rows.length + ' 筆 · ' + h(formatMoney(rows.reduce((sum, row) => sum + row.amount, 0))) + '</span></h2>' + rows.map(expense => {
      const whoPaid = expense.payments.map(p => name(p.member_id)).join('、');
      const whoShares = expense.shares.length === state.data.members.length ? '全體旅伴' : expense.shares.map(p => name(p.member_id)).join('、');
      return '<article class="expense-row"><span class="category-icon" data-category="' + h(expense.category) + '" title="' + h(state.config.categories[expense.category]) + '" aria-hidden="true">' + icons[expense.category] + '</span><div class="expense-copy"><h3>' + h(expense.title) + '</h3><p>' + h(whoPaid) + ' 先付款 · ' + h(whoShares) + ' 分攤</p>' + (expense.note ? '<p class="expense-note">' + h(expense.note) + '</p>' : '') + '</div><strong class="expense-amount">' + h(formatMoney(expense.amount)) + '</strong><button class="row-edit" type="button" data-edit-expense="' + h(expense.id) + '" aria-label="編輯 ' + h(expense.title) + '">編輯</button></article>';
    }).join('') + '</section>').join('');
  }
  function renderBalances() {
    if (!state.data) return;
    $('balanceCards').innerHTML = state.data.balances.map(balance => '<article class="balance-card"><div class="balance-top">' + avatar(balance.member_id) + '<strong>' + h(balance.name) + '</strong><span class="net-label">' + (balance.net < 0 ? '尚應付' : balance.net > 0 ? '尚應收' : '') + '</span><span class="net-amount ' + (balance.net < 0 ? 'owes' : balance.net > 0 ? 'receives' : 'balanced') + '">' + (balance.net === 0 ? '已結清 ✓' : h(formatMoney(Math.abs(balance.net)))) + '</span></div><div class="balance-detail"><div><span>已先代墊</span><strong>' + h(formatMoney(balance.paid)) + '</strong></div><div><span>自己應分攤</span><strong>' + h(formatMoney(balance.share)) + '</strong></div></div><p class="balance-settled">已付還款 ' + h(formatMoney(balance.sent)) + ' · 已收還款 ' + h(formatMoney(balance.received)) + '</p></article>').join('');
    $('transferList').innerHTML = state.data.transfers.length ? state.data.transfers.map((transfer, index) => '<article class="transfer-row"><div class="transfer-people">' + avatar(transfer.payer_id) + '<strong>' + h(name(transfer.payer_id)) + '</strong><span class="transfer-arrow">→</span><strong>' + h(name(transfer.payee_id)) + '</strong></div><strong class="transfer-money">' + h(formatMoney(transfer.amount)) + '</strong><button class="primary" type="button" data-settle="' + index + '">記錄已付款</button></article>').join('') : '<div class="settled-box">' + (state.data.expenses.length ? '✓ 目前所有帳目都已結清，可以輕鬆享受旅程！' : '記下第一筆支出後，這裡會自動整理付款方向。') + '</div>';
  }
  function renderSettlements() {
    if (!state.data) return;
    $('settlementList').innerHTML = state.data.settlements.length ? state.data.settlements.map(entry => '<article class="settlement-row"><span class="settlement-mark" aria-hidden="true">✓</span><div class="settlement-copy"><strong>' + h(name(entry.payer_id)) + ' → ' + h(name(entry.payee_id)) + '</strong><p>' + h(entry.paid_on) + (entry.note ? ' · ' + h(entry.note) : '') + '</p></div><strong class="expense-amount">' + h(formatMoney(entry.amount)) + '</strong><button type="button" class="row-edit" data-delete-settlement="' + h(entry.id) + '" aria-label="移除這筆還款紀錄">移除</button></article>').join('') : empty('還沒有還款紀錄', '轉帳或交付現金後，可到「成員結算」記錄已付款。');
  }
  function openTrip(edit = false) {
    if (!state.config) { toast('請先連線到啟動中的伺服器。'); return; }
    const trip = edit ? state.data.trip : null;
    $('tripForm').reset(); $('tripForm').dataset.id = trip?.id || '';
    $('tripDialogTitle').textContent = edit ? '旅程設定' : '建立新旅程';
    $('tripName').value = trip?.name || ''; $('tripDestination').value = trip?.destination || '';
    $('tripDate').value = trip?.start_date || ''; $('tripCurrency').value = trip?.currency || 'TWD';
    $('tripCurrency').disabled = edit && Boolean(state.data.expenses.length || state.data.settlements.length);
    $('currencyHint').textContent = $('tripCurrency').disabled ? '已有帳目，幣別已固定；如需其他幣別，請另建旅程。' : '同一旅程使用統一幣別，不自動換算匯率。';
    $('initialMembersLabel').hidden = edit; $('initialMembers').required = !edit;
    $('deleteTripButton').hidden = !edit; $('tripFormError').textContent = '';
    $('tripDialog').showModal();
  }
  function readShareDraft() {
    document.querySelectorAll('#shareRows [data-member]').forEach(row => {
      const draft = state.shareDraft[row.dataset.member];
      draft.checked = row.querySelector('[type=checkbox]').checked;
      const input = row.querySelector('[data-share-value]');
      if (input) draft[state.formMode] = input.value;
    });
  }
  function allocation(mode = state.formMode) {
    const total = parseAmount($('expenseAmount').value);
    const selected = state.data.members.filter(m => state.shareDraft[m.id].checked);
    if (total === null || total <= 0 || !selected.length) return null;
    if (mode === 'exact') {
      const values = selected.map(m => parseAmount(state.shareDraft[m.id].exact || '0'));
      if (values.some(value => value === null)) return null;
      return { selected, values, sum: values.reduce((sum, value) => sum + value, 0), total };
    }
    const weights = selected.map(m => mode === 'equal' ? 1 : Number(state.shareDraft[m.id].units));
    if (weights.some(weight => !Number.isInteger(weight) || weight < 1 || weight > 1000)) return null;
    const denominator = weights.reduce((sum, value) => sum + value, 0);
    const values = weights.map(weight => Math.floor(total * weight / denominator));
    const order = weights.map((weight, i) => ({ i, remainder: total * weight % denominator })).sort((a, b) => b.remainder - a.remainder || a.i - b.i);
    const extra = total - values.reduce((sum, value) => sum + value, 0);
    order.slice(0, extra).forEach(entry => values[entry.i]++);
    return { selected, values, sum: total, total };
  }
  function buildShareRows() {
    const mode = state.formMode;
    $('shareValueLabel').textContent = mode === 'equal' ? '預計分攤' : mode === 'units' ? '份數／預計分攤' : '分攤金額';
    $('shareRows').innerHTML = state.data.members.map(m => {
      const draft = state.shareDraft[m.id];
      const valueInput = mode === 'equal' ? '' : '<input data-share-value inputmode="' + (mode === 'units' ? 'numeric' : 'decimal') + '" aria-label="' + h(m.name) + (mode === 'units' ? '的份數' : '的分攤金額') + '" value="' + h(draft[mode]) + '"' + (draft.checked ? '' : ' disabled') + '>';
      return '<div class="allocation-row" data-member="' + h(m.id) + '"><input type="checkbox" aria-label="' + h(m.name) + '參與分攤"' + (draft.checked ? ' checked' : '') + '>' + avatar(m.id) + '<span class="allocation-name">' + h(m.name) + '</span>' + valueInput + (mode !== 'exact' ? '<span class="share-preview"></span>' : '') + '</div>';
    }).join('');
    $('splitHint').textContent = mode === 'units' ? '例如：大人 2 份、小孩 1 份。份數可填 1～1000；尾數會自動分配。' : mode === 'exact' ? '各成員的指定金額合計須等於總金額，未填視為 0。' : '尾數以最小貨幣單位分配，合計會與總金額一致。';
    updateAllocation();
  }
  function updateAllocation() {
    const result = allocation();
    $('shareTotal').textContent = result ? '分攤合計 ' + formatMoney(result.sum) + ' / ' + formatMoney(result.total) : '請填寫總金額，並選擇分攤成員與有效份數／金額。';
    $('shareTotal').classList.toggle('invalid', !result || result.sum !== result.total);
    document.querySelectorAll('#shareRows [data-member]').forEach(row => {
      const output = row.querySelector('.share-preview');
      if (!output) return;
      const index = result?.selected.findIndex(m => m.id === row.dataset.member) ?? -1;
      output.textContent = index >= 0 ? formatMoney(result.values[index]) : '—';
    });
    const total = parseAmount($('expenseAmount').value);
    const paid = [...document.querySelectorAll('#payerRows input')].reduce((sum, input) => sum + (parseAmount(input.value || '0') ?? 0), 0);
    $('payerTotal').textContent = '付款合計 ' + formatMoney(paid) + ' / ' + (total === null ? '—' : formatMoney(total));
    $('payerTotal').classList.toggle('invalid', total === null || paid !== total);
  }
  function openExpense(id = '') {
    if (!state.data) return;
    const expense = id ? state.data.expenses.find(entry => entry.id === id) : null;
    if (id && !expense) { toast('這筆支出已不存在，請重新整理。'); return; }
    $('expenseForm').reset();
    $('expenseForm').dataset.id = id; $('expenseForm').dataset.trip = state.data.trip.id;
    $('expenseForm').dataset.client = expense?.client_id || uid(); $('expenseForm').dataset.version = expense?.updated_at || '';
    $('expenseDialogTitle').textContent = expense ? '編輯這筆支出' : '記一筆支出';
    $('expenseTitle').value = expense?.title || ''; $('expenseAmount').value = expense ? inputAmount(expense.amount) : '';
    $('expenseDate').value = expense?.spent_on || today(); $('expenseCategory').value = expense?.category || 'food';
    $('expenseNote').value = expense?.note || ''; $('expenseCurrencyLabel').textContent = currency();
    $('expenseAmount').placeholder = digits() ? '0.00' : '0';
    $('expensePayer').innerHTML = options(state.data.members.map(m => [m.id, m.name]), expense?.payments[0]?.member_id);
    $('multiplePayers').checked = (expense?.payments.length || 0) > 1;
    $('payerRows').innerHTML = state.data.members.map(m => '<div class="allocation-row">' + avatar(m.id) + '<span class="allocation-name">' + h(m.name) + '</span><input data-payer="' + h(m.id) + '" inputmode="decimal" aria-label="' + h(m.name) + '代墊金額" placeholder="0" value="' + h(expense?.payments.some(p => p.member_id === m.id) ? inputAmount(expense.payments.find(p => p.member_id === m.id).amount) : '') + '"></div>').join('');
    state.formMode = expense?.split_mode || 'equal'; $('splitMode').value = state.formMode;
    state.shareDraft = {};
    for (const m of state.data.members) {
      const share = expense?.shares.find(entry => entry.member_id === m.id);
      state.shareDraft[m.id] = { checked: expense ? Boolean(share) : true, units: String(share?.weight || 1), exact: share ? inputAmount(share.amount) : '' };
    }
    $('singlePayerLabel').hidden = $('multiplePayers').checked;
    $('payerRows').hidden = $('payerTotal').hidden = !$('multiplePayers').checked;
    $('deleteExpenseButton').hidden = !expense;
    $('expenseEditHint').hidden = !expense || !state.data.settlements.length;
    $('expenseFormError').textContent = '';
    buildShareRows(); $('expenseDialog').showModal();
  }
  function expensePayload() {
    readShareDraft();
    const amount = parseAmount($('expenseAmount').value), result = allocation();
    if (amount === null || amount <= 0) throw new Error('請填寫大於零且符合旅程幣別小數位的金額。');
    if (!result || result.sum !== amount) throw new Error('請確認分攤成員、份數或指定金額；合計須與總金額一致。');
    let payments;
    if ($('multiplePayers').checked) {
      const inputs = [...document.querySelectorAll('#payerRows input')];
      const values = inputs.map(input => parseAmount(input.value || '0'));
      if (values.some(value => value === null) || values.reduce((sum, value) => sum + value, 0) !== amount) throw new Error('各付款人的代墊金額合計必須等於總金額。');
      payments = inputs.flatMap((input, index) => values[index] > 0 ? [{ member_id: input.dataset.payer, amount: input.value }] : []);
    } else payments = [{ member_id: $('expensePayer').value, amount: $('expenseAmount').value }];
    return { title: $('expenseTitle').value, amount: $('expenseAmount').value, spent_on: $('expenseDate').value, category: $('expenseCategory').value, note: $('expenseNote').value, split_mode: state.formMode, payments, shares: result.selected.map(m => ({ member_id: m.id, value: state.formMode === 'equal' ? '1' : state.shareDraft[m.id][state.formMode] || '0' })), client_id: $('expenseForm').dataset.client, version: $('expenseForm').dataset.version };
  }
  function renderMembers() {
    $('memberList').innerHTML = state.data.members.map(m => '<div class="member-row" data-member="' + h(m.id) + '">' + avatar(m.id) + '<input value="' + h(m.name) + '" maxlength="30" aria-label="修改' + h(m.name) + '的姓名"><button class="text-button" type="button" data-rename-member="' + h(m.id) + '">儲存</button><button class="text-button" type="button" data-remove-member="' + h(m.id) + '"' + (state.data.members.length <= 2 ? ' disabled' : '') + '>移除</button></div>').join('');
  }
  function openMembers() { if (!state.data) return; $('memberError').textContent = ''; $('memberForm').reset(); renderMembers(); $('membersDialog').showModal(); }
  function openSettlement(index = null) {
    if (!state.data?.transfers.length) { toast('目前沒有需要還款的金額。'); return; }
    const transfer = index === null ? state.data.transfers[0] : state.data.transfers[index];
    if (!transfer) return;
    $('settlementForm').reset(); $('settlementForm').dataset.client = uid(); $('settlementForm').dataset.trip = state.data.trip.id;
    $('settlementPayer').innerHTML = options(state.data.balances.filter(b => b.net < 0).map(b => [b.member_id, b.name]), transfer.payer_id);
    $('settlementPayee').innerHTML = options(state.data.balances.filter(b => b.net > 0).map(b => [b.member_id, b.name]), transfer.payee_id);
    $('settlementDate').value = today(); $('settlementError').textContent = ''; $('settlementAmount').value = inputAmount(transfer.amount);
    updateSettlementLimit(false); $('settlementDialog').showModal();
  }
  function updateSettlementLimit(prefill = true) {
    const from = state.data.balances.find(b => b.member_id === $('settlementPayer').value);
    const to = state.data.balances.find(b => b.member_id === $('settlementPayee').value);
    const maximum = Math.min(-(from?.net || 0), to?.net || 0);
    $('settlementLimit').textContent = '這組付款方向目前最多可記錄 ' + formatMoney(Math.max(0, maximum)) + '；也可以先記錄部分金額。';
    if (prefill) $('settlementAmount').value = inputAmount(Math.max(0, maximum));
  }
  function confirmDelete(title, detail, action) {
    $('confirmTitle').textContent = title; $('confirmText').textContent = detail;
    $('confirmError').textContent = ''; pendingDelete = action; $('confirmDialog').showModal();
  }
  async function formTask(form, errorId, callback) {
    const button = form.querySelector('[type=submit]');
    if (button.disabled) return;
    button.disabled = true; $(errorId).textContent = '';
    try { await callback(); }
    catch (error) { $(errorId).textContent = error.message; }
    finally { button.disabled = false; }
  }

  document.addEventListener('click', event => {
    const close = event.target.closest('[data-close]');
    if (close) $(close.dataset.close).close();
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'create-trip') openTrip();
    if (action === 'add-expense') openExpense();
  });
  $('tripList').addEventListener('click', event => { const button = event.target.closest('[data-trip]'); if (button) loadTrip(button.dataset.trip).catch(offline); });
  $('tripPicker').addEventListener('change', event => loadTrip(event.target.value).catch(offline));
  document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => showTab(button.dataset.tab)));
  $('expenseSearch').addEventListener('input', renderExpenses); $('categoryFilter').addEventListener('change', renderExpenses);
  $('settingsButton').addEventListener('click', () => openTrip(true));
  $('addExpenseButton').addEventListener('click', () => openExpense());
  $('membersButton').addEventListener('click', openMembers);
  $('expenseList').addEventListener('click', event => { const button = event.target.closest('[data-edit-expense]'); if (button) openExpense(button.dataset.editExpense); });
  $('transferList').addEventListener('click', event => { const button = event.target.closest('[data-settle]'); if (button) openSettlement(Number(button.dataset.settle)); });
  $('manualSettlementButton').addEventListener('click', () => openSettlement()); $('paymentRecordButton').addEventListener('click', () => openSettlement());
  $('expenseAmount').addEventListener('input', updateAllocation); $('payerRows').addEventListener('input', updateAllocation);
  $('multiplePayers').addEventListener('change', () => {
    const multi = $('multiplePayers').checked;
    $('singlePayerLabel').hidden = multi; $('payerRows').hidden = $('payerTotal').hidden = !multi;
    if (multi && ![...document.querySelectorAll('#payerRows input')].some(input => input.value)) {
      const input = [...document.querySelectorAll('#payerRows input')].find(input => input.dataset.payer === $('expensePayer').value);
      if (input) input.value = $('expenseAmount').value;
    }
    updateAllocation();
  });
  $('shareRows').addEventListener('input', event => { readShareDraft(); if (event.target.type === 'checkbox') buildShareRows(); else updateAllocation(); });
  $('splitMode').addEventListener('change', () => {
    readShareDraft(); const previous = allocation(); state.formMode = $('splitMode').value;
    if (state.formMode === 'exact' && previous) previous.selected.forEach((m, index) => { if (state.shareDraft[m.id].exact === '') state.shareDraft[m.id].exact = inputAmount(previous.values[index]); });
    buildShareRows();
  });
  $('selectAllShares').addEventListener('click', () => { readShareDraft(); Object.values(state.shareDraft).forEach(draft => { draft.checked = true; }); buildShareRows(); });
  $('clearShares').addEventListener('click', () => { readShareDraft(); Object.values(state.shareDraft).forEach(draft => { draft.checked = false; }); buildShareRows(); });
  $('settlementPayer').addEventListener('change', () => updateSettlementLimit()); $('settlementPayee').addEventListener('change', () => updateSettlementLimit());

  $('tripForm').addEventListener('submit', event => {
    event.preventDefault(); formTask(event.currentTarget, 'tripFormError', async () => {
      const id = $('tripForm').dataset.id;
      const payload = { name: $('tripName').value, destination: $('tripDestination').value, start_date: $('tripDate').value, currency: $('tripCurrency').value };
      if (!id) payload.members = $('initialMembers').value.split(/[\n,，、;；]+/).map(value => value.trim()).filter(Boolean);
      const result = await api('/api/trips' + (id ? '/' + id : ''), id ? 'PUT' : 'POST', payload);
      $('tripDialog').close(); acceptDetail(result); toast(id ? '旅程已更新。' : '旅程建立好了，記下第一筆吧！');
    });
  });
  $('expenseForm').addEventListener('submit', event => {
    event.preventDefault(); formTask(event.currentTarget, 'expenseFormError', async () => {
      const form = $('expenseForm'), id = form.dataset.id;
      const result = await api('/api/trips/' + form.dataset.trip + '/expenses' + (id ? '/' + id : ''), id ? 'PUT' : 'POST', expensePayload());
      $('expenseDialog').close(); acceptDetail(result); toast(id ? '支出已更新，結算也重新計算了。' : '已記下這筆支出。');
    });
  });
  $('memberForm').addEventListener('submit', event => {
    event.preventDefault(); formTask(event.currentTarget, 'memberError', async () => {
      const result = await api('/api/trips/' + state.data.trip.id + '/members', 'POST', { name: $('newMemberName').value });
      acceptDetail(result); renderMembers(); $('memberForm').reset(); toast('新旅伴已加入。');
    });
  });
  $('memberList').addEventListener('click', async event => {
    const rename = event.target.closest('[data-rename-member]'), remove = event.target.closest('[data-remove-member]');
    if (rename) {
      rename.disabled = true; $('memberError').textContent = '';
      try {
        const value = rename.closest('.member-row').querySelector('input').value;
        const result = await api('/api/trips/' + state.data.trip.id + '/members/' + rename.dataset.renameMember, 'PUT', { name: value });
        acceptDetail(result); renderMembers(); toast('姓名已更新。');
      } catch (error) { $('memberError').textContent = error.message; }
      finally { rename.disabled = false; }
    }
    if (remove && !remove.disabled) confirmDelete('移除這位旅伴？', '只可移除還沒有帳目或還款紀錄的成員。', async () => {
      const result = await api('/api/trips/' + state.data.trip.id + '/members/' + remove.dataset.removeMember, 'DELETE');
      acceptDetail(result); renderMembers();
    });
  });
  $('settlementForm').addEventListener('submit', event => {
    event.preventDefault(); formTask(event.currentTarget, 'settlementError', async () => {
      const result = await api('/api/trips/' + $('settlementForm').dataset.trip + '/settlements', 'POST', { payer_id: $('settlementPayer').value, payee_id: $('settlementPayee').value, amount: $('settlementAmount').value, paid_on: $('settlementDate').value, note: $('settlementNote').value, client_id: $('settlementForm').dataset.client });
      $('settlementDialog').close(); acceptDetail(result); toast('還款已記錄，餘額更新完成。');
    });
  });
  $('deleteExpenseButton').addEventListener('click', () => confirmDelete('刪除這筆支出？', '付款與分攤明細都會移除，已記錄的還款會保留。刪除後無法復原。', async () => {
    const form = $('expenseForm');
    const result = await api('/api/trips/' + form.dataset.trip + '/expenses/' + form.dataset.id, 'DELETE', { version: form.dataset.version });
    $('expenseDialog').close(); acceptDetail(result); toast('支出已刪除。');
  }));
  $('deleteTripButton').addEventListener('click', () => confirmDelete('刪除整個旅程？', '所有成員、支出與還款紀錄都會刪除，無法復原。建議先匯出帳目。', async () => {
    await api('/api/trips/' + $('tripForm').dataset.id, 'DELETE');
    $('tripDialog').close(); state.data = null; history.replaceState(null, '', location.pathname); await boot(); toast('旅程與相關帳目已刪除。');
  }));
  $('settlementList').addEventListener('click', event => {
    const button = event.target.closest('[data-delete-settlement]');
    if (button) confirmDelete('移除這筆還款紀錄？', '移除後會重新計算應付／應收；原支出不會被刪除。', async () => {
      const result = await api('/api/trips/' + state.data.trip.id + '/settlements/' + button.dataset.deleteSettlement, 'DELETE');
      acceptDetail(result); toast('已移除還款紀錄。');
    });
  });
  $('confirmCancel').addEventListener('click', () => $('confirmDialog').close());
  $('confirmDelete').addEventListener('click', async () => {
    if (!pendingDelete || $('confirmDelete').disabled) return;
    $('confirmDelete').disabled = true; $('confirmError').textContent = '';
    try { await pendingDelete(); $('confirmDialog').close(); pendingDelete = null; }
    catch (error) { $('confirmError').textContent = error.message; }
    finally { $('confirmDelete').disabled = false; }
  });
  $('exportButton').addEventListener('click', async () => {
    if (!state.data) return;
    $('exportButton').disabled = true;
    try {
      const response = await api('/api/trips/' + state.data.trip.id + '/export', 'GET', undefined, true);
      const url = URL.createObjectURL(await response.blob()), link = document.createElement('a');
      link.href = url; link.download = state.data.trip.name.replace(/[\\/:*?"<>|]/g, '-') + '-帳目.csv';
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
      toast('CSV 已匯出，可用 Excel 開啟。');
    } catch (error) { toast(error.message); } finally { $('exportButton').disabled = false; }
  });
  function updateShareLink() {
    const url = new URL($('shareAddress').value);
    if (state.key) url.searchParams.set('key', state.key);
    if (state.data) url.hash = state.data.trip.id;
    $('shareLink').value = url.toString();
  }
  async function renderAccess() {
    const result = await api('/api/trips/' + state.data.trip.id + '/access');
    $('accessList').innerHTML = result.users.map(user => '<div class="access-row"><span>' + h(user.name) + ' <small>@' + h(user.username) + '</small></span>' + (user.role === 'owner' ? '<span class="hint">建立者</span>' : '<button type="button" class="danger-text" data-revoke-access="' + h(user.id) + '">移除權限</button>') + '</div>').join('');
  }
  $('shareButton').addEventListener('click', async () => {
    $('shareError').textContent = ''; $('shareLink').value = '';
    $('remoteShare').hidden = !state.config.account_auth;
    if (state.config.account_auth) {
      $('shareInstructions').textContent = '為每位旅伴產生一份邀請，可用各自的行動網路，不必同一 Wi-Fi。';
      $('shareWarning').textContent = '每份邀請僅能使用一次，七天後失效。只傳給信任的人；電腦、Python 與通道需保持運行。';
      $('shareAddressLabel').hidden = true;
      $('shareLinkLabel').hidden = $('copyShareButton').hidden = true;
      $('shareDialog').showModal();
      try { await renderAccess(); } catch (error) { $('shareError').textContent = error.message; }
      return;
    }
    const ready = state.config.lan && state.config.share_urls.length > 0;
    $('shareInstructions').textContent = ready ? '讓旅伴連上同一個 Wi-Fi，開啟下方網址，就能使用同一本帳。' : '請先關閉目前的啟動視窗，改為雙擊 start-lan.bat。再次開啟終端機提供的網址，即可取得手機分享連線。';
    $('shareAddressLabel').hidden = $('shareLinkLabel').hidden = $('copyShareButton').hidden = !ready;
    if (ready) { $('shareAddress').innerHTML = options(state.config.share_urls.map(url => [url, url])); updateShareLink(); }
    $('shareDialog').showModal();
  });
  $('shareAddress').addEventListener('change', updateShareLink);
  $('newInviteButton').addEventListener('click', async () => {
    $('newInviteButton').disabled = true; $('shareError').textContent = '';
    try {
      const result = await api('/api/trips/' + state.data.trip.id + '/invites', 'POST', {});
      const url = new URL(location.href); url.search = ''; url.hash = 'invite=' + result.invite;
      $('shareLink').value = url.href;
      $('shareLinkLabel').hidden = $('copyShareButton').hidden = false;
      toast('邀請已產生。請複製給一位旅伴，再產生下一份。');
    } catch (error) { $('shareError').textContent = error.message; }
    finally { $('newInviteButton').disabled = false; }
  });
  $('revokeInvitesButton').addEventListener('click', () => confirmDelete('撤銷所有未使用邀請？', '已加入的帳號不受影響。若要移除已加入的人，請使用「移除權限」。', async () => {
    await api('/api/trips/' + state.data.trip.id + '/invites', 'DELETE');
    $('shareLink').value = ''; $('shareLinkLabel').hidden = $('copyShareButton').hidden = true;
    toast('未使用的邀請已撤銷。');
  }));
  $('accessList').addEventListener('click', event => {
    const button = event.target.closest('[data-revoke-access]');
    if (button) confirmDelete('移除這個帳號的存取權？', '移除後將無法再讀寫此旅程，原帳目、分攤成員與還款紀錄會保留。', async () => {
      await api('/api/trips/' + state.data.trip.id + '/access/' + button.dataset.revokeAccess, 'DELETE');
      await renderAccess(); toast('已移除此旅程的存取權。');
    });
  });
  $('toggleRegister').addEventListener('click', () => setRegister(!state.register));
  $('loginForm').addEventListener('submit', event => {
    event.preventDefault(); formTask(event.currentTarget, 'loginError', async () => {
      const payload = { username: $('loginUsername').value.trim(), password: $('loginPassword').value };
      if (state.register) Object.assign(payload, { name: $('loginName').value, invite: inviteCode($('loginInvite').value) });
      const result = await api('/api/auth/' + (state.register ? 'register' : 'login'), 'POST', payload);
      saveToken(result.token); $('loginPassword').value = '';
      if (result.trip_id) { state.pendingInvite = ''; history.replaceState(null, '', location.pathname + location.search + '#' + result.trip_id); }
      await boot();
    });
  });
  $('logoutButton').addEventListener('click', async () => {
    $('logoutButton').disabled = true;
    try { await api('/api/auth/logout', 'POST', {}); }
    catch (error) { toast('伺服器未確認登出；本裝置已清除登入。必要時請在電腦重設密碼撤銷所有登入。'); }
    finally { $('logoutButton').disabled = false; history.replaceState(null, '', location.pathname + location.search); showLogin(); }
  });
  $('joinButton').addEventListener('click', () => { $('joinError').textContent = ''; $('joinDialog').showModal(); });
  $('joinForm').addEventListener('submit', event => {
    event.preventDefault(); formTask(event.currentTarget, 'joinError', async () => {
      const result = await api('/api/join', 'POST', { invite: inviteCode($('joinInvite').value) });
      $('joinDialog').close(); $('joinInvite').value = ''; await refreshTrips(); await loadTrip(result.trip_id); toast('已加入旅程。');
    });
  });
  $('copyShareButton').addEventListener('click', async () => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText($('shareLink').value);
      else { $('shareLink').focus(); $('shareLink').select(); if (!document.execCommand('copy')) throw new Error(); }
      toast('已複製，傳給這次旅行的夥伴吧！');
    } catch { $('shareLink').focus(); $('shareLink').select(); toast('請長按或手動複製上方網址。'); }
  });
  $('accessForm').addEventListener('submit', event => {
    event.preventDefault(); formTask(event.currentTarget, 'accessError', async () => {
      let value = $('accessKey').value.trim();
      if (value.startsWith('http')) { try { value = new URL(value).searchParams.get('key') || ''; } catch {} }
      state.key = value;
      await api('/api/trips');
      try { sessionStorage.setItem('trip-split-key', value); } catch {}
      $('accessDialog').close(); await boot(); toast('已連線到帳本。');
    });
  });
  $('retryButton').addEventListener('click', boot);
  $('refreshButton').addEventListener('click', async () => { try { await refreshTrips(); if (state.data) await loadTrip(state.data.trip.id); toast('帳本已重新整理。'); } catch (error) { offline(error); } });
  async function syncIfIdle() {
    if (!state.config || (state.config.account_auth && !state.user) || document.hidden || document.querySelector('dialog[open]')) return;
    try {
      const previous = state.data?.trip.updated_at;
      await refreshTrips();
      if (state.data) {
        const current = state.trips.find(trip => trip.id === state.data.trip.id);
        if (!current) await boot();
        else if (current.updated_at !== previous) await loadTrip(current.id);
      } else if (state.trips.length) await loadTrip(state.trips[0].id);
    } catch (error) { offline(error); }
  }
  window.addEventListener('focus', syncIfIdle);
  window.addEventListener('hashchange', () => {
    if (!location.hash.startsWith('#invite=')) return;
    state.pendingInvite = new URLSearchParams(location.hash.slice(1)).get('invite') || '';
    history.replaceState(null, '', location.pathname + location.search);
    if (state.config?.account_auth) {
      if (state.user) boot(); else showLogin();
    }
  });
  setInterval(syncIfIdle, 5000);
  boot();
})();
