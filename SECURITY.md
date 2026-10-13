# Security and privacy

Same Page keeps account credentials in independent Claude configuration directories. It links only `projects/`, which contains local conversations and default project auto memory. Those files can contain sensitive code, prompts, paths, and personal information.

The launcher does not read or copy credential files, inspect account identities, make network requests, or send telemetry. Claude itself authenticates and communicates according to its own configuration. Other programs running as your OS user can access both profiles; this is not a sandbox.

## Never publish local state

Do not commit any Claude profile, the Same Page registry, credentials, JSONL transcript, or real memory directory. The ignore rules are one layer; `npm run audit:public` checks common credential patterns and private path names without printing matched values. It is a heuristic, not proof that every possible secret has been detected. Inspect the actual commit and package file lists too.

Use `node scripts/audit-public.mjs --tracked` to audit the Git file list, and `node scripts/audit-public.mjs --history` to inspect text files in all reachable commits, including files removed from the current tree. Only generated synthetic data appears in tests and visual assets. Publishable binary assets must be visually reviewed. Use different shared stores for data that must remain separate.

## Usage caches

`csp usage` reads only `statusline-usage.json` in registered profile directories. It never invokes Claude, reads authentication files, queries a server, or writes the cache. Output is restricted to profile names, usage fields, file times, and fixed diagnostic messages. Parser errors do not expose file contents. Linked profile roots/cache files and caches larger than 64 KiB are refused.

The optional `examples/statusline-usage.mjs` is a separate producer you explicitly configure as Claude's status line. It receives stdin data from Claude, extracts only the two usage windows, and writes the sibling cache through a temporary file and rename. It does not read credentials or contact a server. Keep a copy in each profile directory; do not point different accounts at one shared copy. A cache timestamp measures the last file update, not server freshness.

Never commit real usage caches: they expose private activity timing even without tokens. Ignore rules and the public-file audit reject their filename. All published cache numbers are synthetic.

## Report a vulnerability

Use this repository's private GitHub vulnerability reporting if enabled. Do not open a public issue containing secrets or sensitive transcripts. Give the affected version, a synthetic reproduction, and the smallest relevant source reference. If a real credential was exposed anywhere, revoke it with its issuer rather than relying only on deleting a file.
