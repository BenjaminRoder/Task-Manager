import assert from "node:assert/strict";
import path from "node:path";
import { mkdir } from "node:fs/promises";

// Extends the explicit local classification fixture, never a hosted session.
export async function verifyWeekPhaseOne(page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const form = () => page.getByRole("form", { name: "Add a task", exact: true });
  const today = await form().getByLabel("Planned for").inputValue();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today + "T12:00:00Z");
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7) + index);
    return date.toISOString().slice(0, 10);
  });
  async function create(title, day, time, minutes, course = "", type = "") {
    const entry = form();
    assert.equal(await entry.getByLabel("Due time (optional)").isDisabled(), true);
    await entry.getByLabel("Task title").fill(title);
    await entry.getByLabel("Due date (optional)").fill(day);
    await entry.getByLabel("Due time (optional)").fill(time);
    await entry.getByLabel("Manual estimate (min, optional)").fill(String(minutes));
    if (await entry.locator(".classification-selectors").getAttribute("open") === null)
      await entry.getByText("Course and task type (optional)", { exact: true }).click();
    await entry.locator('select[name="courseId"]').selectOption(course);
    await entry.locator('select[name="taskTypeId"]').selectOption(type);
    await entry.getByRole("button", { name: "Add task", exact: true }).click();
    await page.getByRole("article", { name: title, exact: true }).waitFor();
    assert.equal(await entry.getByLabel("Due time (optional)").inputValue(), "");
    assert.equal(await entry.getByLabel("Due date (optional)").inputValue(), "");
  }
  await create("QA Week short", days[5], "16:00", 5, "acct", "hw");
  await create("QA Week early", days[5], "09:00", 60, "acct", "hw");
  await create("QA Week untimed", days[5], "", 25);
  await create("QA Week weekday", days[0], "12:00", 25);
  await create("QA Week Sunday", days[6], "00:00", 25);
  const showWeek = async () => {
    await page.getByRole("button", { name: "Show Week fixture", exact: true }).click();
    await page.locator(".week-grid").waitFor();
  };
  await page.reload(); await showWeek();
  const saturday = () => page.locator(".week-day").nth(5);
  const order = () => saturday().locator(".week-task-title").allTextContents();
  assert.deepEqual((await order()).filter(t => t.startsWith("QA Week")), ["QA Week short", "QA Week untimed", "QA Week early"]);
  assert.equal(await saturday().locator(".actual-time").count(), 0);
  assert.equal(await page.locator(".week-day").nth(6).locator(".actual-time").count(), 0);
  assert.ok(await page.locator(".week-day").first().locator(".actual-time").count() > 0);
  await page.getByRole("button", { name: "Edit QA Week weekday", exact: true }).getByText("due at 12pm", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Edit QA Week Sunday", exact: true }).getByText("due at 12am", { exact: true }).waitFor();
  const organize = () => page.getByLabel("Organize tasks", { exact: true });
  await organize().selectOption("course");
  assert.deepEqual((await order()).filter(t => t.startsWith("QA Week")), ["QA Week early", "QA Week short", "QA Week untimed"]);
  await saturday().getByRole("heading", { name: "Unassigned", exact: true }).waitFor();
  await page.getByText("Manage courses and task types", { exact: true }).click();
  await page.getByRole("button", { name: "Archive course Accounting I", exact: true }).click();
  await saturday().getByRole("heading", { name: "Accounting I (archived)", exact: true }).waitFor();
  const courses = page.getByRole("region", { name: "Courses", exact: true });
  await courses.getByRole("button", { name: "Show archived", exact: true }).click();
  await courses.getByRole("button", { name: "Restore course Accounting I", exact: true }).click();
  await saturday().getByRole("heading", { name: "Accounting I", exact: true }).waitFor();
  await page.getByText("Manage courses and task types", { exact: true }).click();
  await page.reload(); await showWeek();
  assert.equal(await organize().inputValue(), "course");
  await organize().selectOption("task-type");
  await saturday().getByRole("heading", { name: "Homework", exact: true }).waitFor();
  await page.getByRole("button", { name: "Edit QA Week early", exact: true }).click();
  let editor = page.getByRole("form", { name: "Edit QA Week early", exact: true });
  assert.equal(await editor.getByLabel("Due time (optional)").inputValue(), "09:00");
  await editor.getByLabel("Due time (optional)").fill("12:15");
  await editor.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("button", { name: "Edit QA Week early", exact: true }).getByText("due at 12:15pm", { exact: true }).waitFor();
  await page.reload(); await showWeek();
  assert.equal(await organize().inputValue(), "task-type");
  await page.getByRole("button", { name: "Edit QA Week early", exact: true }).click();
  editor = page.getByRole("form", { name: "Edit QA Week early", exact: true });
  assert.equal(await editor.getByLabel("Due time (optional)").inputValue(), "12:15");
  await editor.getByLabel("Due time (optional)").fill("");
  await editor.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.reload(); await showWeek();
  await page.getByRole("button", { name: "Edit QA Week early", exact: true }).click();
  editor = page.getByRole("form", { name: "Edit QA Week early", exact: true });
  assert.equal(await editor.getByLabel("Due date (optional)").inputValue(), days[5]);
  assert.equal(await editor.getByLabel("Due time (optional)").inputValue(), "");
  await editor.getByLabel("Due time (optional)").fill("13:00");
  await editor.getByLabel("Due date (optional)").fill("");
  assert.equal(await editor.getByLabel("Due time (optional)").inputValue(), "");
  assert.equal(await editor.getByLabel("Due time (optional)").isDisabled(), true);
  await editor.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.reload(); await showWeek();
  assert.equal(await saturday().getByRole("button", { name: "Edit QA Week early", exact: true }).count(), 0);
  // Completion, reopen, timer and history remain available from weekend editing.
  await page.getByRole("button", { name: "Edit QA Week short", exact: true }).click();
  const row = () => page.getByRole("article", { name: "QA Week short", exact: true });
  await row().getByRole("checkbox", { name: "Complete QA Week short", exact: true }).check();
  await row().getByRole("checkbox", { name: "Reopen QA Week short", exact: true }).waitFor();
  assert.equal((await order()).at(-1), "QA Week short");
  await row().getByRole("checkbox", { name: "Reopen QA Week short", exact: true }).uncheck();
  await row().getByRole("button", { name: "Start timer for QA Week short", exact: true }).click();
  await row().getByRole("button", { name: "Stop timer", exact: true }).click();
  await row().getByRole("button", { name: "Time history", exact: true }).click();
  assert.equal(await row().getByRole("button", { name: "Time history", exact: true }).getAttribute("aria-expanded"), "true");
  await page.getByRole("form", { name: "Edit QA Week short", exact: true }).getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Previous week", exact: true }).click();
  await page.getByRole("button", { name: "Current week", exact: true }).click();
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.getByRole("button", { name: "Edit QA Week Sunday", exact: true }).click();
    await page.getByRole("form", { name: "Edit QA Week Sunday", exact: true }).getByLabel("Due time (optional)").fill("01:30");
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    if (process.env.CLASSIFICATION_SCREENSHOT_DIR) {
      await mkdir(process.env.CLASSIFICATION_SCREENSHOT_DIR, { recursive: true });
      await page.screenshot({ path: path.join(process.env.CLASSIFICATION_SCREENSHOT_DIR, `week-phase-one-${width}.png`), fullPage: true });
    }
  }
  await page.evaluate(() => localStorage.setItem("personal-task-manager.week-organization.v1:classification-fixture", "bad-value"));
  await page.reload(); await showWeek();
  assert.equal(await organize().inputValue(), "shortest");
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem;
    const set = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key) { if (key.includes("week-organization")) throw new Error("QA storage denied"); return get.call(this, key); };
    Storage.prototype.setItem = function (key, value) { if (key.includes("week-organization")) throw new Error("QA storage denied"); return set.call(this, key, value); };
  });
  await page.reload(); await showWeek();
  assert.equal(await organize().inputValue(), "shortest");
  await organize().selectOption("course");
  assert.equal(await organize().inputValue(), "course");
  console.log("PASS: Phase 1 local component fixture — due-time create/edit/clear/reload, organization persistence/fallback, weekend actuals, retained actions, and 1440/320px layouts. PostgreSQL persistence is tested separately.");
}
