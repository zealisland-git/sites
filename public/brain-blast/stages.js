/* Brain Blast Arena: Adventure stages (关卡)

   The Adventure follows the learning path in content.js: every chapter is a list of
   sub-topics, and each sub-topic becomes one stage whose problems all come from that
   sub-topic's templates. The last stage of a chapter is a boss that reviews the whole chapter.
   So adding a chapter or sub-topic to the content file (and re-running the importer)
   adds stages here automatically.

   Each stage gets a game FORMAT so the math always happens inside the fight:
     guards    robot squads, each led by a SHIELD GUARD (smash its Math Shield with a problem)
     factories three shielded robot factories
     guardian  a mini-boss whose Math Shield regrows
     gems      number gems that must fit a rule (only for number-theory sub-topics in GEM_RULES)
     boss      the chapter boss; its problems come from every sub-topic of the chapter
   Brain Cubes from ? crates are optional extra problems from the same sub-topic.

   Stars are saved under the stage id ("chapter-stage", e.g. "4-3"), so keep the order of
   existing sub-topics in a chapter stable; new ones are safest at the end of the path.

   FUN FIRST: math is a power the player chooses or a shield they smash, never a toll.
*/
'use strict';

// short game names for the sub-topics (the full name is shown on the stage card)
const SHORT = {
  '1.1': 'Clever Calc', '1.2': 'Fraction Flip', '1.3': 'Place Value', '1.4': 'Root Rumble',
  '2.1': 'Fair Shares', '2.2': 'Percent Power', '2.3': 'Fraction Tales', '2.4': 'Tiny Squads', '2.5': 'Ratio Rumble', '2.6': 'Fraction Flow', '2.7': 'Speed Trap', '2.8': 'Round Trip',
  '3.1': 'Number Steps', '3.2': 'Equation Lab', '3.3': 'Growth Spurt', '3.4': 'Area Guess', '3.5': 'Forever Sum', '3.6': 'Function Forge',
  '4.1': 'Square Hunt', '4.2': 'Dice Multiples', '4.3': 'Remainder Run', '4.4': 'Cycle Spotter', '4.5': 'Digit Puzzles', '4.6': 'Max & Min', '4.7': 'Divisor Dig', '4.8': 'Square Split', '4.9': 'Odd Stacks', '4.10': 'Factorial Fives',
  '5.1': 'Grid Area', '5.2': 'Cut & Shift', '5.3': 'Path Race', '5.4': 'Spin Overlap', '5.5': 'Right Triangles', '5.6': 'Coordinate Triangles', '5.7': 'Laser Grid', '5.8': 'Arc Runner', '5.9': 'Biggest Circle', '5.10': 'Circle & Square', '5.11': 'Ring Slices', '5.12': 'Curvy Fences', '5.13': 'Angle Shapes',
  '6.1': 'Tile Fit', '6.2': 'Cube Nets', '6.3': 'Hidden Faces', '6.4': 'Cube Corners',
  '7.1': 'Case Lists', '7.2': 'Path Count', '7.3': 'Count the Rest', '7.4': 'Divisible Counts', '7.5': 'Line-Up Rules', '7.6': 'Step Patterns', '7.7': 'Path Totals',
  '8.1': 'Fair Chances', '8.2': 'Chance Chains',
  '9.1': 'Table Reader', '9.2': 'Average Arena', '9.3': 'Bar Charts', '9.4': 'Mean vs Median', '9.5': 'Median Extremes',
  '10.1': 'Shortcut Grid', '10.2': 'Clue Order', '10.3': 'Number Placement', '10.4': 'Toll Roads', '10.5': 'Overlap Logic', '10.6': 'Color the Map',
};
const TOPIC_ICON = { 1: '🔢', 2: '⚖️', 3: '📈', 4: '🧮', 5: '📐', 6: '🧊', 7: '🔀', 8: '🎲', 9: '📊', 10: '🧩' };
// number-theory sub-topics that also work as a gem stage, with matching gem rules
const GEM_RULES = {
  '4.1': ['PERFECT SQUARES', 'ODD NUMBER OF DIVISORS', 'PERFECT CUBES'],
  '4.7': ['FACTORS OF 72', 'FACTORS OF 84', 'FACTORS OF 96', 'EXACTLY 4 DIVISORS'],
  '4.8': ['PRIME NUMBERS', 'PRIMES ABOVE 50', 'PERFECT SQUARES'],
  '4.9': ['ODD NUMBERS', 'PERFECT SQUARES', 'MULTIPLES OF 9'],
};
const CHAPTER_LOOK = [ // theme, color, hero reward
  ['jungle', '#3fbf4f', 'luna'], ['canyon', '#ff9f1c', 'volt'], ['ice', '#38b6ff', 'pi'], ['jungle', '#2fb58f'], ['lava', '#ff5a3c'],
  ['canyon', '#e0a020'], ['night', '#9b6bff'], ['ice', '#5ec8ff'], ['jungle', '#58b83f'], ['lava', '#e8323c'],
  ['ice', '#4a8cff'], ['canyon', '#ff7b3a'], ['night', '#d14bd8'], ['lava', '#ffb000'],
];
const BOSS_LOOK = { // per chapter: drawing, body color, what its screen shows
  1: ['calcutron', '#a07a55', ['1+1=2', '7×8', '12÷4', '99+1']], 2: ['fractionator', '#3fa86b', ['GRID', 'x,y', '4×4', '↑↓']],
  3: ['calcutron', '#8a6bd8', ['MEAN', 'MEDIAN', 'MODE', 'Σx/n']], 4: ['fractionator', '#2fb6a4', ['60mph', 'd=rt', '3:4', '25%']],
  5: ['calcutron', '#d8453c', ['2 3 5', '7 11', '13', '17 19']], 6: ['fractionator', '#6f86a8', ['2x+1', 'x=7', 'y=mx', 'a+b']],
  7: ['calcutron', '#e8822c', ['n!', '5×4×3', 'ABC', 'C(5,2)']], 8: ['fractionator', '#d8b23c', ['???', 'IF..', 'A>B', 'LOGIC']],
  9: ['calcutron', '#4aa0d8', ['a²+b²', '3-4-5', '√2', '90°']], 10: ['fractionator', '#6a3fa8', ['r=3', 'mod 7', '7÷3', '17%5']],
  11: ['calcutron', '#3f6fd8', ['6 faces', 'n³', '8 corners', '12 edges']], 12: ['fractionator', '#ff6a2c', ['3.14159', '2πr', 'πr²', '360°']],
  13: ['calcutron', '#c43bb0', ['1/6', 'P(A)', 'odds', '6×6']], 14: ['fractionator', '#2a2a40', ['∑', '∞', 'π', '√']],
};

