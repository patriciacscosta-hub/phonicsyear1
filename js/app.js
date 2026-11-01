'use strict';

const ROUND_LENGTH = 10;
const $ = (sel, root = document) => root.querySelector(sel);
const wait = ms => new Promise(r => setTimeout(r, ms));
const shuffle = (arr, rnd = Math.random) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ } },
};

const state = { game: null, stage: null, round: [], i: 0, score: 0, firstTry: true, busy: false, results: [] };
let muted = store.get('muted', false);

/* ---------- Voice and sound effects ---------- */

let voice = null;
function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const voices = speechSynthesis.getVoices();
  const gb = voices.filter(v => /en[-_]GB/i.test(v.lang));
  voice = gb.find(v => /Serena|Kate|Martha|Stephanie|Libby|Sonia|Female|Daniel/i.test(v.name)) || gb[0]
    || voices.find(v => /^en/i.test(v.lang)) || null;
}
if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

function speak(text, rate = 0.85) {
  if (muted || !('speechSynthesis' in window)) return Promise.resolve();
  speechSynthesis.cancel();
  return new Promise(resolve => {
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.lang = 'en-GB';
    u.rate = rate;
    u.pitch = 1.1;
    u.onend = u.onerror = resolve;
    speechSynthesis.speak(u);
    setTimeout(resolve, 5000);
  });
}

let audioCtx = null;
function beep(notes) {
  if (muted) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    let t = audioCtx.currentTime;
    for (const [freq, dur, type] of notes) {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(audioCtx.destination);
      o.start(t);
      o.stop(t + dur);
      t += dur * 0.8;
    }
  } catch { /* no audio */ }
}
const chime = () => beep([[523, 0.15], [659, 0.15], [784, 0.3]]);
const buzz = () => beep([[220, 0.25, 'triangle'], [180, 0.35, 'triangle']]);

function updateMuteButtons() {
  document.querySelectorAll('.mute-btn').forEach(b => { b.textContent = muted ? '🔇' : '🔊'; });
}

/* ---------- Words ---------- */

function parseWord(raw, alien) {
  const [graphemes, say] = raw.split('|');
  const tokens = graphemes.trim().split(/\s+/);
  const text = wordText(tokens);
  return { tokens, text, say: say || text, alien };
}

// "c a_e k" -> "cake"
function wordText(tokens) {
  let out = '', pendingE = false;
  tokens.forEach((t, i) => {
    const clean = t.replace('~', '');
    if (clean.includes('_')) {
      out += clean[0];
      if (i === tokens.length - 1) out += 'e'; else pendingE = true;
    } else {
      out += clean;
      if (pendingE) { out += 'e'; pendingE = false; }
    }
  });
  return out;
}

const display = t => t.replace('~', '').replace('_', '-');

function grapheme(letters, token, mark) {
  const g = el('span', 'g');
  g.dataset.token = token;
  g.append(el('span', 'l', letters));
  if (mark) g.append(el('span', 'mark ' + mark));
  return g;
}

// Draws a word with RWI sound buttons: a dot under single letters, a dash under
// "special friends" and a curved line joining split digraphs.
function renderWord(tokens) {
  const wrap = el('div', 'word');
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.includes('_') && i + 1 < tokens.length) {
      const next = tokens[i + 1].replace('~', '');
      const split = el('span', 'split');
      split.dataset.token = t;
      const v = grapheme(t[0], t, null), e = grapheme('e', t, null);
      v.classList.add('v'); e.classList.add('v');
      const arc = el('span', 'arc');
      arc.dataset.token = t;
      split.append(v, grapheme(next, tokens[i + 1], next.length > 1 ? 'dash' : 'dot'), e, arc);
      wrap.append(split);
      i++;
    } else {
      const clean = display(t).replace('-', '');
      const letters = t.includes('_') ? t[0] + 'e' : clean;
      wrap.append(grapheme(letters, t, letters.length > 1 ? 'dash' : 'dot'));
    }
  }
  return wrap;
}

function speakSound(token, node) {
  const info = SOUND_INFO[token];
  if (!info) return;
  const lit = node.closest('.split') || node.closest('.g');
  if (lit) { lit.classList.add('lit'); setTimeout(() => lit.classList.remove('lit'), 700); }
  speak(info[0], 0.7);
}

