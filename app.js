/* ============================================================
   战略领导力：社交网络视角 — App Logic
   In-memory state only — all state in JS variables
   ============================================================ */

'use strict';

// ── State ─────────────────────────────────────────────────────
const state = {
  currentScreen: 'cover',       // cover | moduleMap | knowledge | quiz | completion
  currentModuleIndex: 0,        // 0-based index into COURSE_DATA.modules
  currentSectionIndex: 0,       // 0-based index within module.sections
  currentQuestionIndex: 0,      // 0-based index within module.questions
  completedModules: new Set(),  // set of module ids (1-based)
  totalCorrect: 0,
  totalAnswered: 0,

  // Teacher panel
  teacherPanelOpen: false,
  showAnswers: false,

  // Timer
  timerSeconds: 60,
  timerSelected: 60,
  timerRemaining: null,
  timerRunning: false,
  timerInterval: null,

  // Quiz per-question
  questionAnswered: false,
  selectedOptionIndex: null,
};

// ── DOM References ────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const screens = {
  cover:     $('screenCover'),
  moduleMap: $('screenModuleMap'),
  knowledge: $('screenKnowledge'),
  quiz:      $('screenQuiz'),
  completion:$('screenCompletion'),
};

// ── Helpers ───────────────────────────────────────────────────
function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    if (key === name) {
      el.removeAttribute('hidden');
      el.setAttribute('aria-hidden', 'false');
    } else {
      el.setAttribute('hidden', '');
      el.setAttribute('aria-hidden', 'true');
    }
  });
  state.currentScreen = name;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function getModule(idx) {
  return COURSE_DATA.modules[idx];
}

function isModuleLocked(idx) {
  return false; // All modules unlocked
}

function isModuleCompleted(idx) {
  return state.completedModules.has(getModule(idx).id);
}

