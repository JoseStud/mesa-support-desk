# Development and learning log

## October 28, 2026 — build context

Work began on a Bootstrap SupportDesk demonstration for José's Trotalo Junior application, following the two-release project plan in the career workspace. Codex is assisting with the scaffold, implementation, tests and documentation. The existing Salesforce Support Desk supplies domain context: requests, priorities, status changes and resolution notes.

Release A is deliberately browser-local: TypeScript, Bootstrap 5, a compiled SCSS theme and local storage. It does not establish an API, shared backend or Google Cloud deployment. Those are later-release work.

This entry records the build context only. It does not certify passing checks, independent review or completion of José's practice. Actual execution results and learner changes belong in the entries below.

## Release verification

Latest browser release verification: October 29, 2026; see [VALIDATION.md](VALIDATION.md). Earlier October 28 checks passed 33 unit and nine browser cases.

- `npm run check`: passed.
- `npm test`: 43 unit tests passed across two files.
- `npm run build`: passed.
- `npm run test:e2e`: 15 browser tests passed against the production build.
- Responsive and keyboard checks: 375/768/1440 px; Escape and focus-return checks passed after the offcanvas opening transition.
- Evidence files: desktop/tablet/mobile/detail screenshots and `docs/demo.webm`.
- Remaining limitations: browser-only storage; no API/cloud/public CI; learner modifications pending.

## José's hands-on practice

Status: **pending**. See [LEARNING.md](LEARNING.md).

- Practice date:
- SCSS color or grid breakpoint changed:
- Filter behavior changed:
- Test added/modified and result:
- What I can explain without an assistant:
- Remaining questions:

## Actual bug or change record

### October 28 — detail updates lost unrelated drafts

An independent agent review reproduced this issue in Playwright: type a resolution note and a comment, then change the priority. Both drafts disappeared and focus moved to the document body. The detail renderer replaced its markup without retaining local form state.

The fix captures both draft values before a successful update, restores unrelated values after rendering, clears only the submitted field and restores focus. A regression browser test checks priority changes and comment submission while a resolution draft exists. It passed in the final nine-test run. Codex implemented and reviewed the change; it is not recorded as a learner-authored fix.

### October 28 — failed priority saves displayed an unsaved selection

Review injected a storage-write failure, then selected Urgent. The selector showed Urgent even though the persisted request remained Normal; choosing Urgent again could not trigger a new change event.

The fix restores the persisted selection on failure. A browser regression test injects the failure, checks the restored value, permits saving again and verifies that the same choice then persists. It passed.

### October 28 — recovery wording and browser-test timing

Recovery copy originally implied that downloading a backup unlocked writes. It now says that a reset is required and a backup can be downloaded beforehand; the storage adapter's error explains read failures separately.

The first keyboard automation checked visual visibility before Bootstrap finished opening and activating its focus trap. The test now waits for the completed `show` state before Escape. A later run was interrupted by a Vite development reload, so browser checks now target the production preview on 4174. All nine tests passed against that built app.

### Planned learner change

The open-only filter has now been implemented by Codex at José's request to complete the browser app; it is no longer a pending learner feature. Optional learner exercises are in [LEARNING.md](LEARNING.md); no user-authored change is recorded without confirmation.

### October 29 — browser completion

Added open-only and overdue filters, urgency shortcut, derived deadline labels and complete filter reset. Priority changes recalculate the informational deadline from the original creation time. The storage schema remains version1, so existing saved requests still load.

Browser review reproduced focus loss when a metric or empty-state clear action rerendered its own button; those actions now restore a suitable focus target. Failed comment-save feedback could be outside the scrolled panel; errors now receive focus and scroll into view. Mobile help now exposes demo reset, long request/customer text wraps, and filter padding prevents clipped labels.

LAN review verified an insecure HTTP context where `crypto.randomUUID` is unavailable. Default IDs now use `crypto.getRandomValues`; request creation succeeded at the LAN URL. Dedicated unit/browser checks protect this case. The two simulated product requests are recorded in [CHANGE_REQUESTS.md](CHANGE_REQUESTS.md).

A final compatibility check found that storage accepted a `24:00:00` timestamp which the new deadline functions rejected. Storage validation now rejects that noncanonical clock hour too, so malformed saved data enters recovery instead of failing during queue rendering. The regression sets creation, update and activity times together to prove the compatibility case rather than failing for an unrelated history-order check.

## October 29 — authorized local API extension, v0.3.0

José requested API/backend integration before the final CV review. The implementation extends the retained browser release with an explicitly selected local FastAPI + SQLite mode. Codex and collaborating agents implemented the backend, asynchronous frontend integration, tests and documentation. This is not recorded as a learner-authored change.

The API contract includes health/list/detail/create endpoints, transitions, comments and priority changes. API records carry a positive integer version; mutating an older version returns HTTP 409. Server-side validation returns 422 and missing request IDs return 404. The SQLite path defaults to `backend/data/mesa.sqlite3`, with `MESA_DB_PATH` as an override. The backend seeds fictional data on initial database creation only.

The default frontend mode remains browser-local. `VITE_MESA_STORAGE=api` opts into the API through Vite's local proxy; the client must not import browser records or silently fall back to browser storage. API mode disables demo reset because the API has no reset/delete endpoint. It has no authentication or cloud deployment.

**Verification status: passed locally.** The existing browser verification above belongs to v0.2.0. Specific API results are recorded below as they are executed. Setup and the contract are described in [API.md](API.md).

### Specific API persistence check — verified October 29

Root executed creation, start, comment and resolution through an actual HTTP server, reaching version 4. After stopping Uvicorn and starting an independent process with the same temporary SQLite file, GET returned the same fields, activity and resolution, without duplicate seed records. The machine-readable evidence is [mesa_api_restart_validation.json](api-restart-validation.json). This verifies that recorded restart scenario; later suite results are separate.

Creation replay protection is implemented through an optional `Idempotency-Key` header and a SQLite mapping of key, normalized input hash and request ID. Same-key/same-input retries return the existing request; different input conflicts. The frontend retains the pending attempt key for explicit same-input retries and treats ambiguous outcomes for other commands as requiring refresh/review. These behavior descriptions come from the implementation; specific test outcomes must be added only after execution.

### API frontend verification — confirmed October 29

The frontend type check, 55 frontend unit tests, 48 backend tests, both production builds, 15 browser-mode journeys and six API-mode journeys passed locally on October 29, 2026. A real-process restart check also preserved the full request, resolution and history.

Review found that dismissing an unconfirmed creation discarded its retry key. The modal now retains that key until acknowledgement or explicit server review. The production API browser suite verifies lost-response creation across cancel/reopen, plus uncertain detail writes, conflict recovery and draft preservation. The backend suite checks atomic conflicts, SQL rollback and persisted create replay after restart. These results cover the exercised behavior, not every possible failure or completed learner practice.

### Personal review confirmation — October 29

José confirmed that he has worked through Mesa enough to explain and demonstrate its Bootstrap layout, request workflow, API and tests. This records his self-assessment, not an independent interview result, a review of every test's efficiency or completion of the optional worksheet's specific code changes. It does not change the recorded implementation authorship or establish a year of Bootstrap experience.
