import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/* =====================================================================
 * BMO Portfolyo — 3D sahne (three.js)
 * Oda, kütük masa, BMO ve kasetler tamamen kodla üretilir; dış model yok.
 * ===================================================================== */

const CFG = Object.assign({
  githubUsername: '',
  name: 'PORTFOLYO',
  title: '',
  greeting: "Kim oyun oynamak ister? Bir kaset seç, BMO'ya tak!",
  maxProjects: 8,
  include: [],
  exclude: [],
  showForks: false,
  overrides: {},
}, window.BMO_CONFIG || {});

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TOUCH = matchMedia('(hover: none)').matches;
const T = (ms) => (reduceMotion ? Math.min(ms, 200) : ms);

const body = document.body;
const sceneCanvas = $('#scene');
const scr = $('#screen-ui');
const dialogEl = $('.dialog');
const dlgText = $('#dlg-text');
const dlgHint = $('#dlg-hint');
const cartList = $('#cart-list');
const ghForm = $('#gh-form');
const ghInput = $('#gh-input');

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* depolama kapalı olabilir */ } },
};

const LANG_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', 'C#': '#178600', 'C++': '#f34b7d',
  C: '#555555', Java: '#b07219', HTML: '#e34c26', CSS: '#563d7c', SCSS: '#c6538c', Go: '#00ADD8',
  Rust: '#dea584', PHP: '#4F5D95', Ruby: '#701516', Swift: '#F05138', Kotlin: '#A97BFF', Dart: '#00B4AB',
  Vue: '#41b883', Svelte: '#ff3e00', Shell: '#89e051', GDScript: '#355570', Lua: '#000080',
  'Jupyter Notebook': '#DA5B0B', ShaderLab: '#222c37', GLSL: '#5686a5', HLSL: '#aace60',
};
const LANG_SHORT = {
  JavaScript: 'JS', TypeScript: 'TS', Python: 'PY', 'C#': 'C#', 'C++': 'C++', C: 'C', Java: 'JV',
  HTML: '</>', CSS: 'CSS', SCSS: 'SCS', Go: 'GO', Rust: 'RS', PHP: 'PHP', Ruby: 'RB', Swift: 'SW',
  Kotlin: 'KT', Dart: 'DT', Vue: 'VUE', Svelte: 'SV', Shell: '$_', GDScript: 'GD', Lua: 'LUA',
  'Jupyter Notebook': 'NB', ShaderLab: 'SH', GLSL: 'GL', HLSL: 'HL',
};

function hash(str) {
  let h = 2166136261;
  for (const ch of str) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ================= Ses (WebAudio, dosya yok) ================= */
const Sfx = (() => {
  let ctx = null;
  let master = null;
  let unlocked = false;
  let muted = store.get('bmo-muted') === '1';

  function ensure() {
    if (muted || !unlocked) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.7;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(f, dur, { type = 'square', vol = 0.04, at = 0, to = null } = {}) {
    const c = ensure();
    if (!c) return;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.03);
  }
  function noise(dur, vol = 0.08, at = 0, freq = 1800) {
    const c = ensure();
    if (!c) return;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filt = c.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = freq;
    const g = c.createGain();
    g.gain.value = vol;
    src.connect(filt).connect(g).connect(master);
    src.start(c.currentTime + at);
  }
  return {
    get muted() { return muted; },
    unlock() { unlocked = true; },
    toggle() {
      muted = !muted;
      store.set('bmo-muted', muted ? '1' : '0');
      if (!muted) this.select();
      return muted;
    },
    hover() { tone(1250, 0.035, { vol: 0.016 }); },
    select() { [660, 880, 1175].forEach((f, i) => tone(f, 0.07, { at: i * 0.055, vol: 0.03 })); },
    whoosh() { noise(0.4, 0.05, 0, 900); tone(280, 0.35, { type: 'sine', to: 820, vol: 0.025 }); },
    insert() {
      noise(0.07, 0.2, 0, 2400);
      tone(150, 0.13, { type: 'triangle', vol: 0.16, to: 70 });
      tone(95, 0.08, { vol: 0.035, at: 0.05 });
    },
    boot() {
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.1, { at: 0.05 + i * 0.075, vol: 0.03 }));
      tone(1568, 0.3, { at: 0.45, vol: 0.025, type: 'triangle' });
    },
    off() { tone(900, 0.25, { type: 'sine', to: 60, vol: 0.04 }); },
    eject() { tone(170, 0.09, { type: 'triangle', vol: 0.13, to: 260 }); noise(0.05, 0.12, 0.02, 2400); },
    giggle() { [988, 1175, 988, 1319].forEach((f, i) => tone(f, 0.06, { at: i * 0.07, vol: 0.025 })); },
    blip() { tone(1400 + Math.random() * 400, 0.02, { vol: 0.007 }); },
  };
})();

/* ================= Toz parçacıkları (2D katman) ================= */
function startDust() {
  const cv = $('#dust');
  const ctx = cv.getContext('2d');
  let w = 0, h = 0, parts = [], raf = 0;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = innerWidth; h = innerHeight;
    cv.width = w * dpr; cv.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = reduceMotion ? 0 : Math.round((w * h) / 26000);
    parts = Array.from({ length: n }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      r: Math.random() * 1.5 + 0.4,
      vx: (Math.random() - 0.5) * 0.12, vy: -Math.random() * 0.14 - 0.03,
      a: Math.random() * 0.45 + 0.12, p: Math.random() * 6.28,
    }));
  }
  function frame(t) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#ffe9b8';
    for (const q of parts) {
      q.x += q.vx + Math.sin(t / 3000 + q.p) * 0.08;
      q.y += q.vy;
      if (q.y < -5) { q.y = h + 5; q.x = Math.random() * w; }
      if (q.x < -5) q.x = w + 5;
      if (q.x > w + 5) q.x = -5;
      ctx.globalAlpha = q.a * (0.6 + 0.4 * Math.sin(t / 900 + q.p));
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.r, 0, 6.283);
      ctx.fill();
    }
    raf = requestAnimationFrame(frame);
  }
  resize();
  addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(raf);
    if (!document.hidden) raf = requestAnimationFrame(frame);
  });
  raf = requestAnimationFrame(frame);
}

/* ================= Veri ================= */
// GitHub bağlanana kadar gösterilen boş kasetler
const placeholders = () => Array.from({ length: CFG.maxProjects }, (_, i) => ({
  placeholder: true, n: i + 1, name: `kaset-${i + 1}`, title: `KASET ${i + 1}`,
  description: 'Boş kaset. GitHub hesabını bağla, projelerin buraya gelsin.',
  language: '', stars: 0, forks: 0, topics: [], updated: '', url: '', homepage: '', image: '', cover: '',
}));
function withOverrides(p, user) {
  // config.js'teki özelleştirmeler sadece config'teki hesabın repolarına uygulanır
  const own = user && user.toLowerCase() === String(CFG.githubUsername || '').trim().toLowerCase();
  const o = (own && (CFG.overrides || {})[p.name]) || {};
  return {
    ...p,
    title: o.title || p.title,
    description: o.description || p.description,
    image: o.image || p.image,
    cover: o.cover || p.cover || '',
    homepage: o.demo || p.homepage,
  };
}

async function loadProjects(user) {
  const key = 'bmo-repos:' + user.toLowerCase();
  let repos = null;
  try {
    const c = JSON.parse(store.get(key) || 'null');
    if (c && Date.now() - c.t < 30 * 60e3) repos = c.d;
  } catch { /* bozuk önbellek */ }

  if (!repos) {
    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(user)}/repos?per_page=100&sort=pushed`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) { const e = new Error('GitHub ' + res.status); e.status = res.status; throw e; }
    repos = (await res.json()).map((r) => ({
      name: r.name, full_name: r.full_name, html_url: r.html_url, description: r.description,
      homepage: r.homepage, language: r.language, stargazers_count: r.stargazers_count,
      forks_count: r.forks_count, pushed_at: r.pushed_at, topics: r.topics, fork: r.fork,
    }));
    store.set(key, JSON.stringify({ t: Date.now(), d: repos }));
  }

  const exclude = new Set((CFG.exclude || []).map((s) => s.toLowerCase()));
  let list = repos.filter((r) => !exclude.has(r.name.toLowerCase()) && r.name.toLowerCase() !== user.toLowerCase());
  if (CFG.include && CFG.include.length) {
    const byName = new Map(list.map((r) => [r.name.toLowerCase(), r]));
    list = CFG.include.map((n) => byName.get(String(n).toLowerCase())).filter(Boolean);
  } else {
    if (!CFG.showForks) list = list.filter((r) => !r.fork);
    list.sort((a, b) => (b.stargazers_count - a.stargazers_count) || (new Date(b.pushed_at) - new Date(a.pushed_at)));
  }
  const projects = list.slice(0, CFG.maxProjects).map((r) => withOverrides({
    name: r.name,
    title: r.name,
    description: r.description || 'Bu proje için henüz açıklama yazılmamış.',
    url: r.html_url,
    homepage: r.homepage || '',
    language: r.language || '',
    stars: r.stargazers_count,
    forks: r.forks_count,
    updated: r.pushed_at,
    topics: r.topics || [],
    image: `https://opengraph.githubassets.com/1/${r.full_name}`,
    cover: '',
  }, user));
  return { projects, mode: 'github' };
}

/* ================= three.js temel ================= */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: sceneCanvas, antialias: true, powerPreference: 'high-performance' });
} catch (err) {
  renderer = null;
}

const scene = new THREE.Scene();
scene.background = new THREE.Color('#140b06');
scene.fog = new THREE.Fog('#120a05', 11, 27);
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.05, 80);

const FLOOR_Y = -1.7;
const ROOM_C = new THREE.Vector3(0, 0, 2.5);
const ROOM_R = 11.5;

// Çizgi film gölgelendirmesi için basamaklı ışık rampası
const GRAD = (() => {
  const steps = [0.7, 1];
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => { const c = Math.round(v * 255); data.set([c, c, c, 255], i * 4); });
  const t = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: GRAD, ...extra });

// Ters kabuk (inverted hull) kontur
function outlineMaterial(th, color = '#1a110b') {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = (s) => {
    s.uniforms.olThickness = { value: th };
    s.vertexShader = 'uniform float olThickness;\n' + s.vertexShader.replace(
      '#include <begin_vertex>',
      'vec3 transformed = position + normal * olThickness;',
    );
  };
  m.customProgramCacheKey = () => 'outline' + th;
  return m;
}
function addOutline(mesh, th = 0.015, color) {
  const o = new THREE.Mesh(mesh.geometry, outlineMaterial(th, color));
  o.raycast = () => {};
  mesh.add(o);
  return o;
}
function mk(geo, mat, { cast = true, receive = true, outline = 0 } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = receive;
  if (outline) addOutline(m, outline);
  return m;
}

function canvasTex(w, h, draw, { repeat = null } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (renderer) t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.userData.canvas = c;
  return t;
}

function rrShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
// ShapeGeometry UV'lerini 0..1 aralığına getirir (doku tam otursun)
function normalizeUV(geo) {
  geo.computeBoundingBox();
  const b = geo.boundingBox;
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (pos.getX(i) - b.min.x) / (b.max.x - b.min.x), (pos.getY(i) - b.min.y) / (b.max.y - b.min.y));
  }
  uv.needsUpdate = true;
  return geo;
}
const extrude = (shape, depth, bevel = 0.01) => new THREE.ExtrudeGeometry(shape, {
  depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 10,
});
const glowTex = canvasTex(128, 128, (g, w) => {
  const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,.5)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, w);
});

