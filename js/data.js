// Phonics data following the Read Write Inc. (RWI) Speed Sound sets.
//
// Words are written as graphemes separated by spaces, e.g. "sh i p".
//   a_e, i_e, o_e, u_e  = split digraphs ("c a_e k" -> cake)
//   oo~  = short "oo" (look), oo = long "oo" (zoo)
//   ow~  = "ow" as in brown, ow = "ow" as in blow
//   "word|say" gives the voice a spelling to say an alien word more clearly.

// token: [sound to say, RWI picture word / phrase]
const SOUND_INFO = {
  // Set 1
  m: ['mmm', 'mountain'], a: ['ah', 'apple'], s: ['sss', 'snake'], d: ['d', 'dinosaur'],
  t: ['t', 'tower'], i: ['ih', 'insects'], n: ['nnn', 'net'], p: ['p', 'pirate'],
  g: ['g', 'girl'], o: ['o', 'orange'], c: ['k', 'caterpillar'], k: ['k', 'kangaroo'],
  u: ['uh', 'umbrella'], b: ['b', 'boot'], f: ['fff', 'flower'], e: ['eh', 'elephant'],
  l: ['lll', 'leg'], h: ['h', 'horse'], sh: ['shh', 'Shh, the baby is asleep'], r: ['rrr', 'robot'],
  j: ['j', 'jack in a box'], v: ['vvv', 'vulture'], y: ['y', 'yak'], w: ['w', 'worm'],
  th: ['th', 'thank you'], z: ['zzz', 'zig zag zip'], ch: ['ch', 'choo choo'], qu: ['kw', 'queen'],
  x: ['ks', 'box'], ck: ['k', 'duck'], ng: ['ng', 'thing on a string'], nk: ['nk', 'I think I stink'],
  // Set 2
  ay: ['ay', 'may I play'], ee: ['ee', 'what can you see'], igh: ['eye', 'fly high'],
  ow: ['oh', 'blow the snow'], oo: ['oo', 'poo at the zoo'], 'oo~': ['oo', 'look at a book'],
  ar: ['ar', 'start the car'], or: ['or', 'shut the door'], air: ['air', "that's not fair"],
  ir: ['er', 'whirl and twirl'], ou: ['ow', 'shout it out'], oy: ['oy', 'toy for a boy'],
  // Set 3
  ea: ['ee', 'cup of tea'], oi: ['oy', 'spoil the boy'], a_e: ['ay', 'make a cake'],
  i_e: ['eye', 'nice smile'], o_e: ['oh', 'phone home'], u_e: ['you', 'huge brute'],
  aw: ['or', 'yawn at dawn'], are: ['air', 'care and share'], ur: ['er', 'nurse for a purse'],
  er: ['er', 'a better letter'], 'ow~': ['ow', 'brown cow'], ai: ['ay', 'snail in the rain'],
  oa: ['oh', 'goat in a boat'], ew: ['you', 'chew the stew'], ire: ['eye-er', 'fire fire'],
  ear: ['ear', 'hear with your ear'], ure: ['yoor', 'sure it\'s pure'],
};

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'ay', 'ee', 'igh', 'ow', 'oo', 'oo~', 'ar', 'or',
  'air', 'ir', 'ou', 'oy', 'ea', 'oi', 'a_e', 'i_e', 'o_e', 'u_e', 'aw', 'are', 'ur', 'er', 'ow~',
  'ai', 'oa', 'ew', 'ire', 'ear', 'ure']);

// Graphemes that make the same sound - never used as "wrong" choices for each other.
const SAME_SOUND = [['ay', 'ai', 'a_e'], ['ee', 'ea'], ['igh', 'i_e'], ['ow', 'oa', 'o_e'],
  ['oo', 'ew', 'u_e'], ['or', 'aw'], ['ir', 'ur', 'er'], ['ou', 'ow~'], ['oy', 'oi'],
  ['air', 'are'], ['c', 'k', 'ck']];

