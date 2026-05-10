# AGENTS.md — dpos.space

## Project goal

`dpos.space` is a legacy collection of tools for DPoS blockchains. Branch `v3` migrates the useful browser-only parts to a static HTML+CSS+JS version that can run behind a simple static server, for example on `dpos.web3blind.xyz`.

## Current repository shape

Legacy PHP version stays in place for reference:

- `index.php`, `functions.php`, `template/main.php` — PHP routing and page generation.
- `blockchains/<chain>/config.json` — chain metadata.
- `blockchains/<chain>/content.html` and `blockchain-snippet.html` — legacy content fragments.
- `blockchains/<chain>/apps/<app>/` — old services; many depend on PHP, Ajax endpoints, MongoDB, daemons, or external backend projects.
- `blockchains/<chain>/js/*.min.js` — browser blockchain libraries that can be reused by v3.
- `vendor/` — Composer dependencies for the old PHP site.

Static v3 files:

- `index.html` — static SPA entry point.
- `v3/css/style.css` — v3-only styles.
- `v3/js/chains.js` — supported chains, apps, nodes, and library paths.
- `v3/js/profiles.js` — read-only profile/account data loading.
- `v3/js/app.js` — accessible router and UI wiring.
- `plan.md` — migration plan.

## Stack and constraints for v3

- Prefer plain HTML, CSS, and vanilla JavaScript.
- Do not add build tooling or npm dependencies unless there is a concrete need.
- Do not require PHP, Composer, MongoDB, cron, pm2, private tokens, or bots for v3 runtime.
- Use direct public RPC/API calls from the browser where possible.
- Keep old PHP files unless the task explicitly asks for removal.
- Keep code transparent: small functions, clear names, no speculative abstractions.

## Commands

There is no v3 build step yet.

Useful local commands from the repository root:

```bash
# show current changes
git status --short --branch

# JavaScript syntax checks
node --check v3/js/chains.js
node --check v3/js/profiles.js
node --check v3/js/app.js

# static smoke server
python3 -m http.server 8080
# then open http://127.0.0.1:8080/
```

Legacy PHP dependencies, only if old site work is needed:

```bash
composer install
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
- Reuse existing public blockchain JS libraries when they work in the browser.
- Add one migrated feature at a time and validate it before widening scope.
- Record assumptions and known gaps in `plan.md` or the final report.
- Use SSH remotes.

## Do not

- Do not push without Denis explicitly asking.
- Do not delete or rewrite the legacy PHP site as part of v3 migration.
- Do not add backend-only features to the static runtime.
- Do not store secrets in the repository or chat.
- Do not introduce heavy frameworks for the first static version.