/* ================= Dokular ================= */
function woodPlanks(g, w, h, { vertical = true, base = [92, 58, 32], plank = 80, R = rng(3) } = {}) {
  const len = vertical ? w : h;
  for (let p = 0; p < len; p += plank) {
    const v = 0.82 + R() * 0.3;
    g.fillStyle = `rgb(${base[0] * v | 0},${base[1] * v | 0},${base[2] * v | 0})`;
    if (vertical) g.fillRect(p, 0, plank, h); else g.fillRect(0, p, w, plank);
    // damarlar
    g.strokeStyle = 'rgba(30,14,5,.28)';
    for (let k = 0; k < 7; k++) {
      g.lineWidth = 1 + R() * 2;
      g.beginPath();
      const o = p + R() * plank;
      if (vertical) {
        g.moveTo(o, 0);
        for (let y = 0; y <= h; y += 32) g.lineTo(o + Math.sin(y / 60 + k) * 3 + (R() - 0.5) * 2, y);
      } else {
        g.moveTo(0, o);
        for (let x = 0; x <= w; x += 32) g.lineTo(x, o + Math.sin(x / 70 + k) * 3 + (R() - 0.5) * 2);
      }
      g.stroke();
    }
    // budak
    if (R() < 0.5) {
      const kx = vertical ? p + plank / 2 : R() * w, ky = vertical ? R() * h : p + plank / 2;
      g.strokeStyle = 'rgba(35,16,6,.6)';
      g.lineWidth = 3;
      g.beginPath(); g.ellipse(kx, ky, vertical ? 8 : 16, vertical ? 16 : 8, 0, 0, 7); g.stroke();
      g.fillStyle = 'rgba(35,16,6,.45)';
      g.beginPath(); g.ellipse(kx, ky, vertical ? 3 : 6, vertical ? 6 : 3, 0, 0, 7); g.fill();
    }
    // tahta arası boşluk + kenar ışığı
    g.fillStyle = 'rgba(18,8,3,.95)';
    if (vertical) g.fillRect(p, 0, 4, h); else g.fillRect(0, p, w, 4);
    g.fillStyle = 'rgba(255,215,160,.12)';
    if (vertical) g.fillRect(p + 4, 0, 2, h); else g.fillRect(0, p + 4, w, 2);
  }
}

const wallTex = canvasTex(1024, 1024, (g, w, h) => {
  woodPlanks(g, w, h, { vertical: true, base: [92, 66, 44], plank: 96, R: rng(11) });
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, 'rgba(10,4,2,.75)');
  grd.addColorStop(0.45, 'rgba(10,4,2,.1)');
  grd.addColorStop(0.85, 'rgba(10,4,2,0)');
  grd.addColorStop(1, 'rgba(10,4,2,.35)');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
}, { repeat: [7, 1] });

const floorTex = canvasTex(1024, 1024, (g, w, h) => {
  woodPlanks(g, w, h, { vertical: false, base: [118, 86, 58], plank: 88, R: rng(5) });
  const R = rng(9);
  g.fillStyle = 'rgba(18,8,3,.85)';
  for (let y = 0; y < h; y += 88) for (let k = 0; k < 2; k++) g.fillRect(R() * w, y, 4, 88);
}, { repeat: [3, 3] });

const barkTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#4a2c17';
  g.fillRect(0, 0, w, h);
  const R = rng(21);
  for (let i = 0; i < 70; i++) {
    const x = R() * w;
    g.strokeStyle = R() < 0.7 ? `rgba(20,9,3,${0.4 + R() * 0.4})` : `rgba(160,110,70,${0.15 + R() * 0.2})`;
    g.lineWidth = 2 + R() * 7;
    g.beginPath();
    g.moveTo(x, 0);
    for (let y = 0; y <= h; y += 24) g.lineTo(x + Math.sin(y / 40 + i) * 6 + (R() - 0.5) * 4, y);
    g.stroke();
  }
}, { repeat: [4, 1] });

const ringTex = canvasTex(1024, 1024, (g, w) => {
  const c = w / 2;
  g.fillStyle = '#3d2414';
  g.fillRect(0, 0, w, w);
  const R = rng(4);
  g.fillStyle = '#5b391f';
  g.beginPath(); g.arc(c, c, c * 0.995, 0, 7); g.fill();
  const grd = g.createRadialGradient(c * 1.08, c * 0.9, 10, c, c, c * 0.93);
  grd.addColorStop(0, '#e6bb80');
  grd.addColorStop(0.7, '#cf9f62');
  grd.addColorStop(1, '#a8743d');
  g.fillStyle = grd;
  g.beginPath(); g.arc(c, c, c * 0.93, 0, 7); g.fill();
  for (let r = 18; r < c * 0.92; r += 14 + R() * 18) {
    g.strokeStyle = `rgba(120,72,32,${0.35 + R() * 0.3})`;
    g.lineWidth = 1.5 + R() * 2.5;
    g.beginPath();
    for (let a = 0; a <= 6.3; a += 0.05) {
      const rr = r + Math.sin(a * 3 + r) * 2.5 + Math.sin(a * 7) * 1.2;
      const x = c - 14 + Math.cos(a) * rr, y = c + 8 + Math.sin(a) * rr;
      if (a === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
    g.stroke();
  }
  g.strokeStyle = 'rgba(70,38,14,.7)';
  g.lineCap = 'round';
  for (const [a, l, wd] of [[0.3, 0.75, 3], [2.4, 0.5, 2.2], [4.1, 0.62, 2.6]]) {
    g.lineWidth = wd;
    g.beginPath();
    g.moveTo(c - 14, c + 8);
    g.lineTo(c - 14 + Math.cos(a) * c * l * 0.5, c + 8 + Math.sin(a) * c * l * 0.5 + 6);
    g.lineTo(c - 14 + Math.cos(a + 0.08) * c * l, c + 8 + Math.sin(a + 0.08) * c * l);
    g.stroke();
  }
  g.fillStyle = '#7a4a22';
  g.beginPath(); g.ellipse(c - 14, c + 8, 10, 8, 0, 0, 7); g.fill();
});

const rugTex = canvasTex(1024, 1024, (g, w) => {
  const c = w / 2;
  const cols = ['#5d6b3c', '#7a6a44', '#4e5a34', '#8a7650'];
  for (let r = c, i = 0; r > 20; r -= 26, i++) {
    g.fillStyle = cols[i % cols.length];
    g.beginPath(); g.arc(c, c, r, 0, 7); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.18)';
    g.lineWidth = 3;
    g.setLineDash([10, 8]);
    g.beginPath(); g.arc(c, c, r - 13, 0, 7); g.stroke();
    g.setLineDash([]);
  }
});

const skyTex = canvasTex(512, 512, (g, w, h) => {
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, '#5fb8f0');
  grd.addColorStop(1, '#eaf8ff');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,.9)';
  for (const [x, y, s] of [[150, 170, 1], [360, 230, 0.7], [250, 120, 0.6]]) {
    g.beginPath();
    g.ellipse(x, y, 70 * s, 24 * s, 0, 0, 7);
    g.ellipse(x + 30 * s, y - 16 * s, 40 * s, 26 * s, 0, 0, 7);
    g.fill();
  }
  const greens = ['#3b8a37', '#4ea544', '#2f7430', '#62bb52'];
  const R = rng(2);
  for (let i = 0; i < 26; i++) {
    g.fillStyle = greens[i % greens.length];
    g.beginPath();
    g.arc(R() * w, h - R() * 150, 30 + R() * 50, 0, 7);
    g.fill();
  }
});