const SETS = [
  {
    id: 1, title: 'Set 1', subtitle: 'Single sounds & special friends',
    sounds: ['m', 'a', 's', 'd', 't', 'i', 'n', 'p', 'g', 'o', 'c', 'k', 'u', 'b', 'f', 'e', 'l', 'h',
      'sh', 'r', 'j', 'v', 'y', 'w', 'th', 'z', 'ch', 'qu', 'x', 'ng', 'nk'],
    real: ['c a t', 'd o g', 's u n', 'p i g', 'h a t', 'b e d', 'f o x', 'j a m', 'w e b', 'z i p',
      'sh i p', 'sh o p', 'f i sh', 'ch i p', 'ch i n', 'm u ch', 'th i n', 'm o th', 'r i ng',
      's o ng', 's i nk', 'p i nk', 'qu i z', 'qu i t', 'f r o g', 's t o p', 'f l a g', 'c r a b',
      'd r u m', 't e n t', 'm i l k', 'j u m p', 'h a n d', 'b e s t', 'l a m p', 's w i m',
      'th i nk', 'ch e s t', 'b r u sh', 'y e s', 'v a n',
      'b u s', 'r u g', 't o p', 'w i g', 'n e t', 'l e g', 'm u d', 'p o t', 'f i n', 'd u ck', 's o ck',
      'sh e d', 'ch o p', 'th a t', 'w i th', 'sh e l f', 'b e n ch', 'l u n ch', 'c l a p', 'g r i n',
      's p e n d', 'b l a nk', 't r u nk', 's m a sh', 'f r e sh'],
    alien: ['v a p', 'z o m', 't i b', 'j e x', 'm u z', 'f e p', 'sh e b', 'ch a g', 'th o p',
      'qu i b', 'y e ng', 'v u nk', 'b l i m', 'g r o t', 'p l a b', 's t i d', 'f r e m',
      'd r e z', 's l u b', 'k e sh', 'm i p', 'z a ch', 'th e v', 'w o z', 'g l e nk', 'sh u v',
      'ch o b', 'qu e n', 'y a d', 'h i v', 'b o j', 's p u g', 't r i sh', 'c r e nk', 'f l o th',
      'g u b', 'n e g', 'p o v', 'r i v', 'l u p', 'w e ch', 'y i m', 'j u sh', 'h e th', 'qu o p',
      's t e ch', 'c l e m p', 't r o b', 'g l i sh', 's n u v', 'p r e th', 's k o t', 'j a nk', 'w o sh',
      'f e nk', 'v o ng'],
  },
  {
    id: 2, title: 'Set 2', subtitle: 'ay ee igh ow oo ar or air ir ou oy',
    sounds: ['ay', 'ee', 'igh', 'ow', 'oo', 'oo~', 'ar', 'or', 'air', 'ir', 'ou', 'oy'],
    real: ['d ay', 'p l ay', 's t ay', 's ee', 't r ee', 'sh ee p', 'n igh t', 'l igh t', 'h igh',
      'f r igh t', 'b l ow', 's n ow', 's l ow', 'g r ow', 'z oo', 'm oo n', 's p oo n', 'f oo d',
      'l oo~ k', 'b oo~ k', 'c oo~ k', 'c ar', 'p ar k', 's t ar', 'f or', 's p or t', 'sh or t',
      'f air', 'h air', 'ch air', 'g ir l', 'b ir d', 'sh ir t', 'ou t', 'sh ou t', 'm ou th',
      't oy', 'b oy',
      'w ay', 's ay', 'f ee t', 'g r ee n', 'f l ee', 'b r igh t', 'm igh t', 's igh', 'sh ow', 'c r ow',
      'r oo m', 'b oo t', 's oo n', 'f oo~ t', 'g oo~ d', 'h oo~ k', 'f ar m', 'd ar k', 'sh ar p', 'h ar d',
      'f or k', 's t or m', 't or ch', 's t air', 'p air', 'f ir s t', 'th ir d', 's k ir t', 'l ou d',
      'r ou n d', 'c l ou d', 'f ou n d', 'j oy'],
    alien: ['z ay', 'g l ay', 'j ay m', 'f ee p', 'sh ee b', 'v ee n', 'j igh|jy', 'z igh t|zite',
      'v igh t|vite', 'ch igh|chy', 'j ow p|jope', 's t ow b|stobe', 'z ow|zoe', 'f oo n', 'z oo p',
      'b l oo b', 'j ar k', 'm ar b', 'v ar t', 'y or m', 'v or t', 's t or b', 'j air', 'v air p',
      'f ir p', 'ch ir m', 't ir g', 'g ou d|gowd', 'z ou t|zowt', 'v oy', 'j oy p', 'f oy n',
      'th ay p', 'sh ee m', 'b r ee g', 'n igh p|nipe', 'g l igh m|glime', 'y ow n|yone', 'z oo n',
      'b l oo n', 'j ar b', 's k ar d', 't or p', 'sh or v', 'b l or t', 'z air', 'sh air t', 'p l ir n',
      's k ir b', 'g ou p|gowp', 'sh ou m|showm', 't r oy t', 'g oy b'],
  },
  {
    id: 3, title: 'Set 3', subtitle: 'ea oi a-e i-e o-e u-e aw are ur er ow ai oa ew ire ear ure',
    sounds: ['ea', 'oi', 'a_e', 'i_e', 'o_e', 'u_e', 'aw', 'are', 'ur', 'er', 'ow~', 'ai', 'oa',
      'ew', 'ire', 'ear', 'ure'],
    real: ['s ea', 'd r ea m', 't ea ch', 'c oi n', 'p oi n t', 'c a_e k', 'g a_e m', 'b i_e k',
      's m i_e l', 'h o_e m', 'r o_e p', 'c u_e b', 't u_e n', 's aw', 'c l aw', 'd are', 'c are',
      'b ur n', 't ur n', 'h er', 'f er n', 'c ow~', 'b r ow~ n', 'r ai n', 't r ai n', 'b oa t',
      'c oa t', 'n ew', 'f l ew', 'f ire', 'w ire', 'ear', 'n ear', 's ure', 'p ure',
      'b ea ch', 'l ea f', 's p oi l', 'j oi n', 's n a_e k', 'sh a_e k', 'l i_e n', 't i_e m', 's t o_e n',
      'n o_e t', 'f l u_e t', 'y aw n', 'd r aw', 'sh are', 's n are', 'ch ur ch', 'h ur t', 'p er ch',
      't ow~ n', 'c l ow~ n', 'p ai n t', 's n ai l', 'r oa d', 't oa s t', 'g r ew', 'ch ew', 'h ire',
      'd ear', 'h ear', 'c ure'],
    alien: ['d r ea p', 'j ea m', 'k oi l', 'z oi t', 'v a_e d', 's a_e p', 'f i_e g', 'j o_e t',
      'b r o_e n', 'z u_e n', 'v aw', 'g l aw', 'j are', 'z are', 'f ur b', 't ur p', 'z er p',
      'm er n', 'z ow~ n|zown', 'd r ow~ p|drowp', 'j ai p', 's t ai g', 'v oa d', 'j oa t', 'z ew',
      'p l ew', 'v ire', 'j ear', 'm ure',
      'b l ea th', 'f ea n t', 'p oi b', 'sh oi k', 't r a_e b', 'g l i_e p', 's n o_e d', 'b l u_e k',
      's p aw d', 'z ur n', 'sh ur p', 'g er t', 't er b', 'sh ow~ k|showk', 'f l ow~ t|flowt',
      'p ai sh', 'g l ai k', 't oa f', 'sh oa m', 'g ew n', 'z ire', 'z ear', 't ure'],
  },
];

// Harder words for Section 2 of the practice check: longer blends and two-syllable words.
const CHECK_EXTRA = {
  real: ['s u n s e t', 'd e n t i s t', 'p i c n i c', 'c ar p e t', 'g ar d e n', 'r ai n b ow',
    's t r ee t', 's p l a sh', 'th u n d er', 's ea s i_e d', 'f ar m er', 'r o ck e t'],
  alien: ['z a n f i p', 's t r ee p', 's p l o th', 'f l ar n', 'b l i m p o t', 'g r ai s t',
    'qu e l d i n', 's c r u nk'],
};

// Never show these if the game makes up a "wrong" choice by swapping a sound.
const BLOCKED = ['shit', 'piss', 'fuk', 'fuck', 'cunt', 'cock', 'dick', 'twat', 'tit', 'fag', 'cum',
  'nob', 'wank', 'porn', 'sex', 'rape', 'crap', 'damn', 'slut', 'jiz', 'jizz', 'bitch'];
