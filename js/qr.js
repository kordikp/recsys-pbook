// Malý QR generátor (byte mode, ECC M, verze 1–7) — žádné závislosti.
// Pro sběr ohlasu ve třídě: QR s odkazem #ohlas-… na plátně/slajdu.
// Implementace podle ISO/IEC 18004; vrací SVG string.

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x; GF_LOG[x] = i;
    x <<= 1; if (x & 0x100) x ^= 0x11D;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();
const gfMul = (a, b) => (a && b) ? GF_EXP[GF_LOG[a] + GF_LOG[b]] : 0;

function rsGenPoly(deg) {
  let poly = [1];
  for (let i = 0; i < deg; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j], GF_EXP[i]);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly.reverse();   // koeficienty od nejvyšší mocniny
}
function rsEncode(data, deg) {
  const gen = rsGenPoly(deg);
  const res = new Uint8Array(data.length + deg);
  res.set(data);
  for (let i = 0; i < data.length; i++) {
    const factor = res[i];
    if (!factor) continue;
    for (let j = 1; j < gen.length; j++) res[i + j] ^= gfMul(gen[j], factor);
  }
  return res.slice(data.length);
}

// verze 1–7, ECC M: [celkem codewords, ecc na blok, počet bloků]
const VER = {
  1: [26, 10, 1], 2: [44, 16, 1], 3: [70, 26, 1], 4: [100, 18, 2],
  5: [134, 24, 2], 6: [172, 16, 4], 7: [196, 18, 4],
};
const ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38] };

function bch(value, poly) {
  const deg = 31 - Math.clz32(poly);   // stupeň polynomu = počet ECC bitů
  let v = value << deg;
  while ((31 - Math.clz32(v)) >= deg && v) v ^= poly << ((31 - Math.clz32(v)) - deg);
  return v;
}

