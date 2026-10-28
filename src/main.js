import { createPlan, buildPrototype, requestChange, runChecks, configureAgent } from './agent/index.js';
import { validateIdea, validateRequest, IDEA_MAX, REQUEST_MAX } from './agent/validate.js';
import { describePlan } from './agent/planner.js';
import { SUGGESTED_CHANGES } from './agent/reviser.js';
import { validateRepoUrl } from './agent/checks.js';
import { GENRES, THEMES } from './agent/catalog.js';
import { buildGameHtml, buildStartngJson, escapeHtml as esc } from './game/buildGame.js';
import { renderCover } from './game/cover.js';

const STORAGE_KEY = 'gcc:draft:v1';
const IDEA_EXAMPLES = [
  'Catch falling jollof and chicken in a busy Lagos kitchen, but dodge the cockroaches',
  'An okada rider weaving through Lagos traffic to deliver parcels',
  'A rocket that blasts aliens to protect the stars',
  'An endless runner where a dancer jumps over puddles on the way to an owambe',
];

const $ = (id) => document.getElementById(id);
const els = {
  log: $('log'), form: $('composer'), prompt: $('prompt'), label: $('prompt-label'), hint: $('prompt-hint'),
  error: $('prompt-error'), count: $('prompt-count'), chips: $('chips'), send: $('send'),
  stepper: $('stepper'), tabs: $('tabs'), panel: $('tab-panel'), badge: $('version-badge'),
  startOver: $('start-over'), workspace: $('workspace'), status: $('sr-status'),
};

// ---------- state ----------

const state = {
  idea: '',
  versions: [], // [{ config, note }]
  current: -1,
  built: false,
  tab: 'plan',
  pending: null, // { request, changes, next, msg }
  previewProposed: false,
  busy: false,
  checks: null, // { version, result }
  cover: null, // { version, blob, url }
  repo: '',
  prepared: null, // { version, body, curl }
};

const config = () => state.versions[state.current]?.config ?? null;
const versionLabel = (i = state.current) => `v${i + 1}`;

function save() {
  try {
    const { idea, versions, current, built, repo } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ idea, versions, current, built, repo }));
  } catch {
    /* storage is optional */
  }
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    const valid = (c) => c && GENRES[c.genre] && THEMES[c.theme] && typeof c.title === 'string' && typeof c.slug === 'string';
    if (!saved?.versions?.length || !saved.versions.every((v) => valid(v.config))) return false;
    Object.assign(state, {
      idea: String(saved.idea || ''),
      versions: saved.versions,
      current: Math.min(Math.max(0, saved.current | 0), saved.versions.length - 1),
      built: !!saved.built,
      repo: String(saved.repo || ''),
      tab: saved.built ? 'prototype' : 'plan',
    });
    return true;
  } catch {
    return false;
  }
}

function announce(text) {
  els.status.textContent = '';
  requestAnimationFrame(() => (els.status.textContent = text));
}

// ---------- conversation ----------

let msgSeq = 0;
function addMessage(role, html, { kind = '' } = {}) {
  const el = document.createElement('div');
  el.className = `msg ${role} ${kind}`.trim();
  el.id = `msg-${++msgSeq}`;
  const who = role === 'user' ? 'You' : role === 'agent' ? 'Copilot (demo)' : 'Update';
  el.innerHTML = `<p class="who">${who}</p><div class="bubble">${html}</div>`;
  els.log.append(el);
  els.log.scrollTop = els.log.scrollHeight;
  return el;
}

function showThinking() {
  const el = document.createElement('div');
  el.className = 'msg agent thinking';
  el.setAttribute('aria-busy', 'true');
  el.innerHTML = `<p class="who">Copilot (demo)</p><div class="bubble"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span> <span class="label">Thinking…</span> <span class="progress-text"></span></div>`;
  els.log.append(el);
  els.log.scrollTop = els.log.scrollHeight;
  return {
    update({ step, total, label }) {
      el.querySelector('.label').textContent = `${label}…`;
      el.querySelector('.progress-text').textContent = `step ${step} of ${total}`;
      announce(`${label}…`);
    },
    remove: () => el.remove(),
  };
}

