(async function () {
  const checks = [], errors = [];
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const check = (condition, label) => { if (!condition) throw new Error(label); checks.push(label); };
  const frame = document.getElementById('game');
  let d, w;
  const $ = id => d.getElementById(id);
  const until = async (condition, label) => { for (let i = 0; i < 300; i++) { if (condition()) return; await pause(50); } throw new Error('Timeout: ' + label + ' / ' + d?.querySelector('.form-error:not(:empty)')?.textContent); };
  const setup = () => { d = frame.contentDocument; w = frame.contentWindow; w.addEventListener('error', e => errors.push(e.message)); };
  const set = (id, value) => { $(id).value = value; $(id).dispatchEvent(new w.Event('input', { bubbles: true })); };
  let apiBase, ownerToken;
  async function ownerApi(path, method = 'GET', body) {
    const response = await fetch(apiBase + path, { method, headers: { Authorization: 'Bearer ' + ownerToken, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const value = await response.json(); if (!response.ok) throw new Error(value.error); return value;
  }
  try {
    await until(() => frame.contentDocument?.getElementById('loginPanel') && !frame.contentDocument.getElementById('loginPanel').hidden, 'login panel from project subpath');
    setup(); apiBase = w.TRIP_CONFIG.apiBase;
    check(w.location.pathname === '/project/trip-split/static/' && !$('loginPanel').hidden, 'GitHub-style subdirectory assets and cross-origin config load');
    check(d.documentElement.scrollWidth <= w.innerWidth, 'login panel fits phone viewport: ' + d.documentElement.scrollWidth + '/' + w.innerWidth);
    check($('tripPage').hidden && d.querySelector('[data-action="create-trip"]').disabled, 'private UI requires account login');
    set('loginUsername', 'owner'); set('loginPassword', 'wrong-password'); $('loginForm').requestSubmit();
    await until(() => $('loginError').textContent, 'wrong login reports error');
    check($('accessDialog').open === false && !$('loginPanel').hidden, 'wrong password stays on account login, not legacy access-key dialog');
    set('loginPassword', 'test-password-only-1234'); $('loginForm').requestSubmit();
    await until(() => !$('welcome').hidden && !$('accountBar').hidden, 'owner login');
    check($('accountName').textContent === '測試主辦', 'owner login succeeds over CORS');
    // Keep a second device's session alive while UI logs out this device.
    const login = await fetch(apiBase + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({username:'owner',password:'test-password-only-1234'}) }).then(r => r.json());
    ownerToken = login.token;
    d.querySelector('[data-action="create-trip"]').click();
    set('tripName', '一起去海邊'); set('initialMembers', '小安\n小美'); $('tripForm').requestSubmit();
    await until(() => !$('tripDialog').open && $('tripTitle').textContent === '一起去海邊', 'new trip');
    const tripId = w.location.hash.slice(1);
    check(!d.documentElement.querySelector('#shareButton').hidden, 'owner can manage trip invitations');
    const secret = await ownerApi('/api/trips', 'POST', {name:'不分享的私人旅程',members:['甲','乙']});
    $('shareButton').click();
    await until(() => $('shareDialog').open && !$('remoteShare').hidden, 'remote share dialog');
    $('newInviteButton').click();
    await until(() => $('shareLink').value.includes('#invite='), 'generated invite');
    const link = $('shareLink').value;
    check(link.startsWith(location.origin + '/project/trip-split/static/#invite='), 'invitation preserves GitHub subpath and keeps secret in fragment');
    $('shareDialog').close(); $('logoutButton').click();
    await until(() => !$('loginPanel').hidden && $('tripPage').hidden, 'logout');
    check(!$('tripTitle').textContent && !$('expenseList').textContent, 'logout clears private rendered data');
    frame.src = link;
    await until(() => frame.contentDocument?.getElementById('loginInvite')?.value && !frame.contentDocument.getElementById('loginPanel').hidden, 'invited visitor');
    setup();
    check(!w.location.hash && !$('loginNameLabel').hidden, 'invitation is removed from address and opens invited registration');
    set('loginUsername', 'friend'); set('loginName', '小美'); set('loginPassword', 'friend-password-only-1234'); $('loginForm').requestSubmit();
    await until(() => !$('tripPage').hidden && $('tripTitle').textContent === '一起去海邊', 'register and join');
    check($('accountName').textContent === '小美' && $('settingsButton').disabled && $('shareButton').hidden, 'invited editor joins only assigned trip with correct controls');
    check(!$('tripPicker').textContent.includes(secret.trip.name), 'other owner trips remain private');
    $('addExpenseButton').click(); set('expenseTitle', '旅伴手機記的午餐'); set('expenseAmount', '600'); $('expenseForm').requestSubmit();
    await until(() => !$('expenseDialog').open, 'friend expense saved');
    const detail = await ownerApi('/api/trips/' + tripId);
    check(detail.total === 60000 && detail.expenses.length === 1, 'friend writes are immediately visible to owner API');
    await ownerApi('/api/trips/' + tripId + '/members', 'POST', {name:'另一台裝置新增'});
    await until(() => $('tripMeta').textContent.includes('3 位旅伴'), 'polling update without focus event');
    check($('tripMeta').textContent.includes('3 位旅伴'), 'five-second idle polling receives another device update');
    check(d.documentElement.scrollWidth <= w.innerWidth, 'signed-in account controls fit phone viewport');
    await new Promise(resolve => { frame.addEventListener('load', resolve, {once:true}); w.location.reload(); });
    await until(() => frame.contentDocument?.getElementById('accountName')?.textContent === '小美' && !frame.contentDocument.getElementById('tripPage').hidden, 'session reload'); setup();
    check($('tripTitle').textContent === '一起去海邊', 'reload restores session and persisted SQLite ledger');
    const users = await ownerApi('/api/trips/' + tripId + '/access');
    const friend = users.users.find(u => u.username === 'friend');
    await ownerApi('/api/trips/' + tripId + '/access/' + friend.id, 'DELETE');
    await until(() => $('tripPage').hidden && !$('welcome').hidden, 'removed editor loses trip on poll');
    check(!$('tripPicker').textContent.includes('一起去海邊'), 'revocation removes the trip without deleting its financial data');
    check((await ownerApi('/api/trips/' + tripId)).total === 60000, 'historical expenses survive account access removal');
    check(errors.length === 0, 'no browser runtime errors');
    document.getElementById('result').textContent = JSON.stringify({ok:true,count:checks.length,checks});
  } catch (error) {
    document.getElementById('result').textContent = JSON.stringify({ok:false,checks,error:error.stack,errors});
  }
})();
