# Mobile Horizontal Layout

Strength Ledger mobile screens use an edge-to-edge page canvas.

## Permanent invariant

- Screen, page, safe-area, navigator-scene, and scroll-content roots must not apply universal horizontal padding or margin.
- Top and bottom safe-area handling remains required. Horizontal safe-area handling may respond to a real device inset, but must not be replaced by a generic page gutter.
- Horizontal spacing belongs to the child surface that needs it: a header, form, card, row, filter rail, warning, CTA, or modal.
- Calendars, scheduling boards, review queues, rails, lists, Session Logger surfaces, and editor workspaces must be able to use the full viewport width.
- An exception must identify the platform constraint and be documented beside the implementation. A generic `paddingHorizontal: 16` is not an exception.
- Page-level `maxWidth`, percentage-width wrappers below `100%`, and centered content columns are the same violation as a gutter.
- Bottom-sheet surfaces must explicitly occupy `100%` of the viewport width. Padding inside the sheet body, cards, fields, and controls remains component-owned spacing.

The intended hierarchy is:

```text
screen canvas: full viewport width
  local header: intentional inset
  full-bleed operational surface
  local card: intentional margin and internal padding
```

Do not replace page padding with page-level `marginHorizontal`, or merely reduce the gutter.

## Shared primitives

`SLScreen`, `SLScrollScreen`, and the tab navigator scene provide a full-width canvas. Their spacing options may add vertical clearance only. New routes must not need an allowlist to opt into full width.

## Regression protection

Run:

```sh
npm run audit:mobile-horizontal-layout
```

The structural audit protects the shared screen primitives, navigator scene, active route roots, Athlete and Coach Homes, Athlete Workspace, Team Brief and analytics, Training Hub, Programming Manager, Calendar, Session Workspace, Logger, Reviewer, Check-Ins, Meet Packet, Ledger, and canonical bottom sheets. It checks every duplicate `StyleSheet` root declaration rather than allowing a later declaration to hide an earlier violation. It also scans generic app route-root style names for horizontal insets, width caps, reduced percentage widths, and centered root wrappers.

## Exception policy

There are no approved page-level horizontal-layout exceptions.

A platform-owned horizontal safe-area inset may be honored only when it is supplied by the operating system for a specific device boundary. It must not be converted into a fixed product gutter.

If a future platform limitation appears to require an exception, implementation stops until the product owner explicitly approves it. The approved change must:

1. Name the exact file and root style.
2. Document the platform constraint beside the implementation.
3. State the affected devices and why a full-width alternative is not viable.
4. Add a focused regression contract proving the exception cannot spread to other screens.

Refactors, visual polish, readability preferences, tablet/web width conventions, and legacy behavior are not exception authority.