/** Runs one agent call with progress, errors and a retry button. */
async function callAgent(fn, retry) {
  state.busy = true;
  renderComposer();
  const thinking = showThinking();
  try {
    return await fn((p) => thinking.update(p));
  } catch (err) {
    const msg = addMessage('agent', `<p>${esc(err.message)}</p>`, { kind: 'error' });
    if (err.retryable !== false && retry) {
      const btn = document.createElement('button');
      btn.className = 'btn small';
      btn.type = 'button';
      btn.textContent = 'Try again';
      btn.onclick = () => {
        btn.disabled = true;
        btn.textContent = 'Retrying…';
        retry();
      };
      msg.querySelector('.bubble').append(btn);
    }
    announce(`Error: ${err.message}`);
    return null;
  } finally {
    thinking.remove();
    state.busy = false;
    $('simulate-error').checked = false;
    renderComposer();
  }
}

function linkToTab(tab, text) {
  return `<button type="button" class="link-btn" data-goto="${tab}">${text}</button>`;
}

els.log.addEventListener('click', (e) => {
  const goto = e.target.closest('[data-goto]');
  if (goto) openTab(goto.dataset.goto, { scroll: true });
});

// ---------- actions ----------

async function submitIdea(text) {
  const check = validateIdea(text);
  if (!check.ok) return showFieldError(check.message);
  clearFieldError();
  els.prompt.value = '';
  updateCount();
  addMessage('user', `<p>${esc(check.text)}</p>`);
  await planIdea(check.text);
}

async function planIdea(text) {
  const result = await callAgent((onProgress) => createPlan(text, { onProgress }), () => planIdea(text));
  if (!result) return;
  state.idea = text;
  state.versions = [{ config: result.config, note: 'First plan' }];
  state.current = 0;
  state.built = false;
  resetDerived();
  save();
  const plan = describePlan(result.config);
  const notes = result.notes.map((n) => `<li>${esc(n)}</li>`).join('');
  addMessage(
    'agent',
    `<p>Here's my plan for <b>${esc(result.config.title)}</b>: a ${esc(plan.genreLabel.toLowerCase())} game in a ${esc(plan.themeLabel.toLowerCase())}.</p>
     ${notes ? `<ul class="notes">${notes}</ul>` : ''}
     <p>Check the plan. When it looks right, I'll build a version you can play. You can also ask for changes first.</p>
     <p>${linkToTab('plan', 'Open the plan →')}</p>`,
  );
  openTab('plan');
  renderAll();
  announce(`Plan ready: ${result.config.title}`);
}

async function build() {
  const result = await callAgent((onProgress) => buildPrototype(config(), { onProgress }), build);
  if (!result) return;
  state.built = true;
  save();
  addMessage(
    'agent',
    `<p>Your prototype is ready. Press <b>Play</b> to try it. It already has the three things start.ng needs: a link back to start.ng, the start.ng name, and a Share on X button.</p>
     <p>Want something different? Type a change below, like “make it faster”. You'll see before and after, and nothing changes until you accept.</p>
     <p>${linkToTab('prototype', 'Play the prototype →')}</p>`,
  );
  openTab('prototype', { scroll: true });
  renderAll();
  announce('Prototype ready to play');
}

async function submitChange(text) {
  if (state.pending) return showFieldError('Accept or reject the proposed change first.');
  const check = validateRequest(text);
  if (!check.ok) return showFieldError(check.message);
  clearFieldError();
  els.prompt.value = '';
  updateCount();
  addMessage('user', `<p>${esc(check.text)}</p>`);
  await proposeChange(check.text);
}

async function proposeChange(text) {
  const base = state.current;
  const result = await callAgent((onProgress) => requestChange(config(), text, { onProgress }), () => proposeChange(text));
  if (!result) return;
  if (!result.understood) {
    addMessage('agent', `<p>${result.notes.map(esc).join(' ')}</p>`, { kind: 'warn' });
    announce('No change proposed');
    return;
  }
  const rows = result.changes
    .map((c) => `<tr><th scope="row">${esc(c.label)}</th><td><s>${esc(c.from)}</s></td><td><b>${esc(c.to)}</b></td></tr>`)
    .join('');
  const msg = addMessage(
    'agent',
    `<p>Here's what I'd change for “${esc(text)}”. Nothing is applied yet.</p>
     <div class="table-wrap"><table class="diff"><caption class="sr-only">Proposed changes</caption>
       <thead><tr><th scope="col">What</th><th scope="col">Now (${versionLabel(base)})</th><th scope="col">Proposed</th></tr></thead>
       <tbody>${rows}</tbody></table></div>
     ${result.notes.length ? `<p class="small">${result.notes.map(esc).join(' ')}</p>` : ''}
     ${state.built ? `<p>${linkToTab('prototype', 'Try the proposed version first →')}</p>` : ''}
     <div class="decision">
       <button type="button" class="btn small" data-decide="accept">Accept change</button>
       <button type="button" class="btn small ghost" data-decide="reject">Reject</button>
     </div>`,
    { kind: 'proposal' },
  );
  state.pending = { request: text, changes: result.changes, next: result.next, msg, base };
  state.previewProposed = state.built;
  msg.querySelector('[data-decide="accept"]').onclick = acceptChange;
  msg.querySelector('[data-decide="reject"]').onclick = rejectChange;
  renderAll();
  announce(`Change proposed: ${result.changes.map((c) => c.label).join(', ')}. Accept or reject it.`);
  msg.querySelector('[data-decide="accept"]').focus();
}

