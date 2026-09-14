# Canonical mobile keyboard layout

An editable field and its essential actions must fit inside the keyboard-adjusted native presentation. This system uses existing React Native APIs; it adds no native dependency or runtime requirement.

## Ownership

- `components/keyboard/keyboard-state.ts` owns keyboard frame/visibility, frame changes, window changes, and background/foreground reconciliation. A hidden keyboard has no frame. Backgrounding dismisses the keyboard and clears transient layout state.
- `KeyboardViewport` measures its native view in window coordinates and removes only the overlapping keyboard area. The root native Stack applies it per scene. `KeyboardModal` creates an independent owner for each native modal because React context crosses native modal portals. Already resized Android windows have zero additional overlap.
- Nested `KeyboardAvoidingView` compatibility wrappers become ordinary containers. Their former keyboard-height/header-offset calculations do not add another inset.
- `KeyboardScrollView` owns focus for the nearest vertical form. It measures the actual native input and viewport, revealing only an obscured field. Horizontal scroll surfaces preserve the parent form's focus owner. Caller refs, event callbacks, refresh controls and gesture behavior are preserved.
- The canonical `SLTextInput` reports focus, blur, text-size and selection changes to that owner. Multiline input grows within a bounded fraction of the available presentation and then scrolls internally. Caller handlers and native refs remain intact.
- `KeyboardComposer` keeps the input, attachment and Send controls together. At rest it clears the actual floating dock and bottom safe area. While typing it uses a compact gap above the measured keyboard boundary.

## Sheets and navigation

The existing `StrengthLedgerBottomSheet` remains the sheet/gesture owner. Its height is clamped to the available presentation; safe-area bottom padding is removed while the keyboard already occupies that edge. Keyboard-driven Android window resizing does not replay the sheet's entrance animation. The deliberate top-only dismissal region, thresholds and close guards are unchanged.

The app floating dock, shared floating controls and Athlete Workspace dock yield to active composition. `SLScreen` preserves the top safe area and removes duplicate bottom safe-area padding while the keyboard is visible. Route changes dismiss the keyboard; initial route mount does not dismiss autofocus.

The Session authoring form retains its essential Save toolbar. Its focused-field clearance includes that existing toolbar, rather than estimating a keyboard height. Feedback's existing Cancel/Send footer remains outside the scrolling form and inside the resized modal.

## Adding a new input surface

1. Use `TextInput` from `components/ui/sl-text`, or `SLField` which delegates to it.
2. Use `KeyboardScrollView` for vertical editable forms. Existing `SLScrollScreen`, `RefreshScreen` and sheet scrolling adapters already delegate to it.
3. Use `KeyboardModal` or the governed sheet system for a new native modal. Do not add a second keyboard inset inside it.
4. Keep required actions inside the same resized presentation. Prefer a normal footer beside the scroll area; if an existing sticky footer overlays content, account for that control's height in focused-field clearance.
5. Use `KeyboardComposer` for Messages-style composition with the floating dock. Do not copy a guessed bottom/keyboard offset.
6. Preserve the caller's dismissal and unsaved-draft semantics. This layout system must not submit, save, switch athlete, alter movement identity or change Logger lifecycle.

## Regression guard

`node scripts/test-keyboard-visibility.mjs` executes window/keyboard geometry, focus transitions and native-ref/event forwarding, keyboard/AppState event handling, bounded multiline layout and composer dock clearance. It also scans every app/component TSX consumer to prevent direct native ScrollView/Modal/KeyboardAvoidingView imports, raw native inputs outside the canonical wrapper, guessed header offsets and duplicate native keyboard insets.

The check is automatically discovered by the accepted-behavior suite and is part of the release-critical suite. It complements actual simulator checks; simulated component tests are not a claim of physical-device validation.

See backend DEV `docs/validation/keyboard-visibility-2026-09-13/README.md` for the input inventory, native evidence, validation status and release receipt.