// arenas: . floor  # wall  = block  B bush  C ? crate  ~ water  P your start  E robot spawn
//         M gem mine  K boss start  F robot factory   (every row the same length)
const MAPS_POOL = {
  guards: [
    ['BB....E.E....BB', 'B.............B', '...==.....==...', '...............', '..C..BB.BB..C..', '.....B...B.....', '##...........##', '......===......', '...............', '..BB.......BB..', '..BB..C.C..BB..', '...............', '...#.......#...', '...#..BBB..#...', '...............', 'B......P......B', 'BB...........BB'],
    ['E......BBB......E', '.................', '..##.........##..', '..#....C.C....#..', '.......===.......', 'BB.............BB', 'BB....B...B....BB', '......B...B......', '..=...........=..', '..=...BB.BB...=..', '..=...........=..', '.................', '....C.......C....', '.....##...##.....', 'B...............B', 'BB......P......BB', '.................'],
    ['BB.......E.......BB', 'B.................B', '...~~.........~~...', '...~~...C.C...~~...', '........===........', '.##.............##.', '.##....BB.BB....##.', '.......BB.BB.......', '..C.............C..', '.....=.......=.....', '.....=.......=.....', '...................', 'B.......BBB.......B', 'BB.......P.......BB', 'E.................E'],
  ],
  factories: [
    ['BB.............BB', 'B...F.......F...B', '.................', '..==.........==..', '.....BB...BB.....', '..C..BB...BB..C..', '........F........', '.................', 'BB....=====....BB', '.................', '..C...........C..', '....##.....##....', '.....BB...BB.....', '.....BB...BB.....', '.................', 'B.......P.......B', 'BB.............BB'],
    ['BB...............BB', 'B..F...........F..B', '...................', '..C....=====....C..', '...................', '.....BB.....BB.....', '.....BB..F..BB.....', '...................', 'BB...............BB', '...##.........##...', '...................', '.......B...B.......', '..C....B...B....C..', '...................', 'B.................B', 'BB.......P.......BB', '...................'],
    ['BB.............BB', 'B.......F.......B', '.................', '...##.......##...', '...#.........#...', '.....C.....C.....', '..F...........F..', '.................', 'BB....=====....BB', '.................', '....BB.....BB....', '....BB.....BB....', '.................', '..C...........C..', '.....##...##.....', '.................', 'B...............B', 'BB......P......BB', '.................'],
  ],
  arena: [
    ['BBB.....E.....BBB', 'B...............B', '..C...........C..', '....#.......#....', '........K........', '.................', '..#...........#..', '.................', 'BB.............BB', '.................', '..#...........#..', '.................', '....#.......#....', '..C...........C..', 'B...............B', 'BBB.....P.....BBB', '.................'],
    ['BBB......E......BBB', 'B.................B', '...=...........=...', '...=.....K.....=...', '...................', '.C.......~.......C.', '.........~.........', '...................', 'BB......===......BB', '...................', '.........~.........', '.C.......~.......C.', '...................', '...=...........=...', '...=.....P.....=...', 'B.................B', 'BBB.............BBB'],
    ['BBB.............BBB', 'B.................B', '..C.............C..', '....~~.......~~....', '....~~...K...~~....', '...................', '.##.............##.', '...................', '.......#...#.......', '...................', '.......#...#.......', '...................', '.##.............##.', '...................', '....~~.......~~....', '....~~.......~~....', '..C.............C..', 'B........P........B', 'BBB.............BBB'],
  ],
  gems: [
    ['BB.....E.....BB', 'B.............B', '...##.....##...', '...............', 'BB....BBB....BB', '...............', '..=.........=..', '..=....M....=..', '..=.........=..', '...............', 'BB....BBB....BB', '...............', '...##.....##...', '..C.........C..', 'B.............B', 'BB.....P.....BB', 'E.............E'],
    ['BB......E......BB', 'B...............B', '...==.......==...', '...=....~....=...', '........~........', '..BB.........BB..', '..BB...===...BB..', '.................', 'E.......M.......E', '.................', '..BB...===...BB..', '..BB.........BB..', '........~........', '...=....~....=...', '...==.......==...', '..C...........C..', 'B...............B', 'BB......P......BB', '.................'],
  ],
};