function settleProposal(text) {
  const decision = state.pending.msg.querySelector('.decision');
  decision.innerHTML = `<p class="settled">${text}</p>`;
  state.pending = null;
  state.previewProposed = false;
}

function acceptChange() {
  if (!state.pending) return;
  const { next, request } = state.pending;
  state.versions = state.versions.slice(0, state.current + 1);
  state.versions.push({ config: next, note: request });
  state.current = state.versions.length - 1;
  resetDerived();
  settleProposal(`✓ Accepted. This is now ${versionLabel()}.`);
  save();
  renderAll();
  announce(`Change accepted. Now on ${versionLabel()}.`);
  els.prompt.focus();
}

function rejectChange() {
  if (!state.pending) return;
  settleProposal(`✕ Rejected. Still on ${versionLabel()}.`);
  renderAll();
  announce('Change rejected. Nothing was changed.');
  els.prompt.focus();
}

function switchVersion(i) {
  if (state.pending || i === state.current || !state.versions[i]) return;
  state.current = i;
  resetDerived();
  save();
  addMessage('system', `<p>Switched to ${versionLabel(i)} (“${esc(state.versions[i].note)}”).</p>`);
  renderAll();
  announce(`Switched to ${versionLabel(i)}`);
}

function resetDerived() {
  state.checks = null;
  state.prepared = null;
  if (state.cover) URL.revokeObjectURL(state.cover.url);
  state.cover = null;
}

async function startOver() {
  const ok = await openDialog({
    title: 'Start over?',
    body: `<p>This deletes the plan, the prototype and every version (${state.versions.length}) from this browser. You can't undo it.</p>`,
    confirmLabel: 'Yes, start over',
    danger: true,
  });
  if (!ok) return;
  state.idea = '';
  state.versions = [];
  state.current = -1;
  state.built = false;
  state.pending = null;
  state.repo = '';
  state.tab = 'plan';
  resetDerived();
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  els.log.innerHTML = '';
  greet();
  renderAll();
  els.prompt.focus();
  announce('Started over');
}

// ---------- publishing ----------

async function ensureChecks() {
  const v = state.current;
  if (state.checks?.version === v) return;
  if (!state.cover || state.cover.version !== v) {
    try {
      const blob = await renderCover(config());
      state.cover = { version: v, blob, url: URL.createObjectURL(blob) };
    } catch {
      state.cover = null;
    }
  }
  const files = currentFiles();
  const result = await callAgent((onProgress) => runChecks(files, { onProgress }), () => rerunChecks());
  if (!result || state.current !== v) return;
  state.checks = { version: v, result };
  const summary = result.ok
    ? `<p>The checks passed${result.warnings.length ? `, with ${result.warnings.length} warning${result.warnings.length > 1 ? 's' : ''} to look at` : ''}. The game is ready to publish on start.ng.</p>`
    : `<p>${result.errors.length} problem${result.errors.length > 1 ? 's' : ''} would stop start.ng publishing this. They're listed in the Publish tab.</p>`;
  addMessage('agent', `${summary}<p>${linkToTab('publish', 'See the check results →')}</p>`, { kind: result.ok ? '' : 'warn' });
  if (state.tab === 'publish') renderWorkspace();
}

function rerunChecks() {
  state.checks = null;
  renderWorkspace();
  ensureChecks();
}

function currentFiles() {
  const c = config();
  return { html: buildGameHtml(c), startngJson: buildStartngJson(c), slug: c.slug, hasCover: !!state.cover };
}

function download(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  announce(`Downloading ${name}`);
}

