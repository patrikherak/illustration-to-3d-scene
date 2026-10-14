import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const usage = `usage: node verify/shoot.mjs <still|sequence|fps|compare|gif|kiosk> [url] [options]

  still     --out FILE [--t SECONDS]                       one frame, time frozen
  sequence  --out DIR --times 0,2,4 [--sheet] [--crop X0 Y0 X1 Y1]
                                                           frames at given scene times, contact sheet of a crop
  fps       [--seconds 5] [--warmup 2] [--uncapped]        frame rate at --size (default 3840x2160, dpr 1)
  compare   --reference PNG --out DIR [--t SECONDS] [--crop X0 Y0 X1 Y1]
                                                           render at the reference size, then edge overlay,
                                                           side by side and edge score via tools/overlay.py
  gif       --out FILE [--reference PNG] [--start T] [--seconds 7] [--fps 12] [--width 960] [--hold 1.2] [--fade 0.8]
                                                           frames on the GPU, assembled by tools/animate.py: opens on the
                                                           reference, cross-fades into the render, loops back
  kiosk                                                    offline reload from the precache, reload on context loss
common:     --size WxH (default 1200x800)  --dpr N (default 2)  --query "quality=low&fit=cover"
            --headed  GPU_FLAGS="..." overrides the GPU switches  PYTHON=... picks the interpreter`;

const GPU_FLAGS = {
  darwin: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
  linux: ['--use-angle=vulkan', '--enable-features=Vulkan', '--enable-gpu', '--ignore-gpu-blocklist'],
  win32: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
};
const UNCAPPED_FLAGS = ['--disable-gpu-vsync', '--disable-frame-rate-limit'];
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|software/i;

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = { url: 'http://localhost:5188/', positional: [] };
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (!arg.startsWith('--')) {
      options.positional.push(arg);
      continue;
    }
    const key = arg.slice(2);
    if (['headed', 'uncapped', 'sheet'].includes(key)) options[key] = true;
    else if (key === 'crop') {
      options.crop = rest.slice(i + 1, i + 5).map(Number);
      i += 4;
    }
    else options[key] = rest[++i];
  }
  if (options.positional[0]) options.url = options.positional[0];
  return { command, options };
}

