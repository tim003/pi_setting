import type { ChildStatus } from "./core.ts";

export type FleetChild = {
  name: string;
  agent: string;
  task: string;
  status: ChildStatus;
  surface: string;
  startedAt: number;
};

export type FleetRow = {
  name: string;
  label: string;
  description: string;
  status: ChildStatus;
  /** Rotation needs a tab; a child whose tab is gone cannot be brought forward. */
  canShow: boolean;
  canClose: boolean;
};

/**
 * A finished child has already handed its result to the parent and its
 * transcript lives in the session file, so its tab is pure clutter. A failed
 * one is the same: the error text is delivered too. Both give the tab back.
 */
export function closesTabOnExit(status: ChildStatus): boolean {
  return status === "finished" || status === "failed";
}

export function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m${seconds % 60}s`;
  return `${Math.floor(minutes / 60)}h${minutes % 60}m`;
}

const MARKER: Record<ChildStatus, string> = {
  waiting: "?",
  running: "*",
  failed: "!",
  finished: "-",
};

// A waiting child is blocked on the human, so it belongs at the top; a
// finished one needs nothing and sinks.
const RANK: Record<ChildStatus, number> = {
  waiting: 0,
  running: 1,
  failed: 2,
  finished: 3,
};

export function fleetRows(children: readonly FleetChild[], now: number): FleetRow[] {
  return children
    .map((child, index) => ({ child, index }))
    .sort((a, b) => RANK[a.child.status] - RANK[b.child.status] || a.index - b.index)
    .map(({ child }) => ({
      name: child.name,
      label: `${MARKER[child.status]} ${child.name}`,
      description: [
        child.agent,
        child.status,
        formatElapsed(now - child.startedAt),
        child.task,
      ]
        .filter(Boolean)
        .join("  ·  "),
      status: child.status,
      canShow: Boolean(child.surface),
      canClose: Boolean(child.surface),
    }));
}