async function publish() {
  const input = $('repo-url');
  const repo = validateRepoUrl(input.value);
  const errEl = $('repo-error');
  if (!repo.ok) {
    errEl.textContent = repo.message;
    input.setAttribute('aria-invalid', 'true');
    input.focus();
    return;
  }
  errEl.textContent = '';
  input.removeAttribute('aria-invalid');
  state.repo = repo.url;
  save();
  const c = config();
  const ok = await openDialog({
    title: `Publish “${c.title}” to start.ng?`,
    body: `<p>On the real start.ng, publishing:</p>
      <ul>
        <li>puts the game on the public internet at <b>${esc(c.slug)}.start.ng</b></li>
        <li>claims that name for whoever approves it first</li>
        <li>links <b>${esc(repo.owner)}/${esc(repo.repo)}</b> to your start.ng account for good. After that, every push updates the game.</li>
      </ul>
      <p class="callout">Demo mode: confirming only <b>prepares</b> the publish request so you can see it. Nothing is sent to start.ng and nothing goes live.</p>`,
    confirmLabel: 'Yes, prepare the publish request',
    check: 'I own this repo, it is public, and the game files are pushed to it.',
  });
  if (!ok) {
    announce('Publishing cancelled. Nothing was done.');
    return;
  }
  const body = { repo_url: repo.url, name: c.slug, ...(repo.branch ? { branch: repo.branch } : {}) };
  const json = JSON.stringify(body);
  state.prepared = {
    version: state.current,
    body,
    curl: `curl -X POST https://api.start.ng/games/check -H "Content-Type: application/json" -d '${json}'\ncurl -X POST https://api.start.ng/games/publish -H "Content-Type: application/json" -d '${json}'`,
  };
  addMessage(
    'agent',
    `<p>Done: the publish request for <b>${esc(c.title)}</b> is ready. <b>It has not been sent and the game is not live.</b> Next steps are in the Publish tab.</p><p>${linkToTab('publish', 'See next steps →')}</p>`,
  );
  renderWorkspace();
  announce('Publish request prepared. Not sent: demo mode.');
  $('prepared')?.focus();
}

// ---------- dialog ----------

function openDialog({ title, body, confirmLabel, check = null, danger = false }) {
  const dlg = $('dialog');
  $('dialog-title').textContent = title;
  $('dialog-body').innerHTML = body;
  const confirm = $('dialog-confirm');
  confirm.textContent = confirmLabel;
  confirm.classList.toggle('danger', danger);
  const wrap = $('dialog-check-wrap');
  const box = $('dialog-check');
  wrap.hidden = !check;
  box.checked = false;
  $('dialog-check-label').textContent = check || '';
  confirm.disabled = !!check;
  box.onchange = () => (confirm.disabled = !box.checked);
  dlg.returnValue = '';
  const opener = document.activeElement;
  return new Promise((resolve) => {
    dlg.addEventListener(
      'close',
      () => {
        opener?.focus?.();
        resolve(dlg.returnValue === 'confirm');
      },
      { once: true },
    );
    dlg.showModal();
    $('dialog-cancel').focus();
  });
}

// ---------- rendering ----------

function renderAll() {
  renderStepper();
  renderComposer();
  renderTabs();
  renderWorkspace();
  els.startOver.hidden = !state.versions.length;
}

function stageIndex() {
  if (state.prepared) return 4;
  if (state.tab === 'publish' && state.built) return 3;
  if (state.built) return 2;
  if (state.versions.length) return 1;
  return 0;
}

function renderStepper() {
  const steps = [
    ['Describe', 'describe', true],
    ['Plan', 'plan', state.versions.length > 0],
    ['Play & refine', 'prototype', state.built],
    ['Publish', 'publish', state.built],
  ];
  const at = stageIndex();
  els.stepper.innerHTML = steps
    .map(([label, target, reachable], i) => {
      const status = i < at ? 'done' : i === at ? 'current' : 'todo';
      const mark = status === 'done' ? '✓' : i + 1;
      const statusText = status === 'done' ? 'done' : status === 'current' ? 'current step' : reachable ? 'available' : 'not yet available';
      return `<li class="${status}">
        <button type="button" data-step="${target}" ${reachable ? '' : 'disabled'} ${status === 'current' ? 'aria-current="step"' : ''}>
          <span class="num" aria-hidden="true">${mark}</span><span>${label}</span><span class="sr-only">, ${statusText}</span>
        </button></li>`;
    })
    .join('');
}

