const TYPE_CONFIG = {
  gmail: {
    label: 'Gmail',
    color: '#ea4335',
    icon: 'G',
    fields: [
      { key: 'email', label: 'E-mail', type: 'text' },
      { key: 'password', label: 'Senha', type: 'text', secret: true },
      { key: 'recoveryEmail', label: 'E-mail de recuperacao', type: 'text', optional: true },
      { key: 'notes', label: 'Notas', type: 'textarea', optional: true },
    ],
  },
  outlook: {
    label: 'Outlook',
    color: '#0072c6',
    icon: 'O',
    fields: [
      { key: 'email', label: 'E-mail', type: 'text' },
      { key: 'password', label: 'Senha', type: 'text', secret: true },
      { key: 'recoveryEmail', label: 'E-mail de recuperacao', type: 'text', optional: true },
      { key: 'notes', label: 'Notas', type: 'textarea', optional: true },
    ],
  },
  meta_ads: {
    label: 'Meta Ads',
    color: '#1877f2',
    icon: 'M',
    fields: [
      { key: 'email', label: 'E-mail', type: 'text' },
      { key: 'emailPassword', label: 'Senha do e-mail', type: 'text', secret: true },
      { key: 'facebookPassword', label: 'Senha do Facebook', type: 'text', secret: true },
      { key: 'totpSecret', label: 'Segredo 2FA (base32) - opcional', type: 'text', secret: true, optional: true },
      { key: 'cookies', label: 'Cookies (opcional)', type: 'textarea', secret: true, optional: true },
      { key: 'proxy', label: 'Proxy (opcional) - host:porta:usuario:senha', type: 'text', secret: true, optional: true },
      { key: 'notes', label: 'Notas', type: 'textarea', optional: true },
    ],
  },
  custom: {
    label: 'Outro',
    color: '#6b7280',
    icon: '?',
    fields: [
      { key: 'username', label: 'Usuario/E-mail', type: 'text' },
      { key: 'password', label: 'Senha', type: 'text', secret: true },
      { key: 'totpSecret', label: 'Segredo 2FA - opcional', type: 'text', secret: true, optional: true },
      { key: 'cookies', label: 'Cookies (opcional)', type: 'textarea', secret: true, optional: true },
      { key: 'proxy', label: 'Proxy (opcional)', type: 'text', secret: true, optional: true },
      { key: 'notes', label: 'Notas', type: 'textarea', optional: true },
    ],
  },
};

const STATUS_CONFIG = {
  ativo: { label: 'Ativo', color: '#16a34a' },
  restrita: { label: 'Restrita', color: '#f59e0b' },
  banida: { label: 'Banida', color: '#dc2626' },
  suspensa: { label: 'Suspensa', color: '#ea580c' },
  deletada: { label: 'Deletada', color: '#6b7280' },
};

const state = {
  credentials: [],
  editingId: null,
  detailId: null,
  totpInterval: null,
  gridTotpInterval: null,
};

const $ = (sel) => document.querySelector(sel);

async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'erro inesperado');
  return data;
}

function showToast(msg) {
  const toast = $('#toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.add('hidden'), 2200);
}

// ---------- Auth ----------

async function checkSession() {
  try {
    await api('/api/auth/me');
    showApp();
  } catch {
    showLogin();
  }
}

function showLogin() {
  stopGridTotpPolling();
  $('#login-view').classList.remove('hidden');
  $('#app-view').classList.add('hidden');
}

async function showApp() {
  $('#login-view').classList.add('hidden');
  $('#app-view').classList.remove('hidden');
  await loadCredentials();
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#login-email').value.trim();
  const password = $('#login-password').value;
  $('#login-error').classList.add('hidden');
  try {
    await api('/api/auth/login', { method: 'POST', body: { email, password } });
    $('#login-password').value = '';
    await showApp();
  } catch (err) {
    $('#login-error').textContent = err.message;
    $('#login-error').classList.remove('hidden');
  }
});

$('#logout-btn').addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' });
  showLogin();
});

// ---------- List ----------

async function loadCredentials() {
  state.credentials = await api('/api/credentials');
  renderGrid();
}

