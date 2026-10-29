# Release A acceptance stories

Created October 28, 2026; expanded and verified October 29. **Release A v0.2.0 software acceptance is complete.** Type checks, production build, 43 unit tests and 15 browser tests passed locally. Request creation also passed on the actual LAN HTTP origin without `randomUUID`. See [VALIDATION.md](VALIDATION.md) for execution evidence and environment details. José's optional practice has a separate record.

Release A is a single-agent demonstration with synthetic requests and **browser-local storage**. Its purpose is to demonstrate Bootstrap 5, SCSS, TypeScript, request handling and useful tests. API integration, shared accounts and Google Cloud delivery belong to a later release. Existing projects supply separate evidence of those skills.

## Story 1 — record a request

As an agent, I want to record a customer's request so I can track its resolution.

- Given the creation form, when a required text field contains only whitespace, saving is rejected with a useful message.
- When valid customer, title, description, category and priority values are submitted, one request is created with status `new` and an initial activity event.
- The new request appears in the queue and the success feedback is visible.
- If the browser cannot save the data, the attempted change is not shown as successful, the entered text is retained, and retry is possible.

## Story 2 — find the relevant work

As an agent, I want to combine text and selection filters so I can find the request I need.

- Text searches ignore leading/trailing whitespace and letter case.
- Status, priority and category filters combine with the text search rather than replacing one another.
- Sorting produces a predictable order without changing the stored request list.
- A search with no matches shows an understandable empty state and permits recovery by changing the filters.
- Summary information and the queue remain consistent after a request is created or updated.

## Story 3 — resolve and revisit a request

As an agent, I want to track work and document the solution so I can explain what happened later.

- A `new` request can move to `in_progress`; an `in_progress` request can move to `resolved` only with a nonblank resolution note.
- Unsupported transitions are rejected without partially modifying the request.
- Resolution and subsequent reopening preserve the chronological activity history. Reopening returns the request to `in_progress`.
- Reloading the page restores successfully saved requests, status and history from the same browser's storage.

## Verified baseline — October 28

- [x] Create → filter → start → resolve → reload → inspect history succeeds.
- [x] Phone, tablet and desktop layouts remain usable at the checked baseline sizes.
- [x] Form controls have labels; status and priority are conveyed by text as well as color.
- [x] The detail panel can be opened, used and closed with a keyboard; focus returns to the request control.
- [x] The SCSS theme visibly changes Bootstrap styling through owned source files.
- [x] Malformed stored data is handled with a visible recovery path; reset-to-demo requires confirmation.
- [x] `npm run check`, `npm test` and `npm run build` passed on the baseline revision.
- [x] `npm run test:e2e` passed the baseline browser workflow.

## Expanded browser release — verified October 29

The following implemented behavior passed the expanded release's local verification.

- [x] Open-only excludes resolved requests and combines with text, status, priority and category filters without modifying the stored requests.
- [x] Overdue-only uses the same evaluation instant across matching requests, excludes resolved requests and combines with the other filters.
- [x] Deadline rules use creation time plus current priority: Urgent 4, Normal 24, Low 72 calendar hours. The exact boundary counts as overdue; priority changes recalculate from creation; reopening can restore overdue status.
- [x] Urgent navigation, clear-all filters, active controls, pagination and the sort caption remain consistent.
- [x] Creation works on a local HTTP origin where `crypto.randomUUID` is unavailable.
- [x] Maximum-length titles and customer names wrap at phone width without horizontal content overflow.
- [x] Mobile users can reach reset through Help and confirm it; resetting clears filters and restores synthetic requests.
- [x] Empty-state recovery, metric shortcuts and error feedback retain useful keyboard focus and scroll position.
- [x] Type checks, unit tests, production build and the final browser suite pass on the expanded revision.

The deadline feature is informational calendar-hour logic, not an automated alert or business-hours SLA. It adds no stored schema fields, API or cloud service. See [CHANGE_REQUESTS.md](CHANGE_REQUESTS.md).

José's optional [practice checklist](LEARNING.md) is separate. Its unchecked exercises do not mean the corresponding application software is unfinished. Public GitHub/CI and API/cloud delivery are outside this browser release.
