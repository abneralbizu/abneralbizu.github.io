// Abner Martinez — portfolio. A data packet travels through seven layers of defense.
// Everything visual is generated in code: no image assets, no external models.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const html = document.documentElement;

/* =====================================================================
   Page UI — works in both the 3D and the static (reduced-motion) mode
   ===================================================================== */

const STATUS = [
  ['00 / 07', 'INGRESS', 'IN TRANSIT'],
  ['01 / 07', 'OPEN INTERNET', 'SCANNED'],
  ['02 / 07', 'PERIMETER', 'FILTERED'],
  ['03 / 07', 'SEGMENTATION', 'ROUTED'],
  ['04 / 07', 'ENDPOINT', 'VERIFIED'],
  ['05 / 07', 'IDENTITY', 'AUTHENTICATED'],
  ['06 / 07', 'AUTOMATION', 'PROVISIONED'],
  ['07 / 07', 'CORE', 'LOGGED'],
  ['07 / 07', 'DELIVERED', 'DELIVERED'],
];

function setupUI() {
  // Reveal cards as they arrive.
  const cards = document.querySelectorAll('.card');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }, { threshold: 0.2 });
    cards.forEach((c) => io.observe(c));
  } else {
    cards.forEach((c) => c.classList.add('in'));
  }

  // HUD + rail follow whichever section crosses the middle of the screen.
  const hudLayer = document.getElementById('hud-layer');
  const hudZone = document.getElementById('hud-zone');
  const hudStatus = document.getElementById('hud-status');
  const railLinks = [...document.querySelectorAll('.rail a')];
  const watched = [document.getElementById('top')];
  for (let i = 1; i <= 7; i++) watched.push(document.getElementById('layer-' + i));
  watched.push(document.getElementById('work'));

  const setStage = (idx) => {
    const s = STATUS[idx];
    hudLayer.textContent = s[0]; hudZone.textContent = s[1]; hudStatus.textContent = s[2];
    // The HUD sits over the hero text and the left-hand cards' edges; only show it mid-journey.
    hudLayer.closest('.hud').classList.toggle('idle', idx === 0 || idx === STATUS.length - 1);
    railLinks.forEach((a) => {
      const i = +a.dataset.i;
      a.classList.toggle('on', i === idx);
      a.classList.toggle('done', i < idx);
    });
  };
  if ('IntersectionObserver' in window) {
    const mid = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setStage(watched.indexOf(e.target));
    }, { rootMargin: '-48% 0px -48% 0px' });
    watched.forEach((el) => mid.observe(el));
  }
}

setupUI();

if (html.classList.contains('immersive')) {
  try { initScene(); }
  catch (err) {
    console.error('3D scene failed, falling back to static layout:', err);
    html.classList.remove('immersive'); html.classList.add('static');
    document.querySelectorAll('.card').forEach((c) => c.classList.add('in'));
  }
}

/* =====================================================================
   The 3D journey
   ===================================================================== */

