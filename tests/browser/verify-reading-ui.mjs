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
const temp = await mkdtemp(path.join(tmpdir(), "task-reading-ui-"));
let server;
let browser;
let serverLog = "";
try {
  await mkdir(path.join(temp, "app"));
  await symlink(path.join(root, "node_modules"), path.join(temp, "node_modules"), "junction");
  await writeFile(path.join(temp, "package.json"), JSON.stringify({ name: "reading-ui-fixture", private: true, type: "module" }));
  const config = JSON.parse(await readFile(path.join(root, "tsconfig.json"), "utf8"));
  config.compilerOptions.paths = { "@/*": [root.replaceAll("\\", "/") + "/*"] };
  await writeFile(path.join(temp, "tsconfig.json"), JSON.stringify(config));
  await writeFile(path.join(temp, "next.config.mjs"), `export default { experimental: { externalDir: true }, webpack(config) { config.resolve.alias['@'] = ${JSON.stringify(root)}; return config; } };`);
  await writeFile(path.join(temp, "app/page.tsx"), await readFile(path.join(root, "tests/browser/reading-fixture.tsx"), "utf8"));
  await writeFile(path.join(temp, "app/layout.tsx"), 'import "@/app/globals.css"; export default function Layout({children}: {children: React.ReactNode}) { return <html lang="en"><body><main className="main-content">{children}</main></body></html>; }');
  server = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "dev", "--webpack", "--port", "3003", "--hostname", "127.0.0.1"], { cwd: temp, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout.on("data", (chunk) => { serverLog += chunk; });
  server.stderr.on("data", (chunk) => { serverLog += chunk; });
  const url = "http://127.0.0.1:3003";
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

  const form=()=>page.getByRole("form",{name:"Add a book",exact:true});
  await form().getByLabel("Book title",{exact:true}).fill("Reading QA");await form().getByLabel("Total pages",{exact:true}).fill("200");
  await form().getByLabel("Author (optional)").fill("Test Author");await form().getByLabel("Weekly page goal (optional)").fill("50");
  await form().getByRole("button",{name:"Add book",exact:true}).click();
  const card=()=>page.getByRole("article",{name:"Reading QA",exact:true});await card().getByText("Want to Read",{exact:true}).waitFor();
  await card().getByRole("button",{name:"Start reading",exact:true}).click();
  await card().locator(".reading-log > summary").click();
  const log=()=>card().getByRole("form",{name:"Log reading for Reading QA",exact:true});
  await log().getByLabel("Ending page",{exact:true}).fill("20");await log().getByLabel("Minutes (optional)").fill("15");
  await log().getByRole("button",{name:"Log reading",exact:true}).click();await card().getByText("20 / 200 pages",{exact:true}).waitFor();
  await card().getByText("20 / 50 pages",{exact:true}).waitFor();await page.reload();await card().getByText("20 / 200 pages",{exact:true}).waitFor();
  await card().getByText("Reading history (1)",{exact:true}).click();await card().getByRole("button",{name:"Correct session",exact:true}).click();
  const correction=()=>card().getByRole("form",{name:"Correct reading session",exact:true});
  await correction().getByLabel("Ending page",{exact:true}).fill("25");await correction().getByLabel("Already tracked with a task timer").check();
  await correction().getByRole("button",{name:"Save session correction",exact:true}).click();await card().getByText("25 / 200 pages",{exact:true}).waitFor();
  await card().getByText(/task timer; excluded from reading-time totals/).waitFor();
  await card().getByRole("button",{name:"Edit book Reading QA",exact:true}).click();const edit=()=>page.getByRole("form",{name:"Edit book Reading QA",exact:true});
  await edit().getByLabel("Current page",{exact:true}).fill("40");await edit().getByRole("button",{name:"Save book",exact:true}).click();
  await card().getByText("40 / 200 pages",{exact:true}).waitFor();await card().getByText(/0 → 25 · 25 pages/).waitFor();
  if(await card().locator(".reading-log").getAttribute("open")===null)await card().locator(".reading-log > summary").click();
  await page.setViewportSize({width:320,height:900});assert.equal(await log().getByLabel("Starting page",{exact:true}).inputValue(),"40");
  await log().getByLabel("Ending page",{exact:true}).fill("60");await log().getByRole("button",{name:"Log reading",exact:true}).click();
  await card().getByText("60 / 200 pages",{exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await card().getByRole("button",{name:"Mark completed",exact:true}).click();await card().getByText("200 / 200 pages",{exact:true}).waitFor();
  await card().getByText("Completed",{exact:true}).waitFor();
  const archivedToggle=()=>page.getByRole("button",{name:"Show archived",exact:true});
  assert.equal(await archivedToggle().getAttribute("aria-pressed"),"false");
  await card().getByRole("button",{name:"Archive book Reading QA",exact:true}).click();await card().waitFor({state:"detached"});
  await archivedToggle().click();await card().getByText("Archived · Completed",{exact:true}).waitFor();
  await page.reload();await archivedToggle().waitFor();assert.equal(await archivedToggle().getAttribute("aria-pressed"),"false");assert.equal(await card().count(),0);
  await archivedToggle().click();await card().getByText("Archived · Completed",{exact:true}).waitFor();await card().getByText("Reading history (2)",{exact:true}).click();
  await card().getByRole("button",{name:"Correct session",exact:true}).first().click();await correction().getByLabel("Ending page",{exact:true}).fill("55");
  await correction().getByRole("button",{name:"Save session correction",exact:true}).click();await card().getByText("195 / 200 pages",{exact:true}).waitFor();
  await card().getByRole("button",{name:"Restore book Reading QA",exact:true}).click();
  await card().getByText("Reading",{exact:true}).waitFor();
  await archivedToggle().click();await card().waitFor();
  await archivedToggle().click();await card().getByRole("button",{name:"Archive book Reading QA",exact:true}).click();await card().getByText("Archived · Reading",{exact:true}).waitFor();
  await card().getByRole("button",{name:"Restore book Reading QA",exact:true}).click();await card().getByText("Reading",{exact:true}).waitFor();
  await archivedToggle().click();await card().waitFor();
  await card().getByText("Reading history (2)",{exact:true}).click();
  await card().getByRole("button",{name:"Remove session",exact:true}).first().click();await card().getByText(/Removed/).waitFor();
  await page.reload();await card().getByText("180 / 200 pages",{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  await page.locator(".reading-add > summary").click();
  await form().getByLabel("Book title",{exact:true}).fill("Pace QA");await form().getByLabel("Total pages",{exact:true}).fill("200");
  await form().getByRole("button",{name:"Add book",exact:true}).click();
  const pace=()=>page.getByRole("article",{name:"Pace QA",exact:true});await pace().getByText("No weekly target",{exact:true}).waitFor();
  await pace().getByRole("button",{name:"Start reading",exact:true}).click();
  await pace().locator(".reading-log > summary").click();
  const paceLog=()=>pace().getByRole("form",{name:"Log reading for Pace QA",exact:true});
  const today=await paceLog().getByLabel("Reading date",{exact:true}).inputValue();
  for(const [offset,end] of [[-6,20],[-3,40],[0,60]]){
    const date=new Date(today+"T12:00:00Z");date.setUTCDate(date.getUTCDate()+offset);
    await paceLog().getByLabel("Reading date",{exact:true}).fill(date.toISOString().slice(0,10));
    await paceLog().getByLabel("Ending page",{exact:true}).fill(String(end));
    await paceLog().getByRole("button",{name:"Log reading",exact:true}).click();await pace().getByText(end+" / 200 pages",{exact:true}).waitFor();
  }
  await pace().getByText(/Projected finish:/).waitFor();await pace().getByText("8.6 pages/calendar day",{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  if(await page.locator(".reading-add").getAttribute("open")!==null)await page.locator(".reading-add > summary").click();
  if(process.env.READING_SCREENSHOT_DIR){await mkdir(process.env.READING_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.READING_SCREENSHOT_DIR,"reading-mobile.png"),fullPage:true});await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:path.join(process.env.READING_SCREENSHOT_DIR,"reading-desktop.png"),fullPage:true});}
  console.log("PASS: Reading desktop/320px synthetic UI — add/start/log/quotas/correction/time overlap/manual progress/completion/archive/restore/history/refresh. No hosted claims.");
} finally {
  if (browser) await browser.close();
  if (server) { server.kill(); await new Promise((resolve) => { if (server.exitCode !== null) resolve(); else server.once("exit", resolve); }); }
  // Only remove the freshly created directory owned by this test. Removing the
  // node_modules junction first prevents traversing the application's packages.
  const resolved = path.resolve(temp);
  assert.ok(resolved.startsWith(path.resolve(tmpdir()) + path.sep));
  assert.ok(path.basename(resolved).startsWith("task-reading-ui-"));
  await unlink(path.join(resolved, "node_modules"));
  await rm(resolved, { recursive: true, force: true, maxRetries: 3 });
}