/* ---------- Building rounds ---------- */

function stageSets(stage) { return stage === 'mixed' ? SETS : SETS.filter(s => s.id === stage); }

function buildRound(stage) {
  const sets = stageSets(stage);
  const real = shuffle(sets.flatMap(s => s.real)).slice(0, ROUND_LENGTH / 2).map(w => parseWord(w, false));
  const alien = shuffle(sets.flatMap(s => s.alien)).slice(0, ROUND_LENGTH / 2).map(w => parseWord(w, true));
  return shuffle([...real, ...alien]);
}

const sameSound = (a, b) => a === b || SAME_SOUND.some(g => g.includes(a) && g.includes(b));
const isVowel = t => VOWELS.has(t);
const SAFE_START = ['b', 'c', 'd', 'f', 'g', 'h', 'j', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'w', 'y', 'z', 'sh', 'ch', 'th', 'qu'];
const SAFE_END = ['b', 'd', 'g', 'm', 'n', 'p', 't', 'sh', 'ch', 'th', 'ng', 'nk'];

// Makes "nearly the same" words by swapping one sound, so the child has to
// read every sound rather than guess from the first letter.
function makeDistractors(word, stage, count = 2) {
  const maxSet = stage === 'mixed' ? 3 : stage;
  const vowelPool = SETS.filter(s => s.id <= maxSet).flatMap(s => s.sounds).filter(isVowel);
  const firstSetVowels = ['a', 'e', 'i', 'o', 'u'];
  const pool = vowelPool.length ? vowelPool : firstSetVowels;
  const allVowels = [...new Set([...firstSetVowels, ...pool])];
  const t = word.tokens;
  const seen = new Set([word.text]);
  const out = [];

  for (let attempt = 0; attempt < 300 && out.length < count; attempt++) {
    const i = Math.floor(Math.random() * t.length);
    const cur = t[i];
    const last = i === t.length - 1;
    let choice;

    if (isVowel(cur)) {
      const prefer = Math.random() < 0.6 ? pool : allVowels;
      choice = pick(prefer.filter(v => !sameSound(v, cur)));
      if (!choice) continue;
      if (choice.includes('_') && !(i === t.length - 2 && /^[bcdfgklmnpstvz]$/.test(t[i + 1]))) continue;
      if (last && /^[aeiou]$|_/.test(choice)) continue;
      if (!last && ['are', 'ire', 'ure', 'ear', 'air'].includes(choice)) continue;
    } else {
      const prevC = i > 0 && !isVowel(t[i - 1]);
      const nextC = !last && !isVowel(t[i + 1]);
      if (prevC || nextC) continue; // leave consonant blends (fr, st, mp...) alone
      if (i > 0 && t[i - 1].includes('_')) continue;
      const options = i === 0 ? SAFE_START : last ? SAFE_END : [];
      const afterShort = i > 0 && /^[aeiou]$/.test(t[i - 1]);
      choice = pick(options.filter(c => !sameSound(c, cur) && (afterShort || !['ng', 'nk'].includes(c))));
      if (!choice) continue;
    }

    const tokens = [...t];
    tokens[i] = choice;
    const text = wordText(tokens);
    if (seen.has(text) || BLOCKED.some(b => text.includes(b))) continue;
    if (/(.)\1/.test(text) && !/ee|oo/.test(text)) continue;
    seen.add(text);
    out.push({ tokens, text });
  }
  return out;
}

/* ---------- Screens ---------- */

