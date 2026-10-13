# Project rules

Claude Same Page is a local Claude Code profile launcher. Preserve independent authentication while linking only `projects/` for shared transcripts and project auto memory.

- Node.js >= 22, ESM, no runtime dependencies. Run `npm test` and `npm run audit:public` before publishing.
- Never read, copy, log, commit, or upload real credentials, account identity files, transcripts, or memory. Fixtures must be synthetic.
- Inspect directories before writing. Refuse existing data rather than deleting or merging it. Never follow profile-root links or replace a nonempty project directory.
- Keep launched arguments separate from shell code. Never enable `shell: true` or interpolate user arguments into a shell command.
- Keep documentation in English and Simplified Chinese aligned. Distinguish fixture tests from authenticated end-to-end validation.
- Assets live in `assets/`, code in `src/`, test data is generated under OS temporary directories. Do not add local state to this repository.

Maintainers can add project-specific constraints and common task prompts here.
