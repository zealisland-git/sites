/* Brain Blast Arena: math problem generators + gem rules.
   Every problem is generated fresh, so the answers are computed, not typed in. */
(function (global) {
  'use strict';

  // ---------- helpers ----------
  const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
  const lcm = (a, b) => a / gcd(a, b) * b;
  const lcmAll = arr => arr.reduce(lcm, 1);
  const C = (n, k) => { if (k < 0 || k > n) return 0; let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); };
  const fact = n => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };
  const divs = n => { const d = []; for (let i = 1; i * i <= n; i++) if (n % i === 0) { d.push(i); if (i * i !== n) d.push(n / i); } return d.sort((a, b) => a - b); };
  const nd = n => divs(n).length;
  const isPrime = n => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
  const isSq = n => Number.isInteger(Math.sqrt(n));
  const ord = n => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
  const modpow = (b, e, m) => { let r = 1; b %= m; while (e > 0) { if (e & 1) r = r * b % m; b = b * b % m; e >>= 1; } return r; };
  const red = (n, d) => { const g = gcd(n, d) || 1; return [n / g, d / g]; };
  const sup = (b, e) => `${b}<sup>${e}</sup>`;
  const fr = (n, d) => `<span class="fr"><span>${n}</span><span>${d}</span></span>`;
  const frR = (n, d) => { const [a, b] = red(n, d); return b === 1 ? String(a) : fr(a, b); };
  const art = n => (n === 8 || n === 11 || n === 18) ? 'an' : 'a';
  const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  const Word = n => { const w = words[n] || String(n); return w[0].toUpperCase() + w.slice(1); };
  const andList = a => a.length < 3 ? a.join(' and ') : a.slice(0, -1).join(', ') + ', and ' + a[a.length - 1];
  const digitSum = n => String(n).split('').reduce((s, c) => s + +c, 0);
  const pf = n => { const f = []; let m = n; for (let p = 2; p * p <= m; p++) { let e = 0; while (m % p === 0) { m /= p; e++; } if (e) f.push([p, e]); } if (m > 1) f.push([m, 1]); return f; };
  const pfStr = n => pf(n).map(([p, e]) => e > 1 ? sup(p, e) : String(p)).join(' × ');

  // ---------- generators ----------
  // Each returns { q, a, w:[wrong answers], why, kind?, pre?, post?, prob?, range? } or null (= try again).
  const G = [];
  const add = (lv, topic, f) => G.push({ lv, topic, f });

  // ===== LEVEL 1 (warm-up) =====
  add(1, 'Order of operations', () => {
    const a = R(2, 12), b = R(2, 9), c = R(2, 9), d = R(2, 6), e = d * R(2, 7);
    const ans = a + b * c - e / d;
    return { q: `What is the value of ${a} + ${b} × ${c} − ${e} ÷ ${d}?`, a: ans,
      w: [((a + b) * c - e) / d, (a + b) * c - e / d, a + b * c - e, a + b * c + e / d],
      why: `Multiply and divide first: ${b} × ${c} = ${b * c} and ${e} ÷ ${d} = ${e / d}. Then ${a} + ${b * c} − ${e / d} = ${ans}.` };
  });
  add(1, 'Percents', () => {
    if (Math.random() < 0.5) {
      const p = pick([10, 15, 20, 25, 30, 35, 40, 45, 60, 75]), n = 20 * R(2, 15), ans = p * n / 100;
      return { q: `What is ${p}% of ${n}?`, a: ans, w: [n - ans, ans * 10, ans + 10, p + n / 10, ans / 2],
        why: `${p}% means ${p} out of 100, so ${p} ÷ 100 × ${n} = ${ans}.` };
    }
    const p = pick([10, 15, 20, 25, 30, 40]), n = 20 * R(2, 12), off = p * n / 100, ans = n - off;
    return { q: `A skateboard costs $${n}. It is on sale for ${p}% off. What is the sale price, in dollars?`, a: ans, pre: '$',
      w: [off, n - p, n + off, ans - 10, ans + 5], why: `${p}% of $${n} is $${off}. The sale price is $${n} − $${off} = $${ans}.` };
  });
  add(1, 'Rates', () => {
    const s = 5 * R(6, 16), h1 = R(2, 4); let h2 = R(3, 9); if (h2 === h1) h2++;
    const d1 = s * h1, ans = s * h2;
    return { q: `A train travels ${d1} miles in ${h1} hours. At the same speed, how many miles will it travel in ${h2} hours?`, a: ans,
      w: [d1 + s, d1 * h2, s * (h2 + 1), s * (h2 - 1), d1 + h2],
      why: `Speed = ${d1} ÷ ${h1} = ${s} miles per hour. In ${h2} hours: ${s} × ${h2} = ${ans} miles.` };
  });
  add(1, 'Area & perimeter', () => {
    const L = R(6, 16), W = R(2, L - 1), P = 2 * (L + W);
    return { q: `A rectangle has a perimeter of ${P} cm and a length of ${L} cm. What is its area, in square centimeters?`, a: L * W,
      w: [L * (P / 2), 2 * L * W, (P / 2) * W, L * W + L, P * L / 4],
      why: `Length + width = ${P} ÷ 2 = ${P / 2}, so the width is ${P / 2} − ${L} = ${W}. Area = ${L} × ${W} = ${L * W}.` };
  });
  add(1, 'Averages', () => {
    const n = R(4, 6), avg = R(12, 30), xs = [];
    for (let i = 0; i < n - 1; i++) xs.push(avg + R(-8, 8));
    const sum = xs.reduce((a, b) => a + b, 0), miss = n * avg - sum;
    if (miss < 1 || miss > 99) return null;
    return { q: `The average of ${words[n]} numbers is ${avg}. ${Word(n - 1)} of the numbers are ${andList(xs)}. What is the other number?`, a: miss,
      w: [avg, Math.round(sum / (n - 1)), miss + avg, n * avg, miss - n],
      why: `All ${n} numbers add to ${n} × ${avg} = ${n * avg}. The ${n - 1} known numbers add to ${sum}, so the missing one is ${n * avg} − ${sum} = ${miss}.` };
  });
  add(1, 'Counting multiples', () => {
    const k = R(3, 13), A = R(10, 60), B = A + R(60, 200);
    const ans = Math.floor(B / k) - Math.floor((A - 1) / k);
    return { q: `How many multiples of ${k} are between ${A} and ${B}, inclusive?`, a: ans,
      w: [Math.floor(B / k), Math.floor((B - A) / k), ans + 1, ans - 1, Math.round((B - A) / k) + 2],
      why: `Multiples of ${k} from 1 to ${B}: ${Math.floor(B / k)}. From 1 to ${A - 1}: ${Math.floor((A - 1) / k)}. So ${Math.floor(B / k)} − ${Math.floor((A - 1) / k)} = ${ans}.` };
  });
  add(1, 'Patterns', () => {
    const a = R(1, 12), d = R(2, 9), n = R(15, 60), ans = a + (n - 1) * d;
    return { q: `What is the ${ord(n)} term of the sequence ${a}, ${a + d}, ${a + 2 * d}, ${a + 3 * d}, …?`, a: ans,
      w: [a + n * d, a + (n - 2) * d, n * d, ans + 1, (n - 1) * d],
      why: `Start at ${a} and add ${d} a total of ${n - 1} times: ${a} + ${n - 1} × ${d} = ${ans}.` };
  });
  add(1, 'Time', () => {
    const h1 = R(7, 10), m1 = R(5, 55), dur = R(70, 200), end = h1 * 60 + m1 + dur, h2 = Math.floor(end / 60), m2 = end % 60;
    const t = (h, m) => `${((h - 1) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
    return { q: `Soccer practice starts at ${t(h1, m1)} and ends at ${t(h2, m2)}. How many minutes long is practice?`, a: dur,
      w: [dur + 40, dur - 40, (h2 - h1) * 100 + (m2 - m1), dur + 60, dur - 10],
      why: `From ${t(h1, m1)} to ${t(h2, m2)} is ${Math.floor(dur / 60)} h ${dur % 60} min = ${Math.floor(dur / 60) * 60} + ${dur % 60} = ${dur} minutes.` };
  });
  add(1, 'Money', () => {
    const q = R(1, 7), d = R(1, 9), n = R(1, 12), p = R(1, 9), ans = 25 * q + 10 * d + 5 * n + p;
    return { q: `Maya has ${q} quarters, ${d} dimes, ${n} nickels, and ${p} pennies. How many cents does she have?`, a: ans,
      w: [q + d + n + p, 25 * q + 10 * d + 5 * n, ans + 5, ans - 10, 25 * q + 10 * d + 10 * n + p],
      why: `${q}×25 + ${d}×10 + ${n}×5 + ${p}×1 = ${25 * q} + ${10 * d} + ${5 * n} + ${p} = ${ans} cents.` };
  });
  add(1, 'Fractions', () => {
    const fs = [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [1, 6], [5, 6]];
    const f1 = pick(fs), f2 = pick(fs), k = R(1, 5), base = f1[1] * f2[1] * k;
    const mid = base * f2[0] / f2[1], ans = mid * f1[0] / f1[1];
    return { q: `What is ${fr(f1[0], f1[1])} of ${fr(f2[0], f2[1])} of ${base}?`, a: ans,
      w: [base * f1[0] / f1[1], mid, ans * 2, ans + 1, base - ans],
      why: `${fr(f2[0], f2[1])} of ${base} is ${mid}. Then ${fr(f1[0], f1[1])} of ${mid} is ${ans}.` };
  });

  // ===== LEVEL 2 =====
  add(2, 'LCM', () => {
    const [a, b] = pick([[12, 18], [8, 12], [10, 15], [6, 14], [9, 12], [15, 20], [16, 24], [14, 21], [12, 20], [18, 24], [20, 30], [6, 10]]), L = lcm(a, b);
    return { q: `Bus A leaves the station every ${a} minutes and Bus B every ${b} minutes. Both leave together at 8:00 AM. How many minutes later will they next leave together?`, a: L,
      w: [a * b, a + b, gcd(a, b), L / 2, L * 2], why: `They line up again after the least common multiple of ${a} and ${b}: LCM(${a}, ${b}) = ${L} minutes.` };
  });
  add(2, 'GCD', () => {
    const g = R(3, 12), p = R(2, 9), q = R(2, 9); if (gcd(p, q) !== 1) return null;
    const A = g * p, B = g * q;
    return { q: `Ms. Rivera has ${A} pencils and ${B} erasers. She packs identical goody bags using all of them, with none left over. What is the greatest number of bags she can make?`, a: g,
      w: [p + q, g * 2, Math.max(p, q), Math.abs(A - B), g - 1],
      why: `The number of bags must divide both ${A} and ${B}. GCD(${A}, ${B}) = ${g}, so each bag gets ${p} pencils and ${q} erasers.` };
  });
  add(2, 'Percent change', () => {
    const p = pick([10, 20, 25, 50, 40]), q = pick([10, 20, 25, 50]), base = pick([40, 80, 100, 120, 160, 200, 400]);
    const fin = base * (100 + p) * (100 - q) / 10000; if (!Number.isInteger(fin)) return null;
    return { q: `A video game costs $${base}. Its price goes up ${p}%, and then the new price goes down ${q}%. What is the final price, in dollars?`, a: fin, pre: '$',
      w: [base + base * (p - q) / 100, base, base * (100 + p) / 100, base * (100 - q) / 100, fin + 2],
      why: `Up ${p}%: $${base} × ${(100 + p) / 100} = $${base * (100 + p) / 100}. Down ${q}%: × ${(100 - q) / 100} = $${fin}. The second percent is taken of the NEW price.` };
  });
  add(2, 'Ratios', () => {
    const a = R(1, 6), b = R(2, 9); if (gcd(a, b) !== 1 || a >= b) return null;
    const k = R(3, 12), tot = (a + b) * k;
    if (Math.random() < 0.5) return { q: `The ratio of boys to girls in a robotics club is ${a} : ${b}. There are ${tot} students in the club. How many girls are there?`, a: b * k,
      w: [a * k, tot - a, b * (k + 1), tot / b, (b - a) * k], why: `Split the club into ${a} + ${b} = ${a + b} equal parts of ${tot} ÷ ${a + b} = ${k}. Girls: ${b} × ${k} = ${b * k}.` };
    return { q: `The ratio of cats to dogs at a shelter is ${a} : ${b}. There are ${tot} cats and dogs in all. How many more dogs than cats are there?`, a: (b - a) * k,
      w: [b * k, a * k, b - a, (b - a) * (k + 1), (b - a) * (k - 1)], why: `Each part is ${tot} ÷ ${a + b} = ${k} animals. Dogs − cats = (${b} − ${a}) × ${k} = ${(b - a) * k}.` };
  });
  add(2, 'Angles', () => {
    const r = pick([[1, 2, 3], [2, 3, 4], [1, 1, 2], [3, 4, 5], [2, 3, 5], [1, 3, 5], [4, 5, 6], [1, 4, 7], [1, 2, 6], [2, 2, 5]]);
    const s = r[0] + r[1] + r[2], u = 180 / s; if (!Number.isInteger(u)) return null;
    const ans = r[2] * u;
    return { q: `The angles of a triangle are in the ratio ${r.join(' : ')}. What is the measure of the largest angle, in degrees?`, a: ans,
      w: [r[0] * u, r[1] * u, 360 / s * r[2], ans + 10, 180 - ans], why: `The parts add to ${s}, and 180° ÷ ${s} = ${u}°. Largest angle: ${r[2]} × ${u}° = ${ans}°.` };
  });
  add(2, 'Polygons', () => {
    const n = pick([5, 6, 8, 9, 10, 12, 15, 18, 20, 24, 30, 36]), ans = 180 * (n - 2) / n, ext = 360 / n;
    if (Math.random() < 0.5) return { q: `What is the measure, in degrees, of each interior angle of a regular polygon with ${n} sides?`, a: ans,
      w: [ext, 180 * (n - 2), 180 - ext / 2, ans - 10, ans + 12], why: `Interior angles add to (${n} − 2) × 180° = ${180 * (n - 2)}°. Divide by ${n}: ${ans}°.` };
    return { q: `Each interior angle of a regular polygon measures ${ans}°. How many sides does it have?`, a: n,
      w: [n - 2, n + 2, ext, n * 2, n - 1], why: `Each exterior angle is 180° − ${ans}° = ${ext}°. Exterior angles add to 360°, so 360 ÷ ${ext} = ${n} sides.` };
  });
  add(2, 'Units digits', () => {
    const b = pick([2, 3, 4, 7, 8, 9, 12, 13, 17, 22, 37, 43]), e = R(11, 99), ans = modpow(b, e, 10);
    const cyc = [1, 2, 3, 4].map(i => modpow(b, i, 10)), r = ((e - 1) % 4) + 1;
    return { q: `What is the units digit of ${sup(b, e)}?`, a: ans, digits: true, w: [...cyc, (b * e) % 10, e % 10],
      why: `Units digits of ${b}<sup>1</sup>, ${b}<sup>2</sup>, ${b}<sup>3</sup>, ${b}<sup>4</sup> are ${cyc.join(', ')}, then they repeat every 4. ${e} = 4 × ${Math.floor((e - 1) / 4)} + ${r}, so it matches ${b}<sup>${r}</sup>: ${ans}.` };
  });
  add(2, 'Consecutive integers', () => {
    if (Math.random() < 0.6) {
      const k = pick([3, 5, 7]), m = R(10, 60), sum = k * m, h = (k - 1) / 2;
      return { q: `The sum of ${words[k]} consecutive integers is ${sum}. What is the largest of these integers?`, a: m + h,
        w: [m, m - h, m + h + 1, m + k, m + h - 1], why: `The middle number is the average: ${sum} ÷ ${k} = ${m}. The largest is ${h} more: ${m + h}.` };
    }
    const a = R(8, 50), sum = 4 * a + 6;
    return { q: `The sum of four consecutive integers is ${sum}. What is the smallest of these integers?`, a: a,
      w: [a + 3, a + 1, sum / 4 | 0, a - 1, a + 2], why: `Call them n, n+1, n+2, n+3. Then 4n + 6 = ${sum}, so 4n = ${sum - 6} and n = ${a}.` };
  });
  add(2, 'Pythagorean theorem', () => {
    const t = pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [9, 40, 41]]);
    const ks = [1, 2, 3, 4, 5].filter(x => t[2] * x <= 100), k = pick(ks), [a, b, c] = t.map(x => x * k), v = R(0, 2);
    if (v === 0) return { q: `A right triangle has legs of length ${a} and ${b}. What is the length of its hypotenuse?`, a: c,
      w: [a + b, c + 1, c - 1, b + 1, c + 2], why: `${a}² + ${b}² = ${a * a} + ${b * b} = ${c * c}, and √${c * c} = ${c}.` };
    if (v === 1) return { q: `A ${c}-foot ladder leans against a wall. Its base is ${a} feet from the wall. How many feet up the wall does the ladder reach?`, a: b,
      w: [c - a, c + a, b + 2, b - 1, b + 1], why: `${c}² − ${a}² = ${c * c} − ${a * a} = ${b * b}, and √${b * b} = ${b} feet.` };
    return { q: `A rectangular field is ${a} meters by ${b} meters. How many meters long is its diagonal?`, a: c,
      w: [a + b, c - 2, c + 1, b + 2, (a + b) / 2 | 0], why: `The diagonal makes a right triangle: √(${a}² + ${b}²) = √${c * c} = ${c}.` };
  });
  add(2, 'Handshakes', () => {
    const n = R(6, 25);
    if (Math.random() < 0.5) return { q: `At a party, each of the ${n} guests shakes hands exactly once with every other guest. How many handshakes take place?`, a: C(n, 2),
      w: [n * (n - 1), n * n, C(n, 2) + n, C(n, 2) - n, (n - 1) * (n - 1)], why: `Each pair of people shakes once: ${n} × ${n - 1} ÷ 2 = ${C(n, 2)}.` };
    return { q: `In a league of ${n} teams, every team plays every other team exactly twice. How many games are played in all?`, a: n * (n - 1),
      w: [C(n, 2), n * n, 2 * n, n * (n - 1) * 2, n * (n + 1)], why: `There are ${n} × ${n - 1} ÷ 2 = ${C(n, 2)} pairs of teams, and each pair plays twice: ${n * (n - 1)} games.` };
  });
  add(2, 'Counting terms', () => {
    const a = R(1, 9), d = R(2, 7), n = R(20, 90), last = a + (n - 1) * d;
    return { q: `How many numbers are in the list ${a}, ${a + d}, ${a + 2 * d}, …, ${last}?`, a: n,
      w: [n - 1, n + 1, Math.floor(last / d), n + 2, n - 2], why: `(${last} − ${a}) ÷ ${d} = ${n - 1} jumps. Count the starting number too: ${n - 1} + 1 = ${n}.` };
  });
  add(2, 'Cubes', () => {
    const s = R(2, 9);
    if (Math.random() < 0.5) return { q: `A cube has a volume of ${s ** 3} cubic inches. What is its total surface area, in square inches?`, a: 6 * s * s,
      w: [s * s, 4 * s * s, s ** 3, 6 * s, 12 * s], why: `The edge is the cube root of ${s ** 3}, which is ${s}. Six square faces: 6 × ${s}² = ${6 * s * s}.` };
    return { q: `A cube has a total surface area of ${6 * s * s} square centimeters. What is its volume, in cubic centimeters?`, a: s ** 3,
      w: [s * s, 6 * s * s, 12 * s, (s + 1) ** 3, s ** 3 * 2], why: `Each face has area ${6 * s * s} ÷ 6 = ${s * s}, so the edge is ${s}. Volume: ${s}³ = ${s ** 3}.` };
  });
  add(2, 'Equations', () => {
    const x = R(3, 25), k = R(2, 9), a = R(3, 30), r = k * x + a;
    return { q: `When ${a} is added to ${k} times a number, the result is ${r}. What is ${k + 1} times the number?`, a: (k + 1) * x,
      w: [x, k * x, (k + 1) * x + a, r - a, (k + 1) * (x + 1)], why: `${k}n + ${a} = ${r}, so ${k}n = ${r - a} and n = ${x}. Then ${k + 1} × ${x} = ${(k + 1) * x}.` };
  });

  // ===== LEVEL 3 =====
  add(3, 'Divisors', () => {
    const n = pick([24, 30, 36, 40, 48, 60, 72, 84, 90, 96, 100, 108, 120, 126, 144, 150, 180, 196, 200, 210, 216, 225, 240, 252, 288, 300, 360]), d = nd(n);
    const f = pf(n);
    return { q: `How many positive divisors does ${n} have?`, a: d, w: [d - 1, d + 1, d - 2, d + 2, f.length + 2, d * 2],
      why: `${n} = ${pfStr(n)}. Add 1 to each exponent and multiply: ${f.map(([, e]) => `(${e}+1)`).join(' × ')} = ${d}.` };
  });
  add(3, 'Probability', () => {
    const v = R(0, 2);
    if (v === 0) {
      const s = R(3, 11), ways = 6 - Math.abs(7 - s);
      return { kind: 'frac', prob: true, q: `Two fair six-sided dice are rolled. What is the probability that the sum is ${s}?`, a: [ways, 36],
        w: [[ways, 12], [1, 11], [ways + 1, 36], [ways, 18], [1, 6]], why: `There are 6 × 6 = 36 equally likely outcomes, and ${ways} of them add to ${s}. ${frR(ways, 36)}.` };
    }
    if (v === 1) {
      const opts = [
        ['the product of the two numbers is even', [27, 36], `Odd × odd is the only odd product: 3 × 3 = 9 outcomes. So 36 − 9 = 27 are even: ${fr(3, 4)}.`],
        ['both dice show the same number', [6, 36], `6 doubles out of 36 outcomes: ${fr(1, 6)}.`],
        ['the sum is a prime number', [15, 36], `Sums 2, 3, 5, 7, 11 happen 1 + 2 + 4 + 6 + 2 = 15 ways out of 36: ${fr(5, 12)}.`],
        ['the sum is greater than 8', [10, 36], `Sums 9, 10, 11, 12 happen 4 + 3 + 2 + 1 = 10 ways out of 36: ${fr(5, 18)}.`],
        ['at least one die shows a 6', [11, 36], `No 6 at all: 5 × 5 = 25 ways. So 36 − 25 = 11 ways have a 6: ${fr(11, 36)}.`],
        ['the two numbers differ by 2', [8, 36], `Pairs (1,3),(2,4),(3,5),(4,6) in either order: 8 ways out of 36 = ${fr(2, 9)}.`],
      ];
      const [txt, a, why] = pick(opts);
      return { kind: 'frac', prob: true, q: `Two fair six-sided dice are rolled. What is the probability that ${txt}?`, a,
        w: [[a[0] - 1, 36], [a[0] + 2, 36], [1, 2], [a[0], 72], [a[0] + 3, 36]], why };
    }
    const r = R(2, 9), b = R(2, 9), g = R(2, 9), n = r + b + g;
    return { kind: 'frac', prob: true, q: `A bag holds ${r} red, ${b} blue, and ${g} green marbles. One marble is drawn at random. What is the probability that it is NOT blue?`, a: [r + g, n],
      w: [[b, n], [r, n], [r + g, n + 1], [1, 3], [2, 3]], why: `${r} + ${g} = ${r + g} marbles are not blue, out of ${n} total: ${frR(r + g, n)}.` };
  });
  add(3, 'Remainders', () => {
    const s = pick([[2, 3, 4], [3, 4, 5], [2, 3, 4, 5], [4, 5, 6], [3, 5, 7], [2, 3, 5], [2, 3, 4, 5, 6], [5, 6, 8], [3, 4, 7]]), L = lcmAll(s);
    if (Math.random() < 0.5) return { q: `What is the smallest whole number greater than 1 that leaves a remainder of 1 when divided by each of ${andList(s)}?`, a: L + 1,
      w: [L, L * 2 + 1, s.reduce((x, y) => x * y, 1) + 1, L - 1, L + 2], why: `The number minus 1 must be a multiple of ${andList(s)}. The smallest such multiple is LCM = ${L}, so the answer is ${L + 1}.` };
    const t = s.slice(0, 3), L3 = lcmAll(t);
    return { q: `What is the smallest positive integer that leaves a remainder of ${t[0] - 1} when divided by ${t[0]}, ${t[1] - 1} when divided by ${t[1]}, and ${t[2] - 1} when divided by ${t[2]}?`, a: L3 - 1,
      w: [L3, L3 + 1, t[0] * t[1] * t[2] - 1, L3 * 2 - 1, L3 - 2], why: `Each remainder is one less than the divisor, so the number + 1 is a multiple of ${andList(t)}. LCM = ${L3}, so the answer is ${L3 - 1}.` };
  });
  add(3, 'Average speed', () => {
    const [a, b] = pick([[3, 6], [4, 12], [6, 12], [10, 15], [12, 24], [20, 30], [30, 60], [40, 60], [5, 20], [15, 30], [36, 45], [45, 90], [9, 18], [8, 24], [20, 60]]);
    const h = 2 * a * b / (a + b);
    return { q: `Sam bikes to the lake at ${a} miles per hour and returns along the same route at ${b} miles per hour. What is his average speed for the whole round trip, in miles per hour?`, a: h,
      w: [(a + b) / 2, h + 1, b - a, h - 2, (a + b) / 2 + 2], why: `Pick a distance, like ${lcm(a, b)} miles each way. Time: ${lcm(a, b) / a} + ${lcm(a, b) / b} = ${lcm(a, b) / a + lcm(a, b) / b} hours for ${2 * lcm(a, b)} miles, so ${h} mph. (Not just the average of the speeds!)` };
  });
  add(3, 'Work together', () => {
    const [a, b] = pick([[2, 3], [3, 6], [2, 6], [4, 12], [2, 4], [1, 2], [4, 6], [6, 12], [5, 20], [1, 3], [1, 4]]), ans = 60 * a * b / (a + b);
    return { q: `Pipe A can fill a pool in ${a} hour${a > 1 ? 's' : ''}, and pipe B can fill it in ${b} hours. Working together, how many minutes will it take them to fill the pool?`, a: ans,
      w: [30 * (a + b), 60 * (b - a), 60 * a, ans + 10, ans - 6], why: `Per hour they fill ${fr(1, a)} + ${fr(1, b)} = ${frR(a + b, a * b)} of the pool. So it takes ${frR(a * b, a + b)} hours = ${ans} minutes.` };
  });
  add(3, 'Circles', () => {
    const r = R(2, 12), v = R(0, 2);
    if (v === 0) return { kind: 'pi', q: `A circle has a circumference of ${2 * r}π. What is its area?`, a: r * r,
      w: [2 * r, 4 * r * r, r, 2 * r * r, r * r + 2 * r], why: `C = 2πr = ${2 * r}π, so r = ${r}. Area = πr² = ${r * r}π.` };
    if (v === 1) return { kind: 'pi', q: `A circle has an area of ${r * r}π. What is its circumference?`, a: 2 * r,
      w: [r, r * r, 4 * r, 2 * r * r, r + 2], why: `πr² = ${r * r}π, so r = ${r}. Circumference = 2πr = ${2 * r}π.` };
    return { kind: 'pi', q: `A circular pizza has a diameter of ${2 * r} inches. What is its area, in square inches?`, a: r * r,
      w: [4 * r * r, 2 * r, r * 2 * r, r, r * r * 2 + 1], why: `The radius is half the diameter: ${r}. Area = π × ${r}² = ${r * r}π.` };
  });
  add(3, 'Factorials', () => {
    const n = R(20, 130), z = Math.floor(n / 5) + Math.floor(n / 25) + Math.floor(n / 125);
    return { q: `How many zeros are at the end of ${n}!? (${n}! means ${n} × ${n - 1} × ${n - 2} × … × 2 × 1.)`, a: z,
      w: [Math.floor(n / 5), Math.floor(n / 10), z + 1, z - 1, z + Math.floor(n / 25) + 1],
      why: `Each zero needs a 5 (2s are plentiful). Count the 5s: ⌊${n}/5⌋ + ⌊${n}/25⌋${n >= 125 ? ' + ⌊' + n + '/125⌋' : ''} = ${z}.` };
  });
  add(3, 'Arrangements', () => {
    const w = pick(['MATH', 'LEVEL', 'BANANA', 'APPLE', 'PIZZA', 'TOOTH', 'COOKIE', 'PEPPER', 'BOOK', 'RADAR', 'ERROR', 'CANDY', 'PRIME', 'ALGEBRA', 'GEESE']);
    const cnt = {}; for (const c of w) cnt[c] = (cnt[c] || 0) + 1;
    const reps = Object.values(cnt).filter(x => x > 1), den = reps.reduce((s, x) => s * fact(x), 1), ans = fact(w.length) / den;
    return { q: `How many different arrangements of the letters in the word <b>${w}</b> are there?`, a: ans,
      w: [fact(w.length), fact(w.length) / 2, ans * 2, ans / 2, w.length * (w.length - 1)],
      why: reps.length ? `${w.length}! = ${fact(w.length)}, but repeated letters can swap without making a new word: divide by ${reps.map(x => x + '!').join(' × ')} = ${den}. ${fact(w.length)} ÷ ${den} = ${ans}.` : `All ${w.length} letters are different: ${w.length}! = ${ans}.` };
  });
  add(3, 'Mean & median', () => {
    const n = pick([5, 7]), xs = []; for (let i = 0; i < n; i++) xs.push(R(2, 30));
    xs.sort((a, b) => a - b); const fix = (n - xs.reduce((a, b) => a + b, 0) % n) % n; xs[n - 1] += fix;
    const mean = xs.reduce((a, b) => a + b, 0) / n, med = xs[(n - 1) / 2]; if (mean === med) return null;
    const ans = Math.abs(mean - med), bigger = mean > med ? 'mean' : 'median', other = mean > med ? 'median' : 'mean';
    const list = shuffle(xs.slice());
    return { q: `Here is a list of numbers: ${list.join(', ')}. How much greater is the ${bigger} than the ${other}?`, a: ans,
      w: [mean, med, ans + 1, ans + 2, ans - 1, ans * 2], why: `In order: ${xs.join(', ')}. Median = ${med}. Mean = ${xs.reduce((a, b) => a + b, 0)} ÷ ${n} = ${mean}. Difference: ${ans}.` };
  });
  add(3, 'Series', () => {
    const v = R(0, 2);
    if (v === 0) { const n = R(20, 100), ans = n * (n + 1) / 2;
      return { q: `What is 1 + 2 + 3 + … + ${n}?`, a: ans, w: [n * (n - 1) / 2, n * (n + 1), ans + n, n * n, ans - 1],
        why: `Pair the ends: 1 + ${n}, 2 + ${n - 1}, … each pair is ${n + 1}. Sum = ${n} × ${n + 1} ÷ 2 = ${ans}.` }; }
    if (v === 1) { const n = R(10, 40), last = 2 * n - 1;
      return { q: `What is the sum of all the odd numbers from 1 to ${last}: 1 + 3 + 5 + … + ${last}?`, a: n * n, w: [n * (n + 1), last * n, n * n - 1, n * n + n / 2 | 0, 2 * n * n],
        why: `There are ${n} odd numbers, and the sum of the first n odd numbers is n². ${n}² = ${n * n}.` }; }
    const a = R(10, 40), b = a + R(10, 40), cnt = b - a + 1, ans = (a + b) * cnt / 2;
    return { q: `What is the sum of all the integers from ${a} to ${b}, inclusive?`, a: ans, w: [(a + b) * (b - a) / 2, ans + a, ans - b, b * (b + 1) / 2, ans + 1],
      why: `There are ${b} − ${a} + 1 = ${cnt} numbers, averaging (${a} + ${b}) ÷ 2 = ${(a + b) / 2}. Sum = ${cnt} × ${(a + b) / 2} = ${ans}.` };
  });
  add(3, 'Exponents', () => {
    if (Math.random() < 0.6) {
      const a = R(2, 12), b = R(1, 8), c = R(1, 5), x = a + 2 * b - 3 * c; if (x < 1) return null;
      return { q: `If ${sup(2, a)} × ${sup(4, b)} ÷ ${sup(8, c)} = ${sup(2, 'x')}, what is x?`, a: x,
        w: [a + b - c, a + 2 * b + 3 * c, x + 1, x - 1, a * b], why: `Write everything as powers of 2: 4 = 2², 8 = 2³. Exponent: ${a} + 2·${b} − 3·${c} = ${x}.` };
    }
    const a = R(1, 6), b = R(1, 5), x = 2 * a + 3 * b;
    return { q: `If ${sup(9, a)} × ${sup(27, b)} = ${sup(3, 'x')}, what is x?`, a: x, w: [a + b, 2 * a + 2 * b, x + 1, x - 1, 6 * a * b],
      why: `9 = 3² and 27 = 3³, so the exponent is 2·${a} + 3·${b} = ${x}.` };
  });
  add(3, 'Diagonals', () => {
    const n = R(6, 20), ans = n * (n - 3) / 2;
    return { q: `How many diagonals does a convex polygon with ${n} sides have?`, a: ans, w: [n * (n - 1) / 2, n * (n - 3), n - 3, ans + n, ans - 1],
      why: `Each vertex connects to ${n - 3} others by a diagonal (not itself or its 2 neighbors). ${n} × ${n - 3} counts each diagonal twice: ÷ 2 = ${ans}.` };
  });
  add(3, 'Systems', () => {
    const a = R(8, 15), b = R(3, a - 2), N = R(12, 40), x = R(2, N - 2), M = a * x + b * (N - x);
    return { q: `Adult tickets cost $${a} and child tickets cost $${b}. A total of ${N} tickets were sold for $${M}. How many adult tickets were sold?`, a: x,
      w: [N - x, x + 1, x - 1, Math.round(M / a), Math.round(M / (a + b))], why: `If all ${N} were child tickets: $${b * N}. Each adult ticket adds $${a - b} more. ($${M} − $${b * N}) ÷ $${a - b} = ${x} adult tickets.` };
  });
  add(3, 'Ages', () => {
    const b = R(3, 14), k = pick([3, 4, 5]), m = pick([2, 3]); if (m >= k) return null;
    const y = b * (k - m) / (m - 1); if (!Number.isInteger(y) || y < 1 || y > 30) return null;
    return { q: `Ava is ${words[k]} times as old as her brother. In ${y} years, she will be ${m === 2 ? 'twice' : 'three times'} as old as he is then. How old is Ava now?`, a: k * b,
      w: [b, k * b + y, m * b, k * b - y, (k + 1) * b], why: `Brother = b, Ava = ${k}b. Then ${k}b + ${y} = ${m}(b + ${y}), so ${k - m}b = ${(m - 1) * y} and b = ${b}. Ava is ${k * b}.` };
  });
  add(3, 'Mental math', () => {
    const a = R(31, 99), b = R(11, a - 3), ans = a * a - b * b;
    return { q: `What is ${a}² − ${b}²?`, a: ans, w: [(a - b) ** 2, ans + 100, ans - 100, (a - b) * (a - b + 2), 2 * (a - b) * b],
      why: `Difference of squares: a² − b² = (a − b)(a + b) = ${a - b} × ${a + b} = ${ans}.` };
  });
  add(3, 'Meeting trains', () => {
    const s1 = 5 * R(6, 16), s2 = 5 * R(6, 16), t = pick([1.5, 2, 2.5, 3, 0.5, 1.25, 0.75]), D = (s1 + s2) * t;
    if (!Number.isInteger(D)) return null;
    if (Math.random() < 0.5) return { q: `Two trains start ${D} miles apart and travel toward each other, one at ${s1} mph and the other at ${s2} mph. How many minutes until they meet?`, a: t * 60,
      w: [D / s1 * 60, t * 60 + 15, t * 60 - 15, D / Math.abs(s1 - s2 || 1) * 60, t * 120], why: `They close the gap at ${s1} + ${s2} = ${s1 + s2} mph. ${D} ÷ ${s1 + s2} = ${t} hours = ${t * 60} minutes.` };
    return { q: `Two cyclists start ${D} miles apart and ride toward each other, one at ${s1} mph and the other at ${s2} mph. How far, in miles, has the ${s1} mph cyclist ridden when they meet?`, a: s1 * t,
      w: [s2 * t, D / 2, s1 * t + 5, s1, s1 * t - 5], why: `Together they close ${s1 + s2} miles each hour, so they meet after ${D} ÷ ${s1 + s2} = ${t} h. The first rides ${s1} × ${t} = ${s1 * t} miles.` };
  });

  // ===== LEVEL 4 =====
  add(4, 'Grid paths', () => {
    const m = R(2, 6), n = R(2, 6), ans = C(m + n, m);
    return { q: `A bug walks along the lines of a ${m} × ${n} grid of squares (${m} squares wide, ${n} tall), from the bottom-left corner to the top-right corner, moving only right or up. How many different paths can it take?`, a: ans,
      w: [m * n, (m + 1) * (n + 1), m + n, ans - 1, 2 ** (m + n - 1)], why: `Every path is ${m} rights and ${n} ups in some order. Choose which ${m} of the ${m + n} steps go right: C(${m + n}, ${m}) = ${ans}.` };
  });
  add(4, 'Committees', () => {
    const b = R(4, 8), g = R(3, 6), all = C(b + g, 3), nob = C(b, 3), ans = all - nob;
    return { q: `A club has ${b} boys and ${g} girls. How many ways can a 3-person committee be chosen that includes at least one girl?`, a: ans,
      w: [all, g * C(b, 2), all - C(g, 3), g * C(b + g - 1, 2), ans - g], why: `All committees: C(${b + g}, 3) = ${all}. All-boy committees: C(${b}, 3) = ${nob}. Subtract: ${all} − ${nob} = ${ans}.` };
  });
  add(4, 'Remainders of powers', () => {
    const m = pick([5, 7, 9, 11, 13]), b = pick([2, 3, 4, 5, 6].filter(x => gcd(x, m) === 1)), e = R(20, 100), ans = modpow(b, e, m);
    let p = 1; while (modpow(b, p, m) !== 1) p++;
    const cyc = []; for (let i = 1; i <= p; i++) cyc.push(modpow(b, i, m));
    const r = e % p;
    return { q: `What is the remainder when ${sup(b, e)} is divided by ${m}?`, a: ans, range: [0, m - 1], w: cyc.concat([(b * e) % m, e % m]),
      why: `Remainders of ${b}<sup>1</sup>, ${b}<sup>2</sup>, … mod ${m} repeat every ${p}: ${cyc.join(', ')}. ${e} = ${p} × ${Math.floor(e / p)} + ${r}, so the remainder is ${r === 0 ? `the same as ${b}<sup>${p}</sup>, which is 1` : `the same as ${b}<sup>${r}</sup>, which is ${ans}`}.` };
  });
  add(4, 'Digit sums', () => {
    const n = R(10, 40), k = R(11, 99), tail = 100 - k, ds = digitSum(tail), ans = 9 * (n - 2) + ds;
    return { q: `What is the sum of the digits of ${sup(10, n)} − ${k}?`, a: ans, w: [9 * n, 9 * (n - 2), 9 * (n - 1) + ds, ans + 9, ans - 9],
      why: `${sup(10, n)} − ${k} = 99…9${String(tail).padStart(2, '0')}, with ${n - 2} nines. Digit sum: 9 × ${n - 2} + ${ds} = ${ans}.` };
  });
  add(4, 'Probability (draws)', () => {
    const r = R(3, 8), b = R(3, 8), n = r + b;
    if (Math.random() < 0.5) return { kind: 'frac', prob: true, q: `A bag has ${r} red and ${b} blue marbles. Two marbles are drawn without replacement. What is the probability that both are red?`, a: [r * (r - 1), n * (n - 1)],
      w: [[r * r, n * n], [r, n], [r - 1, n - 1], [r * (r - 1), n * n], [r, 2 * n]], why: `First red: ${fr(r, n)}. Second red: ${fr(r - 1, n - 1)}. Multiply: ${frR(r * (r - 1), n * (n - 1))}.` };
    return { kind: 'frac', prob: true, q: `A bag has ${r} red and ${b} blue marbles. Two marbles are drawn without replacement. What is the probability that they are different colors?`, a: [2 * r * b, n * (n - 1)],
      w: [[r * b, n * (n - 1)], [2 * r * b, n * n], [1, 2], [r * b, n * n], [r + b - 1, 2 * n]], why: `Red then blue: ${fr(r, n)} × ${fr(b, n - 1)}. Blue then red is the same. Total: 2 × ${frR(r * b, n * (n - 1))} = ${frR(2 * r * b, n * (n - 1))}.` };
  });
  add(4, 'Inclusion-exclusion', () => {
    const [a, b] = pick([[2, 3], [3, 5], [2, 5], [3, 7], [4, 6], [6, 9], [4, 10], [5, 7], [6, 8]]), N = R(60, 300), L = lcm(a, b);
    const fa = Math.floor(N / a), fb = Math.floor(N / b), fl = Math.floor(N / L), ans = fa + fb - fl;
    if (Math.random() < 0.5) return { q: `How many integers from 1 to ${N} are divisible by ${a} or ${b} (or both)?`, a: ans,
      w: [fa + fb, fa + fb - Math.floor(N / (a * b)), ans + 1, N - ans, ans - 1], why: `Divisible by ${a}: ${fa}. By ${b}: ${fb}. By both (multiples of ${L}): ${fl}. ${fa} + ${fb} − ${fl} = ${ans}.` };
    return { q: `How many integers from 1 to ${N} are divisible by neither ${a} nor ${b}?`, a: N - ans,
      w: [ans, N - fa - fb, N - ans + 1, N - ans - 1, N - fa], why: `By ${a} or ${b}: ${fa} + ${fb} − ${fl} = ${ans} (subtract the multiples of ${L}, counted twice). Neither: ${N} − ${ans} = ${N - ans}.` };
  });
  add(4, 'Painted cube', () => {
    const n = R(3, 8), k = R(0, 3), v = [(n - 2) ** 3, 6 * (n - 2) ** 2, 12 * (n - 2), 8], ans = v[k];
    const desc = ['no painted faces', 'exactly one painted face', 'exactly two painted faces', 'exactly three painted faces'];
    const why = [`The unpainted cubes form the inside: a ${n - 2} × ${n - 2} × ${n - 2} cube = ${ans}.`, `Each of the 6 faces has a ${n - 2} × ${n - 2} middle: 6 × ${(n - 2) ** 2} = ${ans}.`, `Each of the 12 edges has ${n - 2} middle cubes: 12 × ${n - 2} = ${ans}.`, `Only the 8 corner cubes have three painted faces.`][k];
    return { q: `${art(n) === 'an' ? 'An' : 'A'} ${n} × ${n} × ${n} cube is painted on all six faces, then cut into ${n ** 3} unit cubes. How many unit cubes have ${desc[k]}?`, a: ans,
      w: v.filter((_, i) => i !== k).concat([6 * n, 12 * n, n * n]), why };
  });
  add(4, 'Clock angles', () => {
    const h = R(1, 11), m = 2 * R(1, 29), raw = Math.abs(30 * h - 5.5 * m), ans = Math.min(raw, 360 - raw);
    const naive = Math.min(Math.abs(30 * h - 6 * m), 360 - Math.abs(30 * h - 6 * m));
    return { q: `What is the smaller angle, in degrees, between the hour hand and the minute hand of a clock at ${h}:${String(m).padStart(2, '0')}?`, a: ans,
      w: [naive, 360 - ans, ans + 15, ans + 30, Math.abs(ans - 30)], why: `Minute hand: ${m} × 6° = ${6 * m}°. Hour hand: ${h} × 30° + ${m} × 0.5° = ${30 * h + 0.5 * m}°. Difference: ${raw}°${raw > 180 ? `, and 360° − ${raw}° = ${ans}°` : ''}.` };
  });
  add(4, 'Stamps', () => {
    const [a, b] = pick([[3, 5], [3, 7], [4, 7], [5, 7], [4, 9], [5, 8], [3, 8], [5, 6], [4, 5], [3, 10]]), ans = a * b - a - b;
    return { q: `A post office sells only ${a}-cent and ${b}-cent stamps. What is the largest amount of postage, in cents, that CANNOT be made exactly?`, a: ans,
      w: [a * b, a * b - a, a + b, ans - 1, ans - a], why: `${ans} can't be made, but ${ans + 1} through ${ans + a} can, and adding ${a}-cent stamps reaches everything higher. (Shortcut: ${a}·${b} − ${a} − ${b} = ${ans}.)` };
  });
  add(4, 'Three divisors', () => {
    const N = R(30, 400), ps = []; for (let p = 2; p * p < N; p++) if (isPrime(p)) ps.push(p);
    const ans = ps.length; if (ans < 2) return null;
    return { q: `How many positive integers less than ${N} have exactly three positive divisors?`, a: ans,
      w: [ans + 1, ans - 1, Math.floor(Math.sqrt(N - 1)), ans + 2, ans * 2], why: `Only squares of primes have exactly 3 divisors (1, p, p²). Below ${N}: ${ps.map(p => p * p).join(', ')}. That's ${ans}.` };
  });
  add(4, 'Sum of divisors', () => {
    const N = pick([12, 18, 20, 24, 28, 30, 36, 40, 45, 48, 50, 60, 72, 80, 84, 90, 96, 100]), d = divs(N), ans = d.reduce((a, b) => a + b, 0);
    return { q: `What is the sum of all the positive divisors of ${N}?`, a: ans, w: [ans - N, ans - 1, ans + N, ans - 1 - N, ans + 2],
      why: `The divisors of ${N} are ${d.join(', ')}. They add up to ${ans}.` };
  });
  add(4, 'Counting squares', () => {
    const n = R(3, 8); let ans = 0; const terms = []; for (let k = 1; k <= n; k++) { ans += k * k; terms.push(k * k); }
    return { q: `How many squares of any size are there in ${art(n)} ${n} × ${n} grid of unit squares?`, a: ans, w: [n * n, n * n + (n - 1) ** 2, 2 * n * n, ans + n, ans - 1],
      why: `${n}² squares of size 1, ${n - 1}² of size 2, …, 1 of size ${n}: ${terms.reverse().join(' + ')} = ${ans}.` };
  });
  add(4, 'Coordinate geometry', () => {
    const p = () => [R(0, 10), R(0, 10)], A = p(), B = p(), Cc = p();
    const twice = Math.abs(A[0] * (B[1] - Cc[1]) + B[0] * (Cc[1] - A[1]) + Cc[0] * (A[1] - B[1]));
    if (twice < 8) return null; const ans = twice / 2;
    return { q: `What is the area of the triangle with vertices (${A}), (${B}), and (${Cc})?`, a: ans,
      w: [twice, ans + 1, ans - 1, ans + 0.5, ans - 0.5, ans + 2], why: `Box it in a rectangle and subtract the corner triangles, or use the shoelace formula: ½ × |${A[0]}(${B[1]}−${Cc[1]}) + ${B[0]}(${Cc[1]}−${A[1]}) + ${Cc[0]}(${A[1]}−${B[1]})| = ½ × ${twice} = ${ans}.` };
  });
  add(4, 'Mixtures', () => {
    const V = pick([20, 30, 40, 60, 80, 90, 120]), p1 = pick([20, 25, 30, 40, 50, 60]), p2 = pick([10, 15, 20, 25, 30, 40]); if (p2 >= p1) return null;
    const ans = V * p1 / p2 - V; if (!Number.isInteger(ans)) return null;
    return { q: `A ${V}-liter tank of juice mix is ${p1}% juice. How many liters of water must be added so the mix is ${p2}% juice?`, a: ans,
      w: [V * (p1 - p2) / 100, V * p1 / p2, ans * 2, ans + 5, p1 - p2], why: `The juice stays the same: ${p1}% of ${V} = ${V * p1 / 100} L. That must be ${p2}% of the new total, so the total is ${V * p1 / 100} ÷ ${p2 / 100} = ${V * p1 / p2} L. Add ${V * p1 / p2} − ${V} = ${ans} L.` };
  });
  add(4, 'Coin flips', () => {
    const n = R(4, 7), k = R(1, n - 1), ans = [C(n, k), 2 ** n];
    return { kind: 'frac', prob: true, q: `A fair coin is flipped ${n} times. What is the probability of getting exactly ${k} head${k > 1 ? 's' : ''}?`, a: ans,
      w: [[k, n], [1, 2 ** n], [C(n, k), 2 ** (n + 1)], [C(n, k) + 1, 2 ** n], [1, 2]], why: `There are 2<sup>${n}</sup> = ${2 ** n} outcomes. Choose which ${k} flips are heads: C(${n}, ${k}) = ${C(n, k)}. So ${frR(C(n, k), 2 ** n)}.` };
  });
  add(4, 'Averages', () => {
    const n = R(4, 9), A = R(70, 90), d = R(1, 3), S = A + d * (n + 1); if (S > 100) return null;
    return { q: `Kai's average on ${n} tests is ${A}. After one more test, the average rises to ${A + d}. What did Kai score on that last test?`, a: S,
      w: [A + d, A + d * n, S + d, (A + d) * (n + 1) - A * (n - 1), S - 1], why: `Total before: ${n} × ${A} = ${n * A}. Total after: ${n + 1} × ${A + d} = ${(n + 1) * (A + d)}. Last test: ${(n + 1) * (A + d)} − ${n * A} = ${S}.` };
  });
  add(4, 'Inscribed shapes', () => {
    const r = R(2, 12);
    return { q: `A square is drawn inside a circle of radius ${r} so that all four corners touch the circle. What is the area of the square?`, a: 2 * r * r,
      w: [r * r, 4 * r * r, 2 * r, 3 * r * r, 2 * r * r + r], why: `The square's diagonal is the circle's diameter, ${2 * r}. Area of a square = diagonal² ÷ 2 = ${4 * r * r} ÷ 2 = ${2 * r * r}.` };
  });
  add(4, 'Digit counting', () => {
    const N = pick([100, 200, 300, 500, 1000]), d = R(1, 9); let ans = 0; for (let i = 1; i <= N; i++) if (String(i).includes(String(d))) ans++;
    return { q: `How many integers from 1 to ${N} contain the digit ${d} at least once?`, a: ans, w: [ans + 1, ans - 1, Math.round(N / 10), ans + 10, ans - 9],
      why: `Count the numbers WITHOUT a ${d}, then subtract. ${N - ans} numbers from 1 to ${N} have no ${d}, so ${N} − ${N - ans} = ${ans} do.` };
  });

  // ===== LEVEL 5 (hardest) =====
  add(5, 'Digit patterns', () => {
    const k = R(2, 5), inc = Math.random() < 0.5, ans = inc ? C(9, k) : C(10, k);
    const ex = inc ? ['', '', '37', '147', '2489', '13579'][k] : ['', '', '72', '941', '8530', '97420'][k];
    return { q: `How many ${k}-digit positive integers have digits that strictly ${inc ? 'increase' : 'decrease'} from left to right (like ${ex})?`, a: ans,
      w: [inc ? C(10, k) : C(9, k), C(9, k - 1), C(9, k) * 2, ans - 1, C(10, k - 1)],
      why: inc ? `Pick any ${k} different digits from 1–9; there is exactly one increasing order. (0 can't be used, it would have to go first.) C(9, ${k}) = ${ans}.` : `Pick any ${k} different digits from 0–9; there is exactly one decreasing order, and 0 can only land last, so it's fine. C(10, ${k}) = ${ans}.` };
  });
  const SMALL_DIV = {}; for (let n = 1; n <= 2000; n++) { const k = nd(n); if (!SMALL_DIV[k]) SMALL_DIV[k] = n; }
  add(5, 'Number theory', () => {
    const k = pick([6, 8, 9, 10, 12, 14, 15, 16, 18, 20]), ans = SMALL_DIV[k];
    const others = [6, 8, 9, 10, 12, 14, 15, 16, 18, 20].filter(x => x !== k).map(x => SMALL_DIV[x]);
    return { q: `What is the smallest positive integer that has exactly ${k} positive divisors?`, a: ans, w: [2 ** (k - 1) <= 5000 ? 2 ** (k - 1) : ans * 2, ...shuffle(others).slice(0, 4)],
      why: `${ans} = ${pfStr(ans)}, which has ${pf(ans).map(([, e]) => `(${e}+1)`).join(' × ')} = ${k} divisors. Putting the bigger exponents on the smaller primes keeps the number small.` };
  });
  add(5, 'Counting rectangles', () => {
    const m = R(2, 6), n = R(2, 6), ans = C(m + 1, 2) * C(n + 1, 2);
    return { q: `How many rectangles of any size (squares count too) can be found in a ${m} × ${n} grid of unit squares?`, a: ans,
      w: [m * n, (m + 1) * (n + 1), C(m + n, 2), ans + m * n, ans - m * n], why: `A rectangle is fixed by choosing 2 of the ${m + 1} vertical lines and 2 of the ${n + 1} horizontal lines: C(${m + 1}, 2) × C(${n + 1}, 2) = ${C(m + 1, 2)} × ${C(n + 1, 2)} = ${ans}.` };
  });
  add(5, 'Digit products', () => {
    const P = pick([6, 8, 12, 16, 18, 20, 24, 30, 36]); let ans = 0; const sets = {};
    for (let i = 100; i <= 999; i++) { const ds = String(i).split('').map(Number); if (ds[0] * ds[1] * ds[2] === P) { ans++; const key = ds.slice().sort().join(''); sets[key] = (sets[key] || 0) + 1; } }
    const parts = Object.entries(sets).map(([k, c]) => `{${k.split('').join(',')}}: ${c}`);
    return { q: `How many three-digit numbers have digits whose product is ${P}?`, a: ans, w: [ans + 1, ans - 1, ans + 3, ans - 3, Object.keys(sets).length],
      why: `Find the digit groups, then count their orders: ${parts.join('; ')}. Total: ${ans}.` };
  });
  add(5, 'Diophantine', () => {
    const [a, b] = pick([[2, 3], [2, 5], [3, 4], [3, 5], [4, 5], [3, 7], [5, 7], [2, 7]]), N = R(30, 120), sols = [];
    for (let y = 1; b * y < N; y++) { const r = N - b * y; if (r % a === 0 && r > 0) sols.push([r / a, y]); }
    if (sols.length < 2) return null; const ans = sols.length;
    return { q: `How many ordered pairs of positive integers (x, y) satisfy ${a}x + ${b}y = ${N}?`, a: ans, w: [ans + 1, ans - 1, ans + 2, Math.floor(N / (a * b)) + 2, ans * 2],
      why: `Try y = 1, 2, 3, … and keep the ones where ${N} − ${b}y is a positive multiple of ${a}: ${sols.slice(0, 5).map(s => `(${s})`).join(', ')}${sols.length > 5 ? ', …' : ''}. That's ${ans} pairs.` };
  });
  add(5, 'Palindromes', () => {
    const L = pick([3, 4]), k = pick([3, 4, 6, 7, 9, 11, 12]); let ans = 0;
    for (let i = 10 ** (L - 1); i < 10 ** L; i++) { const s = String(i); if (s === s.split('').reverse().join('') && i % k === 0) ans++; }
    const total = 90;
    return { q: `A palindrome reads the same forwards and backwards, like ${L === 3 ? '343' : '2112'}. How many ${L}-digit palindromes are divisible by ${k}?`, a: ans,
      w: [Math.round(total / k), ans + 1, ans - 1, ans + 2, total - ans],
      why: L === 4 && k === 11 ? `Every 4-digit palindrome abba = 1001a + 110b = 11(91a + 10b), so all 90 of them work!` : `There are 90 ${L}-digit palindromes (${L === 3 ? 'aba' : 'abba'}: 9 choices for a, 10 for b). Testing each with the divisibility rule for ${k} leaves ${ans}.` };
  });
  add(5, 'Telescoping', () => {
    const n = R(5, 30);
    return { kind: 'frac', q: `What is ${fr(1, '1·2')} + ${fr(1, '2·3')} + ${fr(1, '3·4')} + … + ${fr(1, `${n}·${n + 1}`)}?`, a: [n, n + 1],
      w: [[1, n + 1], [n - 1, n], [n + 1, n + 2], [n, n + 2], [1, 2]], why: `Each term splits: ${fr(1, 'k(k+1)')} = ${fr(1, 'k')} − ${fr(1, 'k+1')}. Almost everything cancels, leaving 1 − ${fr(1, n + 1)} = ${fr(n, n + 1)}.` };
  });
  add(5, 'Dice probability', () => {
    if (Math.random() < 0.4) {
      const n = pick([2, 3]), tot = 6 ** n, no = 5 ** n;
      return { kind: 'frac', prob: true, q: `A fair die is rolled ${n} times. What is the probability that at least one roll is a 6?`, a: [tot - no, tot],
        w: [[n, 6], [1, 6], [no, tot], [tot - no - 1, tot], [n, 6 ** n]], why: `Use the complement: no 6 at all has probability (${fr(5, 6)})<sup>${n}</sup> = ${fr(no, tot)}. So 1 − ${fr(no, tot)} = ${frR(tot - no, tot)}.` };
    }
    const s = R(4, 10); let ways = 0; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let c = 1; c <= 6; c++) if (a + b + c === s) ways++;
    return { kind: 'frac', prob: true, q: `Three fair six-sided dice are rolled. What is the probability that the sum of the three numbers is ${s}?`, a: [ways, 216],
      w: [[ways + 1, 216], [ways - 1, 216], [1, 16], [ways, 108], [ways + 3, 216]], why: `There are 6³ = 216 outcomes. Counting ordered triples that add to ${s} gives ${ways}. So ${frR(ways, 216)}.` };
  });
  add(5, 'Square divisors', () => {
    const N = pick([72, 144, 180, 200, 288, 360, 400, 432, 576, 720, 900, 1800, 3600]), list = divs(N).filter(isSq), ans = list.length, f = pf(N);
    return { q: `How many of the positive divisors of ${N} are perfect squares?`, a: ans, w: [ans + 1, ans - 1, ans + 2, nd(N), Math.floor(Math.sqrt(N) / 2)],
      why: `${N} = ${pfStr(N)}. A square divisor uses even exponents: ${f.map(([p, e]) => `${Math.floor(e / 2) + 1} choice${Math.floor(e / 2) ? 's' : ''} for ${p}`).join(', ')}. Total ${ans}: ${list.join(', ')}.` };
  });
  add(5, 'Sum puzzles', () => {
    const n = R(20, 99), k = pick([7, 9, 11, 13]), S = n * (n + 1) / 2, ans = S % k;
    return { q: `What is the remainder when 1 + 2 + 3 + … + ${n} is divided by ${k}?`, a: ans, range: [0, k - 1], w: [(ans + 1) % k, (ans + 2) % k, n % k, (n + 1) % k, (ans + k - 1) % k],
      why: `1 + 2 + … + ${n} = ${n} × ${n + 1} ÷ 2 = ${S}. ${S} = ${k} × ${Math.floor(S / k)} + ${ans}.` };
  });
  add(5, 'Percent of area', () => {
    const [p, q] = pick([[20, 20], [10, 10], [25, 20], [50, 50], [30, 30], [20, 25], [40, 25], [25, 25]]);
    const change = (100 + p) * (100 - q) / 100 - 100; if (!Number.isInteger(change * 4)) return null;
    const ans = Math.abs(change);
    if (change === 0) return null;
    return { q: `A rectangle's length is increased by ${p}% and its width is decreased by ${q}%. By what percent does its area ${change < 0 ? 'decrease' : 'increase'}?`, a: ans, post: '%',
      w: [Math.abs(p - q), ans + 2, ans * 2, (p + q) / 2, ans + 1], why: `New area = ${(100 + p) / 100} × ${(100 - q) / 100} = ${(100 + p) * (100 - q) / 10000} of the old area: a ${ans}% ${change < 0 ? 'decrease' : 'increase'}.` };
  });

  // ---------- turning a generated problem into 5 choices ----------
  const fmtNum = v => Number.isInteger(v) ? v.toLocaleString('en-US') : String(+v.toFixed(2));
  function show(p, v) {
    if (p.kind === 'frac') { const [n, d] = red(v[0], v[1]); return d === 1 ? String(n) : fr(n, d); }
    if (p.kind === 'pi') return (v === 1 ? '' : fmtNum(v)) + 'π';
    return (p.pre || '') + fmtNum(v) + (p.post || '');
  }
  const val = (p, v) => p.kind === 'frac' ? v[0] / v[1] : v;
  function valid(p, v) {
    if (p.kind === 'frac') {
      if (!Array.isArray(v) || !Number.isInteger(v[0]) || !Number.isInteger(v[1]) || v[1] <= 0 || v[0] <= 0) return false;
      if (p.prob && v[0] > v[1]) return false;
      return true;
    }
    if (typeof v !== 'number' || !isFinite(v)) return false;
    if (v < 0) return false;
    if (Math.abs(v * 100 - Math.round(v * 100)) > 1e-7) return false;
    if (Number.isInteger(p.a) && !Number.isInteger(v)) return false;
    if (p.kind === 'pi' && v <= 0) return false;
    if (p.digits && (v > 9 || !Number.isInteger(v))) return false;
    if (p.range && (v < p.range[0] || v > p.range[1])) return false;
    if (v > 1e7) return false;
    return true;
  }
  function neighbors(p) {
    const a = p.a, out = [];
    if (p.kind === 'frac') {
      const [n, d] = red(a[0], a[1]);
      for (const c of [[n + 1, d], [n - 1, d], [n, d + 1], [n, d - 1], [n + 1, d + 1], [2 * n, d], [n, 2 * d], [n + 2, d], [n - 1, d - 1], [n + d, 2 * d], [n * 2 + 1, d * 2], [n, d + 2]]) out.push(c);
      return out;
    }
    if (p.digits || p.range) { const lo = p.range ? p.range[0] : 0, hi = p.range ? p.range[1] : 9; for (let i = lo; i <= hi; i++) out.push(i); return out; }
    const isInt = Number.isInteger(a), step = isInt ? Math.max(1, Math.round(Math.abs(a) / 16)) : 0.5;
    for (const m of [1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 8, -8, 10, -10]) out.push(a + m * step);
    if (step > 1) out.push(a + 1, a - 1, a + 2, a - 2, a + 10, a - 10);
    return out;
  }
  function finalize(p) {
    const keyA = show(p, p.a), av = val(p, p.a);
    const seen = new Set([keyA]);
    const uniq = list => { const out = []; for (const v of list) { if (!valid(p, v)) continue; const k = show(p, v); if (seen.has(k)) continue; seen.add(k); out.push(v); } return out; };
    const spec = uniq(shuffle((p.w || []).slice())), nb = uniq(shuffle(neighbors(p)));
    const sB = spec.filter(v => val(p, v) < av), sA = spec.filter(v => val(p, v) > av);
    const nB = nb.filter(v => val(p, v) < av), nA = nb.filter(v => val(p, v) > av);
    const poolB = sB.concat(nB), poolA = sA.concat(nA);
    // choose where the right answer sits (0 = A ... 4 = E), limited by what is available
    const options = [0, 1, 2, 3, 4].filter(t => poolB.length >= t && poolA.length >= 4 - t);
    if (!options.length) return null;
    const t = pick(options);
    const wrong = poolB.slice(0, t).concat(poolA.slice(0, 4 - t));
    const all = wrong.concat([p.a]).map(v => ({ v, html: show(p, v), n: val(p, v), ok: v === p.a }));
    all.sort((x, y) => x.n - y.n);
    return { q: p.q, choices: all.map(c => c.html), correct: all.findIndex(c => c.ok), why: p.why, answer: keyA };
  }

  // topics (optional): only use problem types whose topic is in this list (a stage's math focus)
  function make(level, topics) {
    level = Math.max(1, Math.min(5, level | 0));
    let pool = [];
    const want = Array.isArray(topics) && topics.length ? new Set(topics) : null;
    for (const g of G) { if (want && !want.has(g.topic)) continue; if (g.lv === level) pool.push(g, g, g); else if (g.lv === level - 1) pool.push(g); }
    if (want && !pool.length) for (const g of G) if (want.has(g.topic) && g.lv <= level + 1) pool.push(g);
    if (!pool.length) for (const g of G) { if (g.lv === level) pool.push(g, g, g); else if (g.lv === level - 1) pool.push(g); }
    for (let tries = 0; tries < 60; tries++) {
      const g = pick(pool);
      let p = null;
      try { p = g.f(); } catch (e) { p = null; }
      if (!p) continue;
      const out = finalize(p);
      if (out) { out.topic = g.topic; out.level = level; return out; }
    }
    // emergency fallback (never expected)
    const a = R(2, 9), b = R(2, 9);
    return finalize({ q: `What is ${a} × ${b}?`, a: a * b, w: [a + b, a * b + 1, a * b - 1, a * b + a] });
  }

  // ---------- gem rules for Number Grab ----------
  const TRI = new Set(); for (let k = 1; k * (k + 1) / 2 <= 300; k++) TRI.add(k * (k + 1) / 2);
  const FIB = new Set([1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233]);
  const facOf = N => ({ t: `FACTORS OF ${N}`, hint: `numbers that divide ${N} evenly`, f: n => N % n === 0, why: n => `${N} ÷ ${n} isn't a whole number` });
  const mulOf = k => ({ t: `MULTIPLES OF ${k}`, hint: `${k}, ${2 * k}, ${3 * k}, …`, f: n => n % k === 0, why: n => `${n} ÷ ${k} leaves remainder ${n % k}` });
  const RULES = {
    1: { max: 50, list: [
      { t: 'EVEN NUMBERS', hint: 'numbers that end in 0, 2, 4, 6, 8', f: n => n % 2 === 0, why: n => `${n} is odd` },
      { t: 'ODD NUMBERS', hint: 'numbers that end in 1, 3, 5, 7, 9', f: n => n % 2 === 1, why: n => `${n} is even` },
      mulOf(3), mulOf(4), mulOf(5), mulOf(10),
      { t: 'GREATER THAN 25', hint: 'anything bigger than 25', f: n => n > 25, why: n => `${n} is not more than 25` },
    ] },
    2: { max: 100, list: [mulOf(6), mulOf(7), mulOf(8), mulOf(9), facOf(24), facOf(36), facOf(48), facOf(60),
      { t: 'PERFECT SQUARES', hint: '1, 4, 9, 16, 25, …', f: isSq, why: n => `${n} is not a whole number squared` }] },
    3: { max: 120, list: [
      { t: 'PRIME NUMBERS', hint: 'exactly two divisors: 1 and itself', f: isPrime, why: n => n === 1 ? '1 is not prime' : `${n} = ${pf(n).map(([p, e]) => e > 1 ? p + '^' + e : p).join(' × ')}` },
      facOf(72), facOf(84), facOf(90), facOf(96), mulOf(12),
      { t: 'REMAINDER 1 WHEN ÷ 4', hint: '1, 5, 9, 13, …', f: n => n % 4 === 1, why: n => `${n} ÷ 4 leaves remainder ${n % 4}` },
      { t: 'REMAINDER 2 WHEN ÷ 5', hint: '2, 7, 12, 17, …', f: n => n % 5 === 2, why: n => `${n} ÷ 5 leaves remainder ${n % 5}` },
      { t: 'DIGIT SUM = 10', hint: 'like 19, 28, 37, 109', f: n => digitSum(n) === 10, why: n => `digits of ${n} add to ${digitSum(n)}` },
    ] },
    4: { max: 150, list: [
      { t: 'TRIANGULAR NUMBERS', hint: '1, 3, 6, 10, 15, …', f: n => TRI.has(n), why: n => `${n} isn't 1+2+3+…` },
      { t: 'MULTIPLES OF 4 AND 6', hint: 'divisible by both 4 and 6', f: n => n % 12 === 0, why: n => `${n} isn't a multiple of 12` },
      { t: 'NO COMMON FACTOR WITH 12', hint: 'GCD with 12 is 1', f: n => gcd(n, 12) === 1, why: n => `${n} shares factor ${gcd(n, 12)} with 12` },
      { t: 'REMAINDER 3 WHEN ÷ 7', hint: '3, 10, 17, 24, …', f: n => n % 7 === 3, why: n => `${n} ÷ 7 leaves remainder ${n % 7}` },
      facOf(120), facOf(144), facOf(180),
      { t: 'PRIMES ABOVE 50', hint: 'prime and bigger than 50', f: n => n > 50 && isPrime(n), why: n => n <= 50 ? `${n} is not above 50` : `${n} = ${pf(n).map(([p, e]) => e > 1 ? p + '^' + e : p).join(' × ')}` },
      { t: 'PERFECT CUBES', hint: '1, 8, 27, 64, 125', f: n => Math.round(Math.cbrt(n)) ** 3 === n, why: n => `${n} is not a whole number cubed` },
    ] },
    5: { max: 200, list: [
      { t: 'EXACTLY 4 DIVISORS', hint: 'like 6: 1, 2, 3, 6', f: n => nd(n) === 4, why: n => `${n} has ${nd(n)} divisors` },
      { t: 'ODD NUMBER OF DIVISORS', hint: 'think about which numbers these are…', f: n => nd(n) % 2 === 1, why: n => `${n} has ${nd(n)} divisors` },
      { t: 'FIBONACCI NUMBERS', hint: '1, 2, 3, 5, 8, 13, …', f: n => FIB.has(n), why: n => `${n} isn't in 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144` },
      { t: 'POWERS OF 2', hint: '1, 2, 4, 8, 16, …', f: n => (n & (n - 1)) === 0, why: n => `${n} has an odd factor` },
      { t: 'PRIMES ABOVE 100', hint: 'prime and bigger than 100', f: n => n > 100 && isPrime(n), why: n => n <= 100 ? `${n} is not above 100` : `${n} = ${pf(n).map(([p, e]) => e > 1 ? p + '^' + e : p).join(' × ')}` },
      facOf(360),
      { t: 'DIVISIBLE BY 3 OR 5, NOT BOTH', hint: 'multiples of 3 or 5, but not of 15', f: n => (n % 3 === 0) !== (n % 5 === 0), why: n => n % 15 === 0 ? `${n} is divisible by both` : `${n} is divisible by neither` },
      { t: 'DIGIT SUM IS PRIME', hint: 'add the digits, is it prime?', f: n => isPrime(digitSum(n)), why: n => `digits add to ${digitSum(n)}, not prime` },
    ] },
  };
  // names (optional): pick only from these rules (by their title), from any level
  function pickRule(level, prev, names) {
    let list, max;
    if (Array.isArray(names) && names.length) {
      list = []; for (const lv of [1, 2, 3, 4, 5]) for (const r of RULES[lv].list) if (names.includes(r.t)) list.push(Object.assign({ max: Math.max(RULES[lv].max, RULES[Math.max(1, Math.min(5, level))].max) }, r));
    }
    if (!list || !list.length) { const L = RULES[Math.max(1, Math.min(5, level))]; list = L.list.map(r => Object.assign({ max: L.max }, r)); }
    let r, guard = 0; do { r = pick(list); } while (prev && r.t === prev.t && list.length > 1 && guard++ < 20);
    return Object.assign({}, r);
  }
  const topics = () => Array.from(new Set(G.map(g => g.topic)));
  const ruleNames = () => [1, 2, 3, 4, 5].flatMap(lv => RULES[lv].list.map(r => r.t));
  function gemNumber(rule, wantGood) {
    const good = [], bad = [];
    for (let n = 1; n <= rule.max; n++) (rule.f(n) ? good : bad).push(n);
    if (wantGood && good.length) return pick(good);
    // make traps tempting: often near a good number
    if (!wantGood && good.length && Math.random() < 0.6) {
      const near = bad.filter(n => good.some(g => Math.abs(g - n) <= 2));
      if (near.length) return pick(near);
    }
    return pick(bad.length ? bad : good);
  }

  const LEVELS = [
    { n: 1, name: 'WARM-UP', desc: 'Quick warm-ups', color: '#5be35b', time: 35 },
    { n: 2, name: 'ROOKIE', desc: 'Two-step problems', color: '#38c6ff', time: 45 },
    { n: 3, name: 'PRO', desc: 'Tricky problems', color: '#ffd23f', time: 60 },
    { n: 4, name: 'ELITE', desc: 'Hard puzzles', color: '#ff8c42', time: 80 },
    { n: 5, name: 'LEGEND', desc: 'Toughest puzzles', color: '#ff5ad8', time: 100 },
  ];

  global.BBMath = { make, pickRule, gemNumber, LEVELS, topics, ruleNames, _G: G, _finalize: finalize };
})(typeof window !== 'undefined' ? window : globalThis);
