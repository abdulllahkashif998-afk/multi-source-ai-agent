> Follow-up: stale custom CSS recurred during the Documents UI phase. The current setup now uses the documented Tailwind PostCSS pipeline instead of the custom Turbopack loader. See [Day 8 Documents UI](day-8-documents-ui.md) for the verified processing change; the investigation below records the earlier recovery.

# Frontend styling recovery

## Confirmed cause

The running Next.js development server was serving an obsolete processed global stylesheet. The page markup was current, but its linked CSS contained the original starter theme and lacked the new application selectors. This was a stale development CSS-transform/cache problem, not a missing layout import or an absent stylesheet response.

Evidence from the actual local server before recovery:

- The root layout already imported the correct global stylesheet.
- The linked stylesheet returned HTTP 200 with a text/css content type.
- Its response was about 14 KB and contained the old dark-mode starter palette; it had no workspace styles or current background variable.
- With dark browser preferences, the dashboard body computed to rgb(10, 10, 10), the workspace and cards computed to display:block, and the sidebar was transparent. This matches the reported black background and unformatted vertical layout.
- The source stylesheet contained the intended current theme, workspace flex layout, card grids and responsive rules.
- A fresh development compilation using the same stylesheet pipeline emitted those current rules. An isolated stylesheet edit was also picked up correctly.

The exact internal reason the old transform survived the earlier frontend edit was not established. We verified the stale output directly rather than assuming a Tailwind configuration failure.

## Fix applied

Invalidated the running development server's stylesheet transform with a temporary comment-only edit, then restored the stylesheet byte-for-byte to its starting contents. The running server reprocessed the real current stylesheet. Its served CSS grew to about 30 KB and contained the intended workspace selectors and theme, without the obsolete starter dark-mode rule.

The recovery continued to work after restoring the exact source. No permanent application-code or design change was necessary. No generated cache directory, stored upload, document, account or database record was deleted. The user's development server was not stopped.

No Tailwind, PostCSS or Turbopack configuration was changed in the project. This project uses the existing Tailwind v4 Turbopack loader, so the absence of a PostCSS configuration is not by itself an error in its active development/default-build pipeline. Fresh development and default production builds both produced working styles. Gemini/BGE configuration, authentication and backend behavior were untouched.

If an already-open browser tab still shows the old page, perform a hard refresh. If stale development output recurs after future edits, restart `npm run dev` and hard-refresh before changing CSS configuration. The new regression check can distinguish a stylesheet that merely loads from one that actually applies the expected layout.

## Permanent files added

- `tests/browser/styles-ui.mjs`: browser regression coverage for actual stylesheet responses and computed styles.
- `docs/frontend-styling-fix.md`: this investigation and verification report.

The source stylesheet was restored exactly. Existing unrelated working-tree changes were retained.

## Verification and actual results

| Check | Result |
| --- | --- |
| Actual local development app: landing, signup, login, dashboard and all three previews | All 14 desktop/mobile page checks passed |
| Default production build: same seven pages | All 14 desktop/mobile page checks passed |
| Existing browser authentication/navigation suite against production | All 12 scenarios passed |
| `npx tsc --noEmit` | Passed |
| `npm run lint` | Passed |
| `npm test` | 82 passed, 3 optional database tests skipped, zero failures |
| `npm run build` (default Turbopack) | Passed using the unchanged configuration and an isolated physical dependency directory |
| `npm run build -- --webpack` | Passed |

The browser styling checks verify 1440px desktop and 390px mobile layouts, including dark browser preferences, CSS HTTP status/content type, current body colors, styled buttons, desktop two-column/mobile single-column forms, workspace flex direction, sidebar colors, three-column/mobile single-column cards, dashed preview panels and absence of horizontal overflow. Browser page errors are checked. Desktop/mobile screenshots of the actual recovered app were visually inspected.

Authentication/navigation coverage includes signup validation, login, pending/error states, missing and expired sessions, CSRF-protected logout and rejection, cross-tab logout, protected previews, connection retry and keyboard navigation. Browser authentication responses were intercepted with fictional data; no real accounts were created and no Gemini requests were sent.

Production builds ran in an isolated source copy without copied environment credentials, preserving the active development output. An initial default-build attempt using a linked dependency root failed to load a native PDF dependency. Repeating with physical dependency files and the exact original configuration succeeded; this was an isolation artifact, not a remaining application build failure. An extra click-based auth run against development was obstructed by the Next.js development indicator over the sign-out area; the production run passed without that development overlay. The development styling checks themselves all passed.

## Run the styling regression check

With a local server already running and the optional browser runner installed as described in the Day 8 guide:

```bash
UI_BASE_URL=http://localhost:3000 \
  PLAYWRIGHT_MODULE=/tmp/day8-browser/node_modules/playwright \
  node tests/browser/styles-ui.mjs
```

The runner uses an existing Chrome installation, mocks only the session endpoint with a fictional account and performs no document/data mutations. It writes computed-style results and dashboard screenshots under `/tmp/frontend-styles*`. Run it separately against a production server to cover both CSS paths. The runner is separate from npm test because it requires a running browser and application.

## Remaining limitations

No styling regression remains in the tested pages/viewports. A long-running development cache could become stale again; the original cache-invalidation trigger could not be reconstructed conclusively. The test detects the incorrect output but does not patch Next.js or the Tailwind loader internals. Broader browser/device coverage remains useful. Real-account browser login was not repeated during this styling-only investigation.
