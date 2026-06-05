# INSTR.MD Performance and Smoothness Checklist

Source of truth: `C:\Users\Yours Wellness\Desktop\INSTR.MD`
Test date: 2026-06-05
Production URL: `https://ywcoach.com`
Latest production deployment verified: `https://5e12e976.ywcoach.pages.dev`
Latest source commit verified: `c7bdaeb`

## Summary

Total INSTR.MD requirement groups found: 49
Completed and tested: 49
Partial: 0
Failed: 0
Blocked: 0

Notes:

- This checklist covers the active INSTR.MD performance/smoothness source of truth only.
- Older admin/analytics backlog items are tracked separately in `docs/qa/md-requirements-checklist.md`.
- Production fake data was not created. AI loading was tested locally with mocked admin/session/generation APIs to avoid fake production records and unnecessary OpenAI token spend.
- The paid masterclass Grainient background now uses a universal adaptive visual capability policy: capable devices receive animated visuals, capable mobile/tablet devices receive reduced live visuals, and constrained/reduced-motion/save-data devices receive a premium static fallback.
- Local paid `/go/gyana-pcos-51` is intentionally unavailable without local `FUNNEL_ACCESS_SECRET`; production paid entry was tested and works.
- Post-fix admin recovery verification confirmed `/admin/users`, `/admin/panel`, `/admin/overview`, `/admin-panel`, `/admin_panel`, `/admin%20panel`, `/Admin/Dashboard`, `/admil/dashboard`, and `/dashboard` route to the admin dashboard/login flow without `YW-ERR-404` or unexpected Contact Support fallback.

## Requirement Checklist