function initScene() {
  const canvas = document.getElementById('scene');
  const small = Math.min(innerWidth, innerHeight) < 640;
  const LOW = small || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !LOW, powerPreference: 'high-performance' });
  let pixelRatio = Math.min(window.devicePixelRatio || 1, LOW ? 1.25 : 1.75);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.setClearColor(0x03070a, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x03070a, 0.021);
  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 600);

  const C = {
    teal: new THREE.Color(0x17d1ac),
    cyan: new THREE.Color(0x3ad0ff),
    red: new THREE.Color(0xff3b5c),
    white: new THREE.Color(0xe6fff8),
    amber: new THREE.Color(0xffb84d),
  };
  const timed = [];            // materials with a uTime uniform
  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  /* ---------------- the route the packet takes ---------------- */
  const ctrl = [];
  for (let i = 0; i <= 20; i++) {
    ctrl.push(new THREE.Vector3(Math.sin(i * 0.62) * 7, Math.sin(i * 0.41 + 1.0) * 3.2, -i * 13));
  }
  const path = new THREE.CatmullRomCurve3(ctrl, false, 'catmullrom', 0.5);
  const P = (t) => path.getPointAt(clamp01(t));
  const WORLD_UP = new THREE.Vector3(0, 1, 0);
  function frameAt(t) {
    const p = P(t);
    const f = path.getTangentAt(clamp01(t)).normalize();
    const rt = new THREE.Vector3().crossVectors(f, WORLD_UP).normalize();
    const up = new THREE.Vector3().crossVectors(rt, f).normalize();
    return { p, f, rt, up };
  }
  const at = (t, x, y, z = 0) => {
    const F = frameAt(t);
    return F.p.clone().addScaledVector(F.rt, x).addScaledVector(F.up, y).addScaledVector(F.f, z);
  };

  // Where the camera sits when each section is centred on screen.
  const STATIONS = [0.0, 0.10, 0.22, 0.34, 0.46, 0.58, 0.70, 0.82];
  const T_END = 0.93;
  const GATE_AHEAD = 0.045;

  /* ---------------- shared shaders ---------------- */
  const pointVert = /* glsl */`
    attribute float aSize; attribute float aPhase; attribute vec3 aColor;
    uniform float uTime; uniform float uPR;
    varying vec3 vColor; varying float vAlpha;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      float tw = 0.72 + 0.28 * sin(uTime * 1.7 + aPhase);
      gl_PointSize = min(aSize * uPR * tw * (260.0 / max(1.0, -mv.z)), 40.0 * uPR);
      gl_Position = projectionMatrix * mv;
      vColor = aColor;
      vAlpha = smoothstep(150.0, 20.0, -mv.z) * smoothstep(1.5, 6.0, -mv.z);
    }`;
  const pointFrag = /* glsl */`
    varying vec3 vColor; varying float vAlpha;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.0, d); a *= a;
      gl_FragColor = vec4(vColor, a * vAlpha);
    }`;
  const makePointsMat = () => {
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPR: { value: pixelRatio } },
      vertexShader: pointVert, fragmentShader: pointFrag,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    timed.push(m); return m;
  };

  const membraneVert = /* glsl */`
    uniform float uR; varying vec2 vP;
    void main() { vP = position.xy / uR; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const membraneFrag = /* glsl */`
    uniform vec3 uColor; uniform float uTime; uniform float uOpacity; varying vec2 vP;
    float hexDist(vec2 p) { p = abs(p); return max(dot(p, normalize(vec2(1.0, 1.7320508))), p.x); }
    void main() {
      float r = length(vP);
      vec2 g = vP * 9.0;
      vec2 s = vec2(1.0, 1.7320508);
      vec2 a = mod(g, s) - s * 0.5;
      vec2 b = mod(g - s * 0.5, s) - s * 0.5;
      vec2 gv = dot(a, a) < dot(b, b) ? a : b;
      float edge = smoothstep(0.40, 0.48, hexDist(gv));
      float wave = fract(r * 0.9 - uTime * 0.35);
      float pulse = smoothstep(0.0, 0.06, wave) * (1.0 - smoothstep(0.06, 0.22, wave));
      float rim = smoothstep(0.55, 1.0, r);
      float alpha = edge * (0.08 + 0.32 * rim) + pulse * 0.42 * edge + rim * rim * 0.16;
      alpha *= 1.0 - smoothstep(0.97, 1.0, r);
      gl_FragColor = vec4(uColor, alpha * uOpacity);
    }`;
  const makeMembraneMat = (color, radius, opacity = 1) => {
    const m = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: color.clone() }, uTime: { value: 0 }, uOpacity: { value: opacity }, uR: { value: radius } },
      vertexShader: membraneVert, fragmentShader: membraneFrag,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    });
    timed.push(m); return m;
  };

  // Radial glow texture for sprites.
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.2, 'rgba(255,255,255,0.55)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.12)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const glows = [];
  const glow = (color, scale, opacity = 1) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    s.scale.setScalar(scale);
    s.userData.base = opacity; s.userData.size = scale; glows.push(s);
    return s;
  };

  /* ---------------- atmosphere ---------------- */
  const haze = new THREE.Mesh(
    new THREE.SphereGeometry(400, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, depthTest: false,
      vertexShader: /* glsl */`varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`
        varying vec3 vDir;
        void main() {
          float y = vDir.y;
          vec3 base = vec3(0.010, 0.022, 0.028);
          float band = exp(-pow((y - 0.12) * 3.2, 2.0));
          float side = 0.5 + 0.5 * vDir.x;
          vec3 col = base + vec3(0.02, 0.15, 0.13) * band * 0.55 * side + vec3(0.015, 0.06, 0.13) * band * 0.45 * (1.0 - side);
          gl_FragColor = vec4(col, 1.0);
        }`,
    }),
  );
  haze.renderOrder = -10;
  scene.add(haze);

  /* ---------------- network nodes + links ---------------- */
  const NODE_N = LOW ? 900 : 2400;
  const nodePos = new Float32Array(NODE_N * 3);
  const nodeCol = new Float32Array(NODE_N * 3);
  const nodeSize = new Float32Array(NODE_N);
  const nodePhase = new Float32Array(NODE_N);
  const ts = Array.from({ length: NODE_N }, () => Math.random()).sort((a, b) => a - b);
  const dim = C.teal.clone().multiplyScalar(0.55);
  const dimCyan = C.cyan.clone().multiplyScalar(0.6);
  for (let i = 0; i < NODE_N; i++) {
    const p = P(ts[i]);
    const ang = Math.random() * Math.PI * 2;
    const r = 5 + Math.pow(Math.random(), 1.6) * 32;
    nodePos[i * 3] = p.x + Math.cos(ang) * r;
    nodePos[i * 3 + 1] = p.y + Math.sin(ang) * r * 0.7;
    nodePos[i * 3 + 2] = p.z + (Math.random() - 0.5) * 9;
    const roll = Math.random();
    const col = roll < 0.08 ? C.white : roll < 0.28 ? dimCyan : dim;
    nodeCol[i * 3] = col.r; nodeCol[i * 3 + 1] = col.g; nodeCol[i * 3 + 2] = col.b;
    nodeSize[i] = roll < 0.08 ? 2.6 : 0.8 + Math.random() * 1.5;
    nodePhase[i] = Math.random() * 6.283;
  }
  const nodeGeo = new THREE.BufferGeometry();
  nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodePos, 3));
  nodeGeo.setAttribute('aColor', new THREE.BufferAttribute(nodeCol, 3));
  nodeGeo.setAttribute('aSize', new THREE.BufferAttribute(nodeSize, 1));
  nodeGeo.setAttribute('aPhase', new THREE.BufferAttribute(nodePhase, 1));
  const nodes = new THREE.Points(nodeGeo, makePointsMat());
  nodes.frustumCulled = false;
  scene.add(nodes);

  const segs = [];
  const linkPos = [];
  const va = new THREE.Vector3(), vb = new THREE.Vector3();
  for (let i = 0; i < NODE_N && segs.length < (LOW ? 1100 : 3200); i++) {
    va.fromArray(nodePos, i * 3);
    for (let k = 1; k <= 5 && i + k < NODE_N; k++) {
      vb.fromArray(nodePos, (i + k) * 3);
      if (va.distanceTo(vb) < 9 && Math.random() < 0.55) {
        segs.push([i, i + k]);
        linkPos.push(va.x, va.y, va.z, vb.x, vb.y, vb.z);
      }
    }
  }
  const linkGeo = new THREE.BufferGeometry();
  linkGeo.setAttribute('position', new THREE.Float32BufferAttribute(linkPos, 3));
  scene.add(new THREE.LineSegments(linkGeo, new THREE.LineBasicMaterial({
    color: 0x1a8f7a, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false,
  })));

  /* ---------------- traffic moving along the links ---------------- */
  const STREAM_N = LOW ? 120 : 380;
  const streamPos = new Float32Array(STREAM_N * 3);
  const streamCol = new Float32Array(STREAM_N * 3);
  const streamSize = new Float32Array(STREAM_N).fill(2.4);
  const streamPhase = new Float32Array(STREAM_N);
  const streams = [];
  for (let i = 0; i < STREAM_N; i++) {
    streams.push({ s: segs[(Math.random() * segs.length) | 0], u: Math.random(), v: 0.25 + Math.random() * 0.6 });
    const col = Math.random() < 0.7 ? C.cyan : C.teal;
    streamCol[i * 3] = col.r; streamCol[i * 3 + 1] = col.g; streamCol[i * 3 + 2] = col.b;
    streamPhase[i] = Math.random() * 6.283;
  }
  const streamGeo = new THREE.BufferGeometry();
  streamGeo.setAttribute('position', new THREE.BufferAttribute(streamPos, 3));
  streamGeo.setAttribute('aColor', new THREE.BufferAttribute(streamCol, 3));
  streamGeo.setAttribute('aSize', new THREE.BufferAttribute(streamSize, 1));
  streamGeo.setAttribute('aPhase', new THREE.BufferAttribute(streamPhase, 1));
  const streamPts = new THREE.Points(streamGeo, makePointsMat());
  streamPts.frustumCulled = false;
  scene.add(streamPts);

  /* ---------------- fiber-light along the route ---------------- */
  const fiberMat = (color, speed, density) => {
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: color.clone() }, uSpeed: { value: speed }, uDensity: { value: density } },
      vertexShader: /* glsl */`
        attribute float aT; varying float vT; varying float vFade;
        void main(){
          vT = aT; vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vFade = smoothstep(130.0, 10.0, -mv.z) * smoothstep(0.5, 4.0, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform float uTime; uniform vec3 uColor; uniform float uSpeed; uniform float uDensity;
        varying float vT; varying float vFade;
        void main(){
          float x = fract(vT * uDensity - uTime * uSpeed);
          float pulse = pow(x, 16.0);
          gl_FragColor = vec4(uColor, (0.07 + pulse * 1.3) * vFade);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    timed.push(m); return m;
  };
  const FIBERS = LOW ? 4 : 8;
  for (let k = 0; k < FIBERS; k++) {
    const SAMPLES = 900;
    const pos = new Float32Array(SAMPLES * 3);
    const tt = new Float32Array(SAMPLES);
    const a0 = (k / FIBERS) * Math.PI * 2;
    const rad = 1.3 + (k % 3) * 0.7;
    const twist = (k % 2 ? 1 : -1) * (5 + k);
    for (let i = 0; i < SAMPLES; i++) {
      const t = i / (SAMPLES - 1);
      const F = frameAt(t);
      const a = a0 + t * twist;
      const p = F.p.clone().addScaledVector(F.rt, Math.cos(a) * rad).addScaledVector(F.up, Math.sin(a) * rad * 0.8);
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
      tt[i] = t;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aT', new THREE.BufferAttribute(tt, 1));
    const line = new THREE.Line(g, fiberMat(k % 3 === 0 ? C.cyan : C.teal, 0.25 + (k % 4) * 0.08, 30 + k * 7));
    line.frustumCulled = false;
    scene.add(line);
  }

  /* ---------------- threats: red anomalies that probe each gate ---------------- */
  const anomalyMat = (radius) => {
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uR: { value: radius }, uPR: { value: pixelRatio }, uColor: { value: C.red.clone() }, uHit: { value: C.white.clone() } },
      vertexShader: /* glsl */`
        attribute float aTheta; attribute float aR0; attribute float aPhase; attribute float aZ0; attribute float aSpeed;
        uniform float uTime; uniform float uR; uniform float uPR;
        varying float vHit; varying float vA;
        void main(){
          float s = fract(uTime * aSpeed + aPhase);
          float approach = smoothstep(0.0, 0.72, s);
          float r = mix(aR0, uR * 1.01, approach * approach);
          float z = mix(aZ0, 0.0, approach);
          float th = aTheta + s * 0.6;
          vec3 pos = vec3(cos(th) * r, sin(th) * r, z);
          vHit = smoothstep(0.70, 0.74, s) * (1.0 - smoothstep(0.74, 0.9, s));
          vA = smoothstep(0.0, 0.08, s) * (1.0 - smoothstep(0.86, 0.95, s));
          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = (2.4 + vHit * 7.0) * uPR * (260.0 / max(1.0, -mv.z));
          gl_Position = projectionMatrix * mv;
          vA *= smoothstep(130.0, 15.0, -mv.z);
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uColor; uniform vec3 uHit; varying float vHit; varying float vA;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d); a *= a;
          gl_FragColor = vec4(mix(uColor, uHit, vHit), a * vA);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    timed.push(m); return m;
  };
  function makeAnomalies(radius) {
    const n = LOW ? 14 : 34;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const attr = (name, fn) => g.setAttribute(name, new THREE.BufferAttribute(Float32Array.from({ length: n }, fn), 1));
    attr('aTheta', () => Math.random() * Math.PI * 2);
    attr('aR0', () => radius * (2.0 + Math.random() * 1.8));
    attr('aPhase', () => Math.random());
    attr('aZ0', () => (Math.random() - 0.5) * 22);
    attr('aSpeed', () => 0.12 + Math.random() * 0.14);
    const pts = new THREE.Points(g, anomalyMat(radius));
    pts.frustumCulled = false;
    return pts;
  }

  /* ---------------- the seven gates ---------------- */
  const LAYERS = [
    null,
    { name: 'Reconnaissance', zone: 'the open internet', color: C.cyan, sides: 0, r: 4.2 },
    { name: 'Perimeter', zone: 'the firewall', color: C.teal, sides: 0, r: 5.2 },
    { name: 'Segmentation', zone: 'divided zones', color: C.teal, sides: 4, r: 4.6 },
    { name: 'Endpoint', zone: 'the hardened host', color: C.teal, sides: 0, r: 4.0 },
    { name: 'Identity & access', zone: 'the key gate', color: C.cyan, sides: 6, r: 4.6 },
    { name: 'Automation', zone: 'self-building infrastructure', color: C.teal, sides: 0, r: 4.2 },
    { name: 'Response', zone: 'the protected core', color: C.amber, sides: 0, r: 4.8 },
  ];
  const gates = [];
  const hitTargets = [];

  function ringMat(color, opacity) {
    return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  }

  for (let i = 1; i <= 7; i++) {
    const cfg = LAYERS[i];
    const tg = STATIONS[i] + GATE_AHEAD;
    const F = frameAt(tg);
    const group = new THREE.Group();
    group.position.copy(F.p);
    group.lookAt(F.p.clone().add(F.f));
    const seg = cfg.sides || 96;
    const rings = [];
    const addRing = (rad, tube, op) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(rad, tube, 6, seg), ringMat(cfg.color, op));
      if (cfg.sides === 4) m.rotation.z = Math.PI / 4;
      if (cfg.sides === 6) m.rotation.z = Math.PI / 6;
      group.add(m); rings.push({ mesh: m, base: op });
      return m;
    };
    addRing(cfg.r, 0.045, 0.95);
    addRing(cfg.r * 1.09, 0.016, 0.5);
    addRing(cfg.r * 0.86, 0.012, 0.35);

    const membranes = [];
    const addMembrane = (z, op) => {
      const m = new THREE.Mesh(new THREE.CircleGeometry(cfg.r * 0.99, cfg.sides || 72), makeMembraneMat(cfg.color, cfg.r, op));
      if (cfg.sides === 4) m.rotation.z = Math.PI / 4;
      if (cfg.sides === 6) m.rotation.z = Math.PI / 6;
      m.position.z = z; group.add(m); membranes.push({ mesh: m, base: op });
    };
    if (i === 2) { addMembrane(0, 1); addMembrane(-1.1, 0.75); addMembrane(-2.2, 0.5); } // layered shields
    else if (i !== 5) addMembrane(0, 0.9);

    group.add(makeAnomalies(cfg.r));
    const hit = new THREE.Mesh(new THREE.SphereGeometry(cfg.r * 1.1, 10, 8), new THREE.MeshBasicMaterial({ visible: false }));
    hit.userData.layer = i;
    group.add(hit); hitTargets.push(hit);

    scene.add(group);
    gates[i] = { group, rings, membranes, cfg, hover: 0 };
  }

  /* ---- layer 1: radar sweep (reconnaissance) ---- */
  const radarMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: C.cyan.clone() }, uR: { value: 10 }, uOpacity: { value: 0.5 } },
    vertexShader: membraneVert,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform vec3 uColor; uniform float uOpacity; varying vec2 vP;
      void main(){
        float r = length(vP);
        float ang = atan(vP.y, vP.x);
        float sweep = fract(ang / 6.2831853 + uTime * 0.16);
        float trail = pow(sweep, 9.0);
        float rings = smoothstep(0.92, 1.0, sin(r * 31.4) * 0.5 + 0.5) * 0.28;
        float spokes = smoothstep(0.985, 1.0, abs(cos(ang * 6.0))) * 0.12;
        float a = (trail * 0.5 + rings + spokes) * (1.0 - smoothstep(0.96, 1.0, r)) * smoothstep(0.05, 0.3, r);
        gl_FragColor = vec4(uColor, a * uOpacity);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  timed.push(radarMat);
  const radar = new THREE.Mesh(new THREE.CircleGeometry(10, 96), radarMat);
  radar.position.z = -0.6;
  gates[1].group.add(radar);

  /* ---- layer 3: segmented zones ---- */
  const zoneDefs = [
    [8.5, 2.6, 0.008, C.teal], [7.5, -3.6, 0.02, C.cyan], [-9.5, 1.0, 0.03, C.amber],
  ];
  for (const [x, y, dt, col] of zoneDefs) {
    const center = at(STATIONS[3] + GATE_AHEAD + dt, x, y);
    const box = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(5, 3.6, 5.5)),
      new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    box.position.copy(center);
    box.lookAt(center.clone().add(frameAt(STATIONS[3]).f));
    scene.add(box);
    const n = LOW ? 18 : 36;
    const g = new THREE.BufferGeometry();
    const pp = new Float32Array(n * 3), cc = new Float32Array(n * 3);
    for (let j = 0; j < n; j++) {
      pp[j * 3] = center.x + (Math.random() - 0.5) * 4.2;
      pp[j * 3 + 1] = center.y + (Math.random() - 0.5) * 3;
      pp[j * 3 + 2] = center.z + (Math.random() - 0.5) * 4.6;
      cc[j * 3] = col.r; cc[j * 3 + 1] = col.g; cc[j * 3 + 2] = col.b;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pp, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(cc, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(n).fill(2.2), 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(Float32Array.from({ length: n }, () => Math.random() * 6.28), 1));
    const p = new THREE.Points(g, makePointsMat()); p.frustumCulled = false; scene.add(p);
    const beacon = glow(col, 2.4, 0.6); beacon.position.copy(center); scene.add(beacon);
  }

  /* ---- layer 4: the hardened host, red findings shed away ---- */
  const coreCenter = at(STATIONS[4] + GATE_AHEAD + 0.012, -7, 0.5);
  const hostGroup = new THREE.Group(); hostGroup.position.copy(coreCenter); scene.add(hostGroup);
  const hostEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(2.3, 1)),
    new THREE.LineBasicMaterial({ color: C.teal, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  hostGroup.add(hostEdges);
  hostGroup.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1), ringMat(C.teal, 0.12)));
  hostGroup.add(glow(C.teal, 7, 0.45));
  const FRAG_N = LOW ? 22 : 46;
  const frags = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.2), ringMat(C.red, 0.9), FRAG_N);
  frags.frustumCulled = false;
  const fragData = Array.from({ length: FRAG_N }, () => ({
    dir: new THREE.Vector3().randomDirection(), phase: Math.random(), speed: 0.12 + Math.random() * 0.1,
    spin: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(3),
  }));
  hostGroup.add(frags);

  /* ---- layer 5: identity gate opens for the packet ---- */
  const idCfg = LAYERS[5];
  const hexHalf = (side) => {
    const s = new THREE.Shape();
    const R = idCfg.r * 0.97;
    const angs = side < 0 ? [90, 150, 210, 270] : [270, 330, 30, 90];
    angs.forEach((d, k) => {
      const a = THREE.MathUtils.degToRad(d);
      const x = Math.cos(a) * R, y = Math.sin(a) * R;
      if (k === 0) s.moveTo(x, y); else s.lineTo(x, y);
    });
    s.closePath();
    const m = new THREE.Mesh(new THREE.ShapeGeometry(s), makeMembraneMat(idCfg.color, idCfg.r, 1.1));
    gates[5].group.add(m);
    return m;
  };
  const doorL = hexHalf(-1), doorR = hexHalf(1);
  const pins = new THREE.Group();
  for (let k = 0; k < 12; k++) {
    const pin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.08), ringMat(C.cyan, 0.6));
    const a = (k / 12) * Math.PI * 2;
    pin.position.set(Math.cos(a) * idCfg.r * 1.24, Math.sin(a) * idCfg.r * 1.24, 0);
    pin.rotation.z = a;
    pins.add(pin);
  }
  gates[5].group.add(pins);

  /* ---- layer 6: infrastructure assembling itself ---- */
  const GRID = LOW ? 6 : 8;
  const CUBE_N = GRID * GRID;
  const cubes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.72, 0.72, 0.72), ringMat(C.teal, 0.24), CUBE_N);
  cubes.frustumCulled = false;
  const autoF = frameAt(STATIONS[6] + GATE_AHEAD + 0.004);
  const autoBase = at(STATIONS[6] + GATE_AHEAD + 0.004, -8.5, -3.2);
  const cubeData = [];
  for (let gx = 0; gx < GRID; gx++) for (let gz = 0; gz < GRID; gz++) {
    const target = autoBase.clone()
      .addScaledVector(autoF.rt, (gx - GRID / 2) * 0.95)
      .addScaledVector(autoF.f, (gz - GRID / 2) * 0.95)
      .addScaledVector(autoF.up, (Math.random() < 0.3 ? 1 : 0) * 0.95);
    const start = target.clone().addScaledVector(autoF.up, 5 + Math.random() * 7)
      .addScaledVector(autoF.rt, (Math.random() - 0.5) * 6);
    cubeData.push({ target, start, delay: (gx + gz) / (GRID * 2) });
  }
  scene.add(cubes);
  const gridLines = new THREE.GridHelper(GRID * 0.95 + 1, GRID + 1, C.cyan, C.teal);
  gridLines.material.transparent = true; gridLines.material.opacity = 0.25;
  gridLines.material.blending = THREE.AdditiveBlending; gridLines.material.depthWrite = false;
  gridLines.position.copy(autoBase).addScaledVector(autoF.up, -0.5);
  gridLines.quaternion.setFromUnitVectors(WORLD_UP, autoF.up);
  scene.add(gridLines);

  /* ---- the protected core: the vault and its incident reports ---- */
  const vaultPos = P(0.985);
  const vault = new THREE.Group(); vault.position.copy(vaultPos); scene.add(vault);
  vault.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.OctahedronGeometry(3.2, 0)),
    new THREE.LineBasicMaterial({ color: C.amber, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
  ));
  const vaultInner = new THREE.Mesh(new THREE.OctahedronGeometry(1.9, 0), ringMat(C.amber, 0.35));
  vault.add(vaultInner);
  vault.add(glow(C.amber, 14, 0.55));
  const orbits = [];
  for (let k = 0; k < 3; k++) {
    const o = new THREE.Mesh(new THREE.TorusGeometry(4.6 + k * 0.9, 0.02, 6, 128), ringMat(k === 1 ? C.teal : C.amber, 0.6));
    o.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    vault.add(o); orbits.push(o);
  }
  const reportTex = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 320;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(6,18,18,0.85)'; g.fillRect(0, 0, 256, 320);
    g.strokeStyle = 'rgba(23,209,172,0.9)'; g.lineWidth = 3; g.strokeRect(2, 2, 252, 316);
    g.fillStyle = 'rgba(255,184,77,0.95)'; g.fillRect(16, 18, 120, 12);
    g.fillStyle = 'rgba(23,209,172,0.55)';
    for (let y = 52; y < 300; y += 18) g.fillRect(16, y, 60 + Math.random() * 160, 6);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const reports = [];
  for (let k = 0; k < 4; k++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.5), new THREE.MeshBasicMaterial({
      map: reportTex, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    scene.add(m); reports.push({ mesh: m, phase: (k / 4) * Math.PI * 2 });
  }
  const vaultHit = new THREE.Mesh(new THREE.SphereGeometry(4, 10, 8), new THREE.MeshBasicMaterial({ visible: false }));
  vaultHit.userData.layer = 7; vault.add(vaultHit); hitTargets.push(vaultHit);

  /* ---------------- the packet ---------------- */
  const packet = new THREE.Group();
  packet.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 1), new THREE.MeshBasicMaterial({ color: C.white })));
  const packetGlow = glow(C.cyan, 0.75, 0.8); packet.add(packetGlow);
  packet.add(glow(C.teal, 2.0, 0.22));
  scene.add(packet);
  const TRAIL = 18;
  const trailPos = new Float32Array(TRAIL * 3);
  const trailCol = new Float32Array(TRAIL * 3);
  for (let i = 0; i < TRAIL; i++) {
    const k = Math.pow(1 - i / TRAIL, 2.2) * 0.8;
    trailCol[i * 3] = C.cyan.r * k; trailCol[i * 3 + 1] = C.cyan.g * k; trailCol[i * 3 + 2] = C.cyan.b * k;
  }
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3));
  const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  trail.frustumCulled = false;
  scene.add(trail);

  /* ---------------- post-processing ---------------- */
  let composer = null, bloom = null;
  if (!LOW) {
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(innerWidth, innerHeight);
    composer.addPass(new RenderPass(scene, camera));
    // Stacked additive layers can exceed 1.0 (or overflow) in the half-float buffer on some
    // GPUs, and bloom then smears that across the whole screen. Clamp before blooming.
    composer.addPass(new ShaderPass({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); if (!(c.r >= 0.0 && c.g >= 0.0 && c.b >= 0.0)) c.rgb = vec3(0.0); gl_FragColor = vec4(min(c.rgb, vec3(0.92)), 1.0); }',
    }));
    bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.8, 0.42, 0.22);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  /* ---------------- scroll → position on the route ---------------- */
  let anchors = [[0, 0]];
  let workTop = Infinity;
  function computeAnchors() {
    const vh = innerHeight;
    anchors = [[0, 0]];
    for (let i = 1; i <= 7; i++) {
      const r = document.getElementById('layer-' + i).getBoundingClientRect();
      anchors.push([r.top + scrollY + r.height / 2 - vh / 2, STATIONS[i]]);
    }
    workTop = document.getElementById('work').getBoundingClientRect().top + scrollY;
    anchors.push([workTop - vh * 0.15, T_END]);
  }
  function scrollToT(y) {
    if (y <= anchors[0][0]) return anchors[0][1];
    for (let k = 0; k < anchors.length - 1; k++) {
      const [y0, t0] = anchors[k], [y1, t1] = anchors[k + 1];
      if (y <= y1) return t0 + (t1 - t0) * ((y - y0) / Math.max(1, y1 - y0));
    }
    return T_END;
  }
  computeAnchors();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(computeAnchors);
  addEventListener('load', computeAnchors);

  /* ---------------- pointer: parallax, hover labels, click to jump ---------------- */
  const tip = document.getElementById('tip');
  const mouse = new THREE.Vector2(0, 0);
  const par = new THREE.Vector2(0, 0);
  const ray = new THREE.Raycaster();
  let pointerOnScene = false, hovered = 0, needsRay = false;
  const overUI = (el) => !!(el && el.closest && el.closest('.card, .nav, .rail, .btn, .solid, .foot, .hero .wrap a'));
  addEventListener('pointermove', (e) => {
    mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    pointerOnScene = e.pointerType === 'mouse' && !overUI(e.target);
    tip.style.left = e.clientX + 'px'; tip.style.top = e.clientY + 'px';
    needsRay = true;
  }, { passive: true });
  addEventListener('click', (e) => {
    if (!hovered || overUI(e.target)) return;
    document.getElementById('layer-' + hovered).scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  /* ---------------- resize ---------------- */
  let resizeTimer = 0;
  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    if (composer) { composer.setSize(innerWidth, innerHeight); bloom.setSize(innerWidth, innerHeight); }
    clearTimeout(resizeTimer); resizeTimer = setTimeout(computeAnchors, 150);
  });

  /* ---------------- animation loop ---------------- */
  const clock = new THREE.Clock();
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();
  let tCur = scrollToT(scrollY);
  let first = true;
  let frames = 0, slowAccum = 0, degraded = false;

  function frame() {
    requestAnimationFrame(frame);
    const rawDt = Math.min(clock.getDelta(), 0.25);   // real time: camera keeps up even on slow devices
    const dt = Math.min(rawDt, 0.05);                  // capped: animations never jump
    const time = clock.elapsedTime;

    // Nothing to draw once the solid sections fully cover the canvas.
    if (!first && scrollY > workTop + innerHeight * 0.4) return;

    const target = scrollToT(scrollY);
    tCur += (target - tCur) * Math.min(1, rawDt * 3.4);

    for (const m of timed) m.uniforms.uTime.value = time;

    // Camera rides just behind and above the packet.
    const F = frameAt(tCur);
    par.lerp(pointerOnScene ? mouse : new THREE.Vector2(0, 0), Math.min(1, dt * 2.2));
    camera.position.copy(F.p).addScaledVector(F.up, 0.75)
      .addScaledVector(F.rt, par.x * 0.9).addScaledVector(F.up, par.y * 0.5);
    camera.lookAt(P(tCur + 0.035).addScaledVector(F.rt, par.x * 0.4));
    haze.position.copy(camera.position);
    for (const s of glows) {
      s.getWorldPosition(tmpP);
      const k = s.userData.size;
      s.material.opacity = s.userData.base * THREE.MathUtils.smoothstep(tmpP.distanceTo(camera.position), k * 0.6, k * 1.8);
    }

    // Packet + its trail.
    const pk = P(tCur + 0.016);
    packet.position.copy(pk);
    packetGlow.scale.setScalar(0.7 + Math.sin(time * 6) * 0.12);
    trailPos.copyWithin(3, 0, (TRAIL - 1) * 3);
    trailPos[0] = pk.x; trailPos[1] = pk.y; trailPos[2] = pk.z;
    if (first) for (let i = 1; i < TRAIL; i++) { trailPos[i * 3] = pk.x; trailPos[i * 3 + 1] = pk.y; trailPos[i * 3 + 2] = pk.z; }
    trailGeo.attributes.position.needsUpdate = true;

    // Traffic along the links.
    for (let i = 0; i < STREAM_N; i++) {
      const s = streams[i];
      s.u += s.v * dt;
      if (s.u > 1) { s.u = 0; s.s = segs[(Math.random() * segs.length) | 0]; }
      const a = s.s[0] * 3, b = s.s[1] * 3;
      streamPos[i * 3] = nodePos[a] + (nodePos[b] - nodePos[a]) * s.u;
      streamPos[i * 3 + 1] = nodePos[a + 1] + (nodePos[b + 1] - nodePos[a + 1]) * s.u;
      streamPos[i * 3 + 2] = nodePos[a + 2] + (nodePos[b + 2] - nodePos[a + 2]) * s.u;
    }
    streamGeo.attributes.position.needsUpdate = true;

    // Gates: rotate, fade membranes as the camera passes through, react to hover.
    for (let i = 1; i <= 7; i++) {
      const g = gates[i];
      const dist = camera.position.distanceTo(g.group.position);
      const near = THREE.MathUtils.smoothstep(dist, 1.2, 9);
      g.hover += ((hovered === i ? 1 : 0) - g.hover) * Math.min(1, dt * 8);
      g.rings[0].mesh.rotation.z += dt * 0.12;
      g.rings[1].mesh.rotation.z -= dt * 0.2;
      g.rings[2].mesh.rotation.z += dt * 0.3;
      g.rings.forEach((r) => { r.mesh.material.opacity = r.base * (0.35 + 0.65 * near) * (1 + g.hover * 0.8); });
      g.membranes.forEach((m) => { m.mesh.material.uniforms.uOpacity.value = m.base * near * (1 + g.hover * 0.6); });
      g.group.scale.setScalar(1 + g.hover * 0.05);
    }

    // Layer 4 — findings shed away from the hardened host.
    hostGroup.rotation.y += dt * 0.25; hostGroup.rotation.x += dt * 0.09;
    hostEdges.material.opacity = 0.6 + Math.sin(time * 2.0) * 0.25;
    for (let k = 0; k < FRAG_N; k++) {
      const f = fragData[k];
      const s = (time * f.speed + f.phase) % 1;
      tmpP.copy(f.dir).multiplyScalar(2.4 + s * 6.5);
      tmpE.set(f.spin.x * time, f.spin.y * time, f.spin.z * time);
      tmpQ.setFromEuler(tmpE);
      tmpS.setScalar(Math.max(0.001, 1 - s));
      tmpM.compose(tmpP, tmpQ, tmpS);
      frags.setMatrixAt(k, tmpM);
    }
    frags.instanceMatrix.needsUpdate = true;

    // Layer 5 — the identity gate opens as the packet arrives.
    const idDist = packet.position.distanceTo(gates[5].group.position);
    const open = 1 - THREE.MathUtils.smoothstep(idDist, 3, 15);
    doorL.position.x = -open * idCfg.r * 1.05;
    doorR.position.x = open * idCfg.r * 1.05;
    pins.rotation.z += dt * (0.15 + open * 1.2);
    pins.children.forEach((p) => { p.material.opacity = 0.35 + open * 0.6; });

    // Layer 6 — infrastructure assembles, holds, then rebuilds.
    const cycle = (time * 0.11) % 1;
    for (let k = 0; k < CUBE_N; k++) {
      const c = cubeData[k];
      let u;
      if (cycle < 0.6) u = THREE.MathUtils.smootherstep(clamp01((cycle - c.delay * 0.35) / 0.25), 0, 1);
      else if (cycle < 0.86) u = 1;
      else u = 1 - THREE.MathUtils.smootherstep(clamp01((cycle - 0.86) / 0.12), 0, 1);
      tmpP.lerpVectors(c.start, c.target, u);
      tmpQ.identity();
      tmpS.setScalar(0.25 + u * 0.75);
      tmpM.compose(tmpP, tmpQ, tmpS);
      cubes.setMatrixAt(k, tmpM);
    }
    cubes.instanceMatrix.needsUpdate = true;

    // The core.
    vault.rotation.y += dt * 0.2;
    vaultInner.rotation.x += dt * 0.6;
    orbits.forEach((o, k) => { o.rotation.z += dt * (0.2 + k * 0.12); o.rotation.x += dt * 0.05; });
    for (const r of reports) {
      const a = r.phase + time * 0.22;
      r.mesh.position.set(vaultPos.x + Math.cos(a) * 6.6, vaultPos.y + Math.sin(a * 2) * 0.9, vaultPos.z + Math.sin(a) * 6.6);
      r.mesh.lookAt(camera.position);
    }

    // Hover labels.
    if (needsRay) {
      needsRay = false;
      let found = 0;
      if (pointerOnScene) {
        ray.setFromCamera(mouse, camera);
        const hits = ray.intersectObjects(hitTargets, false);
        if (hits.length && hits[0].distance < 70) found = hits[0].object.userData.layer;
      }
      if (found !== hovered) {
        hovered = found;
        if (hovered) {
          const L = LAYERS[hovered];
          tip.innerHTML = `<b>LAYER 0${hovered}</b>&nbsp; ${L.name} — ${L.zone} &nbsp;·&nbsp; click to open`;
          tip.classList.add('on');
          document.body.style.cursor = 'pointer';
        } else {
          tip.classList.remove('on');
          document.body.style.cursor = '';
        }
      }
    }

    if (composer) composer.render(); else renderer.render(scene, camera);

    if (first) { first = false; canvas.classList.add('ready'); }

    // Adaptive quality: if the device can't keep up, drop bloom and resolution once.
    if (!degraded && frames < 150) {
      frames++;
      if (frames > 30) slowAccum += dt;
      if (frames === 150 && slowAccum / 120 > 1 / 34) {
        degraded = true;
        composer = null;
        pixelRatio = 1;
        renderer.setPixelRatio(1);
        renderer.setSize(innerWidth, innerHeight, false);
      }
    }
  }
  frame();
}
