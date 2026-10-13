# Security and privacy

Samepage keeps account credentials in independent Claude configuration directories. It links only `projects/`, which contains local conversations and default project auto memory. Those files can contain sensitive code, prompts, paths, and personal information.

The launcher does not read or copy credential files, inspect account identities, make network requests, or send telemetry. Claude itself authenticates and communicates according to its own configuration. Other programs running as your OS user can access both profiles; this is not a sandbox.

## Never publish local state

Do not commit any Claude profile, the Samepage registry, credentials, JSONL transcript, or real memory directory. The ignore rules are one layer; `npm run audit:public` checks common credential patterns and private path names without printing matched values. It is a heuristic, not proof that every possible secret has been detected. Inspect the actual commit and package file lists too.

Use `node scripts/audit-public.mjs --tracked` to audit the Git file list, and `node scripts/audit-public.mjs --history` to inspect text files in all reachable commits, including files removed from the current tree. Only generated synthetic data appears in tests and visual assets. Publishable binary assets must be visually reviewed. Use different shared stores for data that must remain separate.

## Report a vulnerability

Use this repository's private GitHub vulnerability reporting if enabled. Do not open a public issue containing secrets or sensitive transcripts. Give the affected version, a synthetic reproduction, and the smallest relevant source reference. If a real credential was exposed anywhere, revoke it with its issuer rather than relying only on deleting a file.
