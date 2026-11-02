/* Brain Blast Arena: Adventure stages (关卡)

   HOW TO ADD A STAGE
   1. Copy one stage object below and give it a new, unique id (like '3-1').
      Stars are saved under the id, so keep ids stable (a reused id keeps the stars earned before).
   2. Put it in a chapter (add a new chapter to CHAPTERS if needed).
   3. Stages unlock in the order they appear in STAGES: a stage opens once the one
      before it has at least 1 star.

   STAGE FIELDS
   id, chapter, name, icon       - shown on the stage map
   intro                         - one or two sentences shown before playing
   goalText                      - short text shown when the stage starts
   type                          - what you must do:
       'defeat'  knock out every robot in all `waves`
       'gems'    hold `goal` gems at once (gems must fit the math rule)
       'cubes'   solve `goal` Brain Cube problems correctly
       'factories' destroy every robot factory (F on the map); each has a Math Shield
       'survive' stay alive until the `time` runs out
       'boss'    defeat the `boss` (break its Math Shield by solving problems)
       'grab'    a 3 vs 3 Number Grab match (win it)
       'royale'  a 6-player Brain Royale (finish in the top `clearRank`)
   math                          - problem level 1-5 (1 = easiest warm-ups ... 5 = toughest puzzles)
   topics (optional)             - only ask these problem topics (see BBMath.topics())
   rules, ruleLevel (optional)   - gem rules to use (see BBMath.ruleNames())
   time                          - seconds allowed (0 = no limit). For 'survive' it is the goal.
   lives                         - tries before the stage is lost (default 3)
   skill                         - how good the robots are, 0.2 (easy) to 0.85 (hard)
   enemyHp, enemyDmg             - 'grab' stages: health and damage of the other team (1 = normal)
   waves                         - list of waves; each wave is a list of { hero, n, hp, dmg, skill, name }
                                   hero: robo, zapbot, brute, or a hero id (blaze, rocky, luna, volt, pi)
   swarm                         - keeps spawning robots: { every: seconds, max: alive at once, pool: [specs] }
   boss                          - { hero: 'calcutron' | 'fractionator', hp, dmg, every (seconds between attacks), shieldTime, minion, minionCount, patterns }
   factories                     - for 'factories' stages: { hp, shieldTime, regrow (false = a smashed shield stays down), every (seconds per robot), max (robots per factory), spawn: [hero ids] }
   shieldTime                    - seconds an enemy stays VULNERABLE after its Math Shield is smashed (+3 s for a fast answer)
   gemEvery, gemBurst            - the gem mine drops `gemBurst` gems every gemEvery × gemBurst seconds
   supply                        - { every: seconds }: a Brain Cube falls from the sky near the player
   dropCube                      - chance (0-1) that a knocked-out robot drops a Brain Cube
   botsTakeGems                  - true = robots also grab gems (default: they only fight)
   stars                         - three goals; the first is normally { t: 'clear' }. Other goals:
       { t: 'correct', n }   solve at least n problems
       { t: 'accuracy', p }  get at least p% of problems right
       { t: 'nodeath' }      never get knocked out
       { t: 'time', s }      finish in under s seconds
       { t: 'traps', n }     touch at most n trap gems
       { t: 'hp', p }        finish with at least p% health
       { t: 'rank', n }      finish #n or better (royale)
       { t: 'gems', n }      grab at least n gems yourself
       { t: 'kos', n }       knock out at least n enemies
   map                           - 'grab' / 'royale' for the built-in arenas, or
                                   { theme: 'jungle' | 'canyon', rows: [...] } where every row has the same length:
       .  floor      #  wall       =  stone block   B  bush        C  ? crate (Brain Cube inside)
       ~  water      P  your start E  robot spawn   M  gem mine    K  boss start   F  robot factory

   CHAPTER FIELDS
   id, name, sub, color          - shown on the stage map
   reward (optional)             - { hero }: clearing the chapter's last stage unlocks this hero

   FUN FIRST: math should be a power the player chooses, never a toll. Brain Cubes go into the
   player's pocket and are opened with the 🧠 button when they like; shields are smashed for a big
   damage window. Keep stages short, with action between problems.
*/
'use strict';

const CHAPTERS = [
  { id: 'c1', name: 'BRAIN CAMP', sub: 'Learn to fight with your brain', color: '#3fbf4f', reward: { hero: 'luna' } },
  { id: 'c2', name: 'PRIME CANYON', sub: 'Number theory gets serious', color: '#ff9f1c', reward: { hero: 'volt' } },
  // Next chapter goes here, e.g. { id: 'c3', name: 'GEOMETRY PEAKS', sub: '...', color: '#38b6ff' },
];

