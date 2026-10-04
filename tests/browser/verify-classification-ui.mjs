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
const temp = await mkdtemp(path.join(tmpdir(), "task-classification-ui-"));
let server;
let browser;
let serverLog = "";
try {
  await mkdir(path.join(temp, "app"));
  await symlink(path.join(root, "node_modules"), path.join(temp, "node_modules"), "junction");
  await writeFile(path.join(temp, "package.json"), JSON.stringify({ name: "classification-ui-fixture", private: true, type: "module" }));
  const config = JSON.parse(await readFile(path.join(root, "tsconfig.json"), "utf8"));
  config.compilerOptions.paths = { "@/*": [root.replaceAll("\\", "/") + "/*"] };
  await writeFile(path.join(temp, "tsconfig.json"), JSON.stringify(config));
  await writeFile(path.join(temp, "next.config.mjs"), `export default { experimental: { externalDir: true }, webpack(config) { config.resolve.alias['@'] = ${JSON.stringify(root)}; return config; } };`);
  await writeFile(path.join(temp, "app/page.tsx"), await readFile(path.join(root, "tests/browser/classification-fixture.tsx"), "utf8"));
  await writeFile(path.join(temp, "app/layout.tsx"), 'import "@/app/globals.css"; export default function Layout({children}: {children: React.ReactNode}) { return <html lang="en"><body><main className="main-content">{children}</main></body></html>; }');
  server = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "dev", "--webpack", "--port", "3002", "--hostname", "127.0.0.1"], { cwd: temp, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout.on("data", (chunk) => { serverLog += chunk; });
  server.stderr.on("data", (chunk) => { serverLog += chunk; });
  const url = "http://127.0.0.1:3002";
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
  // Exercise the actual management lists without touching hosted records.
  async function verifyArchivedVisibility(section, noun, name) {
    const toggle = section.getByRole("button", { name: "Show archived", exact: true });
    const archive = section.getByRole("button", { name: `Archive ${noun} ${name}`, exact: true });
    const restore = section.getByRole("button", { name: `Restore ${noun} ${name}`, exact: true });
    assert.equal(await toggle.getAttribute("aria-pressed"), "false");
    await archive.click();
    await restore.waitFor({ state: "detached" });
    await archive.waitFor({ state: "detached" });
    await toggle.click();
    await restore.waitFor();
    await restore.click();
    await archive.waitFor();
    await toggle.click();
    await archive.waitFor(); // Restored records remain visible with the filter off.
    await toggle.click();
    await archive.click();
    await restore.waitFor(); // Archiving with the filter on keeps the row visible.
    assert.match(await restore.locator("xpath=ancestor::li").innerText(), /\(archived\)/);
    await toggle.click();
    await restore.waitFor({ state: "detached" });
    await toggle.click();
    await restore.click();
    await archive.waitFor();
    await toggle.click();
  }
  await page.getByRole("button", { name: "Manage categories", exact: true }).click();
  await verifyArchivedVisibility(page.getByRole("region", { name: "Your categories", exact: true }), "category", "School");
  await page.getByRole("button", { name: "Close categories", exact: true }).click();
  await page.getByText("Manage courses and task types", { exact: true }).click();
  await verifyArchivedVisibility(page.getByRole("region", { name: "Courses", exact: true }), "course", "Accounting");
  await verifyArchivedVisibility(page.getByRole("region", { name: "Task types", exact: true }), "task type", "Homework");
  await page.getByText("Manage courses and task types", { exact: true }).click();
  await page.getByText("Manage topics", { exact: true }).click();
  const topicManager = page.locator("details").filter({ has: page.locator("summary", { hasText: /^Manage topics$/ }) });
  for (const name of ["Adjusting Entries", "Chapter 8"]) {
    await topicManager.getByLabel("Topic name", { exact: true }).fill(name);
    await topicManager.getByRole("button", { name: "Create topic", exact: true }).click();
    await topicManager.getByText(name, { exact: true }).waitFor();
  }
  await verifyArchivedVisibility(page.getByRole("region", { name: "Topics", exact: true }), "topic", "Chapter 8");
  const topicForm = () => page.getByRole("form", { name: "Add a task", exact: true });
  await topicForm().getByText("Topics (optional)", { exact: true }).click();
  await topicForm().getByLabel("Task title").fill("Tagged study");
  await topicForm().getByLabel("Adjusting Entries", { exact: true }).check();
  await topicForm().getByLabel("Chapter 8", { exact: true }).check();
  const topicDate = await topicForm().getByLabel("Planned for").inputValue();
  await topicForm().getByLabel("Due date (optional)").fill(topicDate);
  await topicForm().getByRole("button", { name: "Add task", exact: true }).click();
  const tagged = () => page.getByRole("article", { name: "Tagged study", exact: true });
  await tagged().getByText("Chapter 8", { exact: true }).waitFor();
  await page.reload();
  await tagged().getByText("Adjusting Entries", { exact: true }).waitFor();
  await page.getByText("Manage topics", { exact: true }).click();
  await topicManager.getByRole("button", { name: "Edit topic Chapter 8", exact: true }).click();
  await topicManager.getByLabel("Topic name", { exact: true }).fill("Chapter Eight");
  await topicManager.getByRole("button", { name: "Save topic", exact: true }).click();
  await tagged().getByText("Chapter Eight", { exact: true }).waitFor();
  await topicManager.getByRole("button", { name: "Archive topic Chapter Eight", exact: true }).click();
  await topicManager.getByRole("button", { name: "Restore topic Chapter Eight", exact: true }).waitFor({ state: "detached" });
  await topicManager.getByRole("button", { name: "Show archived", exact: true }).click();
  await tagged().getByText("Chapter Eight (archived)", { exact: true }).waitFor();
  assert.equal(await topicForm().getByLabel("Chapter Eight (archived)", { exact: true }).count(), 0);
  await tagged().getByRole("checkbox", { name: "Complete Tagged study", exact: true }).click();
  await tagged().getByText("Chapter Eight (archived)", { exact: true }).waitFor();
  await page.setViewportSize({ width: 320, height: 900 });
  await tagged().getByRole("button", { name: "Edit Tagged study", exact: true }).click();
  const taggedEdit = page.getByRole("form", { name: "Edit Tagged study", exact: true });
  assert.equal(await taggedEdit.getByLabel("Chapter Eight (archived)", { exact: true }).isChecked(), true);
  await taggedEdit.getByLabel("Adjusting Entries", { exact: true }).uncheck();
  await taggedEdit.getByRole("button", { name: "Save changes", exact: true }).click();
  assert.equal(await tagged().getByText("Adjusting Entries", { exact: true }).count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await topicManager.getByRole("button", { name: "Restore topic Chapter Eight", exact: true }).click();
  await tagged().getByText("Chapter Eight", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Show Week fixture", exact: true }).click();
  await page.getByRole("button", { name: "Edit Tagged study", exact: true }).getByText("Chapter Eight", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Show Today fixture", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  const form = () => page.getByRole("form", { name: "Add a task", exact: true });
  await form().getByLabel("Task title").fill("Title only");
  await form().getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByRole("article", { name: "Title only", exact: true }).waitFor();
  await page.getByText("Manage courses and task types", { exact: true }).click();
  const courseForm = page.getByRole("form", { name: "Create course", exact: true });
  await courseForm.getByLabel("Course name", { exact: true }).fill("Economics");
  await courseForm.getByLabel("Course code (optional)").fill("ECON 045");
  await courseForm.getByRole("button", { name: "Create course", exact: true }).click();
  await page.getByRole("button", { name: "Edit course Economics", exact: true }).waitFor();
  const typeForm = page.getByRole("form", { name: "Create task type", exact: true });
  await typeForm.getByLabel("Task type name").fill("Research");
  await typeForm.getByRole("button", { name: "Create task type", exact: true }).click();
  await page.getByRole("button", { name: "Edit task type Research", exact: true }).waitFor();
  await form().getByLabel("Task title").fill("Comparable homework");
  await form().locator('select[name="categoryId"]').selectOption("school");
  await form().getByText("Course and task type (optional)", { exact: true }).click();
  await form().locator('select[name="courseId"]').selectOption("acct");
  await form().locator('select[name="taskTypeId"]').selectOption("hw");
  const date = await form().getByLabel("Planned for").inputValue();
  await form().getByLabel("Due date (optional)").fill(date);
  await form().getByRole("button", { name: "Add task", exact: true }).click();
  const row = () => page.getByRole("article", { name: "Comparable homework", exact: true });
  await row().getByText("Estimated: 1h 10m", { exact: true }).waitFor();
  await row().locator("summary").click();
  assert.match(await row().innerText(), /3 recent ACCT 151 Homework completed tasks/);
  async function classify(category, course, type, explanation) {
    await row().getByRole("button", { name: "Edit Comparable homework", exact: true }).click();
    const edit = page.getByRole("form", { name: "Edit Comparable homework", exact: true });
    if (await edit.locator(".classification-selectors").getAttribute("open") === null) {
      await edit.getByText("Course and task type (optional)", { exact: true }).click();
    }
    await edit.locator('select[name="categoryId"]').selectOption(category);
    await edit.locator('select[name="courseId"]').selectOption(course);
    await edit.locator('select[name="taskTypeId"]').selectOption(type);
    await edit.getByRole("button", { name: "Save changes", exact: true }).click();
    await row().getByText(explanation).waitFor();
  }
  // The three synthetic observations remain ACCT 151 / Homework / School.
  // Change the target's independent dimensions to exercise each fallback.
  await classify("school", "acct", { label: "Research" }, /recent ACCT 151 completed tasks/);
  await classify("school", { label: "ECON 045 · Economics" }, "hw", /recent School Homework completed tasks/);
  await classify("", { label: "ECON 045 · Economics" }, "hw", /recent Homework completed tasks/);
  await classify("school", { label: "ECON 045 · Economics" }, { label: "Research" }, /recent School completed tasks/);
  await classify("", { label: "ECON 045 · Economics" }, { label: "Research" }, /recent overall completed tasks/);
  await classify("school", "", "", /recent School completed tasks/);
  await classify("", "acct", "", /recent ACCT 151 completed tasks/);
  await classify("", "", "hw", /recent Homework completed tasks/);
  await classify("school", "acct", "hw", /recent ACCT 151 Homework completed tasks/);
  await form().getByLabel("Task title").fill("Manual override");
  await form().getByLabel("Manual estimate (min, optional)").fill("45");
  await form().getByLabel("Due date (optional)").fill(date);
  await form().getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByRole("article", { name: "Manual override", exact: true }).getByText("Estimated: 45 min", { exact: true }).waitFor();
  assert.match(await page.locator(".workload").innerText(), /3h 5m planned/);
  const order = await page.locator("article h3").allTextContents();
  assert.equal(order[0], "Manual override");
  await page.reload(); await row().waitFor();
  await row().getByText("Estimated: 1h 10m", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Show Week fixture", exact: true }).click();
  await page.locator(".week-grid").waitFor();
  assert.match(await page.locator(".workload").innerText(), /1h 55m due/);
  await page.getByRole("button", { name: "Edit Comparable homework", exact: true }).click();
  const editor = page.getByRole("form", { name: "Edit Comparable homework", exact: true });
  assert.equal(await editor.locator('select[name="courseId"]').inputValue(), "acct");
  assert.equal(await editor.locator('select[name="taskTypeId"]').inputValue(), "hw");
  await page.getByRole("button", { name: "Show Today fixture", exact: true }).click();
  await row().waitFor();
  await page.getByText("Manage courses and task types", { exact: true }).click();
  await page.getByRole("button", { name: "Edit course Accounting", exact: true }).click();
  const editCourse = page.getByRole("form", { name: "Edit course", exact: true });
  await editCourse.getByLabel("Course name", { exact: true }).fill("Accounting I");
  await editCourse.getByRole("button", { name: "Save course", exact: true }).click();
  await page.getByRole("button", { name: "Archive course Accounting I", exact: true }).click();
  await page.getByRole("button", { name: "Archive course Accounting I", exact: true }).waitFor({ state: "detached" });
  await page.getByRole("region", { name: "Courses", exact: true }).getByRole("button", { name: "Show archived", exact: true }).click();
  await page.getByRole("button", { name: "Restore course Accounting I", exact: true }).waitFor();
  await row().getByRole("button", { name: "Edit Comparable homework", exact: true }).click();
  const taskEditor = page.getByRole("form", { name: "Edit Comparable homework", exact: true });
  assert.match(await taskEditor.locator('select[name="courseId"]').innerText(), /Accounting I \(archived\)/);
  await taskEditor.getByRole("button", { name: "Cancel", exact: true }).click();
  await form().getByText("Course and task type (optional)", { exact: true }).click();
  assert.equal(await form().locator('select[name="courseId"]').locator('option[value="acct"]').count(), 0);
  await page.getByRole("button", { name: "Restore course Accounting I", exact: true }).click();
  await page.getByRole("button", { name: "Archive course Accounting I", exact: true }).waitFor();
  await page.getByRole("button", { name: "Edit task type Research", exact: true }).click();
  const editType = page.getByRole("form", { name: "Edit task type", exact: true });
  await editType.getByLabel("Task type name").fill("Research notes");
  await editType.getByRole("button", { name: "Save task type", exact: true }).click();
  await page.getByRole("button", { name: "Archive task type Research notes", exact: true }).click();
  await page.getByRole("button", { name: "Archive task type Research notes", exact: true }).waitFor({ state: "detached" });
  await page.getByRole("region", { name: "Task types", exact: true }).getByRole("button", { name: "Show archived", exact: true }).click();
  await page.getByRole("button", { name: "Restore task type Research notes", exact: true }).waitFor();
  await page.getByRole("button", { name: "Archive task type Homework", exact: true }).click();
  await page.getByRole("button", { name: "Restore task type Homework", exact: true }).waitFor();
  await row().getByRole("button", { name: "Edit Comparable homework", exact: true }).click();
  const archivedTypeEditor = page.getByRole("form", { name: "Edit Comparable homework", exact: true });
  assert.match(await archivedTypeEditor.locator('select[name="taskTypeId"]').innerText(), /Homework \(archived\)/);
  await archivedTypeEditor.getByRole("button", { name: "Cancel", exact: true }).click();
  await form().getByText("Course and task type (optional)", { exact: true }).click();
  assert.equal(await form().locator('select[name="taskTypeId"]').locator('option[value="hw"]').count(), 0);
  await page.getByRole("button", { name: "Restore task type Homework", exact: true }).click();
  await page.getByRole("button", { name: "Archive task type Homework", exact: true }).waitFor();
  await row().getByRole("button", { name: "Start timer for Comparable homework", exact: true }).click();
  await row().getByRole("button", { name: "Stop timer", exact: true }).waitFor();
  await page.reload(); await row().getByRole("button", { name: "Stop timer", exact: true }).waitFor();
  await row().getByRole("button", { name: "Stop timer", exact: true }).click();
  await row().getByRole("button", { name: "Start timer for Comparable homework", exact: true }).waitFor();
  await page.setViewportSize({ width: 320, height: 900 });
  await row().getByRole("button", { name: "Edit Comparable homework", exact: true }).click();
  await page.getByRole("form", { name: "Edit Comparable homework", exact: true }).getByLabel("Task title").fill("Mobile homework");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("article", { name: "Mobile homework", exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  // Missing history fallback and mobile creation use the same real UI. Only
  // this explicit fixture's synthetic history is voided; no hosted data exists.
  await page.evaluate(() => {
    const key = "task-manager.classification.ui.fixture.v1";
    const data = JSON.parse(localStorage.getItem(key));
    for (const session of data.sessions) if (session.taskId === "history-1" || session.taskId === "history-2") session.voidedAt = "2026-02-01";
    localStorage.setItem(key, JSON.stringify(data));
  });
  await page.reload();
  const mobile = page.getByRole("article", { name: "Mobile homework", exact: true });
  await mobile.getByText("Estimated: 25 min", { exact: true }).waitFor();
  await mobile.locator("summary").click();
  await mobile.getByText(/Not enough history yet/).waitFor();
  await form().getByLabel("Task title").fill("Mobile title-only task");
  await form().getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByRole("article", { name: "Mobile title-only task", exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  if (process.env.CLASSIFICATION_SCREENSHOT_DIR) {
    await mkdir(process.env.CLASSIFICATION_SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(process.env.CLASSIFICATION_SCREENSHOT_DIR, "topics-mobile.png"), fullPage: true });
  }
  assert.deepEqual(errors, []);
  console.log("PASS: local UI fixture — topics lifecycle/multiple selection/history/refresh/Week/mobile; classification management, optional capture, all six hierarchy levels plus fallback, explanations, manual override, Momentum, Today/Week, archived references, refresh, timer UI and 320px creation/editing. No hosted claims.");
} finally {
  if (browser) await browser.close();
  if (server) { server.kill(); await new Promise((resolve) => { if (server.exitCode !== null) resolve(); else server.once("exit", resolve); }); }
  // Only remove the freshly created directory owned by this test. Removing the
  // node_modules junction first prevents traversing the application's packages.
  const resolved = path.resolve(temp);
  assert.ok(resolved.startsWith(path.resolve(tmpdir()) + path.sep));
  assert.ok(path.basename(resolved).startsWith("task-classification-ui-"));
  await unlink(path.join(resolved, "node_modules"));
  await rm(resolved, { recursive: true, force: true, maxRetries: 3 });
}
