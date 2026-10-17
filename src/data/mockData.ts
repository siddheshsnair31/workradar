import type { Person, WorkItem } from '../types';

/**
 * Mock data for one 8-person payments squad. All timestamps are relative to
 * the moment the app loads, so the demo always looks like "this morning".
 */
const NOW = Date.now();
const H = 3600_000;
const ago = (hours: number) => NOW - hours * H;
const inH = (hours: number) => NOW + hours * H;

export const ME = 'u-priya';
export const TEAM_NAME = 'Payments Squad';

export const PEOPLE: Person[] = [
  { id: 'u-priya', name: 'Siddhesh S Nair', role: 'Engineering Manager', initials: 'SN', color: '#2f4fe0' },
  { id: 'u-arjun', name: 'Arjun Mehta', role: 'Tech Lead', initials: 'AM', color: '#0e9384', focus: 'Release 3.8 readiness & code reviews' },
  { id: 'u-sneha', name: 'Sneha Rao', role: 'Backend Engineer', initials: 'SR', color: '#c4320a', focus: 'Refund API v2 (PAY-482)' },
  { id: 'u-karan', name: 'Karan Patel', role: 'Frontend Engineer', initials: 'KP', color: '#7a2ed1', focus: 'Checkout redesign' },
  { id: 'u-divya', name: 'Divya Iyer', role: 'QA Engineer', initials: 'DI', color: '#b54708', focus: 'Release 3.8 regression suite' },
  { id: 'u-rahul', name: 'Rahul Verma', role: 'DevOps Engineer', initials: 'RV', color: '#155eef', focus: 'PCI remediation & on-call' },
  { id: 'u-ananya', name: 'Ananya Gupta', role: 'Mobile Engineer', initials: 'AG', color: '#dd2590', focus: 'Apple Pay & loyalty points' },
  { id: 'u-vikram', name: 'Vikram Singh', role: 'Backend Engineer', initials: 'VS', color: '#027a48', focus: 'Webhook incident (PAY-501)' },
  { id: 'x-neha', name: 'Neha Kapoor', role: 'Platform Team Lead', initials: 'NK', color: '#667085', external: true },
  { id: 'x-acme', name: 'Acme Retail Support', role: 'Customer', initials: 'AR', color: '#667085', external: true },
  { id: 'x-finance', name: 'Finance Ops', role: 'Finance', initials: 'FO', color: '#667085', external: true },
  { id: 'x-bot', name: 'PagerBot', role: 'Alerting', initials: 'PB', color: '#98a2b3', external: true },
];