const STAGES = [
  // ================= CHAPTER 1: BRAIN CAMP =================
  {
    id: '1-1', chapter: 'c1', name: 'Boot Camp', icon: '🤖', type: 'defeat', math: 1,
    intro: 'Training robots are loose in the camp! Knock them all out. Smash the purple ? crates to pocket Brain Cubes, then open them with 🧠 when you want a power-up.',
    goalText: 'Knock out all the robots!', lives: 3, skill: 0.25, dropCube: 0.25,
    waves: [
      [{ hero: 'robo', n: 2, hp: 0.6, dmg: 0.7 }],
      [{ hero: 'robo', n: 3, hp: 0.7, dmg: 0.7 }],
      [{ hero: 'robo', n: 2, hp: 0.8, dmg: 0.8 }, { hero: 'brute', n: 1, hp: 0.6, dmg: 0.7 }],
    ],
    stars: [{ t: 'clear' }, { t: 'correct', n: 2 }, { t: 'nodeath' }],
    map: { theme: 'jungle', rows: [
      'BB....E.E....BB',
      'B.............B',
      '...==.....==...',
      '...............',
      '..C..BB.BB..C..',
      '.....B...B.....',
      '##...........##',
      '......===......',
      '...............',
      '..BB.......BB..',
      '..BB..C.C..BB..',
      '...............',
      '...#.......#...',
      '...#..BBB..#...',
      '...............',
      'B......P......B',
      'BB...........BB',
    ] },
  },
  {
    id: '1-2', chapter: 'c1', name: 'Gem Rush', icon: '💎', type: 'gems', math: 1, goal: 8, time: 150,
    intro: 'The gem mine is open! Grab gems whose number fits the RULE at the top. Wrong gems are traps. Hold 8 gems at once to win, and don\'t get knocked out or you drop them!',
    goalText: 'Hold 8 gems that fit the rule!', lives: 3, skill: 0.25, gemEvery: 2.4, gemBurst: 3, ruleTime: 30, ruleLevel: 1,
    rules: ['EVEN NUMBERS', 'ODD NUMBERS', 'MULTIPLES OF 3', 'MULTIPLES OF 5', 'MULTIPLES OF 10', 'GREATER THAN 25'],
    swarm: { every: 11, max: 2, pool: [{ hero: 'robo', hp: 0.6, dmg: 0.7 }] },
    stars: [{ t: 'clear' }, { t: 'traps', n: 1 }, { t: 'time', s: 90 }],
    map: { theme: 'jungle', rows: [
      'BB.....E.....BB',
      'B.............B',
      '...##.....##...',
      '...............',
      'BB....BBB....BB',
      '...............',
      '..=.........=..',
      '..=....M....=..',
      '..=.........=..',
      '...............',
      'BB....BBB....BB',
      '...............',
      '...##.....##...',
      '..C.........C..',
      'B.............B',
      'BB.....P.....BB',
      'E.............E',
    ] },
  },
  {
    id: '1-3', chapter: 'c1', name: 'Robot Factory', icon: '🏭', type: 'factories', math: 2,
    intro: 'Three factories are building robots! Each one hides behind a MATH SHIELD. Get close, press 🧠 (Q) and solve a problem to smash it, then blast the factory. Focus: fractions and percents.',
    goalText: 'Smash the shields, destroy the factories!', lives: 3, skill: 0.3,
    topics: ['Fractions', 'Percents', 'Money', 'Ratios', 'Percent change', 'Averages', 'Order of operations'],
    factories: { hp: 0.8, shieldTime: 14, regrow: false, every: 6.5, max: 2, spawn: ['robo', 'robo', 'zapbot'] },
    stars: [{ t: 'clear' }, { t: 'time', s: 100 }, { t: 'nodeath' }],
    map: { theme: 'jungle', rows: [
      'BB.............BB',
      'B...F.......F...B',
      '.................',
      '..==.........==..',
      '.....BB...BB.....',
      '..C..BB...BB..C..',
      '........F........',
      '.................',
      'BB....=====....BB',
      '.................',
      '..C...........C..',
      '....##.....##....',
      '.....BB...BB.....',
      '.....BB...BB.....',
      '.................',
      'B.......P.......B',
      'BB.............BB',
    ] },
  },
  {
    id: '1-4', chapter: 'c1', name: 'Team Grab', icon: '👥', type: 'grab', math: 2, time: 150, skill: 0.35, enemyHp: 0.85, enemyDmg: 0.75,
    intro: 'Your first real match: 3 vs 3 Number Grab with two robot teammates. Hold 10+ gems for 15 seconds to win.',
    goalText: 'Win the Number Grab match!', theme: 'jungle', map: 'grab',
    stars: [{ t: 'clear' }, { t: 'correct', n: 3 }, { t: 'gems', n: 4 }],
  },
  {
    id: '1-5', chapter: 'c1', name: 'BOSS: Calcutron', icon: '👑', type: 'boss', math: 2, lives: 3, time: 0,
    intro: 'Calcutron, the calculator robot, guards the camp. His MATH SHIELD blocks most damage. Press 🧠 (Q) and solve a problem to smash it, then hit him hard while he is VULNERABLE!',
    goalText: 'Break the shield with math, then attack!',
    boss: { hero: 'calcutron', hp: 1.1, dmg: 0.6, every: 2.8, shieldTime: 12, minion: 'robo', minionCount: 2, patterns: ['ring', 'aim', 'slam', 'charge'] },
    stars: [{ t: 'clear' }, { t: 'time', s: 120 }, { t: 'nodeath' }],
    map: { theme: 'jungle', rows: [
      'BBB.....E.....BBB',
      'B...............B',
      '..C...........C..',
      '....#.......#....',
      '........K........',
      '.................',
      '..#...........#..',
      '.................',
      'BB.............BB',
      '.................',
      '..#...........#..',
      '.................',
      '....#.......#....',
      '..C...........C..',
      'B...............B',
      'BBB.....P.....BBB',
      '.................',
    ] },
  },

  // ================= CHAPTER 2: PRIME CANYON =================
  {
    id: '2-1', chapter: 'c2', name: 'Prime Hunt', icon: '🔢', type: 'gems', math: 3, goal: 10, time: 180,
    intro: 'Canyon gems follow tougher rules: primes, factors, multiples. Hold 10 gems at once. Remember: 1 is NOT prime!',
    goalText: 'Hold 10 gems that fit the rule!', lives: 3, skill: 0.4, gemEvery: 2.4, gemBurst: 3, ruleTime: 30, ruleLevel: 3,
    rules: ['PRIME NUMBERS', 'FACTORS OF 72', 'FACTORS OF 84', 'FACTORS OF 90', 'MULTIPLES OF 12', 'PERFECT SQUARES', 'PRIMES ABOVE 50'],
    topics: ['Divisors', 'Remainders', 'LCM', 'GCD', 'Units digits', 'Factorials', 'Three divisors'],
    swarm: { every: 11, max: 2, pool: [{ hero: 'robo' }, { hero: 'zapbot', hp: 0.8 }] },
    stars: [{ t: 'clear' }, { t: 'traps', n: 1 }, { t: 'time', s: 120 }],
    map: { theme: 'canyon', rows: [
      'BB......E......BB',
      'B...............B',
      '...==.......==...',
      '...=....~....=...',
      '........~........',
      '..BB.........BB..',
      '..BB...===...BB..',
      '.................',
      'E.......M.......E',
      '.................',
      '..BB...===...BB..',
      '..BB.........BB..',
      '........~........',
      '...=....~....=...',
      '...==.......==...',
      '..C...........C..',
      'B...............B',
      'BB......P......BB',
      '.................',
    ] },
  },
  {
    id: '2-2', chapter: 'c2', name: 'Robot Swarm', icon: '⏱️', type: 'survive', math: 3, time: 80, lives: 3, skill: 0.45, dropCube: 0.1, supply: { every: 16 },
    intro: 'Robots pour in from every side. Survive for 80 seconds! Supply drops rain Brain Cubes from the sky: grab them and open them with 🧠 to get stronger.',
    goalText: 'Survive for 80 seconds!',
    swarm: { every: 4.5, max: 6, pool: [{ hero: 'robo' }, { hero: 'robo' }, { hero: 'zapbot' }, { hero: 'brute', hp: 0.8 }] },
    stars: [{ t: 'clear' }, { t: 'correct', n: 2 }, { t: 'kos', n: 15 }],
    map: { theme: 'canyon', rows: [
      'E.......E.......E',
      '.................',
      '..BB..#...#..BB..',
      '..BB.........BB..',
      '.....==...==.....',
      '..#.....C.....#..',
      '.......BBB.......',
      'E.....BBBBB.....E',
      '.......BBB.......',
      '..#.....C.....#..',
      '.....==...==.....',
      '..BB.........BB..',
      '..BB..#...#..BB..',
      '........P........',
      '.................',
      '.................',
      'E...............E',
    ] },
  },
  {
    id: '2-3', chapter: 'c2', name: 'Canyon Royale', icon: '☠️', type: 'royale', math: 3, skill: 0.42, clearRank: 3,
    intro: 'Six heroes, one canyon, poison closing in. Finish in the top 3 to clear the stage. Brain Cubes are the key to winning!',
    goalText: 'Finish in the top 3!', theme: 'canyon', map: 'royale',
    stars: [{ t: 'clear' }, { t: 'rank', n: 1 }, { t: 'correct', n: 4 }],
  },
  {
    id: '2-4', chapter: 'c2', name: 'BOSS: The Fractionator', icon: '👑', type: 'boss', math: 4, lives: 4, time: 0,
    topics: ['Fractions', 'Probability', 'Probability (draws)', 'Coin flips', 'Ratios', 'Percent change', 'Mixtures', 'Dice probability', 'Telescoping'],
    intro: 'The Fractionator splits everything in half, even its bullets! Smash its Math Shield with fraction and probability problems, then strike while it is VULNERABLE.',
    goalText: 'Break the shield with math, then attack!',
    boss: { hero: 'fractionator', hp: 1, dmg: 0.55, every: 2.5, shieldTime: 11, minion: 'zapbot', minionCount: 3, patterns: ['split', 'ring', 'slam', 'charge', 'aim'] },
    stars: [{ t: 'clear' }, { t: 'time', s: 150 }, { t: 'accuracy', p: 80 }],
    map: { theme: 'canyon', rows: [
      'BBB......E......BBB',
      'B.................B',
      '...=...........=...',
      '...=.....K.....=...',
      '...................',
      '.C.......~.......C.',
      '.........~.........',
      '...................',
      'BB......===......BB',
      '...................',
      '.........~.........',
      '.C.......~.......C.',
      '...................',
      '...=...........=...',
      '...=.....P.....=...',
      'B.................B',
      'BBB.............BBB',
    ] },
  },
  // Next stage goes here, e.g. { id: '3-1', chapter: 'c3', ... }
];

