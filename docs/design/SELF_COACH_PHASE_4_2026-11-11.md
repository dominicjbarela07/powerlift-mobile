# Self-Coach Phase 4

## Authorized request and destination

The owner requested Phase 4 implementation with thorough onboarding and recovery, validation on iOS and Android, and a simulator handoff with a walkthrough. Implement in canonical DEV. Preserve the approved mobile-first Self-Coach workflow, dark plum/charcoal and purple visual system, original movement imagery and floating glass dock.

## Acceptance criteria

- Exercise fresh account entry, sign-in, email verification, resend/correction, billing activation and checkout return. Include interrupted and resumed setup. Self-Coach is the primary experience, with adjacent Athlete and Team Coach admission/access contracts retained.
- Preserve entered work through recoverable failures. Reconcile ambiguous writes using their canonical identities. Validate offline/slow-network recovery, process relaunch and ready-account routing without granting access from stale client state.
- Provide contextual help with safe diagnostics, retained input, idempotent submission and a confirmed receipt. Verify the existing support destination and delivery path. Distinguish saved, queued and delivered states.
- Exercise media load/upload recovery and retained Session saves. Keep exact movement/equipment/record scope, optional effort, zero-load edits, original set IDs, all Phase 1–3 additions and the movement-framing audit.
- Validate readable large text, touch targets, screen-reader labels and announcements, reduced motion and platform-specific Back/keyboard/safe-area behavior. Retain Apple sign-in retirement and native email verification and the owner's Training Session terminology.
- Run actual native iOS and Android flows against the named DEV backend, record installed runtime/platform details and screenshots, compare visual passes to the approved recovery board and correct weak areas before handoff.
- Leave the DEV app open in the simulator. Deliver a concise walkthrough and explicitly identify any remaining gaps. Separate automated tests, native observations and external-provider evidence.

## Preserved authority

AuthContext owns identity hydration and active mobile mode. The backend owns readiness, verification, billing and legal routing. Email/Stripe/provider callbacks supply reconciliation input. Canonical saves, upload queues and source evidence retain their mutation and ownership rules. Keep dirty canonical DEV state and historical release evidence. This phase's delivery is DEV review.

## Validation record

Findings, changes, platform observations and final source-bound evidence are added as work proceeds.

## iOS DEV handoff

The owner subsequently deferred Android and requested an iOS focus ahead of an eventual TestFlight release. The delivered slice is canonical DEV running in Expo Go SDK 54 on iPhone Air, iOS 26.2. The simulator is signed in as the isolated Self-Coach QA account and left on Train with its active Training Session. The Expo Go manifest retains a historical 2.1.0 label. This observation establishes the DEV JavaScript workflow. Standalone Mobile 3.0 qualification remains a separate release step.

### Changes and reasons

- Setup retains the selected role, name, email and current form step through a process relaunch. Passwords, access codes, verification codes and credentials are excluded from the guest draft. Successful authentication and explicit sign-out clear it. This lets someone recover an interruption without retaining authentication secrets.
- Canonical account identity survives a preferences-service failure. Authenticated pre-ready responses now include the same user's ID and email. A foreign or stale response cannot replace the current account. This repairs the missing-identity setup trap while keeping verification and membership access server-owned.
- Verification, resend and email correction use a shared in-flight guard. Correction preserves the account and existing support references. Verification requires actual confirmation in the server response. Focused and foregrounded setup screens make bounded status checks, then leave manual retry and support available.
- Checkout handles cancellation and dismissal with a neutral saved-progress message. Its action becomes usable again. Membership status and profile reconciliation can each recover a confirmed ready account when the other request fails. The return screen uses confirmed billing state before opening the workspace.
- Help is available in setup, unavailable Today, Settings, Session recovery, Set-edit failure and video failure. Reports retain sanitized details locally, reuse their immutable request ID across uncertain retries and recover an existing receipt after a lost response. Separate reports receive separate IDs. The interface distinguishes saved, queued, accepted and DEV-suppressed notification states. It also supplies the existing direct support-email fallback.
- An unsaved Set edit is journaled under its canonical account, Session, Set, movement/equipment identity and revision. Relaunch restores the exact draft only while that evidence still matches. Confirmation clears that Set's draft. Canonical wheel controls, zero load, optional effort and immutable Set IDs remain in use.
- Checkout actions use the shared touch-safe buttons. Dynamic Type changes now invalidate native text measurement so the old single-line layout cannot crop enlarged glyphs. Video recovery has a scrollable help area below the header, a 44-point Retry target and a consistently reachable Close control.