els.stepper.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-step]');
  if (!btn) return;
  if (btn.dataset.step === 'describe') {
    els.prompt.focus();
    els.form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else openTab(btn.dataset.step, { scroll: true });
});

function renderComposer() {
  const changeMode = state.versions.length > 0;
  els.label.textContent = changeMode ? 'Ask for a change' : 'Describe your game idea';
  els.send.textContent = state.busy ? 'Working…' : changeMode ? 'Propose change' : 'Make a plan';
  els.prompt.placeholder = changeMode ? 'e.g. make it faster and give me 5 lives' : 'e.g. Catch falling suya in a busy Lagos market…';
  els.prompt.maxLength = changeMode ? REQUEST_MAX : IDEA_MAX;
  els.hint.textContent = state.pending
    ? 'Accept or reject the proposed change above before asking for another.'
    : changeMode
      ? 'I can change the speed, lives, player size, theme, game type or title. You approve every change.'
      : 'The hero, what they do and where. One or two sentences is plenty.';
  const locked = state.busy || !!state.pending;
  els.prompt.disabled = locked;
  els.send.disabled = locked;
  els.form.setAttribute('aria-busy', String(state.busy));
  const chips = changeMode ? SUGGESTED_CHANGES : IDEA_EXAMPLES;
  els.chips.innerHTML = chips
    .map((c) => `<button type="button" class="chip-btn" ${locked ? 'disabled' : ''}>${esc(changeMode ? c : `${c.slice(0, 42)}…`)}</button>`)
    .join('');
  [...els.chips.children].forEach((b, i) => {
    b.title = chips[i];
    b.setAttribute('aria-label', `Use suggestion: ${chips[i]}`);
    b.onclick = () => {
      els.prompt.value = chips[i];
      updateCount();
      clearFieldError();
      els.prompt.focus();
    };
  });
  updateCount();
}

function updateCount() {
  const max = els.prompt.maxLength > 0 ? els.prompt.maxLength : IDEA_MAX;
  const n = els.prompt.value.length;
  els.count.textContent = `${n} / ${max}`;
  els.count.classList.toggle('near', n > max * 0.9);
}

function showFieldError(message) {
  els.error.textContent = message;
  els.prompt.setAttribute('aria-invalid', 'true');
  els.prompt.focus();
}

function clearFieldError() {
  els.error.textContent = '';
  els.prompt.removeAttribute('aria-invalid');
}

const TABS = [
  ['plan', 'Plan', () => state.versions.length > 0],
  ['prototype', 'Prototype', () => state.built],
  ['publish', 'Publish', () => state.built],
];

function renderTabs() {
  els.tabs.innerHTML = TABS.map(([id, label, enabled]) => {
    const on = state.tab === id;
    return `<button type="button" role="tab" id="tab-${id}" aria-controls="tab-panel" aria-selected="${on}" tabindex="${on ? 0 : -1}" ${enabled() ? '' : 'disabled'} data-tab="${id}">${label}${
      id === 'prototype' && state.pending && state.built ? ' <span class="dot" aria-label="(change waiting)"></span>' : ''
    }</button>`;
  }).join('');
  els.panel.setAttribute('aria-labelledby', `tab-${state.tab}`);
  els.badge.textContent = state.versions.length ? `${versionLabel()} of ${state.versions.length}` : '';
}

els.tabs.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-tab]');
  if (btn && !btn.disabled) openTab(btn.dataset.tab);
});

els.tabs.addEventListener('keydown', (e) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  const enabled = TABS.filter(([, , ok]) => ok()).map(([id]) => id);
  const i = enabled.indexOf(state.tab);
  const next =
    e.key === 'Home' ? 0 : e.key === 'End' ? enabled.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length;
  openTab(enabled[next]);
  $(`tab-${enabled[next]}`)?.focus();
  e.preventDefault();
});

function openTab(tab, { scroll = false } = {}) {
  const def = TABS.find(([id]) => id === tab);
  if (!def || !def[2]()) return;
  state.tab = tab;
  renderTabs();
  renderStepper();
  renderWorkspace();
  if (scroll) {
    els.workspace.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    els.panel.focus({ preventScroll: true });
  }
  if (tab === 'publish') ensureChecks();
}

