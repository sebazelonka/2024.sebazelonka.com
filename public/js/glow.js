/* Animated background glow (WebGPU via vgpu). Progressive enhancement:
   the static CSS glow stays until this module proves WebGPU works here. */

const prefersReducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const isMobile = matchMedia("(max-width: 767px)");
const canvas = document.querySelector("canvas.glow-canvas");

// 1 = the current drift. 2 moves twice as fast, 0.5 half as fast.
const SPEED = 1;

const THEME_COLORS = {
  dark: {
    a: [0.0, 0.82, 0.843], // hsl(184 100% 41%) — the old static glow color
    b: [0.706, 0.925, 0.318], // #b4ec51
    strength: 0.4,
  },
  light: {
    a: [0.0, 0.459, 0.467], // hsl(183 100% 23%)
    b: [0.294, 0.42, 0.0], // #4b6b00
    strength: 0.32,
  },
};

const WGSL = `
struct Params {
  time: f32,
  speed: f32,
  size: vec2f,
  colorA: vec3f,
  colorB: vec3f,
  strength: f32,
};
@group(0) @binding(0) var<uniform> params: Params;

fn blob(p: vec2f, center: vec2f, radius: f32) -> f32 {
  let d = distance(p, center) / radius;
  let fall = smoothstep(1.0, 0.0, d);
  return fall * fall;
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let aspect = max(params.size.x / params.size.y, 0.0001);
  let p = vec2f(uv.x * aspect, 1.0 - uv.y);
  let t = params.time * params.speed;

  let centerA = vec2f(
    (0.16 + 0.05 * sin(t * 0.11)) * aspect,
    0.82 + 0.05 * sin(t * 0.07 + 1.7)
  );
  let centerB = centerA + vec2f(
    0.22 * cos(t * 0.05),
    0.16 * sin(t * 0.043)
  );

  let a = blob(p, centerA, 0.5);
  let b = blob(p, centerB, 0.3);
  let glow = a * 0.75 + b * 0.55;
  let color = mix(params.colorA, params.colorB, clamp(b / max(a + b, 0.0001), 0.0, 1.0));
  let fade = smoothstep(0.0, 0.06, uv.x);
  let alpha = clamp(glow, 0.0, 1.0) * params.strength * fade;
  return vec4f(color * alpha, alpha);
}
`;

function resolveTheme() {
  const theme = document.documentElement.dataset.theme;
  if (theme === "light" || theme === "dark") return theme;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

let running = false;
let gpu = null;

async function start() {
  if (!canvas || running) return;
  running = true;
  const { clock, effect, frameLoop, init, surface } = await import(
    "/js/vendor/vgpu.esm.js"
  );
  gpu = await init();
  const output = surface(gpu, canvas, { dpr: [0.5, 1] });
  const theme = () => THEME_COLORS[resolveTheme()];

  const shader = effect(gpu, WGSL, {
    set: {
      params: {
        time: 0,
        speed: SPEED,
        size: output.size,
        colorA: theme().a,
        colorB: theme().b,
        strength: theme().strength,
      },
    },
  });

  output.onResize(() => shader.set({ params: { size: output.size } }));

  const applyTheme = () =>
    shader.set({
      params: {
        colorA: theme().a,
        colorB: theme().b,
        strength: theme().strength,
      },
    });
  new MutationObserver(applyTheme).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.(
    "change",
    applyTheme
  );

  const time = clock(gpu);
  frameLoop(gpu, (frame) => {
    shader.set({ params: { time: time.time } });
    frame.pass(output, shader);
  });

  document.body.classList.add("glow-live");
}

function stop() {
  running = false;
  gpu?.dispose();
  gpu = null;
  if (canvas) canvas.width = 0;
  document.body.classList.remove("glow-live");
}

function sync() {
  if (isMobile.matches) {
    stop();
  } else if (!running) {
    start().catch(() => {
      // WebGPU unavailable or init failed: the static CSS glow stays.
      running = false;
    });
  }
}

if (canvas && !prefersReducedMotion.matches && "gpu" in navigator) {
  sync();
  isMobile.addEventListener?.("change", sync);
}
