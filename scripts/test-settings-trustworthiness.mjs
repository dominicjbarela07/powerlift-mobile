import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const settings = readFileSync(resolve(root, 'app/(tabs)/settings.tsx'), 'utf8');
const accountGate = readFileSync(resolve(root, 'app/index.tsx'), 'utf8');
const api = readFileSync(resolve(root, 'lib/api.ts'), 'utf8');
const authContext = readFileSync(resolve(root, 'context/AuthContext.tsx'), 'utf8');

const accountTypeRow = settings.indexOf("title: 'Account Type'");
const accountAccessRow = settings.indexOf("title: 'Account Access'");
const mobileModeRow = settings.indexOf("title: 'Mobile Mode'");
const trainingGroup = settings.indexOf("title: 'Units'", accountTypeRow);

assert.ok(accountTypeRow >= 0, 'Settings must retain the account type row');
assert.ok(accountAccessRow > accountTypeRow, 'Account Access must live in the account identity group');
assert.ok(mobileModeRow > accountAccessRow && mobileModeRow < trainingGroup, 'Mobile Mode must live with Account Access before training preferences');
assert.doesNotMatch(settings, /Coaching Access/, 'legacy coaching-only account terminology must not remain');

assert.match(settings, /modeOptions\.length > 1/, 'single-mode accounts must not receive a redundant Mobile Mode selector');
assert.match(settings, /if \(isIndividual && !canUseInternalSelfCoachMode\) return \['individual'\]/, 'self-coached accounts must remain single-mode unless the backend grants founder/internal mode access');
assert.match(settings, /Array\.isArray\(auth\?\.user\?\.available_mobile_modes\)/, 'mode choices must derive from backend-authorized account capabilities');
assert.match(settings, /mode\.available === true && existingSwitchEnabled && isCoach/, 'the selector must not widen backend role or capability access');
assert.match(settings, /title: 'Mobile Mode',[\s\S]*?onPress: \(\) => setModeModalOpen\(true\)/, 'the relocated row must retain the existing modal behavior');
assert.match(settings, /<Modal visible=\{modeModalOpen\}[\s\S]*?<ThemedText style=\{styles\.modalTitle\}>Switch mobile mode<\/ThemedText>/, 'the production Mobile Mode sheet must remain route-owned');
assert.match(settings, /can_access_internal_self_coach_mobile_mode === true/, 'founder/internal accounts must retain explicitly authorized multi-mode access');

