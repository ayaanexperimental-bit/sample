# Production Transfer Checklist

Date: 2026-05-27  
Goal: safely move the current local edits to production without redesigning or improvising.

## Non-Negotiable Rule

The current local implementation is the source of truth. Transfer it exactly. Do not rebuild from scratch. Do not make unrelated fixes during transfer.

## Before Transfer

Run:

```powershell
git status --short
git diff --stat
git branch --show-current
```

Expected intentional changed production files:

```text
app/globals.css
components/landing/ambient-background.tsx
components/landing/glass-card-interactions.tsx
components/landing/levelup-clone.tsx
```

Expected non-production artifact folder:

```text
.codex-artifacts/
```

Do not stage `.codex-artifacts/`.

## Safety Backup

Create a backup before production transfer:

```powershell
git branch codex/backup-before-local-grainient-production
```

If a backup branch already exists, use a timestamped name:

```powershell
git branch codex/backup-before-local-grainient-production-20260527
```

## Validation Commands

Run all checks before commit or deploy:

```powershell
$env:Path = 'C:\Users\Yours Wellness\AppData\Local\OpenAI\Codex\bin;' + $env:Path
& 'C:\Users\Yours Wellness\AppData\Local\OpenAI\Codex\bin\node.exe' .\node_modules\eslint\bin\eslint.js .
& 'C:\Users\Yours Wellness\AppData\Local\OpenAI\Codex\bin\node.exe' .\node_modules\typescript\bin\tsc --noEmit
& 'C:\Users\Yours Wellness\AppData\Local\OpenAI\Codex\bin\node.exe' .\scripts\build-static.mjs
```

Do not deploy if any command fails.

## Required Local Browser QA

Test `http://127.0.0.1:3001/` before production:

- Mobile width around `390x844`
- Desktop width around `1365x768`
- Page loads without blank background
- React Bits Grainient canvas exists
- Old `.levelup-local-grainient` does not exist
- Background motion is visible but not distracting
- No major horizontal overflow
- Every `REGISTER NOW` CTA scrolls to `#registration`
- Checkout form remains usable
- Liquid glass effect appears on visible CTAs and checkout button
- Sticky CTA still works
- FAQ still opens
- Video remains visible
- Mobile and desktop both retain the same feature set

Useful browser DOM assertions:

```js
{
  oldLocalGradientCount: document.querySelectorAll(".levelup-local-grainient").length,
  grainientCanvasCount: document.querySelectorAll(".ambient-background--grainient canvas").length,
  ctasWithLiquid: document.querySelectorAll(".levelup-cta[data-ripple='liquid']").length,
  checkoutTargets: Array.from(document.querySelectorAll(".levelup-cta")).filter((el) => el.getAttribute("href") === "#registration").length
}
```

Expected values:

```js
{
  oldLocalGradientCount: 0,
  grainientCanvasCount: 1,
  ctasWithLiquid: 8,
  checkoutTargets: 8
}
```

## Staging

Stage only the intended files:

```powershell
git add app/globals.css
git add components/landing/ambient-background.tsx
git add components/landing/glass-card-interactions.tsx
git add components/landing/levelup-clone.tsx
git add handoff/CURRENT_LOCAL_EDITS.md
git add handoff/PRODUCTION_TRANSFER_CHECKLIST.md
```

Do not stage:

```text
.codex-artifacts/
```

## Commit

Use a clear commit message:

```powershell
git commit -m "Apply local Grainient and liquid CTA updates"
```

## Deploy

Production appears to use Cloudflare Pages/Wrangler.

Use the normal production path only after checks pass:

```powershell
pnpm deploy
```

Do not deploy with partial changes. Do not deploy from a dirty tree unless the only unstaged files are explicitly ignored artifacts.

## Production QA After Deploy

Test `https://freedomfromdiabetes.in/` in:

- Chrome desktop
- Mobile viewport
- At least one real phone if available

Confirm:

- Page is not blank
- Background is visible and moving
- Copy and layout match local
- CTAs go to checkout
- Checkout button is visible and usable
- No white transparent strip appears on buttons
- No debug/test UI appears
- Forms are not broken

## Rollback

If production has visual glitches or checkout issues, rollback immediately:

```powershell
git revert <commit-hash>
pnpm deploy
```

If Cloudflare Pages has deployment rollback available, use the last known good deployment first, then revert the repository commit.

