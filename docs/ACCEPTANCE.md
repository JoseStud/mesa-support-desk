# Release A acceptance stories

Created October 28, 2026. These are acceptance criteria, not a record that the checks or José's practice have been completed.

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

## Interface and recovery checks

- [ ] Create → filter → start → resolve → reload → inspect history succeeds.
- [ ] Phone, tablet and desktop widths remain usable, including long customer names and descriptions.
- [ ] Form controls have labels; status and priority are conveyed by text as well as color.
- [ ] The detail dialog/panel can be opened, used and closed with a keyboard; focus returns to a sensible control.
- [ ] The SCSS theme visibly changes Bootstrap styling through owned source files.
- [ ] Malformed stored data is handled with a visible recovery path; reset-to-demo requires confirmation.
- [ ] `npm run check`, `npm test` and `npm run build` pass on the actual revision.
- [ ] `npm run test:e2e` checks the browser workflow on the actual revision.

Record actual results in the release evidence. Keep the separate learner checklist in [LEARNING.md](LEARNING.md) pending until José performs the exercises.
