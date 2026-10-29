# Release A validation

Executed October 28, 2026. **Application checks passed; José's hands-on practice remains pending.** All test counts below are actual local results, not public CI results.

| Check | Result |
|---|---|
| TypeScript (`npm run check`) | Passed |
| Unit tests (`npm test`) | 33 passed across 2 files |
| Production build (`npm run build`) | Passed, Vite 8.3.5 |
| Browser tests (`npm run test:e2e`) | 9 passed against the production preview |
| Layout widths | 375, 768 and 1440 px; no horizontal page overflow in browser checks |
| Keyboard | Escape closes detail after its opening transition; focus returns to the request button |
| Save recovery | Creation retains input after failure; retry saves once; failed priority change restores the saved selection |
| Draft preservation | Changing priority retains unrelated text; posting a comment retains a resolution draft and restores focus |
| Corrupt saved data | Original bytes preserved until explicit reset |

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
- [Recorded workflow](demo.webm)
- [Actual bug and review record](DEVELOPMENT_LOG.md)

The recording uses synthetic data and video-only explanatory captions. It demonstrates create → filter → start → comment → resolve → reload → reopen. It is an automated demonstration, not a recording of José completing the practice.

## Limits

No public GitHub CI or hosting has been created. The release has browser-local persistence, not an API or cloud database. Automated checks do not establish external users, production security or a duration of employment. Personal learning is recorded separately after actual practice.