export const ITEMS: WorkItem[] = [
  {
    id: 'i-01', source: 'slack', kind: 'Incident', ref: '#payments-alerts', channel: '#payments-alerts',
    title: 'Payment webhook failures spiking in production',
    body: 'Webhook 5xx rate jumped to 18% (threshold 2%) after last night\'s deploy. 312 merchant callbacks failed in the last hour; retries are backing up.',
    author: 'x-bot', assignee: 'u-vikram', createdAt: ago(1.6), updatedAt: ago(0.2), status: 'in_progress', severity: 'critical',
    customerImpact: true, mentionsManager: true, labels: ['incident', 'production', 'webhooks'],
    thread: [
      { author: 'x-bot', at: ago(1.6), text: 'ALERT: webhook-dispatcher 5xx rate 18.2% (threshold 2%). 312 failed callbacks / 60 min.' },
      { author: 'u-rahul', at: ago(1.4), text: 'Looks related to the retry-queue batching change that went out at 22:40.' },
      { author: 'u-vikram', at: ago(1.1), text: 'Investigating. Revert is ready as #418 if we decide to roll back.' },
      { author: 'u-rahul', at: ago(0.2), text: '@Siddhesh do we roll back now or wait 30 min for a hotfix? Merchants are noticing.' },
    ],
    related: ['i-02', 'i-03', 'i-04'],
  },
  {
    id: 'i-02', source: 'jira', kind: 'Bug', ref: 'PAY-501',
    title: 'Webhook retry queue drops events under load',
    body: 'Batching introduced in 3.7.4 drops events when batch size exceeds 500. Root cause of the webhook incident.',
    author: 'u-rahul', assignee: 'u-vikram', createdAt: ago(1.2), updatedAt: ago(0.5), dueAt: inH(6), status: 'in_progress', severity: 'critical',
    customerImpact: true, labels: ['bug', 'webhooks', 'release-blocker'],
    thread: [
      { author: 'u-rahul', at: ago(1.2), text: 'Filed from incident in #payments-alerts.' },
      { author: 'u-vikram', at: ago(0.5), text: 'Reproduced locally with 600-event batch. Fix is a 3-line change but needs a load test.' },
    ],
    related: ['i-01', 'i-03'],
  },
  {
    id: 'i-03', source: 'github', kind: 'Pull request', ref: 'PR #418',
    title: 'Revert retry queue batching (hotfix for PAY-501)',
    body: 'Reverts the batching change from #396. Safe rollback path while the proper fix is load tested.',
    author: 'u-vikram', assignee: 'u-vikram', reviewers: ['u-arjun'], createdAt: ago(0.8), updatedAt: ago(0.8), status: 'review', severity: 'high',
    labels: ['hotfix', 'needs-review'],
    thread: [
      { author: 'u-vikram', at: ago(0.8), text: 'Requesting review from @arjun - CI is green.' },
    ],
    related: ['i-01', 'i-02'],
  },
  {
    id: 'i-04', source: 'email', kind: 'Email', ref: 'Escalation: duplicate charges',
    title: 'Acme Retail: 14 customers report duplicate charges',
    body: 'Our support team has received 14 complaints of customers being charged twice since 23:00 yesterday. Please confirm root cause and refund timeline by end of day.',
    author: 'x-acme', createdAt: ago(2.1), updatedAt: ago(2.1), dueAt: inH(8), status: 'todo', severity: 'high',
    customerImpact: true, mentionsManager: true, labels: ['customer', 'escalation'],
    thread: [
      { author: 'x-acme', at: ago(2.1), text: 'Hi Siddhesh, 14 customers report double charges since 23:00. Can you confirm root cause and a refund ETA today?' },
    ],
    related: ['i-01'],
  },
  {
    id: 'i-05', source: 'jira', kind: 'Story', ref: 'PAY-482',
    title: 'Refund API v2 - idempotency keys',
    body: 'Add idempotency keys to refund endpoints. Required for release 3.8. Blocked: needs read access to the staging payments DB to run migration dry-run.',
    author: 'u-arjun', assignee: 'u-sneha', createdAt: ago(240), updatedAt: ago(50), dueAt: inH(52), status: 'blocked', severity: 'high',
    waitingOn: 'u-rahul', waitingReason: 'Staging DB access (OPS-77)', blockedSince: ago(50),
    labels: ['release-3.8', 'refunds'],
    thread: [
      { author: 'u-sneha', at: ago(50), text: 'Moved to Blocked - need staging DB read access for the migration dry-run. Raised OPS-77.' },
      { author: 'u-arjun', at: ago(30), text: '@rahul can you prioritise OPS-77? This is on the 3.8 critical path.' },
    ],
    related: ['i-06', 'i-08', 'i-10'],
  },
  {
    id: 'i-06', source: 'slack', kind: 'Message', ref: '#payments-dev', channel: '#payments-dev',
    title: 'Sneha: still blocked on staging DB credentials',
    body: 'Still blocked on staging DB credentials for PAY-482 - raised OPS-77 two days ago. Waiting on Rahul.',
    author: 'u-sneha', assignee: 'u-sneha', createdAt: ago(20), updatedAt: ago(20), status: 'blocked', severity: 'medium',
    waitingOn: 'u-rahul', waitingReason: 'Staging DB access (OPS-77)', blockedSince: ago(50), labels: ['blocker'],
    thread: [
      { author: 'u-sneha', at: ago(20), text: 'Still blocked on staging DB creds for PAY-482, OPS-77 has been open 2 days. Anyone who can help?' },
      { author: 'u-rahul', at: ago(19), text: 'Sorry, on-call ate my day. Will try today.' },
    ],
    related: ['i-05'],
  },
  {
    id: 'i-07', source: 'github', kind: 'Pull request', ref: 'PR #405',
    title: 'Checkout: new card form validation',
    body: 'Client-side validation, inline errors and accessible labels for the redesigned card form.',
    author: 'u-karan', assignee: 'u-karan', reviewers: ['u-arjun'], createdAt: ago(78), updatedAt: ago(76), status: 'review', severity: 'medium',
    labels: ['checkout-redesign', 'frontend'],
    thread: [
      { author: 'u-karan', at: ago(78), text: 'Ready for review. Screenshots in the description.' },
      { author: 'u-karan', at: ago(4), text: 'Friendly ping @arjun - this blocks the rest of the checkout redesign.' },
    ],
    related: ['i-14'],
  },
  {
    id: 'i-08', source: 'github', kind: 'Pull request', ref: 'PR #409',
    title: 'Add idempotency middleware',
    body: 'Shared middleware used by PAY-482. Changes requested on error handling.',
    author: 'u-sneha', assignee: 'u-sneha', reviewers: ['u-vikram'], createdAt: ago(28), updatedAt: ago(22), status: 'in_progress', severity: 'medium',
    labels: ['refunds'],
    thread: [
      { author: 'u-vikram', at: ago(22), text: 'Changes requested: handle Redis timeouts explicitly.' },
    ],
    related: ['i-05'],
  },
  {
    id: 'i-09', source: 'jira', kind: 'Bug', ref: 'PAY-490',
    title: 'iOS: Apple Pay sheet crashes on iOS 19.1',
    body: 'Crash when presenting the payment sheet on iOS 19.1. Fix requires the renewed merchant entitlement owned by the Platform team.',
    author: 'u-divya', assignee: 'u-ananya', createdAt: ago(96), updatedAt: ago(70), dueAt: inH(30), status: 'blocked', severity: 'high',
    customerImpact: true, waitingOn: 'x-neha', waitingReason: 'Apple Pay entitlement renewal (Platform team)', blockedSince: ago(70),
    labels: ['ios', 'apple-pay'],
    thread: [
      { author: 'u-ananya', at: ago(70), text: 'Blocked until Platform renews the merchant entitlement. Pinged Neha.' },
      { author: 'x-neha', at: ago(48), text: 'On our list, ETA early next week.' },
    ],
    related: [],
  },
  {
    id: 'i-10', source: 'slack', kind: 'Message', ref: '#release-3-8', channel: '#release-3-8',
    title: 'Regression suite: 6 failures in refunds flow',
    body: 'Regression run #212 has 6 failures, all in the refunds flow. Blocking QA sign-off for release 3.8.',
    author: 'u-divya', assignee: 'u-divya', createdAt: ago(3), updatedAt: ago(2.5), dueAt: inH(28), status: 'todo', severity: 'high',
    labels: ['release-3.8', 'qa'],
    thread: [
      { author: 'u-divya', at: ago(3), text: 'Run #212: 6 failures, all refunds. Can\'t sign off 3.8 until these are triaged.' },
      { author: 'u-arjun', at: ago(2.5), text: 'Probably the same root cause as PAY-482 test data. Sneha can confirm once unblocked.' },
    ],
    related: ['i-05'],
  },
  {
    id: 'i-11', source: 'email', kind: 'Email', ref: 'Redis maintenance',
    title: 'Platform: shared Redis maintenance tonight 23:00-23:30',
    body: 'The shared Redis cluster will be in read-only mode for 30 minutes. Please avoid deploys during the window.',
    author: 'x-neha', createdAt: ago(5), updatedAt: ago(5), dueAt: inH(12), status: 'todo', severity: 'medium',
    labels: ['maintenance'],
    thread: [{ author: 'x-neha', at: ago(5), text: 'FYI: Redis maintenance tonight 23:00-23:30, read-only. No deploys please.' }],
    related: [],
  },
  {
    id: 'i-12', source: 'jira', kind: 'Task', ref: 'PAY-475',
    title: 'PCI scan remediation items (4 open)',
    body: 'Close the four medium findings from the quarterly PCI scan before the auditor follow-up.',
    author: 'u-priya', assignee: 'u-rahul', createdAt: ago(120), updatedAt: ago(26), dueAt: inH(22), status: 'in_progress', severity: 'medium',
    labels: ['compliance'],
    thread: [{ author: 'u-rahul', at: ago(26), text: '2 of 4 done. TLS config and log retention left.' }],
    related: [],
  },
  {
    id: 'i-13', source: 'email', kind: 'Email', ref: 'Q4 headcount',
    title: 'Finance: Q4 headcount request due in 2 days',
    body: 'Please submit your Q4 headcount and contractor plan in the shared template.',
    author: 'x-finance', createdAt: ago(18), updatedAt: ago(18), dueAt: inH(48), status: 'todo', severity: 'medium',
    mentionsManager: true, labels: ['planning'],
    thread: [{ author: 'x-finance', at: ago(18), text: 'Reminder: Q4 headcount plans are due in 2 days.' }],
    related: [],
  },
  {
    id: 'i-14', source: 'slack', kind: 'Message', ref: '#payments-dev', channel: '#payments-dev',
    title: 'Karan: PR #405 waiting 3 days for review',
    body: 'Can someone review #405? It has been 3 days and it is blocking the checkout redesign.',
    author: 'u-karan', assignee: 'u-karan', createdAt: ago(4), updatedAt: ago(4), status: 'blocked', severity: 'medium',
    waitingOn: 'u-arjun', waitingReason: 'Code review on PR #405', blockedSince: ago(76), labels: ['blocker', 'review'],
    thread: [{ author: 'u-karan', at: ago(4), text: 'Can someone review #405? 3 days now and it blocks the checkout redesign.' }],
    related: ['i-07'],
  },
  {
    id: 'i-15', source: 'github', kind: 'Pull request', ref: 'PR #412',
    title: 'Upgrade payments SDK to v15',
    body: 'Major SDK upgrade. CI failing on 2 integration tests.',
    author: 'u-vikram', assignee: 'u-vikram', reviewers: ['u-sneha'], createdAt: ago(9), updatedAt: ago(6), status: 'in_progress', severity: 'low',
    ciFailing: true, labels: ['dependencies'],
    thread: [{ author: 'u-vikram', at: ago(6), text: 'CI red on 2 integration tests, will pick up after the incident.' }],
    related: [],
  },
  {
    id: 'i-16', source: 'jira', kind: 'Story', ref: 'PAY-470',
    title: 'Settlement report CSV export',
    body: 'Allow finance users to export daily settlement reports as CSV.',
    author: 'u-arjun', assignee: 'u-karan', createdAt: ago(200), updatedAt: ago(30), dueAt: inH(140), status: 'in_progress', severity: 'low',
    labels: ['reports'], thread: [], related: [],
  },
  {
    id: 'i-17', source: 'slack', kind: 'Message', ref: 'DM - Arjun', channel: 'Direct message',
    title: 'Arjun: decision needed on cutting loyalty points from 3.8',
    body: 'Loyalty points redemption is at risk for 3.8. Need your call today: cut it to 3.9 or slip the release by two days?',
    author: 'u-arjun', createdAt: ago(1), updatedAt: ago(1), dueAt: inH(9), status: 'todo', severity: 'high',
    mentionsManager: true, labels: ['decision', 'release-3.8'],
    thread: [{ author: 'u-arjun', at: ago(1), text: 'Need your call today: cut loyalty points to 3.9, or slip 3.8 by two days?' }],
    related: ['i-30'],
  },
  {
    id: 'i-18', source: 'jira', kind: 'Story', ref: 'PAY-498',
    title: 'Fraud rule: velocity check for new accounts',
    body: 'Block more than 5 payment attempts per minute from accounts younger than 24h.',
    author: 'u-arjun', assignee: 'u-vikram', createdAt: ago(60), updatedAt: ago(40), dueAt: inH(90), status: 'todo', severity: 'medium',
    labels: ['fraud'], thread: [], related: [],
  },
  {
    id: 'i-19', source: 'email', kind: 'Email', ref: 'Interview feedback',
    title: 'Recruiting: interview feedback pending for Senior Backend candidate',
    body: 'Please submit your interview scorecard for the Senior Backend Engineer candidate.',
    author: 'x-finance', createdAt: ago(22), updatedAt: ago(22), dueAt: inH(7), status: 'todo', severity: 'low',
    mentionsManager: true, labels: ['hiring'], thread: [], related: [],
  },
  {
    id: 'i-20', source: 'github', kind: 'Pull request', ref: 'PR #401',
    title: 'Docs: refund API v2 specification',
    body: 'OpenAPI spec and examples for refund v2.',
    author: 'u-sneha', assignee: 'u-sneha', reviewers: [], createdAt: ago(120), updatedAt: ago(110), status: 'review', severity: 'low',
    labels: ['docs'], thread: [], related: ['i-05'],
  },
  // ---- Things that happened in the last 24h ----
  {
    id: 'i-21', source: 'github', kind: 'Pull request', ref: 'PR #410',
    title: 'Fix currency rounding in invoice totals',
    body: 'Merged. Fixes off-by-one-paisa rounding in multi-currency invoices.',
    author: 'u-arjun', assignee: 'u-arjun', createdAt: ago(30), updatedAt: ago(3), status: 'done', severity: 'medium',
    labels: ['merged'], thread: [{ author: 'u-arjun', at: ago(3), text: 'Merged into main.' }], related: [],
  },
  {
    id: 'i-22', source: 'github', kind: 'Pull request', ref: 'PR #407',
    title: 'Android: saved cards list performance',
    body: 'Merged. Saved cards list now renders 3x faster on low-end devices.',
    author: 'u-ananya', assignee: 'u-ananya', createdAt: ago(40), updatedAt: ago(5), status: 'done', severity: 'low',
    labels: ['merged', 'android'], thread: [], related: [],
  },
  {
    id: 'i-23', source: 'jira', kind: 'Release', ref: 'PAY-466',
    title: 'Release 3.7.4 deployed to production',
    body: 'Hotfix release with settlement fixes deployed successfully.',
    author: 'u-rahul', assignee: 'u-rahul', createdAt: ago(26), updatedAt: ago(11), status: 'done', severity: 'medium',
    labels: ['release'], thread: [], related: ['i-02'],
  },
  {
    id: 'i-24', source: 'slack', kind: 'Alert', ref: '#payments-alerts', channel: '#payments-alerts',
    title: 'Resolved: checkout latency back to normal (p95 220 ms)',
    body: 'Latency alert from yesterday evening resolved after cache warm-up.',
    author: 'x-bot', assignee: 'u-rahul', createdAt: ago(14), updatedAt: ago(8), status: 'done', severity: 'medium',
    labels: ['alert', 'resolved'], thread: [], related: [],
  },
  {
    id: 'i-25', source: 'jira', kind: 'Task', ref: 'PAY-485',
    title: 'Automated test coverage for wallets',
    body: 'Wallet flows now have 92% automated coverage.',
    author: 'u-divya', assignee: 'u-divya', createdAt: ago(100), updatedAt: ago(6), status: 'done', severity: 'low',
    labels: ['qa'], thread: [], related: [],
  },
  {
    id: 'i-26', source: 'slack', kind: 'Message', ref: '#payments-dev', channel: '#payments-dev',
    title: 'Divya: staging environment refreshed with production-like data',
    body: 'Staging refresh complete. Test accounts reset.',
    author: 'u-divya', assignee: 'u-divya', createdAt: ago(9), updatedAt: ago(9), status: 'done', severity: 'low',
    labels: ['environment'], thread: [], related: [],
  },
  // ---- Lower-signal open items ----
  {
    id: 'i-27', source: 'slack', kind: 'Message', ref: '#payments-dev', channel: '#payments-dev',
    title: 'Vikram: out of office on Monday',
    body: 'Heads up, I am out on Monday. Ananya is backup for webhook on-call.',
    author: 'u-vikram', createdAt: ago(7), updatedAt: ago(7), status: 'todo', severity: 'low',
    labels: ['ooo'], thread: [], related: [],
  },
  {
    id: 'i-28', source: 'jira', kind: 'Task', ref: 'PAY-493',
    title: 'Accessibility fixes on payment page',
    body: 'Contrast, focus order and screen-reader labels on the payment page.',
    author: 'u-divya', assignee: 'u-karan', createdAt: ago(80), updatedAt: ago(80), dueAt: inH(160), status: 'todo', severity: 'low',
    labels: ['a11y'], thread: [], related: [],
  },
  {
    id: 'i-29', source: 'email', kind: 'Email', ref: 'Cloud cost alert',
    title: 'Cloud cost alert: staging spend up 38% this week',
    body: 'Staging spend is 38% above the weekly baseline, mostly from idle load-test runners.',
    author: 'x-finance', assignee: 'u-rahul', createdAt: ago(12), updatedAt: ago(12), status: 'todo', severity: 'medium',
    labels: ['cost'], thread: [], related: [],
  },
  {
    id: 'i-30', source: 'jira', kind: 'Story', ref: 'PAY-499',
    title: 'Loyalty points redemption at checkout',
    body: 'Redeem loyalty points as partial payment. Targeted for release 3.8; no progress update in 4 days.',
    author: 'u-arjun', assignee: 'u-ananya', createdAt: ago(300), updatedAt: ago(98), dueAt: inH(52), status: 'in_progress', severity: 'high',
    labels: ['release-3.8', 'loyalty'],
    thread: [{ author: 'u-ananya', at: ago(98), text: 'Backend contract done, UI pending - paused for Apple Pay crash.' }],
    related: ['i-17', 'i-09'],
  },
];
