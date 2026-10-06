# Movement discovery search — October 5 owner request

Improve the mobile movement search used in Hot Swap / in-session addition and
Session Workspace. Owner example: cable pullover should help discover the
established Straight-Arm Cable Pulldown without knowing its exact catalog name.
Search should tolerate everyday names, incomplete text and spelling mistakes,
offer useful completions/match hints, and feel responsive with clear touch
feedback. Try the actual runtime and leave a DEV review available.

Acceptance:
- Cable pullover and its partial/typo forms expose the same exact canonical
  cable movement ID; pullover alone discovers cable, machine and free-weight
  options without merging them. Names and existing approved art stay unchanged.
- Exact names rank first; bounded typo/prefix/natural word handling works across
  the available catalog. Suggestions use only authorized, in-scope catalog rows.
- Both mobile picker entry points share search assistance; suggestions refine
  the query, never perform a Swap/add automatically. Existing selection, saving,
  favorites, scope, class and authoring permission gates remain canonical.
- Obsolete results cannot win after typing/clearing/changing scope/closing.
  Loading begins promptly, search can be cleared, and taps have clear feedback.
- Test real authenticated API discovery plus mobile response ordering and shared
  search helpers; typecheck, use actual DEV simulator and inspect two passes.
- DEV only until owner review. No TestFlight/backend production publication is
  requested here. Preserve prior shipped fixes, pending approved logger layout,
  all approved assets, manufacturer PR isolation and immutable performed history.
- Search matching has discovery authority only: no new aliases in identity
  resolution, no taxonomy/catalog merge, no automatic identity or equipment edits.

Before state: backend ade6c484; mobile b31b6417. The first Swap screenshot
shows an empty state while the debounced request is pending. The completed DEV
response already recognized Cable Pullover as the persisted governed alias for
Straight-Arm Cable Pulldown. It was not a missing catalog alias. Weaknesses were
misleading pending feedback, no completions or match explanations, limited
short-prefix/typo handling, weak natural muscle/equipment discovery, and stale
response/pagination risks. No synonym merge or catalog edit was needed.

The owner clarified that this must help discovery across the whole directory,
including when a person knows only what they want to train or available equipment.
The implementation is general search matching over all visible canonical rows,
not a cable-pullover special case. It reuses the existing regional muscle map,
prioritizes primary muscle + equipment matches before secondary matches, handles
normal plurals/abbreviations/filler words, and tries literal short-word prefixes
alongside abbreviations (SA can mean Single Arm or an unfinished Saw).

Implemented in canonical DEV:
- Shared search field in Hot Swap/in-session picker and Session Workspace:
  completions, familiar-name hints, clear, immediate pending state, focused and
  pressed feedback, selection haptic requests. Suggestions refine queries only.
- Existing authorized names, active aliases, equipment and muscle metadata remain
  the discovery authority. Exact names/aliases rank first; no new identity authority.
- Abort/invalidate obsolete reads before results can replace a newer query or
  return after clear/close/scope changes; ignore old Workspace pagination.
- Preserve server relevance order for typed Workspace queries. Empty-query
  favorites/recent grouping and canonical selection/mutation gates are retained.
- Match the route cursor limit to the already canonical search engine bound of
  700 so mobile pages can reach the tail of the directory. This one existing
  predirty endpoint correction is retained as a necessary whole-directory
  dependency; unrelated predirty source remains byte-preserved and unstaged.
- Empty searches offer fewer words / equipment / muscle guidance plus working
  muscle browsing and explicit scope broadening, without automatically changing
  saved product semantics or picker scope.

Validation completed:
- All 513 active global definitions and 854 active aliases checked. Exact terms,
  1,367 shortened-name cases and 1,358 adjacent-letter typo cases: 0 failures.
- Authenticated DEV pagination returns all 475 authorized discovery identities
  through 20 mobile-sized pages: missing 0, extra 0, duplicate 0.
- Thirteen authenticated API examples cover names/typos/abbreviations, shoulders,
  back, hamstrings, legs, core, free-weight chest and bodyweight abs: useful
  results for every example. API and seeded-regression checks retain private
  ownership, exclusions, class/equipment scope and unchanged v2 response shape.
- Nine backend tests pass. New discovery regressions failed before the fixes;
  exhaustive prefix coverage caught Body Saw's abbreviation collision and now
  passes. The mobile canonical-search command now includes actual consumer
  effect tests deliberately resolving obsolete requests after abort/clear/close
  and stale Workspace pages after a new query. Those and existing picker/gating
  checks pass. TypeScript checks pass.
- Actual canonical npm-start simulator flows reviewed in both entry points.
  First and second passes inspected; repeated hints, typo specificity ranking and
  redundant metadata prose were corrected. Approved original art remains intact.
  Physical phone haptics have not been observed; simulator cannot prove them.
- Dedicated QA Sessions only; no SetLogs added, no Swap or Session save performed.
  The temporary unsaved Workspace selection was removed, restoring its clean state.

Proof: mobile docs/validation/movement-search-2026-10-05/review.json, screenshots,
full-inventory-search.json and test logs. No temporary Git worktree was created.
DEV backend and canonical Metro remain running; the simulator is open on the
machines-for-hamstrings Hot Swap discovery example for owner review.

Delivery: DEV implementation/review complete. TestFlight and shared Production
remain unchanged for this request; publication is not claimed or authorized here.
