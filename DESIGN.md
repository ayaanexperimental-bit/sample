---
name: YW Coach Admin Operate
description: Evidence-first, permission-aware operations for the YW Coach platform.
colors:
  action-lime: "#B8FF4D"
  action-lime-soft: "#6CFF8D"
  signal-cyan: "#33F5C5"
  dark-canvas: "#06110F"
  dark-surface: "#0A1714"
  dark-panel: "#0D211A"
  text-on-dark: "#F4FFF0"
  muted-on-dark: "#8EA19A"
  light-canvas: "#F1F6EF"
  light-surface: "#FBFDF9"
  text-on-light: "#07160C"
  muted-on-light: "#506555"
  danger: "#FF5A5F"
  warning: "#F7C948"
typography:
  display:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.5
  label:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: "0"
  mono:
    fontFamily: "SF Mono, ui-monospace, Menlo, monospace"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.3
rounded:
  control-sm: "6px"
  control: "8px"
  surface: "12px"
  pill: "999px"
spacing:
  step-1: "4px"
  step-2: "8px"
  step-3: "12px"
  step-4: "16px"
  step-5: "20px"
  step-6: "24px"
  step-8: "32px"
components:
  button-primary:
    backgroundColor: "{colors.action-lime}"
    textColor: "{colors.dark-canvas}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.dark-panel}"
    textColor: "{colors.text-on-dark}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
    height: "44px"
  input:
    backgroundColor: "{colors.dark-canvas}"
    textColor: "{colors.text-on-dark}"
    typography: "{typography.body}"
    rounded: "{rounded.control-sm}"
    padding: "0 12px"
    height: "44px"
  status-chip:
    backgroundColor: "{colors.dark-panel}"
    textColor: "{colors.text-on-dark}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "5px 10px"
    height: "30px"
  surface-card:
    backgroundColor: "{colors.dark-panel}"
    textColor: "{colors.text-on-dark}"
    rounded: "{rounded.surface}"
    padding: "16px"
  disclosure-summary:
    backgroundColor: "{colors.dark-panel}"
    textColor: "{colors.text-on-dark}"
    typography: "{typography.label}"
    rounded: "{rounded.surface}"
    padding: "12px 14px"
    height: "52px"
  admin-ai-trigger:
    backgroundColor: "{colors.dark-panel}"
    textColor: "{colors.text-on-dark}"
    typography: "{typography.label}"
    rounded: "{rounded.surface}"
    padding: "5px 7px"
    height: "44px"
---

# Design System: YW Coach Admin Operate

## Overview

**Creative North Star: "The Verified Control Room"**

YW Coach Admin feels like a calm operations room in active use: dense enough for real work, quiet enough to scan under pressure, and explicit about which signals are current, missing, blocked, or actionable. The dark theme uses deep green-black tonal layers with a rare high-energy lime action voice; the light theme is a true structural counterpart with pale green canvases, near-white working surfaces, and deep green ink.

The system rejects generic AI-tool theater, marketing-dashboard composition, fake production data, and any visual wrapper that hides legacy Admin UI. Repeated operational detail is progressively disclosed. AI remains a contextual instrument inside the product rather than the product's visual protagonist.

**Key Characteristics:**

- Evidence-first hierarchy with the next decision visible.
- Restrained semantic color and flat-by-default surfaces.
- Compact, familiar controls with complete interaction states.
- Permission-aware navigation and honest empty, blocked, and failure states.
- Responsive structural changes without ornamental choreography.

## Colors

The palette pairs near-black green operational layers with one vivid lime action voice, a cyan information signal, and restrained semantic warning and danger colors. Light mode keeps the same role hierarchy rather than applying a pale skin over dark-mode structure.

### Primary

- **Verified Lime** (`#B8FF4D`): Primary actions, active navigation, current selection, verified status signals, and focused high-value controls.
- **Operational Green** (`#6CFF8D`): Supporting positive state and secondary live-data emphasis where the primary lime would be too dominant.

### Secondary

- **Signal Cyan** (`#33F5C5`): Information, contextual focus, cross-module links, and non-destructive AI/system feedback.

### Neutral