const accountTypeRowSource = settings.slice(accountTypeRow, accountAccessRow);
assert.match(accountTypeRowSource, /onPress: canChangeAccountType \? openAccountTypeTransition : undefined/, 'Account Type must open a real transition only when the backend-authorized mutation can start');
assert.match(settings, /const canChangeAccountType = canOpenTeamCoachUpgrade \|\| canStartTeamCoachDowngrade/, 'Account Type interactivity must come from actual upgrade or downgrade eligibility');
assert.match(settings, /\{onPress \? <Ionicons name="chevron-forward"/, 'read-only rows must not render misleading chevrons');
assert.match(settings, /TRANSITION_ATHLETE_TO_TEAM_COACH[\s\S]*?beta_code: betaCode[\s\S]*?dev_simulate_billing: devSimulationEnabled/, 'eligible Athlete upgrades must retain the confirmed founder-code transition contract');
assert.match(settings, /API_BASE !== PRODUCTION_API_BASE/, 'development billing simulation must never be sent to production');
assert.match(settings, /if \(json\.checkout_url\)[\s\S]*?await openRecoverableCheckoutBrowser\(json\.checkout_url\)/, 'production Team Coach upgrades must open returned Stripe Checkout through the recoverable browser contract');
assert.match(settings, /pendingTeamCoachUpgrade[\s\S]*?'\/auth\/account-transitions\/team-coach-upgrade\/cancel'[\s\S]*?TRANSITION_TEAM_COACH_TO_ATHLETE/, 'incomplete upgrades and active Team Coach downgrades must retain their separate protected endpoints');
assert.match(settings, /roster_offboarding_required[\s\S]*?Resolve roster athletes before returning to Athlete only/, 'roster-owning coaches must retain the production downgrade block');
assert.match(settings, /Stripe cancellation is confirmed before coach tools are removed/, 'downgrade confirmation must explain Stripe-before-access-removal protection');

const mobileModeHandlerStart = settings.indexOf('const handleSelectMobileMode');
const mobileModeHandlerEnd = settings.indexOf('const handleLinkCoach', mobileModeHandlerStart);
const mobileModeHandler = settings.slice(mobileModeHandlerStart, mobileModeHandlerEnd);
assert.match(mobileModeHandler, /auth\?\.switchMobileMode\?\.\(nextMode\)/, 'Settings must delegate mode mutation to the authoritative AuthContext transition');
assert.match(authContext, /'\/mobile\/settings\/mode'/, 'the authoritative transition must use the protected view-preference endpoint');
assert.doesNotMatch(mobileModeHandler, /account-transitions|TRANSITION_ATHLETE_TO_TEAM_COACH|TRANSITION_TEAM_COACH_TO_ATHLETE/, 'switching Mobile Mode must not mutate account type');
assert.match(api, /startMobileBillingCheckout[\s\S]*?\/mobile\/billing\/checkout/, 'activation recovery must use the authenticated mobile billing endpoint');
assert.match(api, /cancelPendingTeamCoachUpgrade[\s\S]*?\/auth\/account-transitions\/team-coach-upgrade\/cancel/, 'incomplete Team Coach upgrade cancellation must remain available through the protected endpoint');
assert.match(accountGate, /startMobileBillingCheckout\(\)/, 'ACTIVATION_REQUIRED must route back into Stripe checkout recovery');
assert.match(accountGate, />Cancel Team Coach upgrade<\/Text>/, 'an unpaid Team Coach must retain a visible escape back to Athlete');
assert.match(accountGate, /router\.push\('\/\(tabs\)\/settings'\)/, 'account setup must retain access to Settings during activation');

assert.doesNotMatch(settings, /title: 'Connected Apps'/, 'Connected Apps must stay hidden until it has a functional destination');
assert.doesNotMatch(settings, /title: 'Calendar Connection'/, 'Calendar Connection must stay hidden until it has a functional destination');
assert.doesNotMatch(settings, /title: 'Data Sharing'/, 'vague data-sharing claims must stay hidden until backed by user controls');
assert.doesNotMatch(settings, /title: 'Export Data'/, 'data export must stay hidden until mobile has a functional destination');
assert.doesNotMatch(settings, /title: 'Help'/, 'the duplicate Help wrapper must stay hidden until a distinct support destination exists');
assert.doesNotMatch(settings, /summary: 'Unavailable'/, 'planned Settings rows must not use misleading unavailable summaries');
assert.match(settings, /accountTransitionsError[\s\S]*?'Status not loaded'/, 'genuine account-access load failures must use precise status language');
assert.match(settings, /reason \|\| 'Not available for this account'/, 'capability restrictions must explain that they are account-specific');
assert.match(settings, /showNotificationsSection[\s\S]*?title: 'Notifications'/, 'notification controls must only appear for supported workflows');
assert.doesNotMatch(settings, /Notification controls become available/, 'unsupported workspaces must not open an empty notification panel');
assert.match(settings, /title: 'Video Data Use'/, 'model-training consent must not be mislabeled as video visibility');
assert.match(settings, /videoMlTrainingConsent === true \? 'Allowed' : 'Not allowed'/, 'video data-use status must describe consent accurately');
assert.match(settings, /accountAccessLabel\(accountTransitions\.account_state\)/, 'backend account-state tokens must be translated into user-facing copy');
assert.match(settings, /accountRestrictionLabel\(option\.reason\)/, 'backend mode restrictions must be translated into user-facing copy');
assert.doesNotMatch(settings, /humanizeToken\(accountTransitions\.account_state/, 'raw account-state tokens must not leak into the Mobile Mode sheet');
const accountGroup = settings.indexOf(", 'Account')}");
const trainingSection = settings.indexOf("activeMobileMode === 'coach' ? 'Personal Training' : 'Training'");
const privacyGroup = settings.indexOf(", 'Notifications & Privacy')}");
const supportGroup = settings.indexOf(", 'Support')}");
assert.ok(accountGroup >= 0 && trainingSection > accountGroup && privacyGroup > trainingSection && supportGroup > privacyGroup, 'Settings groups must have a scannable long-term information hierarchy');
assert.match(settings, /training_max_permissions/, 'Training Maxes UI must consume the server-authoritative permission payload');
assert.match(settings, /trainingMaxPermissions\?\.authority_resolved === true[\s\S]*?trainingMaxPermissions\?\.can_direct_edit === true/, 'Training Maxes editing must fail closed until authority resolves');
assert.match(settings, /Managed by your coach/, 'externally coached athletes must receive concise read-only Training Maxes context');
assert.match(settings, /trainingProfile && canDirectEditTrainingMaxes \? \(\) => openProfileEditor\('maxes'\) : undefined/, 'the Training Maxes editor must only open when direct edit is authorized');
assert.match(settings, /profileEditor !== 'maxes' \|\| canDirectEditTrainingMaxes/, 'the editable Training Maxes modal must not remain mounted after authority is lost');
const saveTrainingMaxesStart = settings.indexOf('const saveTrainingMaxes');
const saveTrainingMaxesEnd = settings.indexOf('const saveTrainingContext', saveTrainingMaxesStart);
const saveTrainingMaxes = settings.slice(saveTrainingMaxesStart, saveTrainingMaxesEnd);
assert.match(saveTrainingMaxes, /squat_tm: displayValueToKg\(maxesDraft\.squat_tm, profileUnits\)[\s\S]*?bench_tm: displayValueToKg\(maxesDraft\.bench_tm, profileUnits\)[\s\S]*?deadlift_tm: displayValueToKg\(maxesDraft\.deadlift_tm, profileUnits\)/, 'authorized Training Max saves must preserve canonical kilogram conversion for all three lifts');
assert.match(saveTrainingMaxes, /resp\.status === 403 && json\.error === 'coach_controlled_training_maxes'[\s\S]*?setProfileEditor\(null\)[\s\S]*?await loadMobileSettings\(\)[\s\S]*?Your training maxes are now managed by your coach/, 'a stale Training Max save must close the editor, refresh authority, and explain the relationship change');
assert.match(settings, /setProfileEditor\(null\)[\s\S]*?setTrainingProfile\(null\)[\s\S]*?setMobileSettingsLoaded\(false\)[\s\S]*?switchMobileMode/, 'account switching must clear stale Training Max capability data before delegating to the authoritative transition');

console.log('[settings] trustworthy terminology, protected account transitions, separate role-aware Mobile Mode, placeholder hiding, modal routing, and DEV isolation passed');
