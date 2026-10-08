import assert from "node:assert/strict";
import path from "node:path";
import { mkdir } from "node:fs/promises";

export async function verifyWeekPhaseTwo(page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const dates = await page.locator(".week-day-header time").evaluateAll(nodes => nodes.map(node => node.getAttribute("datetime")));
  assert.equal(dates.length, 7);
  const grid = () => page.getByRole("region", { name: "Weekly event time grid", exact: true });
  const eventForm = () => page.getByRole("form", { name: "Event editor", exact: true });
  const classForm = () => page.getByRole("form", { name: "Class series editor", exact: true });
  async function createEvent(title, start, end) {
    await page.getByRole("button", { name: "New event", exact: true }).click();
    await eventForm().getByLabel("Title", { exact: true }).fill(title);
    await eventForm().getByLabel("Date", { exact: true }).fill(dates[0]);
    await eventForm().getByLabel("Start time", { exact: true }).fill(start);
    await eventForm().getByLabel("End time", { exact: true }).fill(end);
    await eventForm().getByRole("button", { name: "Save event", exact: true }).click();
    await eventForm().waitFor({ state: "detached" });
    await grid().getByRole("button", { name: new RegExp("^" + title + ",") }).waitFor();
  }
  await createEvent("QA Calendar appointment", "09:00", "10:00");
  await createEvent("QA Calendar overlap", "09:30", "10:30");
  await page.getByRole("button", { name: "New class series", exact: true }).click();
  await classForm().getByLabel("Title", { exact: true }).fill("QA Weekly seminar");
  await classForm().getByRole("button", { name: "Save class series", exact: true }).click();
  await classForm().getByRole("alert").getByText("Choose at least one unique weekday.", { exact: true }).waitFor();
  await classForm().getByLabel("Monday", { exact: true }).check();
  await classForm().getByLabel("Wednesday", { exact: true }).check();
  await classForm().getByLabel("Starts on (optional)").fill(dates[0]);
  await classForm().getByRole("button", { name: "Save class series", exact: true }).click();
  await classForm().waitFor({ state: "detached" });
  assert.equal(await grid().getByRole("button", { name: /^QA Weekly seminar,/ }).count(), 2);
  const monday = () => page.locator(".calendar-availability li").filter({ has: page.locator("span", { hasText: new Date(dates[0] + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) }) });
  await monday().getByText("12h 30m free", { exact: true }).waitFor();
  // All three overlaps have separate lanes; no deadline tasks become blocks.
  const blocks = grid().locator(".calendar-grid-day").first().locator(".calendar-block");
  assert.equal(await blocks.count(), 3);
  const boxes = await blocks.evaluateAll(nodes => nodes.map(node => ({ left: node.style.left, width: node.style.width })));
  assert.equal(new Set(boxes.map(box => box.left)).size, 3);
  assert.ok(boxes.every(box => parseFloat(box.width) < 34));
  assert.equal(await grid().getByRole("button", { name: /^QA Week short,/ }).count(), 0);
  await page.getByRole("button", { name: "Next week", exact: true }).click();
  assert.equal(await grid().getByRole("button", { name: /^QA Weekly seminar,/ }).count(), 2);
  assert.equal(await grid().getByRole("button", { name: /^QA Calendar appointment,/ }).count(), 0);
  await grid().getByRole("button", { name: /^QA Weekly seminar,/ }).first().click();
  await classForm().getByLabel("Title", { exact: true }).fill("QA Weekly seminar edited");
  await classForm().getByLabel("Start time", { exact: true }).fill("11:00");
  await classForm().getByLabel("End time", { exact: true }).fill("12:00");
  await classForm().getByRole("button", { name: "Save class series", exact: true }).click();
  await classForm().waitFor({ state: "detached" });
  assert.equal(await grid().getByRole("button", { name: /^QA Weekly seminar edited,/ }).count(), 2);
  // Existing quick task form creates a due task without navigating the week.
  const selectedRange = await page.locator(".week-toolbar h2").innerText();
  const organization = await page.getByLabel("Organize tasks", { exact: true }).inputValue();
  const nextMonday = await page.locator(".week-day-header time").first().getAttribute("datetime");
  const quick = page.getByRole("complementary", { name: "Week planning sidebar", exact: true }).getByRole("form", { name: "Add a task", exact: true });
  await quick.getByLabel("Task title").fill("QA Calendar quick task");
  await quick.getByLabel("Due date (optional)").fill(nextMonday);
  await quick.getByLabel("Due time (optional)").fill("15:00");
  await quick.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByRole("button", { name: "Edit QA Calendar quick task", exact: true }).waitFor();
  assert.equal(await page.locator(".week-toolbar h2").innerText(), selectedRange);
  assert.equal(await page.getByLabel("Organize tasks", { exact: true }).inputValue(), organization);
  assert.equal(await grid().getByRole("button", { name: /^QA Calendar quick task,/ }).count(), 0);
  await page.getByRole("button", { name: "Current week", exact: true }).click();
  await grid().getByRole("button", { name: /^QA Calendar appointment,/ }).click();
  await eventForm().getByLabel("Title", { exact: true }).fill("QA Calendar appointment edited");
  await eventForm().getByLabel("End time", { exact: true }).fill("09:00");
  await eventForm().getByRole("button", { name: "Save event", exact: true }).click();
  await eventForm().getByRole("alert").waitFor();
  await eventForm().getByLabel("End time", { exact: true }).fill("10:00");
  await eventForm().getByRole("button", { name: "Save event", exact: true }).click();
  await eventForm().waitFor({ state: "detached" });
  await page.getByLabel("Planning starts", { exact: true }).fill("09:00");
  await page.getByLabel("Planning ends", { exact: true }).fill("12:00");
  await page.getByRole("button", { name: "Apply window", exact: true }).click();
  await monday().getByText("30 min free", { exact: true }).waitFor();
  const manage = () => page.locator(".calendar-records");
  await manage().locator("summary").click();
  await manage().getByRole("button", { name: "Archive event QA Calendar appointment edited", exact: true }).click();
  await grid().getByRole("button", { name: /^QA Calendar appointment edited,/ }).waitFor({ state: "detached" });
  await manage().getByRole("button", { name: "Restore event QA Calendar appointment edited", exact: true }).click();
  await grid().getByRole("button", { name: /^QA Calendar appointment edited,/ }).waitFor();
  await manage().getByRole("button", { name: "Archive class series QA Weekly seminar edited", exact: true }).click();
  await grid().getByRole("button", { name: /^QA Weekly seminar edited,/ }).first().waitFor({ state: "detached" });
  assert.equal(await grid().getByRole("button", { name: /^QA Weekly seminar edited,/ }).count(), 0);
  await manage().getByRole("button", { name: "Restore class series QA Weekly seminar edited", exact: true }).click();
  await grid().getByRole("button", { name: /^QA Weekly seminar edited,/ }).first().waitFor();
  await page.reload();
  await page.getByRole("button", { name: "Show Week fixture", exact: true }).click();
  await grid().getByRole("button", { name: /^QA Calendar appointment edited,/ }).waitFor();
  assert.equal(await grid().getByRole("button", { name: /^QA Weekly seminar edited,/ }).count(), 2);
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (width === 1440) assert.equal(await grid().evaluate(node => node.scrollWidth > node.clientWidth), false);
    await grid().getByRole("button", { name: /^QA Calendar appointment edited,/ }).click();
    await eventForm().getByLabel("Title", { exact: true }).fill("QA Calendar appointment edited");
    await eventForm().getByRole("button", { name: "Save event", exact: true }).click();
    await eventForm().waitFor({ state: "detached" });
    await grid().evaluate(node => { node.scrollTop = 8 * 56; node.scrollLeft = 0; });
    if (process.env.CLASSIFICATION_SCREENSHOT_DIR) {
      await mkdir(process.env.CLASSIFICATION_SCREENSHOT_DIR, { recursive: true });
      await page.screenshot({ path: path.join(process.env.CLASSIFICATION_SCREENSHOT_DIR, `week-phase-two-${width}.png`), fullPage: true });
    }
  }
  // Failure/retry is explicit and never renders fabricated availability.
  await page.evaluate(() => localStorage.setItem("calendar-fixture-fail", "true"));
  await page.reload(); await page.getByRole("button", { name: "Show Week fixture", exact: true }).click();
  await page.getByRole("button", { name: "Retry loading calendar", exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "New event", exact: true }).isDisabled(), true);
  await page.evaluate(() => localStorage.removeItem("calendar-fixture-fail"));
  await page.getByRole("button", { name: "Retry loading calendar", exact: true }).click();
  await grid().waitFor();
  // Retain synthetic QA records via the same archive flows.
  await manage().locator("summary").click();
  for (const name of ["QA Calendar appointment edited", "QA Calendar overlap"])
    await manage().getByRole("button", { name: "Archive event " + name, exact: true }).click();
  await manage().getByRole("button", { name: "Archive class series QA Weekly seminar edited", exact: true }).click();
  await page.getByText("No recorded events or classes this week.", { exact: false }).waitFor();
  console.log("PASS: Phase 2 local browser fixture — event/series CRUD with retention, recurrence/navigation, overlap lanes, quick tasks, availability, failure/retry and desktop/mobile. No hosted claims.");
}
