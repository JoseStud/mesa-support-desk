# Optional hands-on practice — 25–40 minutes

**Personal review update — October 29, 2026:** José confirmed that he can explain and demonstrate Mesa's Bootstrap layout, request workflow, API and tests. This is his self-reported review; the optional code changes in this worksheet have not been separately recorded as completed. The worksheet is learning alongside an implemented application, not a list of unfinished software features. Software verification has its own [record](VALIDATION.md).

The interface is in Spanish. The default browser mode stores synthetic requests in this browser. The optional v0.3 API extension uses local FastAPI + SQLite; its setup and current verification status are in [API.md](API.md). Neither mode establishes a cloud deployment. Start the browser exercises below with `npm run dev` so their storage examples match the selected mode.

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

Open-only and overdue-only are already implemented. For a new exercise, add an optional **“Customer starts with” / “Cliente empieza por”** input that narrows results by a normalized customer-name prefix while preserving the existing filters.

1. Add an optional `customerPrefix` field to the filter type in `src/types.ts`.
2. In `src/domain.ts`, normalize the prefix and customer name consistently, then combine a prefix match with the existing predicates.
3. In `src/main.ts`, connect a labelled input, reset pagination when it changes and clear it in the clear-all action.
4. Add a test with customers `Café Central`, `Cafe del Puerto` and `Tienda Olivo`. Prefix `  CAFE  ` should match the first two; an additional status or priority selection should narrow them further. Confirm that the input records remain unchanged.
5. Check that an empty prefix preserves existing results and clear-all restores all defaults.

Write down the chosen behavior and a test that fails before the change. This is a proposed learner exercise, not an existing feature or completed user change. An alternative is a small, documented change to the deadline policy with updated boundary tests.

- [ ] I changed the filter, ran its test and can explain how it combines with other filters.

## 4. Explain failures and rerun checks — 5–10 minutes

Trace the relevant code in `src/domain.ts`, `src/storage.ts` and `src/main.ts`, then answer in your own words:

1. Why is resolving a new request directly rejected? Where is that rule enforced?
2. How are whitespace-only values and blank resolution notes rejected?
3. What happens if saving to browser storage throws an error? Why should the entered form remain available?
4. What happens if stored JSON is malformed? How does recovery avoid claiming a successful save?
5. What survives a page reload, and why is that different from a shared API/database?
6. Why does changing a request's priority recalculate its deadline from creation, and why can reopening make it overdue immediately?

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

Record your changes, results and remaining questions in [DEVELOPMENT_LOG.md](DEVELOPMENT_LOG.md). Keep one before/after screenshot and the relevant diff or commit. The existing [change requests](CHANGE_REQUESTS.md) describe software changes implemented by Codex; record your optional practice separately when performed.

## Optional API trace after the browser exercises

Start the backend and explicitly select API mode using [API.md](API.md). API integration checks are separate from the dated browser results; do not record a passing check until it actually runs.

1. Create a synthetic request and find its HTTP POST in the browser Network panel. Compare the submitted fields with the response's identity, history and positive `version`.
2. Add a comment using the current version, then explain why the server must validate the operation again even when TypeScript validated the form.
3. Use two clients to read the same request. Save one change, then submit the older version from the other client. Explain HTTP 409, preserved draft text and review before retrying.
4. Restart the backend with the same database path and inspect the saved request. Compare this with browser storage belonging to one origin.
5. Stop the API and attempt a save. Explain the visible failure and why the frontend must not silently create a different localStorage copy.

Read the [FastAPI and SQLite study guide](API_STUDY.md) for worked explanations. Record only the steps you personally performed; this worksheet does not mark them complete.
