# Mesa release validation

## Local API release v0.3.0 — October 29, 2026

The integrated API release passed local checks. These results cover the exercised behavior; no remote CI, cloud deployment or completed personal practice is claimed.

| Check | Result |
|---|---|
| TypeScript | Passed; both production builds also run the type check |
| Frontend unit tests | 55 passed across domain, browser storage and API client suites |
| Backend API tests | 48 passed with isolated SQLite files; one Starlette TestClient deprecation warning |
| Dependency consistency | Fully pinned Python requirements installed; `pip check` passed |
| Production builds | Browser assets in `dist` and API assets in `dist-api` passed |
| Browser-mode regression | 15 production-preview journeys passed |
| API-mode integration | 6 production-preview journeys passed against an isolated temporary SQLite database |
| Real process restart | A created, started, commented and resolved request exactly matched after stopping and restarting Uvicorn with the same database file |
| Lost creation response | Actual server commit followed by a lost response, cancel/reopen and keyed retry produced one request |
| Stale update | HTTP 409 retained the newer server state, restored both drafts and required explicit retry |
| Unconfirmed detail write | Further changes locked until refresh; saved history and unsent drafts remained available |
| Unavailable API | Visible failure and retry; no browser data import, fabricated seeds or localStorage fallback |
| Live LAN API preview | Loaded synthetic server records at 375, 768 and 1440 px with no page errors, horizontal overflow or browser-storage writes |

API integration tests use backend port 8001 and production preview port 4175. The test launcher creates and cleans its own temporary database; it does not reset the normal demo database. The earlier browser suite uses port 4174. See [API.md](API.md) for setup and HTTP behavior.

```bash
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements-dev.txt
backend/.venv/bin/python -m pytest backend/tests -q
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:e2e:api
```

The API test command builds `dist-api` before testing it. `MESA_API_PYTHON` can select a different installed Python environment. [Restart evidence](api-restart-validation.json) records the independent-process check. [The API study guide](API_STUDY.md) explains the implementation and interview exercises.

Live API preview screenshots: [mobile](screenshots/api-375.png), [tablet](screenshots/api-768.png), [desktop](screenshots/api-1440.png). The earlier recording below demonstrates browser mode.

## Retained browser release v0.2.0

Executed October 29, 2026. **Browser software acceptance is complete.** These are actual local results, not public CI results. Optional learner practice is tracked separately.

| Check | Result |
|---|---|
| TypeScript (`npm run check`) | Passed |
| Unit tests (`npm test`) | 43 passed across 2 files: 24 domain and 19 storage cases |
| Production build (`npm run build`) | Passed, Vite 8.3.5 |
| Browser tests (`npm run test:e2e`) | 15 passed against the production preview |
| Layout widths | 375, 768 and 1440 px; no horizontal page overflow in browser checks |
| Keyboard | Escape closes detail after its opening transition; focus returns to the request button |
| Save recovery | Creation retains input after failure; retry saves once; failed priority change restores the saved selection |
| Draft preservation | Changing priority retains unrelated text; posting a comment retains a resolution draft and restores focus |
| Corrupt saved data | Original bytes preserved until explicit reset |
| New filters and deadlines | Open-only/overdue intersections, pagination reset, resolved exclusion and priority-based recalculation passed |
| Focus and recovery | Metric and clear-filter focus retained; failed detail save is focused/scrolled into view; reset is reachable on mobile |
| Long content | Maximum-length unbroken title and customer names wrap on mobile |
| LAN HTTP creation | Verified at `http://192.168.1.6:4173`, with `isSecureContext=false` and `crypto.randomUUID` unavailable; one request created and no page errors |

Deadline boundary checks cover just before, exactly at and after the deadline. The deadline is creation time plus the current priority's 4/24/72 calendar hours. Resolved requests are excluded; reopening uses the original creation time. These are informational demo targets, not a business-hours SLA.

## Reproduce

```bash
npm ci
npm run check
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Tests use the built app on port 4174 rather than the development server, so hot reload cannot interrupt a browser test. The development app remains on port 4173 for practice.

The current workspace used Node 22.23.4, cached Playwright 1.63 Chromium and temporary Linux browser libraries. Its browser command was:

```bash
PATH=/tmp/cartagena-node/bin:$PATH \
LD_LIBRARY_PATH=/tmp/cartagena-browser-libs/usr/lib/aarch64-linux-gnu \
MESA_CHROMIUM_PATH=/home/anxrpi/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux-arm64/chrome-headless-shell \
npm run test:e2e
```

Those absolute paths describe this machine; normal Playwright installations do not need them.

## Evidence

- [Desktop screenshot](screenshots/desktop.png)
- [Tablet screenshot](screenshots/tablet.png)
- [Mobile screenshot](screenshots/mobile.png)
- [Request detail screenshot](screenshots/request-detail.png)
- [Overdue-filter screenshot](screenshots/overdue-filter.png)
- [Recorded workflow](demo.webm)
- [Actual bug and review record](DEVELOPMENT_LOG.md)

The recording uses synthetic data and video-only explanatory captions. It demonstrates create → filter → start → comment → resolve → reload → reopen. It is an automated demonstration, not a recording of José completing the practice.

## Limits

At the v0.2.0 checkpoint, no public GitHub CI or hosting had been created. The browser release was complete with browser-local persistence; the later v0.3.0 API results are recorded above. Cloud deployment remains outside these releases. Personal learning is recorded separately after actual practice.
