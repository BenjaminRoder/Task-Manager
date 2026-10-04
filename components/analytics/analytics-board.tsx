"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRepositories } from "@/lib/supabase/repository-context";
import { useTimer } from "@/lib/timers/timer-provider";
import { analyticsPeriod, buildAnalytics, type AnalyticsData, type Breakdown } from "@/lib/analytics/analytics";
import { localDate, isDate } from "@/lib/tasks/task-rules";
import { formatActual } from "@/lib/timers/timer-rules";

export function AnalyticsBoard() {
  const repositories = useRepositories();
  const timer = useTimer();
  const [data, setData] = useState<Omit<AnalyticsData, "sessions"> | null>(null);
  const [today, setToday] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const [tasks, categories, courses, books, readingSessions, estimates] = await Promise.all([
      repositories.tasks.list(true), repositories.categories.list(), repositories.courses.list(),
      repositories.reading.listBooks(), repositories.reading.listSessions(), repositories.analytics.listEstimates(),
    ]);
    return {tasks, categories, courses, books, readingSessions, estimates};
  }, [repositories]);
  const reload = useCallback(async () => {
    const version = ++generation.current;
    setLoading(true); setError("");
    try {
      const saved = await load();
      if (version !== generation.current) return;
      setData(saved); setToday(localDate());
    } catch (problem) {
      if (version === generation.current) { setData(null); setError(problem instanceof Error ? problem.message : "Could not load analytics. Retry loading."); }
    } finally { if (version === generation.current) setLoading(false); }
  }, [load]);
  useEffect(() => {
    let active = true;
    const version = ++generation.current;
    load().then(saved => {
      if (!active || version !== generation.current) return;
      setData(saved); setToday(localDate()); setLoading(false); setError("");
    }).catch((problem: unknown) => {
      if (!active || version !== generation.current) return;
      setError(problem instanceof Error ? problem.message : "Could not load analytics. Retry loading."); setLoading(false);
    });
    const cancel = () => { active = false; ++generation.current; };
    const refresh = () => void reload();
    window.addEventListener("focus", refresh); window.addEventListener("tasks-changed", refresh);
    const clock = window.setInterval(() => setToday(localDate()), 30000);
    return () => { cancel(); window.clearInterval(clock); window.removeEventListener("focus", refresh); window.removeEventListener("tasks-changed", refresh); };
  }, [load, reload]);
  const combined = useMemo(() => data ? {...data, sessions: timer.sessions} : null, [data, timer.sessions]);
  return <>
    <header className="page-heading"><div><h1>Analytics</h1><p>Understand where your time goes.</p></div>
      <button className="secondary-button" disabled={loading} onClick={() => { void reload(); void timer.refresh(); }}>Reload analytics</button></header>
    {error || timer.error ? <div role="alert" className="error-banner">{error || timer.error}</div> : null}
    {loading || (!timer.ready && !timer.error) ? <p role="status">Loading your analytics…</p> : null}
    {!loading && !error && !timer.error && timer.ready && combined && today ? <AnalyticsDashboard data={combined} today={today} timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}/> : null}
  </>;
}