function renderWorkspace() {
  const c = config();
  if (!c) {
    els.panel.innerHTML = `<div class="empty">
      <p class="big" aria-hidden="true">🎮</p>
      <h4>No game yet</h4>
      <p>Describe an idea in the chat and your plan will show up here. Stuck? Tap one of the suggestions.</p>
    </div>`;
    return;
  }
  if (state.tab === 'prototype' && state.built) return renderPrototype(c);
  if (state.tab === 'publish' && state.built) return renderPublish(c);
  return renderPlan(c);
}

function pendingBanner() {
  if (!state.pending) return '';
  const list = state.pending.changes.map((ch) => `<li><b>${esc(ch.label)}:</b> ${esc(ch.from)} → ${esc(ch.to)}</li>`).join('');
  return `<div class="banner proposal" role="status">
    <p><b>Change waiting for your OK</b> (“${esc(state.pending.request)}”)</p>
    <ul>${list}</ul>
    <div class="decision"><button type="button" class="btn small" id="ws-accept">Accept change</button><button type="button" class="btn small ghost" id="ws-reject">Reject</button></div>
  </div>`;
}

function bindPendingButtons() {
  $('ws-accept')?.addEventListener('click', acceptChange);
  $('ws-reject')?.addEventListener('click', rejectChange);
}

function renderPlan(c) {
  const shown = state.pending ? state.pending.next : c;
  const p = describePlan(shown);
  const t = THEMES[shown.theme];
  const doneSteps = { plan: true, build: state.built, standards: state.built, files: !!state.checks, refine: state.versions.length > 1 };
  els.panel.innerHTML = `
    ${pendingBanner()}
    ${state.pending ? '<p class="small">This plan shows the <b>proposed</b> version.</p>' : ''}
    <article class="plan">
      <header class="plan-head">
        <span class="plan-icon" aria-hidden="true">${t.player}</span>
        <div>
          <h4>${esc(shown.title)}</h4>
          <p class="mono">${esc(shown.slug)}.start.ng</p>
        </div>
      </header>
      <div class="tags"><span class="tag">${esc(p.genreLabel)}</span><span class="tag">${esc(p.themeLabel)}</span><span class="tag">${shown.lives} lives</span><span class="tag">Speed ${shown.speed}/5</span></div>
      <blockquote><span class="sr-only">Your idea: </span>“${esc(state.idea)}”</blockquote>
      <h5>The game loop</h5><p>${esc(p.loop)}</p>
      <h5>Controls</h5><ul>${p.controls.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <h5>Mechanics</h5><ul>${p.mechanics.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <h5>The look</h5><p>${esc(p.look)}</p>
      <h5>start.ng categories</h5><div class="tags">${p.categories.map((x) => `<span class="tag mono">${esc(x)}</span>`).join('')}</div>
      <h5>Steps to get there</h5>
      <ol class="dev-steps">${p.steps
        .map((s) => `<li class="${doneSteps[s.id] ? 'done' : ''}"><span class="sr-only">${doneSteps[s.id] ? 'Done: ' : 'To do: '}</span>${esc(s.label)}</li>`)
        .join('')}</ol>
    </article>
    <div class="actions-row">
      ${
        state.built
          ? `<button type="button" class="btn" id="go-proto">Play the prototype</button>`
          : `<button type="button" class="btn" id="build" ${state.busy || state.pending ? 'disabled' : ''}>Build a playable prototype</button>
             <p class="small">${state.pending ? 'Accept or reject the waiting change first.' : 'Takes a few seconds. Want changes? Ask in the chat first.'}</p>`
      }
    </div>`;
  bindPendingButtons();
  $('build')?.addEventListener('click', build);
  $('go-proto')?.addEventListener('click', () => openTab('prototype'));
}