const CHAPTERS = [], STAGES = [];
(function buildAdventure() {
  const C = typeof BB_CONTENT !== 'undefined' ? BB_CONTENT : { path: [], subs: {}, topics: [] };
  const use = { guards: 0, factories: 0, arena: 0, gems: 0 };
  const nextMap = (kind, theme) => { const pool = MAPS_POOL[kind]; return { theme, rows: pool[use[kind]++ % pool.length] }; };
  const topicOf = id => C.topics.find(t => t.id === C.subs[id].topic);
  for (const ch of C.path) {
    const c = ch.n, [theme, color, hero] = CHAPTER_LOOK[(c - 1) % CHAPTER_LOOK.length];
    const hp = +(0.6 + 0.035 * (c - 1)).toFixed(2), dmg = +(0.65 + 0.027 * (c - 1)).toFixed(2), skill = +(0.25 + 0.022 * (c - 1)).toFixed(3);
    const diff = Math.min(3, 1.2 + 0.13 * (c - 1)), math = Math.max(1, Math.min(5, Math.round(diff * 1.7)));
    const minions = c < 3 ? ['robo'] : c < 6 ? ['robo', 'zapbot'] : ['robo', 'zapbot', 'brute'];
    CHAPTERS.push({ id: 'c' + c, name: ch.name.toUpperCase(), sub: [...new Set(ch.subs.map(id => topicOf(id).name))].slice(0, 3).join(' · '), color, reward: hero ? { hero } : undefined });
    const formats = ['guards', 'factories', 'guardian', 'guards', 'factories', 'guardian'];
    ch.subs.forEach((id, k) => {
      const S = C.subs[id], tname = S.name, low = tname.toLowerCase();
      const base = { id: `${c}-${k + 1}`, chapter: 'c' + c, sub: id, subs: [id], name: SHORT[id] || tname, topicName: tname, topicIcon: TOPIC_ICON[S.topic] || '🧠', diff, math, skill, lives: 3, theme };
      let fmt = formats[(k + c - 1) % formats.length];
      if (c === 1 && k === 0) fmt = 'guards';
      if (GEM_RULES[id]) fmt = 'gems';
      base.icon = { guards: '🤖', factories: '🏭', guardian: '🛡️', gems: '💎' }[fmt];
      const guard = { hero: 'guard', n: 1, hp: +(hp * 1.15).toFixed(2), dmg, shield: true, regrow: false, shieldTime: 12, name: 'SHIELD GUARD' };
      const r = (hero, n) => ({ hero, n, hp, dmg });
      if (fmt === 'guards') {
        const first = c === 1 && k === 0, last = minions[minions.length - 1];
        STAGES.push(Object.assign(base, {
          type: 'defeat', dropCube: 0.15, map: nextMap('guards', theme), stars: [{ t: 'clear' }, { t: 'correct', n: first ? 2 : 3 }, { t: 'nodeath' }],
          intro: first ? `Training robots attack! Shoot them to knock them out. The big SHIELD GUARDS have a Math Shield: press 🧠 (Q) and solve a problem to smash it. Topic: ${low}.`
            : `Robot squads attack, each led by a SHIELD GUARD. Smash its Math Shield with a problem (topic: ${low}), then knock it out!`,
          goalText: 'Knock out every squad!',
          waves: first ? [[r('robo', 2)], [r('robo', 2), guard], [r('robo', 3), guard]]
            : [[r(minions[0], 2), guard], [r('robo', 2), r(last, 1), guard], [r('robo', 2), r(minions[Math.min(1, minions.length - 1)], 1), r(last, 1), guard]],
        }));
      } else if (fmt === 'factories') {
        STAGES.push(Object.assign(base, {
          type: 'factories', map: nextMap('factories', theme), stars: [{ t: 'clear' }, { t: 'time', s: 110 }, { t: 'nodeath' }],
          intro: `Three robot factories hide behind Math Shields. Get close, press 🧠 (Q) and smash each shield with a problem (topic: ${low}), then blow the factory up!`,
          goalText: 'Smash the shields, destroy the factories!',
          factories: { hp: +(0.7 + 0.03 * (c - 1)).toFixed(2), shieldTime: 14, regrow: false, every: Math.max(5.5, 7 - 0.1 * (c - 1)), max: 2, cap: c < 8 ? 3 : 4, spawn: minions.filter(h => h !== 'brute'), kidHp: hp, kidDmg: dmg },
        }));
      } else if (fmt === 'guardian') {
        STAGES.push(Object.assign(base, {
          type: 'boss', map: nextMap('arena', theme), stars: [{ t: 'clear' }, { t: 'accuracy', p: 80 }, { t: 'time', s: 100 }],
          intro: `A GUARDIAN blocks the road! Its Math Shield keeps growing back, so keep smashing it with problems (topic: ${low}) and hit hard while it is VULNERABLE.`,
          goalText: 'Smash the shield, defeat the Guardian!',
          boss: { hero: 'guardian', name: 'GUARDIAN', color, hp: +((7000 + 500 * c) / 8000).toFixed(2), dmg, every: 2.8, shieldTime: 11, minion: minions[0], minionCount: 2, patterns: ['aim', 'ring', 'charge'] },
        }));
      } else {
        const goal = c < 8 ? 8 : 10;
        STAGES.push(Object.assign(base, {
          type: 'gems', goal, time: 160, gemEvery: 2.4, gemBurst: 3, ruleTime: 30, ruleLevel: Math.max(2, math), rules: GEM_RULES[id],
          map: nextMap('gems', theme), swarm: { every: 11, max: 2, pool: minions.map(h => ({ hero: h, hp, dmg })) },
          stars: [{ t: 'clear' }, { t: 'traps', n: 1 }, { t: 'time', s: 110 }],
          intro: `Number gems! Grab only gems whose number fits the RULE at the top; wrong ones are traps. Smash ? crates for Brain Cubes (topic: ${low}).`,
          goalText: `Hold ${goal} gems that fit the rule!`,
        }));
      }
    });
    // the chapter boss reviews every sub-topic of the chapter
    const [bossHero, bossColor, msgs] = BOSS_LOOK[c] || ['calcutron', color, null];
    const bossHp = 15000 + 1600 * (c - 1), name = (ch.boss || 'The Boss').toUpperCase();
    STAGES.push({
      id: `${c}-${ch.subs.length + 1}`, chapter: 'c' + c, subs: ch.subs.slice(), name: 'BOSS: ' + (ch.boss || 'The Boss'), topicName: 'Chapter review', icon: '👑',
      type: 'boss', diff: Math.min(3, diff + 0.2), math, skill, lives: 3, theme, map: nextMap('arena', theme),
      intro: `${ch.boss || 'The boss'} rules this chapter! Its Math Shield takes problems from every topic you just practiced. Smash it, then strike while it is VULNERABLE.`,
      goalText: 'Smash its shield, then attack!',
      boss: { hero: bossHero, name, color: bossColor, msgs, hp: +(bossHp / HEROES[bossHero].hp).toFixed(2), dmg: +(0.55 + 0.02 * (c - 1)).toFixed(2), every: Math.max(2.1, 2.9 - 0.05 * (c - 1)), shieldTime: 12, minion: minions[minions.length - 1], minionCount: c < 4 ? 2 : 3, patterns: c < 4 ? ['ring', 'aim', 'slam', 'charge'] : ['split', 'ring', 'slam', 'charge', 'aim'] },
      stars: [{ t: 'clear' }, { t: 'accuracy', p: 75 }, { t: 'nodeath' }],
    });
  }
})();

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
// Did the player reach a star goal? r = results from the match, q = { asked, correct, first }
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
    case 'boss': return `Defeat ${st.boss.name || HEROES[st.boss.hero].name}`;
    case 'grab': return 'Win a 3 vs 3 Number Grab';
    case 'royale': return `Top ${st.clearRank || 3} in Brain Royale`;
  }
  return '';
}
