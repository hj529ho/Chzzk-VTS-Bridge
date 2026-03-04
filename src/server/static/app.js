// ===== State =====
let rules = [];
let vtsHotkeys = [];
let vtsExpressions = [];
let vtsItems = [];
let vtsConnected = false;

// ===== DOM refs =====
const $ = (sel) => document.querySelector(sel);
const wizard = $('#wizard');
const dashboard = $('#dashboard');
const rulesList = $('#rules-list');
const logFeed = $('#log-feed');
const modalOverlay = $('#modal-overlay');
const settingsOverlay = $('#settings-overlay');
const ruleForm = $('#rule-form');
const actionsContainer = $('#actions-container');

// ===== Init =====
(async () => {
  const status = await api('/api/status');
  if (!status.chzzk.configured) {
    showWizard();
  } else {
    showDashboard();
  }
})();

// ===== WebSocket =====
const ws = new WebSocket(`ws://${location.host}/ws`);
ws.onmessage = (e) => handleWs(JSON.parse(e.data));
ws.onclose = () => addLog('system', '대시보드 연결이 끊겼어요. 페이지를 새로고침 해주세요.');

function handleWs(msg) {
  switch (msg.type) {
    case 'vts:connected':
      updateStatus({ vts: true });
      addLog('system', 'VTuber Studio 연결됨!');
      loadVtsData();
      break;
    case 'vts:disconnected':
      updateStatus({ vts: false });
      addLog('system', 'VTuber Studio 연결이 끊겼어요');
      break;
    case 'chzzk:connected':
      updateStatus({ chzzk: true });
      addLog('system', '치지직 연결됨!');
      break;
    case 'chzzk:disconnected':
      updateStatus({ chzzk: false });
      addLog('system', '치지직 연결이 끊겼어요');
      break;
    case 'chzzk:donation': {
      const d = msg.data;
      addLog('donation', `${d.donatorNickname}님이 ${d.payAmount.toLocaleString()}원 후원! "${d.donationText}"`);
      break;
    }
    case 'chzzk:chat': {
      const c = msg.data;
      addLog('chat', `${c.nickname}: ${c.content}`);
      break;
    }
    case 'bridge:rule-matched':
      addLog('rule', `[${msg.data.ruleName}] 규칙이 반응했어요`);
      break;
    case 'bridge:action-triggered':
      const labels = { hotkey: '핫키 실행', expression: '표정 변경', item: '아이템', tint: '색상 변경' };
      addLog('action', `${labels[msg.data.actionType] || msg.data.actionType}: ${msg.data.detail}`);
      break;
  }
}

// ===== API helper =====
async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return res.json();
}

// ===== Status =====
function updateStatus({ vts, chzzk }) {
  if (vts !== undefined) {
    vtsConnected = vts;
    const card = $('#card-vts');
    card.className = `status-card ${vts ? 'connected' : 'disconnected'}`;
    $('#state-vts').textContent = vts ? '연결됨' : '연결 안 됨';
  }
  if (chzzk !== undefined) {
    const card = $('#card-chzzk');
    card.className = `status-card ${chzzk ? 'connected' : 'disconnected'}`;
    $('#state-chzzk').textContent = chzzk ? '연결됨' : '연결 안 됨';
  }
}

async function pollStatus() {
  try {
    const s = await api('/api/status');
    updateStatus({ vts: s.vts.connected, chzzk: s.chzzk.connected });
    // Update wizard VTS status if visible
    const vtsWiz = $('#vts-wizard-status');
    if (vtsWiz && !wizard.classList.contains('hidden')) {
      if (s.vts.connected) {
        vtsWiz.className = 'status-check ok';
        vtsWiz.innerHTML = '<span class="status-icon">&#10004;</span><span class="status-text">VTuber Studio 연결 성공!</span>';
      } else {
        vtsWiz.className = 'status-check fail';
        vtsWiz.innerHTML = '<span class="status-icon">...</span><span class="status-text">VTuber Studio를 실행하고 API를 켜주세요</span>';
      }
    }
  } catch { /* ignore */ }
}
setInterval(pollStatus, 3000);