let gameUrl = null;
function renderPrototype(c) {
  const showProposed = state.pending && state.previewProposed;
  const shown = showProposed ? state.pending.next : c;
  const html = buildGameHtml(shown);
  const versions = state.versions
    .map(
      (v, i) => `<li${i === state.current ? ' aria-current="true"' : ''}>
        <span><b>${versionLabel(i)}</b> ${esc(v.note)}</span>
        ${i === state.current ? '<span class="tag">current</span>' : `<button type="button" class="link-btn" data-version="${i}" ${state.pending ? 'disabled' : ''}>Use this one</button>`}
      </li>`,
    )
    .join('');
  els.panel.innerHTML = `
    ${pendingBanner()}
    ${
      state.pending
        ? `<div class="segmented" role="group" aria-label="Which version to play">
            <button type="button" aria-pressed="${!showProposed}" data-preview="current">Now (${versionLabel()})</button>
            <button type="button" aria-pressed="${!!showProposed}" data-preview="proposed">Proposed</button>
          </div>`
        : ''
    }
    <div class="stage ${showProposed ? 'is-proposed' : ''}">
      ${showProposed ? '<span class="stage-label">Proposed: not accepted yet</span>' : ''}
      <iframe id="game-frame" title="${esc(shown.title)}: playable prototype${showProposed ? ' (proposed version)' : ''}" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"></iframe>
    </div>
    <div class="actions-row">
      <button type="button" class="btn ghost small" id="restart">Restart game</button>
      <button type="button" class="btn ghost small" id="open-tab">Open in a new tab ↗</button>
      <button type="button" class="btn small" id="go-publish" ${state.pending ? 'disabled' : ''}>Looks good: get it ready to publish</button>
    </div>
    <p class="small">Click the game first to use the keyboard. On a phone, tap or drag.</p>
    <h5>Versions</h5>
    <ol class="versions">${versions}</ol>`;
  const frame = $('game-frame');
  frame.srcdoc = html;
  if (gameUrl) URL.revokeObjectURL(gameUrl);
  gameUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  bindPendingButtons();
  $('restart').onclick = () => {
    frame.srcdoc = html;
    announce('Game restarted');
  };
  $('open-tab').onclick = () => window.open(gameUrl, '_blank', 'noopener');
  $('go-publish').onclick = () => openTab('publish');
  els.panel.querySelectorAll('[data-preview]').forEach((b) =>
    b.addEventListener('click', () => {
      state.previewProposed = b.dataset.preview === 'proposed';
      renderWorkspace();
      els.panel.querySelector(`[data-preview="${b.dataset.preview}"]`)?.focus();
      announce(state.previewProposed ? 'Showing the proposed version' : `Showing ${versionLabel()}`);
    }),
  );
  els.panel.querySelectorAll('[data-version]').forEach((b) => b.addEventListener('click', () => switchVersion(Number(b.dataset.version))));
}

function checkList(items, kind) {
  const icon = { error: '✕', warning: '!', pass: '✓' }[kind];
  return items
    .map((x) => `<li class="${kind}"><span class="ico" aria-hidden="true">${icon}</span><span><span class="sr-only">${kind}: </span>${x.code && kind !== 'pass' ? `<code>${esc(x.code)}</code> ` : ''}${esc(x.message)}</span></li>`)
    .join('');
}