- **Night Operations Canvas** (`#06110F`): Dark-mode application background.
- **Night Operations Surface** (`#0A1714`): Secondary dark layer for toolbars and nested working regions.
- **Night Operations Panel** (`#0D211A`): Primary dark cards, controls, drawers, and bounded content.
- **Verified Light Ink** (`#F4FFF0`): Primary text on dark surfaces.
- **Muted Dark Evidence** (`#8EA19A`): Secondary text and supporting metadata on dark surfaces.
- **Day Operations Canvas** (`#F1F6EF`): Quiet light-mode application background with only a restrained green tint.
- **Day Operations Surface** (`#FBFDF9`): Near-white working surfaces that preserve the dark theme's hierarchy without a green wash.
- **Deep Green Ink** (`#07160C`): Primary text on light surfaces.
- **Muted Light Evidence** (`#506555`): Secondary text and supporting metadata on light surfaces.

### Tertiary

- **Controlled Danger** (`#FF5A5F`): Destructive, failed, or unsafe states only.
- **Attention Amber** (`#F7C948`): Warnings, approval attention, and incomplete operational states.

### Named Rules

**The One Action Voice Rule.** Verified Lime is rare: use it for the current choice, the primary action, or a verified live signal—not for decoration.

**The Theme Parity Rule.** Light mode must express the same hierarchy with its own canvas, surface, border, text, map, and state treatments; it must never look like a translucent skin over dark mode.

**The Semantic Restraint Rule.** Danger, warning, success, and information colors communicate state. Never use them as interchangeable decoration.

## Typography

- **Display Font:** Manrope (with UI-system fallbacks)
- **Body Font:** Manrope (with UI-system fallbacks)
- **Label/Mono Font:** SF Mono (with ui-monospace and Menlo fallbacks)

**Character:** A single practical sans family carries the operational hierarchy. Monospace is reserved for identifiers, exact values, timestamps, and evidence fragments; it is never a decorative “technical” voice.

The existing auth shell may resolve through IBM Plex Sans, Aptos, or Segoe UI fallbacks, but new Admin surfaces should preserve the single-sans Operate hierarchy rather than introduce a display/body pairing.

### Hierarchy

- **Display** (700, `2rem`, `1.15`): Auth and major one-task headings; maximum width `20ch`.
- **Headline** (700, `1.75rem`, `1.15`): Admin page titles; reduce to `1.35rem` on compact mobile.
- **Title** (700, `1rem`, `1.3`): Card, dialog, and section titles.
- **Body** (500, `0.875rem`, `1.5`): Operational explanation, states, and supporting content; prose should not exceed `65–70ch`.
- **Label** (650, `0.8125rem`, `1.4`): Controls, metadata, disclosure summaries, and status labels; sentence case by default.
- **Mono** (700, `0.75rem`, `1.3`): Exact IDs, metric values, timestamps, routes, and audit references.

### Named Rules

**The Sentence-Case Rule.** Labels explain tasks; do not turn every section into tracked uppercase scaffolding.

**The Data-Is-Exact Rule.** Use monospace only when the content benefits from character-level comparison or exact reference.

**The Compact Scale Rule.** Product hierarchy stays within a tight fixed scale; fluid marketing typography is prohibited inside Admin.

## Elevation

The system is flat by default. Current cards, shared Admin surfaces, auth panels, the Copilot trigger, and the Copilot drawer use tonal separation plus one-pixel borders—not decorative drop shadows. True modal and drawer overlays may use structural lift (`0 26px 70px rgba(0, 0, 0, 0.42)`) to establish blocking depth; focus uses a three-pixel semantic outline rather than simulated elevation.

### Shadow Vocabulary

- **Structural Overlay** (`0 26px 70px rgba(0, 0, 0, 0.42)`): True modal or blocking drawer separation only.
- **Light Structural Overlay** (`0 24px 64px rgba(36, 68, 36, 0.18)`): Light-theme equivalent for true overlays.
- **Flat Surface** (`none`): Default for cards, panels, controls, auth containers, the Admin AI trigger, and the Admin AI drawer.

### Named Rules

**The Flat-by-Default Rule.** If a surface is part of the normal page flow, it does not need a shadow.

**The One Depth Signal Rule.** Use either a boundary or structural shadow for separation; never combine a wide decorative shadow with a routine one-pixel card border.

**The Blocking-Only Lift Rule.** Elevated depth belongs to UI that genuinely blocks or floats above the current task.

## Components

Controls are familiar, compact, and explicit. Every interactive component needs default, hover, focus, active, disabled, loading, error, and—where relevant—selected states.

### Buttons

