export type Source = 'slack' | 'jira' | 'github' | 'email';
export type Status = 'todo' | 'in_progress' | 'review' | 'blocked' | 'done';
export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type Priority = 'P0' | 'P1' | 'P2' | 'P3';

export interface Person {
  id: string;
  name: string;
  role: string;
  initials: string;
  color: string;
  external?: boolean;
  focus?: string;
}

export interface ThreadEntry {
  author: string; // person id or display name
  at: number;
  text: string;
}

/** Unified event schema - every source adapter (mock today, real API later) maps into this shape. */
export interface WorkItem {
  id: string;
  source: Source;
  kind: string; // Incident, Bug, Story, Pull request, Message, Email, Alert, Task, Release ...
  ref: string; // PAY-482, #418, #payments-alerts, email subject id
  channel?: string;
  title: string;
  body: string;
  author: string;
  assignee?: string;
  reviewers?: string[];
  createdAt: number;
  updatedAt: number;
  dueAt?: number;
  status: Status;
  severity: Severity;
  customerImpact?: boolean;
  mentionsManager?: boolean;
  waitingOn?: string; // person id (or external name) the item is waiting on
  waitingReason?: string;
  blockedSince?: number;
  ciFailing?: boolean;
  labels: string[];
  thread: ThreadEntry[];
  related: string[];
}

export interface LogEntry {
  at: number;
  text: string;
}

/** Local overlay of manager actions applied on top of source data. */
export interface ItemState {
  status?: Status;
  assignee?: string;
  snoozedUntil?: number;
  log: LogEntry[];
}

export type BlockerKind = 'blocked' | 'review' | 'stale';

export interface Blocker {
  itemId: string;
  personId: string;
  kind: BlockerKind;
  cause: string;
  since: number;
  waitingOn?: string;
}

export interface ScoredItem {
  item: WorkItem;
  score: number;
  priority: Priority;
  reasons: string[];
  blocker?: Blocker;
  snoozedUntil?: number;
  isSnoozed: boolean;
  log: LogEntry[];
}

export interface BriefBullet {
  text: string;
  itemIds: string[];
}

export interface BriefSection {
  key: 'attention' | 'blocked' | 'today' | 'happened';
  label: string;
  bullets: BriefBullet[];
}

export interface DailyBrief {
  headline: string;
  sections: BriefSection[];
  generatedAt: number;
  engine: 'local' | 'claude';
  model?: string;
}

export type DemoMode = 'normal' | 'empty' | 'partial_error' | 'outage';

export interface Settings {
  engine: 'local' | 'claude';
  apiKey: string;
  model: string;
  demoMode: DemoMode;
}