function isModuleCurrent(idx) {
  return idx === state.currentModuleIndex && !isModuleCompleted(idx) && !isModuleLocked(idx);
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

function updateGlobalProgress() {
  const completed = state.completedModules.size;
  const total = COURSE_DATA.modules.length;
  const pct = (completed / total) * 100;
  $('globalProgressFill').style.width = pct + '%';
  $('globalProgressLabel').textContent = `${completed} / ${total} 模块`;
}

// ── Teacher Panel ─────────────────────────────────────────────
function openTeacherPanel() {
  state.teacherPanelOpen = true;
  $('teacherPanel').classList.add('is-open');
  $('teacherOverlay').classList.add('is-open');
  $('teacherPanel').setAttribute('aria-hidden', 'false');
  $('teacherToggle').setAttribute('aria-expanded', 'true');
  renderModuleJumpGrid();
}

function closeTeacherPanel() {
  state.teacherPanelOpen = false;
  $('teacherPanel').classList.remove('is-open');
  $('teacherOverlay').classList.remove('is-open');
  $('teacherPanel').setAttribute('aria-hidden', 'true');
  $('teacherToggle').setAttribute('aria-expanded', 'false');
}

function renderModuleJumpGrid() {
  const grid = $('moduleJumpGrid');
  grid.innerHTML = '';
  COURSE_DATA.modules.forEach((mod, idx) => {
    const btn = document.createElement('button');
    btn.className = 'module-jump-btn' + (isModuleCompleted(idx) ? ' is-completed' : '');
    btn.textContent = idx + 1;
    btn.setAttribute('aria-label', `跳转到模块 ${idx + 1}: ${mod.title}`);
    btn.addEventListener('click', () => {
      closeTeacherPanel();
      jumpToModule(idx);
    });
    grid.appendChild(btn);
  });
}

function jumpToModule(idx) {
  state.currentModuleIndex = idx;
  state.currentSectionIndex = 0;
  state.currentQuestionIndex = 0;
  state.questionAnswered = false;
  state.selectedOptionIndex = null;
  showKnowledgeScreen();
}

// ── Answer Toggle ─────────────────────────────────────────────
function toggleAnswers() {
  state.showAnswers = !state.showAnswers;
  const btn = $('answerToggleBtn');
  const icon = $('answerToggleIcon');
  const text = $('answerToggleText');

  if (state.showAnswers) {
    btn.classList.add('is-active');
    icon.textContent = '🙈';
    text.textContent = '隐藏正确答案';
    document.body.classList.add('show-answers');
  } else {
    btn.classList.remove('is-active');
    icon.textContent = '👁';
    text.textContent = '显示正确答案';
    document.body.classList.remove('show-answers');
  }
}

// ── Timer ─────────────────────────────────────────────────────
function setTimerPreset(seconds) {
  stopTimer();
  state.timerSelected = seconds;
  state.timerRemaining = seconds;
  document.querySelectorAll('.timer-preset-btn').forEach(btn => {
    btn.classList.toggle('is-selected', parseInt(btn.dataset.seconds) === seconds);
  });
  updateTimerDisplay();
}

function startTimer() {
  if (state.timerRunning) { stopTimer(); return; }
  if (state.timerRemaining === null || state.timerRemaining <= 0) {
    state.timerRemaining = state.timerSelected;
  }
  state.timerRunning = true;
  $('timerStartBtn').innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> 暂停';
  state.timerInterval = setInterval(() => {
    state.timerRemaining--;
    updateTimerDisplay();
    if (state.timerRemaining <= 0) {
      stopTimer();
      timerDone();
    }
  }, 1000);
  showFloatingTimer();
}

function stopTimer() {
  state.timerRunning = false;
  clearInterval(state.timerInterval);
  state.timerInterval = null;
  $('timerStartBtn').innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg> 开始';
}

function resetTimer() {
  stopTimer();
  state.timerRemaining = state.timerSelected;
  updateTimerDisplay();
  hideFloatingTimer();
}

function timerDone() {
  updateTimerDisplay();
  // Brief visual flash
  setTimeout(() => {
    hideFloatingTimer();
  }, 3000);
}

function updateTimerDisplay() {
  const r = state.timerRemaining;
  const display = $('timerDisplay');
  const floating = $('timerFloating');
  const timerVal = $('timerValue');
  const floatingVal = $('timerFloatingValue');

  if (r === null) {
    timerVal.textContent = '--';
    floatingVal.textContent = '--';
    display.className = 'timer-display';
    floating.className = 'timer-floating';
    return;
  }

  const mins = Math.floor(r / 60);
  const secs = r % 60;
  const text = r >= 60
    ? `${mins}:${String(secs).padStart(2, '0')}`
    : String(r);

  timerVal.textContent = text;
  floatingVal.textContent = text;

  // Color states
  let cls = '';
  if (r <= 10) cls = 'is-urgent';
  else if (r <= 20) cls = 'is-warning';

  display.className = 'timer-display' + (cls ? ' ' + cls : '');
  floating.className = 'timer-floating is-visible' + (cls ? ' ' + cls : '');
}

function showFloatingTimer() {
  if (!state.teacherPanelOpen) {
    $('timerFloating').classList.add('is-visible');
    $('timerFloating').setAttribute('aria-hidden', 'false');
  }
}

function hideFloatingTimer() {
  $('timerFloating').classList.remove('is-visible');
  $('timerFloating').setAttribute('aria-hidden', 'true');
}

// ── Module Map Screen ─────────────────────────────────────────
function showModuleMapScreen() {
  showScreen('moduleMap');
  renderModuleGrid();
  updateGlobalProgress();
}

function renderModuleGrid() {
  const grid = $('moduleGrid');
  grid.innerHTML = '';

  COURSE_DATA.modules.forEach((mod, idx) => {
    const completed = isModuleCompleted(idx);
    const locked = isModuleLocked(idx);
    const current = isModuleCurrent(idx);

    const card = document.createElement('article');
    card.className = [
      'module-card',
      completed ? 'module-card--completed' : '',
      locked ? 'module-card--locked' : '',
      current ? 'module-card--current' : '',
    ].filter(Boolean).join(' ');
    card.setAttribute('role', 'listitem');
    card.setAttribute('tabindex', locked ? '-1' : '0');
    card.setAttribute('aria-label', `模块 ${idx + 1}: ${mod.title}${completed ? ' (已完成)' : locked ? ' (已锁定)' : ''}`);
    card.style.animationDelay = (idx * 50) + 'ms';

    const statusIcon = completed
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`
      : locked
        ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
        : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12 14 14"/></svg>`;

    const statusClass = completed
      ? 'module-status-icon--completed'
      : locked
        ? 'module-status-icon--locked'
        : 'module-status-icon--current';

    card.innerHTML = `
      <div class="module-card-header">
        <span class="module-number">模块 ${idx + 1}</span>
        <div class="module-status-icon ${statusClass}">${statusIcon}</div>
      </div>
      <h3 class="module-title-text">${mod.title}</h3>
      <div class="module-card-meta">
        <span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          ${mod.sections.length} 节
        </span>
        <span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          ${mod.questions.length} 题
        </span>
        ${completed ? '<span style="color:var(--green);font-weight:500;">✓ 已完成</span>' : ''}
        ${locked ? '<span style="color:var(--text-muted);">🔒 已锁定</span>' : ''}
      </div>
    `;

    if (!locked) {
      card.addEventListener('click', () => {
        state.currentModuleIndex = idx;
        state.currentSectionIndex = 0;
        state.currentQuestionIndex = 0;
        state.questionAnswered = false;
        state.selectedOptionIndex = null;
        showKnowledgeScreen();
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          card.click();
        }
      });
    }

    grid.appendChild(card);
  });
}

