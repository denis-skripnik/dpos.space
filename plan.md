# План миграции dpos.space в статическую HTML+JS-версию

## Scope

Сделать ветку `v3` как статическую, доступную и поддерживаемую версию dpos.space без обязательного PHP/backend runtime.

Первый deliverable:

- статический `index.html`;
- конфигурация поддерживаемых блокчейнов;
- простой hash-router;
- раздел `profiles` для read-only просмотра аккаунтов Golos, VIZ, Steem и Hive;
- прямое подключение существующих browser JS libraries из `blockchains/<chain>/js/`;
- текстовые статусы загрузки и ошибок для screen reader;
- минимальная локальная проверка без build step.

## Non-goals for first version

- Не удалять старую PHP-версию.
- Не переносить backend-зависимые рейтинги, топы, истории, witness rewards, проекты, Telegram-ботов, daemon/cron workflows.
- Не реализовывать кошельки, авторизацию и подпись операций в первом прототипе.
- Не добавлять framework, bundler или npm-зависимости.
- Не обещать полную совместимость со всеми старыми URL.

## Architecture

Static SPA:

- `index.html` loads v3 CSS and JS.
- `v3/js/chains.js` exposes `window.DposChains` with chain metadata, public nodes, and library paths.
- `v3/js/profiles.js` exposes `window.DposProfiles` with read-only account loaders/renderers.
- `v3/js/app.js` owns routing, forms, dynamic script loading, and DOM updates.
- URL state uses hash parameters: `#chain=viz&app=profiles&account=denis-skripnik`.
- The old PHP tree remains available as migration source material.

## Expected files

Created/updated during stage 1:

- `AGENTS.md`
- `plan.md`
- `index.html`
- `v3/css/style.css`
- `v3/js/chains.js`
- `v3/js/profiles.js`
- `v3/js/app.js`

## Milestones

### Milestone 1 — Static shell

- Add accessible header, navigation form, status region, and `<main>`.
- Add chain/app/account controls.
- Implement hash route parsing and writing.

### Milestone 2 — Chain configuration

- Define Golos, VIZ, Steem, Hive.
- Store chain titles, descriptions, default accounts, local library paths, and public node URLs.
- Keep one app initially: `profiles`.

### Milestone 3 — Read-only profiles

- Load the needed chain library on demand.
- Configure a public node.
- Fetch account data through direct browser API calls.
- Render balances, vesting/social capital, proxy/witness info where available, JSON metadata summary, and raw JSON details.

### Milestone 4 — Validation

- Run `git status --short --branch`.
- Run `node --check` for v3 JS files.
- Run a local static server smoke check and request `index.html`.
- If browser/API validation is unavailable or public nodes fail, report it clearly.

## Validation strategy

Minimum gate for each implementation pass:

```bash
git status --short --branch
node --check v3/js/chains.js
node --check v3/js/profiles.js
node --check v3/js/app.js
python3 -m http.server 8080
curl -I http://127.0.0.1:8080/
```

Optional stronger gate:

- Open `http://127.0.0.1:8080/#chain=viz&app=profiles&account=denis-skripnik` in Chromium.
- Check console for critical JS errors.
- Check account fetches for Golos, VIZ, Steem, Hive.

## Risks and assumptions

- Public RPC nodes can be unavailable or block browser CORS.
- Old minified chain libraries may have different APIs.
- `file://` is not the target runtime; use a static HTTP server.
- Account metadata formats differ between chains and may contain invalid JSON.
- Full wallet/auth flows need a separate security-focused plan.

## Definition of done for stage 1

- Branch `v3` exists and contains the static v3 files.
- Root `index.html` opens without PHP.
- User can select Golos/VIZ/Steem/Hive and request a profile by account name.
- The UI exposes loading/error state in text and `aria-live`.
- Existing PHP files are not destructively changed.
- Syntax/static smoke checks pass or blockers are documented.