/* ================= Oda ================= */
function buildRoom() {
  const room = new THREE.Group();
  scene.add(room);

  const floor = mk(new THREE.CircleGeometry(ROOM_R, 72), toon('#ffffff', { map: floorTex }), { cast: false });
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(ROOM_C.x, FLOOR_Y, ROOM_C.z);
  room.add(floor);

  // duvar: ağacın içi gibi silindir
  const wallH = 11;
  const wall = mk(new THREE.CylinderGeometry(ROOM_R, ROOM_R, wallH, 72, 1, true), toon('#ffffff', { map: wallTex, side: THREE.BackSide }), { cast: false });
  wall.position.set(ROOM_C.x, FLOOR_Y + wallH / 2, ROOM_C.z);
  room.add(wall);

  const ceil = new THREE.Mesh(new THREE.CircleGeometry(ROOM_R, 48), new THREE.MeshBasicMaterial({ color: '#0d0703' }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(ROOM_C.x, FLOOR_Y + wallH, ROOM_C.z);
  room.add(ceil);

  // duvar üzerinde konum: açı 0 = kameranın tam karşısı
  const onWall = (ang, y, inset = 0) => new THREE.Vector3(
    ROOM_C.x + Math.sin(ang) * (ROOM_R - inset), y, ROOM_C.z - Math.cos(ang) * (ROOM_R - inset),
  );
  const faceCenter = (obj) => obj.lookAt(ROOM_C.x, obj.position.y, ROOM_C.z);

  const skirt = mk(new THREE.CylinderGeometry(ROOM_R - 0.05, ROOM_R - 0.05, 0.25, 72, 1, true), toon('#2b170b', { side: THREE.BackSide }), { cast: false });
  skirt.position.set(ROOM_C.x, FLOOR_Y + 0.12, ROOM_C.z);
  room.add(skirt);
  // ağacın iç yapısı: yerden çıkıp duvar boyunca yükselen, tavana kıvrılan dallar
  const ribMat = toon('#4a2e1a');
  for (const [a, lean] of [[-1.2, 0.08], [-0.8, -0.05], [-0.15, 0.05], [0.8, -0.06], [1.18, 0.07]]) {
    const pts = [
      onWall(a - lean, FLOOR_Y - 0.1, 0.75),
      onWall(a, FLOOR_Y + 1.2, 0.3),
      onWall(a + lean, FLOOR_Y + 4.5, 0.25),
      onWall(a + lean * 2, FLOOR_Y + 8.2, 1.6),
      onWall(a + lean * 3, FLOOR_Y + 9.8, 3.8),
    ];
    room.add(mk(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.24, 10, false), ribMat, { cast: false, outline: 0.03 }));
    const foot = mk(new THREE.SphereGeometry(0.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), ribMat, { cast: false, outline: 0.03 });
    foot.scale.set(1, 0.4, 1);
    foot.position.copy(onWall(a - lean, FLOOR_Y, 0.8));
    room.add(foot);
  }

  // üst kat: duvar boyunca yarım daire balkon + korkuluk
  const BAL_Y = 2.95, a0b = -1.35, a1b = 1.35, rOut = ROOM_R - 0.05, rIn = ROOM_R - 1.5;
  const polar = (ang, r) => [Math.sin(ang) * r, Math.cos(ang) * r];
  const balShape = new THREE.Shape();
  balShape.moveTo(...polar(a0b, rOut));
  for (let i = 1; i <= 48; i++) balShape.lineTo(...polar(lerp(a0b, a1b, i / 48), rOut));
  for (let i = 48; i >= 0; i--) balShape.lineTo(...polar(lerp(a0b, a1b, i / 48), rIn));
  const balGeo = new THREE.ExtrudeGeometry(balShape, { depth: 0.2, bevelEnabled: false, curveSegments: 1 });
  balGeo.rotateX(-Math.PI / 2);
  const balcony = mk(balGeo, toon('#5c3d22'), { cast: false });
  balcony.position.set(ROOM_C.x, BAL_Y, ROOM_C.z);
  room.add(balcony);
  const postMat = toon('#6b4426');
  for (let ang = a0b + 0.04; ang <= a1b; ang += 0.13) {
    const post = mk(new THREE.BoxGeometry(0.09, 0.95, 0.09), postMat, { cast: false, outline: 0.012 });
    post.position.copy(onWall(ang, BAL_Y + 0.2 + 0.47, 1.45));
    faceCenter(post);
    room.add(post);
  }
  for (const [h, r] of [[1.12, 0.06], [0.62, 0.04]]) {
    const railGeo = new THREE.TorusGeometry(rIn + 0.05, r, 6, 96, a1b - a0b);
    railGeo.rotateZ(Math.PI / 2 - a1b);
    railGeo.rotateX(-Math.PI / 2);
    const rail = mk(railGeo, postMat, { cast: false, outline: 0.012 });
    rail.position.set(ROOM_C.x, BAL_Y + h, ROOM_C.z);
    room.add(rail);
  }
  // balkondaki eşyalar
  for (const [ang, s] of [[-0.95, 0.75], [-0.85, 0.5], [0.95, 0.7]]) {
    const cr = mk(new RoundedBoxGeometry(s, s, s, 2, 0.03), toon('#7a5230'), { cast: false, outline: 0.015 });
    cr.position.copy(onWall(ang, BAL_Y + 0.2 + s / 2, 0.75));
    faceCenter(cr);
    cr.rotateY(0.3);
    room.add(cr);
  }

  // yuvarlak pencere (arka sol)
  const win = new THREE.Group();
  win.position.copy(onWall(-0.5, 1.6, 0.08));
  faceCenter(win);
  room.add(win);
  const sky = new THREE.Mesh(new THREE.CircleGeometry(1.15, 48), new THREE.MeshBasicMaterial({ map: skyTex, fog: false }));
  win.add(sky);
  const frame = mk(new THREE.TorusGeometry(1.18, 0.14, 12, 48), toon('#4a2a14'), { cast: false, outline: 0.02 });
  win.add(frame);
  const barMat = toon('#3a2010');
  const barV = mk(new THREE.BoxGeometry(0.12, 2.3, 0.1), barMat, { cast: false });
  const barH = mk(new THREE.BoxGeometry(2.3, 0.12, 0.1), barMat, { cast: false });
  barV.position.z = barH.position.z = 0.04;
  win.add(barV, barH);
  const winGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffe2a8', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  winGlow.scale.set(6, 6, 1);
  winGlow.position.z = 0.2;
  win.add(winGlow);

  // pencereden süzülen ışık huzmesi
  room.updateMatrixWorld(true);
  const winPos = win.getWorldPosition(new THREE.Vector3());
  const rayTo = new THREE.Vector3(0.6, FLOOR_Y, 0.8);
  const rayDir = rayTo.clone().sub(winPos);
  const rayLen = rayDir.length();
  const rayTexA = canvasTex(64, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, 'rgba(255,240,200,0)');
    grd.addColorStop(0.15, 'rgba(255,240,200,.5)');
    grd.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  });
  const ray = new THREE.Mesh(
    new THREE.CylinderGeometry(1.0, 2.2, rayLen, 24, 1, true),
    new THREE.MeshBasicMaterial({ map: rayTexA, transparent: true, opacity: 0.09, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }),
  );
  ray.position.copy(winPos).addScaledVector(rayDir, 0.5);
  ray.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), rayDir.clone().normalize());
  room.add(ray);
  room.userData.ray = ray;

  // kitap rafı (arka sağ)
  const shelfGroup = new THREE.Group();
  shelfGroup.position.copy(onWall(0.42, 0, 0.35));
  faceCenter(shelfGroup);
  room.add(shelfGroup);
  const plankMat = toon('#5a3519');
  const bookCols = ['#9c3b2e', '#3a6f86', '#c9a75a', '#5d7d48', '#6d4f86', '#b9774a', '#3d4f6b', '#8a4a3a', '#42786d'];
  const R = rng(17);
  for (const sy of [0.85, 1.9]) {
    const plank = mk(new THREE.BoxGeometry(3.2, 0.1, 0.55), plankMat, { outline: 0.015 });
    plank.position.set(0, sy, 0.27);
    shelfGroup.add(plank);
    let x = -1.5;
    while (x < 1.45) {
      const bw = 0.08 + R() * 0.1, bh = 0.42 + R() * 0.3;
      const book = mk(new THREE.BoxGeometry(bw, bh, 0.38), toon(bookCols[Math.floor(R() * bookCols.length)]), { outline: 0.01 });
      book.position.set(x + bw / 2, sy + 0.05 + bh / 2, 0.3);
      if (R() < 0.08) { book.rotation.z = 0.25; book.position.x += 0.06; }
      shelfGroup.add(book);
      x += bw + 0.012 + (R() < 0.1 ? 0.25 : 0);
    }
  }
  const pot = mk(new THREE.CylinderGeometry(0.18, 0.13, 0.28, 16), toon('#c4623a'), { outline: 0.012 });
  pot.position.set(1.3, 2.09, 0.3);
  shelfGroup.add(pot);
  for (let i = 0; i < 5; i++) {
    const leaf = mk(new THREE.SphereGeometry(0.12, 10, 8), toon('#4f9a45'), { outline: 0.01 });
    leaf.scale.set(0.6, 1.5, 0.6);
    leaf.position.set(1.3 + Math.sin(i * 1.3) * 0.12, 2.4 + (i % 2) * 0.08, 0.3 + Math.cos(i * 1.3) * 0.1);
    leaf.rotation.z = Math.sin(i * 1.3) * 0.5;
    shelfGroup.add(leaf);
  }

  // yeşil yuvarlak kanepe (sağ arka)
  const couch = new THREE.Group();
  couch.position.set(4.6, FLOOR_Y, -3.6);
  couch.rotation.y = -0.5;
  room.add(couch);
  const cBase = mk(new THREE.CylinderGeometry(1.45, 1.35, 0.45, 40), toon('#6f7f2c'), { outline: 0.02 });
  cBase.position.y = 0.23;
  const cTop = mk(new THREE.CylinderGeometry(1.5, 1.5, 0.32, 40), toon('#b4bf55'), { outline: 0.02 });
  cTop.position.y = 0.6;
  couch.add(cBase, cTop);
  for (const [x, rz] of [[-0.7, 0.15], [0.7, -0.15]]) {
    const bol = mk(new THREE.CapsuleGeometry(0.28, 1.0, 8, 16), toon('#86ad74'), { outline: 0.02 });
    bol.rotation.z = Math.PI / 2 + rz;
    bol.position.set(x, 1.0, -1.05);
    couch.add(bol);
  }
  const mag = mk(new THREE.BoxGeometry(0.6, 0.05, 0.45), toon('#3f6a3a'), { outline: 0.01 });
  mag.position.set(-0.2, 0.79, 0.3);
  mag.rotation.y = 0.4;
  couch.add(mag);

  // merdiven (sol)
  const ladder = new THREE.Group();
  ladder.position.copy(onWall(-1.0, FLOOR_Y, 1.1));
  faceCenter(ladder);
  ladder.rotateX(-0.12);
  room.add(ladder);
  const railMat = toon('#7a4d27');
  for (const x of [-0.45, 0.45]) {
    const rail = mk(new THREE.BoxGeometry(0.12, 5.8, 0.12), railMat, { outline: 0.015 });
    rail.position.set(x, 2.9, 0);
    ladder.add(rail);
  }
  for (let y = 0.5; y < 5.6; y += 0.55) {
    const rung = mk(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 8), railMat, { outline: 0.012 });
    rung.rotation.z = Math.PI / 2;
    rung.position.set(0, y, 0);
    ladder.add(rung);
  }

  // sandık + fıçı (sol)
  const crateTex = floorTex.clone();
  crateTex.repeat.set(0.6, 0.6);
  crateTex.needsUpdate = true;
  const crate = mk(new RoundedBoxGeometry(1.0, 0.9, 1.0, 2, 0.04), toon('#ffffff', { map: crateTex }), { outline: 0.02 });
  crate.position.set(-4.4, FLOOR_Y + 0.45, -1.6);
  crate.rotation.y = 0.5;
  room.add(crate);
  const barrel = mk(new THREE.CylinderGeometry(0.5, 0.5, 1.15, 24), toon('#8a5a2e'), { outline: 0.02 });
  barrel.position.set(-5.1, FLOOR_Y + 0.575, -3.0);
  room.add(barrel);
  for (const y of [0.25, 0.9]) {
    const hoop = mk(new THREE.TorusGeometry(0.505, 0.03, 6, 32), toon('#3a3a3a'), { cast: false });
    hoop.rotation.x = Math.PI / 2;
    hoop.position.set(-5.1, FLOOR_Y + y, -3.0);
    room.add(hoop);
  }

  // halı
  const rug = mk(new THREE.CircleGeometry(2.4, 64), toon('#ffffff', { map: rugTex }), { cast: false });
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, FLOOR_Y + 0.01, 0.2);
  room.add(rug);

  // asılı fenerler (sıcak ışık)
  const bulbs = [];
  const metal = toon('#2c2722');
  for (const [x, y, z, ph] of [[-2.9, 3.4, -2.6, 0], [2.7, 3.7, -3.4, 2.1], [0.2, 4.3, -6.4, 4.2]]) {
    const lan = new THREE.Group();
    lan.position.set(x, y, z);
    room.add(lan);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 6, 6), metal);
    rope.position.y = 3.25;
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.32, 16), new THREE.MeshBasicMaterial({ color: '#ffd38a', fog: false }));
    const capT = mk(new THREE.ConeGeometry(0.22, 0.16, 16), metal, { cast: false, outline: 0.012 });
    capT.position.y = 0.24;
    const capB = mk(new THREE.CylinderGeometry(0.19, 0.16, 0.06, 16), metal, { cast: false, outline: 0.012 });
    capB.position.y = -0.19;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffb35a', transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    halo.scale.set(2.4, 2.4, 1);
    const light = new THREE.PointLight('#ffb35a', 6, 9, 2);
    lan.add(rope, glass, capT, capB, halo, light);
    bulbs.push({ halo, light, phase: ph, speed: 2.3 });
  }
  room.userData.bulbs = bulbs;

  // hazine yığını + sandık (arka sol)
  const gold = toon('#e2aa2c');
  const hoard = new THREE.Group();
  hoard.position.set(-3.4, FLOOR_Y, -5.0);
  room.add(hoard);
  const heap = mk(new THREE.SphereGeometry(1.25, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), gold, { outline: 0.02 });
  heap.scale.set(1, 0.5, 0.8);
  hoard.add(heap);
  const coinGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.025, 14);
  const coinMat = toon('#f3c443');
  const RC = rng(31);
  for (let i = 0; i < 70; i++) {
    const a = RC() * Math.PI * 2, r = Math.sqrt(RC()) * 1.5;
    const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.85;
    const hy = Math.max(0, 1 - (x * x) / 1.56 - (z * z) / 1.0);
    const coin = mk(coinGeo, coinMat, { cast: false, outline: 0.008 });
    coin.position.set(x, Math.sqrt(hy) * 0.62 + 0.02, z);
    coin.rotation.set((RC() - 0.5) * 1.4, RC() * 3, (RC() - 0.5) * 1.4);
    hoard.add(coin);
  }
  const gemCols = ['#e8395f', '#3fa7e0', '#5fd35a', '#b06ae0'];
  for (let i = 0; i < 6; i++) {
    const gem = mk(new THREE.OctahedronGeometry(0.11), toon(gemCols[i % 4]), { outline: 0.008 });
    const a = i * 1.1, r = 0.4 + (i % 3) * 0.3;
    gem.position.set(Math.cos(a) * r, 0.45 - r * 0.2, Math.sin(a) * r * 0.7);
    gem.rotation.set(i, i * 0.7, 0);
    hoard.add(gem);
  }
  const chest = new THREE.Group();
  chest.position.set(1.4, 0, 0.6);
  chest.rotation.y = -0.6;
  hoard.add(chest);
  const wood = toon('#7a4a24');
  const box = mk(new THREE.BoxGeometry(1.0, 0.55, 0.62), wood, { outline: 0.015 });
  box.position.y = 0.275;
  const lid = mk(new THREE.CylinderGeometry(0.31, 0.31, 1.0, 20, 1, false, 0, Math.PI), wood, { outline: 0.015 });
  lid.rotation.z = Math.PI / 2;
  lid.position.y = 0.55;
  chest.add(box, lid);
  for (const x of [-0.38, 0.38]) {
    const band = mk(new THREE.BoxGeometry(0.08, 0.57, 0.64), gold, { cast: false });
    band.position.set(x, 0.275, 0);
    chest.add(band);
  }

  // Finn'in altın kılıcı (sandığa yaslı)
  const sword = new THREE.Group();
  sword.position.set(-4.0, FLOOR_Y, -1.05);
  sword.rotation.set(0, 0.4, 0.28);
  room.add(sword);
  const blade = mk(new THREE.BoxGeometry(0.1, 1.15, 0.025), toon('#f0c64a'), { outline: 0.01 });
  blade.position.y = 0.85;
  const guard = mk(new THREE.BoxGeometry(0.36, 0.06, 0.06), toon('#c58b22'), { outline: 0.01 });
  guard.position.y = 0.26;
  const grip = mk(new THREE.CylinderGeometry(0.035, 0.035, 0.24, 8), toon('#5a3018'), { outline: 0.01 });
  grip.position.y = 0.1;
  sword.add(blade, guard, grip);

  // yerde kitap yığınları
  const RB = rng(44);
  const bookTone = ['#9c3b2e', '#3a6f86', '#c9a75a', '#5d7d48', '#6d4f86', '#8a4a3a'];
  for (const [bx, bz, n] of [[2.7, -0.6, 5], [3.2, -1.3, 3], [-2.6, -2.2, 4]]) {
    let y = FLOOR_Y;
    for (let k = 0; k < n; k++) {
      const h = 0.09 + RB() * 0.05;
      const bk = mk(new THREE.BoxGeometry(0.62 - RB() * 0.12, h, 0.45 - RB() * 0.08), toon(bookTone[Math.floor(RB() * bookTone.length)]), { outline: 0.01 });
      bk.position.set(bx + (RB() - 0.5) * 0.06, y + h / 2, bz + (RB() - 0.5) * 0.06);
      bk.rotation.y = (RB() - 0.5) * 0.6;
      room.add(bk);
      y += h;
    }
  }

  return room;
}