function show(id) {
  document.querySelectorAll('.screen').forEach(s => { s.hidden = s.id !== id; });
  window.scrollTo(0, 0);
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

function bestKey(game, stage) { return `best-${game}-${stage}`; }

function showStages(game) {
  state.game = game;
  $('#stages-title').textContent = game === 'sort' ? 'Level 1: Alien or Earth?' : 'Level 2: Find the Word';
  $('#stages-hint').textContent = 'Pick your mission. Start with Set 1!';
  const grid = $('#stage-grid');
  grid.replaceChildren();
  const stages = [...SETS.map(s => ({ id: s.id, name: s.title, sub: s.subtitle, chips: s.sounds })),
    { id: 'mixed', name: 'Check practice', sub: 'All the sets mixed up, just like the real Phonics Check', chips: [] }];
  for (const s of stages) {
    const b = el('button', 'stage' + (s.id === 'mixed' ? ' mixed' : ''));
    b.append(el('span', 'name', (s.id === 'mixed' ? '⭐ ' : '🪐 ') + s.name), el('span', 'sub', s.sub));
    if (s.chips.length) {
      const chips = el('span', 'chips');
      s.chips.slice(0, 12).forEach(c => chips.append(el('span', null, display(c))));
      if (s.chips.length > 12) chips.append(el('span', null, '…'));
      b.append(chips);
    }
    const best = store.get(bestKey(game, s.id), 0);
    const stars = el('span', 'best');
    for (let n = 1; n <= 3; n++) stars.append(el('span', n <= best ? 'on' : null, '★'));
    b.append(stars);
    b.onclick = () => startRound(s.id);
    grid.append(b);
  }
  show('stages');
}

function startRound(stage) {
  Object.assign(state, { stage, round: buildRound(stage), i: 0, score: 0, results: [], busy: false });
  if (state.game === 'sort') { show('sort'); nextSort(); }
  else { show('find'); nextFind(); }
}

function drawProgress(container) {
  container.replaceChildren();
  for (let n = 0; n < state.round.length; n++) {
    const dot = el('i');
    if (n < state.results.length) dot.className = state.results[n] ? 'ok' : 'no';
    else if (n === state.i) dot.className = 'now';
    container.append(dot);
  }
}

let feedbackTimer;
function feedback(ok) {
  const f = $('#feedback');
  clearTimeout(feedbackTimer);
  f.className = ok ? 'ok' : 'no';
  f.hidden = false;
  // restart the stamp animation
  f.querySelectorAll('svg').forEach(s => { s.style.animation = 'none'; void s.offsetWidth; s.style.animation = ''; });
  (ok ? chime : buzz)();
  feedbackTimer = setTimeout(() => { f.hidden = true; }, 1300);
}

function record(ok) {
  state.results.push(ok);
  if (ok) state.score++;
  state.i++;
}

/* ---------- Level 1: Alien or Earth? ---------- */

const card = $('#sort-card');
let drag = null;

function nextSort() {
  drawProgress($('#sort-progress'));
  if (state.i >= state.round.length) return finish();
  const word = state.round[state.i];
  card.className = 'word-card';
  card.style.transform = '';
  card.style.opacity = '';
  card.replaceChildren(renderWord(word.tokens), el('span', 'drag-hint', 'tap the dots · drag me'));
  void card.offsetWidth;
  card.classList.add('enter');
  state.busy = false;
  if (state.i === 0) speak('Is it a real word, or an alien word?');
}

function zoneAt(x, y) {
  for (const z of document.querySelectorAll('.planet')) {
    const r = z.getBoundingClientRect();
    if (x > r.left - 20 && x < r.right + 20 && y > r.top - 20 && y < r.bottom + 20) return z;
  }
  return null;
}

card.addEventListener('pointerdown', e => {
  if (state.busy) return;
  drag = { x: e.clientX, y: e.clientY, moved: false, target: e.target, id: e.pointerId };
  card.setPointerCapture(e.pointerId);
});

card.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) > 12) {
    drag.moved = true;
    card.classList.remove('enter', 'back');
    card.classList.add('dragging');
  }
  if (drag.moved) {
    card.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 25}deg)`;
    const z = zoneAt(e.clientX, e.clientY);
    document.querySelectorAll('.planet').forEach(p => p.classList.toggle('hover', p === z));
  }
});

function endDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag;
  drag = null;
  card.classList.remove('dragging');
  document.querySelectorAll('.planet').forEach(p => p.classList.remove('hover'));
  if (!d.moved) {
    const t = d.target.closest('[data-token]');
    if (t) speakSound(t.dataset.token, t);
    return;
  }
  const zone = e.type === 'pointerup' ? zoneAt(e.clientX, e.clientY) : null;
  if (zone) answerSort(zone);
  else { card.classList.add('back'); card.style.transform = ''; }
}
card.addEventListener('pointerup', endDrag);
card.addEventListener('pointercancel', endDrag);

// Tapping a planet also works, for children who find dragging tricky.
document.querySelectorAll('.planet').forEach(p => p.addEventListener('click', () => { if (!state.busy) answerSort(p); }));

function flyTo(zone) {
  const c = card.getBoundingClientRect(), z = zone.getBoundingClientRect();
  const cur = new DOMMatrix(getComputedStyle(card).transform);
  const dx = z.left + z.width / 2 - (c.left + c.width / 2) + cur.m41;
  const dy = z.top + z.height / 2 - (c.top + c.height / 2) + cur.m42;
  card.classList.remove('back', 'enter');
  card.classList.add('fly');
  card.style.transform = `translate(${dx}px, ${dy}px) scale(.15) rotate(20deg)`;
  card.style.opacity = '0';
}

async function answerSort(zone) {
  state.busy = true;
  const word = state.round[state.i];
  const saidAlien = zone.dataset.zone === 'alien';
  const ok = saidAlien === word.alien;
  record(ok);
  feedback(ok);
  if (ok) {
    flyTo(zone);
    await speak(word.alien ? `Yes! ${word.say} is an alien word.` : `Yes! ${word.say} is a real word.`);
  } else {
    card.classList.add('back');
    card.style.transform = '';
    await speak(word.alien ? `Oops! ${word.say} is an alien word.` : `Oops! ${word.say} is a real word. It lives on Earth.`);
    flyTo(word.alien ? $('#zone-alien') : $('#zone-earth'));
  }
  await wait(700);
  nextSort();
}

/* ---------- Level 2: Find the word ---------- */

function promptFor(word) {
  return word.alien ? `Find the alien word... ${word.say}` : `Find the word... ${word.say}`;
}

function nextFind() {
  drawProgress($('#find-progress'));
  if (state.i >= state.round.length) return finish();
  const word = state.round[state.i];
  state.firstTry = true;
  state.busy = false;

  const p = $('#find-text');
  p.replaceChildren();
  if (word.alien) p.append('Find the ', el('span', 'alien-tag', '👽 alien'), ' word');
  else p.append('Find the 🌍 real word');

  const choices = shuffle([{ tokens: word.tokens, text: word.text, correct: true }, ...makeDistractors(word, state.stage)]);
  const box = $('#options');
  box.replaceChildren();
  for (const c of choices) {
    const b = el('button', 'option');
    b.setAttribute('aria-label', c.text);
    b.append(renderWord(c.tokens));
    b.onclick = () => answerFind(b, c.correct);
    box.append(b);
  }
  wait(300).then(() => speak(promptFor(word)));
}

$('#listen-btn').addEventListener('click', () => {
  const word = state.round[state.i];
  if (word) speak(word.say, 0.75);
});

function badge(ok) {
  const s = $(ok ? '#feedback .tick' : '#feedback .cross').cloneNode(true);
  s.setAttribute('class', 'badge');
  return s;
}

async function answerFind(button, correct) {
  if (state.busy || button.classList.contains('wrong')) return;
  const word = state.round[state.i];
  if (correct) {
    state.busy = true;
    record(state.firstTry);
    button.classList.add('right');
    button.append(badge(true));
    feedback(true);
    await speak(`Yes! ${word.say}`);
    await wait(700);
    nextFind();
  } else {
    state.firstTry = false;
    button.classList.add('wrong');
    button.append(badge(false));
    feedback(false);
    await speak('Not quite. Try again!');
  }
}

/* ---------- End of round ---------- */

function starsFor(score) { return score >= 9 ? 3 : score >= 6 ? 2 : 1; }

function finish() {
  const stars = starsFor(state.score);
  const key = bestKey(state.game, state.stage);
  store.set(key, Math.max(stars, store.get(key, 0)));

  const box = $('#done-stars');
  box.replaceChildren();
  for (let n = 1; n <= 3; n++) {
    const s = el('span', n <= stars ? null : 'off', '⭐');
    s.style.animationDelay = `${n * 0.25}s`;
    box.append(s);
  }
  const title = ['', 'Good try, astronaut!', 'Great reading!', 'Super star reader!'][stars];
  $('#done-title').textContent = title;
  $('#done-score').textContent = `You got ${state.score} out of ${state.round.length}.`;
  const order = [1, 2, 3, 'mixed'];
  const next = order[order.indexOf(state.stage) + 1];
  $('#next-btn').hidden = !next;
  $('#next-btn').onclick = () => startRound(next);
  show('done');
  if (stars === 3) confetti();
  speak(`${title} You got ${state.score} out of ${state.round.length}.`);
}

function confetti() {
  for (let n = 0; n < 24; n++) {
    const c = el('span', 'confetti', pick(['⭐', '🚀', '👽', '🌍', '✨']));
    c.style.left = `${Math.random() * 100}vw`;
    c.style.animationDelay = `${Math.random() * 1.2}s`;
    document.body.append(c);
    setTimeout(() => c.remove(), 4000);
  }
}

$('#again-btn').addEventListener('click', () => startRound(state.stage));

/* ---------- Level 3: Practice Phonics Check ---------- */

const CHECK_COUNT = 20;
const PASS_MARK = 32;
const PER_PAGE = 4;
const ALIEN_SVG = '<svg viewBox="0 0 60 70" aria-label="alien"><line x1="22" y1="16" x2="16" y2="3" stroke="#2fb36b" stroke-width="4" stroke-linecap="round"/><line x1="38" y1="16" x2="44" y2="3" stroke="#2fb36b" stroke-width="4" stroke-linecap="round"/><circle cx="16" cy="3" r="4" fill="#f5a623"/><circle cx="44" cy="3" r="4" fill="#f5a623"/><ellipse cx="30" cy="36" rx="24" ry="22" fill="#3ddc84"/><ellipse cx="30" cy="31" rx="10" ry="9" fill="#fff"/><circle cx="30" cy="32" r="5" fill="#1b1446"/><path d="M21 45 Q30 52 39 45" stroke="#1b1446" stroke-width="3" fill="none" stroke-linecap="round"/><rect x="18" y="56" width="24" height="12" rx="6" fill="#3ddc84"/></svg>';

// Same number -> same check every time, so "Check 3" is always the same 40 words.
function seeded(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Mirrors the real check: Section 1 is simpler (mostly Set 1), Section 2 is harder
// (Sets 2 and 3, longer and two-syllable words). Alien words come first in each section.
function buildCheck(id) {
  const rnd = id === 'surprise' ? Math.random : seeded(id * 7919);
  const set = n => SETS.find(s => s.id === n);
  const deal = list => { const pool = shuffle(list, rnd); return n => pool.splice(0, n); };
  const a1 = deal(set(1).alien), a2 = deal(set(2).alien), a3 = deal(set(3).alien), aX = deal(CHECK_EXTRA.alien);
  const r1 = deal(set(1).real), r2 = deal(set(2).real), r3 = deal(set(3).real), rX = deal(CHECK_EXTRA.real);
  const words = (list, alien) => list.map(w => parseWord(w, alien));
  return {
    practice: [...words(a1(2), true), ...words(r1(2), false)],
    sections: [
      [...words([...a1(9), ...a2(3)], true), ...words([...r1(6), ...r2(2)], false)],
      [...words([...a2(2), ...a3(4), ...aX(2)], true), ...words([...r2(4), ...r3(5), ...rX(3)], false)],
    ],
  };
}

const check = { id: null, data: null, part: 'practice', page: 0, marks: null };

function checkResult(id) { return store.get(`check-${id}`, null); }

function showChecks() {
  const grid = $('#check-grid');
  grid.replaceChildren();
  for (let n = 1; n <= CHECK_COUNT; n++) {
    const best = checkResult(n);
    const b = el('button', 'check-tile' + (best ? (best >= PASS_MARK ? ' pass' : ' tried') : ''));
    b.append(el('span', 'n', `Check ${n}`), el('span', 's', best ? `Best: ${best}/40${best >= PASS_MARK ? ' ✓' : ''}` : 'Not tried yet'));
    b.onclick = () => startCheck(n);
    grid.append(b);
  }
  const surprise = el('button', 'check-tile surprise');
  surprise.append(el('span', 'n', '🎲 Surprise'), el('span', 's', 'New mix every time'));
  surprise.onclick = () => startCheck('surprise');
  grid.append(surprise);

  const history = store.get('check-history', []);
  $('#check-history').textContent = history.length
    ? 'Recent scores: ' + history.slice(-6).map(h => `${h.name} ${h.score}/40 (${h.date})`).join(' · ')
    : '';
  show('checks');
}

function startCheck(id) {
  Object.assign(check, { id, data: buildCheck(id), part: 'practice', page: 0, marks: { practice: [], 0: [], 1: [] } });
  renderCheckPage();
  show('check');
}

const checkName = () => check.id === 'surprise' ? 'Surprise check' : `Check ${check.id}`;
const partWords = () => check.part === 'practice' ? check.data.practice : check.data.sections[check.part];
const pageCount = () => Math.ceil(partWords().length / PER_PAGE);

function renderCheckPage() {
  const words = partWords().slice(check.page * PER_PAGE, (check.page + 1) * PER_PAGE);
  const marks = check.marks[check.part];
  const offset = check.page * PER_PAGE;
  $('#check-title').textContent = check.part === 'practice' ? 'Practice page' : `Section ${check.part + 1}`;
  $('#check-sub').textContent = check.part === 'practice'
    ? `${checkName()} · Let's practise first. These words don't count.`
    : `${checkName()} · Page ${check.page + 1} of ${pageCount()}${words[0].alien ? ' · Alien words' : ' · Real words'}`;

  const page = $('#check-page');
  page.replaceChildren();
  words.forEach((w, k) => {
    const idx = offset + k;
    const card = el('div', 'check-word');
    const text = el('div', 'text');
    if (w.alien) text.innerHTML = ALIEN_SVG;
    text.append(el('span', null, w.text));
    const hear = el('button', 'hear', '🔊');
    hear.setAttribute('aria-label', `Grown-up: hear ${w.text}`);
    hear.onclick = () => speak(w.say, 0.8);
    const yes = el('button', 'yes', '✓'), no = el('button', 'no', '✗');
    yes.setAttribute('aria-label', `${w.text} read correctly`);
    no.setAttribute('aria-label', `${w.text} not read correctly`);
    const paint = () => {
      yes.classList.toggle('on', marks[idx] === true);
      no.classList.toggle('on', marks[idx] === false);
      card.classList.toggle('marked-yes', marks[idx] === true);
      card.classList.toggle('marked-no', marks[idx] === false);
      $('#check-next').disabled = words.some((_, j) => marks[offset + j] == null);
    };
    yes.onclick = () => { marks[idx] = true; beep([[660, 0.12]]); paint(); };
    no.onclick = () => { marks[idx] = false; beep([[300, 0.12, 'triangle']]); paint(); };
    const row = el('div', 'marks');
    row.append(yes, no);
    card.append(hear, text, row);
    page.append(card);
    paint();
  });
  $('#check-prev').disabled = check.part === 'practice' ? check.page === 0 : false;
  const lastPage = check.page === pageCount() - 1;
  $('#check-next').textContent = !lastPage ? 'Next page ➡️'
    : check.part === 'practice' ? 'Start Section 1 ➡️'
    : check.part === 0 ? 'Finish Section 1 ➡️' : 'Finish the check 🏁';
}

function checkMessage(icon, title, text, button, onGo) {
  $('#check-msg-icon').textContent = icon;
  $('#check-msg-title').textContent = title;
  $('#check-msg-text').textContent = text;
  $('#check-msg-go').textContent = button;
  $('#check-msg-go').onclick = onGo;
  show('check-msg');
}

$('#check-next').addEventListener('click', () => {
  if (check.page < pageCount() - 1) { check.page++; renderCheckPage(); window.scrollTo(0, 0); return; }
  if (check.part === 'practice') {
    checkMessage('📝', 'Section 1', 'Now for the real words! Read each word out loud. Some are real and some are alien words.',
      'Start Section 1', () => { check.part = 0; check.page = 0; renderCheckPage(); show('check'); });
  } else if (check.part === 0) {
    checkMessage('🌟', 'Section 1 done!', 'Great work, astronaut! Have a little break and a stretch before Section 2.',
      'Start Section 2', () => { check.part = 1; check.page = 0; renderCheckPage(); show('check'); });
  } else {
    finishCheck();
  }
});

$('#check-prev').addEventListener('click', () => {
  if (check.page > 0) check.page--;
  else if (check.part === 1) { check.part = 0; check.page = pageCount() - 1; }
  else if (check.part === 0) { check.part = 'practice'; check.page = pageCount() - 1; }
  renderCheckPage();
});

$('#check-quit').addEventListener('click', () => {
  if (confirm('Stop this check? The marks so far won\'t be saved.')) showChecks();
});

function finishCheck() {
  const all = [0, 1].flatMap(s => check.data.sections[s].map((w, i) => ({ w, ok: check.marks[s][i] === true, s })));
  const score = all.filter(r => r.ok).length;
  const count = f => all.filter(r => f(r) && r.ok).length;
  const pass = score >= PASS_MARK;

  if (check.id !== 'surprise') store.set(`check-${check.id}`, Math.max(score, checkResult(check.id) || 0));
  const history = store.get('check-history', []);
  history.push({ name: checkName(), score, date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) });
  store.set('check-history', history.slice(-30));

  $('#check-done-icon').textContent = pass ? '🏆' : '🚀';
  $('#check-done-title').textContent = pass ? 'Brilliant reading!' : 'Well done for finishing!';
  $('#check-done-score').textContent = `${score} / 40`;
  $('#check-done-verdict').textContent = pass
    ? `That's at or above ${PASS_MARK}, the score children have needed to reach the expected standard. On track!`
    : `The expected standard has been ${PASS_MARK} out of 40. ${PASS_MARK - score} more to go. Keep practising the words below!`;

  const box = $('#check-breakdown');
  box.replaceChildren();
  [['Section 1', count(r => r.s === 0)], ['Section 2', count(r => r.s === 1)],
    ['🌍 Real words', count(r => !r.w.alien)], ['👽 Alien words', count(r => r.w.alien)]].forEach(([label, n]) => {
    const d = el('div');
    d.append(el('b', null, `${n}/20`), label);
    box.append(d);
  });

  const missed = all.filter(r => !r.ok);
  const m = $('#check-missed');
  m.replaceChildren();
  if (missed.length) {
    m.append(el('h3', null, 'Words to practise'));
    const chips = el('div', 'chips');
    missed.forEach(r => chips.append(el('span', r.w.alien ? 'alien' : null, (r.w.alien ? '👽 ' : '') + r.w.text)));
    m.append(chips);
  }

  const next = typeof check.id === 'number' && check.id < CHECK_COUNT ? check.id + 1 : null;
  $('#check-next-test').hidden = !next && check.id !== 'surprise';
  $('#check-next-test').textContent = next ? `📝 Check ${next}` : '🎲 Another surprise';
  $('#check-next-test').onclick = () => startCheck(next || 'surprise');

  show('check-done');
  if (pass) confetti();
  speak(pass ? 'Brilliant reading!' : 'Well done for finishing!');
}