// ===== VTS Data =====
async function loadVtsData() {
  try {
    vtsHotkeys = await api('/api/vts/hotkeys');
    vtsExpressions = await api('/api/vts/expressions');
    vtsItems = await api('/api/vts/items');
  } catch { /* ignore */ }
}

// ===== Wizard =====
function showWizard() {
  wizard.classList.remove('hidden');
  dashboard.classList.add('hidden');
}

function showDashboard() {
  wizard.classList.add('hidden');
  dashboard.classList.remove('hidden');
  loadRules();
  loadVtsData();
  pollStatus();
}

window.wizardGoTo = (step) => {
  for (let i = 1; i <= 3; i++) {
    const el = $(`#wizard-step-${i}`);
    el.classList.toggle('hidden', i !== step);
    const dot = $(`.step-dot[data-step="${i}"]`);
    dot.className = `step-dot ${i < step ? 'done' : i === step ? 'active' : ''}`;
  }
};

// Step 1: Save settings
$('#btn-save-settings').onclick = async () => {
  const clientId = $('#inp-client-id').value.trim();
  const clientSecret = $('#inp-client-secret').value.trim();
  const channelId = $('#inp-channel-id').value.trim();

  if (!clientId || !clientSecret || !channelId) {
    alert('모든 항목을 입력해주세요!');
    return;
  }

  await api('/api/settings', { method: 'PUT', body: { clientId, clientSecret, channelId } });
  wizardGoTo(2);
};

// Step 2: Chzzk login
$('#btn-chzzk-login').onclick = () => {
  window.open('/auth/chzzk', '_blank', 'width=600,height=700');
  $('#chzzk-login-hint').textContent = '로그인 중... 완료되면 이 창이 자동으로 닫혀요';
};

$('#btn-step2-next').onclick = () => wizardGoTo(3);

// Step 3: Finish
$('#btn-finish-wizard').onclick = () => showDashboard();

// ===== Settings modal =====
$('#btn-open-settings').onclick = async () => {
  const s = await api('/api/settings');
  $('#set-client-id').value = '';
  $('#set-client-id').placeholder = s.clientId || '미설정';
  $('#set-client-secret').value = '';
  $('#set-client-secret').placeholder = s.clientSecret || '미설정';
  $('#set-channel-id').value = s.channelId || '';
  settingsOverlay.classList.remove('hidden');
};
$('#btn-settings-close').onclick = () => settingsOverlay.classList.add('hidden');
$('#btn-settings-cancel').onclick = () => settingsOverlay.classList.add('hidden');
$('#btn-settings-save').onclick = async () => {
  const body = {};
  const cid = $('#set-client-id').value.trim();
  const csec = $('#set-client-secret').value.trim();
  const chid = $('#set-channel-id').value.trim();
  // Only send if user actually typed something new
  if (cid) body.clientId = cid;
  if (csec) body.clientSecret = csec;
  if (chid) body.channelId = chid;

  if (Object.keys(body).length > 0) {
    // Merge with existing
    const existing = await api('/api/settings');
    const merged = {
      clientId: body.clientId || '',
      clientSecret: body.clientSecret || '',
      channelId: body.channelId || existing.channelId || '',
    };
    // If user left fields empty, we need to keep old ones - but we can't see them
    // So we need full values for saving. Ask user to re-enter if they want to change.
    await api('/api/settings', { method: 'PUT', body: merged });
  }
  settingsOverlay.classList.add('hidden');
  alert('설정이 저장되었어요! 서버를 재시작하면 적용돼요.');
};

// ===== Rules =====
async function loadRules() {
  rules = await api('/api/rules');
  renderRules();
}