function renderPublish(c) {
  const checks = state.checks?.version === state.current ? state.checks.result : null;
  const prepared = state.prepared?.version === state.current ? state.prepared : null;
  const json = JSON.stringify(buildStartngJson(c), null, 2);
  els.panel.innerHTML = `
    <section aria-labelledby="pub-checks">
      <div class="row-head"><h4 id="pub-checks">1. start.ng checks</h4>
        <button type="button" class="link-btn" id="rerun" ${state.busy ? 'disabled' : ''}>Run again</button></div>
      <p class="small">A local copy of the checks in start.ng's docs. The real check runs at <code>api.start.ng/games/check</code> once your repo is public.</p>
      ${
        checks
          ? `<p class="status ${checks.ok ? 'ok' : 'bad'}">${checks.ok ? '✓ Passes. No errors.' : `✕ ${checks.errors.length} error(s) would block publishing`}</p>
             <ul class="checks">${checkList(checks.errors, 'error')}${checkList(checks.warnings, 'warning')}${checkList(checks.passed, 'pass')}</ul>`
          : `<p class="status loading" role="status"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span> Running checks…</p>`
      }
    </section>
    <section aria-labelledby="pub-files">
      <h4 id="pub-files">2. Your game files</h4>
      <p class="small">Put these three files at the top of a <b>public</b> GitHub repo.</p>
      <div class="files">
        <button type="button" class="file" id="dl-html"><b>index.html</b><span>The whole game, ready to play</span></button>
        <button type="button" class="file" id="dl-json"><b>startng.json</b><span>Description, controls, categories</span></button>
        <button type="button" class="file" id="dl-cover" ${state.cover ? '' : 'disabled'}><b>cover.png</b><span>${state.cover ? '1600 × 1000 card picture' : 'Drawing…'}</span></button>
      </div>
      ${state.cover ? `<img class="cover-preview" src="${state.cover.url}" alt="Cover picture for ${esc(c.title)}" width="320" height="200" />` : ''}
      <details><summary>Preview startng.json</summary><pre><code>${esc(json)}</code></pre></details>
    </section>
    <section aria-labelledby="pub-go">
      <h4 id="pub-go">3. Publish</h4>
      ${
        prepared
          ? `<div class="banner ready" id="prepared" tabindex="-1">
               <p><b>Publish request prepared: not sent.</b> ${esc(c.title)} is <b>not</b> on start.ng yet. Demo mode never contacts start.ng.</p>
               <p>To put it live for real:</p>
               <ol>
                 <li>Push <code>index.html</code>, <code>startng.json</code> and <code>cover.png</code> to <a href="${esc(prepared.body.repo_url)}" target="_blank" rel="noopener">${esc(prepared.body.repo_url)}</a>.</li>
                 <li>Run the check, fix anything it reports, then publish (commands below).</li>
                 <li>start.ng replies with an <code>approve_url</code>. Open it, sign in and say yes. That's the final confirmation.</li>
                 <li>New games may wait for a quick review before they're listed. You'll get an email.</li>
               </ol>
               <pre><code id="curl">${esc(prepared.curl)}</code></pre>
               <button type="button" class="btn small ghost" id="copy-curl">Copy commands</button>
               <span class="small" id="copy-status" role="status"></span>
             </div>`
          : `<label for="repo-url">Public GitHub repo link</label>
             <input id="repo-url" type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://github.com/you/${esc(c.slug)}" value="${esc(state.repo)}" aria-describedby="repo-help repo-error" />
             <p class="small" id="repo-help">Game address: <b class="mono">${esc(c.slug)}.start.ng</b>. You'll confirm before anything happens.</p>
             <p class="field-error" id="repo-error" role="alert"></p>
             <button type="button" class="btn" id="publish" ${checks?.ok ? '' : 'disabled'}>Publish to start.ng…</button>
             ${checks && !checks.ok ? '<p class="small">Fix the errors above first.</p>' : ''}`
      }
    </section>`;
  $('rerun').onclick = rerunChecks;
  $('dl-html').onclick = () => download('index.html', new Blob([buildGameHtml(c)], { type: 'text/html' }));
  $('dl-json').onclick = () => download('startng.json', new Blob([json], { type: 'application/json' }));
  $('dl-cover').onclick = () => state.cover && download('cover.png', state.cover.blob);
  $('publish')?.addEventListener('click', publish);
  $('repo-url')?.addEventListener('input', (e) => {
    $('repo-error').textContent = '';
    e.target.removeAttribute('aria-invalid');
  });
  $('repo-url')?.addEventListener('keydown', (e) => e.key === 'Enter' && publish());
  $('copy-curl')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(prepared.curl);
      $('copy-status').textContent = 'Copied.';
    } catch {
      $('copy-status').textContent = "Couldn't copy. Select the text and copy it yourself.";
    }
  });
}

// ---------- wiring ----------

els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (state.busy) return;
  const text = els.prompt.value;
  if (state.versions.length) submitChange(text);
  else submitIdea(text);
});

els.prompt.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    els.form.requestSubmit();
  }
});
els.prompt.addEventListener('input', () => {
  updateCount();
  if (els.error.textContent) clearFieldError();
});
els.startOver.addEventListener('click', startOver);

$('simulate-error').addEventListener('change', (e) => configureAgent({ failNext: e.target.checked }));

const themeBtn = $('theme-toggle');
function currentTheme() {
  const set = document.documentElement.getAttribute('data-theme');
  return set || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}
function syncThemeButton() {
  themeBtn.setAttribute('aria-label', `Switch to ${currentTheme() === 'dark' ? 'light' : 'dark'} theme`);
}
themeBtn.addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try {
    localStorage.setItem('theme', next);
  } catch {
    /* ignore */
  }
  syncThemeButton();
});
syncThemeButton();

function greet() {
  addMessage(
    'agent',
    `<p>Hi! 👋 I'm the Game Creator Copilot (demo). Tell me a game idea in plain words and I'll turn it into a plan, then a game you can play.</p>
     <p class="small">Demo mode: my answers come from built-in rules, not a live AI.</p>`,
  );
}

if (load()) {
  greet();
  addMessage('system', `<p>Welcome back. I restored your draft <b>${esc(config().title)}</b> (${versionLabel()}).</p>`);
} else {
  greet();
}
renderAll();
