# Development and learning log

## October 28, 2026 — build context

Work began on a Bootstrap SupportDesk demonstration for José's Trotalo Junior application, following the two-release project plan in the career workspace. Codex is assisting with the scaffold, implementation, tests and documentation. The existing Salesforce Support Desk supplies domain context: requests, priorities, status changes and resolution notes.

Release A is deliberately browser-local: TypeScript, Bootstrap 5, a compiled SCSS theme and local storage. It does not establish an API, shared backend or Google Cloud deployment. Those are later-release work.

This entry records the build context only. It does not certify passing checks, independent review or completion of José's practice. Actual execution results and learner changes belong in the entries below.

## Release verification

Executed by Codex on October 28,2026; see [VALIDATION.md](VALIDATION.md).

- `npm run check`: passed.
- `npm test`: 33 unit tests passed across two files.
- `npm run build`: passed.
- `npm run test:e2e`: nine browser tests passed against the production build.
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

The open-only filter and SCSS change in [LEARNING.md](LEARNING.md) remain pending. No completion, date or user-authored commit is recorded for them yet.
