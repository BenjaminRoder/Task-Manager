import type { SupabaseClient } from "@supabase/supabase-js";
import type { TimeSession } from "../../types/time-session.ts";
import type { TimeSessionRepository } from "../timers/time-session-repository.ts";
import { validateCorrection } from "../timers/timer-rules.ts";
export interface SessionRow {
  id: string;
  user_id: string;
  task_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  voided_at: string | null;
  created_at: string;
  updated_at: string;
}
export function sessionFromRow(row: SessionRow): TimeSession {
  return {
    id: row.id,
    userId: row.user_id,
    taskId: row.task_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSeconds:
      row.duration_seconds === null ? null : Number(row.duration_seconds),
    voidedAt: row.voided_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
function check(error: { message: string } | null) {
  if (error)
    throw new Error(
      `Timer could not be saved or loaded: ${error.message}. Refresh timing data before retrying.`,
    );
}
export function createTimeSessionRepository(
  client: SupabaseClient,
  userId: string,
): TimeSessionRepository {
  async function authorize() {
    const { data, error } = await client.auth.getUser();
    if (error || data.user?.id !== userId)
      throw new Error("Your session changed or expired. Sign in again.");
  }
  async function change(session: TimeSession, fields: Record<string, unknown>) {
    await authorize();
    const { error } = await client
      .from("time_sessions")
      .update(fields)
      .eq("user_id", userId)
      .eq("id", session.id)
      .eq("updated_at", session.updatedAt)
      .not("ended_at", "is", null)
      .is("voided_at", null)
      .select("id")
      .single();
    check(error);
  }
  return {
    async list() {
      await authorize();
      const sessions: TimeSession[] = [];
      for (let start = 0; ; start += 500) {
        const { data, error } = await client
          .from("time_sessions")
          .select("*")
          .eq("user_id", userId)
          .order("id")
          .range(start, start + 499);
        check(error);
        sessions.push(...((data ?? []) as SessionRow[]).map(sessionFromRow));
        if (!data || data.length < 500) return sessions;
      }
    },
    async serverTime() {
      const { data, error } = await client.rpc("timer_server_time");
      check(error);
      const value = Date.parse(data as string);
      if (!Number.isFinite(value))
        throw new Error("Could not read the timer server clock.");
      return value;
    },
    async taskTitle(taskId) {
      const { data, error } = await client
        .from("tasks")
        .select("title")
        .eq("user_id", userId)
        .eq("id", taskId)
        .single();
      check(error);
      if (!data) throw new Error("The timed task could not be loaded.");
      return data.title as string;
    },
    async start(taskId, requestId, expectedActive) {
      await authorize();
      const { error } = await client.rpc("start_task_timer", {
        target_task: taskId,
        request_id: requestId,
        expected_active: expectedActive,
        expected_user: userId,
      });
      check(error);
    },
    async stop(sessionId) {
      await authorize();
      const { error } = await client.rpc("stop_task_timer", {
        session_id: sessionId,
        expected_user: userId,
      });
      check(error);
    },
    async update(session, correction) {
      const fields = validateCorrection(correction, Number.POSITIVE_INFINITY);
      await change(session, {
        started_at: fields.startedAt,
        ended_at: fields.endedAt,
      });
    },
    async remove(session) {
      await change(session, { voided_at: new Date().toISOString() });
    },
  };
}