The visual passes retained the approved dark plum/charcoal surfaces, purple action hierarchy, floating glass dock and movement artwork. The three corrected weak areas were cramped checkout actions, stale live text-size measurement and help overlapping video metadata. Second-pass native captures show the corrected layouts.

### Actual iOS observations

| Flow | Observed result |
| --- | --- |
| Role-first entry and interrupted form | Self-Coach selection leads to the existing form. Name/email/role/step returned after termination and relaunch. Password fields were empty |
| Sign-in with preferences interruption | A rejected settings request still reached email verification with the authenticated account ID |
| Verification and correction | The real DEV code endpoint consumed expiring hashed codes. Resend cooldown, invalid-code feedback and correction remained usable. Corrected account identity and support references were preserved |
| Activation | Server terms displayed 14 days free followed by $4.99/month. Missing provider configuration produced a recoverable error and help |
| Native checkout cancellation | A controlled checkout-URL response opened the native browser at Stripe's public Checkout page. Closing it returned to retained setup with an enabled primary action and a calm notice |
| Confirmed return | DEV-only membership simulation produced server-confirmed READY_INDIVIDUAL. The real billing-return route opened the optional introduction, then Go to Train reached the Self-Coach workspace |
| Support response loss | The server saved the report before its response was dropped. Receipt lookup recovered the same reference. Another report received another reference |
| Support before-write outage and relaunch | The report remained visibly unconfirmed and retained on device. After relaunch and reconnection, retry saved that report once |
| Session save and edit response loss | The same immutable Set reconciled after each lost acknowledgement. There is one Set row and one active attachment |
| Unsaved edit relaunch | The wheel editor restored 0 kg, 6 reps and unset effort while explicitly displaying the currently saved 0 kg × 5. No automatic write occurred |
| Film failure and retry | A forced URL outage exposed Retry and contextual help. Reconnection decoded the same saved DEV transport clip |
| Large text and keyboard | Accessibility Large wrapped the setup content, preserved scroll access and rendered both checkout actions. Switching text size while open reflowed after the measurement fix. Support input uses the existing keyboard-aware surfaces |
| Final ordinary DEV restart | Fault injection was removed. The original direct backend port and default DEV billing-enforcement setting were restored. A fresh app launch reached Train and its Resume session control |

The media fixture is a blue transport-test frame named DEV transport clip. It demonstrates upload deduplication, URL recovery and native decoding. It supplies no lifting-technique evidence.

### Automated validation

- All 21 focused mobile suites passed against final source. They cover setup drafts and support journals, actual verification/checkout handlers, Dynamic Type measurement, canonical identity, all three signup role handlers, Apple sign-in retirement, checkout lifecycle, mode transitions, Set saves/edits, authoring recovery, video queues/cache/playback, keyboard geometry, reduced motion, Phases 1 and 3, account settings and movement atmosphere.
- The dedicated zero-load actual editor guard also passed. Its deliberate zero-rejecting source variant failed as required. The real edit/reload API regression passed. Zero and RIR zero retain the same Set and immutable snapshots.
- The backend onboarding/account suite passed 119 tests. Coverage includes real verification-code rules, isolated account access, contact correction, durable help outbox, support ownership and replay, billing intent reuse, stale billing events and failure controls. The additional zero-load API test passed separately.
- Full TypeScript checking and whitespace validation passed. No new type suppression was introduced. The large legacy Session file keeps its pre-existing first-line suppression.
- Movement atmosphere validation retained 499 movement mappings and 490 approved sources. All 5,880 raster layout cases passed with zero missing sources or source-pixel changes. The deliberate thumbnail regression was rejected.
- Two broader existing typography checks remain failing. `test-typography-system.mjs` finds missing font license documents, which are also absent from the starting Git tree. `test-mobile-text-layout-contract.mjs` has an exact-source expectation for the earlier movement title style and stops on the atmosphere title's existing style array. The title still has unlimited lines. These checks require reconciliation before a release claim. Their assertions were retained.

