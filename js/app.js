// 헌법·행정법 일반론 빈칸 채우기 — app.js
// Firebase + Auth + Firestore + Router + Render

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup,
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { sections, symbols } from '../data/sections.js';

// ─── Firebase config (STUDYMAP 프로젝트 공유) ────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyCz-QziDKUKmYAIlXigd3GlTaM_oyzj2dQ",
  authDomain: "studymap-89c09.firebaseapp.com",
  projectId: "studymap-89c09",
  storageBucket: "studymap-89c09.firebasestorage.app",
  messagingSenderId: "20865447129",
  appId: "1:20865447129:web:419f96f419b4cba0a43ac8",
  measurementId: "G-L7LW590E8Q"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ─── 전역 상태 ─────────────────────────────────────────────────────────
let currentUser = null;
let progressCache = null;          // { sections: { lr: { mode1: Date, mode2: Date } } }
let currentSection = null;
let currentMode = 1;

// ─── 인증 ──────────────────────────────────────────────────────────────
function setupAuth() {
  document.getElementById('login-btn').addEventListener('click', login);
  document.getElementById('logout-btn').addEventListener('click', logout);

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    updateAuthUI();
    if (user) {
      await loadProgress();
    } else {
      progressCache = { sections: {} };
    }
    // 현재 뷰 다시 렌더링
    if (document.getElementById('home-view').style.display !== 'none') {
      renderHome();
    } else if (currentSection) {
      updateLastStudyBar();
    }
  });
}

async function login() {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch (e) {
    console.error('Login failed:', e);
    alert('로그인 실패: ' + e.message + '\n\n(authDomain에 archivingreen-oss.github.io 가 등록되어 있어야 합니다.)');
  }
}

async function logout() {
  await signOut(auth);
}

function updateAuthUI() {
  const loginBtn = document.getElementById('login-btn');
  const userInfo = document.getElementById('user-info');
  const userName = document.getElementById('user-name');
  if (currentUser) {
    loginBtn.style.display = 'none';
    userInfo.style.display = 'flex';
    userName.textContent = currentUser.displayName || currentUser.email || '로그인됨';
  } else {
    loginBtn.style.display = '';
    userInfo.style.display = 'none';
  }
}

// ─── 진도 (Firestore) ──────────────────────────────────────────────────
function progressDocRef() {
  if (!currentUser) return null;
  return doc(db, 'users', currentUser.uid, 'principlesBlanks', 'progress');
}

async function loadProgress() {
  const ref = progressDocRef();
  if (!ref) return;
  try {
    const snap = await getDoc(ref);
    progressCache = snap.exists() ? snap.data() : { sections: {} };
  } catch (e) {
    console.error('loadProgress failed:', e);
    progressCache = { sections: {} };
  }
}

async function recordStudy(sectionId, mode) {
  if (!currentUser) return;
  const ref = progressDocRef();
  try {
    const payload = { sections: {} };
    payload.sections[sectionId] = {};
    payload.sections[sectionId][`mode${mode}`] = serverTimestamp();
    await setDoc(ref, payload, { merge: true });
    // 캐시 즉시 갱신 (UI 표시용)
    if (!progressCache) progressCache = { sections: {} };
    if (!progressCache.sections) progressCache.sections = {};
    if (!progressCache.sections[sectionId]) progressCache.sections[sectionId] = {};
    progressCache.sections[sectionId][`mode${mode}`] = new Date();
    updateLastStudyBar();
  } catch (e) {
    console.error('recordStudy failed:', e);
  }
}

function getLastStudy(sectionId, mode) {
  if (!progressCache || !progressCache.sections) return null;
  const s = progressCache.sections[sectionId];
  if (!s) return null;
  const ts = s[`mode${mode}`];
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();        // Firestore Timestamp
  return ts instanceof Date ? ts : new Date(ts);
}

