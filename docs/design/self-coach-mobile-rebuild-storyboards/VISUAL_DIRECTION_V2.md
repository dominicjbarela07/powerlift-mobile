# Self-Coach storyboard visual direction v2

The owner's correction requires a full aesthetic rethink alongside the workflow proposal. Preserve the base dark theme, purple brand accent and canonical floating glass navigation row. Rethink composition, typography, controls, imagery, density and data presentation. The finished revised storyboards belong directly in the chat and beside the proposal in canonical DEV.

The first boards overused brushed-metal texture, repeated framed panels, conventional button stacks and a fixed bottom navigation treatment. This revision addresses those choices through a shared visual system and task-specific screen compositions.

## Inspected references

These observations concern official published imagery and design descriptions inspected on November 10, 2026. They do not establish hands-on use of the installed competitor apps.

| Reference | Actual material inspected | Adaptation for Strength Ledger |
| --- | --- | --- |
| [Linear mobile redesign](https://linear.app/changelog/2025-10-16-mobile-app-redesign) | Official announcement and photograph of its mobile bottom toolbar. The announcement explicitly describes custom frosted glass | Preserve the existing glass dock as recognizable navigation. Let its material supply depth while the working area stays readable |
| [Linear interface refresh](https://linear.app/now/behind-the-latest-design-refresh) | Official discussion of visual hierarchy, consistent headers and quieter supporting navigation | Use consistent orientation and keep supporting controls visually subordinate to the current task |
| [Flighty Passport](https://flighty.com/passport) | Published personal-history panels, route imagery, large totals, tightly aligned secondary facts and aviation-specific visual details | Give the Ledger the character of a personal training record. Use dates, meaningful lifting imagery, clearly ranked numbers and original evidence |
| [Darkroom](https://darkroom.co/) | Official device compositions and photo/video editing surfaces, with media occupying most of the workspace and controls grouped around it | Give original training film generous space and arrange compact playback controls around the content |
| [Copilot Money](https://www.copilot.money/) | Published phone dashboard, chart summary, compact explanatory status and grouped detail | Put a legible visual summary beside the facts that explain it. Apply selective surfaces and rank supporting data clearly |
| [Ladder](https://www.joinladder.com/) | Official daily-workout phone screen with weekly state, purposeful athlete imagery and distinct workout title hierarchy | Give a scheduled workout recognizable visual identity and a clear starting action. Keep image use proportionate to the task |

## Proposed aesthetic

Use deep charcoal with a subtle plum undertone and the established purple accent. Typography, source imagery and selective surface elevation create hierarchy. Screens use compact functional copy, unboxed aligned facts, clear set tables, date gutters and measured separators. One principal content surface can hold the main analytical or editing task.

Glass belongs to the floating navigation and appropriate compact chrome. Primary actions use a restrained purple treatment with readable type. Repeated decorative frames, shiny button gradients and conspicuous texture are removed from the revised compositions. Purple indicates selection and action. Green confirms saved work, amber identifies uncertain saves and cyan belongs to the rest timer.

The visual target changes by task. Train has a clear opening action and purposeful strength imagery. Logging prioritizes set values and save state. Plan uses a date-led agenda and concise reusable training. The Ledger combines dominant evidence, meaningful charts, archive context and source access. The film view allocates most of its usable area to the athlete.

## Floating navigation requirement

Inspected the actual canonical `SLFloatingNavigationDock` in `components/navigation/sl-tab-row-control.tsx` and the existing DEV capture `docs/validation/operation-visual-cleanup-convergence-2026-10-30/history-density-final.png`. The canonical component uses a floating capsule, translucent/native glass material, a fine highlighted edge and a circular selected lens. The current source specifies a 48-point shell and 38-point selected lens, with reduced-transparency and non-native fallbacks.

Retain this recognizable capsule and its floating placement in every revised screen where global navigation is visible. The concept may depict the proposal's Train, Plan and Progress destinations with compact labels. Final destination count and label geometry remain proposal decisions. Implementation must use the canonical dock component and preserve its keyboard, safe-area, accessibility and supported-platform behavior.

## Acceptance for the revised boards

Generate a new versioned set for first workout, planning, the Ledger and return/recovery. Inspect all final screens for a visibly floating glass dock, dark/purple identity, deliberate content hierarchy, readable values, meaningful image subjects and freedom from repeated generic panel stacks. Verify example arithmetic and calendar alignment. Preserve the original boards and retain the exact revised prompts. Concept images use illustrative data and proposed interactions.

The required delivery is revised design imagery and an updated proposal. Application runtime behavior and release validation have a separate implementation scope.