/* ================= Kütük masa ================= */
const TABLE_TOP_Y = 0;
function buildTable() {
  const g = new THREE.Group();
  scene.add(g);
  const slabH = 0.16, topR = 1.6;
  const barkMat = toon('#ffffff', { map: barkTex });
  const slab = mk(new THREE.CylinderGeometry(topR, topR * 0.97, slabH, 64), [barkMat, toon('#ffffff', { map: ringTex }), barkMat]);
  slab.position.y = TABLE_TOP_Y - slabH / 2;
  addOutline(slab, 0.025);
  g.add(slab);

  const stumpH = TABLE_TOP_Y - slabH - FLOOR_Y;
  const stump = mk(new THREE.CylinderGeometry(0.78, 1.0, stumpH, 40), barkMat, { outline: 0.025 });
  stump.position.y = FLOOR_Y + stumpH / 2;
  g.add(stump);

  const rootMat = toon('#3e2414');
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const root = mk(new THREE.ConeGeometry(0.28, 1.1, 10), rootMat, { outline: 0.02 });
    root.scale.set(1, 1, 0.55);
    root.position.set(Math.cos(a) * 0.95, FLOOR_Y + 0.18, Math.sin(a) * 0.95);
    root.rotation.set(0, -a, 0);
    root.rotateZ(-Math.PI / 2 + 0.35);
    g.add(root);
  }
  return g;
}

/* ================= BMO ================= */
const BMO_W = 1.0, BMO_H = 1.36, BMO_D = 0.7;
const FRONT = BMO_D / 2;
const SCREEN = { w: 0.8, h: 0.56, y: 1.03 };
const SLOT_LOCAL = new THREE.Vector3(-0.065, 0.66, FRONT);

const face = { mood: 'idle', look: new THREE.Vector2(), lookTarget: new THREE.Vector2(), blink: 0, dirty: true };
const faceTex = canvasTex(640, 460, () => {});
const faceCanvas = faceTex.userData.canvas;
const fg = faceCanvas.getContext('2d');

function drawFace(now) {
  const w = faceCanvas.width, h = faceCanvas.height;
  const ink = '#10201b';
  if (face.mood === 'off') {
    fg.fillStyle = '#16302a';
    fg.fillRect(0, 0, w, h);
  } else {
    const grd = fg.createRadialGradient(w * 0.45, h * 0.4, 20, w * 0.5, h * 0.5, w * 0.7);
    grd.addColorStop(0, '#e2f6d6');
    grd.addColorStop(0.75, '#d0eec3');
    grd.addColorStop(1, '#bfe2b1');
    fg.fillStyle = grd;
    fg.fillRect(0, 0, w, h);
    const ex = face.look.x, ey = face.look.y;
    const lx = w * 0.37 + ex, rx = w * 0.63 + ex, eyY = h * 0.44 + ey;
    fg.fillStyle = ink;
    fg.strokeStyle = ink;
    fg.lineCap = 'round';
    fg.lineJoin = 'round';
    if (face.mood === 'idle') {
      const ry = face.blink > 0 ? 2 : 12;
      for (const x of [lx, rx]) { fg.beginPath(); fg.ellipse(x, eyY, 8.5, ry, 0, 0, 7); fg.fill(); }
      fg.lineWidth = 6;
      fg.beginPath();
      fg.moveTo(w * 0.42 + ex * 0.6, h * 0.6 + ey * 0.6);
      fg.quadraticCurveTo(w * 0.5 + ex * 0.6, h * 0.71 + ey * 0.6, w * 0.58 + ex * 0.6, h * 0.6 + ey * 0.6);
      fg.stroke();
    } else if (face.mood === 'happy') {
      fg.lineWidth = 11;
      for (const x of [lx, rx]) {
        fg.beginPath(); fg.moveTo(x - 22, eyY + 10); fg.lineTo(x, eyY - 12); fg.lineTo(x + 22, eyY + 10); fg.stroke();
      }
      fg.lineWidth = 8;
      fg.fillStyle = '#3b9b4e';
      fg.beginPath();
      fg.moveTo(w * 0.4 + ex * 0.6, h * 0.6);
      fg.quadraticCurveTo(w * 0.5 + ex * 0.6, h * 0.9, w * 0.6 + ex * 0.6, h * 0.6);
      fg.closePath();
      fg.fill();
      fg.stroke();
      fg.fillStyle = '#7fd98a';
      fg.beginPath(); fg.ellipse(w * 0.5 + ex * 0.6, h * 0.73, 22, 10, 0, 0, 7); fg.fill();
      fg.fillStyle = 'rgba(240,138,165,.5)';
      for (const x of [w * 0.25, w * 0.75]) { fg.beginPath(); fg.ellipse(x + ex, h * 0.6, 24, 13, 0, 0, 7); fg.fill(); }
    } else if (face.mood === 'loading') {
      for (let i = 0; i < 3; i++) {
        const b = Math.sin(now / 130 - i * 0.9);
        fg.globalAlpha = 0.4 + 0.6 * Math.max(0, b);
        fg.fillRect(w * 0.5 - 70 + i * 50, h * 0.48 - 16 - Math.max(0, b) * 22, 32, 32);
      }
      fg.globalAlpha = 1;
    }
  }
  fg.fillStyle = 'rgba(0,40,20,.05)';
  for (let y = 0; y < h; y += 4) fg.fillRect(0, y, w, 1.5);
  const gl = fg.createLinearGradient(0, 0, w * 0.6, h * 0.8);
  gl.addColorStop(0, 'rgba(255,255,255,.28)');
  gl.addColorStop(0.45, 'rgba(255,255,255,0)');
  fg.fillStyle = gl;
  fg.fillRect(0, 0, w, h);
  faceTex.needsUpdate = true;
}

function setMood(m) { face.mood = m; face.dirty = true; }