function formatDate(date) {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatRelativeTime(date) {
  if (!date) return '';
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return '오늘';
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  if (days < 365) return `${Math.floor(days / 30)}개월 전`;
  return `${Math.floor(days / 365)}년 전`;
}

// ─── 라우터 ─────────────────────────────────────────────────────────────
function setupRouter() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

function handleRoute() {
  const hash = window.location.hash.slice(1);
  if (hash.startsWith('section/')) {
    const id = hash.slice('section/'.length);
    const sec = sections.find(s => s.id === id);
    if (sec) { showSection(sec); return; }
  }
  showHome();
}

function showHome() {
  currentSection = null;
  document.getElementById('home-view').style.display = '';
  document.getElementById('section-view').style.display = 'none';
  document.getElementById('footer').style.display = 'none';
  renderHome();
}

function showSection(sec) {
  currentSection = sec;
  document.getElementById('home-view').style.display = 'none';
  document.getElementById('section-view').style.display = '';
  document.getElementById('footer').style.display = '';
  renderSection();
}

// ─── 홈 (섹션 목록) ──────────────────────────────────────────────────────
// 현재 활성 카테고리 (localStorage에서 복원, 기본값 '심사기준')
let currentCategory = localStorage.getItem('activeCategory') || '심사기준';

function renderHome() {
  const container = document.getElementById('section-list');
  if (!container) return;

  // 탭 active 상태 동기화 + 클릭 이벤트
  document.querySelectorAll('.category-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === currentCategory);
    btn.onclick = () => {
      currentCategory = btn.dataset.category;
      localStorage.setItem('activeCategory', currentCategory);
      renderHome();
    };
  });

  // 활성 카테고리에 해당하는 섹션만 필터
  const filtered = sections.filter(s => s.category === currentCategory);

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-category">아직 이 카테고리에는 학습 카드가 없어요.</div>`;
    return;
  }

  container.innerHTML = filtered.map(s => {
    const m1 = getLastStudy(s.id, 1);
    const m2 = getLastStudy(s.id, 2);
    const m1Text = m1 ? `${formatDate(m1)} · ${formatRelativeTime(m1)}` : '—';
    const m2Text = m2 ? `${formatDate(m2)} · ${formatRelativeTime(m2)}` : '—';
    return `
      <a href="#section/${s.id}" class="section-card">
        <div class="section-card-cat">${s.category}</div>
        <h3 class="section-card-name">${s.name}</h3>
        <div class="section-card-meta">
          <div class="study-row"><span class="study-label">1단계</span><span class="study-val">${m1Text}</span></div>
          <div class="study-row"><span class="study-label">2단계</span><span class="study-val">${m2Text}</span></div>
        </div>
        <div class="section-card-count">${s.cards.length}개 카드</div>
      </a>
    `;
  }).join('');
}

// ─── 섹션 페이지 ────────────────────────────────────────────────────────
function renderSection() {
  if (!currentSection) return;
  document.getElementById('section-title').textContent = currentSection.name;
  document.getElementById('section-category').textContent = `${currentSection.category} · ${currentSection.subject}`;

  document.querySelectorAll('.mode-btn').forEach(b => {
    const m = parseInt(b.dataset.mode);
    b.classList.toggle('active', m === currentMode);
    b.onclick = () => setMode(m);
  });

  updateLastStudyBar();
  renderCards();
}

function updateLastStudyBar() {
  if (!currentSection) return;
  const bar = document.getElementById('last-study-bar');
  if (!bar) return;
  const last = getLastStudy(currentSection.id, currentMode);
  if (last) {
    bar.innerHTML = `<span class="last-label">마지막 학습일 · ${currentMode}단계</span> <span class="last-date">${formatDate(last)}</span> <span class="last-rel">(${formatRelativeTime(last)})</span>`;
  } else if (currentUser) {
    bar.innerHTML = `<span class="last-label">마지막 학습일 · ${currentMode}단계</span> <span class="last-rel">아직 기록 없음</span>`;
  } else {
    bar.innerHTML = `<span class="last-label">로그인하면 학습일이 기록됩니다</span>`;
  }
}

function setMode(m) {
  if (currentMode === m) return;
  currentMode = m;
  document.querySelectorAll('.mode-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.mode) === m);
  });
  updateLastStudyBar();
  renderCards();
}

// ─── 카드 렌더링 ────────────────────────────────────────────────────────
function normalize(s) {
  return (s || '').trim()
    .replace(/[\u2018\u2019\u0027]/g, "'")
    .replace(/[\u22C5\u00B7\u30FB\u318D]/g, '·')
    .replace(/\s+/g, '');
}

function getFullText(card, highlight = false) {
  return card.template.replace(/\{(\d+)\}/g, (_, n) => {
    const a = card.answers[n] || '';
    return highlight ? `<mark>${a}</mark>` : a;
  });
}