// ── Knowledge Screen ──────────────────────────────────────────
function showKnowledgeScreen() {
  showScreen('knowledge');
  renderKnowledgeSlide();
}

function renderKnowledgeSlide() {
  const mod = getModule(state.currentModuleIndex);
  const section = mod.sections[state.currentSectionIndex];
  const totalSections = mod.sections.length;
  const current = state.currentSectionIndex + 1;

  // Update header
  $('knowledgeModuleLabel').textContent = `模块 ${state.currentModuleIndex + 1}`;
  $('knowledgeSectionTitle').textContent = section.title;
  $('sectionProgressText').textContent = `第 ${current} 节 / 共 ${totalSections} 节`;
  $('sectionProgressFill').style.width = ((current / totalSections) * 100) + '%';

  // Update next button
  const isLast = state.currentSectionIndex === totalSections - 1;
  $('knowledgeNextBtn').innerHTML = isLast
    ? `开始测验 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
    : `下一步 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;

  // Render knowledge points
  const container = $('knowledgePoints');
  container.innerHTML = '';

  section.points.forEach((point, pi) => {
    const card = document.createElement('div');
    card.className = 'point-card';
    card.style.animationDelay = (pi * 80) + 'ms';

    let inner = `<div class="point-label">${escapeHtml(point.label)}</div>`;

    if (point.desc) {
      inner += `<p class="point-desc">${escapeHtml(point.desc)}</p>`;
    }

    if (point.items && point.items.length) {
      inner += `<ul class="point-items">`;
      point.items.forEach(item => {
        inner += `<li>${escapeHtml(item)}</li>`;
      });
      inner += `</ul>`;
    }

    card.innerHTML = inner;
    container.appendChild(card);
  });
}

// ── Quiz Screen ───────────────────────────────────────────────
function showQuizScreen() {
  showScreen('quiz');
  renderQuestion();
}