function renderGrid() {
  const grid = $('#grid');
  const query = $('#search-input').value.trim().toLowerCase();
  const statusValue = statusFilter.value;
  const items = state.credentials.filter((c) => {
    if (statusValue && c.status !== statusValue) return false;
    if (!query) return true;
    const haystack = `${c.name} ${c.fields.email || c.fields.username || ''}`.toLowerCase();
    return haystack.includes(query);
  });

  grid.innerHTML = '';
  $('#empty-state').classList.toggle('hidden', state.credentials.length > 0);

  for (const cred of items) {
    const cfg = TYPE_CONFIG[cred.type] || TYPE_CONFIG.custom;
    const statusCfg = STATUS_CONFIG[cred.status] || STATUS_CONFIG.ativo;
    const card = document.createElement('div');
    card.className = 'cred-card';
    card.innerHTML = `
      <div class="cred-card-head">
        <div class="type-badge" style="background:${cfg.color}">${cfg.icon}</div>
        <div class="cred-card-info">
          <div class="cred-card-name">${escapeHtml(cred.name)}</div>
          <div class="cred-card-sub">${cfg.label}</div>
        </div>
        <span class="status-badge" style="background:${statusCfg.color}">${statusCfg.label}</span>
      </div>
      <div class="cred-card-sub">${escapeHtml(cred.fields.email || cred.fields.username || '')}</div>
      ${cred.fields.totpSecret ? `
        <div class="cred-card-totp" data-totp-id="${cred.id}" title="Copiar codigo 2FA">
          <span class="totp-mini-code">------</span>
          <span class="totp-mini-remaining"></span>
        </div>
      ` : ''}
      <div class="cred-card-actions">
        <button type="button" class="small-btn ghost edit-btn">Editar</button>
      </div>
    `;
    card.addEventListener('click', () => openDetail(cred.id));
    card.querySelector('.edit-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openForm(cred);
    });
    const totpBox = card.querySelector('.cred-card-totp');
    if (totpBox) {
      totpBox.addEventListener('click', (e) => {
        e.stopPropagation();
        const code = totpBox.querySelector('.totp-mini-code').textContent;
        if (code && code !== '------') copyToClipboard(code, 'Codigo copiado');
      });
    }
    grid.appendChild(card);
  }

  startGridTotpPolling();
}

function stopGridTotpPolling() {
  if (state.gridTotpInterval) {
    clearInterval(state.gridTotpInterval);
    state.gridTotpInterval = null;
  }
}

async function tickGridTotp() {
  const boxes = document.querySelectorAll('.cred-card-totp');
  if (boxes.length === 0) {
    stopGridTotpPolling();
    return;
  }
  await Promise.all(
    Array.from(boxes).map(async (box) => {
      try {
        const { code, remaining } = await api(`/api/credentials/${box.dataset.totpId}/totp`);
        box.querySelector('.totp-mini-code').textContent = code;
        box.querySelector('.totp-mini-remaining').textContent = `${remaining}s`;
      } catch {
        // ignora falha pontual de uma credencial e segue com as demais
      }
    })
  );
}

function startGridTotpPolling() {
  stopGridTotpPolling();
  if (!document.querySelector('.cred-card-totp')) return;
  tickGridTotp();
  state.gridTotpInterval = setInterval(tickGridTotp, 1000);
}

$('#search-input').addEventListener('input', renderGrid);

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

// ---------- Form (create/edit) ----------

const typeSelect = $('#cred-type');
for (const [key, cfg] of Object.entries(TYPE_CONFIG)) {
  const opt = document.createElement('option');
  opt.value = key;
  opt.textContent = cfg.label;
  typeSelect.appendChild(opt);
}

const statusSelect = $('#cred-status');
for (const [key, cfg] of Object.entries(STATUS_CONFIG)) {
  const opt = document.createElement('option');
  opt.value = key;
  opt.textContent = cfg.label;
  statusSelect.appendChild(opt);
}

const statusFilter = $('#status-filter');
statusFilter.appendChild(new Option('Todos os status', ''));
for (const [key, cfg] of Object.entries(STATUS_CONFIG)) {
  statusFilter.appendChild(new Option(cfg.label, key));
}
statusFilter.addEventListener('change', renderGrid);

function renderDynamicFields(type, values = {}) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.custom;
  const container = $('#dynamic-fields');
  container.innerHTML = '';
  for (const field of cfg.fields) {
    const label = document.createElement('label');
    label.textContent = field.label + (field.optional ? ' (opcional)' : '');
    let input;
    if (field.type === 'textarea') {
      input = document.createElement('textarea');
    } else {
      input = document.createElement('input');
      input.type = field.secret ? 'password' : 'text';
    }
    input.name = field.key;
    input.value = values[field.key] || '';
    if (!field.optional) input.required = true;
    label.appendChild(input);
    container.appendChild(label);
  }
}

typeSelect.addEventListener('change', () => renderDynamicFields(typeSelect.value));

function openForm(existing) {
  state.editingId = existing ? existing.id : null;
  $('#form-title').textContent = existing ? 'Editar credencial' : 'Nova credencial';
  $('#cred-name').value = existing ? existing.name : '';
  statusSelect.value = existing ? existing.status || 'ativo' : 'ativo';
  typeSelect.value = existing ? existing.type : 'gmail';
  renderDynamicFields(typeSelect.value, existing ? existing.fields : {});
  $('#form-error').classList.add('hidden');
  $('#form-overlay').classList.remove('hidden');
}

function closeForm() {
  $('#form-overlay').classList.add('hidden');
  state.editingId = null;
}

$('#add-btn').addEventListener('click', () => openForm(null));
$('#cancel-form-btn').addEventListener('click', closeForm);