function renderRules() {
  if (rules.length === 0) {
    rulesList.innerHTML = '<div class="empty-state">아직 규칙이 없어요. 위 버튼을 눌러 첫 규칙을 만들어보세요!</div>';
    return;
  }

  rulesList.innerHTML = '';
  for (const rule of rules) {
    const card = document.createElement('div');
    card.className = `rule-card ${rule.enabled ? '' : 'disabled'}`;

    const et = rule.conditions.eventType ?? 'donation';
    const triggerLabel = et === 'chat' ? '채팅' : et === '*' ? '전체' : '후원';
    const triggerClass = et === 'chat' ? 'badge-chat' : et === '*' ? 'badge-all' : 'badge-donation';

    const parts = [];
    if (et !== 'chat') {
      if (rule.conditions.minAmount != null) parts.push(`${rule.conditions.minAmount.toLocaleString()}원 이상`);
      if (rule.conditions.maxAmount != null) parts.push(`${rule.conditions.maxAmount.toLocaleString()}원 이하`);
      if (rule.conditions.donationType === 'CHAT') parts.push('채팅 후원');
      if (rule.conditions.donationType === 'VIDEO') parts.push('영상 후원');
    }
    if (rule.conditions.nicknamePattern) parts.push(`닉네임: "${rule.conditions.nicknamePattern}"`);
    if (rule.conditions.textPattern) parts.push(`"${rule.conditions.textPattern}" 포함`);

    const actionLabels = { hotkey: '핫키', expression: '표정', item: '아이템', tint: '색상' };
    const actionSummary = rule.actions.map(a => actionLabels[a.type] || a.type).join(', ');

    const defaultTrigger = et === 'chat' ? '모든 채팅' : '모든 후원';

    card.innerHTML = `
      <div class="rule-info">
        <div class="rule-name"><span class="trigger-badge ${triggerClass}">${triggerLabel}</span> ${esc(rule.name)}</div>
        <div class="rule-summary">${parts.join(', ') || defaultTrigger} &rarr; ${actionSummary}</div>
      </div>
      <div class="rule-btns">
        <button class="btn-sub btn-sm" data-test="${esc(rule.id)}">테스트</button>
        <button class="btn-sub btn-sm" data-edit="${esc(rule.id)}">편집</button>
        <button class="btn-sub btn-sm btn-danger" data-del="${esc(rule.id)}">삭제</button>
      </div>
    `;
    rulesList.appendChild(card);
  }

  // Event delegation
  rulesList.onclick = async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const testId = btn.dataset.test;
    const editId = btn.dataset.edit;
    const delId = btn.dataset.del;

    if (testId) {
      await api(`/api/rules/${testId}/test`, { method: 'POST' });
      addLog('system', '테스트 실행!');
    }
    if (editId) {
      const rule = rules.find(r => r.id === editId);
      if (rule) openRuleModal(rule);
    }
    if (delId) {
      if (!confirm('이 규칙을 삭제할까요?')) return;
      await api(`/api/rules/${delId}`, { method: 'DELETE' });
      loadRules();
    }
  };
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ===== Rule Modal =====
let editingId = null;

$('#btn-add-rule').onclick = () => openRuleModal(null);
$('#btn-modal-close').onclick = closeModal;
$('#btn-cancel').onclick = closeModal;

function closeModal() { modalOverlay.classList.add('hidden'); }

async function openRuleModal(rule) {
  // 모달 열 때마다 VTS에서 최신 핫키/표정 목록 가져오기
  await loadVtsData();

  editingId = rule?.id ?? null;
  $('#modal-title').textContent = rule ? '규칙 편집' : '새 규칙 만들기';

  const f = ruleForm;
  f.id.value = rule?.id ?? `rule-${Date.now()}`;
  f.name.value = rule?.name ?? '';
  f.eventType.value = rule?.conditions?.eventType ?? 'donation';
  f.minAmount.value = rule?.conditions?.minAmount ?? '';
  f.maxAmount.value = rule?.conditions?.maxAmount ?? '';
  f.donationType.value = rule?.conditions?.donationType ?? '*';

  // Convert regex-like pattern back to comma-separated words for display
  const tp = rule?.conditions?.textPattern ?? '';
  f.textPattern.value = tp.replace(/\|/g, ', ');

  const np = rule?.conditions?.nicknamePattern ?? '';
  f.nicknamePattern.value = np.replace(/\|/g, ', ');

  // Cooldown: stored as ms, display as seconds
  f.cooldown.value = rule?.cooldown ? rule.cooldown / 1000 : 5;

  actionsContainer.innerHTML = '';
  if (rule?.actions?.length) {
    for (const a of rule.actions) addActionBlock(a);
  }

  toggleEventTypeFields(f.eventType.value);
  modalOverlay.classList.remove('hidden');
}