function buildBMO() {
  const root = new THREE.Group(); // masanın üstünde, sol yanı görünecek şekilde dönük
  const g = new THREE.Group(); // takma sırasındaki küçük sarsılma için
  root.add(g);
  root.position.set(0, TABLE_TOP_Y, -0.15);
  root.rotation.y = 0.42;
  scene.add(root);

  const OL = '#16201f';
  const bodyMesh = mk(new RoundedBoxGeometry(BMO_W, BMO_H, BMO_D, 5, 0.05), toon('#79b4a5'));
  addOutline(bodyMesh, 0.012, OL);
  bodyMesh.position.y = BMO_H / 2;
  g.add(bodyMesh);

  // ekran: ince koyu çerçeve + yüz dokusu
  const scrBorder = new THREE.Mesh(new THREE.ShapeGeometry(rrShape(SCREEN.w + 0.032, SCREEN.h + 0.032, 0.05)), new THREE.MeshBasicMaterial({ color: OL }));
  scrBorder.position.set(0, SCREEN.y, FRONT + 0.002);
  const screenMesh = new THREE.Mesh(normalizeUV(new THREE.ShapeGeometry(rrShape(SCREEN.w, SCREEN.h, 0.038), 8)), new THREE.MeshBasicMaterial({ map: faceTex, fog: false }));
  screenMesh.position.set(0, SCREEN.y, FRONT + 0.004);
  g.add(scrBorder, screenMesh);

  // kaset yuvası: ekranın altında uzun ince yarık
  const slot = new THREE.Mesh(new THREE.ShapeGeometry(rrShape(0.53, 0.042, 0.021)), new THREE.MeshBasicMaterial({ color: '#1c2928' }));
  slot.position.set(SLOT_LOCAL.x, SLOT_LOCAL.y, FRONT + 0.003);
  g.add(slot);

  // sağdaki küçük mavi nokta
  const dotOut = new THREE.Mesh(new THREE.CircleGeometry(0.034, 24), new THREE.MeshBasicMaterial({ color: OL }));
  dotOut.position.set(0.33, 0.61, FRONT + 0.002);
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.026, 24), new THREE.MeshBasicMaterial({ color: '#25399a' }));
  dot.position.set(0.33, 0.61, FRONT + 0.003);
  g.add(dotOut, dot);

  // tuşlar: gövdeye yakın, düz
  const flat = (shape, color, x, y) => {
    const m = mk(extrude(shape, 0.012, 0.005), toon(color), { cast: false });
    addOutline(m, 0.006, OL);
    m.position.set(x, y, FRONT - 0.004);
    g.add(m);
  };
  const cross = new THREE.Shape();
  const a = 0.1, t = 0.034;
  cross.moveTo(-t, a); cross.lineTo(t, a); cross.lineTo(t, t); cross.lineTo(a, t); cross.lineTo(a, -t);
  cross.lineTo(t, -t); cross.lineTo(t, -a); cross.lineTo(-t, -a); cross.lineTo(-t, -t); cross.lineTo(-a, -t);
  cross.lineTo(-a, t); cross.lineTo(-t, t); cross.closePath();
  flat(cross, '#f1cf3c', -0.22, 0.42);

  const tri = new THREE.Shape();
  tri.moveTo(0, 0.068); tri.lineTo(0.074, -0.054); tri.lineTo(-0.074, -0.054); tri.closePath();
  flat(tri, '#5fc2e6', 0.07, 0.5);

  const disc = (r) => new THREE.Shape().absarc(0, 0, r, 0, Math.PI * 2, false);
  flat(disc(0.056), '#5fd25a', 0.33, 0.49);
  flat(disc(0.1), '#e8395f', 0.12, 0.28);
  flat(rrShape(0.13, 0.034, 0.017), '#2a3eac', -0.3, 0.15);
  flat(rrShape(0.13, 0.034, 0.017), '#2a3eac', -0.13, 0.15);

  // sol yan yüz: hoparlör delikleri + büyük BMO yazısı
  const sideTex = canvasTex(256, 576, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#1d3530';
    for (let r = 0; r < 3; r++) for (let k = 0; k < 2; k++) {
      c.beginPath(); c.ellipse(w * 0.2 + k * 40, 52 + r * 36 + k * 6, 8, 10, 0, 0, 7); c.fill();
    }
    c.save();
    c.translate(w * 0.58, h * 0.36);
    c.rotate(Math.PI / 2);
    c.fillStyle = '#1b2b55';
    c.font = '800 150px Rubik, "Arial Black", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('BMO', 0, 0);
    c.restore();
  });
  const side = new THREE.Mesh(new THREE.PlaneGeometry(BMO_D * 0.88, BMO_H * 0.9), toon('#ffffff', { map: sideTex, transparent: true, alphaTest: 0.5 }));
  side.rotation.y = -Math.PI / 2;
  side.position.set(-BMO_W / 2 - 0.002, BMO_H / 2, 0);
  g.add(side);

  // ince gri-mavi kollar ve bacaklar
  const limbMat = toon('#7ca6b6');
  const tube = (pts, r) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    const m = mk(new THREE.TubeGeometry(curve, 40, r, 10, false), limbMat);
    addOutline(m, 0.007, OL);
    g.add(m);
    return curve;
  };
  const nub = (curve, r, sx, sy, sz) => {
    const m = mk(new THREE.SphereGeometry(r, 16, 12), limbMat);
    addOutline(m, 0.007, OL);
    m.scale.set(sx, sy, sz);
    m.position.copy(curve.getPoint(1));
    g.add(m);
  };
  for (const s of [-1, 1]) {
    // kollar gövdenin yanından, ortanın biraz altından çıkıp masaya iner
    const arm = tube([[0.48 * s, 0.5, 0.06], [0.6 * s, 0.41, 0.12], [0.63 * s, 0.22, 0.2], [0.58 * s, 0.05, 0.3]], 0.024);
    nub(arm, 0.04, 1, 0.65, 1.3);
    // bacaklar alttan öne doğru uzanır, ayaklar dışa döner
    const leg = tube([[0.17 * s, 0.06, 0.2], [0.2 * s, 0.03, 0.42], [0.28 * s, 0.03, 0.66], [0.36 * s, 0.035, 0.8]], 0.026);
    nub(leg, 0.045, 1.25, 0.75, 1.1);
  }

  return { root, g, body: bodyMesh, screen: screenMesh };
}

/* ================= Kasetler ================= */
const CART = { w: 0.62, h: 0.72, d: 0.1 };
const IN_SLOT_SCALE = 0.76; // yuvada ~0.47 birim genişlik
const IN_SLOT_THIN = 0.45; // yuvadaki ince yarığa sığsın diye kalınlık çarpanı

const glyphFor = (p) => LANG_SHORT[p.language] ||
  p.name.split(/[-_\s.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
const artColors = (p) => {
  const hue = hash(p.name) % 360;
  return [`hsl(${hue} 72% 58%)`, `hsl(${(hue + 50) % 360} 68% 36%)`];
};
const artCss = (p) => { const [a, b] = artColors(p); return `linear-gradient(135deg, ${a}, ${b})`; };

function drawLabel(c, p, img) {
  const w = c.width, h = c.height;
  const g = c.getContext('2d');
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#f5efe0';
  g.beginPath(); g.roundRect(0, 0, w, h, 26); g.fill();
  const artH = h * 0.6;
  g.save();
  g.beginPath(); g.roundRect(14, 14, w - 28, artH, 18); g.clip();
  if (img) {
    const s = Math.max((w - 28) / img.width, artH / img.height);
    g.drawImage(img, 14 + (w - 28 - img.width * s) / 2, 14 + (artH - img.height * s) / 2, img.width * s, img.height * s);
  } else {
    const [c1, c2] = p.placeholder ? ['#a7acb4', '#626772'] : artColors(p);
    const grd = g.createLinearGradient(0, 0, w, artH);
    grd.addColorStop(0, c1);
    grd.addColorStop(1, c2);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, artH + 20);
    g.fillStyle = 'rgba(255,255,255,.22)';
    for (let y = 30; y < artH + 20; y += 38) for (let x = 30; x < w; x += 38) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,.2)';
    g.save(); g.translate(w / 2, artH * 0.82); g.rotate(-0.14); g.fillRect(-w, -18, w * 2, 36); g.restore();
    g.font = '700 150px "Pixelify Sans", monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(0,0,0,.3)';
    const glyph = p.placeholder ? String(p.n) : glyphFor(p);
    g.fillText(glyph, w / 2 + 8, artH * 0.5 + 8);
    g.fillStyle = '#fff';
    g.fillText(glyph, w / 2, artH * 0.5);
  }
  g.restore();
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#1d1d1d';
  let size = 54;
  g.font = `800 ${size}px Rubik, sans-serif`;
  while (g.measureText(p.title).width > w - 44 && size > 34) { size -= 2; g.font = `800 ${size}px Rubik, sans-serif`; }
  let title = p.title;
  while (g.measureText(title).width > w - 44 && title.length > 3) title = title.slice(0, -2) + '…';
  g.fillText(title, 22, artH + 14 + size + 6);
  g.font = '600 30px Rubik, sans-serif';
  const my = h - 24;
  if (p.language) {
    g.fillStyle = LANG_COLORS[p.language] || '#9aa';
    g.beginPath(); g.arc(34, my - 10, 11, 0, 7); g.fill();
    g.fillStyle = '#5b5b5b';
    g.fillText(p.language, 54, my);
  }
  g.fillStyle = '#5b5b5b';
  if (p.placeholder) { g.fillText('Boş kaset', 22, my); return; }
  g.textAlign = 'right';
  g.fillText(`★ ${p.stars ?? 0}`, w - 22, my);
}

function buildCart(p, i) {
  const group = new THREE.Group();
  const bodyMesh = mk(new RoundedBoxGeometry(CART.w, CART.h, CART.d, 4, 0.035), toon('#b9bcc6'), { cast: false });
  const outline = addOutline(bodyMesh, 0.014);
  group.add(bodyMesh);

  const ridgeMat = toon('#8e919c');
  for (let k = 0; k < 6; k++) {
    const r = mk(new THREE.BoxGeometry(0.025, 0.07, 0.012), ridgeMat, { cast: false });
    r.position.set(-0.2 + k * 0.06, 0.29, CART.d / 2 + 0.002);
    group.add(r);
  }
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 512; labelCanvas.height = 500;
  drawLabel(labelCanvas, p, null);
  const labelTex = new THREE.CanvasTexture(labelCanvas);
  labelTex.colorSpace = THREE.SRGBColorSpace;
  labelTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.49), toon('#ffffff', { map: labelTex }));
  label.receiveShadow = true;
  label.position.set(0, -0.03, CART.d / 2 + 0.003);
  group.add(label);
  const arrowShape = new THREE.Shape();
  arrowShape.moveTo(-0.05, 0); arrowShape.lineTo(0.05, 0); arrowShape.lineTo(0, -0.04); arrowShape.closePath();
  const arrow = new THREE.Mesh(new THREE.ShapeGeometry(arrowShape), new THREE.MeshBasicMaterial({ color: '#7b7e88' }));
  arrow.position.set(0, -0.3, CART.d / 2 + 0.002);
  group.add(arrow);

  if (p.cover) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { drawLabel(labelCanvas, p, img); labelTex.needsUpdate = true; };
    img.src = p.cover;
  }

  group.traverse((o) => { o.userData.cartIndex = i; });
  scene.add(group);
  const R = rng(hash(p.name));
  return {
    p, i, group, outline,
    mode: 'rest', // rest | anim
    rest: new THREE.Vector3(), restScale: 0.6,
    tilt: (R() - 0.5) * 0.3, phase: R() * 6.28, speed: 0.9 + R() * 0.5,
    hover: 0,
  };
}

/* ================= Sahne kurulumu ================= */
let room, bmo;
let carts = [];

function setupScene() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene.add(new THREE.HemisphereLight('#fff6ea', '#4a3a2c', 0.95));
  const key = new THREE.DirectionalLight('#fffaf2', 2.8);
  key.position.set(4.5, 7, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 25 });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  const rim = new THREE.DirectionalLight('#bfe0ff', 0.5);
  rim.position.set(5, 4, -9);
  scene.add(rim);
  const warm = new THREE.PointLight('#ffb36b', 30, 14, 2);
  warm.position.set(0, 3.6, -5.5);
  scene.add(warm);

  room = buildRoom();
  buildTable();
  bmo = buildBMO();
}

/* ================= Kamera ================= */
const cam = { mode: 'home', offset: new THREE.Vector3(), pointer: new THREE.Vector2(), target: new THREE.Vector3() };

function screenPose() {
  bmo.root.updateMatrixWorld(true);
  const center = new THREE.Vector3(0, SCREEN.y, FRONT).applyMatrix4(bmo.g.matrixWorld);
  const q = bmo.root.getWorldQuaternion(new THREE.Quaternion());
  const n = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  // ekran görüntünün tamamını kaplasın
  const hFit = (SCREEN.h / 2) / tanH;
  const wFit = (SCREEN.w / 2) / (tanH * camera.aspect);
  const dist = Math.min(hFit, wFit) * 0.9;
  return { pos: center.clone().addScaledVector(n, dist), target: center };
}

