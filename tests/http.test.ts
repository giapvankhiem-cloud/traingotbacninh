import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { MAX_PROMPT_LENGTH, cropKey } from '../src/utils/aiValidation';

let child: ChildProcess;
let origin = '';
let output = '';
let diagnosisRequests = 0;
let chatRequests = 0;
before(async () => {
  const listener = createServer(); listener.listen(0, '127.0.0.1'); await once(listener, 'listening');
  const port = (listener.address() as { port: number }).port;
  await new Promise<void>((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  origin = `http://127.0.0.1:${port}`;
  // Never call a paid AI endpoint or forward a developer's key during tests.
  child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    env: { ...process.env, NODE_ENV: 'test', PORT: String(port), GEMINI_API_KEY: '' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (chunk) => { output += chunk; }); child.stderr?.on('data', (chunk) => { output += chunk; });
  for (let attempt = 0; attempt < 150; attempt++) {
    if (child.exitCode !== null) throw new Error(`Local server exited: ${output.slice(-1500)}`);
    try { if ((await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1000) })).ok) return; } catch { /* Wait for this test's own process. */ }
    await delay(50);
  }
  throw new Error(`Local server did not become ready: ${output.slice(-1500)}`);
});
after(async () => {
  if (!child || child.exitCode !== null) return;
  const exited = once(child, 'exit'); child.kill('SIGTERM');
  await Promise.race([exited, delay(3000)]);
  if (child.exitCode === null) child.kill('SIGKILL');
});
async function post(path: 'chat' | 'diagnosis', body: unknown) {
  if (path === 'chat') chatRequests++; else diagnosisRequests++;
  const response = await fetch(`${origin}/api/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000) });
  return { response, body: await response.json() as any };
}

test('HTTP health and static site work with AI explicitly disabled', async () => {
  const response = await fetch(`${origin}/api/health`); const data = await response.json() as any;
  assert.equal(response.status, 200); assert.equal(data.status, 'ok'); assert.equal(data.aiEnabled, false);
  assert.equal(response.headers.get('x-powered-by'), null); assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  const page = await fetch(origin); assert.equal(page.status, 200); assert.match(await page.text(), /id="root"/);
});

test('HTTP malformed JSON receives a structured 400 rather than crashing the server', async () => {
  const response = await fetch(`${origin}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' });
  assert.equal(response.status, 400); assert.equal((await response.json() as any).success, false);
  assert.equal((await fetch(`${origin}/api/health`)).status, 200);
});

test('HTTP public garden details and the deferred QR encoder load with valid optimized modules', async () => {
  const detail = await fetch(`${origin}/src/components/ProductDetailModal.tsx`);
  assert.equal(detail.status, 200);
  assert.match(detail.headers.get('content-type') || '', /javascript/);
  const trace = await fetch(`${origin}/src/components/Traceability.tsx`);
  assert.equal(trace.status, 200);
  const moduleSource = await trace.text();
  const qrPath = moduleSource.match(/["']([^"']*\/qrcode\.js(?:\?[^"']*)?)["']/)?.[1];
  assert.ok(qrPath, 'The packing label must reference an optimized QR encoder');
  const encoder = await fetch(new URL(qrPath, origin));
  assert.equal(encoder.status, 200, 'QR dependency must not return 504 Outdated Optimize Dep');
  assert.match(encoder.headers.get('content-type') || '', /javascript/);
});

test('HTTP chat rejects empty, non-string and oversized prompts', async () => {
  for (const prompt of ['', '   ', 123, 'x'.repeat(MAX_PROMPT_LENGTH + 1)]) {
    const result = await post('chat', { prompt }); assert.equal(result.response.status, 400); assert.equal(result.body.success, false);
  }
});

test('HTTP missing AI configuration returns an honest unavailable error without private fields', async () => {
  const result = await post('chat', { prompt: 'Cách chăm sóc vải sau thu hoạch?', currentFarmer: { name: 'Vườn thử HTTP', password: 'NEVER-ECHO-SECRET', accessToken: 'NEVER-ECHO-TOKEN' } });
  assert.equal(result.response.status, 503); assert.equal(result.body.success, false); assert.equal(result.body.code, 'AI_NOT_CONFIGURED');
  assert.equal(result.body.reply, undefined); assert.doesNotMatch(JSON.stringify(result.body), /NEVER-ECHO/);
});

test('HTTP diagnosis rejects invalid types, unsupported plants and invalid image data', async () => {
  for (const body of [{ plantType: 123 }, { plantType: 'Cây không được hỗ trợ' }, { plantType: 'Vải thiều', imageBase64: 'not-an-image', mimeType: 'image/png' }]) {
    const result = await post('diagnosis', body); assert.equal(result.response.status, 400); assert.equal(result.body.success, false);
  }
});

test('HTTP diagnosis without an AI key never invents a diagnosis', async () => {
  for (const plantType of ['Vải thiều', 'Cam đường Canh']) {
    const result = await post('diagnosis', { plantType, affectedPart: 'Lá', symptomsDescription: 'Đốm lá thử nghiệm' });
    assert.equal(result.response.status, 503); assert.equal(result.body.success, false);
    assert.equal(result.body.diagnosis, undefined);
  }
});

test('HTTP diagnosis enforces its independent request limit and supplies Retry-After', async () => {
  while (diagnosisRequests < 6) await post('diagnosis', { plantType: 'Vải thiều' });
  const result = await post('diagnosis', { plantType: 'Vải thiều' });
  assert.equal(result.response.status, 429); assert.equal(result.body.success, false);
  assert.ok(Number(result.response.headers.get('retry-after')) > 0);
});

test('HTTP chat has a separate limit and remains independent of diagnosis throttling', async () => {
  while (chatRequests < 30) { const result = await post('chat', { prompt: 'Chăm sóc vườn' }); assert.equal(result.response.status, 503); }
  const result = await post('chat', { prompt: 'Chăm sóc vườn' });
  assert.equal(result.response.status, 429); assert.ok(Number(result.response.headers.get('retry-after')) > 0);
});