function Bars({title, rows, pages = false, note}: {title: string; rows: Breakdown[]; pages?: boolean; note?: string}) {
  const maximum = Math.max(1, ...rows.map(row => row.value));
  return <section className="analytics-panel" aria-label={title}><h2>{title}</h2>{note ? <p className="category-help">{note}</p> : null}
    {!rows.some(row => row.value > 0) ? <p>No {pages ? "pages" : "time"} recorded in this period.</p> :
      <ul className="analytics-bars">{rows.map(row => <li key={row.id}><div><span>{row.label}</span><strong>{pages ? `${row.value} pages` : formatActual(row.value)}</strong></div>
        <span className="analytics-track" aria-hidden="true"><span style={{width: `${100 * row.value / maximum}%`}}/></span></li>)}</ul>}
  </section>;
}
export function AnalyticsDashboard({data, today, timeZone}: {data: AnalyticsData; today: string; timeZone: string}) {
  const [mode, setMode] = useState<"week" | "month">("week");
  const [anchor, setAnchor] = useState("");
  const period = useMemo(() => analyticsPeriod(anchor || today, mode), [anchor, today, mode]);
  const metrics = useMemo(() => buildAnalytics(data, period, today, timeZone), [data, period, today, timeZone]);
  const duration = (minutes: number | null) => minutes === null ? "No timed history" : formatActual(minutes * 60);
  const cards = [
    ["Focused time this week", formatActual(metrics.week.focusedSeconds)],
    ["Focused time this month", formatActual(metrics.month.focusedSeconds)],
    ["Focused time · selected period", formatActual(metrics.focusedSeconds)],
    ["Task timer · selected period", formatActual(metrics.timerSeconds)],
    ["Reading · exclusive time", formatActual(metrics.readingSeconds)],
    ["Tasks completed", String(metrics.completedCount)],
    ["Average timed task", duration(metrics.averageTaskMinutes)],
    ["Study time", formatActual(metrics.studySeconds)], ["Non-study productive time", formatActual(metrics.nonStudySeconds)],
  ];
  return <div className="analytics-board">
    <div className="analytics-controls"><div><label htmlFor="analytics-period">Period</label><select id="analytics-period" value={mode} onChange={event => setMode(event.target.value as "week" | "month")}><option value="week">Week</option><option value="month">Month</option></select></div>
      <label>Date within period<input type="date" value={anchor || today} onChange={event => { if (isDate(event.target.value)) setAnchor(event.target.value); }}/></label>
      <p>{period.start} – {period.end}<br/><span className="category-help">{timeZone} · Monday–Sunday weeks</span></p></div>
    <div className="analytics-summary">{cards.map(([label, value]) => <article key={label} aria-label={label}><h2>{label}</h2><strong>{value}</strong></article>)}</div>
    <p className="category-help">Averages include {metrics.timedCompletedCount} completed tasks with recorded time; untimed tasks are excluded. Study time is task timer time with a course assigned, including archived courses. Non-study productive time has no course assigned. Reading remains separate.</p>
    <p className="category-help">Reading marked as task-timer overlap: {formatActual(metrics.overlappingSeconds)} (context only, never added again). Other manually tracked sessions are not supported.</p>
    {!metrics.focusedSeconds && !metrics.completedCount && !metrics.pagesByWeek.some(row => row.value) ? <p className="empty-state">No activity in this period. Stop a task timer or log reading to start building your history.</p> : null}
    <div className="analytics-grid">
      <Bars title="Time by category" rows={metrics.byCategory} note="Task timer only; current classification, including archived categories."/>
      <Bars title="Time by course" rows={metrics.byCourse} note="Task timer only; unassigned tasks appear as No course."/>
      <Bars title="Time by day" rows={metrics.byDay} note="Focused time: task timer plus exclusive reading."/>
      <Bars title="Pages read by week" rows={metrics.pagesByWeek} pages note="Week beginning Monday. Edge weeks include only dates inside the selected period."/>
    </div>
    <section className="analytics-panel" aria-label="Estimate accuracy"><h2>Estimate accuracy</h2>
      <p>Effective estimate error: {metrics.estimateError.count ? `${duration(metrics.estimateError.meanAbsoluteMinutes)} mean absolute · ${metrics.estimateError.meanAbsolutePercent!.toFixed(1)}% · ${metrics.estimateError.count} samples` : "No comparable completion snapshots yet."}</p>
      <p>Prediction error: {metrics.predictionError.count ? `${duration(metrics.predictionError.meanAbsoluteMinutes)} mean absolute · ${metrics.predictionError.meanAbsolutePercent!.toFixed(1)}% · ${metrics.predictionError.count} samples` : "Not enough comparable prediction history."}</p>
      {metrics.predictionError.biasMinutes !== null ? <p>Prediction bias (actual − predicted): {metrics.predictionError.biasMinutes.toFixed(1)} min. Positive means underestimated.</p> : null}
      <p className="category-help">Errors use timed completions only. Percent error divides absolute error by actual duration. Small samples are descriptive; no trend is inferred.</p>
    </section>
    <section className="analytics-panel" aria-label="Estimated vs actual"><h2>Estimated vs. actual</h2>
      <p className="category-help">Frozen estimates at completion; actuals include all eligible sessions for each currently completed task. Corrections and voids update actuals.</p>
      {!metrics.comparisons.length ? <p>No completed tasks in this period.</p> : <ul className="analytics-comparisons">{metrics.comparisons.map(row => <li key={row.taskId}><h3>{row.title}</h3>
        <p>Actual: <strong>{row.actualMinutes ? duration(row.actualMinutes) : "No recorded time"}</strong></p>
        <span className="analytics-track" aria-hidden="true"><span style={{width: `${100 * row.actualMinutes / Math.max(1, row.actualMinutes, row.snapshot?.effectiveMinutes ?? 0)}%`}}/></span>
        {row.snapshot ? <><p>Effective: {duration(row.snapshot.effectiveMinutes)} · {row.snapshot.effectiveSource}</p><span className="analytics-track analytics-estimate" aria-hidden="true"><span style={{width: `${100 * row.snapshot.effectiveMinutes / Math.max(1, row.actualMinutes, row.snapshot.effectiveMinutes)}%`}}/></span><p>Manual: {row.snapshot.manualMinutes === null ? "Automatic" : duration(row.snapshot.manualMinutes)} · Prediction: {row.snapshot.predictedMinutes === null ? "Unavailable" : duration(row.snapshot.predictedMinutes)}</p></> : <p>No completion snapshot — historical estimate unavailable.</p>}</li>)}</ul>}
    </section>
    <section className="analytics-panel" aria-label="Reading progress"><h2>Reading progress</h2><p className="category-help">Current progress across all books; independent of the selected period.</p>
      {!metrics.readingProgress.length ? <p>No books yet. Add a book in Reading.</p> : <ul className="analytics-comparisons">{metrics.readingProgress.map(({book, percentComplete}) => <li key={book.id}><h3>{book.title}{book.archivedAt ? " · Archived" : ""}</h3><p>{book.currentPage} / {book.totalPages} pages · {Math.round(percentComplete)}%</p><progress value={book.currentPage} max={book.totalPages} aria-label={`${book.title} progress`}/></li>)}</ul>}
    </section>
    <p className="category-help">Stopped, non-void timer sessions are assigned to their start date in {timeZone}; overnight sessions stay on that date. Running timers are excluded. Reopened tasks leave completion metrics until completed again. Removed tasks retain their history.</p>
  </div>;
}
