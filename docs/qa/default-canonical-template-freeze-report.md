# Default Canonical Template Freeze Report

Default template path:
- React preview/public renderer: `components/coach/public-coach-site-page.tsx`
- Static Cloudflare public route renderer: `functions/coach/[slug].ts`
- Shared copy/rules: `lib/coach-canonical-template.ts`
- Shared skin registry: `lib/coach-template-themes.ts`
- Public CSS: `public/coach-circle-template.css`

Canonical sections found:
- sticky dynamic navbar
- hero/signature program
- coach media/story
- audience/problem awareness
- coach support promise
- benefits/results
- journey/how it works
- universal bonus services
- fit check
- FAQ
- final CTA
- Contact Support/legal footer

Frozen functional contracts:
- CTA/Register uses current coach Google Form link only.
- Sticky Register CTA behavior remains shared.
- Navbar links come from canonical section registry.
- FAQ behavior remains one shared accordion system.
- Bonus service names remain fixed: Life-Long Health Calculators, Lifetime Support Sessions, Lifestyle Success Toolkit.
- Contact Support and legal return links remain shared.
- Inspect mode keeps canonical section/slot mapping.
- Admin preview, Shop preview, and public route use the same canonical renderer contract.

Changes made:
- Default canonical skin remains the fallback and first registry entry.
- New skin metadata does not change canonical business logic.
- Unknown and legacy IDs normalize to canonical or matching safe skin.

Remaining risk:
- Browser screenshot matrix still needs final visual capture after deploy.