Local successful server responses through the QA transport had median 153 ms for account status across 11 requests, 148 ms for preferences across 24 requests and 7 ms for membership status across 16 requests. The observed successful Set edit took 18 ms and one support write took 29 ms. These are development server response measurements. End-to-end production latency and adverse mobile-network performance need device qualification.

### Data preservation

The final read-only database check confirmed QA Session 3064 and Set 23234, saved as 0 kg × 5 with unset RIR and source revision 2. It has one Set row and one active attachment. The retained 6-rep edit remains a local draft. Phase 1–3's separate account retains its active Session 3030 with two saved Sets, original video 1354 and original source Set 23229. Its archive data was preserved.

### Verification boundaries and TestFlight follow-through

Android is deferred at the owner's direction. Its partial entry-screen observations do not establish end-to-end validation. Temporary emulator keyboard and font settings were restored and the emulator was stopped.

DEV email sending is suppressed and Stripe credentials are absent. Verification used controlled codes issued into the real DEV verification store. Membership used the existing server-restricted DEV simulation. Support notifications correctly report DEV suppression. Live inbox delivery, an actual Stripe trial/webhook, owner push/email delivery and a real bank challenge were not certified in this slice. The browser cancellation exercise used a controlled URL response and introduced no financial transaction.

Actual native accessibility labels, status announcements, busy states, text-size reflow and touch controls were inspected. Spoken VoiceOver traversal and a physical-device screen-reader pass remain to be performed. TestFlight also requires the matching backend release, protected release-state reconciliation, standalone Mobile 3.0 native configuration, actual candidate handoff/build/archive checks, release gates and owner-authorized publication. No commit, push, EAS build, OTA publication or store submission occurred in this phase.

### Simulator walkthrough

1. On Train, tap **Resume session**. The Push-Up shows one saved Set and its original film action.
2. Tap **Set 1**. The wheel editor restores the unsaved 6-rep draft and states that the saved result is 0 kg × 5. Inspect weight, reps, optional effort and the retained Cancel/Save Changes controls. **Cancel** leaves the saved result intact. **Save Changes** deliberately accepts the draft.
3. Tap **View** beside the Set to open the labeled blue DEV transport clip. Close it to return to the same Session.
4. Minimize the Session and open **Settings → Get help**. Enter an optional description. A saved request returns a reference and truthfully identifies DEV notification suppression. Close and reopen help to see that receipt retained. A second report gets a new identity.
5. To inspect account entry, use **Settings → Log Out**, then select **Self-Coach**. The role-first experience and details form remain connected. Non-secret unfinished signup input survives a relaunch. Email verification and trial evidence are captured in the files below.

Phase 5 remains. It covers the new-to-app usability pilot, the largest remaining comprehension/navigation failures, owner visual review and separately authorized Mobile 3.0 rollout. Web adaptation follows the accepted mobile workflow model.

### Evidence

The local evidence directory is `/Users/dominic/.codex/work/self-coach-phase4-20261111`. It contains `mobile-final.log`, `backend-final.log`, `typescript-final.log`, dedicated zero-load results and negative control, `final-data-integrity.json`, `dev-response-timings.json`, native screenshots and a source-hash manifest. Credential fixtures are private local QA inputs and are excluded from the deliverable manifest.

The inspected visual reference was the approved `self-coach-mobile-rebuild-storyboards/04-return-recovery-v2.png`. Existing owner terminology supersedes its older Session wording. Native browser lifecycle follows the installed Expo WebBrowser API. The accessibility pass follows React Native accessibility and Apple onboarding guidance. [Expo WebBrowser](https://docs.expo.dev/versions/latest/sdk/webbrowser/), [React Native accessibility](https://reactnative.dev/docs/accessibility), [Apple onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding)