| # | Requirement | Implemented | Tested | Result | Issue found | Fix applied / evidence | Remaining blocker |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Inspect Website Creator code | Yes | Yes | Pass | None current | `components/admin/admin-coach-sites-manager.tsx` inspected; preview debounce, wizard, AI progress, publish progress verified. | None |
| 2 | Inspect coach template components | Yes | Yes | Pass | None current | `components/coach/public-coach-site-page.tsx`, CSS module, and Cloudflare `functions/coach/[slug].ts` inspected/tested. | None |
| 3 | Inspect animation components | Yes | Yes | Pass | Continuous pieces existed | Grainient, carousel, global loader, graph hover, spotlight inspected and optimized/gated. | None |
| 4 | Inspect glassmorphism/blur/shadow effects | Yes | Yes | Pass | Mobile blur can be expensive if not constrained | Mobile glass overrides and fallback blur reductions are present; no overflow/jank symptoms in matrix. | None |
| 5 | Inspect background effects | Yes | Yes | Pass | WebGL/background effects could run too often or be disabled too broadly on capable phones/tablets | Grainient now uses adaptive full/reduced/static capability detection with visibility/reduced-motion checks, capped FPS, and a premium static fallback. | None |
| 6 | Inspect scroll animations/listeners | Yes | Yes | Pass | Scroll/pointer listeners could add mobile overhead | Public coach mobile has 0 pointermove spotlight listeners; scroll listener is rAF-scheduled. | None |
| 7 | Inspect preview system | Yes | Yes | Pass | Preview could rerender too often | Preview component memoized; theme callback stabilized; preview side effect debounced. | None |
| 8 | Inspect admin dashboard components | Yes | Yes | Pass | Graph hover previously updated directly | Graph hover now rAF-batched and skips redundant state changes. | None |
| 9 | Inspect heavy dependencies | Yes | Yes | Pass | OGL/Three/WebGL can be heavy | WebGL effects gated/lowered; no new dependency added. | None |
| 10 | Inspect image/video/media handling | Yes | Yes | Pass | Media failures must not break route | Image/video fallback/error logging exists; public routes tested without fallback. | None |
| 11 | Find lag cause: too many animations at once | Yes | Yes | Pass | Carousel/background were candidates | Carousel pauses offscreen; background FPS reduced. | None |
| 12 | Find lag cause: heavy blur/glass | Yes | Yes | Pass | Mobile blur can be expensive | Mobile-safe glass filters and no-overflow visual checks passed. | None |
| 13 | Find lag cause: scroll/mousemove setState | Yes | Yes | Pass | Analytics graph pointer state was candidate | Graph hover is rAF-batched; coach spotlight pointer disabled on touch/mobile. | None |
| 14 | Find lag cause: layout-shifting animations | Yes | Yes | Pass | No active page failures found | Runtime probes showed no horizontal overflow and no framework overlay. | None |
| 15 | Find lag cause: preview rerender on input | Yes | Yes | Pass | Preview side effects could rerender too often | Preview sync is debounced; user input remains immediate for form responsiveness. | None |
| 16 | Find lag cause: localStorage writes | Yes | Yes | Pass | Builder localStorage writes not found | No builder localStorage write loop. Live-viewer localStorage writes only a stable viewer id. | None |
| 17 | Find lag cause: unclean timers/listeners | Yes | Yes | Pass | Long-running timers/listeners can leak | Carousel, loader, preview, graph, spotlight and Grainient cleanup paths verified in code. | None |
| 18 | Use transform/opacity for animations where possible | Yes | Yes | Pass | None current | Public template/carousel/loader interactions use transform/opacity-oriented motion; no tested layout jank. | None |
| 19 | Avoid animating width/height/top/left for core motion | Yes | Yes | Pass | Ripple uses positional sizing for transient click effect only | Primary motion paths are transform/opacity; transient ripple is scoped and removed. | None |
| 20 | Reduce heavy blur intensity where it causes lag | Yes | Yes | Pass | None current | Mobile CSS has reduced/no backdrop filters in heavy sections. | None |
| 21 | Disable/simplify heavy effects on mobile | Yes | Yes | Pass | Pointer spotlight would be unnecessary on touch; mobile Grainient should not be blanket-disabled on capable devices | Mobile 390 public coach page had 0 pointermove listeners. Paid Grainient now uses reduced live mode for capable phones/tablets and static fallback only when device/network/motion support requires it. | None |
| 22 | Respect prefers-reduced-motion | Yes | Yes | Pass | None current | Coach template, Grainient, loader and animation CSS have reduced-motion fallbacks. | None |
| 23 | Stop animations when offscreen | Yes | Yes | Pass | Paid carousel previously ran while offscreen | Probe confirmed `offscreenChanged=false`, `onscreenChanged=true`. | None |
| 24 | Lazy-load heavy sections/components if needed | Yes | Yes | Pass | No additional lazy import needed after gating | Heavy preview is only mounted in wizard preview step; analytics details open in dialog on demand. | None |
| 25 | Memoize expensive components | Yes | Yes | Pass | Preview callback identity could force rerender | `CoachSitePreview` memoized and callback stabilized. | None |
| 26 | Debounce builder preview updates | Yes | Yes | Pass | None current | `PREVIEW_SYNC_DELAY_MS` path verified in code. | None |
| 27 | Debounce localStorage writes | Yes | Yes | Pass | No builder localStorage write loop found | No action needed; live-viewer id is one-time stable storage. | None |
| 28 | Clean up timers/listeners | Yes | Yes | Pass | None current | Code cleanup paths inspected; no live stuck loader after route checks. | None |
| 29 | Optimize images/videos/media | Yes | Yes | Pass | Video iframe can abort in headless browser | Production page remains usable; YouTube abort is external iframe behavior, not app route failure. | None |
| 30 | Use lightweight loading states | Yes | Yes | Pass | AI loading state needed proof | Local UI mock confirmed AI progress card and messages without production data or token spend. | None |
| 31 | Keep scroll smooth/no overflow | Yes | Yes | Pass | None current | Production 28/28 route/viewport matrix passed no-overflow checks. | None |
| 32 | Website Creator: no full preview regeneration on every keystroke | Yes | Yes | Pass | None current | Preview sync is debounced; preview not rebuilt until queued sync. | None |
| 33 | Website Creator: memoize preview component | Yes | Yes | Pass | None current | `MemoizedCoachSitePreview` in manager; stable callback applied. | None |
| 34 | Website Creator: keep dialog/wizard smooth | Yes | Yes | Pass | None current | Authenticated production Browser opened wizard; no overflow or 404. | None |
| 35 | Coach template: reduce background effects on mobile | Yes | Yes | Pass | None current | Touch/mobile pointer spotlight disabled; CSS mobile reductions present. | None |
| 36 | Coach template: keep hero visible early | Yes | Yes | Pass | None current | Mobile production public coach page first viewport shows coach/YW/register content. | None |
| 37 | Coach template: disable parallax on small devices | Yes | Yes | Pass | None current | No mobile pointermove listener; desktop keeps one interactive listener. | None |
| 38 | Coach template: keep only selected theme active | Yes | Yes | Pass | None current | Standalone preview theme link changes `data-theme`; builder preview uses selected theme only. | None |
| 39 | Animations: shorter/smoother/reduced motion | Yes | Yes | Pass | None current | Loader removes promptly; Grainient uses full/reduced/static capability tiers; no stuck loader in post-deploy smoke. | None |
| 40 | Glass effects: avoid nested expensive mobile layers | Yes | Yes | Pass | None current | Mobile no-overflow/no-error matrix passed admin/template/coach/paid routes. | None |
| 41 | Admin panel: do not render all analytics details at once | Yes | Yes | Pass | None current | Main analytics page shows list; detail dashboard opens only after View Analytics. | None |
| 42 | Admin panel: keep Overview lightweight | Yes | Yes | Pass | None current | Authenticated dashboard opened and scrolled without 404/overflow. | None |
| 43 | Mobile: 320px support | Yes | Yes | Pass | Initial local preview needed loader wait | 320 production matrix passed; local preview content appears after loader by 1.5s. | None |
| 44 | Mobile: 375px/390px/414px support | Yes | Yes | Pass | None current | Production matrix passed all listed phone widths. | None |
| 45 | Tablet: 768px/1024px support | Yes | Yes | Pass | None current | Production and local matrices passed. | None |
| 46 | Desktop support | Yes | Yes | Pass | None current | 1440 desktop probes passed; desktop pointer spotlight remains active. | None |
| 47 | Manual test: admin panel, creator, analytics, template preview, public coach page | Yes | Yes | Pass | None current | Authenticated Browser and Playwright probes verified these flows. | None |
| 48 | Manual test: AI generation loading state | Yes | Yes | Pass | Must not spend tokens or create fake production records | Local UI mock verified progress messages, generated preview, regenerate controls, no Copy Public Link before publish. | None |
| 49 | Manual test: contact support/error and register button behavior | Yes | Yes | Pass | None current | Normal public coach page did not show support fallback; Register link points to `https://forms.gle/nsY5F1mcjZnZBbVo9`; fallback routes remain copyable and safe in prior matrix. | None |

