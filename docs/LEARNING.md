# Guided hands-on practice — 25–40 minutes

**All exercises are pending.** Codex generating a working application does not mean José has completed this practice. The goal is to make two real changes, check them, and explain the relevant behavior.

The interface is in Spanish. Release A stores synthetic requests in this browser; it has no API or cloud backend.

## 1. Run and trace the app — 5 minutes

From the project directory, install dependencies with `npm ci` if needed, then start:

```bash
npm run dev
```

Open the local URL printed by Vite; the configured development port is 4173. Create a request, find it with two filters, start work, resolve it with a note, and reload.

Read these files as a map of that workflow:

| File | Question to answer |
|---|---|
| [src/types.ts](../src/types.ts) | What fields belong to a request, its filters and an activity event? |
| [src/main.ts](../src/main.ts) | How does a form or filter event reach the domain and update the screen? |
| [src/domain.ts](../src/domain.ts) | Where are validation, filtering and allowed transitions enforced? |
| [src/storage.ts](../src/storage.ts) | What is saved, and what happens when loading or saving fails? |
| [src/styles.scss](../src/styles.scss) | Which styles are Bootstrap defaults and which are customized here? |

- [ ] I completed the workflow and can locate those responsibilities.

## 2. Make one Bootstrap/SCSS change — 5–8 minutes

In `src/styles.scss`, find the theme's primary-color setting. Change it to a different readable color, rebuild, and inspect its effect on buttons and focus/selection styling. Keep text and control contrast readable.

Alternatively, change one grid breakpoint in `src/main.ts` and compare when columns stack at phone/tablet widths. Make a deliberate choice based on the content rather than changing a class at random.

Record the actual file, change and reason:

- File/setting changed: **pending**
- Before → after: **pending**
- Why this improves or changes the interface: **pending**

- [ ] I made the change and can explain why SCSS is compiled while the resulting CSS runs in the browser.

## 3. Add or modify a filter — 10–15 minutes

Add an **“Open only” / “Solo abiertas”** toggle. It should exclude `resolved` requests while preserving the existing text, priority and category selections.

1. Add the filter state to `src/types.ts` if necessary.
2. Add its predicate to the filtering logic in `src/domain.ts`.
3. Connect a labelled control and its events in `src/main.ts`.
4. Add a unit test using three records: urgent/new, urgent/resolved and normal/in-progress. With urgent + open-only selected, only urgent/new should remain. Confirm that the input records are unchanged.
5. Check that turning the toggle off restores the existing filter behavior.

If an equivalent toggle already exists when you start, extend the search to a currently unsupported request field or improve its normalization. Write down the chosen behavior and a test that fails before the change. Complete a real modification rather than marking an existing feature as your exercise.

- [ ] I changed the filter, ran its test and can explain how it combines with other filters.

## 4. Explain failures and rerun checks — 5–10 minutes

Trace the relevant code in `src/domain.ts`, `src/storage.ts` and `src/main.ts`, then answer in your own words:

1. Why is resolving a new request directly rejected? Where is that rule enforced?
2. How are whitespace-only values and blank resolution notes rejected?
3. What happens if saving to browser storage throws an error? Why should the entered form remain available?
4. What happens if stored JSON is malformed? How does recovery avoid claiming a successful save?
5. What survives a page reload, and why is that different from a shared API/database?

Use the existing storage-failure test as a reproducible example; identify the injected failure and expected behavior. Do not assume disabling JavaScript or reloading alone simulates a failed save.

Run:

```bash
npm run check
npm test
npm run build
npm run test:e2e
```

- [ ] I reran the checks and recorded the actual results.
- [ ] I can demonstrate and explain my SCSS/layout change and filter change.

If the exercises take longer, continue in another short session. A time estimate is not a completion requirement.

## Practice evidence to retain

Record your real changes, results and remaining questions in [DEVELOPMENT_LOG.md](DEVELOPMENT_LOG.md). Keep one before/after screenshot and the relevant diff or commit. After completing the exercises, describe the project features you actually understand and can demonstrate; the generated application and your hands-on practice are separate evidence.
