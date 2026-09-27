# Programming Manager date, rename, and Accessory review

Captured from the canonical DEV Metro runtime on the booted iPhone 17 simulator through a temporary preview route that mounted the actual production components. The preview route was removed before the release candidate was prepared.

- `date-five-row.png`: second visual pass after reducing empty sheet space. September 2026 selected day, month navigation, complete weekday grid, and safe-area footer are visible.
- `date-six-row.png`: August 2026 six-row month remains visible without clipping.
- `rename-selected.png`: `New Session` is focused and fully selected when the sheet opens. The modal backdrop remains OLED black. The simulator's hardware-keyboard setting meant this capture did not display the software keyboard.
- `accessory-prescription.png`: Accessory Sets, Reps, and RIR remain visible; no Manual Override or Override Target section appears.

Visual weaknesses found in the first date capture: excessive space below a five-row month, fixed height regardless of month, and poor short-screen fit. The final sheet sizes from the number of calendar rows and places the calendar in a scrollable body outside drag-dismiss chrome. Month navigation and day selection are also covered by the focused source and save-plan checks. Simulator tap automation did not start, so live tap behavior and actual authenticated persistence remain for physical TestFlight review.

Adjacent behavior checked: Core Manual Target controls, active Session prescription and composition, accessory identity and substitutions, grouped Sets, draft recovery, date metadata serialization, shared sheet dismissal, and TypeScript. The mobile acceptance suite passed 240/240 checks after the shared active-Session prescription contract was kept intact.
