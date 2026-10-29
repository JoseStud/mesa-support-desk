# Browser release change requests

October 29, 2026. These are **simulated product requests** for the Mesa demonstration, implemented by Codex. They are not reports from external customers or records of José completing a learning exercise.

Both changes preserve Release A's browser-local scope and existing version-1 storage schema. **Release A v0.2.0 verification passed on October 29:** type checks, production build, 43 unit tests and 15 browser tests. Actual LAN HTTP request creation also passed without `randomUUID`. See [VALIDATION.md](VALIDATION.md) for execution evidence and environment details. These are local results, not public CI runs.

## CR-01 — focus on open requests

**Request:** As an agent, I want to hide resolved requests while keeping my other selections so I can focus on work that still needs attention.

**Acceptance criteria**

- An open-only switch excludes `resolved` requests.
- It combines with text, category, priority and explicit status selections. Selecting Resolved and open-only correctly produces no matches.
- Turning it off restores the existing filter behavior; it does not change request records.
- Changing the selection resets pagination. Clear-all removes the switch and restores other defaults.

**Implementation:** `RequestFilters.openOnly` feeds the pure filtering function in [domain.ts](../src/domain.ts). A labelled switch and event handling in [main.ts](../src/main.ts) update the queue. The urgent shortcut and clear-all controls make common queue selections accessible.

**Verification:** Passing unit cases check combined filtering, conflicting status selections, the disabled-switch behavior and unchanged source data. Browser checks for navigation, combined selections and reset passed in the final release run.

## CR-02 — identify overdue work with clear deadline rules

**Request:** As an agent, I want to see which requests have reached their informational deadline and narrow the queue to those requests.

**Exact policy**

| Current priority | Calendar-hour allowance from creation |
|---|---|
| Urgent | 4 hours |
| Normal | 24 hours |
| Low | 72 hours |

- The deadline is `createdAt + allowance(current priority)`; it is derived rather than saved as another field.
- Nights and weekends count. This is an informational demonstration policy, not a business-hours SLA or notification service.
- An unresolved request is overdue when the evaluation time is **at or after** the deadline.
- Resolved requests are excluded from overdue counts and filtering.
- Changing priority recalculates from the original creation time; it does not grant a new period starting at the update.
- Reopening retains the creation time, so a reopened request may immediately be overdue.
- A queue render uses one evaluation instant for its deadline-based results. Rendering or another interaction refreshes the display; there is no alert scheduler.

**Acceptance criteria**

- Queue rows, phone cards and request detail show understandable deadline information.
- Overdue-only combines with text, status, priority, category and open-only filters.
- The overdue count excludes resolved requests and reflects a successful priority change.
- Boundary checks cover immediately before, exactly at and immediately after a deadline.
- Existing saved records load without a migration; invalid creation/evaluation dates are rejected by the deadline functions.

**Implementation:** [domain.ts](../src/domain.ts) exposes `responseDueAt` and `isOverdue`, and applies the overdue predicate through `RequestFilters.overdueOnly`. [main.ts](../src/main.ts) renders the labels, counter, policy explanation and switch.

**Verification:** Passing unit cases check each priority allowance, exact boundaries, resolved exclusion, priority recalculation, date validation and combined filters with an injected time. Browser checks for overdue filtering and priority changes passed in the final release run.

## Related usability corrections

The same browser-completion pass also replaces the `randomUUID` dependency with IDs from `crypto.getRandomValues` for local HTTP/LAN use, improves long-text wrapping and select spacing, makes error feedback focusable and visible, preserves useful focus after navigation, and exposes confirmed reset through Help on mobile. The related browser checks passed. A real browser visit to `http://192.168.1.6:4173` also created one request successfully with `isSecureContext` false, `randomUUID` undefined and no browser errors.
