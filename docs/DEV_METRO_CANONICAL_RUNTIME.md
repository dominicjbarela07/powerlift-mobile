# Canonical DEV Metro Runtime

Canonical mobile DEV evidence must come from:

- project root: `/Users/dominic/powerlifting_app_dev/powerlift_mobile`
- branch: `dev/canonical-mobile`
- port: `8081`
- source: a clean `HEAD` exactly equal to `origin/dev/canonical-mobile`

Start the server with:

```bash
npm start
```

After Metro is listening and before accepting screenshots, certify the live
process and Expo manifest:

```bash
npm run certify:canonical-dev -- --host 127.0.0.1 --output /tmp/strength-ledger-dev-metro-lineage.json
```

Use the active LAN address in `--host` when validating the same URL opened by
Expo Go. The certificate records the port, listener PID and working directory,
project and Git roots, branch, local and remote SHAs, clean state, runtime, and
manifest project root.

The check fails closed for an isolated worktree, another port, another branch,
a dirty checkout, a local/remote SHA mismatch, or a Metro manifest rooted
outside canonical DEV. Evidence captured before this certificate passes is not
canonical DEV evidence.

If unrelated work exists in the canonical checkout, preserve it recoverably
before convergence. Never reset or overwrite it merely to make the certificate
pass.
