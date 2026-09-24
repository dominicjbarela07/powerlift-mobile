# Logger artwork as a full-width background

Owner request: “i want the image window wider than that! it should feel like its baked into the background of that space! legible but behind everything. dont be afraid”

The canonical Logger and its crop reviewer use the same larger artwork layer. Focal artwork spans the width behind the prescription instead of sitting in a right-side window. Full-composition artwork uses the complete available canvas while retaining its source aspect ratio. The background extends through the actual Session's 20 px side gutters and begins behind the movement heading. Its measured lower endpoint still ends at the manufacturer/history boundary.

Three weaknesses identified in the first inspection and corrected:

1. The right-aligned photograph left a separate blank prescription column. Larger, centered geometry and a translucent horizontal fade now reveal artwork behind the numbers.
2. Interior image edges made the photograph feel inset. The stage now extends through the content gutters, and every source raster has feathered edges, including focal and landscape images.
3. The title and lower detail row felt detached from the artwork. The layer begins above the heading, fades through the title area, and retains its measured lower boundary so history records stay clear.

The reviewer was aligned with the real Session's 20 px foreground inset. The 375/390/430 phone-width selector remains an actual viewport selector. Crop zoom/position controls remain additional transforms over this shared composition. Source artwork, candidate versions, movement IDs, reviews and runtime mappings were not edited in this change.

Validation: TypeScript passes; crop geometry/receipt checks pass; positive artwork gate and geometry checks pass; actual TSX consumption passes for all 380 approved image chains in DEV and simulated TestFlight configuration; Logger artwork subject and resume checks pass. The consumer test harness now expands the extracted shared layout/image components, allowing those existing checks to inspect the real rendered tree.

Visual verification used the shared React Native components from the canonical npm-start runtime (port 8081), embedded in the isolated QA reviewer on port 5019. Inspected squat and dumbbell focal compositions, machine full composition with/without selected equipment, bodyweight full composition, and 375/390/430 px previews. No real review decisions were made. Before, intermediate, and refined screenshots accompany this report.

Native iOS screenshot verification was attempted and remains blocked by the host's Xcode license agreement. No legal agreement was accepted. Browser screenshots are browser evidence, not native iOS certification.