function getStatuteBoxHtml(card) {
  if (!card.statutes || !card.statutes.length) return '';
  const items = card.statutes.map(s => `
    <div class="statute-item">
      <div class="statute-name">${s.name}</div>
      <div class="statute-text">${s.text}</div>
    </div>
  `).join('');
  return `
    <div class="statute-box" id="statute-${card.id}">
      <div class="statute-label">관련 법조문</div>
      ${items}
    </div>
  `;
}

function renderCard1(card, index) {
  const parts = card.template.split(/(\{\d+\})/g);
  const bodyHtml = parts.map(part => {
    const m = part.match(/^\{(\d+)\}$/);
    if (m) {
      const no = parseInt(m[1]);
      const ans = card.answers[no] || '';
      const symbol = symbols[no - 1] || `(${no})`;
      const width = Math.max(ans.length * 1.15 + 2, 5.5);
      const ansEsc = ans.replace(/"/g, '&quot;');
      return `<span class="blank-label">${symbol}</span><input class="blank-input" data-card="${card.id}" data-no="${no}" data-answer="${ansEsc}" placeholder="${symbol}" style="width:${width}em" autocomplete="off" spellcheck="false" />`;
    }
    return part;
  }).join('');

  return `
    <article class="card" id="${card.id}">
      <div class="card-header">
        <span class="card-num">${String(index + 1).padStart(2, '0')}</span>
        <h3 class="card-title">${card.title}</h3>
      </div>
      <div class="card-body">${bodyHtml}</div>
      ${getStatuteBoxHtml(card)}
      <div class="card-actions">
        <button class="btn-primary" data-act="check" data-card="${card.id}">정답 확인</button>
        <button data-act="reveal" data-card="${card.id}">정답 공개</button>
        <button data-act="reset" data-card="${card.id}">리셋</button>
      </div>
    </article>
  `;
}

function renderCard2(card, index) {
  return `
    <article class="card" id="${card.id}">
      <div class="card-header">
        <span class="card-num">${String(index + 1).padStart(2, '0')}</span>
        <h3 class="card-title">${card.title}</h3>
      </div>
      <textarea class="full-textarea" data-card="${card.id}" placeholder="이 카드의 전문을 작성해보세요…"></textarea>
      <div class="answer-display" id="ans-${card.id}" style="display:none">
        <div class="answer-label">정답 (핵심 키워드 강조)</div>
        <div class="answer-text">${getFullText(card, true)}</div>
      </div>
      ${getStatuteBoxHtml(card)}
      <div class="card-actions">
        <button class="btn-primary" data-act="toggle" data-card="${card.id}" id="btn-ans-${card.id}">정답 보기</button>
        <button data-act="reset2" data-card="${card.id}">리셋</button>
      </div>
    </article>
  `;
}

function renderCards() {
  if (!currentSection) return;
  const cardsEl = document.getElementById('cards-container');
  cardsEl.innerHTML = currentSection.cards.map((c, i) =>
    currentMode === 1 ? renderCard1(c, i) : renderCard2(c, i)
  ).join('');

  const fa = document.getElementById('footer-actions');
  fa.innerHTML = currentMode === 1
    ? `<button data-act="check-all" class="btn-primary">전체 확인</button><button data-act="reset-all">전체 리셋</button>`
    : `<button data-act="reveal-all" class="btn-primary">전체 정답 보기</button><button data-act="reset-all">전체 리셋</button>`;

  document.getElementById('mode-desc').textContent =
    currentMode === 1 ? '핵심 키워드만 빈칸으로 채우는 모드' : '카드 전문을 통째로 작성하는 모드';

  bindCardEvents();
  bindFooterEvents();
  updateScore();
}

function bindCardEvents() {
  const container = document.getElementById('cards-container');
  container.onclick = (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    const cardId = btn.dataset.card;
    if (act === 'check') checkCard(cardId);
    else if (act === 'reveal') revealCard(cardId);
    else if (act === 'reset') resetCard(cardId);
    else if (act === 'toggle') toggleAnswer(cardId);
    else if (act === 'reset2') resetCard2(cardId);
  };
  if (currentMode === 1) {
    container.querySelectorAll('.blank-input').forEach(inp => {
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); checkCard(inp.dataset.card); }
      });
    });
  } else {
    container.querySelectorAll('.full-textarea').forEach(ta => {
      ta.addEventListener('input', updateScore);
    });
  }
}