export function qrMatrix(text) {
  const bytes = new TextEncoder().encode(text);
  let version = 0;
  for (let v = 1; v <= 7; v++) {
    const [total, ecc, blocks] = VER[v];
    const dataCw = total - ecc * blocks;
    if (4 + 8 + bytes.length * 8 <= dataCw * 8) { version = v; break; }
  }
  if (!version) throw new Error('text too long for QR v7');
  const [total, eccLen, blockN] = VER[version];
  const dataCw = total - eccLen * blockN;

  // bitstream: mode 0100, délka 8 bitů, data, terminátor, padding
  const bits = [];
  const push = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  push(0b0100, 4);
  push(bytes.length, 8);
  for (const b of bytes) push(b, 8);
  push(0, Math.min(4, dataCw * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  const PAD = [0xEC, 0x11];
  for (let i = 0; data.length < dataCw; i++) data.push(PAD[i % 2]);

  // bloky (u v1–7/M jsou všechny stejně velké) + prokládání
  const per = dataCw / blockN;
  const dBlocks = [], eBlocks = [];
  for (let b = 0; b < blockN; b++) {
    const d = data.slice(b * per, (b + 1) * per);
    dBlocks.push(d); eBlocks.push(rsEncode(Uint8Array.from(d), eccLen));
  }
  const seq = [];
  for (let i = 0; i < per; i++) for (let b = 0; b < blockN; b++) seq.push(dBlocks[b][i]);
  for (let i = 0; i < eccLen; i++) for (let b = 0; b < blockN; b++) seq.push(eBlocks[b][i]);

  const size = 17 + version * 4;
  const M = Array.from({ length: size }, () => new Array(size).fill(null)); // null = volné pro data

  const set = (r, c, v) => { M[r][c] = v ? 1 : 0; };
  const finder = (r, c) => {
    for (let dr = -1; dr <= 7; dr++) for (let dc = -1; dc <= 7; dc++) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
      const on = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 &&
        (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
      set(rr, cc, on);
    }
  };
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
  for (let i = 8; i < size - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const ap = ALIGN[version];
  for (const r of ap) for (const c of ap) {
    // vynechává se JEN kolize s finderem (rohy); překrytí timing linky je legální
    const inFinder = (r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8);
    if (inFinder) continue;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }
  }
  set(size - 8, 8, 1);   // tmavý modul
  // rezervace formátu (zapíše se po výběru masky)
  const fmtPos = [];
  for (let i = 0; i <= 8; i++) { if (i !== 6) { fmtPos.push([8, i]); fmtPos.push([i, 8]); } }
  for (const [r, c] of fmtPos) if (M[r][c] === null) M[r][c] = 0;
  for (let i = 0; i < 8; i++) {
    if (M[8][size - 1 - i] === null) M[8][size - 1 - i] = 0;
    if (M[size - 1 - i][8] === null) M[size - 1 - i][8] = 0;
  }
  if (version >= 7) {
    const vinfo = (version << 12) | bch(version, 0x1F25);
    for (let i = 0; i < 18; i++) {
      const bit = (vinfo >> i) & 1;
      M[Math.floor(i / 3)][size - 11 + (i % 3)] = bit;
      M[size - 11 + (i % 3)][Math.floor(i / 3)] = bit;
    }
  }

  // umístění dat hadovitě zprava
  const dataPos = [];
  let up = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let k = 0; k < size; k++) {
      const r = up ? size - 1 - k : k;
      for (const c of [col, col - 1]) if (M[r][c] === null) dataPos.push([r, c]);
    }
    up = !up;
  }
  const allBits = [];
  for (const cw of seq) for (let i = 7; i >= 0; i--) allBits.push((cw >> i) & 1);
  while (allBits.length < dataPos.length) allBits.push(0);   // zbytkové bity

  const maskFn = [
    (r, c) => (r + c) % 2 === 0,
    (r, c) => r % 2 === 0,
    (r, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => (r * c) % 2 + (r * c) % 3 === 0,
    (r, c) => ((r * c) % 2 + (r * c) % 3) % 2 === 0,
    (r, c) => ((r + c) % 2 + (r * c) % 3) % 2 === 0,
  ];
  const writeFmt = (grid, mask) => {
    const f = (0b00 << 3) | mask;   // úroveň M = 00
    const val = ((f << 10) | bch(f, 0x537)) ^ 0x5412;
    const bit = i => (val >> (14 - i)) & 1;   // i = pozice v řetězci, MSB první
    let i = 0;
    for (let c = 0; c <= 8; c++) if (c !== 6) grid[8][c] = bit(i++);
    for (let r = 7; r >= 0; r--) if (r !== 6) grid[r][8] = bit(i++);
    i = 0;
    for (let r = size - 1; r >= size - 7; r--) grid[r][8] = bit(i++);
    for (let c = size - 8; c < size; c++) grid[8][c] = bit(i++);
  };
  const penalty = g => {
    let p = 0;
    const runs = line => {
      let run = 1;
      for (let i = 1; i <= line.length; i++) {
        if (i < line.length && line[i] === line[i - 1]) run++;
        else { if (run >= 5) p += 3 + run - 5; run = 1; }
      }
    };
    for (let r = 0; r < size; r++) runs(g[r]);
    for (let c = 0; c < size; c++) runs(g.map(row => row[c]));
    for (let r = 0; r < size - 1; r++) for (let c = 0; c < size - 1; c++) {
      if (g[r][c] === g[r][c + 1] && g[r][c] === g[r + 1][c] && g[r][c] === g[r + 1][c + 1]) p += 3;
    }
    const pat = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], rev = [...pat].reverse();
    const scan = line => {
      for (let i = 0; i + 11 <= line.length; i++) {
        let a = true, b = true;
        for (let j = 0; j < 11; j++) { if (line[i + j] !== pat[j]) a = false; if (line[i + j] !== rev[j]) b = false; }
        if (a || b) p += 40;
      }
    };
    for (let r = 0; r < size; r++) scan(g[r]);
    for (let c = 0; c < size; c++) scan(g.map(row => row[c]));
    let dark = 0;
    for (const row of g) for (const v of row) dark += v;
    p += Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5) * 10;
    return p;
  };

  let best = null, bestP = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const g = M.map(row => [...row]);
    dataPos.forEach(([r, c], i) => { g[r][c] = allBits[i] ^ (maskFn[mask](r, c) ? 1 : 0); });
    writeFmt(g, mask);
    const p = penalty(g);
    if (p < bestP) { bestP = p; best = g; }
  }
  return best;
}

export function qrSvg(text, module = 8, quiet = 4) {
  const m = qrMatrix(text);
  const size = m.length, dim = (size + quiet * 2) * module;
  let d = '';
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    if (m[r][c]) d += `M${(c + quiet) * module} ${(r + quiet) * module}h${module}v${module}h-${module}z`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges"><rect width="${dim}" height="${dim}" fill="#FFFFFF"/><path d="${d}" fill="#111111"/></svg>`;
}
