# Mesa — Bootstrap SupportDesk

A responsive request workspace built with **Bootstrap 5.3, SCSS and TypeScript**. Create a request, find it through combined filters, start work, document the resolution and keep its history when reopening.

![Mesa desktop workspace](docs/screenshots/desktop.png)

[Watch the recorded workflow](docs/demo.webm) · [Validation and environment](docs/VALIDATION.md) · [Optional hands-on practice](docs/LEARNING.md)

**Release A v0.2.0:** completed single-agent browser application with synthetic data and browser-local persistence. Local type checks, unit tests, production build and browser checks passed on October 29, 2026. It has no API, shared database, authentication or cloud backend. The application was built with AI assistance; optional learner exercises are tracked separately from software implementation and verification.

## Run

Node.js **22.12+** is required. From this directory:

```bash
npm ci
npm run dev
```

Open the printed local URL, normally <http://127.0.0.1:4173>. The development server also listens on the LAN; on the current machine it is available at <http://192.168.1.6:4173>. To serve the production build, use `npm run build`, then `npm run preview` on port 4174.

Browser data is tied to the origin: localhost and the LAN address have separate stored requests even on the same browser.

On the current Codex workspace, Node is available in `/tmp/cartagena-node/bin`; add that directory to `PATH` when your shell cannot find `node`. The [local launcher](scripts/start-local.sh) handles this workspace fallback automatically.

## What works

- Responsive Bootstrap grid, request table and mobile cards, forms, modal, offcanvas and toast feedback.
- A compiled SCSS theme with Bootstrap variable overrides and a reusable priority-color mixin.
- Combined text/status/priority/category filtering, sorting and pagination. Search ignores case and accents and includes the displayed request number.
- Open-only and overdue-only switches combine with the other filters. An urgent shortcut, clear-all action and current sort caption help navigate the queue.
- Informational response deadlines appear in the queue and request detail, with an overdue count and filter.
- Validated request creation and New → In progress → Resolved transitions. A resolution note is required; reopening keeps the earlier resolution in history.
- Comments, priority changes and chronological activity. Unrelated draft text survives detail updates.
- Validated version-1 `localStorage` records. A failed save preserves input; corrupt saved bytes are left untouched until explicit reset. Export is available before reset.
- Request creation supports local HTTP/LAN origins through random IDs based on `crypto.getRandomValues`, without depending on `randomUUID`.
- Reset is available through Help on mobile. Long text wraps, error feedback receives focus, and detail updates retain unrelated drafts.
- Unit and browser test suites exercise the workflow, filtering, deadline rules, recovery, responsive layouts and keyboard focus. See the validation record for actual execution results.

## Deadline policy

Deadlines are an informational demonstration rule: **creation time + current priority allowance**. Urgent allows 4 calendar hours, Normal 24 and Low 72; nights and weekends count. A request becomes overdue exactly at its deadline, unless resolved.

Changing priority recalculates the deadline from the original creation time rather than restarting the clock. Reopening retains that creation time, so an older request can immediately be overdue. The interface evaluates this when rendering; the feature is not a notification or business-hours SLA service.

Deadlines are derived from existing fields. Saved version-1 records retain the same schema. See the two [simulated change requests](docs/CHANGE_REQUESTS.md) for the feature decisions and verification status.

## Verify

```bash
npm run check
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The browser install is a one-time setup for a new machine. Linux may need Playwright's documented browser system dependencies. A custom executable can be selected through `MESA_CHROMIUM_PATH`; ordinary installations use Playwright's default browser.

See [validation evidence](docs/VALIDATION.md) for actual results and environment details. Software checks and optional personal practice have separate records.

## Read the implementation

```mermaid
flowchart LR
  UI[Bootstrap interface] --> Events[TypeScript event handlers]
  Events --> Domain[Validation, filters and transitions]
  Domain --> Save[Validated storage adapter]
  Save --> Browser[(Browser localStorage)]
  Save --> UI
```

| File | Responsibility |
|---|---|
| [src/main.ts](src/main.ts) | Rendering, Bootstrap components, events, save feedback and draft preservation |
| [src/domain.ts](src/domain.ts) | Immutable request creation, filters, deadline policy, workflow rules and activity |
| [src/storage.ts](src/storage.ts) | Versioned schema validation and storage failure handling |
| [src/seed.ts](src/seed.ts) | Eight fictional requests with realistic histories |
| [src/types.ts](src/types.ts) | Request, activity and filter types |
| [src/styles.scss](src/styles.scss) | Bootstrap theme, layout, responsive treatment and priority mixin |

[Acceptance stories](docs/ACCEPTANCE.md) · [Change requests](docs/CHANGE_REQUESTS.md) · [Optional practice](docs/LEARNING.md) · [Development log](docs/DEVELOPMENT_LOG.md)

## Scope and limitations

Data belongs to this browser and origin. It is not synchronized or an encrypted/shared customer system. Use synthetic information. Clearing browser storage removes saved requests. The current release does not coordinate simultaneous edits from multiple tabs.

The proposed next release adds FastAPI, durable backend storage and Google Cloud deployment. Those features are outside this browser release. Public GitHub publication and remote CI are separate delivery options; the current workflow runs locally or on the LAN.