$('#cred-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const type = typeSelect.value;
  const name = $('#cred-name').value.trim();
  const status = statusSelect.value;
  const fields = {};
  for (const el of $('#dynamic-fields').querySelectorAll('input, textarea')) {
    if (el.value) fields[el.name] = el.value;
  }

  $('#form-error').classList.add('hidden');
  try {
    if (state.editingId) {
      await api(`/api/credentials/${state.editingId}`, { method: 'PUT', body: { type, name, status, fields } });
      showToast('Credencial atualizada');
    } else {
      await api('/api/credentials', { method: 'POST', body: { type, name, status, fields } });
      showToast('Credencial criada');
    }
    closeForm();
    await loadCredentials();
  } catch (err) {
    $('#form-error').textContent = err.message;
    $('#form-error').classList.remove('hidden');
  }
});

// ---------- Detail ----------

function stopTotpPolling() {
  if (state.totpInterval) {
    clearInterval(state.totpInterval);
    state.totpInterval = null;
  }
}

async function openDetail(id) {
  const cred = state.credentials.find((c) => c.id === id);
  if (!cred) return;
  state.detailId = id;
  const cfg = TYPE_CONFIG[cred.type] || TYPE_CONFIG.custom;

  const statusCfg = STATUS_CONFIG[cred.status] || STATUS_CONFIG.ativo;
  $('#detail-title').innerHTML = `${escapeHtml(cfg.label)} - ${escapeHtml(cred.name)} <span class="status-badge" style="background:${statusCfg.color}">${statusCfg.label}</span>`;
  const body = $('#detail-body');
  body.innerHTML = '<div class="detail-fields" id="detail-fields"></div>';
  const fieldsContainer = $('#detail-fields');

  if (cred.fields.totpSecret) {
    const totpBox = document.createElement('div');
    totpBox.className = 'totp-box';
    totpBox.innerHTML = `
      <div class="totp-ring" id="totp-ring" style="--pct:100"><span id="totp-remaining">30</span></div>
      <div>
        <div class="totp-code" id="totp-code">------</div>
        <div class="muted" style="font-size:12px">codigo 2FA gerado automaticamente</div>
      </div>
      <button type="button" class="small-btn" id="copy-totp-btn">Copiar</button>
    `;
    fieldsContainer.appendChild(totpBox);
    $('#copy-totp-btn').addEventListener('click', () => copyToClipboard($('#totp-code').textContent, 'Codigo copiado'));
    startTotpPolling(id);
  } else {
    stopTotpPolling();
  }

  for (const field of cfg.fields) {
    if (field.key === 'totpSecret') continue;
    const value = cred.fields[field.key];
    if (!value) continue;

    const group = document.createElement('div');
    group.className = 'field-group';
    const rowClass = field.secret ? 'field-value-row masked' : 'field-value-row';
    group.innerHTML = `
      <div class="field-label">${field.label}</div>
      <div class="${rowClass}">
        <span class="value-text">${escapeHtml(value)}</span>
        ${field.secret ? '<button type="button" class="small-btn reveal-btn">Ver</button>' : ''}
        <button type="button" class="small-btn copy-btn">Copiar</button>
      </div>
    `;
    const revealBtn = group.querySelector('.reveal-btn');
    if (revealBtn) {
      revealBtn.addEventListener('click', () => {
        const row = group.querySelector('.field-value-row');
        const masked = row.classList.toggle('masked');
        revealBtn.textContent = masked ? 'Ver' : 'Ocultar';
      });
    }
    group.querySelector('.copy-btn').addEventListener('click', () => copyToClipboard(value, `${field.label} copiado`));
    fieldsContainer.appendChild(group);
  }

  $('#detail-overlay').classList.remove('hidden');
}

async function startTotpPolling(id) {
  stopTotpPolling();
  const tick = async () => {
    try {
      const { code, remaining, period } = await api(`/api/credentials/${id}/totp`);
      $('#totp-code').textContent = code;
      $('#totp-remaining').textContent = remaining;
      $('#totp-ring').style.setProperty('--pct', Math.round((remaining / period) * 100));
    } catch {
      stopTotpPolling();
    }
  };
  await tick();
  state.totpInterval = setInterval(tick, 1000);
}

function closeDetail() {
  $('#detail-overlay').classList.add('hidden');
  stopTotpPolling();
  state.detailId = null;
}

$('#close-detail-btn').addEventListener('click', closeDetail);

$('#edit-from-detail-btn').addEventListener('click', () => {
  const cred = state.credentials.find((c) => c.id === state.detailId);
  closeDetail();
  openForm(cred);
});

$('#delete-btn').addEventListener('click', async () => {
  if (!confirm('Excluir esta credencial permanentemente?')) return;
  await api(`/api/credentials/${state.detailId}`, { method: 'DELETE' });
  closeDetail();
  await loadCredentials();
  showToast('Credencial excluida');
});

async function copyToClipboard(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(message);
  } catch {
    showToast('Nao foi possivel copiar');
  }
}

checkSession();
