# Canonical DEV Metro Runtime

Canonical mobile DEV evidence must come from:

- project root: `/Users/dominic/powerlifting_app_dev/powerlift_mobile`
- branch: `dev/canonical-mobile`
- port: `8081`
- lineage: `HEAD` exactly equal to `origin/dev/canonical-mobile`
- served source: the current files on disk, including uncommitted changes

Start the server with:

```bash
npm start
```

Tracked modifications, untracked files, staged changes, and combinations of
these are normal DEV state. They never fail source validation by themselves.
Startup reports local changes informationally and continues to Metro. No
commit, stash, reset, or cleanup is required to run unfinished local changes.

After Metro is listening and before accepting screenshots, certify the live
process and Expo manifest:

```bash
npm run certify:canonical-dev -- --host 127.0.0.1 --output /tmp/strength-ledger-dev-metro-lineage.json
```

Use the active LAN address in `--host` when validating the same URL opened by
Expo Go. The certificate records the port, listener PID and working directory,
project and Git roots, branch, local and remote SHAs, clean state, runtime, and
manifest project root.

Source validation fails closed for a different process/Git/tooling root, an
isolated worktree, another branch (including release or Production), a detached
HEAD, or a local/remote SHA mismatch. Startup also rejects an occupied port.
Runtime certification additionally checks the single port-8081 listener, its
working directory, the Expo manifest root, runtime/app-version agreement, and
the launch-asset URL/port. Evidence captured before certification passes is not
canonical DEV evidence.

DEV runtime certification accepts dirty source and records `clean: false`
honestly. Such a certificate proves canonical runtime lineage; its HEAD alone
does not identify the uncommitted bundle. Preserve the reviewed diff with any
evidence that needs reproduction. Do not remove or relocate unrelated local
work to satisfy DEV startup or certification.

This local execution policy does not relax TestFlight/Production export,
promotion, source-parity, or clean-release requirements. Their separate release
guards still apply. No startup command commits, stashes, resets, or deletes
local work.