// ===== Event type toggle =====
function toggleEventTypeFields(eventType) {
  const donationConds = $('#donation-conditions');
  const chatConds = $('#chat-conditions');
  if (eventType === 'chat') {
    donationConds.classList.add('hidden');
    chatConds.classList.remove('hidden');
  } else if (eventType === 'donation') {
    donationConds.classList.remove('hidden');
    chatConds.classList.add('hidden');
  } else {
    // "*" = 전체: show both
    donationConds.classList.remove('hidden');
    chatConds.classList.remove('hidden');
  }
}

$('#rf-event-type').onchange = (e) => toggleEventTypeFields(e.target.value);

$('#btn-add-action').onclick = () => addActionBlock(null);

function addActionBlock(action) {
  const block = document.createElement('div');
  block.className = 'action-block';

  const type = action?.type ?? 'hotkey';
  block.innerHTML = `
    <button type="button" class="btn-remove-action">&times;</button>
    <div class="form-group">
      <label>반응 종류</label>
      <select class="action-type">
        <option value="hotkey" ${type === 'hotkey' ? 'selected' : ''}>핫키 실행</option>
        <option value="expression" ${type === 'expression' ? 'selected' : ''}>표정 변경</option>
        <option value="item" ${type === 'item' ? 'selected' : ''}>아이템 표시</option>
        <option value="tint" ${type === 'tint' ? 'selected' : ''}>얼굴 색 변경</option>
      </select>
    </div>
    <div class="action-fields"></div>
    <div class="form-group">
      <label>실행 지연 (초)</label>
      <input class="action-delay" type="number" min="0" step="0.1" value="${action?.delay ? action.delay / 1000 : 0}">
      <span class="hint">0이면 바로 실행돼요</span>
    </div>
  `;

  const select = block.querySelector('.action-type');
  select.onchange = () => renderFields(block, select.value, null);
  block.querySelector('.btn-remove-action').onclick = () => block.remove();

  actionsContainer.appendChild(block);
  renderFields(block, type, action);
}