function renderQuestion() {
  const mod = getModule(state.currentModuleIndex);
  const q = mod.questions[state.currentQuestionIndex];
  const totalQ = mod.questions.length;
  const current = state.currentQuestionIndex + 1;

  state.questionAnswered = false;
  state.selectedOptionIndex = null;

  // Header
  $('quizModuleLabel').textContent = `模块 ${state.currentModuleIndex + 1}: ${mod.title}`;
  $('quizCounter').textContent = `第 ${current} 题 / 共 ${totalQ} 题`;

  // Scenario
  $('quizScenario').textContent = q.scenario;

  // Options
  const optionsContainer = $('quizOptions');
  optionsContainer.innerHTML = '';
  q.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'option-card';
    btn.setAttribute('role', 'listitem');
    btn.setAttribute('data-correct', idx === q.correct ? 'true' : 'false');
    btn.setAttribute('aria-label', `选项 ${OPTION_LABELS[idx]}: ${opt}`);
    btn.innerHTML = `
      <span class="option-badge" aria-hidden="true">${OPTION_LABELS[idx]}</span>
      <span class="option-text">${escapeHtml(opt)}</span>
    `;
    btn.addEventListener('click', () => handleOptionSelect(idx));
    optionsContainer.appendChild(btn);
  });

  // Reset explanations and footer
  const expl = $('quizExplanations');
  expl.setAttribute('hidden', '');
  expl.innerHTML = '';

  const footer = $('quizFooter');
  footer.setAttribute('hidden', '');
}

function handleOptionSelect(selectedIdx) {
  if (state.questionAnswered) return;
  state.questionAnswered = true;
  state.selectedOptionIndex = selectedIdx;
  state.totalAnswered++;

  const mod = getModule(state.currentModuleIndex);
  const q = mod.questions[state.currentQuestionIndex];
  const isCorrect = selectedIdx === q.correct;

  if (isCorrect) {
    state.totalCorrect++;
  }

  // Update option cards
  const optionCards = $('quizOptions').querySelectorAll('.option-card');
  optionCards.forEach((card, idx) => {
    card.classList.add('is-answered');
    if (idx === selectedIdx) {
      card.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
    }
    if (idx === q.correct && !isCorrect) {
      // Also highlight the correct one after a small delay
      setTimeout(() => card.classList.add('is-correct'), 400);
    }
  });

  // Show explanations
  showExplanations(q);

  // Show footer
  const isLastQuestion = state.currentQuestionIndex === mod.questions.length - 1;
  const isLastModule = state.currentModuleIndex === COURSE_DATA.modules.length - 1;
  const footer = $('quizFooter');
  const nextBtnText = $('quizNextBtnText');

  if (isLastQuestion) {
    nextBtnText.textContent = isLastModule ? '查看成绩' : '进入下一模块';
  } else {
    nextBtnText.textContent = '下一题';
  }

  footer.removeAttribute('hidden');
}

