// Run real components in an isolated temporary Next app using explicit UI
// fixtures. This is distinct from real PostgreSQL tests and hosted acceptance.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, symlink, unlink, rm } from "node:fs/promises";
import { tmpdir, homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(root, "package.json"));
const playwrightPath = process.env.PLAYWRIGHT_MODULE || path.join(homedir(), ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const { chromium } = require(playwrightPath);
const temp = await mkdtemp(path.join(tmpdir(), "task-analytics-ui-"));
let server;
let browser;
let serverLog = "";
try {
  await mkdir(path.join(temp, "app"));
  await symlink(path.join(root, "node_modules"), path.join(temp, "node_modules"), "junction");
  await writeFile(path.join(temp, "package.json"), JSON.stringify({ name: "analytics-ui-fixture", private: true, type: "module" }));
  const config = JSON.parse(await readFile(path.join(root, "tsconfig.json"), "utf8"));
  config.compilerOptions.paths = { "@/*": [root.replaceAll("\\", "/") + "/*"] };
  await writeFile(path.join(temp, "tsconfig.json"), JSON.stringify(config));
  await writeFile(path.join(temp, "next.config.mjs"), `export default { experimental: { externalDir: true }, webpack(config) { config.resolve.alias['@'] = ${JSON.stringify(root)}; return config; } };`);
  await writeFile(path.join(temp, "app/page.tsx"), await readFile(path.join(root, "tests/browser/analytics-fixture.tsx"), "utf8"));
  await writeFile(path.join(temp, "app/layout.tsx"), 'import "@/app/globals.css"; export default function Layout({children}: {children: React.ReactNode}) { return <html lang="en"><body><main className="main-content">{children}</main></body></html>; }');
  server = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "dev", "--webpack", "--port", "3004", "--hostname", "127.0.0.1"], { cwd: temp, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout.on("data", (chunk) => { serverLog += chunk; });
  server.stderr.on("data", (chunk) => { serverLog += chunk; });
  const url = "http://127.0.0.1:3004";
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(url)).ok) { ready = true; break; } } catch { /* Startup only; fail below with diagnostics. */ }
    if (serverLog.includes("Module not found")) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(ready, serverLog);
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url);

  await page.route('https://**/*', route => route.abort());
  await page.getByRole('heading',{name:'Analytics',exact:true}).waitFor();
  const card = label => page.getByRole('article',{name:label,exact:true});
  await card('Focused time · selected period').getByText('1h 15m',{exact:true}).waitFor();
  await card('Reading · exclusive time').getByText('15 min',{exact:true}).waitFor();
  await card('Tasks completed').getByText('1',{exact:true}).waitFor();
  await page.getByText('Manual: 45 min · Prediction: 30 min',{exact:true}).waitFor();
  await page.getByText('40 pages',{exact:true}).waitFor();
  await page.getByText('40 / 200 pages · 20%',{exact:true}).waitFor();
  await page.getByText(/Prediction error: 30 min mean absolute/).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(process.env.ANALYTICS_SCREENSHOT_DIR){await mkdir(process.env.ANALYTICS_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.ANALYTICS_SCREENSHOT_DIR,'analytics-desktop.png'),fullPage:true});}
  await page.getByLabel('Period',{exact:true}).selectOption('month');
  await card('Focused time · selected period').getByText('1h 15m',{exact:true}).waitFor();
  await page.getByLabel('Date within period').fill('2020-01-01');
  await page.getByText(/No activity in this period/).waitFor();
  await card('Focused time this week').getByText('1h 15m',{exact:true}).waitFor();
  await page.reload();
  await card('Focused time · selected period').getByText('1h 15m',{exact:true}).waitFor();
  await page.setViewportSize({width:320,height:900});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(process.env.ANALYTICS_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.ANALYTICS_SCREENSHOT_DIR,'analytics-mobile.png'),fullPage:true});
  await page.evaluate(()=>localStorage.setItem('analytics-fixture-fail','true'));
  await page.getByRole('button',{name:'Reload analytics',exact:true}).click();
  await page.getByRole('alert').getByText(/Fixture load failure/).waitFor();
  assert.equal(await card('Tasks completed').count(),0);
  await page.evaluate(()=>localStorage.removeItem('analytics-fixture-fail'));
  await page.getByRole('button',{name:'Reload analytics',exact:true}).click();
  await card('Tasks completed').getByText('1',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Empty fixture',exact:true}).click();
  await page.getByText(/No activity in this period/).waitFor();
  await page.getByText('No books yet. Add a book in Reading.',{exact:true}).waitFor();
  await page.getByText('Not enough comparable prediction history.',{exact:false}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);
  console.log('PASS: Analytics desktop and 320px — totals, overlap, estimates, period selection, progress, empty state, errors and retry. Local fixtures only.');
} finally {
  if (browser) await browser.close();
  if (server) { server.kill(); await new Promise((resolve) => { if (server.exitCode !== null) resolve(); else server.once("exit", resolve); }); }
  // Only remove the freshly created directory owned by this test. Removing the
  // node_modules junction first prevents traversing the application's packages.
  const resolved = path.resolve(temp);
  assert.ok(resolved.startsWith(path.resolve(tmpdir()) + path.sep));
  assert.ok(path.basename(resolved).startsWith("task-analytics-ui-"));
  await unlink(path.join(resolved, "node_modules"));
  await rm(resolved, { recursive: true, force: true, maxRetries: 3 });
}

