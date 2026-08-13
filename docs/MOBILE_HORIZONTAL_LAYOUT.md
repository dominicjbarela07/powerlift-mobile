# Mobile Horizontal Layout

Strength Ledger mobile screens use an edge-to-edge page canvas.

## Permanent invariant

- Screen, page, safe-area, navigator-scene, and scroll-content roots must not apply universal horizontal padding or margin.
- Top and bottom safe-area handling remains required. Horizontal safe-area handling may respond to a real device inset, but must not be replaced by a generic page gutter.
- Horizontal spacing belongs to the child surface that needs it: a header, form, card, row, filter rail, warning, CTA, or modal.
- Calendars, scheduling boards, review queues, rails, lists, Session Logger surfaces, and editor workspaces must be able to use the full viewport width.
- An exception must identify the platform constraint and be documented beside the implementation. A generic `paddingHorizontal: 16` is not an exception.

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

The structural audit protects the shared screen primitives, navigator scene, Review Hub, Coach Calendar, Athlete Calendar, and other canonical operational roots. It also scans generic app route-root style names for new horizontal page insets.