- **Shape:** Compact corners (`6–8px`); full pills only for filters, compact state selectors, or identity chips.
- **Primary:** Verified Lime with Night Operations Canvas text, minimum `44px` touch height, and `10px 14px` padding.
- **Hover / Focus:** Small tonal change without translation; visible three-pixel cyan/information outline with `2px` offset.
- **Secondary / Ghost:** Tonal panel background, one-pixel semantic boundary, and high-contrast text; never a decorative ghost-card shadow.
- **Danger:** Controlled Danger is reserved for the final bounded destructive decision and must not visually outrank the required confirmation context.

### Chips

- **Style:** Compact status or filter controls use `999px` radius, `30px` target height on desktop, a one-pixel state boundary, and sentence-case text.
- **State:** Selected chips use the action color and dark ink; inactive chips stay tonal. Status must include text or an accessible name, not color alone.

### Cards / Containers

- **Corner Style:** Calm rounded surfaces (`12px`).
- **Background:** Dark panels or light surfaces with no decorative gradient.
- **Shadow Strategy:** Flat by default; see Elevation.
- **Border:** One-pixel semantic or neutral boundary.
- **Internal Padding:** `12–16px` for compact surfaces; `20–24px` only for major bounded work areas.

### Inputs / Fields

- **Style:** Minimum `44px` target, `6–8px` corners, dark-canvas or light-surface fill, and a one-pixel neutral boundary.
- **Focus:** Border shifts to the contextual signal color and receives a visible three-pixel outline.
- **Error / Disabled:** Error copy is explicit and announced; disabled controls remain readable and explain unavailable capability where needed.

### Navigation

- The desktop rail uses familiar icon-plus-label behavior with a clear current-page state and permission-filtered destinations.
- Mobile navigation changes structure: explicit open/close controls, an inert closed drawer, and five high-frequency bottom actions with minimum `44px` targets.
- Search is a module/command navigator and must describe that scope honestly; keyboard selection and active-descendant behavior are required.

### Progressive Disclosure

- Summary rows are at least `44px`, keyboard-focusable, sentence-cased, and visually quiet.
- Commands, context evidence, feedback, observability, technical safeguards, and duplicate module shortcuts remain available on demand.
- Disclosure must reduce cognitive load without hiding the next action or removing capability.

### Admin AI Trigger and Drawer

- The trigger is a restrained `12px` surface, not a glowing mascot stage. Desktop may show concise label/status; mobile uses a non-obstructive `44px` target.
- The drawer uses the same Admin token system, `12px` surfaces, fast `180ms` state motion, a labelled dialog boundary, focus management, and resilient loading/offline/error states.
- Decision summaries lead; technical contracts, safeguards, evidence, feedback, and observability follow through disclosure.

### Dialogs and Confirmations

- Use dialogs for bounded blocking decisions, not routine content.
- Show what will change, scope, risk, required approval or OTP, rollback expectation, and source evidence before the primary action.
- Close, Escape, scrim, and focus restoration must work consistently; a destructive result requires a deterministic receipt.

## Do's and Don'ts

### Do:

- **Do** keep the next operator decision visible and place supporting evidence immediately nearby.
- **Do** use Verified Lime (`#B8FF4D`) for one primary action, active choice, or verified signal at a time.
- **Do** preserve complete loading, empty, blocked, stale, partial, unavailable, success, and failure states.
- **Do** progressively disclose commands, context, technical safeguards, feedback, observability, and duplicate module navigation.
- **Do** keep every module, record, action, and explanation aligned with current RBAC.
- **Do** use one-pixel boundaries, `12px` surfaces, `44px` touch targets, visible focus, and reduced-motion alternatives.
- **Do** keep model recommendations subordinate to deterministic authorization, execution, receipts, and audit history.

### Don't:

- **Don't** present a generic AI chatbot or autonomous-agent spectacle that competes with the operator's task.
- **Don't** build a marketing-style SaaS dashboard from hero metrics, decorative gradients, glass panels, or repeated promotional cards.
- **Don't** present mock, prototype, placeholder, or fabricated production data as real.
- **Don't** mount legacy Admin wrappers, hidden old UI, stale labels, dead controls, or a visual skin that conceals an older interface.
- **Don't** expand every command, context block, recommendation, safeguard, and technical detail at once.
- **Don't** use model output as permission, payment, validation, calculation, OTP, route-protection, or destructive-action authority.
- **Don't** add gradient text, decorative grid overlays, ambient glows, side-stripe accents over `1px`, or wide ghost-card shadows to new routine Admin surfaces.
- **Don't** exceed `16px` card radii; full pills are reserved for chips and compact controls.
- **Don't** communicate warning, danger, success, selection, or availability through color alone.
