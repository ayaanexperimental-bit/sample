# Template Skins Visual Difference Audit

Scoring rule:
- 0 = identical to default
- 1 = minor color/font change
- 2 = visibly different
- 3 = meaningfully different visual experience

Minimum for non-default skins:
- at least 8 changed categories
- hero, background, card, bonus, FAQ, media, and sticky CTA score at least 2

| Skin | Score | Hero | Background | Cards | Bonus | FAQ | CTA/Sticky | Result |
| --- | ---: | --- | --- | --- | --- | --- | --- | --- |
| Editorial Wellness Journey | 34/36 | editorial title and portrait | paper/noise | line cards | magazine inserts | line accordion | refined invitation | Pass |
| Liquid Glass Health-Tech | 36/36 | layered glass shell | aurora mesh | frosted glass | digital glass tiles | glass panels | luminous glass | Pass |
| Dark Luxury Wellness | 36/36 | cinematic spotlight | light rays | dark glow cards | dark product tiles | dark panels | premium glow strip | Pass |
| Soft Feminine Wellness | 36/36 | organic warm hero | soft mesh | rounded warm cards | soft product cards | soft panels | warm rounded bar | Pass |
| Minimal Premium Clarity | 36/36 | typography-first | static texture | divider cards | clean list/cards | text accordion | minimal bar | Pass |
| Prism Aurora Immersive | 36/36 | immersive light field | prism | luminous tiles | glow product cards | glow accordion | luminous bar | Pass |
| Performance Energy | 36/36 | dynamic action hero | grid glow | action cards | toolkit cards | bold panels | action bar | Pass |
| Creator Brand Profile | 36/36 | coach profile first | profile spotlight | story/profile cards | resource cards | profile FAQ | signature CTA | Pass |

Anti-clone evidence is encoded in `lib/coach-template-themes.ts` under each skin's `visualDifference.evidence`.