// Text for a star goal (used on the stage card and the results screen)
function starText(s, stage) {
  switch (s.t) {
    case 'clear': return stage && stage.type === 'royale' ? `Finish in the top ${stage.clearRank || 3}` : stage && stage.type === 'grab' ? 'Win the match' : 'Clear the stage';
    case 'correct': return `Solve ${s.n}+ problems`;
    case 'accuracy': return `${s.p}% right on the first try`;
    case 'nodeath': return 'Never get knocked out';
    case 'time': return `Finish in under ${s.s} s`;
    case 'traps': return s.n === 0 ? 'Touch no trap gems' : `Touch ${s.n} trap gem${s.n > 1 ? 's' : ''} at most`;
    case 'hp': return `End with ${s.p}%+ health`;
    case 'rank': return `Finish #${s.n}`;
    case 'gems': return `Grab ${s.n}+ gems yourself`;
    case 'kos': return `Knock out ${s.n}+ enemies`;
  }
  return '?';
}
// Did the player reach a star goal? r = results from the match, q = { asked, correct }
function starMet(s, r, q) {
  if (!r.cleared) return false;
  switch (s.t) {
    case 'clear': return true;
    case 'correct': return q.correct >= s.n;
    case 'accuracy': return q.asked > 0 && (q.first != null ? q.first : q.correct) / q.asked * 100 >= s.p;
    case 'nodeath': return r.deaths === 0;
    case 'time': return r.time < s.s;
    case 'traps': return r.traps <= s.n;
    case 'hp': return r.hp * 100 >= s.p;
    case 'rank': return r.rank != null && r.rank <= s.n;
    case 'gems': return (r.gems || 0) >= s.n;
    case 'kos': return (r.kos || 0) >= s.n;
  }
  return false;
}
function stageGoalText(st) {
  switch (st.type) {
    case 'defeat': return `Knock out ${st.waves.reduce((a, w) => a + w.reduce((b, s) => b + (s.n || 1), 0), 0)} robots`;
    case 'gems': return `Hold ${st.goal} gems at once`;
    case 'cubes': return `Solve ${st.goal} Brain Cubes`;
    case 'factories': return `Destroy ${(st.map.rows.join('').match(/F/g) || []).length} robot factories`;
    case 'survive': return `Survive ${st.time} seconds`;
    case 'boss': return `Defeat ${HEROES[st.boss.hero].name}`;
    case 'grab': return 'Win a 3 vs 3 Number Grab';
    case 'royale': return `Top ${st.clearRank || 3} in Brain Royale`;
  }
  return '';
}