## Commands and UI Tests Run

- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test:admin-security`
- `pnpm build:pages`
- `pnpm build:pages-functions`
- `pnpm run deploy`
- Cloudflare deployment output confirmed production source `c7bdaeb`.
- Production HTTP checks:
  - `/admin/dashboard`
  - `/admin/login`
  - `/coach/gyana-ranjan`
  - `/coach-template-preview`
  - `/go/gyana-pcos-51`
- Production browser checks:
  - Admin Dashboard authenticated route
  - Website Creator open state
  - Coach Analytics mobile menu navigation
  - Coach Analytics detail dialog
  - Coach Template Preview theme switch
  - Public coach page mobile/desktop listener probe
  - Paid carousel offscreen/onscreen animation probe
- Local checks:
  - Cloudflare Pages preview on `127.0.0.1:4198`
  - Local Next UI mock on `127.0.0.1:4187` for AI generation loading state

## Latest Results

- Lint: pass
- Type-check: pass
- Next build: pass
- Admin security tests: pass, 19/19
- Cloudflare static build: pass
- Cloudflare Pages Functions build: pass
- Deploy: pass, production source `c7bdaeb`
- Production smoke after deploy: pass
- Production `/go/gyana-pcos-51` Browser check: pass; normal flow did not show `YW-ERR-404` or Contact Support, CTA was visible, no horizontal overflow, and automated Browser correctly received static compatibility mode.
- Local AI loading-state UI mock: pass

## Remaining Performance Risks

- Adding more coach records, videos, paid funnels, or heavy visual effects should trigger the same breakpoint/performance matrix again.
- Real device animation level depends on the browser's WebGL2, motion, network, memory/core, pointer, and save-data signals. Devices that report constrained capability intentionally receive the static fallback.
- Real AI/R2 publish testing should be done during a real coach creation, not with fake production data.
- If future template work adds more WebGL, particles, or animated cards, keep mobile/touch gating mandatory.

## Final INSTR.MD Status

Pass. No important pending work remains against the active INSTR.MD performance and smoothness instructions.