/* ================= Yerleşim ================= */
const L = { home: { pos: new THREE.Vector3(), target: new THREE.Vector3() }, dir: new THREE.Vector3() };

function bmoScreenRect() {
  const pts = [];
  const box = new THREE.Box3().setFromObject(bmo.body);
  const add = (x, y, z) => pts.push(new THREE.Vector3(x, y, z).project(camera));
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) add(x, y, z);
  add(-1.6, TABLE_TOP_Y, 0); add(1.6, TABLE_TOP_Y, 0); add(0, TABLE_TOP_Y, 1.6);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of pts) {
    const sx = (p.x + 1) / 2 * L.vw, sy = (1 - p.y) / 2 * L.vh;
    x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
  }
  return { x0, x1, y0, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

function layout() {
  const vw = innerWidth, vh = innerHeight;
  const portrait = vw < vh * 0.95;
  Object.assign(L, { vw, vh, portrait });
  renderer.setSize(vw, vh, false);
  camera.aspect = vw / vh;
  camera.fov = portrait ? 50 : 38;
  camera.updateProjectionMatrix();

  const dlgH = Math.max(dialogEl.offsetHeight || 0, portrait ? 140 : 120);
  const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const needH = portrait ? 4.4 : 3.6;
  const needW = portrait ? 3.7 : 6.4;
  const dist = Math.max(needH / 2 / tanH, needW / 2 / (tanH * camera.aspect));
  L.dir.set(0.06, 0.24, 1).normalize();
  const target = new THREE.Vector3(0, 0.62, 0);
  // diyalog kutusu sahnenin altını kapatmasın diye bakış noktasını aşağı kaydır
  target.y -= dlgH * 0.45 * ((2 * dist * tanH) / vh);
  L.home.target.copy(target);
  L.home.pos.copy(target).addScaledVector(L.dir, dist);

  // kasetler ana kamera açısına göre yerleşir
  camera.position.copy(L.home.pos);
  camera.lookAt(L.home.target);
  camera.updateMatrixWorld();
  bmo.root.updateMatrixWorld(true);
  layoutCarts(dlgH);

  if (cam.mode === 'home') {
    camera.position.copy(L.home.pos).add(cam.offset);
    camera.lookAt(L.home.target);
  } else if (cam.mode === 'screen') {
    const sp = screenPose();
    camera.position.copy(sp.pos);
    camera.lookAt(sp.target);
  }
}

function layoutCarts(dlgH) {
  const n = carts.length;
  if (!n) return;
  const { vw, vh, portrait } = L;
  const rect = bmoScreenRect();
  let cw = clamp(Math.min(vw, vh) * 0.11, 64, 120);
  if (n > 8) cw *= Math.sqrt(8 / n);
  const ratio = CART.h / CART.w;
  // kasetler üst bardaki isim ve GitHub kutusunun altında kalsın
  const topLimit = Math.max(portrait ? 100 : 90, $('.hud-top').getBoundingClientRect().bottom + 16);
  const bottomLimit = vh - dlgH - 30;
  const left = Math.ceil(n / 2), right = n - left;
  const J = rng(99);
  const leftList = [], rightList = [];

  if (portrait) {
    const span = bottomLimit - topLimit;
    const per = Math.max(left, 1);
    if (span / per < cw * ratio * 1.1) cw = Math.max(44, span / per / 1.1 / ratio);
    const ch = cw * ratio;
    const colX = [cw / 2 + 14, vw - cw / 2 - 14];
    const col = (cnt, side, out) => {
      for (let i = 0; i < cnt; i++) {
        const t = cnt === 1 ? 0.5 : i / (cnt - 1);
        out.push({ x: colX[side] + (J() - 0.5) * 8, y: topLimit + ch / 2 + t * (span - ch) });
      }
    };
    col(left, 0, leftList);
    col(right, 1, rightList);
    leftList.reverse(); // saat yönü sırası
  } else {
    const ch = cw * ratio;
    const cx = rect.cx, cy = rect.cy;
    const halfW = (rect.x1 - rect.x0) / 2;
    const ryTop = Math.max(40, Math.min((rect.y1 - rect.y0) * 0.75, cy - topLimit - ch / 2));
    const ryBot = Math.max(30, Math.min((rect.y1 - rect.y0) * 0.6, bottomLimit - cy - ch / 2));
    let rx = Math.max(halfW * 0.8 + cw * 0.8, Math.min(vw * 0.36, halfW * 1.6));
    rx = Math.min(rx, (vw / 2 - cw / 2 - 12) / 1.1);
    const spanFor = (c) => (c <= 1 ? 0 : Math.min(130, 40 + c * 18));
    const point = (deg) => {
      const a = (deg * Math.PI) / 180;
      const sn = Math.sin(a);
      return { x: cx + rx * Math.cos(a) * (sn > 0 ? 1.1 : 1) + (J() - 0.5) * 16, y: cy + (sn < 0 ? ryTop : ryBot) * sn + (J() - 0.5) * 12 };
    };
    const sr = spanFor(right), sl = spanFor(left);
    for (let i = 0; i < right; i++) rightList.push(point(right === 1 ? 0 : -sr / 2 + (i * sr) / (right - 1)));
    for (let i = 0; i < left; i++) leftList.push(point(left === 1 ? 180 : 180 - sl / 2 + (i * sl) / (left - 1)));
  }
  const slots = leftList.length ? [leftList[leftList.length - 1], ...rightList, ...leftList.slice(0, -1)] : rightList;

  // ekran noktasını BMO'nun önündeki, kameraya dönük bir düzleme indir
  const planePoint = L.home.target.clone().addScaledVector(L.dir, 1.4);
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(L.dir, planePoint);
  const ray = new THREE.Raycaster();
  const d = camera.position.distanceTo(planePoint);
  const worldPerPx = (2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / vh;
  const scale = (cw * worldPerPx) / CART.w;
  carts.forEach((c, i) => {
    const s = slots[i];
    ray.setFromCamera(new THREE.Vector2((s.x / vw) * 2 - 1, -(s.y / vh) * 2 + 1), camera);
    ray.ray.intersectPlane(plane, c.rest);
    c.restScale = scale;
  });
}

/* ================= Tween ================= */
const ease = {
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  linear: (t) => t,
};
const tweens = [];
function tween(ms, fn, e = ease.inOut) {
  const dur = T(ms);
  return new Promise((res) => tweens.push({ t0: performance.now(), dur, fn, e, res }));
}
function runTweens(now) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    const p = tw.dur <= 0 ? 1 : clamp((now - tw.t0) / tw.dur, 0, 1);
    tw.fn(tw.e(p), p);
    if (p >= 1) { tweens.splice(i, 1); tw.res(); }
  }
}
function bez(a, b, c, d, t, out) {
  const it = 1 - t;
  return out.set(0, 0, 0)
    .addScaledVector(a, it * it * it).addScaledVector(b, 3 * it * it * t)
    .addScaledVector(c, 3 * it * t * t).addScaledVector(d, t * t * t);
}

/* ================= Konuşma kutusu ================= */
let sayToken = 0;
async function say(text, hint) {
  const tok = ++sayToken;
  if (hint !== undefined) dlgHint.textContent = hint;
  if (reduceMotion) { dlgText.textContent = text; return; }
  dlgText.textContent = '';
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    if (tok !== sayToken) return;
    dlgText.textContent += chars[i];
    if (i % 3 === 0 && chars[i] !== ' ') Sfx.blip();
    await wait('.!?'.includes(chars[i]) ? 110 : 20);
  }
}
const DEFAULT_HINT = TOUCH ? "Bir kasete dokun, BMO'ya taksın!" : '← → seç · Enter / tıkla: tak · Esc: çıkar';

/* ================= Ekran içeriği ================= */
const rtf = new Intl.RelativeTimeFormat('tr', { numeric: 'auto' });
function ago(d) {
  if (!d) return '';
  const s = (new Date(d) - Date.now()) / 1000;
  for (const [u, sec] of [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]]) {
    if (Math.abs(s) >= sec) return rtf.format(Math.round(s / sec), u);
  }
  return 'az önce';
}

function fillScreen(c) {
  const p = c.p;
  $('#d-slot').textContent = `BMO://KASET-${String(c.i + 1).padStart(2, '0')}`;
  const lang = $('#d-lang');
  lang.textContent = '';
  if (p.language) {
    const dot = document.createElement('i');
    dot.style.background = LANG_COLORS[p.language] || '#9aa';
    lang.append(dot, p.language);
  }
  $('#d-title').textContent = p.title;
  $('#d-desc').textContent = '';

  const stats = $('#d-stats');
  stats.textContent = '';
  const items = [`★ ${p.stars ?? 0} yıldız`, `⑂ ${p.forks ?? 0} fork`];
  if (p.updated) items.push(`⟳ ${ago(p.updated)}`);
  for (const t of items) { const li = document.createElement('li'); li.textContent = t; stats.append(li); }

  const topics = $('#d-topics');
  topics.textContent = '';
  for (const t of (p.topics || []).slice(0, 6)) { const sp = document.createElement('span'); sp.textContent = '#' + t; topics.append(sp); }

  $('#btn-go').href = p.url;
  const demo = $('#btn-demo');
  demo.hidden = !p.homepage;
  if (p.homepage) demo.href = p.homepage;

  $('#d-fallback').style.setProperty('--art', artCss(p));
  $('#d-fallback-text').textContent = p.title;
  const img = $('#d-img');
  img.classList.remove('loaded');
  img.onload = () => img.classList.add('loaded');
  img.onerror = () => img.classList.remove('loaded');
  if (p.image) img.src = p.image; else img.removeAttribute('src');
}

let descToken = 0;
async function typeDesc(text) {
  const el = $('#d-desc');
  const tok = ++descToken;
  if (reduceMotion) { el.textContent = text; return; }
  el.classList.add('typing');
  const chars = [...text];
  const step = Math.max(1, Math.ceil(chars.length / 80));
  for (let i = 0; i < chars.length; i += step) {
    if (tok !== descToken) return;
    el.textContent = chars.slice(0, i + step).join('');
    if (i % 2 === 0) Sfx.blip();
    await wait(16);
  }
  el.classList.remove('typing');
}

/* ================= Seçim ================= */
let state = 'loading'; // loading | idle | busy | open
let selected = -1;
let current = null;

function select(i, { speak = true } = {}) {
  if (selected === i) return;
  selected = i;
  carts.forEach((c, j) => c.outline.material.color.set(j === i ? '#ffd84a' : '#120c08'));
  if (i < 0) { setMood('idle'); return; }
  const c = carts[i];
  setMood('happy');
  if (speak && c.p.placeholder) {
    say(` — bu kaset henüz boş!`, 'Sağ üstten GitHub kullanıcı adını yaz, projelerin kaset olsun');
  } else if (speak) {
    const desc = c.p.description.length > 90 ? c.p.description.slice(0, 88).trimEnd() + '…' : c.p.description;
    say(`${c.p.title} — ${desc}`, `${c.p.language || 'Proje'} · ★ ${c.p.stars ?? 0} · ${TOUCH ? 'Dokun' : 'Enter / tıkla'}: BMO'ya tak`);
  }
}