function renderFields(block, type, action) {
  const c = block.querySelector('.action-fields');

  switch (type) {
    case 'hotkey':
      c.innerHTML = `
        <div class="form-group">
          <label>실행할 핫키</label>
          <select class="af-hotkeyId">
            ${vtsHotkeys.length
              ? vtsHotkeys.map(h => `<option value="${esc(h.hotkeyID)}" ${action?.hotkeyId === h.hotkeyID ? 'selected' : ''}>${esc(h.name)}</option>`).join('')
              : `<option value="">${vtsConnected ? '등록된 핫키가 없어요' : 'VTuber Studio를 먼저 연결해주세요'}</option>`
            }
          </select>
          <span class="hint">${vtsConnected && !vtsHotkeys.length ? 'VTuber Studio에서 핫키를 먼저 등록해주세요' : 'VTuber Studio에 설정된 핫키 목록이에요'}</span>
        </div>
      `;
      break;

    case 'expression':
      c.innerHTML = `
        <div class="form-group">
          <label>실행할 표정</label>
          <select class="af-expressionFile">
            ${vtsExpressions.length
              ? vtsExpressions.map(e => `<option value="${esc(e.file)}" ${action?.expressionFile === e.file ? 'selected' : ''}>${esc(e.name)}</option>`).join('')
              : `<option value="">${vtsConnected ? '등록된 표정이 없어요' : 'VTuber Studio를 먼저 연결해주세요'}</option>`
            }
          </select>
          <span class="hint">${vtsConnected && !vtsExpressions.length ? 'VTuber Studio에서 표정을 먼저 추가해주세요' : ''}</span>
        </div>
        <div class="form-group">
          <label>유지 시간 (초, 비우면 계속 유지)</label>
          <input class="af-duration" type="number" min="0" step="0.5" value="${action?.duration ? action.duration / 1000 : ''}">
        </div>
      `;
      break;

    case 'item':
      c.innerHTML = `
        <div class="form-group">
          <label>표시할 아이템</label>
          <select class="af-fileName">
            ${vtsItems.length
              ? vtsItems.map(i => `<option value="${esc(i.fileName)}" ${action?.fileName === i.fileName ? 'selected' : ''}>${esc(i.fileName)}</option>`).join('')
              : `<option value="">${vtsConnected ? '사용 가능한 아이템이 없어요' : 'VTuber Studio를 먼저 연결해주세요'}</option>`
            }
          </select>
          <span class="hint">${vtsConnected && !vtsItems.length ? 'VTuber Studio 아이템 폴더에 이미지를 넣어주세요' : ''}</span>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>X 위치</label>
            <input class="af-positionX" type="number" step="0.1" value="${action?.positionX ?? 0}">
          </div>
          <div class="form-group">
            <label>Y 위치</label>
            <input class="af-positionY" type="number" step="0.1" value="${action?.positionY ?? 0}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>크기</label>
            <input class="af-size" type="number" step="0.01" min="0" value="${action?.size ?? 0.1}">
          </div>
          <div class="form-group">
            <label>표시 시간 (초)</label>
            <input class="af-duration" type="number" min="0" step="0.5" value="${action?.duration ? action.duration / 1000 : ''}">
          </div>
        </div>
      `;
      break;

    case 'tint':
      c.innerHTML = `
        <div class="form-group">
          <label>색상 선택</label>
          <input class="af-color" type="color" value="${action ? rgbToHex(action.colorR, action.colorG, action.colorB) : '#ff9696'}">
        </div>
        <div class="form-group">
          <label><input type="checkbox" class="af-tintAll" ${action?.tintAll !== false ? 'checked' : ''}> 얼굴 전체에 적용</label>
        </div>
        <div class="form-group">
          <label>유지 시간 (초)</label>
          <input class="af-duration" type="number" min="0" step="0.5" value="${action?.duration ? action.duration / 1000 : 3}">
        </div>
      `;
      break;
  }
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => (x ?? 255).toString(16).padStart(2, '0')).join('');
}
function hexToRgb(hex) {
  const m = hex.match(/^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 255, g: 255, b: 255 };
}

function collectActions() {
  const blocks = actionsContainer.querySelectorAll('.action-block');
  const actions = [];
  for (const block of blocks) {
    const type = block.querySelector('.action-type').value;
    const delaySec = parseFloat(block.querySelector('.action-delay').value) || 0;
    const delay = Math.round(delaySec * 1000);
    const fields = block.querySelector('.action-fields');

    switch (type) {
      case 'hotkey':
        actions.push({ type, delay, hotkeyId: fields.querySelector('.af-hotkeyId')?.value ?? '' });
        break;
      case 'expression': {
        const durSec = parseFloat(fields.querySelector('.af-duration')?.value);
        actions.push({
          type, delay,
          expressionFile: fields.querySelector('.af-expressionFile')?.value ?? '',
          active: true,
          ...(durSec ? { duration: Math.round(durSec * 1000) } : {}),
        });
        break;
      }
      case 'item': {
        const durSec = parseFloat(fields.querySelector('.af-duration')?.value);
        const fileSelect = fields.querySelector('select.af-fileName');
        actions.push({
          type, delay,
          fileName: fileSelect?.value ?? '',
          positionX: parseFloat(fields.querySelector('.af-positionX')?.value) || 0,
          positionY: parseFloat(fields.querySelector('.af-positionY')?.value) || 0,
          size: parseFloat(fields.querySelector('.af-size')?.value) || 0.1,
          ...(durSec ? { duration: Math.round(durSec * 1000) } : {}),
        });
        break;
      }
      case 'tint': {
        const hex = fields.querySelector('.af-color')?.value ?? '#ff9696';
        const { r, g, b } = hexToRgb(hex);
        const durSec = parseFloat(fields.querySelector('.af-duration')?.value);
        actions.push({
          type, delay,
          colorR: r, colorG: g, colorB: b, colorA: 255,
          tintAll: fields.querySelector('.af-tintAll')?.checked ?? true,
          nameContains: [],
          ...(durSec ? { duration: Math.round(durSec * 1000) } : {}),
        });
        break;
      }
    }
  }
  return actions;
}