function bindFooterEvents() {
  document.getElementById('footer-actions').onclick = (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'check-all') checkAll();
    else if (act === 'reveal-all') revealAll2();
    else if (act === 'reset-all') resetAll();
  };
}

function showStatute(cardId, show) {
  const sb = document.getElementById(`statute-${cardId}`);
  if (sb) sb.classList.toggle('show', show);
}

const getInputs = id => Array.from(document.querySelectorAll(`.blank-input[data-card="${id}"]`));
const getAllInputs = () => Array.from(document.querySelectorAll('.blank-input'));

function checkCard(cardId) {
  getInputs(cardId).forEach(inp => {
    inp.classList.remove('correct', 'wrong', 'revealed');
    if (!inp.value.trim()) return;
    const ok = normalize(inp.dataset.answer) === normalize(inp.value);
    inp.classList.add(ok ? 'correct' : 'wrong');
  });
  showStatute(cardId, true);
  recordStudy(currentSection.id, currentMode);
  updateScore();
}

function revealCard(cardId) {
  getInputs(cardId).forEach(inp => {
    inp.value = inp.dataset.answer;
    inp.classList.remove('correct', 'wrong');
    inp.classList.add('revealed');
  });
  showStatute(cardId, true);
  recordStudy(currentSection.id, currentMode);
  updateScore();
}

function resetCard(cardId) {
  getInputs(cardId).forEach(inp => {
    inp.value = '';
    inp.classList.remove('correct', 'wrong', 'revealed');
  });
  showStatute(cardId, false);
  updateScore();
}

function checkAll() {
  currentSection.cards.forEach(c => checkCard(c.id));
}

function toggleAnswer(cardId) {
  const el = document.getElementById(`ans-${cardId}`);
  const btn = document.getElementById(`btn-ans-${cardId}`);
  const shown = el.style.display !== 'none';
  el.style.display = shown ? 'none' : 'block';
  showStatute(cardId, !shown);
  btn.textContent = shown ? '정답 보기' : '정답 숨기기';
  if (!shown) recordStudy(currentSection.id, currentMode);
}

function resetCard2(cardId) {
  const ta = document.querySelector(`.full-textarea[data-card="${cardId}"]`);
  if (ta) ta.value = '';
  const ans = document.getElementById(`ans-${cardId}`);
  if (ans) ans.style.display = 'none';
  const btn = document.getElementById(`btn-ans-${cardId}`);
  if (btn) btn.textContent = '정답 보기';
  showStatute(cardId, false);
  updateScore();
}

function revealAll2() {
  currentSection.cards.forEach(c => {
    const el = document.getElementById(`ans-${c.id}`);
    const btn = document.getElementById(`btn-ans-${c.id}`);
    if (el && btn) {
      el.style.display = 'block';
      btn.textContent = '정답 숨기기';
    }
    showStatute(c.id, true);
  });
  recordStudy(currentSection.id, currentMode);
}

function resetAll() {
  if (currentMode === 1) currentSection.cards.forEach(c => resetCard(c.id));
  else currentSection.cards.forEach(c => resetCard2(c.id));
}

function updateScore() {
  const scoreLabel = document.getElementById('score-label');
  const scoreEl = document.getElementById('score');
  const totalEl = document.getElementById('total');
  const progressEl = document.getElementById('progress');

  if (currentMode === 1) {
    const all = getAllInputs();
    const correct = all.filter(i => i.classList.contains('correct') || i.classList.contains('revealed')).length;
    scoreLabel.textContent = '정답';
    scoreEl.textContent = correct;
    totalEl.textContent = all.length;
    const pct = all.length ? (correct / all.length * 100) : 0;
    progressEl.style.width = pct + '%';
  } else {
    if (!currentSection) return;
    const written = currentSection.cards.filter(c => {
      const ta = document.querySelector(`.full-textarea[data-card="${c.id}"]`);
      return ta && ta.value.trim().length > 0;
    }).length;
    scoreLabel.textContent = '작성';
    scoreEl.textContent = written;
    totalEl.textContent = currentSection.cards.length;
    const pct = currentSection.cards.length ? (written / currentSection.cards.length * 100) : 0;
    progressEl.style.width = pct + '%';
  }
}

// ─── 부팅 ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupAuth();
  setupRouter();
});