function pngSize(file) {
  const header = readFileSync(file);
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

function sizeOf(text, fallback) {
  if (!text) return fallback;
  const [width, height] = text.split('x').map(Number);
  return { width, height };
}

function withQuery(url, extra) {
  const target = new URL(url);
  for (const [key, value] of new URLSearchParams(extra ?? '')) target.searchParams.set(key, value);
  return target.toString();
}

function python() {
  if (process.env.PYTHON) return process.env.PYTHON;
  const venv = join(repo, '.venv', 'bin', 'python');
  return existsSync(venv) ? venv : 'python3';
}

function overlay(mode, ...args) {
  const tool = mode === 'gif' ? ['animate.py'] : ['overlay.py', mode];
  const output = execFileSync(python(), [join(repo, 'tools', ...tool.slice(0, 1)), ...tool.slice(1), ...args], { encoding: 'utf8', maxBuffer: 1 << 26 });
  process.stdout.write(output);
  return output;
}

async function openScene(options, { size, dpr, query, uncapped = false }) {
  const flags = process.env.GPU_FLAGS ? process.env.GPU_FLAGS.split(/\s+/).filter(Boolean) : GPU_FLAGS[process.platform] ?? [];
  const browser = await chromium.launch({
    headless: !options.headed,
    channel: 'chromium',
    args: [...flags, ...(uncapped ? UNCAPPED_FLAGS : [])],
  });
  const page = await browser.newPage({ viewport: size, deviceScaleFactor: dpr });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
  await page.goto(withQuery(options.url, query), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__scene && window.__scene.clock.frames > 5, null, { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  const renderer = await page.evaluate(() => window.__scene.renderer);
  console.log(`renderer: ${renderer}`);
  if (SOFTWARE_RENDERER.test(renderer)) console.warn('warning: software rendering, edges and frame rate are not representative');
  const settle = async (frames = 4) => {
    const start = await page.evaluate(() => window.__scene.clock.frames);
    await page.waitForFunction((target) => window.__scene.clock.frames >= target, start + frames);
  };
  return { browser, page, errors, settle };
}

async function seekAndShoot(scene, time, file) {
  await scene.page.evaluate((t) => window.__scene.seek(t), time);
  await scene.settle();
  mkdirSync(dirname(file), { recursive: true });
  await scene.page.screenshot({ path: file });
  console.log(`wrote ${file} (t=${time})`);
}

async function still(options) {
  const out = options.out ?? 'shots/still.png';
  const time = Number(options.t ?? 0);
  const scene = await openScene(options, {
    size: sizeOf(options.size, { width: 1200, height: 800 }),
    dpr: Number(options.dpr ?? 2),
    query: `t=${time}&adaptive=0&ui=0&${options.query ?? ''}`,
  });
  await seekAndShoot(scene, time, out);
  await finish(scene);
}

async function sequence(options) {
  const out = options.out ?? 'shots/sequence';
  const times = (options.times ?? '0,1,2,3,4,5').split(',').map(Number);
  const scene = await openScene(options, {
    size: sizeOf(options.size, { width: 1200, height: 800 }),
    dpr: Number(options.dpr ?? 1),
    query: `t=${times[0]}&adaptive=0&ui=0&${options.query ?? ''}`,
  });
  const files = [];
  for (const time of times) {
    const file = join(out, `t-${time.toFixed(2).padStart(6, '0')}.png`);
    await seekAndShoot(scene, time, file);
    files.push(file);
  }
  await finish(scene);
  const dpr = Number(options.dpr ?? 1);
  const crop = options.crop ? ['--crop', ...options.crop.map((value) => String(Math.round(value * dpr)))] : [];
  if (options.sheet) overlay('sheet', ...files, '--out', join(out, 'sheet.png'), ...crop, '--labels', ...times.map((t) => `t=${t}`));
}

async function fps(options) {
  const seconds = Number(options.seconds ?? 5);
  const warmup = Number(options.warmup ?? 2);
  const size = sizeOf(options.size, { width: 3840, height: 2160 });
  const scene = await openScene(options, { size, dpr: Number(options.dpr ?? 1), query: options.query, uncapped: options.uncapped });
  await scene.page.waitForTimeout(warmup * 1000);
  const result = await scene.page.evaluate(
    (duration) =>
      new Promise((done) => {
        const stamps = [];
        const start = performance.now();
        const tick = (now) => {
          stamps.push(now);
          if (now - start < duration * 1000) requestAnimationFrame(tick);
          else {
            const gaps = stamps.slice(1).map((t, i) => t - stamps[i]).sort((a, b) => a - b);
            const pick = (q) => gaps[Math.min(gaps.length - 1, Math.floor(q * gaps.length))];
            done({
              fps: (stamps.length - 1) / ((stamps[stamps.length - 1] - stamps[0]) / 1000),
              p50: pick(0.5),
              p95: pick(0.95),
              p99: pick(0.99),
              dpr: window.__scene.dpr(),
              canvas: [document.querySelector('canvas').width, document.querySelector('canvas').height],
            });
          }
        };
        requestAnimationFrame(tick);
      }),
    seconds,
  );
  console.log(
    `fps ${result.fps.toFixed(1)} over ${seconds}s at ${size.width}x${size.height} css px, canvas ${result.canvas.join('x')} (dpr ${result.dpr.toFixed(2)})` +
      ` | frame ms p50 ${result.p50.toFixed(1)} p95 ${result.p95.toFixed(1)} p99 ${result.p99.toFixed(1)}${options.uncapped ? ' | vsync off' : ''}`,
  );
  await finish(scene);
}

async function compare(options) {
  if (!options.reference) throw new Error('compare needs --reference PNG');
  const out = options.out ?? 'shots/compare';
  const time = Number(options.t ?? 0);
  const render = join(out, 'render.png');
  const scene = await openScene(options, {
    size: sizeOf(options.size, pngSize(options.reference)),
    dpr: Number(options.dpr ?? 2),
    query: `t=${time}&adaptive=0&ui=0&${options.query ?? ''}`,
  });
  await seekAndShoot(scene, time, render);
  await finish(scene);
  const crop = options.crop ? ['--crop', ...options.crop.map(String)] : [];
  const zoom = options.crop ? ['--zoom', String(options.zoom ?? 3)] : [];
  overlay('edges', options.reference, render, '--out', join(out, 'edges.png'), ...crop, ...zoom);
  overlay('side', options.reference, render, '--out', join(out, 'side.png'), ...crop, ...zoom);
  overlay('score', options.reference, render, ...crop);
}

async function gif(options) {
  const out = options.out ?? 'docs/images/demo.webp';
  const framesDir = options.frames ?? 'shots/gif-frames';
  const fps = Number(options.fps ?? 12);
  const start = Number(options.start ?? 0);
  const seconds = Number(options.seconds ?? 7);
  const size = sizeOf(options.size, options.reference ? pngSize(options.reference) : { width: 1200, height: 800 });
  const scene = await openScene(options, { size, dpr: Number(options.dpr ?? 2), query: `t=${start}&adaptive=0&ui=0&${options.query ?? ''}` });
  rmSync(framesDir, { recursive: true, force: true });
  const files = [];
  const count = Math.round(seconds * fps);
  for (let i = 0; i < count; i++) {
    const file = join(framesDir, `f-${String(i).padStart(4, '0')}.png`);
    await scene.page.evaluate((t) => window.__scene.seek(t), start + i / fps);
    await scene.settle(2);
    mkdirSync(framesDir, { recursive: true });
    await scene.page.screenshot({ path: file });
    files.push(file);
  }
  console.log(`captured ${files.length} frames from t=${start} at ${fps} fps`);
  await finish(scene);
  const reference = options.reference ? ['--reference', options.reference] : [];
  const crop = options.crop ? ['--crop', ...options.crop.map(String), String(size.width)] : [];
  overlay('gif', ...files, '--out', out, '--fps', String(fps), '--width', String(options.width ?? 960), ...reference, ...crop,
    ...(options.hold ? ['--hold', options.hold] : []), ...(options.fade ? ['--fade', options.fade] : []));
}

async function kiosk(options) {
  const scene = await openScene(options, { size: { width: 960, height: 640 }, dpr: 1, query: 'ui=0' });
  const { page } = scene;
  const ready = () => page.waitForFunction(() => window.__scene && window.__scene.clock.frames > 5, null, { timeout: 30000 });
  const precached = await page
    .waitForFunction(() => Boolean(navigator.serviceWorker && navigator.serviceWorker.controller), null, { timeout: 10000 })
    .then(() => true, () => false);
  if (precached) {
    await page.context().setOffline(true);
    await page.reload();
    await ready();
    await page.context().setOffline(false);
    console.log('offline reload: ok');
  } else {
    console.log('offline reload: skipped, no service worker (dev server? use npm run build && npm run preview)');
  }
  const reloaded = page.waitForEvent('load', { timeout: 15000 });
  await page.evaluate(() => document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await reloaded;
  await ready();
  console.log('reload after webglcontextlost: ok');
  await finish(scene);
}

async function finish(scene) {
  if (scene.errors.length) console.warn(`page errors:\n  ${scene.errors.join('\n  ')}`);
  await scene.browser.close();
}

const { command, options } = parseArgs(process.argv.slice(2));
const commands = { still, sequence, fps, compare, gif, kiosk };
if (!commands[command]) {
  console.log(usage);
  process.exit(command ? 1 : 0);
}
await commands[command](options);
