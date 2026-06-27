# Template Skins Inspect Editability Report

Inspect architecture:
- One shared Inspect system remains in `PublicCoachSitePage`.
- Skins do not implement their own inspect logic.
- `data-inspect-target`, `data-selected`, and preview selection handlers remain canonical.
- Admin slot editor continues to map canonical slot keys to editable form fields.
- Shop inspect flow continues to map visible sections to content patches.

Implemented compatibility control:
- Root wrapper now carries `data-yw-inspect-mode`.
- Skin motion/floating effects are disabled when inspect mode is active.
- Background layers remain pointer-events none and below content.
- Background data attributes are decorative and do not affect edit permissions.

Readiness matrix:
| Skin | Admin Inspect | Shop Inspect | Desktop/Tablet/Mobile | Background Click Safety | Locked Fields |
| --- | --- | --- | --- | --- | --- |
| Default Canonical | Pass | Pass | Pass by existing flow | Pass | Preserved |
| Editorial Wellness | Pass | Pass | Pass by shared renderer | Pass | Preserved |
| Liquid Glass | Pass | Pass | Pass by shared renderer | Pass | Preserved |
| Dark Luxury | Pass | Pass | Pass by shared renderer | Pass | Preserved |
| Soft Feminine | Pass | Pass | Pass by shared renderer | Pass | Preserved |
| Minimal Premium | Pass | Pass | Pass by shared renderer | Pass | Preserved |
| Prism Aurora | Pass | Pass | Pass by shared renderer | Pass | Preserved |
| Performance Energy | Pass | Pass | Pass by shared renderer | Pass | Preserved |
| Creator Brand | Pass | Pass | Pass by shared renderer | Pass | Preserved |

Remaining risk:
- Full manual click-through for every individual slot on every viewport is still a final QA task.
