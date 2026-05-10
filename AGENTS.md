# AGENTS.md — dpos.space

## Project goal

Branch `v3` is a static HTML+CSS+JS version of dpos.space for DPoS tools. It should run behind a simple static server without PHP/backend runtime.

## Current repository shape

Static v3 files:

- `index.html` — static SPA entry point.
- `v3/css/style.css` — v3-only styles.
- `v3/js/chains.js` — supported chains, apps, nodes, and vendored library paths.
- `v3/js/auth.js` — compatibility layer for old `localStorage` auth/account records.
- `v3/js/broadcast.js` — operation prepare/broadcast helpers.
- `v3/js/profiles.js` — read-only profile/account data loading.
- `v3/js/history.js` — read-only account history loading and normalization.
- `v3/js/app.js` — accessible router and UI wiring.
- `v3/vendor/<chain>/` — minimal required browser blockchain libraries copied for v3 runtime.
- `tests/*.js` — v3 smoke tests.
- `plan.md` — migration plan and cleanup notes.

The old PHP app tree was removed from branch `v3`. Do not add runtime dependencies on old PHP directories or old `blockchains/` paths.

## Stack and constraints for v3

- Prefer plain HTML, CSS, and vanilla JavaScript.
- Do not add build tooling or npm dependencies unless there is a concrete need.
- Do not require PHP, Composer, MongoDB, cron, pm2, private tokens, or bots for v3 runtime.
- Use direct public RPC/API calls from the browser where possible.
- Preserve the old account storage schema: `<chain>_current_user`, `<chain>_users`, `<chain>_node`, and existing SJCL-encrypted key payloads.
- Do not invent a new auth/key storage format unless Denis explicitly approves a migration plan.
- Keep code transparent: small functions, clear names, no speculative abstractions.

## Commands

There is no v3 build step.

Useful local commands from the repository root:

```bash
# show current changes
git status --short --branch

# JavaScript syntax checks
node --check v3/js/*.js
node --check tests/*.js

# smoke tests
for test in tests/*.js; do node "$test"; done

# static smoke server
python3 -m http.server 8080
# then open http://127.0.0.1:8080/
```

## Accessibility rules

Denis uses a screen reader. Treat accessibility as a core requirement:

- Use semantic HTML: `header`, `nav`, `main`, `section`, `form`, `label`, `button`.
- All controls must work from the keyboard.
- Prefer native controls over custom widgets.
- Put dynamic status and errors in an `aria-live` region.
- Do not communicate essential state only through color or layout.
- Keep headings meaningful and ordered.
- Use text links/buttons; avoid icon-only controls.

## Do

- Work on branch `v3` for the static migration.
- Keep required browser libraries under `v3/vendor/` and reference them from `v3/js/chains.js`.
- Add one migrated feature at a time and validate it before widening scope.
- Keep auth compatibility with the legacy localStorage scheme. v3 may perform real broadcast from explicit UI submit/confirm flows when the operation is mapped; preview/dry-run is optional and must not be a permanent blocker.
- Record assumptions and known gaps in `plan.md` or the final report.
- Use SSH remotes.

## Do not

- Do not push without Denis explicitly asking.
- Do not add runtime dependencies on removed legacy PHP files or `blockchains/` paths.
- Do not add backend-only features to the static runtime.
- Do not store secrets in the repository or chat.
- Do not introduce heavy frameworks for the first static version.