ruleForm.onsubmit = async (e) => {
  e.preventDefault();
  const f = ruleForm;
  const actions = collectActions();

  if (actions.length === 0) {
    alert('반응을 최소 1개 추가해주세요!');
    return;
  }

  // Convert comma-separated words to regex pattern
  const rawText = f.textPattern.value.trim();
  const textPattern = rawText
    ? rawText.split(/[,，]\s*/).filter(Boolean).join('|')
    : undefined;

  const rawNick = f.nicknamePattern.value.trim();
  const nicknamePattern = rawNick
    ? rawNick.split(/[,，]\s*/).filter(Boolean).join('|')
    : undefined;

  const eventType = f.eventType.value;

  const rule = {
    id: f.id.value,
    name: f.name.value,
    enabled: true,
    conditions: {
      eventType,
      ...(eventType !== 'chat' && f.minAmount.value ? { minAmount: parseInt(f.minAmount.value) } : {}),
      ...(eventType !== 'chat' && f.maxAmount.value ? { maxAmount: parseInt(f.maxAmount.value) } : {}),
      donationType: eventType !== 'chat' ? f.donationType.value : '*',
      ...(textPattern ? { textPattern } : {}),
      ...(nicknamePattern ? { nicknamePattern } : {}),
    },
    actions,
    cooldown: Math.round((parseFloat(f.cooldown.value) || 5) * 1000),
  };

  try {
    if (editingId) {
      await api(`/api/rules/${editingId}`, { method: 'PUT', body: rule });
    } else {
      await api('/api/rules', { method: 'POST', body: rule });
    }
    closeModal();
    loadRules();
  } catch (err) {
    alert('저장에 실패했어요: ' + err.message);
  }
};

// ===== Test Tabs =====
document.querySelectorAll('.test-tab').forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll('.test-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.tab;
    $('#test-donation-panel').classList.toggle('hidden', target !== 'donation');
    $('#test-chat-panel').classList.toggle('hidden', target !== 'chat');
  };
});

// ===== Test Donation =====
$('#btn-test-donation').onclick = async () => {
  const nickname = $('#test-nick').value || '테스트 유저';
  const amount = parseInt($('#test-amount').value) || 1000;
  const text = $('#test-text').value || '테스트 후원이에요!';

  await api('/api/test-donation', { method: 'POST', body: { nickname, amount, text } });
};

// ===== Test Chat =====
$('#btn-test-chat').onclick = async () => {
  const nickname = $('#test-chat-nick').value || '테스트 유저';
  const text = $('#test-chat-text').value || '안녕하세요!';

  await api('/api/test-chat', { method: 'POST', body: { nickname, text } });
};

// ===== Log =====
function addLog(type, text) {
  // Remove empty state
  const empty = logFeed.querySelector('.empty-state');
  if (empty) empty.remove();

  const el = document.createElement('div');
  el.className = `log-entry ${type}`;
  const time = new Date().toLocaleTimeString('ko-KR');
  el.textContent = `[${time}] ${text}`;
  logFeed.prepend(el);
  while (logFeed.children.length > 200) logFeed.lastChild.remove();
}