/* ================= Aç / kapat ================= */
function slotFrame() {
  bmo.root.updateMatrixWorld(true);
  const p = SLOT_LOCAL.clone().applyMatrix4(bmo.g.matrixWorld);
  const q = bmo.root.getWorldQuaternion(new THREE.Quaternion());
  const n = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  // kasetin alt kenarı (konektör) yuvaya girsin, etiket yukarı baksın
  const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0));
  const qSlot = q.clone().multiply(new THREE.Quaternion().setFromRotationMatrix(basis));
  const half = (CART.h / 2) * IN_SLOT_SCALE;
  const at = (o) => p.clone().addScaledVector(n, o);
  return {
    qSlot, n,
    out: at(half + 0.45), // yuvanın önünde bekleme
    touch: at(half), // konektör yuvaya değiyor
    inside: at(half - CART.h * IN_SLOT_SCALE * 0.78), // %78 içeride
  };
}

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
function restQuat(c, now, out = new THREE.Quaternion()) {
  out.copy(camera.quaternion);
  _e.set(0, Math.sin(now / 1600 + c.phase) * 0.18, c.tilt * (1 - c.hover));
  return out.multiply(_q.setFromEuler(_e));
}

async function openCart(i, { push = true } = {}) {
  if (state !== 'idle' || !carts[i]) return;
  if (carts[i].p.placeholder) {
    Sfx.blip();
    say('Bu kaset boş! Önce GitHub hesabını bağla, sonra projelerini birlikte oynayalım.', 'Sağ üstteki kutuya GitHub kullanıcı adını yaz');
    ghInput.focus({ preventScroll: true });
    return;
  }
  state = 'busy';
  body.classList.add('busy');
  const c = carts[i];
  current = c;
  select(i, { speak: false });
  c.mode = 'anim';
  fillScreen(c);
  setMood('happy');
  Sfx.select();
  say(`"${c.p.title}" kasetini takıyorum... Hazır ol!`, '');

  const S = slotFrame();
  const p0 = c.group.position.clone();
  const q0 = c.group.quaternion.clone();
  const s0 = c.group.scale.x;
  const up = new THREE.Vector3(0, 1, 0);
  const c1 = p0.clone().addScaledVector(up, 0.7);
  const c2 = S.out.clone().addScaledVector(S.n, 1.0).addScaledVector(up, 0.9);
  const tmp = new THREE.Vector3();

  Sfx.whoosh();
  await tween(1000, (e) => {
    c.group.position.copy(bez(p0, c1, c2, S.out, e, tmp));
    c.group.quaternion.slerpQuaternions(q0, S.qSlot, ease.inOut(clamp(e * 1.25 - 0.1, 0, 1)));
    const s = lerp(s0, IN_SLOT_SCALE, e);
    c.group.scale.set(s, s, s * lerp(1, IN_SLOT_THIN, e));
  }, ease.inOut);
  await tween(220, (e) => c.group.position.lerpVectors(S.out, S.touch, e), ease.out);
  await wait(T(60));
  await tween(240, (e) => c.group.position.lerpVectors(S.touch, S.inside, e), ease.in);
  Sfx.insert();
  setMood('loading');
  face.lookTarget.set(0, 0);
  await wait(T(450));

  // kamera ekrana yaklaşır
  cam.mode = 'anim';
  body.classList.add('zoomed');
  const fromPos = camera.position.clone();
  const fromTarget = L.home.target.clone();
  const to = screenPose();
  const look = new THREE.Vector3();
  await tween(1250, (e) => {
    camera.position.lerpVectors(fromPos, to.pos, e);
    camera.lookAt(look.lerpVectors(fromTarget, to.target, e));
  }, ease.inOut);
  cam.mode = 'screen';

  scr.hidden = false;
  scr.classList.add('booting');
  void scr.offsetWidth;
  scr.classList.add('on');
  Sfx.boot();
  state = 'open';
  if (push) history.pushState({ bmo: c.p.name }, '', '#' + encodeURIComponent(c.p.name));
  scr.focus({ preventScroll: true });
  await wait(T(950));
  if (state !== 'open' || current !== c) return;
  scr.classList.remove('booting');
  scr.classList.add('ready');
  typeDesc(c.p.description);
}

function requestBack() {
  if (state !== 'open') return;
  if (history.state && history.state.bmo) history.back();
  else closeCart();
}

async function closeCart({ fromPop = false } = {}) {
  if (state !== 'open' || !current) return;
  state = 'busy';
  const c = current;
  if (!fromPop && location.hash) history.replaceState(null, '', location.pathname + location.search);
  descToken++;
  say('Kaseti çıkarıyorum...', '');

  Sfx.off();
  setMood('off');
  scr.classList.add('off');
  await wait(T(400));
  scr.hidden = true;
  scr.classList.remove('on', 'off', 'ready', 'booting');

  // kamera geri çekilir
  body.classList.remove('zoomed');
  cam.mode = 'anim';
  const from = screenPose();
  const look = new THREE.Vector3();
  await tween(1100, (e) => {
    camera.position.lerpVectors(from.pos, L.home.pos, e);
    camera.lookAt(look.lerpVectors(from.target, L.home.target, e));
  }, ease.inOut);
  cam.offset.set(0, 0, 0);
  cam.mode = 'home';

  setMood('idle');
  face.blink = 0.15;
  await wait(T(120));

  // kaset çıkar ve yerine uçar
  const S = slotFrame();
  Sfx.eject();
  await tween(320, (e) => c.group.position.lerpVectors(S.inside, S.out, e), ease.out);
  const p0 = c.group.position.clone();
  const q0 = c.group.quaternion.clone();
  const up = new THREE.Vector3(0, 1, 0);
  const c1 = p0.clone().addScaledVector(S.n, 1.0).addScaledVector(up, 0.9);
  const tmp = new THREE.Vector3();
  const qr = new THREE.Quaternion();
  Sfx.whoosh();
  await tween(900, (e, raw) => {
    const dest = c.rest;
    const c2 = dest.clone().addScaledVector(up, 0.6);
    c.group.position.copy(bez(p0, c1, c2, dest, e, tmp));
    c.group.quaternion.slerpQuaternions(q0, restQuat(c, performance.now(), qr), ease.inOut(clamp(raw * 1.2, 0, 1)));
    const s = lerp(IN_SLOT_SCALE, c.restScale, e);
    c.group.scale.set(s, s, s * lerp(IN_SLOT_THIN, 1, e));
  }, ease.inOut);
  c.mode = 'rest';

  body.classList.remove('busy');
  current = null;
  state = 'idle';
  select(-1);
  hovered = -1;
  cartList.children[c.i]?.focus({ preventScroll: true });
  const lines = ['Başka bir kaset dene!', 'Bu eğlenceliydi! Sıradaki?', 'BMO hazır! Yeni bir oyun seç.', 'Ooo, bir tane daha!'];
  say(lines[Math.floor(Math.random() * lines.length)], DEFAULT_HINT);
}

/* ================= Etkileşim ================= */
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let hovered = -1;

function pick(clientX, clientY) {
  ndc.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const targets = carts.filter((c) => c.mode === 'rest').map((c) => c.group);
  targets.push(bmo.body);
  const hit = raycaster.intersectObjects(targets, true)[0];
  if (!hit) return { cart: -1, onBmo: false };
  const ci = hit.object.userData.cartIndex;
  return { cart: ci ?? -1, onBmo: ci === undefined };
}

const BMO_LINES = ['Hihi! Gıdıklanıyorum!', 'BMO seni seviyor!', 'Ben bir oyun konsoluyum ama aynı zamanda bir dostum!', 'Bir kaset tak da oynayalım!'];

function bindEvents() {
  addEventListener('pointerdown', () => Sfx.unlock(), { capture: true });

  sceneCanvas.addEventListener('pointermove', (e) => {
    cam.pointer.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
    if (state !== 'idle' || e.pointerType === 'touch') return;
    const { cart, onBmo } = pick(e.clientX, e.clientY);
    sceneCanvas.classList.toggle('hovering', cart >= 0 || onBmo);
    if (cart !== hovered) {
      hovered = cart;
      if (cart >= 0) { select(cart); Sfx.hover(); } else select(-1, { speak: false });
    }
  });
  sceneCanvas.addEventListener('pointerleave', () => {
    cam.pointer.set(0, 0);
    if (state === 'idle') { hovered = -1; select(-1, { speak: false }); }
  });
  let downAt = null;
  sceneCanvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
  sceneCanvas.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 10) return;
    downAt = null;
    if (state !== 'idle') return;
    const { cart, onBmo } = pick(e.clientX, e.clientY);
    if (cart >= 0) openCart(cart);
    else if (onBmo) {
      Sfx.giggle();
      setMood('happy');
      say(BMO_LINES[Math.floor(Math.random() * BMO_LINES.length)]);
      setTimeout(() => { if (state === 'idle' && selected < 0) setMood('idle'); }, 1400);
    }
  });

  addEventListener('keydown', (e) => {
    Sfx.unlock();
    if (state === 'open') {
      if (e.key === 'Escape' || e.key === 'Backspace' || e.key.toLowerCase() === 'b') { e.preventDefault(); requestBack(); }
      else if (e.key === 'Tab') trapFocus(e);
      return;
    }
    if (state !== 'idle') {
      if (e.key.startsWith('Arrow') || e.key === 'Enter' || e.key === ' ') e.preventDefault();
      return;
    }
    const n = carts.length;
    if (!n) return;
    if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      const d = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : -1;
      const i = selected < 0 ? (d > 0 ? 0 : n - 1) : (selected + d + n) % n;
      cartList.children[i].focus({ preventScroll: true });
      Sfx.hover();
    } else if (e.key === 'Enter' && selected >= 0 && document.activeElement?.parentElement !== cartList) {
      e.preventDefault();
      openCart(selected);
    }
  });

  $('#btn-back').addEventListener('click', requestBack);
  scr.addEventListener('click', (e) => { if (e.target.closest('.btn-go, .btn-demo')) Sfx.select(); });

  const mute = $('#mute');
  const syncMute = () => {
    mute.textContent = Sfx.muted ? 'SES: KAPALI' : 'SES: AÇIK';
    mute.setAttribute('aria-pressed', String(Sfx.muted));
  };
  syncMute();
  mute.addEventListener('click', () => { Sfx.unlock(); Sfx.toggle(); syncMute(); });

  addEventListener('popstate', () => {
    if (state === 'open' && !(history.state && history.state.bmo)) closeCart({ fromPop: true });
    else if (state === 'idle') {
      const i = cartFromHash();
      if (i >= 0) openCart(i, { push: false });
    }
  });

  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(layout, 60); });
}

function trapFocus(e) {
  const f = [...scr.querySelectorAll('button, a[href]')].filter((el) => !el.hidden);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && (document.activeElement === first || document.activeElement === scr)) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && (document.activeElement === last || document.activeElement === scr)) { e.preventDefault(); first.focus(); }
}

function cartFromHash() {
  let h = '';
  try { h = decodeURIComponent(location.hash.slice(1)); } catch { return -1; }
  return h ? carts.findIndex((c) => c.p.name === h) : -1;
}

