import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const require = createRequire(import.meta.url);
const environment = { ...process.env };
if (process.platform === 'win32') {
  const javaRoot = resolve('.tools/java');
  if (!environment.JAVA_HOME && existsSync(javaRoot)) {
    const name = readdirSync(javaRoot).find((name) => existsSync(join(javaRoot, name, 'bin/java.exe')));
    if (name) environment.JAVA_HOME = join(javaRoot, name);
  }
  const pathKey = Object.keys(environment).find((key) => key.toLowerCase() === 'path') || 'PATH';
  if (environment.JAVA_HOME) environment[pathKey] = join(environment.JAVA_HOME, 'bin') + ';' + (environment[pathKey] || '');
  const socketDir = resolve('.tools/tmp'); mkdirSync(socketDir, { recursive: true });
  environment.JAVA_TOOL_OPTIONS = (environment.JAVA_TOOL_OPTIONS || '') + ` -Djdk.net.unixdomain.tmpdir="${socketDir}"`;
}
const full = process.argv.includes('--full');
const datasets = process.argv.includes('--datasets');
const consultations = process.argv.includes('--consultations');
const expertAccounts = process.argv.includes('--expert-accounts');
const wordingUi = process.argv.includes('--wording-ui');
const landingUi = process.argv.includes('--landing-ui');
const seasonalUi = process.argv.includes('--seasonal-ui');
const mediaUi = process.argv.includes('--media-ui');
const consultationUi = process.argv.includes('--consultation-ui');
const ui = process.argv.includes('--ui') || consultationUi || mediaUi || seasonalUi || landingUi || wordingUi;
const withAuth = full || datasets || consultations || expertAccounts || ui;
const runner = `"${process.execPath}" "${require.resolve('tsx/cli')}"`;
// Vite/Firebase in JSDOM retain a background timer after explicit cleanup.
// Exit only after the runner has finished every test and cleanup hook; failures
// still return a nonzero status, and individual tests retain the 30s deadline.
const files = full ? 'tests/firestore-rules.test.ts tests/firebase-workflow.test.ts tests/firebase-extended.test.ts tests/firebase-datasets.test.ts tests/moderation.test.ts tests/react-workflow.test.tsx tests/consultations.test.ts tests/expert-accounts.test.ts' : ui ? 'tests/react-workflow.test.tsx' : expertAccounts ? 'tests/consultations.test.ts tests/expert-accounts.test.ts' : consultations ? 'tests/consultations.test.ts' : datasets ? 'tests/firebase-datasets.test.ts' : 'tests/firestore-rules.test.ts';
const command = `${runner} --test --test-force-exit --test-timeout=30000 --test-concurrency=1 ${consultationUi ? '--test-name-pattern="consultation|expert"' : mediaUi ? '--test-name-pattern="community|garden media"' : seasonalUi ? '--test-name-pattern="seasonal notices"' : landingUi ? '--test-name-pattern="role landing"' : wordingUi ? '--test-name-pattern="React publish form|React product edit|React cart|React market search|React buyer trace|React failed product|React cultivation calendar|React certificate form"' : ''} ${files}`;
const child = spawn(process.execPath, [require.resolve('firebase-tools/lib/bin/firebase.js'), 'emulators:exec', '--project', 'demo-traingot', '--only', withAuth ? 'auth,firestore' : 'firestore', command], { env: environment, stdio: 'inherit' });
child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
