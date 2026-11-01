'use strict';

const ROUND_LENGTH = 10;
const $ = (sel, root = document) => root.querySelector(sel);
const wait = ms => new Promise(r => setTimeout(r, ms));
const shuffle = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
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