function showExplanations(q) {
  const container = $('quizExplanations');
  container.innerHTML = '';

  const title = document.createElement('div');
  title.className = 'quiz-explanations-title';
  title.textContent = '解析';
  container.appendChild(title);

  q.explanations.forEach((expl, idx) => {
    const isCorrect = idx === q.correct;
    const item = document.createElement('div');
    item.className = 'explanation-item' + (isCorrect ? ' explanation-item--correct' : '');
    item.style.animationDelay = (idx * 60) + 'ms';
    item.innerHTML = `
      <span class="explanation-badge" aria-label="${OPTION_LABELS[idx]}">${OPTION_LABELS[idx]}</span>
      <span>${escapeHtml(expl)}</span>
    `;
    container.appendChild(item);
  });

  container.removeAttribute('hidden');

  // Scroll to explanations smoothly
  setTimeout(() => {
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 300);
}

function handleQuizNext() {
  const mod = getModule(state.currentModuleIndex);
  const isLastQuestion = state.currentQuestionIndex === mod.questions.length - 1;
  const isLastModule = state.currentModuleIndex === COURSE_DATA.modules.length - 1;

  if (!isLastQuestion) {
    state.currentQuestionIndex++;
    renderQuestion();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  // Last question of module — mark complete
  state.completedModules.add(mod.id);
  updateGlobalProgress();

  if (isLastModule) {
    showCompletionScreen();
  } else {
    state.currentModuleIndex++;
    state.currentSectionIndex = 0;
    state.currentQuestionIndex = 0;
    state.questionAnswered = false;
    state.selectedOptionIndex = null;
    showModuleMapScreen();
  }
}

// ── Completion Screen ─────────────────────────────────────────
function showCompletionScreen() {
  showScreen('completion');
  renderCompletionStats();
}

function renderCompletionStats() {
  const container = $('completionStats');
  container.innerHTML = '';

  const stats = [
    { value: COURSE_DATA.modules.length, label: '模块完成' },
    { value: state.totalAnswered, label: '题目作答' },
    { value: state.totalAnswered > 0 ? Math.round((state.totalCorrect / state.totalAnswered) * 100) + '%' : '--', label: '正确率' },
  ];

  stats.forEach((s, i) => {
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.style.animationDelay = (i * 150 + 200) + 'ms';
    card.innerHTML = `
      <div class="stat-value">${s.value}</div>
      <div class="stat-label">${s.label}</div>
    `;
    container.appendChild(card);
  });
}

// ── Reset ─────────────────────────────────────────────────────
function resetAll() {
  if (!confirm('确定要重置所有进度吗？此操作无法撤销。')) return;

  state.currentModuleIndex = 0;
  state.currentSectionIndex = 0;
  state.currentQuestionIndex = 0;
  state.completedModules.clear();
  state.totalCorrect = 0;
  state.totalAnswered = 0;
  state.questionAnswered = false;
  state.selectedOptionIndex = null;

  updateGlobalProgress();
  closeTeacherPanel();
  showScreen('cover');
}

// ── Escape HTML ───────────────────────────────────────────────
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Event Listeners ───────────────────────────────────────────
function initEventListeners() {
  // Cover
  $('startCourseBtn').addEventListener('click', () => {
    showModuleMapScreen();
  });

  // Teacher toggle
  $('teacherToggle').addEventListener('click', () => {
    if (state.teacherPanelOpen) closeTeacherPanel();
    else openTeacherPanel();
  });

  $('teacherClose').addEventListener('click', closeTeacherPanel);
  $('teacherOverlay').addEventListener('click', closeTeacherPanel);

  // Answer toggle
  $('answerToggleBtn').addEventListener('click', toggleAnswers);

  // Timer
  document.querySelectorAll('.timer-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => setTimerPreset(parseInt(btn.dataset.seconds)));
  });
  $('timerStartBtn').addEventListener('click', startTimer);
  $('timerResetBtn').addEventListener('click', resetTimer);

  // Module jump
  // (rendered dynamically via renderModuleJumpGrid)

  // Reset
  $('resetProgressBtn').addEventListener('click', resetAll);

  // Knowledge
  $('knowledgeBackBtn').addEventListener('click', showModuleMapScreen);
  $('knowledgeNextBtn').addEventListener('click', () => {
    const mod = getModule(state.currentModuleIndex);
    const isLastSection = state.currentSectionIndex === mod.sections.length - 1;
    if (isLastSection) {
      state.currentQuestionIndex = 0;
      showQuizScreen();
    } else {
      state.currentSectionIndex++;
      renderKnowledgeSlide();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  // Quiz
  $('quizBackBtn').addEventListener('click', showModuleMapScreen);
  $('quizNextBtn').addEventListener('click', handleQuizNext);

  // Completion
  $('restartBtn').addEventListener('click', resetAll);
  $('reviewModulesBtn').addEventListener('click', () => {
    closeTeacherPanel();
    showModuleMapScreen();
  });

  // Keyboard shortcut — T to toggle teacher panel
  document.addEventListener('keydown', (e) => {
    const tag = e.target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    if (e.key === 't' || e.key === 'T') {
      if (state.teacherPanelOpen) closeTeacherPanel();
      else openTeacherPanel();
    }
    if (e.key === 'Escape' && state.teacherPanelOpen) {
      closeTeacherPanel();
    }
  });
}

// ── Init ──────────────────────────────────────────────────────
function init() {
  // Set default timer preset UI
  document.querySelectorAll('.timer-preset-btn').forEach(btn => {
    if (parseInt(btn.dataset.seconds) === state.timerSelected) {
      btn.classList.add('is-selected');
    }
  });

  updateGlobalProgress();
  initEventListeners();
  showScreen('cover');
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