/* ================= Döngü ================= */
let last = performance.now();
let faceAcc = 0;
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  runTweens(now);

  // kamera paralaksı
  if (cam.mode === 'home') {
    cam.target.set(cam.pointer.x * 0.35, -cam.pointer.y * 0.18, 0);
    cam.offset.lerp(cam.target, 1 - Math.pow(0.04, dt));
    camera.position.copy(L.home.pos).add(cam.offset);
    camera.lookAt(L.home.target);
  }

  // gözler: seçili kasete ya da imlece bakar
  if (state === 'idle') {
    let lx = cam.pointer.x * 22, ly = cam.pointer.y * 14;
    if (selected >= 0) {
      const sp = _v.copy(carts[selected].group.position).project(camera);
      const bc = _v2.set(0, SCREEN.y, FRONT).applyMatrix4(bmo.g.matrixWorld).project(camera);
      lx = clamp((sp.x - bc.x) * 40, -24, 24);
      ly = clamp(-(sp.y - bc.y) * 30, -14, 16);
    }
    face.lookTarget.set(lx, ly);
  }
  const px = face.look.x, py = face.look.y;
  face.look.lerp(face.lookTarget, 1 - Math.pow(0.001, dt));
  if (Math.abs(px - face.look.x) + Math.abs(py - face.look.y) > 0.3) face.dirty = true;
  if (face.blink > 0) { face.blink -= dt; face.dirty = true; }
  faceAcc += dt;
  if (face.mood === 'loading' && faceAcc > 0.04) face.dirty = true;
  if (face.dirty) { drawFace(now); face.dirty = false; faceAcc = 0; }

  // kasetler süzülür
  carts.forEach((c, idx) => {
    if (c.mode !== 'rest') return;
    c.hover = lerp(c.hover, idx === selected ? 1 : 0, 1 - Math.pow(0.002, dt));
    c.group.position.copy(c.rest);
    c.group.position.y += (Math.sin((now / 1000) * c.speed + c.phase) * 0.05 + c.hover * 0.1) * c.restScale;
    restQuat(c, now, c.group.quaternion);
    c.group.scale.setScalar(c.restScale * (1 + c.hover * 0.1));
  });

  // peri ışıkları titreşir
  for (const b of room.userData.bulbs) {
    const f = 0.85 + 0.1 * Math.sin((now / 1000) * b.speed + b.phase) + 0.05 * Math.sin(now / 97 + b.phase);
    b.halo.material.opacity = 0.55 * f;
    b.light.intensity = 6 * f;
  }
  room.userData.ray.material.opacity = 0.08 + 0.03 * Math.sin(now / 3000);

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

(function blinkLoop() {
  setTimeout(() => {
    if (face.mood === 'idle' && !document.hidden) {
      face.blink = 0.13;
      if (Math.random() < 0.25) setTimeout(() => { face.blink = 0.13; }, 260);
    }
    blinkLoop();
  }, 2200 + Math.random() * 3200);
})();

async function loadProfile(user) {
  const key = 'bmo-profile:' + user.toLowerCase();
  try {
    const c = JSON.parse(store.get(key) || 'null');
    if (c && Date.now() - c.t < 30 * 60e3) return c.d;
  } catch { /* bozuk önbellek */ }
  const res = await fetch(`https://api.github.com/users/${encodeURIComponent(user)}`, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) { const e = new Error('GitHub ' + res.status); e.status = res.status; throw e; }
  const r = await res.json();
  const d = { login: r.login, name: r.name, bio: r.bio };
  store.set(key, JSON.stringify({ t: Date.now(), d }));
  return d;
}

/* ================= GitHub bağlantısı ================= */
const USER_RE = /^[a-z\d](?:[a-z\d-]{0,38})$/i;
let currentUser = '';

function setBrand(profile) {
  const name = profile ? (CFG.name || profile.name || profile.login).toLocaleUpperCase('tr') : (CFG.name || 'BMO');
  const role = profile ? (CFG.title || profile.bio || `@${profile.login}`) : 'GitHub hesabını bağla, projelerin kaset olsun';
  $('#brand-name').textContent = name;
  $('#brand-role').textContent = role;
  document.title = `${name} — BMO Portfolyo`;
  const gh = $('#gh-profile');
  gh.hidden = !profile;
  if (profile) gh.href = `https://github.com/${encodeURIComponent(profile.login)}`;
  $('#gh-clear').hidden = !profile;
  ghInput.value = profile ? profile.login : '';
}

// erişilebilir liste (klavye ve ekran okuyucu)
function buildCartList(projects) {
  cartList.textContent = '';
  projects.forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = `${p.title} — ${p.description}`;
    b.addEventListener('focus', () => { if (state === 'idle') select(i); });
    b.addEventListener('click', () => {
      if (renderer) openCart(i);
      else if (p.url) window.open(p.url, '_blank', 'noopener');
    });
    cartList.append(b);
  });
}

function disposeCart(c) {
  scene.remove(c.group);
  c.group.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.dispose();
    for (const m of [].concat(o.material)) { if (m.map) m.map.dispose(); m.dispose(); }
  });
}

// eski kasetler BMO'nun ekranına geri çekilir
async function retractCarts() {
  const to = new THREE.Vector3(0, SCREEN.y, FRONT).applyMatrix4(bmo.g.matrixWorld);
  await Promise.all(carts.map(async (c, i) => {
    c.mode = 'anim';
    await wait(T(i * 50));
    const from = c.group.position.clone();
    const s0 = c.group.scale.x;
    await tween(550, (e) => {
      c.group.position.lerpVectors(from, to, e);
      c.group.scale.setScalar(lerp(s0, 0.01, e));
    }, ease.in);
  }));
  carts.forEach(disposeCart);
  carts = [];
}

// yeni kasetler BMO'nun ekranından çıkıp yerlerine süzülür
async function spawnCarts(projects) {
  carts = projects.map(buildCart);
  layout();
  const from = new THREE.Vector3(0, SCREEN.y, FRONT).applyMatrix4(bmo.g.matrixWorld);
  carts.forEach((c) => { c.mode = 'anim'; c.group.position.copy(from); c.group.scale.setScalar(0.01); });
  const up = new THREE.Vector3(0, 1, 0);
  await Promise.all(carts.map(async (c, i) => {
    await wait(T(150 + i * 110));
    const tmp = new THREE.Vector3();
    const b1 = from.clone().addScaledVector(up, 1.2);
    await tween(900, (e) => {
      const dest = c.rest;
      c.group.position.copy(bez(from, b1, _v.copy(dest).addScaledVector(up, 0.5), dest, e, tmp));
      restQuat(c, performance.now(), c.group.quaternion);
      c.group.scale.setScalar(lerp(0.01, c.restScale, e));
    }, ease.out);
    c.mode = 'rest';
  }));
}

function ghError(err) {
  if (err && err.status === 404) return 'Bu isimde bir GitHub kullanıcısı bulamadım. Yazımı kontrol eder misin?';
  if (err && (err.status === 403 || err.status === 429)) return "GitHub'ın istek sınırı doldu. Birkaç dakika sonra tekrar dene.";
  return "GitHub'a ulaşamadım. İnternet bağlantını kontrol edip tekrar dene.";
}

function setUserParam(login) {
  const url = new URL(location.href);
  if (login) url.searchParams.set('user', login); else url.searchParams.delete('user');
  url.hash = '';
  history.replaceState(null, '', url);
}

// kullanıcı adı verilirse onun repolarını, boşsa boş kasetleri yükler
async function connect(user, { first = false } = {}) {
  if (!first && state !== 'idle') return;
  user = (user || '').trim().replace(/^@/, '');
  if (user && !USER_RE.test(user)) {
    say('Bu geçerli bir GitHub kullanıcı adına benzemiyor.', 'Sadece harf, rakam ve tire kullanılabilir');
    return;
  }
  if (!first) state = 'busy';
  ghForm.classList.add('busy');

  let projects, profile = null;
  if (user) {
    say(`@${user} için kasetleri arıyorum...`, '');
    try {
      [profile, { projects }] = await Promise.all([loadProfile(user), loadProjects(user)]);
    } catch (err) {
      console.warn('[BMO] GitHub hatası:', err);
      say(ghError(err), DEFAULT_HINT);
      ghForm.classList.remove('busy');
      if (!first) { state = 'idle'; return; }
      user = '';
    }
    if (user && !projects.length) {
      say(`@${profile.login} hesabında herkese açık proje yok, kasetler boş kaldı.`, DEFAULT_HINT);
      ghForm.classList.remove('busy');
      if (!first) { state = 'idle'; return; }
      user = ''; profile = null;
    }
  }
  if (!user) projects = placeholders();

  currentUser = profile ? profile.login : '';
  store.set('bmo-user', currentUser);
  setUserParam(currentUser);
  setBrand(profile);
  buildCartList(projects);
  select(-1, { speak: false });
  hovered = -1;

  if (!renderer) { ghForm.classList.remove('busy'); return; }
  if (carts.length) await retractCarts();
  Sfx.boot();
  await spawnCarts(projects);
  ghForm.classList.remove('busy');
  state = 'idle';

  if (profile) say(`Merhaba ${profile.name || profile.login}! ${projects.length} kaset hazır. Hangisini oynayalım?`, DEFAULT_HINT);
  else if (first) say(CFG.greeting, 'Sağ üstten GitHub kullanıcı adını yaz, projelerin kaset olsun');
  else say('Kasetler boşaltıldı. Başka bir GitHub hesabı bağlayabilirsin.', DEFAULT_HINT);
}

/* ================= Başlat ================= */
async function init() {
  scr.tabIndex = -1;
  startDust();
  say('BMO açılıyor...', '');

  ghForm.addEventListener('submit', (e) => {
    e.preventDefault();
    Sfx.unlock();
    const u = ghInput.value.trim();
    if (!u) { say('Önce bir GitHub kullanıcı adı yaz.', ''); ghInput.focus(); return; }
    if (u.replace(/^@/, '').toLowerCase() === currentUser.toLowerCase()) return;
    ghInput.blur();
    connect(u);
  });
  $('#gh-clear').addEventListener('click', () => { Sfx.unlock(); connect(''); });
  // kutuya yazarken ok/Enter tuşları kasetleri seçmesin
  ghInput.addEventListener('keydown', (e) => e.stopPropagation());

  // öncelik: ?user=… > son bağlanan hesap > config.js
  const params = new URLSearchParams(location.search);
  const startUser = params.get('user') || store.get('bmo-user') || String(CFG.githubUsername || '');

  if (!renderer) {
    body.classList.add('no-webgl');
    await connect(startUser, { first: true });
    say('Bu tarayıcıda 3D çalışmıyor, projeleri liste olarak gösteriyorum.', '');
    return;
  }

  await Promise.race([
    Promise.all([
      document.fonts.load('700 100px "Pixelify Sans"'),
      document.fonts.load('800 50px Rubik'),
      document.fonts.load('600 30px Rubik'),
    ]),
    wait(2500),
  ]).catch(() => {});

  setupScene();
  bindEvents();
  layout();
  drawFace(performance.now());
  requestAnimationFrame(frame);

  const hash = location.hash;
  await connect(startUser, { first: true });
  if (hash) {
    history.replaceState(null, '', location.pathname + location.search + hash);
    const i = cartFromHash();
    if (i >= 0 && !carts[i].p.placeholder) openCart(i, { push: false });
  }
}

init();