/* ---------- Speed sounds ---------- */

function showSounds(setId = 1) {
  const tabs = $('#sound-tabs');
  tabs.replaceChildren();
  for (const s of SETS) {
    const b = el('button', s.id === setId ? 'on' : null, s.title);
    b.onclick = () => showSounds(s.id);
    tabs.append(b);
  }
  const grid = $('#sound-grid');
  grid.replaceChildren();
  for (const t of SETS.find(s => s.id === setId).sounds) {
    const [say, cue] = SOUND_INFO[t];
    const b = el('button', 'sound-btn', display(t));
    b.append(el('small', null, cue));
    b.onclick = async () => {
      b.classList.add('lit');
      await speak(`${say}... ${cue}`, 0.8);
      b.classList.remove('lit');
    };
    grid.append(b);
  }
  show('sounds');
}

/* ---------- Wiring ---------- */

document.querySelectorAll('[data-game]').forEach(b => b.addEventListener('click', () => showStages(b.dataset.game)));
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => {
  const go = b.dataset.go;
  if (go === 'stages') showStages(state.game);
  else if (go === 'sounds') showSounds();
  else if (go === 'checks') showChecks();
  else show(go);
}));
document.querySelectorAll('.mute-btn').forEach(b => b.addEventListener('click', () => {
  muted = !muted;
  store.set('muted', muted);
  if (muted && 'speechSynthesis' in window) speechSynthesis.cancel();
  updateMuteButtons();
}));
updateMuteButtons();

(function makeStars() {
  const sky = $('#stars');
  for (let n = 0; n < 70; n++) {
    const s = el('i');
    s.style.left = `${Math.random() * 100}%`;
    s.style.top = `${Math.random() * 100}%`;
    s.style.animationDelay = `${Math.random() * 3}s`;
    s.style.opacity = String(0.3 + Math.random() * 0.7);
    sky.append(s);
  }
})();
