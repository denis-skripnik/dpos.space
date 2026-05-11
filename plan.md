# План миграции dpos.space в статическую HTML+JS-версию

## Scope

Сделать ветку `v3` как статическую, доступную и поддерживаемую версию dpos.space без обязательного PHP/backend runtime.

Текущий deliverable:

- статический `index.html`;
- конфигурация поддерживаемых блокчейнов;
- простой hash-router;
- разделы `profiles`, `accounts`, `wallet`, `history` для Golos, VIZ, Steem и Hive;
- совместимость со старым localStorage auth без миграции схемы;
- broadcast layer: decrypt/prepare, optional preview/dry-run и real broadcast по явной кнопке/confirm;
- первые рабочие переносы service routes для VIZ и Golos;
- прямое подключение vendored browser JS libraries из `v3/vendor/<chain>/`;
- текстовые статусы загрузки и ошибок для screen reader;
- минимальная локальная проверка без build step.

## Non-goals for current pass

- Не восстанавливать старую PHP-версию; v3 должна оставаться статической.
- Не переносить backend-зависимые рейтинги, топы, истории, witness rewards, проекты, Telegram-ботов, daemon/cron workflows.
- Не отправлять реальные write-транзакции автоматически в тестах или без явного UI submit/confirm.
- Не держать real broadcast за постоянным dry-run барьером: preview — только optional помощь перед отправкой.
- Не менять формат legacy localStorage аккаунтов и не мигрировать ключи в новую схему.
- Не добавлять framework, bundler или npm-зависимости.
- Не обещать полную совместимость со всеми старыми URL.

## Architecture

Static SPA:

- `index.html` loads v3 CSS and JS.
- `v3/js/chains.js` exposes `window.DposChains` with chain metadata, public nodes, symbols, and app routes.
- `v3/js/auth.js` exposes `window.DposAuth` with compatibility helpers for legacy `*_current_user` and `*_users` localStorage keys.
- `v3/js/broadcast.js` exposes `window.DposBroadcast` with legacy decrypt, authority mapping, operation prepare, optional preview and real broadcast with UI confirmation.
- `v3/js/profiles.js` exposes `window.DposProfiles` with read-only account loaders/renderers.
- `v3/js/history.js` exposes `window.DposHistory` with read-only account history normalization.
- `v3/js/app.js` owns routing, forms, dynamic script loading, DOM updates, aria-live statuses, and operation previews and real broadcast result blocks.
- URL state uses hash parameters: `#chain=viz&app=profiles&account=denis-skripnik`.
- The old PHP tree was removed from branch `v3`; required browser libraries are vendored under `v3/vendor/`.

## Legacy auth compatibility rules

- Current user key names stay unchanged: `<chain>_current_user`.
- User list key names stay unchanged: `<chain>_users`.
- Node key names stay unchanged: `<chain>_node`.
- Golos/Hive/Steem encrypted key passphrases stay unchanged:
  - `dpos.space_<chain>_<login>_postingKey`
  - `dpos.space_<chain>_<login>_activeKey`
- VIZ encrypted key passphrases stay unchanged:
  - `dpos.space_viz_<login>_regularKey`
  - `dpos.space_viz_<login>_activeKey`
- VIZ uses `regular` authority where Golos/Hive/Steem use `posting`.
- `golos.app` and `vizonator` are recognized, but v3 does not invent a new signing path for them in this pass.
- Private keys must not be shown in UI, stringified in previews, broadcast results, or logs.

### Legacy localStorage compatibility matrix verified on 2026-05-10

- Golos:
  - current user key: `golos_current_user`;
  - users key: `golos_users`;
  - node key: `golos_node`;
  - key fields: `posting`, optional `active`, optional `memo`/`memo_key`; `golos.app` records may include `type: "golos.app"` with OAuth-style key fields;
  - passphrases: `dpos.space_golos_<login>_postingKey`, `dpos.space_golos_<login>_activeKey`;
  - authority mapping: posting operations use `posting`; wallet/manage operations use `active`; requested `regular` aliases to `posting`.
- VIZ:
  - current user key: `viz_current_user`;
  - users key: `viz_users`;
  - node key: `viz_node`;
  - key fields: `regular`, optional `active`, optional `memo`/`memo_key`; Vizonator records use `type: "vizonator"`, `last_login`, `isActive`;
  - passphrases: `dpos.space_viz_<login>_regularKey`, `dpos.space_viz_<login>_activeKey`;
  - authority mapping: posting/regular operations use VIZ `regular`; wallet/manage operations use `active`.
- Hive:
  - current user key: `hive_current_user`;
  - users key: `hive_users`;
  - node key: `hive_node`;
  - key fields: `posting`, optional `active`, optional `memo`/`memo_key`;
  - passphrases: `dpos.space_hive_<login>_postingKey`, `dpos.space_hive_<login>_activeKey`;
  - authority mapping: posting operations use `posting`; wallet/manage operations use `active`; requested `regular` aliases to `posting`.
- Steem:
  - current user key: `steem_current_user`;
  - users key: `steem_users`;
  - node key: `steem_node`;
  - key fields: `posting`, optional `active`, optional `memo`/`memo_key`;
  - passphrases: `dpos.space_steem_<login>_postingKey`, `dpos.space_steem_<login>_activeKey`;
  - authority mapping: posting operations use `posting`; wallet/manage operations use `active`; requested `regular` aliases to `posting`.

Verification notes:

- Inspected `blockchains/{golos,viz,hive,steem}/js/modal-accounts.js` and `blockchain.js`: v3 keeps the same localStorage key names, same encrypted fields, and same SJCL passphrase strings.
- `v3/js/auth.js` reads and selects existing records in-place; it writes only the legacy `<chain>_current_user` shape when a saved account is selected.
- `v3/js/profiles.js` preserves `<chain>_node`: it tries the old stored node first when it belongs to the supported node list and writes back the working legacy node key.
- `tests/v3-auth-broadcast-smoke.js` verifies legacy account reading, mock SJCL decrypt with old passphrases, authority mapping, broadcast method calls, and no private-key leakage in prepared preview/result serialization.

## Phased migration after accounts/wallet/history

### Phase 2.1 — Broadcast foundation (updated in this pass)

- Add `v3/js/broadcast.js`.
- Decrypt old localStorage posting/regular/active keys using old passphrases.
- Map authorities per chain: Golos/Hive/Steem `posting`, VIZ `regular`, plus `active` for wallet/manage.
- Add `prepare` + `broadcast` wrapper with optional preview/dry-run and real broadcast when UI passes `confirmExecute`.
- Add `broadcast` app route for all chains.
- Add accessible operation preview/result/status regions.
- Real broadcast is enabled from forms; dry-run is not a required blocker anymore.

### Phase 2.2 — Chain-specific wallet forms (expanded in auth/signature pass)

- Golos: GOLOS/GBG, vesting/СГ, delegation; preview/send transfer, transfer_to_vesting, withdraw_vesting, delegate_vesting_shares, claim, transfer_to_savings, transfer_from_savings, cancel_transfer_from_savings; donate exposed in Golos service.
- VIZ: VIZ/SHARES/energy; preview/send transfer, transfer_to_vesting, withdraw_vesting, delegate_vesting_shares; award exposed in VIZ service. Savings/reward-claim remain skipped because old VIZ wallet flow uses different invite/extension-specific operations.
- Hive: HIVE/HBD/HP, savings/rewards/delegations; preview/send transfer, transfer_to_vesting, claim_reward_balance, withdraw_vesting, delegate_vesting_shares, transfer_to_savings, transfer_from_savings, cancel_transfer_from_savings.
- Steem: STEEM/SBD/SP, savings/rewards/delegations; preview/send transfer, transfer_to_vesting, claim_reward_balance, withdraw_vesting, delegate_vesting_shares, transfer_to_savings, transfer_from_savings, cancel_transfer_from_savings.
- Closed/updated on 2026-05-10: richer validations, balance auto-fill and VIZ invite-specific wallet flows moved into the completion checklist below; Golos TIP/invite balances require separate old-flow analysis outside this mandatory pass.

### Phase 2.3 — VIZ services (started)

- Routes added: `award`, `registration`, `calculator`, `manage`, `explorer`.
- Working increment: `award` preview/send operation through regular key, plus manage proxy/witness forms.
- Closed/updated on 2026-05-10:
  - registration inspected; invite real-send uses explicit service/invite signer WIF input, not legacy hardcoded literals;
  - calculator uses dynamic global properties;
  - manage includes proxy, witness vote, account metadata, VIZ invites and committee worker forms;
  - explorer supports account/block/tx where libraries expose methods.

### Phase 2.4 — Golos services (started)

- Routes added: `editor`, `calculator`, `donate`, `import`, `escrow`, `instant-view`, `manage`, `swap`, `register`, `explorer`.
- Working increments:
  - `editor` preview/send post publishing operations (`comment` + `comment_options`);
  - `donate` preview/send operation through posting key;
  - `manage` proxy/witness vote preview/send forms through active key;
  - `calculator` vesting estimation and `explorer` account/block lookup.
- Closed/updated on 2026-05-10:
  - calculator uses dynamic global properties;
  - import article uses URL/text → local draft with CORS caveat;
  - instant view has local parser/preview layer;
  - manage includes proxy, witness vote and account metadata;
  - swap exposes validated create/cancel order forms;
  - register inspected; invite real-send uses explicit service signer WIF input, not legacy hardcoded literals;
  - explorer supports account/block/tx where library methods are available.
  - Escrow remains optional/non-goal for this pass, not part of the mandatory migration list.

### Phase 2.5 — Hive/Steem parity (started in this pass)

- Routes added: `editor`, `calculator`, `manage`, `register`, `import`, `instant-view`, `swap`, `explorer` plus base wallet/accounts/history/broadcast.
- Working increments:
  - wallet transfer and transfer_to_vesting preview/send;
  - editor publish (`comment` + `comment_options`) preview/send;
  - manage proxy/witness vote preview/send;
  - calculator HP/SP vesting estimation;
  - explorer account/block lookup.
- Updated on 2026-05-10: register/account creation, import/instant-view, swap, and profile metadata forms are present; advanced witness settings remain outside this mandatory pass.
- Chain-specific fields preserved:
  - Hive `percent_hbd`;
  - Steem `percent_steem_dollars`;
  - different reward and savings fields in wallet.

### Phase 2.6 — Real broadcast hardening (closed on 2026-05-10)

- Public keys are validated against account authorities before real send where library auth helpers expose derivation.
- Per-operation human-readable summary and memo/WIF warnings are shown.
- Real forms were expanded for rewards, delegation, withdraw vesting, savings, Hive/Steem registration, import/instant-view draft, swap/market, profile update and VIZ invite/committee flows.
- Private keys stay out of UI, previews and logs; WIF-like strings are redacted in sanitized preview/result JSON.

## Expected files

Created/updated during stages 1-2:

- `AGENTS.md`
- `plan.md`
- `index.html`
- `v3/css/style.css`
- `v3/js/chains.js`
- `v3/js/auth.js`
- `v3/js/broadcast.js`
- `v3/js/profiles.js`
- `v3/js/history.js`
- `v3/js/app.js`

## Validation strategy

Minimum gate for each implementation pass:

```bash
git status --short --branch
node --check v3/js/chains.js
node --check v3/js/auth.js
node --check v3/js/broadcast.js
node --check v3/js/profiles.js
node --check v3/js/history.js
node --check v3/js/app.js
node --check tests/v3-auth-broadcast-smoke.js
node tests/v3-auth-broadcast-smoke.js
python3 -m http.server 8080
curl -I http://127.0.0.1:8080/
```

Additional checks for this phase:

- VM smoke for `DposAuth`/`DposBroadcast` decrypt/prepare helper with mocked `localStorage`, mocked `sjcl`, and mocked chain broadcast libraries.
- Browser/CDP smoke for v3 route loading if available; no automated real transaction submit.
- No real broadcast/write transaction in automated checks.

## Risks and assumptions

- Public RPC nodes can be unavailable or block browser CORS.
- Old minified chain libraries may have different APIs.
- Some Golos operations (`donate`, TIP, DEX) are chain-specific and absent on Hive/Steem.
- VIZ `regular` vs Golos/Hive/Steem `posting` authority must remain explicit.
- `file://` is not the target runtime; use a static HTTP server.
- Account metadata formats differ between chains and may contain invalid JSON.
- Full wallet/auth flows need a separate security-focused pass before expanding real broadcast to more operations.

## Definition of done for current stage

- Branch `v3` contains static v3 files.
- Root `index.html` opens without PHP.
- User can select Golos/VIZ/Steem/Hive and request profile/accounts/wallet/history.
- v3 reads old saved accounts from localStorage and can select current account without changing the old schema.
- v3 can decrypt old key records for optional preview and real broadcast where valid legacy keys exist.
- Wallet reflects chain-specific assets and capabilities.
- VIZ and Golos requested service routes exist in v3 navigation.
- At least VIZ award, Golos editor, Golos donate, Hive/Steem editor/manage/calculator/explorer, and wallet transfer/power-up/withdraw/delegation/claim/savings forms have preview/real-send UI where mapped.
- UI exposes loading/error/prepared state in text and `aria-live`.
- Existing PHP files are not destructively changed.
- Syntax/static smoke checks pass or blockers are documented.

## 2026-05-10 completion checklist for autonomous v3 migration loop

Status markers: `[x]` closed in v3, `[blocked]` objectively not safe/clear to implement in static v3 now.

- [x] Public-key authority validation before real send.
  - `v3/js/broadcast.js` now verifies decrypted WIF format, fetches the sender account, derives public key with `<chain>.auth.wifToPublic` where available, and stops real broadcast if the derived key is not present in the required account authority.
  - If a library lacks `auth.wifToPublic`, real send is limited to WIF-format + authority-presence verification and adds a warning to the prepared operation.
- [x] Human-readable operation summaries and WIF/memo warnings.
  - Operation result blocks now show a readable summary: chain, operation, authority, account, receiver, amount, request id and warnings.
  - Prepared/result JSON is sanitized; private keys are non-enumerable and result keys matching private/wif/secret are redacted.
  - Operation params are scanned for WIF-like strings and long memo/JSON warnings.
- [x] Balance auto-fill and strict validation.
  - Wallet forms have Max buttons where the loaded account exposes matching balances.
  - `validateAccountName`, `validateAsset`, and `validateRequestId` enforce account names, chain symbols/precision and non-negative integer request IDs before prepare/send.
- [x] Wallet real-send coverage.
  - Transfer, power up, withdraw vesting, delegation, rewards claim, savings transfer/from/cancel are wired to preview and real broadcast where supported by chain capabilities.
  - VIZ invite wallet flows added in manage: create invite, use invite balance, claim invite balance.
- [x] Profile update flows.
  - Golos/VIZ use `accountMetadata` through posting/regular-compatible authority.
  - Hive/Steem use `accountUpdate` through active authority with profile JSON metadata; posting_json_metadata remains library/version-dependent and is warned in UI.
- [x] Registration flows inspected and routed.
  - Hive/Steem expose real `createAccount` preview/send with explicit public key and active authority.
  - Golos invite registration exposes `accountCreateWithInvite` preview/send. v3 does **not** ship or reuse the old literal signer WIF from legacy JS; the service signer WIF is entered explicitly by the user for this operation, used only in memory, and excluded from preview/result/log.
  - VIZ invite registration exposes `inviteRegistration` preview/send. v3 does **not** ship or reuse the old literal signer WIF from legacy JS; the invite/service signer WIF is entered explicitly by the user for this operation, used only in memory, and excluded from preview/result/log.
  - Decision: old hardcoded literals are legacy evidence only, not a v3 blocker. v3 accepts signer WIF from user input where invite operation semantics require a service/invite signer; normal wallet/manage/invite-balance flows continue to use decrypted current-account active/regular keys from legacy localStorage.
- [x] Import article / instant-view.
  - Import route supports pasted text/HTML and URL fetch where CORS allows it, normalizes a readable draft, and stores it in legacy-free `localStorage` draft for the editor.
  - Editor preloads the import draft into title/body.
  - Instant View route provides local readable preview/normalization without backend.
- [x] Swap/market.
  - Golos/Hive/Steem expose `createLimitOrder` and `cancelOrder` forms with active authority, asset validation and request/order id validation.
  - [blocked] VIZ swap: no old VIZ DEX/swap flow was found under `blockchains/viz/apps`; v3 does not invent a contract/API.
- [x] VIZ invite-specific and committee wallet/manage flows.
  - Added VIZ `createInvite`, `useInviteBalance`, `claimInviteBalance`, `committeeWorkerCreateRequest`, and `committeeVoteRequest` forms based on old wallet/manage JS evidence.
  - VIZ transfer, withdraw vesting, delegation and award remain available through existing wallet/award forms.
- [x] Explorer improvements.
  - Explorer now supports account, block and tx lookup for all chains where the library exposes `getTransaction`.
- [x] Calculators.
  - Calculators use dynamic global properties: `power = vesting * total_vesting_fund / total_vesting_shares`; this is documented approximation matching the common DPoS vesting formula and avoids hardcoded backend snippets.
- [x] Verification.
  - Syntax checks passed for all v3 JS files.
  - `tests/v3-auth-broadcast-smoke.js` extended for WIF validation, authority public-key matching, validators, real method dispatch, invite registration signer-key flow, no legacy hardcoded signer literals, and sanitizer checks.
  - Static server + curl smoke passed for `/` and `v3/js/app.js`.
  - No automated real transaction was sent.

## 2026-05-10 Minter/Decimal services checklist

Status markers: `[x]` implemented in v3, `[blocked]` only where static v3 cannot safely replace legacy backend/service state without inventing missing infrastructure.

### Legacy findings

- Minter legacy auth:
  - [x] `minter_users` / `minter_current_user` store `{login, seed}` with seed encrypted as `sjcl.encrypt('dpos.space_minter_' + login + '_seed', seed)` in `blockchains/minter/js/modal-accounts.js`.
  - [x] Imported seed accounts may set `importFrom`; decrypt passphrase becomes `dpos.space_<importFrom>_<login>_seed` in `blockchains/minter/js/blockchain.js`.
  - [x] `bip.to` accounts store `{login, type:'bip.to', address}` and do not expose a local seed; v3 preserves read/display but refuses real local signing for those accounts.
- Decimal legacy auth:
  - [x] `decimal_users` / `decimal_current_user` store `{login, seed}` with seed encrypted as `sjcl.encrypt('dpos.space_decimal_' + login + '_seed', seed)` in `blockchains/decimal/js/modal-accounts.js`.
  - [x] Imported seed accounts may set `importFrom`; decrypt passphrase becomes `dpos.space_<importFrom>_<login>_seed` in `blockchains/decimal/js/blockchain.js`.
- Minter legacy services inspected:
  - [x] accounts/auth, wallet balances/transfer/history, explorer account/tx/block, validators, delegation/unbond, swap/sell/swap-pool, token create/mint/burn, random blockchain, LONG service pages.
- Decimal legacy services inspected:
  - [x] accounts/auth, wallet balances/transfer/history, explorer account/tx/block, validators, delegation/unbond, token creation, NFT delegate/unbond, conversion/swap.

### v3 implementation

- [x] Added `minter` and `decimal` to `v3/js/chains.js` navigation/routes/apps. Cyber and EVM were not added.
- [x] Extended `v3/js/auth.js` for legacy seed compatibility and imported-seed passphrases for Minter/Decimal.
- [x] Extended `v3/js/broadcast.js` for non-Golos-like `seed` authority, address/coin/amount validation, Minter SDK tx dispatch, Decimal SDK dispatch, seed/mnemonic sanitizing, and no-key-leak preview/result handling.
- [x] Extended `v3/js/profiles.js` and `v3/js/history.js` for REST-style Minter/Decimal account balances and history.
- [x] Added accessible v3 UI forms in `v3/js/app.js` for:
  - accounts/auth selection via existing Accounts route;
  - wallet transfer;
  - Minter delegate/unbond;
  - Minter swap/sell and route preview;
  - Minter token create/mint/burn;
  - Decimal delegate/unbond;
  - Decimal create token;
  - Decimal NFT delegate/unbond;
  - validators read-only list;
  - explorer address/tx/block;
  - calculator amount helper.
- [x] Real broadcast is reachable only from explicit “send” buttons plus browser confirm. Preview/dry-run remains optional.
- [x] Private keys/seeds are non-enumerable prepared secrets and redacted as `private|wif|secret|seed|mnemonic` plus WIF/mnemonic value scanning.
- [blocked] Full static LONG backend/service migration. Evidence: legacy LONG reads server/backend state directly in PHP/JS: `blockchains/minter/apps/long/content.php:4` fetches `http://178.20.43.121:3852/smartfarm`; `blockchains/minter/apps/long/pages/bids/content.php:5` fetches `http://178.20.43.121:3852/smartfarm/bids`; `blockchains/minter/apps/long/pages/deferred-txs/content.php:2` fetches `http://178.20.43.121:3852/smartfarm/deferred-txs`; `blockchains/minter/apps/long/js/app.js:210` depends on legacy `blockchains/minter/apps/long/api.php/provider`. v3 exposes compatible wallet/send memo building and keeps LONG route as a documented backend-dependent service instead of inventing a replacement backend.

### Validation for Minter/Decimal pass

- [x] `node --check v3/js/*.js`
- [x] `node --check tests/v3-auth-broadcast-smoke.js`
- [x] `node --check tests/v3-minter-decimal-smoke.js`
- [x] `node tests/v3-auth-broadcast-smoke.js`
- [x] `node tests/v3-minter-decimal-smoke.js`
- [x] Static server + curl smoke for `/` and `/v3/js/app.js`.
- [x] No automated real transactions.
- [x] No commit/push.

## 2026-05-10 profile parity expansion checklist

Legacy profile inventory inspected for this pass:

- `blockchains/viz/apps/profiles/{content.php,index.php,page/userinfo.php,page/delegat.php,page/witness.php,page/delegations.php,page/awards.php,page/shares.php,page/accounts.php,page/subscriptions.php,page/dao.php}` and `blockchains/viz/apps/profiles/js/app.js`.
- `blockchains/golos/apps/profiles/{content.php,index.php,page/userinfo.php,page/delegat.php,page/witness.php,page/delegations.php,page/gp.php,page/feed.php,page/accounts.php}` and `blockchains/golos/apps/profiles/js/app.js`.
- `blockchains/steem/apps/profiles/{content.php,index.php,page/userinfo.php,page/delegat.php,page/witness.php,page/delegations.php,page/sp.php,page/feed.php,page/accounts.php}` and `blockchains/steem/apps/profiles/js/app.js`.
- `blockchains/hive/apps/profiles/{content.php,index.php,page/userinfo.php,page/delegat.php,page/witness.php,page/delegations.php,page/hp.php,page/feed.php,page/accounts.php}` and `blockchains/hive/apps/profiles/js/app.js`.
- `blockchains/minter/apps/profiles/{content.php,index.php,page/content.php,page/js/app.js}`.
- `blockchains/decimal/apps/profiles/{content.php,index.php,page/content.php,page/js/app.js}`.

Checklist by chain:

- VIZ legacy showed: economy table with current energy, social capital, delegated/received SHARES, withdraw rate/next withdrawal, bandwidth, min award hints, balance, witness vote count/list; profile metadata with nickname/about/location/birthday/interests/services/profile image/site; account stats with created, last update, recovery/registrar, last award, `custom_sequence`, `custom_sequence_block_num`; witness/proxy/DAO pages as separate legacy modals/pages.
  - v3 now shows statically available account/API fields: VIZ balance, SHARES, delegated/received, calculated current energy, raw energy, computed own/received/delegated/effective social capital when dynamic props are available, withdraw rate/next withdrawal, average bandwidth, witness votes/count/proxy/proxied votes, regular/active/owner/memo public authority data, nickname/about/location/site/birthday/interests/services/profile image/cover image, created/last update/last vote/recovery/custom sequence/block, raw metadata and raw account JSON.
  - Not ported as exact legacy computed hints: award amount/min-energy/bandwidth human formula and modal histories need reward fund/config/history calculations and were left as raw/available fields rather than guessed.
- Golos legacy showed: current battery, СГ converted from VESTS, delegated/received/emission delegation, rewards forecast, balances/savings/TIP/UIA, witness votes, profile metadata/socials/image/website, follow count, reputation, post count, last post/vote, recovery, frozen status.
  - v3 now shows balances, savings, rewards, TIP, raw VESTS, current battery, computed СГ when dynamic props are available, delegated/received/emission fields, frozen, witness/proxy data, authorities/public keys, metadata/socials/image/website, follow count when library API exposes it, raw reputation/post/activity/recovery fields, raw JSON.
  - UIA balances and exact reward forecast are not reliably available through the current static JS library path without old backend helpers; omitted rather than faked.
- Steem/Hive legacy showed: battery, SP/HP conversion, delegated/received, savings, reward balances, witness votes/proxy, profile/socials/image/website, reputation/follow counts/post stats/activity/recovery.
  - v3 now shows balances/savings/rewards, current battery, computed SP/HP when dynamic props are available, delegated/received/effective power, witness/proxy data, authorities/public keys, metadata/socials/image/website, reputation/post/activity/recovery and raw account JSON.
  - Exact payout forecast/follow modals are best-effort only because public library support differs by node.
- Minter legacy showed: balances, HUB on Ethereum/BSC, yesterday delegation rewards, nonce, transaction history.
  - v3 now fetches address details, balances, optional delegations, optional first transaction page and optional yesterday rewards from public explorer API; it renders address/nonce/rest details, balances and raw details in accessible `<details>` sections.
  - Cross-chain HUB balances via Etherscan/BscScan are not ported because the legacy endpoints are external explorer APIs and may require keys/rate-limit handling.
- Decimal legacy showed: balances, rewards calculator/history, nonce, transaction history and NFT transaction types.
  - v3 now fetches optional address/balances/transactions/rewards/NFT endpoints and renders nonce/address/rest details, balances, rewards/NFT/transaction raw lists and raw API JSON.
  - Exact client-side rewards calculator remains omitted because endpoint availability/order differs; v3 exposes rewards data when API returns it.

Definition of done for this profile pass:

- [x] No Cyber/EVM added to v3.
- [x] Legacy PHP/JS kept intact.
- [x] v3 profile renderer uses summary card plus accessible details/summary sections.
- [x] VIZ profile includes the previously missing static fields: energy, social capital/SHARES, regular authority, witness/proxy data, custom sequence/block, profile services/birthday/interests, activity/recovery and raw metadata/account.
- [x] Golos/Steem/Hive profile rendering keeps balances working and adds governance, authorities, metadata and activity sections.
- [x] Minter/Decimal profile rendering includes available REST balances/details and optional delegation/reward/NFT/transaction raw lists.
- [x] Syntax and smoke checks added/updated in `tests/v3-profiles-smoke.js`.

## 2026-05-10 non-profile legacy service parity audit

Legacy inventory for this audit:

- Golos apps inspected: `activities`, `api`, `backup`, `calc`, `donate`, `escrow`, `explorer`, `help`, `import`, `instant-view`, `manage`, `polls`, `post`, `randomblockchain`, `referrers`, `registration`, `stakebot`, `swap`, `top`, `wallet`, `witnesses-rewards`.
- VIZ apps inspected: `analytics`, `awards`, `calc`, `custom-generator`, `exchanges`, `explorer`, `help`, `manage`, `polls`, `projects`, `randomblockchain`, `registration`, `search`, `top`, `vmp`, `voice-import`, `wallet`, `witnesses-rewards`.
- Steem apps inspected: `backup`, `calc`, `explorer`, `help`, `manage`, `post`, `randomblockchain`, `swap`, `wallet`.
- Hive apps inspected: `backup`, `calc`, `manage`, `post`, `randomblockchain`, `swap`, `wallet`.
- Minter apps inspected: `broadcast`, `explorer`, `help`, `long`, `my-coin`, `randomblockchain`, `swap`, `validators`, `wallet`.
- Decimal apps inspected: `explorer`, `profiles`, `randomblockchain`, `validators`, `wallet`.

Checklist:

- [x] Accounts/auth/localStorage compatibility remains legacy-compatible for Golos/VIZ/Steem/Hive plus Minter/Decimal seed accounts.
- [x] Wallet transfer, vesting, rewards, savings, delegation/unbond and Minter/Decimal transfer/staking/token/NFT forms are exposed with preview and explicit real send.
- [x] History/explorer routes cover account/history filtering plus account/block/tx or address/block/tx lookups where public API/library supports it.
- [x] Broadcast/signing keeps legacy key/passphrase compatibility, requires explicit send confirm, and sanitizes WIF/private/seed/mnemonic values from preview/result.
- [x] Editor/post publishing supports Golos/Steem/Hive comment + comment_options with import-draft preload.
- [x] Donate/award supports Golos donate and VIZ award real broadcast paths.
- [x] Manage/governance now includes proxy, witness vote, witness settings/update, profile metadata update, VIZ invite/committee flows, and authority/access update from explicit owner WIF in memory only.
- [x] Registration now includes Golos/VIZ invite registration without legacy hardcoded signer WIF, Hive/Steem createAccount, and Golos accountCreateWithDelegation using explicit public keys instead of generated/displayed private keys.
- [x] Calculator routes use dynamic vesting properties or static amount helpers instead of old PHP snippets.
- [x] Import article and instant-view are implemented as static URL/text normalizers with local draft handoff to editor.
- [x] Swap/market covers Golos/Hive/Steem create/cancel limit orders and Minter sell/swap-pool forms.
- [x] VIZ `exchanges` is carried over as the original static informational links page; no transaction flow was present in legacy.
- [x] Cyber and EVM are still not exposed in `v3/js/chains.js`.
- [blocked] Full Minter LONG service migration remains backend-dependent. Evidence: `blockchains/minter/apps/long/content.php:4` fetches `http://178.20.43.121:3852/smartfarm`; `blockchains/minter/apps/long/pages/bids/content.php:5` fetches `http://178.20.43.121:3852/smartfarm/bids`; `blockchains/minter/apps/long/js/app.js:210` depends on legacy `blockchains/minter/apps/long/api.php/provider`.
- [blocked] VIZ on-chain swap/DEX operation is not implemented because legacy `blockchains/viz/apps/exchanges` is only a static external-links page (`content.php` links to `swap.viz.world`, RuDEX instructions and a Minter gateway article), not a local broadcast/API flow.

Additional implementation in this pass:

- `v3/js/app.js` adds manage witness update, authority/access update, Golos account creation with delegation, and VIZ exchanges rendering.
- `v3/js/chains.js` adds VIZ `exchanges` route and keeps only Golos/VIZ/Steem/Hive/Minter/Decimal enabled.
- `tests/v3-route-coverage-smoke.js` asserts the newly required manage/registration parity hooks and owner-WIF-in-memory warning.

### 2026-05-10 profile/history transaction table fix

- [x] Replaced profile `Последние транзакции из API` mixed string list with accessible HTML transaction tables.
- [x] Reused the same structured renderer for DPoS History routes, replacing the old one-cell mixed `key: value; ...` display.
- [x] Tables include captions, scoped column headers, clear columns for date, operation, sender, recipient/validator, amount, memo/details, block and tx.
- [x] Added in-app explorer links for tx/block values and profile links for account/address-like sender/recipient values where possible.
- [x] Minter/Decimal profile REST transactions now stay structured in `DposProfiles.normalizeAccount` instead of being pre-stringified.
- [x] `DposHistory.normalizeHistory` / REST history normalization now preserve block/height fields for explorer linking.
- [x] Tests updated to assert structured REST transactions and accessible/linking hooks in the shared renderer.

## Service parity audit legacy → v3 — 2026-05-10 retry

### Audit method

- Synced local `v3` with `origin/v3` using `git pull --ff-only origin v3`; branch was already current at `56a5f91` before this pass.
- Built legacy inventory with `find blockchains/{golos,viz,steem,hive,minter,decimal} -type f` for JS/PHP/HTML/JSON/CSS; 804 legacy files were enumerated.
- Inspected service entrypoints/config/content/scripts for each scoped chain under `blockchains/<chain>/apps/*`, plus chain-level `js/blockchain.js`, `js/modal-accounts.js`, SDK/browser library references, localStorage key usage, API calls, and broadcast calls.
- Built v3 inventory from `v3/js/chains.js`, `v3/js/app.js`, `v3/js/profiles.js`, `v3/js/history.js`, `v3/js/broadcast.js`, `v3/js/auth.js`, and all `tests/*.js`.
- Focused static parity on user-visible labels/fields/forms/history operation explanations/auth compatibility; real broadcast is verified only by mocks/dry paths, never by real tx in automated tests.

### Legacy files inspected by chain/service family

- Golos: `activities`, `api`, `backup`, `calc`, `donate`, `escrow`, `explorer`, `help`, `import`, `instant-view`, `manage`, `polls`, `post`, `profiles`, `randomblockchain`, `referrers`, `registration`, `stakebot`, `swap`, `top`, `wallet`, `witnesses-rewards`; key files include `blockchains/golos/apps/{profiles,wallet,post,donate,manage,registration,explorer,calc,import,instant-view,swap}/**/*.{php,js,json}` and `blockchains/golos/js/{blockchain.js,modal-accounts.js,golos.min.js}`.
- VIZ: `analytics`, `awards`, `calc`, `custom-generator`, `exchanges`, `explorer`, `help`, `manage`, `polls`, `profiles`, `projects`, `randomblockchain`, `registration`, `search`, `top`, `vmp`, `voice-import`, `wallet`, `witnesses-rewards`; key files include `blockchains/viz/apps/{profiles,wallet,awards,manage,registration,explorer,calc,exchanges}/**/*.{php,js,json}` and `blockchains/viz/js/{blockchain.js,modal-accounts.js,viz.min.js}`.
- Steem: `backup`, `calc`, `explorer`, `help`, `manage`, `post`, `profiles`, `randomblockchain`, `swap`, `wallet`; key files include `blockchains/steem/apps/{profiles,wallet,post,manage,explorer,calc,swap}/**/*.{php,js,json}` and `blockchains/steem/js/{blockchain.js,modal-accounts.js,steem.min.js}`.
- Hive: `backup`, `calc`, `manage`, `post`, `profiles`, `randomblockchain`, `swap`, `wallet`; key files include `blockchains/hive/apps/{profiles,wallet,post,manage,calc,swap}/**/*.{php,js,json}` and `blockchains/hive/js/{blockchain.js,modal-accounts.js,hive.min.js}`.
- Minter: `broadcast`, `explorer`, `help`, `long`, `my-coin`, `profiles`, `randomblockchain`, `swap`, `validators`, `wallet`; key files include `blockchains/minter/apps/{profiles,wallet,validators,my-coin,swap,broadcast,explorer,randomblockchain,long}/**/*.{php,js,json}` and `blockchains/minter/js/{blockchain.js,modal-accounts.js,minterjs-sdk.min.js,minterjs-wallet.min.js}`.
- Decimal: `explorer`, `profiles`, `randomblockchain`, `validators`, `wallet`; key files include `blockchains/decimal/apps/{profiles,wallet,validators,explorer,randomblockchain}/**/*.{php,js,json}` and `blockchains/decimal/js/{blockchain.js,modal-accounts.js,decimal-sdk-web.js}`.

### Parity matrix

| Chain/service | Legacy behavior/fields/labels | v3 current behavior before fixes | Status | Exact fix plan/result |
| --- | --- | --- | --- | --- |
| All chains / accounts-auth | Legacy uses `<chain>_current_user`, `<chain>_users`, `<chain>_node`; Golos/Hive/Steem posting+active, VIZ regular+active, Minter/Decimal seed-style users. | `auth.js` keeps legacy keys/passphrases and does not migrate schema. | [x] | Existing tests cover decrypt/select/sanitization. No change. |
| Golos/VIZ/Steem/Hive profiles | Legacy profile pages are chain-specific, with balances, vesting/power, governance, authorities, activity, metadata/socials. | v3 exposes chain-specific balance/economy/authority labels; not over-universalized for VIZ regular/energy and social power naming. | [x] | No code change required. |
| Minter/Decimal profiles | Legacy REST profile/wallet screens show the address once in address/REST context; repeated address as display name/profile field is noisy. | v3 repeated REST address as page title, summary display name, profile metadata row, and REST row. | [fix] | Removed REST address from profile metadata rows, deduplicated REST rows, and suppress summary display-name row when it is identical to REST account address. |
| Golos/VIZ/Steem/Hive wallet/history | Legacy shows readable operation names for social-chain ops and wallet forms for transfer/vesting/delegation/claim/savings where supported. | v3 has readable social op names, wallet forms, dry preview and confirm-based real broadcast; no real tx in tests. | [x] | No change beyond preserving tests. |
| Minter history | Legacy `blockchains/minter/apps/wallet/js/app.js:getHistory` maps numeric tx type ids 1–39 to readable Russian labels; specifically `13` = `Мультисенд (мульти-отправка)`, plus pool/token/limit-order/stake-lock types. | v3 normalized REST transactions but `operationTitle(13)` returned raw `13`, so tables showed bare ids. | [fix] | Added Minter 1–39 numeric tx type mapping, numeric string and hex `0x0D` fallback in `history.operationTitle`, and focused test for type `13`. |
| Decimal history | Legacy `blockchains/decimal/apps/wallet/js/app.js:getHistory` maps old snake/uppercase types, NFT ops, governance proposal/vote, and OpenAPI paths like `/decimal.coin.v1.MsgSendCoin`. | v3 had only generic/social op labels; Decimal OpenAPI/NFT labels could appear raw. | [fix] | Added Decimal snake/OpenAPI/NFT/governance labels to `history.operationTitle` and focused tests. |
| Minter/Decimal wallet validators/delegation/unbond/token/NFT/swap | Legacy has rich SDK/API forms; v3 has static forms where SDK supports browser-side prepare/broadcast, and REST read-only validators/explorer. | v3 supports Minter/Decimal seed broadcast mocks and forms without leaking seed; no Cyber/EVM added. | [x] | Kept scope; labels fixed in shared history rendering. |
| Broadcast/signing | Legacy signs with old browser libraries and localStorage keys/seeds. | v3 uses legacy decrypt, preview/sanitize, confirm before real broadcast. | [x] | Existing mocks verify no WIF/seed leaks. |
| Editor/posting, donate/award, manage/governance, registration/invite | Legacy chain-specific apps exist for social chains. | v3 routes/forms exist for scoped social-chain features; unsupported backend-heavy parts are shown explicitly rather than silently pretending parity. | [x] | No true blocker for requested regressions; no Cyber/EVM added. |
| Explorer/calculator/import/instant-view/swap/market | Legacy has mixed static+backend pages. | v3 exposes available static/read-only/helper routes and clear unsupported messages for backend-dependent flows. | [x] | No change needed for current regressions. |
| Decimal history endpoint/shape | Legacy profile/history uses `/txs/txs-by-address/{address}?limit&offset` and Decimal APIs may return `{result:{txs}}`, `{Result:{Txs}}`, `{txs}`, or bare result arrays. | v3 history used `/addresses/{address}/txs` and only a narrow `txs/result` unwrap. | [x] | Implemented `txs-by-address` URL with limit/offset in `history.fetchAccountHistory`, added `unwrapRestHistory`/`normalizeRestHistory` shape normalization, and mocked-fetch URL/shape tests. |
| Minter/Decimal 18-decimal display | Legacy REST screens display human BIP/DEL amounts; REST/explorer may return 10^18 minimal-unit integer strings. | v3 rendered integer strings verbatim in history/profile/explorer fields. | [x] | Added safe 18-decimal formatter for value/amount/stake/liquidity-like fields, applied it to history/explorer/profile balance/readable paths, and tested `1000000000000000000 -> 1` while preserving `1.5`. |
| Minter explorer operation values | Legacy explorer/wallet views show human-readable operation amounts first and raw JSON as secondary details. | v3 primary operation fields could show minimal-unit values while raw JSON was available. | [x] | `formatExplorerValue` and transaction table display now convert Minter amount/value/stake-like minimal-unit fields before the raw JSON details. |
| Decimal validator id validation | Legacy/API flows may use operator validator ids/raw validator addresses, not only dx/0x account addresses. | v3 delegate/unbond path reused account address validation for Decimal validators. | [x] | Added `validateDecimalValidator`, switched Decimal delegate/unbond and NFT stake validation to that helper, kept normal account send on `validateAddress`, and added tests for realistic non-dx validator id acceptance plus dx/0x send validation. |
| Minter broadcast route separation | Legacy Minter broadcast is a separate raw signed TX/multisig app; it must not collapse into seed wallet send/delegate forms. | v3 routed `chain=minter&app=broadcast` through generic Cosmos wallet forms. | [blocked] | Added dedicated `renderMinterBroadcast` route with Raw signed TX and Multisig controls plus explicit pending/blocked messaging. Real raw signed TX/multisig send remains disabled because the bundled static browser SDK has no verified arbitrary `postSigned/decode`/multisig method mapping; no fake send was added. |

### Completion checklist for this pass

- [x] Minter tx type id mapping/readable labels restored from legacy `wallet/js/app.js`.
- [x] Decimal readable operation labels restored from legacy `wallet/js/app.js`.
- [x] REST profile duplicate address rows reduced.
- [x] Tests updated for Minter operation label mapping and profile duplicate-field prevention.
- [x] No legacy PHP/JS deleted.
- [x] No Cyber/EVM route added to v3.
- [x] No real transaction performed in automated checks.
- [x] Focused Decimal history endpoint/shape parity implemented.
- [x] Focused Minter/Decimal 18-decimal readable display implemented for primary fields.
- [x] Decimal validator id validation relaxed for validator fields while account send remains strict.
- [x] Minter broadcast route separated from generic wallet.
- [x] No real transaction performed in automated checks.
- [ ] `[blocked]` remains only for real Minter raw signed TX/multisig sending until exact static SDK methods are verified; UI states this explicitly and does not fake send.

## 2026-05-10 UX/usability pass checklist

Критерий: v3 должен быть не только технически рабочим, но и понятным человеку и screen reader. Старый сайт используем как UX-референс там, где он давал более читаемые страницы вместо raw JSON.

Проверить и исправить в этом pass:

- [x] Первые экраны routes: понятный `h2`, короткое объяснение назначения, действие по умолчанию и пустое состояние без «пустого div».
- [x] Explorer account/block/tx: primary view — человекочитаемые поля, ссылки на account/block/tx, таблицы операций; raw JSON только во вторичном `<details>`.
- [x] Transaction/detail screens: показывать блок, дату/тип/отправителя/комиссию где API отдаёт эти поля; операции/данные показывать таблицей или списком, а не первичным JSON dump.
- [x] Broadcast forms: перед реальной отправкой visible summary должен быть выше технического payload; raw prepared/result JSON — только secondary details.
- [x] Поля форм: заменить непонятные универсальные подписи вроде «Тип/Значение» там, где можно дать контекст (`Что открыть`, `Аккаунт / блок / tx`).
- [x] Empty/error states: не оставлять пустую область результата; писать, что ввести или почему данных нет.
- [x] Tables vs JSON dumps: таблицы с `caption` и `scope="col"` для списков; JSON — только для отладки/проверки.
- [x] Повторяющиеся/сырые поля: не дублировать одно и то же в primary sections; технические поля переносить в details.
- [x] Порядок секций: сначала summary/actionable info, затем списки/таблицы, затем raw/debug details.
- [x] Проверки: добавить static smoke, который ловит возврат primary raw JSON в explorer/broadcast и наличие осмысленных labels/headings для core routes.


## 2026-05-10 full legacy parity matrix pass — committed scope

Audit method: pulled `origin/v3`, verified branch `v3`, re-inspected legacy app dirs/configs for `blockchains/{golos,viz,steem,hive,minter,decimal}` and compared them against `v3/js/chains.js` route inventory plus route handlers in `v3/js/app.js`.

| Chain/app | Legacy behavior/evidence | v3 before this pass | Gap | Status/fix/test |
| --- | --- | --- | --- | --- |
| Minter / broadcast | `blockchains/minter/apps/broadcast/content.php` exposes raw signed TX submit and multisig submit; `blockchains/minter/apps/broadcast/js/app.js` calls `decodeTx`, `postSignedTx`, `getNonce`, `postTx` with `signatureType=2`. | `chain=minter&app=broadcast` was a disabled/pending panel and earlier routing could collapse cosmos service apps into wallet-like forms. | Raw signed TX and multisig submit missing. | [x] Added separate `renderMinterBroadcast`, `DposBroadcast.prepareExternal`, `minterSignedTx`, `minterMultisigSubmit`; tests cover no-seed raw signed post and multisig signatures. |
| Minter / swap liquidity | `blockchains/minter/js/blockchain.js:184-223` implements `ADD_LIQUIDITY`, `REMOVE_LIQUIDITY`, `CREATE_SWAP_POOL`; `blockchains/minter/apps/swap/js/app.js` wires swap/pool UI. | v3 had sell/sell_swap_pool only. | Liquidity/create pool missing. | [x] Added `minter-liquidity-form` with add/remove/create pool payloads and route/source tests. |
| Minter / hub withdraw | `blockchains/minter/apps/wallet/js/app.js:602-618` sends to hub address `Mx68f4839d7f32831b9234f9575f3b95e1afe21a56` with memo `{recipient,type:'send_to_<chain>',fee}`. | v3 wallet had no hub withdraw. | Withdraw flow missing. | [x] Added static hub withdraw form preserving transaction shape; external fee/template auto-fetch intentionally not required for static send path. |
| Minter / my-coin | `blockchains/minter/js/blockchain.js:286-319` supports `CREATE_COIN`, `RECREATE_COIN`, token create/recreate, mint/burn, `EDIT_COIN_OWNER`. | v3 had only create token/mint/burn. | Create/recreate coin/token and edit owner missing. | [x] Expanded `minter-coin-form` payloads for coin/token create/recreate and edit owner; route tests assert identifiers. |
| Decimal / swap-convert | `blockchains/decimal/js/blockchain.js:210-319` implements `sellExactTokensForDEL`, `buyTokenForExactDEL`, `convertToken` when SDK exposes them; wallet JS calls `convert(...)`. | v3 had create token/NFT stake only. | Convert/swap missing. | [x] Added `decimal-convert-form` and `decimalConvert` SDK dispatcher; tests cover DEL→token mock dispatch. |
| Decimal / history endpoint | Legacy Decimal profile uses `/txs/txs-by-address`; previous history variants used address tx endpoint. | v3 needed aligned response unwrapping for `Result.Txs`/`result.txs`. | Endpoint/shape mismatch. | [x] `fetchAccountHistory` uses `/txs/txs-by-address/{address}?limit&offset`; `normalizeRestHistory` unwraps multiple shapes and message `@type`; tests cover URL and shape. |
| Decimal / validator id | Validators API can return operator ids that are not account `dx/0x` addresses. | Address-only validation risked blocking valid validator ids. | Over-strict validation. | [x] Added/used `validateDecimalValidator`; tests prove validator id accepted while account address validation remains strict. |
| Minter/Decimal / readable amounts | REST APIs often return 18-decimal minimal units. | Tables/explorer could display raw `1000000000000000000`. | Poor readable output. | [x] `history.formatMinimalUnits`/`formatChainAmount` and app rendering use readable amounts where key/chain indicate minimal units; tests cover formatting. |
| Graphene apps (Golos/VIZ/Steem/Hive) | Legacy includes profiles, wallet, history, editor/post, manage, registration, calc, explorer, swap/import/static helpers and several backend-heavy top/activity/search pages. | v3 already had static-safe forms/read-only routes and explicit placeholders for backend-heavy pages. | No new confirmed static gap in requested set after re-audit. | [x] Preserved existing coverage and route tests; did not add Cyber/EVM. |
| Minter LONG/backend services | `blockchains/minter/apps/long/content.php:4` and pages fetch `http://178.20.43.121:3852/smartfarm`; `blockchains/minter/apps/long/js/app.js:210` depends on legacy `api.php/provider`. | v3 has documented LONG external/backend-dependent route. | Backend runtime/state cannot be replaced by static HTML+JS without inventing a service. | [blocked] Evidence above; not part of static parity implementation. |
| VIZ exchanges/swap | `blockchains/viz/apps/exchanges/content.php` is static links to external swap/RuDEX/gateway docs, not a local broadcast flow. | v3 renders static exchanges info. | No local on-chain swap API to port. | [blocked] Static informational parity only; no local tx flow exists in legacy. |

Validation additions in this pass:

- `tests/v3-minter-decimal-smoke.js`: raw signed TX, multisig submit, Decimal convert, validator ids, Decimal txs-by-address response shape, amount formatting.
- `tests/v3-route-coverage-smoke.js`: separate Minter broadcast route and new Minter/Decimal controls.


## Legacy cleanup pass — 2026-05-10

Scope: remove old v2/PHP runtime files from branch `v3` without breaking the static v3 app.

Preserved for runtime:

- `index.html`;
- `v3/js`, `v3/css`;
- required browser libraries copied into `v3/vendor/<chain>/`;
- `tests`, `README.md`, `favicon.ico`, `LICENSE`, `AGENTS.md`, `plan.md`.

Removed as legacy/non-runtime for v3:

- old `blockchains/` app/content trees after vendoring required JS libraries;
- PHP/backend folders and files: `api/`, `vendor/`, `template/`, `json/`, `viz-manual/`, root PHP/config/content/menu/composer files;
- stale maintenance and old SEO artifacts tied to legacy routes.

Validation expectation: v3 runtime source must not reference `blockchains/` paths; `tests/v3-route-coverage-smoke.js` enforces vendored `v3/vendor/` paths.

## 2026-05-10 account/login parity and QA pass

Scope for this pass:

- Restore the critical old-flow parity gap in `Аккаунты`: adding/logging into accounts, not only selecting existing localStorage records.
- Keep v3 static-only: no PHP/backend runtime, no new frameworks/dependencies.
- Keep old localStorage key names and `dpos.space_...` SJCL passphrases unchanged.
- Do not expose private keys/WIF/seed in reports, logs, previews, or UI after save; generated seed UI shows seed/address guidance only, not private key.

Old version evidence inspected:

- `blockchains/{golos,viz,hive,steem}/js/modal-accounts.js`: login + posting/regular WIF + optional active WIF, authority public-key check, legacy `*_users`/`*_current_user` writes.
- `blockchains/{minter,decimal}/js/modal-accounts.js`: login/address + seed, mnemonic validation, same `*_users`/`*_current_user` writes, import of seed accounts from another dpos.space chain with `importFrom`; the login field is display-only and may be arbitrary (for example `testwallet`/`main`), while wallet/profile runtime address is derived from the saved seed.
- `blockchains/{minter,decimal}/js/blockchain.js`: decrypts imported seed with `dpos.space_<sourceChain>_<login>_seed`.
- Browser `/chro` old-site smoke: Golos profile page exposes `Добавить аккаунт` with login/posting/active fields; Decimal wallet exposes manual seed login plus import and create account sections; Minter profile and Decimal wallet routes load legacy service content.

Implemented in v3:

- `v3/js/auth.js`: added legacy-compatible account writers/removers, current-user writer, key/seed user creation, seed-chain scanner, duplicate protection, imported-seed source-chain handling.
- `v3/js/app.js`: `Аккаунты` now shows saved users, current user, switch, confirm-delete, add key-account forms for Golos/VIZ/Steem/Hive, add seed-account forms for Minter/Decimal, local seed generation, cross-chain seed import, and seed-derived Minter/Decimal address resolution for wallet/profile routes so display names are not treated as chain addresses.
- `v3/css/style.css`: secondary button style for safe delete/generate controls.
- `tests/v3-accounts-auth-smoke.js`: verifies legacy passphrases for posting/regular/active/seed, duplicate prevention, seed import source-chain decrypt, removal/current-user behavior.
- `tests/v3-ux-smoke.js`: guards local-secret warning and prevents generated-account private-key rendering.
- LONG load hardening: fetch timeout and explicit loading panels so an unavailable LONG backend does not leave stale route content indefinitely.

Validation checklist for this pass:

- `node --check v3/js/*.js`.
- `node --check tests/*.js`.
- all `tests/*.js`.
- `git diff --check`.
- Static HTTP curl checks for `/`, `/favicon.ico`, `/v3/js/app.js`, `/v3/js/auth.js`, `/v3/js/chains.js`, `/v3/css/style.css`, `/v3/vendor/golos/golos.min.js`.
- `/chro` local v3 smoke for accounts on Golos/VIZ/Minter/Decimal and representative profile/wallet/history/explorer/write routes.

Known intentional differences / blockers:

- v3 still does not recreate old PHP/backend-only pages and cron/data flows.
- OAuth/Vizonator/BIP wallet link flows are recognized as existing account types, but v3 does not invent new OAuth/extension signing paths in this static pass.
- LONG depends on `backend.dpos.space`; if it hangs, v3 now times out with a clear error instead of hanging forever.

## 2026-05-10 exhaustive public click-through parity audit
Audit method: `/chro` local Chromium/CDP opened rendered pages for every app id from `window.DposChains` on public v3 `https://dpos.blinddev.xyz/#chain=...&app=...` and the inferred legacy public route on `https://dpos.space/...` where one exists. No private keys were entered and no transaction submit/confirm path was executed. Raw CDP extraction captured title, headings, body text, forms, buttons, and text samples for each route in `/tmp/dpos_v3_click_audit.json` during the run.
Summary: 74/74 v3 routes were opened in browser/CDP. Initial public run found 2 safe v3 gaps: Minter profile defaulted to an invalid zero address; Decimal validators could hang/fall into the generic route error when the public API/CORS failed. Both were fixed, pushed, deployed, and re-tested on public v3 with Chromium/CDP cache disabled.
| Chain/app | Old live URL/status | New live URL/status | Result |
| --- | --- | --- | --- |
| golos/profiles (Профили) | https://dpos.space/golos/profiles — opened | https://dpos.blinddev.xyz/#chain=golos&app=profiles — opened in public CDP click-through | OK |
| golos/accounts (Аккаунты) | https://dpos.space/golos/profiles — opened, equivalent account widget | https://dpos.blinddev.xyz/#chain=golos&app=accounts — opened in public CDP click-through | minor copy difference: dedicated v3 login/add page vs old modal/widget |
| golos/wallet (Кошелёк) | https://dpos.space/golos/wallet — opened | https://dpos.blinddev.xyz/#chain=golos&app=wallet — opened in public CDP click-through | OK |
| golos/history (История) | https://dpos.space/golos/wallet — opened, old wallet/history equivalent | https://dpos.blinddev.xyz/#chain=golos&app=history — opened in public CDP click-through | minor copy difference: dedicated v3 history vs old wallet-integrated history |
| golos/broadcast (Отправка) | — — no old standalone route | https://dpos.blinddev.xyz/#chain=golos&app=broadcast — opened in public CDP click-through | blocked/intentional: old standalone service absent; v3 route still opened |
| golos/editor (Редактор) | https://dpos.space/golos/post — opened | https://dpos.blinddev.xyz/#chain=golos&app=editor — opened in public CDP click-through | OK |
| golos/calculator (Калькулятор) | https://dpos.space/golos/calc — opened | https://dpos.blinddev.xyz/#chain=golos&app=calculator — opened in public CDP click-through | OK |
| golos/donate (Донат) | https://dpos.space/golos/donate — opened | https://dpos.blinddev.xyz/#chain=golos&app=donate — opened in public CDP click-through | OK |
| golos/import (Импорт статьи) | https://dpos.space/golos/import — opened | https://dpos.blinddev.xyz/#chain=golos&app=import — opened in public CDP click-through | OK |
| golos/escrow (Escrow) | https://dpos.space/golos/escrow — opened | https://dpos.blinddev.xyz/#chain=golos&app=escrow — opened in public CDP click-through | OK |
| golos/instant-view (Instant View) | https://dpos.space/golos/instant-view — opened | https://dpos.blinddev.xyz/#chain=golos&app=instant-view — opened in public CDP click-through | OK |
| golos/manage (Управление) | https://dpos.space/golos/manage — opened | https://dpos.blinddev.xyz/#chain=golos&app=manage — opened in public CDP click-through | OK |
| golos/swap (Обмен) | https://dpos.space/golos/swap — opened | https://dpos.blinddev.xyz/#chain=golos&app=swap — opened in public CDP click-through | OK |
| golos/register (Регистрация) | https://dpos.space/golos/registration — opened | https://dpos.blinddev.xyz/#chain=golos&app=register — opened in public CDP click-through | OK |
| golos/explorer (Проводник) | https://dpos.space/golos/explorer — opened | https://dpos.blinddev.xyz/#chain=golos&app=explorer — opened in public CDP click-through | OK |
| viz/profiles (Профили) | https://dpos.space/viz/profiles — opened | https://dpos.blinddev.xyz/#chain=viz&app=profiles — opened in public CDP click-through | OK |
| viz/accounts (Аккаунты) | https://dpos.space/viz/profiles — opened, equivalent account widget | https://dpos.blinddev.xyz/#chain=viz&app=accounts — opened in public CDP click-through | minor copy difference: dedicated v3 login/add page vs old modal/widget |
| viz/wallet (Кошелёк) | https://dpos.space/viz/wallet — opened | https://dpos.blinddev.xyz/#chain=viz&app=wallet — opened in public CDP click-through | OK |
| viz/history (История) | https://dpos.space/viz/wallet — opened, old wallet/history equivalent | https://dpos.blinddev.xyz/#chain=viz&app=history — opened in public CDP click-through | minor copy difference: dedicated v3 history vs old wallet-integrated history |
| viz/broadcast (Отправка) | — — no old standalone route | https://dpos.blinddev.xyz/#chain=viz&app=broadcast — opened in public CDP click-through | blocked/intentional: old standalone service absent; v3 route still opened |
| viz/award (Награды) | https://dpos.space/viz/awards — opened | https://dpos.blinddev.xyz/#chain=viz&app=award — opened in public CDP click-through | OK |
| viz/registration (Регистрация) | https://dpos.space/viz/registration — opened | https://dpos.blinddev.xyz/#chain=viz&app=registration — opened in public CDP click-through | OK |
| viz/calculator (Калькулятор) | https://dpos.space/viz/calc — opened | https://dpos.blinddev.xyz/#chain=viz&app=calculator — opened in public CDP click-through | OK |
| viz/manage (Управление) | https://dpos.space/viz/manage — opened | https://dpos.blinddev.xyz/#chain=viz&app=manage — opened in public CDP click-through | OK |
| viz/explorer (Проводник) | https://dpos.space/viz/explorer — opened | https://dpos.blinddev.xyz/#chain=viz&app=explorer — opened in public CDP click-through | OK |
| viz/exchanges (Обмен VIZ) | https://dpos.space/viz/exchanges — opened | https://dpos.blinddev.xyz/#chain=viz&app=exchanges — opened in public CDP click-through | OK |
| steem/profiles (Профили) | https://dpos.space/steem/profiles — opened | https://dpos.blinddev.xyz/#chain=steem&app=profiles — opened in public CDP click-through | OK |
| steem/accounts (Аккаунты) | https://dpos.space/steem/profiles — opened, equivalent account widget | https://dpos.blinddev.xyz/#chain=steem&app=accounts — opened in public CDP click-through | minor copy difference: dedicated v3 login/add page vs old modal/widget |
| steem/wallet (Кошелёк) | https://dpos.space/steem/wallet — opened | https://dpos.blinddev.xyz/#chain=steem&app=wallet — opened in public CDP click-through | OK |
| steem/history (История) | https://dpos.space/steem/wallet — opened, old wallet/history equivalent | https://dpos.blinddev.xyz/#chain=steem&app=history — opened in public CDP click-through | minor copy difference: dedicated v3 history vs old wallet-integrated history |
| steem/broadcast (Отправка) | — — no old standalone route | https://dpos.blinddev.xyz/#chain=steem&app=broadcast — opened in public CDP click-through | blocked/intentional: old standalone service absent; v3 route still opened |
| steem/editor (Редактор) | https://dpos.space/steem/post — opened | https://dpos.blinddev.xyz/#chain=steem&app=editor — opened in public CDP click-through | OK |
| steem/calculator (Калькулятор) | https://dpos.space/steem/calc — opened | https://dpos.blinddev.xyz/#chain=steem&app=calculator — opened in public CDP click-through | OK |
| steem/manage (Управление) | https://dpos.space/steem/manage — opened | https://dpos.blinddev.xyz/#chain=steem&app=manage — opened in public CDP click-through | OK |
| steem/register (Регистрация) | — — no old standalone route | https://dpos.blinddev.xyz/#chain=steem&app=register — opened in public CDP click-through | blocked/intentional: old standalone service absent; v3 route still opened |
| steem/import (Импорт статьи) | — — no old standalone route | https://dpos.blinddev.xyz/#chain=steem&app=import — opened in public CDP click-through | blocked/intentional: old standalone service absent; v3 route still opened |
| steem/instant-view (Instant View) | — — no old standalone route | https://dpos.blinddev.xyz/#chain=steem&app=instant-view — opened in public CDP click-through | blocked/intentional: old standalone service absent; v3 route still opened |
| steem/swap (Обмен) | https://dpos.space/steem/swap — opened | https://dpos.blinddev.xyz/#chain=steem&app=swap — opened in public CDP click-through | OK |
| steem/explorer (Проводник) | https://dpos.space/steem/explorer — opened | https://dpos.blinddev.xyz/#chain=steem&app=explorer — opened in public CDP click-through | OK |
| hive/profiles (Профили) | https://dpos.space/hive/profiles — opened | https://dpos.blinddev.xyz/#chain=hive&app=profiles — opened in public CDP click-through | OK |
| hive/accounts (Аккаунты) | https://dpos.space/hive/profiles — opened, equivalent account widget | https://dpos.blinddev.xyz/#chain=hive&app=accounts — opened in public CDP click-through | minor copy difference: dedicated v3 login/add page vs old modal/widget |
| hive/wallet (Кошелёк) | https://dpos.space/hive/wallet — opened | https://dpos.blinddev.xyz/#chain=hive&app=wallet — opened in public CDP click-through | OK |
| hive/history (История) | https://dpos.space/hive/wallet — opened, old wallet/history equivalent | https://dpos.blinddev.xyz/#chain=hive&app=history — opened in public CDP click-through | minor copy difference: dedicated v3 history vs old wallet-integrated history |
| hive/broadcast (Отправка) | — — no old standalone route | https://dpos.blinddev.xyz/#chain=hive&app=broadcast — opened in public CDP click-through | blocked/intentional: old standalone service absent; v3 route still opened |
| hive/editor (Редактор) | https://dpos.space/hive/post — opened | https://dpos.blinddev.xyz/#chain=hive&app=editor — opened in public CDP click-through | OK |
| hive/calculator (Калькулятор) | https://dpos.space/hive/calc — opened | https://dpos.blinddev.xyz/#chain=hive&app=calculator — opened in public CDP click-through | OK |
| hive/manage (Управление) | https://dpos.space/hive/manage — opened | https://dpos.blinddev.xyz/#chain=hive&app=manage — opened in public CDP click-through | OK |
| hive/register (Регистрация) | — — no old standalone route | https://dpos.blinddev.xyz/#chain=hive&app=register — opened in public CDP click-through | blocked/intentional: old standalone service absent; v3 route still opened |
| hive/import (Импорт статьи) | — — no old standalone route | https://dpos.blinddev.xyz/#chain=hive&app=import — opened in public CDP click-through | blocked/intentional: old standalone service absent; v3 route still opened |
| hive/instant-view (Instant View) | — — no old standalone route | https://dpos.blinddev.xyz/#chain=hive&app=instant-view — opened in public CDP click-through | blocked/intentional: old standalone service absent; v3 route still opened |
| hive/swap (Обмен) | https://dpos.space/hive/swap — opened | https://dpos.blinddev.xyz/#chain=hive&app=swap — opened in public CDP click-through | OK |
| hive/explorer (Проводник) | — — no old standalone route | https://dpos.blinddev.xyz/#chain=hive&app=explorer — opened in public CDP click-through | blocked/intentional: old standalone service absent; v3 route still opened |
| minter/profiles (Профили) | https://dpos.space/minter/profiles — opened | https://dpos.blinddev.xyz/?cb=b1ec486#chain=minter&app=profiles — public re-test opened profile for `Mxf85ceccfe2112e88be58162c43f5ec959672ab54` | FIXED and public re-tested OK |
| minter/accounts (Аккаунты) | https://dpos.space/minter/profiles — opened, equivalent account widget | https://dpos.blinddev.xyz/#chain=minter&app=accounts — opened in public CDP click-through | minor copy difference: dedicated v3 login/add page vs old modal/widget |
| minter/wallet (Кошелёк) | https://dpos.space/minter/wallet — opened | https://dpos.blinddev.xyz/#chain=minter&app=wallet — opened in public CDP click-through | OK |
| minter/history (История) | https://dpos.space/minter/wallet — opened, old wallet/history equivalent | https://dpos.blinddev.xyz/#chain=minter&app=history — opened in public CDP click-through | minor copy difference: dedicated v3 history vs old wallet-integrated history |
| minter/broadcast (Отправка) | https://dpos.space/minter/broadcast — opened | https://dpos.blinddev.xyz/#chain=minter&app=broadcast — opened in public CDP click-through | OK |
| minter/validators (Валидаторы) | https://dpos.space/minter/validators — opened | https://dpos.blinddev.xyz/#chain=minter&app=validators — opened in public CDP click-through | OK |
| minter/explorer (Проводник) | https://dpos.space/minter/explorer — opened | https://dpos.blinddev.xyz/#chain=minter&app=explorer — opened in public CDP click-through | OK |
| minter/swap (Обмен) | https://dpos.space/minter/swap — opened | https://dpos.blinddev.xyz/#chain=minter&app=swap — opened in public CDP click-through | OK |
| minter/my-coin (Мои монеты) | https://dpos.space/minter/my-coin — opened | https://dpos.blinddev.xyz/#chain=minter&app=my-coin — opened in public CDP click-through | OK |
| minter/calculator (Калькулятор) | — — no old standalone route | https://dpos.blinddev.xyz/#chain=minter&app=calculator — opened in public CDP click-through | blocked/intentional: old standalone service absent; v3 route still opened |
| minter/randomblockchain (Случайный блокчейн) | https://dpos.space/minter/randomblockchain — opened | https://dpos.blinddev.xyz/#chain=minter&app=randomblockchain — opened in public CDP click-through | OK |
| minter/long (LONG) | https://dpos.space/minter/long — opened | https://dpos.blinddev.xyz/#chain=minter&app=long — opened in public CDP click-through | OK |
| decimal/profiles (Профили) | https://dpos.space/decimal/profiles — opened | https://dpos.blinddev.xyz/#chain=decimal&app=profiles — opened in public CDP click-through | OK |
| decimal/accounts (Аккаунты) | https://dpos.space/decimal/profiles — opened, equivalent account widget | https://dpos.blinddev.xyz/#chain=decimal&app=accounts — opened in public CDP click-through | minor copy difference: dedicated v3 login/add page vs old modal/widget |
| decimal/wallet (Кошелёк) | https://dpos.space/decimal/wallet — opened | https://dpos.blinddev.xyz/#chain=decimal&app=wallet — opened in public CDP click-through | OK |
| decimal/history (История) | https://dpos.space/decimal/wallet — opened, old wallet/history equivalent | https://dpos.blinddev.xyz/#chain=decimal&app=history — opened in public CDP click-through | minor copy difference: dedicated v3 history vs old wallet-integrated history |
| decimal/broadcast (Отправка) | — — no old standalone route | https://dpos.blinddev.xyz/#chain=decimal&app=broadcast — opened in public CDP click-through | blocked/intentional: old standalone service absent; v3 route still opened |
| decimal/validators (Валидаторы) | https://dpos.space/decimal/validators — opened | https://dpos.blinddev.xyz/?cb=b1ec486#chain=decimal&app=validators — public re-test rendered in-route API unavailable warning, not generic route crash | FIXED and public re-tested OK |
| decimal/explorer (Проводник) | https://dpos.space/decimal/explorer — opened | https://dpos.blinddev.xyz/#chain=decimal&app=explorer — opened in public CDP click-through | OK |
| decimal/swap (Обмен) | — — no old standalone route | https://dpos.blinddev.xyz/#chain=decimal&app=swap — opened in public CDP click-through | blocked/intentional: old standalone service absent; v3 route still opened |
| decimal/my-coin (Монеты/NFT) | — — no old standalone route | https://dpos.blinddev.xyz/#chain=decimal&app=my-coin — opened in public CDP click-through | blocked/intentional: old standalone service absent; v3 route still opened |
| decimal/calculator (Калькулятор) | — — no old standalone route | https://dpos.blinddev.xyz/#chain=decimal&app=calculator — opened in public CDP click-through | blocked/intentional: old standalone service absent; v3 route still opened |

---

## Wallet refactor plan — v3

### Goal

Stop treating Graphene-like wallets as one universal UI. Keep only safe infrastructure shared; move wallet balances, labels, forms and operations into chain-specific renderers.

### Constraints

- Branch: `v3`.
- Static frontend only.
- Real transactions only after explicit browser confirmation.
- Do not leak private keys, WIF, seed phrases, or backend origins.
- Preserve current successful gates before every push:
  - `node --check v3/js/*.js`
  - `node --check tests/*.js`
  - `for f in tests/*.js; do node "$f"; done`
  - `git diff --check`
- Keep low-level broadcast/confirm/refresh shared.
- Do not continue patching wallet copy in a generic way.

### Stage 1 — split wallet renderers without feature expansion

Purpose: architectural separation first, minimal behavior change.

1. Introduce chain-specific dispatch for Graphene wallet route:
   - `renderGolosWallet(chain, account)`
   - `renderVizWallet(chain, account)`
   - `renderHiveWallet(chain, account)`
   - `renderSteemWallet(chain, account)`
2. Extract common data-loading helper:
   - load crypto/library
   - current user/key status
   - connection
   - raw account
   - normalized profile
   - wallet history
3. Keep common low-level helpers:
   - `bindOperationForm`
   - `refreshRouteAfterBroadcast`
   - `setOperationResult`
   - `operationDetails`
   - validation wrappers
4. Add chain-specific form-builder/binding entry points that currently call the shared Graphene helper, without changing wallet wording or feature set in this stage.
5. Add smoke assertions that wallet render dispatch is chain-specific.

Acceptance for Stage 1:

- UI still works for existing wallet operations.
- Code has separate render functions per chain.
- Shared Graphene form helper remains as an implementation detail behind chain-specific entry points.
- Tests pass.
- No commit/push until parent review approves.

### Stage 2 — wallet legacy parity pass, one chain at a time

Purpose: adapt wallets by network based on legacy `blockchains/{name}/apps/wallet` and all files inside each wallet directory. Do not start this stage inside the Stage 1 subagent.

Required evidence before changing a chain wallet:

- inspect every file under the relevant legacy wallet directory;
- record supported operations, balances, labels, shortcuts, and skipped/blocked legacy behaviors;
- preserve existing broadcast safety: preview first, confirm before real send, no test sends.

Golos priorities:

1. Balances:
   - GOLOS
   - GBG
   - СГ converted from GESTS
   - delegated/received СГ
   - TIP balance
   - UIA balances
2. Operations:
   - GOLOS/GBG transfer
   - transfer to СГ
   - withdraw СГ
   - delegate СГ
   - claim accumulative balance
   - donate
   - TIP transfer / transfer from TIP if supported by loaded library
3. Legacy-specific UX review:
   - balance action shortcuts
   - templates for transfer/donate (evaluate if worth porting now)
   - gateways/withdraw metadata (evaluate separately, likely Stage 2.2)
4. Tests for СГ conversion and UIA visibility.

Acceptance for Stage 2:

- Each adapted wallet no longer feels like generic Graphene wallet.
- Chain-specific primary balances/action amounts are user-facing, with raw values only as secondary detail where needed.
- Missing legacy features explicitly marked supported/not yet ported/blocked with evidence.
- Tests pass; commit/push only after parent review.

### Stage 3 — VIZ wallet pass

Purpose: VIZ-specific wallet, no Golos/Hive/Steem terminology.

Priorities:

- VIZ liquid balance
- SHARES
- energy
- rewards/award flow terminology
- transfer / transfer to vesting / withdraw vesting / delegation only where correct
- invite-related operations stay in manage unless UX says otherwise

Acceptance:

- VIZ wallet labels are VIZ-native.
- No “СГ”, no Golos-specific rewards text.

### Stage 4 — Hive and Steem wallet pass

Purpose: separate HP/SP semantics and savings/rewards.

Priorities:

- Hive: HIVE/HBD/HP, savings, reward claim labels
- Steem: STEEM/SBD/SP, savings, reward claim labels
- Avoid Golos/VIZ wording.

### Stage 5 — visual/action shortcuts

After semantic correctness:

- Add balance action shortcuts/cards:
  - liquid: transfer / power up
  - power: power down / delegation
  - savings: transfer to/from savings where supported
  - chain-specific shortcuts only
- Revisit modal vs details only after chain-specific renderers are stable.

### Current next action

Parent review Stage 1 split: chain-specific Graphene wallet renderers and form-builder/binding entry points are in place with minimal behavior changes. After parent approval, commit/push may happen; only then start Stage 2 as a legacy-wallet-dir evidence pass, not in the Stage 1 subagent.

### 2026-05-10 Golos wallet UIA gateways/templates increment

- [x] Transfer/donate templates ported with legacy localStorage keys `<TOKEN>_transfer_templates` and `<TOKEN>_donate_templates`; built-in GOLOS templates preserved.
- [x] UIA gateway metadata is loaded from asset `json_metadata` and rendered in the Golos wallet.
- [x] UIA deposit supports fixed metadata, `/golos/api/uia-deposit` API address lookup, and optional legacy 0.001 GOLOS address-request transfer when `deposit.to_transfer` + `deposit.memo_transfer` are present.
- [x] UIA withdraw supports metadata ways and builds memo exactly like legacy `buildWithdrawMemoFromMetadata`: `prefix + main`, plus ` space + postfix` when postfix is filled.
- [x] Re-checked `origin/master:blockchains/golos/js/blockchain.js` and related legacy Golos JS via grep for `action_uia_withdraw_start`, `uia_withdraw`, `buildWithdrawMemoFromMetadata`, `transferAsync`, `withdrawal`, `gateway`: no `action_uia_withdraw_start` handler found outside wallet content/render code; v3 therefore prepares the inferred active `transfer` to `withdrawal.account` with the metadata memo instead of inventing any other op.
- [x] No commit/push in this pass.

## 2026-05-10 — VIZ wallet legacy parity/adaptation plan

### Preconditions verified

- Repository status before work: clean `git status --short`.
- Branch: `v3`.
- Starting commit: `52258fcff2522e7e70b476d79a52947954f63a62` (`Filter Golos gateway selects and add withdraw max`).
- Current v3 wallet files inspected before implementation:
  - `v3/js/app.js`: `renderGrapheneWallet`, thin `renderVizWallet`, `renderVizWalletForms`, `bindVizWalletForms`, generic Graphene forms, Golos-specific wallet renderer/forms/bindings, VIZ award/manage invite/committee bindings.
  - `v3/js/profiles.js`: VIZ balance normalization (`VIZ`, `SHARES`, delegated/received, `Энергия`, `Reward SHARES`) and generic profile enrichment.
  - Tests inspected by grep/list: `tests/v3-route-coverage-smoke.js`, `tests/v3-auth-broadcast-smoke.js`, `tests/v3-profiles-smoke.js`, `tests/v3-golos-uia-gateways-smoke.js`, plus full tests directory list.

### Legacy VIZ wallet files inspected exhaustively

`git ls-tree -r --name-only origin/master:blockchains/viz/apps/wallet` returned and each file was inspected with `git show`:

- `blockchains/viz/apps/wallet/config.json` — title/description/category only.
- `blockchains/viz/apps/wallet/content.php` — complete wallet DOM: auth messages, balance/SHARES action menus, deposit via invite, withdraw SHARES, transfer VIZ, transfer templates, VIZ→SHARES, delegate SHARES, create invite, received/delegated delegation tables, withdraw status, witness vote prompt, transfer/award/reward history filters.
- `blockchains/viz/apps/wallet/css/jquery-ui.css` — legacy UI theme only, no business logic.
- `blockchains/viz/apps/wallet/css/style.css` — modal/layout CSS only, no business logic.
- `blockchains/viz/apps/wallet/index.php` — guard stub only.
- `blockchains/viz/apps/wallet/js/app.js` — complete wallet behavior: encrypted memo, URL params, pass_gen invite WIF, transfer template localStorage, cancel delegation, load balances/delegations/withdraw schedule, invite use/claim, withdraw/cancel withdraw, transfer/transfer_to_vesting, template save/remove, own VIZ→SHARES, delegate, createInvite, witness vote, transfer URL prefill, encrypted memo decode for history, walletData history fetch/filter/render, getInviteByKey.

Related shared VIZ files inspected:

- `origin/master:blockchains/viz/js/blockchain.js` — nodes, old localStorage auth/decrypt, VIZ regular/active variables, Vizonator bridge methods for withdraw/delegate/transfer/transfer_to_vesting/committee/custom/award, account selection.
- `origin/master:blockchains/viz/js/modal-accounts.js` was covered in earlier auth matrix and relevant localStorage/passphrase rules remain in this plan.
- `origin/master:blockchains/viz/apps/awards/{content.php,js/app.js,pages/*}` by targeted grep/show snippets for award energy/custom_sequence/memo/beneficiaries and `viz.broadcast.awardAsync`/`fixedAwardAsync` param order.
- `origin/master:blockchains/viz/apps/manage/pages/many-invites/{content.php,footer.js}` for bulk invite operation names and object keys.
- `origin/master:blockchains/viz/apps/manage/pages/workers/{content.php,footer.js}` for committee request/vote methods already exposed in v3 manage.
- `origin/master:blockchains/viz/apps/manage/pages/create-account/footer.js` for accountCreate/invite-registration context; wallet should not embed legacy hardcoded inviteRegistration signer.

### Exhaustive legacy wallet checklist and v3 mapping

Implemented now in VIZ wallet (`renderVizWallet`, `renderVizWalletForms`, `bindVizWalletForms`):

- Dedicated VIZ renderer, no longer a thin alias to generic Graphene wallet.
- VIZ-native labels: `VIZ`, `SHARES`, `Energy`; no Golos `СГ` wording in VIZ wallet UI.
- Balance section: `balance`, `vesting_shares`, `delegated_vesting_shares`, `received_vesting_shares`, effective SHARES, current/regenerated energy, `reward_vesting_balance`, `vesting_withdraw_rate`, `next_vesting_withdrawal`.
- Delegation lists via `viz.api.getVestingDelegations(account, '', 100, 'received'|'delegated')`, with safe fallback diagnostic and cancel-delegation prefill.
- Transfer VIZ: legacy templates and localStorage key `viz_transfer_templates`; built-ins `xchng`, `gls.xchng`, `gph.xchng`, `vmp`; custom save/remove.
- Encrypted memo for transfer: if memo starts `#`, fetch recipient `memo_key` with `getAccountsAsync([to])` and encode with `viz.memo.encode(activeKey, to_public_memo_key, memo)`.
- Optional transfer to vesting from transfer form: `transferToVesting(active_key, from, to, amount)`.
- Own VIZ→SHARES form: `transferToVesting(active_key, from, from, amount)`.
- Withdraw SHARES: `withdrawVesting(active_key, account, vesting_shares)`.
- Cancel withdraw: `withdrawVesting(active_key, account, '0.000000 SHARES')`.
- Delegate SHARES / cancel by zero: `delegateVestingShares(active_key, delegator, delegatee, vesting_shares)`.
- Use invite into SHARES: `useInviteBalance(active_key, initiator, receiver, invite_secret)`.
- Claim invite into VIZ: `claimInviteBalance(active_key, initiator, receiver, invite_secret)`.
- Check invite data: `viz.auth.wifToPublic(secret)` then `viz.api.getInviteByKey(publicKey)`.
- Create invite: generate or paste secret WIF, derive public key with `viz.auth.wifToPublic(secret)`, then `createInvite(active_key, creator, balance, invite_key)`; secret is not included in prepared operation params.
- Witness vote prompt from legacy wallet: `accountWitnessVote(active_key, account, 'denis-skripnik', true)`.
- History: VIZ wallet uses shared history table; legacy-specific award/reward operation types remain covered by global history filtering/display rather than old jQuery row filters.

Broadcast/API methods and exact param order from legacy evidence:

- `viz.broadcast.transfer(active_key, viz_login, to, amount, memo, cb)` → v3 prepared `transfer`: `[from, to, amount, memo]`.
- `viz.broadcast.transferToVesting(active_key, viz_login, to, amount, cb)` → v3 `transferToVesting`: `[from, to, amount]`.
- `viz.broadcast.withdrawVesting(active_key, viz_login, vesting_shares, cb)` → v3 `withdrawVesting`: `[account, vesting_shares]`.
- `viz.broadcast.delegateVestingShares(active_key, viz_login, delegatee, vesting_shares, cb)` → v3 `delegateVestingShares`: `[delegator, delegatee, vesting_shares]`.
- `viz.broadcast.createInvite(active_key, viz_login, balance, invite_key, cb)` → v3 `createInvite`: `[creator, balance, invite_key]`.
- `viz.broadcast.useInviteBalance(active_key, viz_login, viz_login/receiver, invite_secret, cb)` → v3 `useInviteBalance`: `[initiator, receiver, invite_secret]`.
- `viz.broadcast.claimInviteBalance(active_key, viz_login, viz_login/receiver, invite_secret, cb)` → v3 `claimInviteBalance`: `[initiator, receiver, invite_secret]`.
- `viz.broadcast.accountWitnessVote(active_key, viz_login, 'denis-skripnik', true, cb)` → v3 `accountWitnessVote`: `[account, witness, approve]`.
- Awards related, not wallet DOM form in legacy wallet but required by VIZ feature evidence: `viz.broadcast.awardAsync(posting_key, viz_login, target, energy, custom_sequence, memo, beneficiaries, cb)` and `fixedAwardAsync(posting_key, viz_login, target, reward_amount, energy, custom_sequence, memo, beneficiaries, cb)`; v3 award route already prepares `award` with `[initiator, receiver, energy, custom_sequence, memo, beneficiaries]`.
- Delegation read API: `viz.api.getVestingDelegations(viz_login, '', 100, type, cb)`.
- Invite read API: `viz.api.getInviteByKey(publicInviteKey, cb)`.
- History API: `viz.api.getAccountHistoryAsync(viz_login, from, limit)` and filters on transfer-like ops plus `award`, `receive_award`, `benefactor_award`, `witness_reward`.

Blocked/later with exact reasons:

- Vizonator extension signing: legacy routes call `sendToVizonator(...)`; v3 has no safe extension bridge object contract and broadcast layer only supports locally saved encrypted keys. Not implemented to avoid silently failing or leaking operations.
- `inviteRegistration` from wallet JS: legacy uses a hardcoded WIF literal in `inviteRegPage`; not wallet main flow and not safe to reproduce. Registration remains a separate v3 service requiring explicit signer input.
- Bulk many-invites: legacy manage page builds raw `operations` arrays and sends one tx; outside wallet main DOM, not added to wallet. Manage route can cover invite primitives separately.
- Fixed award and award payout calculators: legacy award app functionality, not wallet DOM. Existing v3 award route covers normal award preview/send; fixed award can be a later VIZ award-service parity slice.
- Old modal/fancybox/jQuery UI CSS and exact visual hiding/filter behavior: intentionally not ported; v3 keeps accessible details/forms/status regions.
- Decrypted history memo prompting/saving memo key: read-only encrypted history decode can expose private memo-key handling and is not needed for safe wallet sends; transfer encrypted memo encoding is implemented.

### Acceptance criteria for this VIZ wallet slice

- `renderVizWallet` is a dedicated renderer and does not call `renderGrapheneWallet` as a thin alias.
- VIZ wallet UI contains VIZ-native labels and operation sections for VIZ transfer/templates/encrypted memo, VIZ→SHARES, SHARES withdraw/cancel withdraw, delegation/cancel prefill, invite check/use/claim/create, delegations, witness vote, and notes for omitted legacy flows.
- VIZ operation bindings use legacy method names/param order above through `bindOperationForm`; no real send bypasses preview + explicit confirm.
- No Golos `СГ` labels appear inside VIZ-specific wallet renderer/forms.
- Invite create preview params contain only public `invite_key`; invite use/claim warns that secret is sensitive and relies on existing sanitized preview/result path.
- Tests assert dedicated VIZ wallet renderer, labels/forms/method names, legacy evidence checklist in `plan.md`, and generic Golos behavior remains present.
- Required gates pass: `node --check v3/js/*.js`, `node --check tests/*.js`, all tests, `git diff --check`.

## Steem wallet parity/adaptation evidence (2026-05-10)

### Preconditions
- Branch checked: `v3`.
- `git status --short` before edits: clean.
- Current v3 inspected before implementation: `v3/js/app.js`, `v3/js/profiles.js`, `v3/js/broadcast.js`, existing wallet-related smoke tests under `tests/`.
- Last known parent commit context: `4b5745f Remove developer notes from wallet UI`.

### Legacy files inspected exhaustively
- `origin/master:blockchains/steem/apps/wallet/config.json` — title/description/menu metadata for Steem wallet.
- `origin/master:blockchains/steem/apps/wallet/content.php` — auth/active warnings, balances, action modals, claim UI, delegation/withdraw status, transfer history filters.
- `origin/master:blockchains/steem/apps/wallet/css/jquery-ui.css` — bundled UI CSS only; no wallet logic.
- `origin/master:blockchains/steem/apps/wallet/css/style.css` — modal/layout CSS only; no wallet logic.
- `origin/master:blockchains/steem/apps/wallet/index.php` — guard-only placeholder.
- `origin/master:blockchains/steem/apps/wallet/js/app.js` — wallet behavior and exact Steem API/broadcast calls.

### Related Steem shared files inspected
- `origin/master:blockchains/steem/js/blockchain.js` — working node selection for `https://api.steemit.com`, localStorage key `steem_node`, old account key decrypt passphrases.
- `origin/master:blockchains/steem/js/modal-accounts.js` — account lookup/auth modal behavior, includes `steem.api.getAccounts`.
- `origin/master:blockchains/steem/js/jquery-ui.js` — UI library only.
- `origin/master:blockchains/steem/js/sjcl.min.js` — crypto library only.
- `origin/master:blockchains/steem/js/steem.min.js` — confirms Steem operation schema/method availability for wallet operations, including savings and witness/proxy operations.

### Legacy Steem wallet checklist
- Balances: `STEEM`, `SBD`, converted `SP`, received/delegated SP, effective full SP, reward STEEM/SBD/SP, pending power down status, delegated-out list.
- Actions: transfer STEEM/SBD, optional transfer STEEM to recipient SP, transfer own STEEM to own SP, withdraw SP to STEEM, cancel withdraw via zero VESTS, delegate SP, cancel delegation via zero VESTS, claim rewards.
- Safety/UX: active-key warning, WIF-in-memo warning, max buttons, URL prefill for transfer `to`/`amount`/`memo`, concise alerts.
- History: `getAccountHistoryAsync(login, from, limit)` filtered for transfer-like ops plus `curation_reward`, `author_reward`, `comment_benefactor_reward`, `producer_reward`; filters: all, incoming, outgoing, author, curator, witness, benefactor.
- Savings: legacy wallet UI did not render savings actions, but shared `steem.min.js` includes exact operations `transfer_to_savings`, `transfer_from_savings`, `cancel_transfer_from_savings`; v3 can expose them safely through preview/confirm.
- Witness/proxy: present in shared Steem operation schema as `account_witness_vote(account,witness,approve)` and `account_witness_proxy(account,proxy)`, but not part of legacy wallet app UI; handled elsewhere in v3 manage routes, not duplicated in wallet.
- Encrypted memo: legacy wallet only detects WIF in memo with `steem.auth.isWif`; shared Steem client exposes memo support, so v3 may encode `#...` memo when `client.memo.encode` is available, otherwise stop before send.

### Exact legacy broadcast/API evidence and param order
- `steem.api.getAccounts([steem_login], cb)`.
- `steem.api.getDynamicGlobalProperties(cb)`.
- `steem.api.getVestingDelegations(steem_login, '', 100, cb)`.
- `steem.api.getAccountHistoryAsync(steem_login, from, limitReal)`.
- `steem.broadcast.transfer(active_key, steem_login, to, amount, memo, cb)`.
- `steem.broadcast.transferToVesting(active_key, steem_login, to, amount, cb)`.
- `steem.broadcast.withdrawVesting(active_key, steem_login, vesting_shares, cb)`.
- `steem.broadcast.delegateVestingShares(active_key, steem_login, delegatee, vesting_shares, cb)`.
- `steem.broadcast.claimRewardBalance(posting_key, steem_login, reward_steem_balance, reward_sbd_balance, reward_vesting_balance, cb)`.
- Shared Steem schema confirms `transfer_to_savings(from,to,amount,memo)`, `transfer_from_savings(from,request_id,to,amount,memo)`, `cancel_transfer_from_savings(from,request_id)`, `account_witness_vote(account,witness,approve)`, `account_witness_proxy(account,proxy)`.

### v3 mapping
- Implement now: dedicated `renderSteemWallet` (not generic alias), dedicated data loader with `getVestingDelegations`, STEEM/SBD/SP balance section, reward claim summary, delegated-out table with cancellation forms, power-down status/cancel form, Steem-native forms for transfer, transfer to SP, withdraw SP, delegate SP, rewards, savings transfer/from/cancel, WIF memo guard, optional encrypted `#...` memo encoding, URL transfer prefill.
- Implement now via existing v3 facilities: account history table uses normalized wallet operations; real sends go only through `bindOperationForm` preview + explicit browser confirm.
- Later: full legacy “load more until match” transfer-history filtering UI; v3 currently shows the last normalized financial operations without adding the old jQuery filter buttons.
- Later: duplicate witness/proxy controls in wallet; they are not in legacy wallet UI and already exist in v3 manage flows.
- Blocked: none for static/frontend-safe wallet functionality; unavailable memo encoder stops before send with a user-actionable error instead of sending plaintext accidentally.

### Acceptance criteria
- Steem wallet is no longer a thin alias to generic Graphene wallet.
- User-facing Steem wallet uses STEEM, SBD, SP and savings wording; no Golos `СГ`, VIZ `SHARES`, or dev notes.
- Steem broadcast method names and parameter order match legacy/shared Steem evidence.
- WIF/private keys are not shown; WIF-looking memo is blocked before preview/send.
- Real network sends require preview/confirm through `bindOperationForm`.
- Tests assert Steem-specific renderer/forms/method labels and this evidence section.

### 2026-05-10 Hive wallet legacy parity/adaptation pass

Preconditions:
- Branch confirmed: `v3`.
- Working tree before edits: clean (`git status --short` produced no entries).
- Current v3 files inspected before implementation: `v3/js/app.js`, `v3/js/profiles.js`, `v3/js/broadcast.js`, `tests/v3-steem-wallet-smoke.js`, `tests/v3-viz-wallet-smoke.js`, `tests/v3-route-coverage-smoke.js`, `tests/v3-auth-broadcast-smoke.js`, existing `plan.md` wallet sections.

Legacy Hive wallet evidence inspected exhaustively:
- `blockchains/hive/apps/wallet/config.json` — title/description/menu for wallet.
- `blockchains/hive/apps/wallet/content.php` — UI sections for auth/active warnings, main balances, HIVE/HBD/HP action spoilers, transfer modals, HP power up/down/delegation, rewards claim, delegation list/cancel, withdraw status/cancel, transfer/reward history filters and table.
- `blockchains/hive/apps/wallet/css/jquery-ui.css` — legacy UI dependency only; no wallet business logic.
- `blockchains/hive/apps/wallet/css/style.css` — modal/layout CSS only; no wallet business logic.
- `blockchains/hive/apps/wallet/index.php` — direct-access guard only.
- `blockchains/hive/apps/wallet/js/app.js` — all wallet data loading, conversions, broadcast calls, URL prefill, history filters/rendering.
- Related shared Hive files inspected/grepped: `blockchains/hive/js/blockchain.js`, `blockchains/hive/js/modal-accounts.js`, `blockchains/hive/js/hive.min.js`, `blockchains/hive/js/jquery-ui.js`, `blockchains/hive/js/sjcl.min.js`.

Legacy Hive checklist:
- Balances/sections: `balance` as HIVE, `hbd_balance` as HBD, `vesting_shares` converted to HP using `total_vesting_fund_hive / total_vesting_shares`, `received_vesting_shares`, `delegated_vesting_shares`, effective HP (`own - delegated + received`), `vesting_withdraw_rate`, `next_vesting_withdrawal`, estimated full withdrawal, reward HIVE/HBD/VESTS converted/displayed as HP, outgoing delegations with `min_delegation_time`.
- Actions: HIVE transfer, HBD transfer, transfer HIVE to HP recipient via checkbox, transfer HIVE to HP of current account, withdraw HP to HIVE, cancel HP withdraw with `0.000000 VESTS`, delegate HP, cancel delegation with `0.000000 VESTS`, claim rewards, transfer URL prefill (`to`, `amount`, `memo`).
- History: `getAccountHistoryAsync(login, from, limit)` paged; filters for all/incoming/outgoing/author_reward/curation_reward/comment_benefactor_reward/producer_reward; transfer/transfer_to_vesting rows and reward rows; reward VESTS converted to HP.
- Safety/UX: legacy warns if memo looks like WIF via `hive.auth.isWif`; encrypted memo is not implemented in old wallet UI, but shared `hive.min.js` has `memo.encode/decode`, so v3 may safely prepare `#...` encrypted memo when API and memo_key are available. No Hive Keychain calls found.
- Savings: `hive.min.js` supports `transfer_to_savings(from,to,amount,memo)`, `transfer_from_savings(from,request_id,to,amount,memo)`, `cancel_transfer_from_savings(from,request_id)`; the old Hive wallet UI did not expose savings forms, but profiles/shared account fields expose savings balances/status.
- Witness/proxy: wallet app has no witness/proxy form; shared operation list supports `account_witness_vote(account,witness,approve)` and `account_witness_proxy(account,proxy)`, already handled in v3 manage, not wallet.

Exact legacy API/broadcast method evidence and parameter order:
- `hive.api.getAccounts([hive_login], cb)`.
- `hive.api.getDynamicGlobalProperties(cb)` and fields `total_vesting_fund_hive`, `total_vesting_shares`.
- `hive.api.getVestingDelegations(hive_login, '', 100, cb)`.
- `hive.api.getAccountHistoryAsync(hive_login, from, limitReal)`.
- `hive.broadcast.transfer(active_key, hive_login, to, amount, memo, cb)`.
- `hive.broadcast.transferToVesting(active_key, hive_login, to, amount, cb)`.
- `hive.broadcast.withdrawVesting(active_key, hive_login, vesting_shares, cb)`.
- `hive.broadcast.delegateVestingShares(active_key, hive_login, delegatee, vesting_shares, cb)`.
- `hive.broadcast.claimRewardBalance(posting_key, hive_login, reward_hive_balance, reward_hbd_balance, reward_vesting_balance, cb)`.
- Shared Hive operation serializer order: `transfer_to_savings(from,to,amount,memo)`, `transfer_from_savings(from,request_id,to,amount,memo)`, `cancel_transfer_from_savings(from,request_id)`.

v3 mapping:
- Implemented now: dedicated `renderHiveWallet` instead of generic alias; dedicated Hive data loader with `getVestingDelegations`; dedicated HIVE/HBD/HP balances; outgoing delegation table and cancel forms; HIVE/HBD transfer with optional HIVE-to-HP checkbox and URL prefill; HIVE-to-HP current-account form; HP power down/cancel; HP delegation/cancel; rewards claim using current raw reward balances; savings transfer/from/cancel using shared Hive operation order; WIF-in-memo guard; optional encrypted `#...` memo preparation through `hive.memo.encode` when available; history continues via shared `DposHistory` wallet table.
- Implemented elsewhere / not duplicated in wallet: witness/proxy vote/update remains in v3 manage, matching legacy wallet absence.
- Later: exact legacy paged wallet-history filters/buttons are not reimplemented in the wallet panel because v3 has a separate accessible `history` route with operation filters and the wallet already shows latest financial operations; duplicating it would broaden scope and risk inconsistent history UX.
- Blocked: none for safe static/frontend wallet functionality found in legacy Hive wallet.

Acceptance criteria:
- Hive wallet has dedicated renderer/forms/binders and is not a thin `renderGrapheneWallet` alias.
- User-facing Hive wallet copy uses HIVE, HBD, HP, rewards and savings labels; no Golos СГ, VIZ SHARES or Steem SP in Hive UI.
- All real Hive wallet sends use `bindOperationForm` preview + explicit confirm, with no private key display/leakage.
- Tests assert Hive renderer labels/forms/method names, legacy evidence in `plan.md`, and no developer notes in user-facing wallet UI.
- Required gates pass: `node --check v3/js/*.js`, `node --check tests/*.js`, all `tests/*.js`, `git diff --check`.

## Minter wallet parity evidence pass — 2026-05-10

### Preconditions

- Branch confirmed: `v3`.
- Starting commit: `52729b15c15a07d0232ccaf9afdca27706dbcfc1` (`Port Hive wallet legacy flows`).
- Starting `git status --short`: clean.
- Current v3 files inspected before edits: `v3/js/app.js`, `v3/js/profiles.js`, `v3/js/broadcast.js`, `v3/js/chains.js`; tests scanned: `tests/v3-minter-decimal-smoke.js`, `tests/v3-minter-long-smoke.js`, `tests/v3-route-coverage-smoke.js`, `tests/v3-profiles-smoke.js`, plus wallet smoke patterns for Golos/VIZ/Steem/Hive.

### Legacy files inspected

`origin/master:blockchains/minter/apps/wallet` returned and was inspected file-by-file:

- `config.json`: wallet title/description/menu metadata.
- `content.php`: main wallet DOM, auth notice, address/copy, balances list, actions list, transfer/withdraw/convert/delegate modals, transaction history table.
- `css/jquery-ui.css`: vendored jQuery UI styles only; no wallet operation logic.
- `css/style.css`: modal/layout helpers only; no wallet operation logic.
- `delegation/config.json`: delegation page metadata.
- `delegation/content.php`: delegation-only wallet page: balances hidden, delegations table, delegate/anbond modals, `getDelegations()` startup call.
- `index.php`: PHP page loader for wallet/delegation subpage.
- `origin/master:blockchains/minter/apps/wallet/js/app.js`: wallet UI logic, balances/actions, templates, fee/max helpers, history, delegations, autocomplete.
- `js/jquery-ui.js`: vendored jQuery UI; no wallet-specific logic.

Related Minter shared files inspected:

- `origin/master:blockchains/minter/js/blockchain.js`: Minter SDK setup, auth/seed decrypt, sender derivation, broadcast helper, signed TX helper, send/convert/liquidity/delegate/anbond/coin/token helpers, getBalance.
- `origin/master:blockchains/minter/js/modal-accounts.js`: account modal helper references `TX_TYPE.SEND`; account management is already handled by v3 `accounts/auth` and is not wallet-specific.
- `origin/master:blockchains/minter/js/minterjs-sdk.min.js`, `minterjs-wallet.min.js`, `axios.min.js`, `sjcl.min.js`, `jquery-ui.js`: vendored libraries; API surfaces were verified via usage in `blockchain.js` and existing v3 vendor calls, not copied into user UI.

### Legacy wallet checklist and exact evidence

Read-only/account data:

- Auth notice: wallet requires seed phrase; legacy also allows `current_user.type === 'bip.to'` for BIP wallet link flow.
- Address area: `sender.address`, copy button, link to `/minter/profiles/<address>`.
- Balances: `getBalance(address)` calls `https://explorer-api.minter.network/api/v2/addresses/<address>` and maps `data.data.balances[]` to `{id: token.coin.id, coin: token.coin.symbol, amount, type: token.coin.type}`; amounts `<0.001` use 8 decimals, otherwise 3 decimals.
- Actions per balance: transfer and convert for every token; delegate only when `token.coin.type === 'coin'`; withdraw actions discovered dynamically from `https://hub-api.minter.network/mhub2/v1/token_infos` where `token.toLowerCase().indexOf(val.denom) > -1 && val.chain_id !== 'minter'`.
- Delegations: `https://explorer-api.minter.network/api/v2/addresses/<address>/delegations`; table shows validator status/name/public_key, stake, BIP value, waitlisted flag; actions delegate/anbond for each row.
- History: `https://explorer-api.minter.network/api/v2/addresses/<address>/transactions?page=<page>`; table columns date/block/hash/type/amount/memo; operation titles include numeric types 1–39; payload decoded with `window.atob` and URL content linkified.
- Coin autocomplete: `https://explorer-api.minter.network/api/v2/coins`, sorted by `reserve_balance`, used only for convert target input.

Shared SDK/API setup from legacy `blockchain.js`:

- SDK destructuring: `const {TX_TYPE, prepareLink, prepareTx, prepareSignedTx, getTxData} = minterSDK`.
- Client: `new minterSDK.Minter({apiType: 'node', baseURL: 'https://api.minter.one/v2'})`.
- Axios default: `https://api.minter.one/v2`.
- Sender derivation: `minterWallet.walletFromMnemonic(secret).getAddressString()` and `.getPrivateKeyString()`.
- Legacy seed passphrase: `dpos.space_<chain>_<login>_seed`, where `chain` may be `current_user.importFrom`.
- Broadcast: BIP wallet path uses `prepareLink(idTxParams)`; local seed path calls `minter.postTx(idTxParams, {privateKey: wif})`, then checks `/transaction/<hash>`.
- Signed TX helper: `prepareSignedTx(idTxParams, {seedPhrase: seed})`.

Exact operation methods/param order from legacy:

- `send(to, value, coin, memo, mode, gasCoin)`:
  - rejects memo that `minterWallet.isValidMnemonic(memo)` returns true for;
  - `GET /min_gas_price`, `gasPrice = parseInt(min_gas_price) + 1`;
  - `txParams = { chainId: 1, type: TX_TYPE.SEND, data: { to, value, coin }, gasCoin, gasPrice, payload: memo }`;
  - `minter.replaceCoinSymbol(txParams)`;
  - fee mode uses `minter.estimateTxCommission(idTxParams, {direct: false})`, falls back with `txParams.gasCoin = 'BIP'`.
- `convert(coin, to, value, minimum_buy_amount, swap_route, mode, gasCoin)`:
  - default `gasCoin = coin`;
  - plain sell: `TX_TYPE.SELL`, data `{ coinToSell: coin, coinToBuy: to, minimumValueToBuy, valueToSell }`;
  - pool route: `TX_TYPE.SELL_SWAP_POOL`, data `{ coins: swap_route.split(','), minimumValueToBuy, valueToSell }`;
  - `GET /min_gas_price`, `replaceCoinSymbol`, `estimateTxCommission`.
- `addToPool(coin, to, amount1, amount2, mode, variant, gasCoin, payload)`:
  - default `gasCoin = coin`;
  - `TX_TYPE.ADD_LIQUIDITY`, or `TX_TYPE.CREATE_SWAP_POOL` when `variant === 'create_pool'`;
  - data `{ coin0: coin, coin1: to, volume0: amount1, maximumVolume1: amount2 }`, or `{ coin0, coin1, volume0, volume1: amount2 }` for create pool;
  - optional `payload`.
- `removeFromPool(coin0, coin1, liquidity, mode)`:
  - `TX_TYPE.REMOVE_LIQUIDITY`, data `{ coin0, coin1, liquidity }`, `gasCoin: 'BIP'`.
- `delegate(coin, publicKey, stake, mode, gasCoin)`:
  - default `gasCoin = coin`;
  - `TX_TYPE.DELEGATE`, data `{ publicKey, coin, stake }`.
- `anbond(coin, publicKey, stake, mode)`:
  - legacy spelling is `anbond`; tx is `TX_TYPE.UNBOND`, data `{ publicKey, coin, stake }`.
- `createCoin(type, name, symbol, initialAmount, maxSupply, options, mode)`:
  - `type: TX_TYPE[type]`, data `{ name, symbol, initialAmount, maxSupply }`;
  - for `CREATE_COIN` / `RECREATE_COIN`, add `{ constantReserveRatio, initialReserve }`;
  - otherwise add `{ mintable, burnable }` for token create/recreate.
- `editCoinOwner(symbol, newOwner, mode)`:
  - `TX_TYPE.EDIT_COIN_OWNER`, data `{ symbol, newOwner }`.
- `mintToken(coin, value)`:
  - `TX_TYPE.MINT_TOKEN`, data `{ coin, value }`.
- `burnToken(coin, value)`:
  - `TX_TYPE.BURN_TOKEN`, data `{ coin, value }`.
- Hub withdraw memo:
  - send target `Mx68f4839d7f32831b9234f9575f3b95e1afe21a56`;
  - memo JSON `{ recipient: to.trim(), type: 'send_to_' + blockchain.toLowerCase(), fee: hub_fee_minimal_units_string }`;
  - hub fee endpoints: `https://hub-api.minter.network/oracle/v1/<chain>_fee`, `https://hub-api.minter.network/oracle/v1/prices`.
- Convert route discovery:
  - `https://explorer-api.minter.network/api/v2/pools/coins/<coin>/<to>/route?amount=<amount*1e18>&type=input`;
  - SDK estimate call: `minter.estimateCoinSell({ coinToSell, valueToSell, coinToBuy, swap_from: 'optimal', route })`.

### v3 mapping for this pass

Implemented before this pass and kept:

- Minter chain config, vendor SDK/wallet paths, REST profile loader, history normalization, seed auth compatibility, seed sanitization, address validation.
- Static Minter transaction forms for SEND, DELEGATE, UNBOND, SELL, SELL_SWAP_POOL, ADD_LIQUIDITY, REMOVE_LIQUIDITY, CREATE_SWAP_POOL, Hub withdraw SEND, CREATE/RECREATE_COIN, CREATE/RECREATE_TOKEN, MINT_TOKEN, BURN_TOKEN, EDIT_COIN_OWNER.
- Real sends route through `bindOperationForm` preview/explicit send and `DposBroadcast.broadcast` confirm guard.

Implemented now:

- Dedicated `renderMinterWallet`, `renderMinterWalletBalances`, `renderMinterWalletForms`, `bindMinterWalletForms` entry points instead of generic `renderCosmosWallet` for Minter.
- Wallet read-only panels for legacy balances, delegated coins, recent transactions, account link/copy affordance, and concise available actions per coin.
- Minter-native user-facing labels: BIP, coin/token, validator public key MP..., stake, unbond, check/redeem note, address.
- Send memo mnemonic guard in v3 Minter send prep, matching legacy safety behavior without exposing seed.
- Minter gas coin passthrough on prepared tx where user provides gas coin; broadcast still owns signing and `replaceCoinSymbol`.
- Smoke assertions for dedicated Minter renderer/forms, legacy endpoints, method names, route/Hub memo evidence, no technical notes in UI, and plan evidence.

Blocked / later with exact reasons:

- BIP wallet external `prepareLink` flow: legacy supports it when no local seed is present, but v3 broadcast currently requires local seed for operation prep; implementing external wallet-link signing safely needs a separate explicit external flow and UX review.
- Dynamic fee estimation/max-button auto-adjustments: legacy uses live `minter.estimateTxCommission`, `GET /min_gas_price`, and mutable modal state; safe static v3 can prepare exact txs, but live fee/max rewriting should be added only after a focused API/UX pass.
- Dynamic Hub token discovery and exact hub-fee price calculation: legacy depends on `hub-api.minter.network` oracle endpoints; v3 keeps manual Hub withdraw with explicit fee field to avoid silently stale external fee math.
- Signed TX generation (`prepareSignedTx`) from arbitrary wallet forms: legacy exposes it, but v3 currently has dedicated signed TX submission route; generating signed payloads without sending needs a separate no-broadcast UX path.
- Redeem/check creation: legacy wallet history has operation type `Получение чека` and SDK `TX_TYPE.REDEEM_CHECK`, but wallet UI inspected here did not include a check/redeem form. Not invented.
- Multisend/multisig candidate/edit flows in wallet: legacy history and shared SDK know op types, but inspected wallet UI did not expose wallet forms for these beyond separate v3 broadcast multisig submit. Not invented in wallet UI.
- NFT: no legacy Minter wallet NFT flow found; not implemented.

### Acceptance criteria

- Minter wallet route is no longer a generic Cosmos/Decimal renderer alias.
- User-facing Minter wallet UI contains no developer/evidence notes; detailed legacy mapping stays in this `plan.md` section.
- Balances, delegations, history and forms use Minter-native terminology and exact legacy endpoints/method names where implemented.
- All write operations still pass through v3 preview + explicit send/confirm guard.
- Seed/private key values are never included in prepared preview/result JSON.
- Existing Golos/VIZ/Steem/Hive/Decimal paths are not broadly rewritten.
- Required gates pass: `node --check v3/js/*.js`, `node --check tests/*.js`, all `tests/*.js`, `git diff --check`.

## Decimal wallet parity evidence pass

### Files inspected

Current v3 files inspected before editing:

- `v3/js/app.js`: routing, generic Cosmos wallet, Minter dedicated wallet pattern, Decimal forms, renderer helpers.
- `v3/js/profiles.js`: Decimal account loader uses `/addresses/{address}`, `/addresses/{address}/balances`, `/txs/txs-by-address/{address}`, `/rewards/{address}`, `/nfts/{address}`.
- `v3/js/broadcast.js`: Decimal SDK execution guard and exact SDK method dispatch.
- `v3/js/chains.js`: Decimal chain config, `apiBase`, vendor SDK path, apps.
- Tests inspected: `tests/v3-minter-decimal-smoke.js`, `tests/v3-minter-wallet-smoke.js`, related v3 smoke tests.

Legacy Decimal wallet files inspected from `origin/master:blockchains/decimal/apps/wallet`:

- `config.json`: wallet title/description/category.
- `content.php`: wallet DOM for auth message, current address/copy, balances, action modals, transfer, convert, delegate, delegate NFT, unbond NFT, transaction history.
- `css/jquery-ui.css`: jQuery UI vendor CSS, no wallet business logic.
- `css/style.css`: generic modal/container styles only.
- `delegation/config.json`: delegation page title/description.
- `delegation/content.php`: delegated coins/NFT tables, delegate/anbond forms and modal IDs.
- `index.php`: app subpage loader for delegation.
- `js/app.js`: wallet behavior, balances/history/delegations/templates/max buttons/action handlers.
- `js/jquery-ui.js`: jQuery UI vendor bundle for autocomplete, no Decimal wallet transaction logic.

Related shared Decimal files inspected from `origin/master:blockchains/decimal/js`:

- `blockchain.js`: Decimal SDK wallet/EVM initialization, seed decrypt path, sender shape, exact SDK methods for send/convert/delegate/anbond/NFT/token creation, TX status lookup.
- `axios.min.js`: HTTP helper vendor bundle.
- `decimal-sdk-web.js`: DecimalSDK browser bundle exposing `Wallet`, `DecimalEVM`, `DecimalNetworks`, `TX_TYPE`.
- `decimal.js`: decimal arithmetic library; no wallet-specific transaction flow.
- `info.js`: shared informational helper, no wallet parity blocker found.
- `jquery-ui.js`: jQuery UI vendor bundle.
- `modal-accounts.js`: legacy account selection/import wiring; seed storage compatibility already handled by v3 auth.
- `sjcl.min.js`: encryption vendor bundle.

### Legacy Decimal wallet checklist

Read-only sections / UX elements:

- Auth message when no seed; wallet is seed-backed via `decimal_current_user` and `dpos.space_${chain}_${login}_seed`.
- Current Decimal address with copy button and profile/explorer link.
- Balances list from `/addresses/{evmAddress}/balances`, amount formatted from 18 decimals, `DEL` tracked as fee balance.
- Per-token action list: transfer, convert, delegate.
- Delegation page and tables for delegated coins and delegated NFT.
- Transaction history table with pagination from `/txs/txs-by-address/{sender.address}?limit=10&offset=<offset>`.
- Transfer/delegate templates in localStorage keys `<TOKEN>_decimal_transfer_templates` and `<TOKEN>_decimal_delegate_templates`.
- Max buttons for transfer, convert, delegate, anbond with live fee adjustment.
- Token autocomplete/index for convert using `/coins/coins?limit=1000&offset=<offset>` and `/coins/{symbol}`.

Write actions found:

- Transfer coin/token.
- Convert DEL/token/token using EVM token addresses for token legs.
- Delegate DEL/token stake.
- Anbond/unbond DEL/token stake.
- Delegate NFT and unbond NFT.
- Create token/coin helper exists in shared `blockchain.js`; wallet content has token creation in v3 app area, not in inspected legacy wallet page DOM.

### Exact legacy API/SDK evidence

HTTP endpoints copied or mapped:

- Balances: `GET https://api.decimalchain.com/api/v1/addresses/{address}/balances`.
- History: `GET https://api.decimalchain.com/api/v1/txs/txs-by-address/{address}?limit=10&offset={offset}`.
- Coin stakes: `GET https://api.decimalchain.com/api/v1/validators/wallet/{evmAddress}/stakes/coins`.
- NFT stakes: `GET https://api.decimalchain.com/api/v1/validators/wallet/{evmAddress}/stakes/nfts`.
- Coin index: `GET https://api.decimalchain.com/api/v1/coins/coins?limit=1000&offset={offset}`.
- Coin detail/decimals: `GET https://api.decimalchain.com/api/v1/coins/{symbol}`.
- TX status/detail: `GET https://api.decimalchain.com/api/v1/txs/{txHash}`.
- v3 also exposes profile-side `GET /rewards/{address}?limit=20&offset=0` and `GET /nfts/{address}?limit=20&offset=0`; these are safe read-only wallet panels.

SDK globals and seed/account evidence:

- `const { Wallet, DecimalEVM, DecimalNetworks, TX_TYPE } = window.DecimalSDK`.
- `decimalWallet = new Wallet(secret)`.
- `sender = { address: decimalWallet.address, evmAddress: decimalWallet.evmAddress, privateKey: ... }`.
- `decimalEVM = new DecimalEVM(decimalWallet, DecimalNetworks.mainnet)`.
- `ensureDecimalEVM()` optionally calls `decimalEVM.connect()`.

Exact legacy method names / param order:

- `send(to, amount, coin, memo, mode)`:
  - DEL fee: `decimalEVM.estimateFeeSendDEL({ to, amount })`.
  - token fee: `decimalEVM.estimateFeeTransferToken({ to, coin, amount })`.
  - DEL send: `decimalEVM.sendDEL({ to, amount: amountInSmallestUnit })`.
  - token send: `decimalEVM.transferToken({ to, coin, amount: amountInSmallestUnit })`.
- `convert(fromLeg, toLeg, value, minimum_buy_amount, mode)`:
  - token -> DEL: `evm.sellExactTokensForDEL(tokenAddress, amountIn, amountOutMin, recipient)`.
  - DEL -> token: `evm.buyTokenForExactDEL(tokenAddress, amountDel, amountOutMin, recipient)`.
  - token -> token: `evm.convertToken(tokenAddress1, tokenAddress2, amountIn, amountOutMin, recipient, sign || undefined)` after optional `getSignPermitToken(tokenAddress1, tokenCenterAddress, amountIn)`.
- `delegate(coin, address, stake, mode)`:
  - DEL: `decimalEVM.delegateDEL(validator, stakeWei)`.
  - token: `decimalEVM.delegateToken(validator, coin, stakeWei)`.
  - fee branch uses `delegateDEL(address, amount, true)` or `delegateToken({ address, coin, amount }, true)`.
- `anbond(coin, address, stake, mode)`:
  - DEL unbond: `decimalEVM.withdrawStakeToken(address, '0x0000000000000000000000000000000000000000', stakeInSmallestUnit)`.
  - token unbond: `decimalEVM.withdrawStakeToken(address, coin, stakeInSmallestUnit)`.
- `createCoin(title, ticker, initSupply, maxSupply, options, mode)`:
  - `decimalEVM.createToken({ title, symbol: ticker, initSupply, maxSupply, reserve: options.initialReserve, crr: options.constantReserveRatio })`.
- `delegateNFT(nftId, address, mode)`:
  - `decimalEVM.delegateNFT({ nftId, address })`.
- `withdrawStakeNFT(nftId, address, mode)`:
  - `decimalEVM.withdrawStakeNFT({ nftId, address })`.

### v3 mapping for this pass

Implemented now:

- Dedicated Decimal wallet path: `loadDecimalWalletData`, `renderDecimalWalletBalances`, `renderDecimalWalletForms`, `renderDecimalWallet`, `bindDecimalWalletForms`.
- Decimal wallet route for `wallet`, `swap`, and `my-coin` now dispatches to the dedicated Decimal renderer before the generic Cosmos fallback.
- Read-only wallet panels for address/copy, balances, coin stake, NFT stake, rewards, NFTs and recent transactions.
- Legacy Decimal endpoints mapped for balances, coin stakes, NFT stakes, and tx history; rewards/NFT lists reused from the existing v3 Decimal profile API mapping.
- Safe static operation forms for transfer, delegate/unbond, convert, create token, delegate/unbond NFT.
- Real sends remain behind existing `bindOperationForm` preview + explicit send and `DposBroadcast.broadcast` confirmation guard.
- Decimal-native UI labels: DEL, монета/токен, адрес, валидатор, stake, анбонд, NFT.
- Smoke assertions added for Decimal renderer, exact endpoints, form labels, method names/param order, plan evidence, and absence of developer/evidence notes in the user-facing renderer.

Kept from earlier v3 Decimal work:

- Decimal chain config and vendor SDK wiring.
- Seed auth compatibility and preview/result sanitization.
- Decimal address validation for `d0...`, `dx...` and `0x...`; validator validation via Decimal-specific guard.
- Decimal broadcast methods in `v3/js/broadcast.js` using existing SDK calls.

Blocked / later with exact reasons:

- Live fee estimates and max-button auto-adjustment: legacy uses EVM fee methods plus mutable modal state and token-fee conversion; v3 can safely prepare exact operations, but automatic amount rewriting needs a focused UX/API pass to avoid silently changing user-entered amounts.
- Token symbol autocomplete and automatic symbol -> 0x resolution for convert: legacy builds a cached `/coins/coins` index and resolves decimals; v3 currently accepts explicit `DEL` or token `0x` addresses to avoid guessing the wrong token. Add later with visible token selection and collision handling.
- Token -> token permit signing in UI: broadcast currently calls `convertToken` without exposing the optional permit signature path from legacy. Implementing `getSignPermitToken` safely needs SDK-version verification and preview text for the extra approval semantics.
- TX status polling after broadcast: legacy polls `/txs/{hash}` for success/failure; v3 returns sanitized broadcast result. Add later as a generic post-broadcast receipt checker.
- Transfer/delegate template management: legacy templates are per-token localStorage modals; useful, but not required for safe parity and should be added as a small reusable wallet-template component.
- `bip.to` account type: legacy has a branch that shows seed page for `type === 'bip.to'`; v3 local seed flow is the current supported send path. External wallet-link flow needs separate design.
- Legacy labels sometimes say `Публичный ключ валидатора` / `MP...` in Decimal delegation content, but shared Decimal code validates and uses EVM validator `0x...`; v3 uses Decimal-native `Адрес валидатора` and accepts `0x...`/`d0valoper...` via existing validator guard.

### Acceptance criteria

- Decimal wallet route is no longer a generic Cosmos renderer alias for wallet/swap/my-coin.
- Decimal wallet UI contains no developer/evidence/plan notes; detailed legacy mapping stays in this `plan.md` section.
- Balances, stake, NFT, rewards, history and forms use Decimal-native terminology.
- Implemented endpoints and SDK method names/param order match inspected legacy evidence.
- All write operations pass through v3 preview + explicit send/confirm guard.
- Seed/private key values are not shown in prepared previews or broadcast results.
- Existing Golos/VIZ/Steem/Hive/Minter paths are not broadly rewritten.
- Required gates pass: `node --check v3/js/*.js`, `node --check tests/*.js`, all `tests/*.js`, `git diff --check`.


## Phase 3 — Deep parity audit of v3 real routes (started 2026-05-10)

### Scope correction

Do **not** add legacy applications/pages to v3 only because they existed in `master`. Many old app URLs depended on PHP/backend aggregation, `backend.dpos.space`, or server-local endpoints; their absence is acceptable for the static v3 branch.

The audit should compare only routes that already exist in v3 or have a clear static/browser-only successor, starting from `golos` and going app by app:

1. Compare legacy code for the corresponding old app, beginning with `blockchains/golos/apps/wallet` and shared `blockchains/golos/js/*`.
2. Compare v3 implementation in `v3/js/app.js`, `v3/js/auth.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, and `v3/js/chains.js`.
3. Add or fix missing browser/static functionality inside the existing v3 route.
4. Preserve v3 improvements: transaction preview, sanitized JSON, accessible forms, and no automatic real broadcast.
5. Skip backend-only legacy behavior unless a safe static subset is obvious.

### Immediate audit order

- Golos `wallet`.
- Golos `profiles`.
- Golos `calculator`, `donate`, `editor/post`, `manage`, `swap`, `register`, `explorer`, `import`, `instant-view`, `escrow`.
- Then repeat for VIZ, Steem, Hive, Minter, Decimal.

### Acceptance criteria

- Existing v3 routes match the old user-visible functionality as closely as static browser-only constraints allow.
- Missing backend-only functions are not reintroduced as dead menu entries.
- Every change is covered by focused smoke tests where practical.
- Required gates pass: `node --check v3/js/*.js`, `node --check tests/*.js`, all `tests/*.js`, `git diff --check`.

### Golos wallet/profile audit notes — current increment

Golos `wallet` deep pass implemented static/browser-safe parity fixes:

- regular transfer now supports destination selector: main balance, TIP balance (`transfer_to_tip`) and vesting/СГ (`transfer_to_vesting`);
- UIA main-balance transfer form added for `transfer` of custom Golos assets;
- UIA TIP transfer path fixed so TIP templates prepare `transfer_to_tip`, not a plain `transfer`;
- old `/golos/api/uia-deposit` backend request removed; fixed metadata or transfer-request gateway flows remain available without PHP/backend;
- history operation labels include `withdraw_vesting` for power-down visibility.

Golos `profiles` deep pass implemented static/browser-safe parity fixes:

- profile route loads Golos UIA balances through public chain RPC helper `fetchGolosUiaBalances` and renders them as `UIA активы`;
- profile normalization exposes profile/cover images, human-readable reputation, current voting power and estimated time to 100% батарейка;
- profile rendering adds image previews, safe social links and local quick links to history/explorer/profile instead of old backend profile subpages;
- smoke coverage expanded in `tests/v3-profiles-smoke.js` for these user-visible fields and render hooks.
- review delta fixed: `transfer_to_vesting` now validates only GOLOS amounts, and UIA `transfer_to_tip` preserves the legacy `allow_override_transfer` block.

Validation for this increment:

```bash
node --check v3/js/profiles.js && node --check v3/js/app.js && for f in tests/*.js; do node "$f" || exit 1; done && git diff --check
```

Result: passed locally on 2026-05-10.

- Golos `donates` is backend/indexer-only and intentionally excluded from v3; use `donate` for sending and public history/profile views for local inspection.


## Functional parity matrix — supported static v3 chains (long-run continuation 2026-05-11)

Scope rule for this matrix: this is not route inventory. Each row records the app-level functional comparison target: legacy UI/forms, submit/action handlers, helper libraries, operation builders, preview/send behavior, and static-v3 constraints. Backend/PHP/server-only apps are excluded rather than recreated as dead static pages.

| Chain | Legacy app(s) compared | v3 route(s) | Functional parity decision |
|---|---|---|---|
| VIZ | `wallet`, `awards`, `calc`, `randomblockchain`, `manage`, `registration`, `profiles`, `explorer`, `exchanges` | `wallet`, `award`, `calculator`, `randomblockchain`, `manage`, `registration`, `profiles`, `explorer`, `exchanges` | Static-safe parity implemented/verified: VIZ wallet operation forms, award/fixedAward, local registration key generation/backup, calculator formulas, randomblockchain witness_signature hashing, manage proxy/witness/profile/invite/committee flows. Backend/indexer-only VIZ apps such as analytics/top/search/vmp/voice-import/custom-generator/polls/projects are non-goals unless a separate static-safe route is explicitly requested. |
| STEEM | `wallet`, `post`, `calc`, `manage`, `profiles`, `randomblockchain`, `swap`, `explorer` | `wallet`, `editor`, `calculator`, `manage`, `profiles`, `randomblockchain`, `swap`, `explorer`, plus `history`/`broadcast` v3 helpers | Static-safe parity implemented/verified for wallet transfer/power/savings/claim/delegation, editor `comment` + `comment_options`, calculator, manage proxy/witness/profile, profile/history, randomblockchain. This pass fixed hidden post/editor parity gaps: preview image metadata, payout mode, dpos-post tag append, generated permlink, default/additional beneficiaries extension. Legacy upload-to-Imgur, Garlic persistence, SimpleMDE UI and exact edit-loader modal are not ported; they require third-party upload/UI state or are replaced by accessible v3 fields and local import draft. |
| HIVE | `wallet`, `post`, `calc`, `manage`, `profiles`, `randomblockchain`, `swap` | `wallet`, `editor`, `calculator`, `manage`, `profiles`, `randomblockchain`, `swap`, `explorer`, plus `history`/`broadcast` v3 helpers | Static-safe parity implemented/verified for wallet transfer/power/savings/claim/delegation, editor `comment` + `comment_options`, calculator, manage proxy/witness/profile, profile/history, randomblockchain. This pass fixed hidden post/editor parity gaps: Hive community/parent_permlink selector, preview image metadata, payout mode via `percent_hbd`, dpos-post tag append, generated permlink, default/additional beneficiaries extension. Legacy upload-to-Imgur, Garlic persistence, SimpleMDE UI and exact edit-loader modal are not ported; accessible v3 fields/import draft cover the static-safe subset. |
| MINTER | `wallet`, `broadcast`, `validators`, `explorer`, `swap`, `my-coin`, `randomblockchain`, `long`, `profiles` | `wallet`, `broadcast`, `validators`, `explorer`, `swap`, `my-coin`, `calculator`, `randomblockchain`, `long`, `profiles` | Static-safe parity implemented/verified for dedicated Minter wallet/broadcast transaction preparation, validator/explorer read APIs, swap/my-coin operation forms, calculator, randomblockchain and LONG read/memo helpers. External BIP wallet-link signing, live fee/max rewriting, dynamic Hub token discovery and backend-dependent LONG mutations remain explicit non-goals for the static branch. |
| DECIMAL | `wallet`, `validators`, `explorer`, `profiles`, `randomblockchain` | `wallet`, `validators`, `explorer`, `swap`, `my-coin`, `calculator`, `profiles` | Static-safe parity implemented/verified for dedicated Decimal wallet read panels, transfer/convert/delegate/unbond/NFT/token forms, validators/explorer/profile read APIs and calculator. Dynamic token autocomplete, permit-signing branch, live fee/max rewriting, TX status polling and template modals remain explicit later items because they need focused API/UX handling. |

### Steem/Hive editor/post deep pass

Legacy evidence inspected in `/root/ai-projects/dpos.space/blockchains/{steem,hive}/apps/post/content.php` and `js/_interface.js`:

- Form fields: title, preview image URL, tags, optional permlink, payout mode, post body; Hive additionally has a community/category select used as `parent_permlink`.
- Submit builders: `comment` followed by `comment_options` with `max_accepted_payout` (`SBD`/`HBD`), `percent_steem_dollars` or `percent_hbd`, `allow_votes`, `allow_curation_rewards`, and beneficiaries extension `[0,{beneficiaries}]`.
- Legacy helper behavior: append `dpos-post` when tags are provided, generate permlink from title, keep a default 1% beneficiary for `denis-skripnik`, and optionally add more beneficiaries.
- Server/third-party/UI pieces not copied: Imgur upload with legacy client id, SimpleMDE/Garlic persistence widgets, and the exact jQuery edit-loader modal. These are not required for safe static parity and v3 already supports local import drafts.

v3 mapping implemented now:

- `buildGenericEditorOperations` now appends `dpos-post`, generates a permlink from title when empty, includes `image` metadata, exposes payout mode, and sends beneficiaries extension for Steem/Hive.
- Hive editor exposes a static-safe community/`parent_permlink` selector for legacy communities plus a no-community `dpos-post` option.
- Steem/Hive editor form keeps preview + explicit send via existing `bindOperationForm`; no real transaction is sent in tests.
- Smoke coverage added in `tests/v3-social-editor-smoke.js` for concrete editor payload/form behavior, not merely route existence.

Remaining backend/static exclusions after the supported-chain pass:

- No PHP routes, `backend.dpos.space`, server-local IPs, cron/bot/indexer dependencies, or hidden old `blockchains/*` runtime imports are added to v3.
- EVM and cyber remain out of scope.
- Legacy apps that are analytics/indexer/search/import/upload widgets without a current static-safe v3 route are documented non-goals, not added as placeholders.

### Rigorous parity: Golos / wallet

Scope lock: this section covers only legacy `/root/ai-projects/dpos.space/blockchains/golos/apps/wallet` plus Golos chain-level helpers included by that wallet. No VIZ/Steem/Hive/Minter/Decimal implementation is claimed here.

Files inspected for this one-app matrix:
- `/root/ai-projects/dpos.space/blockchains/golos/apps/wallet/config.json`
- `/root/ai-projects/dpos.space/blockchains/golos/apps/wallet/index.php`
- `/root/ai-projects/dpos.space/blockchains/golos/apps/wallet/content.php`
- `/root/ai-projects/dpos.space/blockchains/golos/apps/wallet/css/style.css`
- `/root/ai-projects/dpos.space/blockchains/golos/apps/wallet/css/jquery-ui.css`
- `/root/ai-projects/dpos.space/blockchains/golos/apps/wallet/js/app.js`
- `/root/ai-projects/dpos.space/blockchains/golos/js/blockchain.js`
- `/root/ai-projects/dpos.space/blockchains/golos/js/modal-accounts.js`
- `/root/ai-projects/dpos.space/blockchains/golos/js/golos.min.js` (vendored library; minified API surface only)
- `/root/ai-projects/dpos.space/blockchains/golos/js/golos-dex.min.js` (included legacy vendor; no wallet-specific handler found)
- `/root/ai-projects/dpos.space/blockchains/golos/js/jquery-ui.js` (modal/ui vendor)
- `/root/ai-projects/dpos.space/blockchains/golos/js/sjcl.min.js` (legacy encrypted-key dependency)

Matrix:

- legacy source file: `apps/wallet/config.json`
  - legacy function/handler/form/control/helper: app metadata (`title`, `description`, menu/category)
  - behavior / transaction or read action: declares wallet menu entry and description.
  - v3 equivalent file/function/UI: `v3/js/chains.js` Golos `wallet` route metadata and router entry.
  - test coverage: existing `tests/v3-route-coverage-smoke.js` route/app assertions; this pass did not change route metadata.
  - status: implemented

- legacy source file: `apps/wallet/index.php`
  - legacy function/handler/form/control/helper: `NOTLOAD` direct-access guard only.
  - behavior / transaction or read action: PHP runtime guard, no UI or chain operation.
  - v3 equivalent file/function/UI: static `index.html` + hash router; no PHP runtime.
  - test coverage: static JS checks and route tests.
  - status: backend-only non-goal — PHP guard is irrelevant in static v3.

- legacy source file: `apps/wallet/css/style.css`, `apps/wallet/css/jquery-ui.css`, `golos/js/jquery-ui.js`
  - legacy function/handler/form/control/helper: modal/fancybox/jQuery UI styling; sticky action panel; modal visibility rules.
  - behavior / transaction or read action: presentation only; legacy forms were hidden in modals.
  - v3 equivalent file/function/UI: `v3/css/style.css`, `operationDetails(...)`, fieldsets, labels, `role="status"`, `aria-live="polite"` result regions.
  - test coverage: source smoke tests check concrete form IDs/controls; accessibility preserved by labels/fieldsets/status regions in `v3/js/app.js`.
  - status: intentionally different with reason — static accessible details/fieldsets replace legacy modal plugin.

- legacy source file: `golos/js/blockchain.js`
  - legacy function/handler/form/control/helper: `checkWorkingNode()` with Golos public nodes and localStorage `golos_node`.
  - behavior / transaction or read action: node fallback and stored node selection.
  - v3 equivalent file/function/UI: `v3/js/chains.js` Golos nodes; `v3/js/profiles.js` connection fallback and node persistence.
  - test coverage: existing auth/profile smoke coverage; validation runs `node --check v3/js/chains.js`.
  - status: implemented

- legacy source file: `golos/js/blockchain.js`
  - legacy function/handler/form/control/helper: legacy key decrypt globals (`golos_current_user`, `dpos.space_golos_<login>_activeKey/postingKey`) and `selectAccount/deleteAccount` helpers.
  - behavior / transaction or read action: local encrypted-key auth and account switching.
  - v3 equivalent file/function/UI: `v3/js/auth.js`; `v3/js/broadcast.js` authority/key decrypt before prepare/send.
  - test coverage: existing `tests/v3-auth-broadcast-smoke.js`; required validation includes `v3/js/broadcast.js`.
  - status: implemented

- legacy source file: `golos/js/blockchain.js`
  - legacy function/handler/form/control/helper: `sendAjax(url, id)` and `.ajax_modal`.
  - behavior / transaction or read action: loads server/PHP modal content by URL.
  - v3 equivalent file/function/UI: no server modal fetch; static forms are rendered locally.
  - test coverage: `tests/v3-golos-wallet-smoke.js` verifies Golos wallet section has no legacy backend/IP dependency.
  - status: backend-only non-goal — static v3 must not call PHP/backend modal endpoints.

- legacy source file: `golos/js/modal-accounts.js`
  - legacy function/handler/form/control/helper: `saveAccount`, `deleteAccount`, `OAuthInit`, duplicate `pass_gen`.
  - behavior / transaction or read action: account persistence/OAuth bootstrap shared across apps, not wallet-specific transaction UI.
  - v3 equivalent file/function/UI: `v3/js/auth.js` account picker; golos.app records recognized but not new OAuth backend signing path.
  - test coverage: `tests/v3-auth-broadcast-smoke.js`.
  - status: implemented / intentionally different with reason — static v3 keeps local legacy encrypted records and does not recreate Golos.app backend OAuth.

- legacy source file: `apps/wallet/content.php`
  - legacy function/handler/form/control/helper: `#balances_only` checkbox; `#balances`; `#full_vesting`; `#info_vesting_withdraw`; balance fields for GOLOS/GBG/СГ/TIP/accumulative/UIA.
  - behavior / transaction or read action: read account balances, vesting rate, pending withdraw info, optional balances-only view.
  - v3 equivalent file/function/UI: `renderGolosWallet`, `loadGrapheneWalletData`, `fetchGolosUiaBalances`, `renderGolosWalletBalances`, `formatGolosPowerMax`.
  - test coverage: `tests/v3-golos-uia-gateways-smoke.js` and `tests/v3-golos-wallet-smoke.js`; required JS checks.
  - status: implemented; balances-only checkbox intentionally different because v3 renders forms collapsed rather than hides them.

- legacy source file: `apps/wallet/js/app.js` lines 279-477
  - legacy function/handler/form/control/helper: `mainData`, `fetchAllAssets`, `fetchAssetsBySymbols`, `buildGateFromAsset`, `hydrateGatesFromAssets`.
  - behavior / transaction or read action: account/global props, Golos Power conversion, UIA/TIP balances and gateway metadata discovery.
  - v3 equivalent file/function/UI: `loadGrapheneWalletData`, `fetchGolosUiaBalances`, `fetchAllGolosAssets`, `buildGolosUiaGatewayFromAsset`, `fetchGolosUiaGateways`.
  - test coverage: `tests/v3-golos-uia-gateways-smoke.js` checks paging, metadata fallbacks and gateway filters.
  - status: implemented

- legacy source file: `content.php` `#transfer_modal`; `apps/wallet/js/app.js` `.transfer_modal`, `#action_transfer_start`, template handlers.
  - legacy function/handler/form/control/helper: transfer form fields: template select/remove/save, recipient, max amount, amount, memo, `transfer_in` destination (`to_balance`, `to_tip`, `to_vesting`).
  - behavior / transaction or read action: GOLOS/GBG transfer; optional transfer to TIP; optional GOLOS to vesting; encrypted memo support; localStorage transfer templates.
  - v3 equivalent file/function/UI: `renderGolosWalletForms` `wallet-transfer-form`; `bindGolosTemplateControls`; `bindGolosWalletForms` transfer handler; `encodeGolosMemoIfNeeded`; `transfer`, `transferToTip`, `transferToVesting` prepare paths.
  - test coverage: `tests/v3-golos-uia-gateways-smoke.js` checks destination select, templates, transfer-to-tip/vesting routing and non-GOLOS rejection for vesting.
  - status: implemented

- legacy source file: `content.php` `#to_shares_transfer_modal`; `apps/wallet/js/app.js` `#action_to_shares_transfer_start`.
  - legacy function/handler/form/control/helper: GOLOS to СГ for current account; max GOLOS button.
  - behavior / transaction or read action: `transfer_to_vesting(active_key, login, login, amount)`.
  - v3 equivalent file/function/UI: `wallet-vesting-form`, `bindGolosWalletForms` `transferToVesting` with optional recipient defaulting to current account.
  - test coverage: existing Golos wallet/source tests plus required validation.
  - status: implemented

- legacy source file: `content.php` `#vesting_withdraw_modal`, `#cancel_vesting_withdraw`; `apps/wallet/js/app.js` `#action_vesting_withdraw_start`, `#cancel_vesting_withdraw`.
  - legacy function/handler/form/control/helper: withdraw СГ amount, max vesting, cancel withdraw button.
  - behavior / transaction or read action: converts СГ to `GESTS`; starts `withdraw_vesting`; cancel sends `0.000000 GESTS`.
  - v3 equivalent file/function/UI: `wallet-withdraw-vesting-form`, `normalizeGolosPowerInput`, `withdrawVesting`; new `wallet-golos-cancel-withdraw-form` sends `0.000000 GESTS`.
  - test coverage: `tests/v3-golos-wallet-smoke.js` checks cancel form and zero-GESTS operation; required JS checks.
  - status: fixed in this pass

- legacy source file: `content.php` `#vesting_delegate_modal`, `#modal_received_vesting_shares`, `#modal_delegated_vesting_shares`; `apps/wallet/js/app.js` `delegationGolosPower`, `.vesting_delegate_modal`, `.modal_received_vesting_shares`, `.modal_delegated_vesting_shares`, `#action_vesting_delegate_start`.
  - legacy function/handler/form/control/helper: delegatee, amount СГ, max, interest-rate range 0-80, existing-delegation detection, received/delegated lists, cancel/change controls.
  - behavior / transaction or read action: reads `getVestingDelegations`; new delegate uses `delegate_vesting_shares_with_interest`; existing/change/cancel uses `delegate_vesting_shares`; cancellation is zero vesting.
  - v3 equivalent file/function/UI: new `fetchGolosDelegations`, `renderGolosDelegations`, `data-golos-cancel-delegation`; `wallet-delegation-form` now includes interest and chooses `delegateVestingSharesWithInterest` for new delegates, `delegateVestingShares` for existing delegates.
  - test coverage: `tests/v3-golos-wallet-smoke.js` checks delegation lists, interest control, method selection and range validation; `v3/js/history.js` includes `delegate_vesting_shares_with_interest`.
  - status: fixed in this pass

- legacy source file: `content.php` `#accumulative_balance_modal`; `apps/wallet/js/app.js` `#accumulative_balance_start`.
  - legacy function/handler/form/control/helper: recipient, max accumulative balance, amount, checkbox receive in СГ.
  - behavior / transaction or read action: `claim(posting_key, login, to, amount, to_vesting, [])`.
  - v3 equivalent file/function/UI: `wallet-golos-claim-form`, `bindGolosWalletForms` prepares posting `claim` with optional recipient and `toVesting`.
  - test coverage: `tests/v3-golos-wallet-smoke.js` indirectly covers wallet operation set; existing source checks and required validation.
  - status: implemented

- legacy source file: `content.php` `#donate_modal`; `apps/wallet/js/app.js` `.donate_modal`, `#donate_start`, donate template save/remove.
  - legacy function/handler/form/control/helper: donate templates, recipient, max token donate, amount, memo/comment.
  - behavior / transaction or read action: posting `donate` from TIP balance; memo/comment may be encrypted; templates in localStorage.
  - v3 equivalent file/function/UI: `wallet-golos-donate-form`, `wallet-golos-token-donate-form`, `getDonateTemplates`, `bindGolosTemplateControls`, `encodeGolosMemoIfNeeded`.
  - test coverage: `tests/v3-golos-uia-gateways-smoke.js` checks donate template preservation; `tests/v3-golos-wallet-smoke.js` checks sanitizer around secret-like values.
  - status: implemented

- legacy source file: `content.php` `#transfer_from_tip_modal`; `apps/wallet/js/app.js` `.transfer_from_tip_modal`, `#transfer_from_tip_start`.
  - legacy function/handler/form/control/helper: recipient, max TIP/token, amount, memo.
  - behavior / transaction or read action: `transfer_from_tip` from TIP balance to liquid/vesting depending token.
  - v3 equivalent file/function/UI: `wallet-golos-transfer-from-tip-form`, `collectGolosTipActionTokens`, `normalizeGolosTokenAmount`, `transferFromTip` prepare.
  - test coverage: `tests/v3-golos-uia-gateways-smoke.js` and `tests/v3-route-coverage-smoke.js`.
  - status: implemented

- legacy source file: `content.php` UIA deposit/withdraw modals; `apps/wallet/js/app.js` `.uia_deposit_modal`, `.uia_withdraw_modal`, `changeWithdrawUIASelect`, `fetchDepositAddressByAsset`, `getDepositAddress`, `buildWithdrawMemoFromMetadata`.
  - legacy function/handler/form/control/helper: UIA deposit details, backend/API deposit address lookup, fixed deposit info, 0.001 GOLOS deposit-address request transfer, withdraw gateway account/memo builders, max UIA amount.
  - behavior / transaction or read action: metadata read; optional backend API read; transfer to gateway for deposit-address request; transfer to gateway for withdraw.
  - v3 equivalent file/function/UI: `renderGolosUiaDepositSection`, `renderGolosUiaWithdrawSection`, `bindGolosGatewayControls`, `buildGolosWithdrawMemo`; API deposits render a static limitation notice and do not call legacy backend.
  - test coverage: `tests/v3-golos-uia-gateways-smoke.js` checks deposit/withdraw metadata behavior, static API limitation and gateway transfer preparation.
  - status: implemented; backend API deposit address lookup is backend-only non-goal with fixed/static alternatives documented in UI.

- legacy source file: `content.php` `#golos_diposit_modal`; `apps/wallet/js/app.js` `#action_vesting_diposit_start`.
  - legacy function/handler/form/control/helper: invite secret input for account top-up.
  - behavior / transaction or read action: `inviteClaim(active_key, login, login, invite_secret, [])`.
  - v3 equivalent file/function/UI: new `wallet-golos-invite-claim-form` prepares active `inviteClaim`; previews/results use `broadcast.sanitizePrepared`/`sanitizeResult` so WIF-like invite secrets are redacted.
  - test coverage: `tests/v3-golos-wallet-smoke.js` checks invite claim form, operation and secret sanitizer.
  - status: fixed in this pass

- legacy source file: `content.php` `#create_invite_form_modal`; `apps/wallet/js/app.js` `pass_gen`, `#new_private_gen`, `#new_private_copy`, `#max_invite_balance`, `#create_invite_start`.
  - legacy function/handler/form/control/helper: generate invite WIF, copy/display secret, amount, show liveblogs registration link, broadcast public key.
  - behavior / transaction or read action: `invite(active_key, login, amount, golos.auth.wifToPublic(secret), [])`; secret must be saved by user but not sent on-chain.
  - v3 equivalent file/function/UI: new `generateGolosInviteSecret`, `golosInvitePublic`, `wallet-golos-create-invite-form`; v3 does not display secret in result JSON and warns user to save it separately.
  - test coverage: `tests/v3-golos-wallet-smoke.js` checks create invite form, public-key-only operation and generation helper.
  - status: fixed in this pass; liveblogs registration link intentionally different/not generated because it is an external legacy site URL, not required for static wallet transaction parity.

- legacy source file: `content.php` `#witnesses_vote_button`; `apps/wallet/js/app.js` witness vote handler.
  - legacy function/handler/form/control/helper: support button for witness `denis-skripnik`, hidden when already voted or vote count limit reached.
  - behavior / transaction or read action: `account_witness_vote(active_key, login, 'denis-skripnik', true)`.
  - v3 equivalent file/function/UI: new `wallet-golos-witness-vote-form` with preview/send `accountWitnessVote`.
  - test coverage: `tests/v3-golos-wallet-smoke.js` checks form and operation preparation.
  - status: fixed in this pass; auto-hide-at-limit is intentionally different because v3 keeps a safe previewable form and node-side broadcast/authority validation remains final source of truth.

- legacy source file: `content.php` history filters and `#wallet_transfer_history`; `apps/wallet/js/app.js` `thisAccountHistory`, `appendWalletData`, `createFiltr`, `date_str`.
  - legacy function/handler/form/control/helper: filters for transfer, claim, transfer_to_tip, transfer_to_vesting, transfer_from_tip, delegate_vesting_shares, delegate_vesting_shares_with_interest, delegation_reward, donate, rewards, producer_reward; renders rows.
  - behavior / transaction or read action: read account history and classify wallet operations.
  - v3 equivalent file/function/UI: `v3/js/history.js` `getWalletOperations`; `renderHistoryTable` in `v3/js/app.js`; wallet renders latest financial operations.
  - test coverage: `tests/v3-golos-wallet-smoke.js` checks interest-bearing delegation is included; `tests/v3-golos-uia-gateways-smoke.js` checks withdraw_vesting inclusion.
  - status: implemented; advanced client-side checkbox filtering is intentionally different because v3 renders a simpler accessible history table.

- legacy source file: `golos/js/golos.min.js`, `golos/js/sjcl.min.js`
  - legacy function/handler/form/control/helper: library APIs used by wallet (`api.getAccountsAsync`, `api.getDynamicGlobalPropertiesAsync`, `api.getVestingDelegations`, `api.getAssetsAsync`, `broadcast.*`, `auth.toWif`, `auth.wifToPublic`, SJCL decrypt).
  - behavior / transaction or read action: chain reads, operation signing/broadcast, invite WIF/public derivation, encrypted-key decrypt.
  - v3 equivalent file/function/UI: vendored libraries under `v3/vendor/golos/`; dynamic `loadScript`; `v3/js/auth.js`; `v3/js/broadcast.js` generic broadcast dispatch.
  - test coverage: JS syntax checks; smoke tests assert concrete method names/operation paths.
  - status: implemented

Remaining gaps/non-goals after recheck:
- No PHP, backend.dpos.space, legacy IP, or server-only UIA deposit API is implemented in the Golos wallet. API-only deposit address lookup is a documented backend-only non-goal; fixed metadata and 0.001 GOLOS request-transfer path remain static-safe.
- Legacy jQuery/Fancybox modal behavior is not reproduced exactly. v3 intentionally uses accessible `<details>`, fieldsets and status regions.
- Legacy liveblogs invite registration link display is not reproduced because it is an external legacy site helper; the static wallet preserves the on-chain create/claim operations and warns the user to save the invite secret.
- Real transaction tests are not run and must not be run in this pass; smoke tests validate prepared operation paths and secret redaction only.

### Rigorous parity: Golos / profiles

Scope for this section: only legacy `/blockchains/golos/apps/profiles` plus Golos chain-level JS helpers that this app used. v3 target stays static HTML/CSS/JS and may consolidate old subpages into profile sections and history filters, but every legacy file below is mapped.

Inspected legacy files:
- `/root/ai-projects/dpos.space/blockchains/golos/apps/profiles/index.php`
- `/root/ai-projects/dpos.space/blockchains/golos/apps/profiles/content.php`
- `/root/ai-projects/dpos.space/blockchains/golos/apps/profiles/config.json`
- `/root/ai-projects/dpos.space/blockchains/golos/apps/profiles/js/app.js`
- all `/root/ai-projects/dpos.space/blockchains/golos/apps/profiles/page/*.php`
- all `/root/ai-projects/dpos.space/blockchains/golos/apps/profiles/page/snippets/*.php`
- relevant shared legacy helpers: `/root/ai-projects/dpos.space/blockchains/golos/js/blockchain.js`, `/root/ai-projects/dpos.space/blockchains/golos/js/modal-accounts.js`, Golos vendored browser libs under `/root/ai-projects/dpos.space/blockchains/golos/js/`.

Matrix:
- legacy source file: `profiles/content.php`, `profiles/page/content.php`
  - legacy function/handler/form/control/helper: POST form with hidden `chain=golos`, `service=profiles`, text `user`, submit `узнать инфу`.
  - behavior / transaction or read action: profile username selection and landing.
  - v3 equivalent file/function/UI: `index.html` global route form; `v3/js/app.js` `routeForm` + `renderProfileRoute(chain, account)`; hash route `#chain=golos&app=profiles&account=<user>`.
  - test coverage: `tests/v3-route-coverage-smoke.js`, `tests/v3-profiles-smoke.js`.
  - status: implemented.
- legacy source file: `profiles/config.json`, `profiles/page/config.json`
  - legacy function/handler/form/control/helper: app metadata title/description.
  - behavior / transaction or read action: route label and description only.
  - v3 equivalent file/function/UI: `v3/js/chains.js` Golos base app `profiles` title/description.
  - test coverage: route coverage smoke loads app metadata.
  - status: intentionally different with reason: static v3 centralizes app metadata in `chains.js` instead of per-PHP `config.json`.
- legacy source file: `profiles/index.php`
  - legacy function/handler/form/control/helper: `generateAppPages()` select list for `userinfo`, `history`, `transfers`, `gp`, `donates`, rewards, mentions, votes, reputation, DAO, accounts, witness, blog/comments/feed/orders.
  - behavior / transaction or read action: old profile subpage dispatcher.
  - v3 equivalent file/function/UI: `v3/js/app.js` `renderProfile`, `renderHistoryQuickLinks`, `golosLegacyProfileLinks`; static profile consolidates account data and maps history-like subpages to `history` filters.
  - test coverage: `tests/v3-golos-profiles-parity-smoke.js` checks concrete Golos `select_ops` and all regression-prone legacy filter labels.
  - status: fixed in this pass.
- legacy source file: `profiles/index.php`
  - legacy function/handler/form/control/helper: donate modal uses `golos.api.getAccounts`, `golos.broadcast.donate(posting_key, golos_login, donate_to, donate_amount, {app/version/comment/target}, [])`.
  - behavior / transaction or read action: private-key-backed personal donate transaction.
  - v3 equivalent file/function/UI: Golos `donate` app in `v3/js/app.js` / `v3/js/broadcast.js`; profiles page links donation history only and does not ask for private keys.
  - test coverage: existing Golos donate/editor/broadcast smokes plus `tests/v3-golos-profiles-parity-smoke.js` for donate history filter.
  - status: intentionally different with reason: write operation belongs to explicit Golos donate app, not read-only profiles; no private keys in profiles app.
- legacy source file: `profiles/page/userinfo.php`
  - legacy function/handler/form/control/helper: requires `get_account`, `get_account_balances`, `get_dynamic_global_properties`, `get_chain_properties`, `get_config`, `get_ticker`, `get_follow_count`.
  - behavior / transaction or read action: account economics, balances, GP conversion, profile metadata/socials, stats, authorities, follower counts, UIA balances, frozen status.
  - v3 equivalent file/function/UI: `v3/js/profiles.js` `fetchAccount`, `enrichAccount`, `normalizeAccount`, `getBalances`, `economyRows`, `profileRows`, `activityRows`, `authorityRows`; `v3/js/app.js` `fetchGolosUiaBalances`, `renderGolosUiaProfileSection`, `renderSocialLinks`, `renderProfileMedia`.
  - test coverage: `tests/v3-profiles-smoke.js` checks Golos SG conversion, voting power/reputation/images/socials/UIA loader hook; `tests/v3-golos-profiles-parity-smoke.js` checks direct extras preservation.
  - status: implemented / fixed in this pass for direct extras.
- legacy source file: `profiles/page/followers.php`, snippets `Get_Followers.php`, `Get_Followings.php`
  - legacy function/handler/form/control/helper: Fancybox modal lists 10 followers or following via `GetFollowersCommand`/`GetFollowingCommand` with `blog` relation and pagination.
  - behavior / transaction or read action: read followers/following account lists.
  - v3 equivalent file/function/UI: `v3/js/app.js` `fetchGolosProfileExtras` calls `getFollowers(account,'','blog',11)` and `getFollowing(account,'','blog',11)`; `renderGolosLegacyDirectSections` shows accessible lists.
  - test coverage: `tests/v3-golos-profiles-parity-smoke.js` asserts direct RPC mapping and preserved rendered data source.
  - status: fixed in this pass.
- legacy source file: `profiles/page/delegations.php`, snippet `get_vesting_delegations.php`
  - legacy function/handler/form/control/helper: Fancybox modal calls `GetVestingDelegationsCommand($user, $from, 100, $type)` for delegated/received.
  - behavior / transaction or read action: read outgoing and incoming GP delegations.
  - v3 equivalent file/function/UI: `v3/js/app.js` `fetchGolosProfileExtras` calls `getVestingDelegations` for `delegated` and `received`; `renderGolosLegacyDirectSections` lists delegatee/delegator.
  - test coverage: `tests/v3-golos-profiles-parity-smoke.js`.
  - status: fixed in this pass.
- legacy source file: `profiles/page/delegat.php`, snippets `get_delegate.php`, `get_account_history_chunk.php`
  - legacy function/handler/form/control/helper: modal displays current witness votes/proxy and `account_witness_vote` history.
  - behavior / transaction or read action: read witness vote state and witness-vote history.
  - v3 equivalent file/function/UI: current votes/proxy in `profiles.js` `governanceRows`; history link `DAO / workers / witness votes` filters `account_witness_vote,account_witness_proxy`; write management lives in Golos `manage` app.
  - test coverage: `tests/v3-profiles-smoke.js` governance rows; `tests/v3-golos-profiles-parity-smoke.js` DAO filter.
  - status: implemented.
- legacy source file: `profiles/page/witness.php`, snippet `get_witness_by_account.php`
  - legacy function/handler/form/control/helper: `GetWitnessByAccountCommand` shows witness owner, URL, votes and props.
  - behavior / transaction or read action: read witness data for profile owner.
  - v3 equivalent file/function/UI: `v3/js/app.js` `fetchGolosProfileExtras` calls `getWitnessByAccount(account)` and `renderGolosLegacyDirectSections` displays witness rows.
  - test coverage: `tests/v3-golos-profiles-parity-smoke.js`.
  - status: fixed in this pass.
- legacy source file: `profiles/page/history.php`, `profiles/js/app.js`, snippet `get_account_history.php`
  - legacy function/handler/form/control/helper: dynamic operation multi-select, text query, `getHistory()` calls `golos.api.getAccountHistoryAsync(user, from, limit, {select_ops})`, filters query client-side, has “Ещё”.
  - behavior / transaction or read action: generic account history filtering.
  - v3 equivalent file/function/UI: `v3/js/history.js` `fetchAccountHistory`; `v3/js/app.js` `renderHistory` ops/query form; no PHP/AJAX dependency.
  - test coverage: `tests/v3-golos-profiles-parity-smoke.js` verifies Golos `select_ops` arg and normalization; existing history smokes.
  - status: implemented.
- legacy source file: `profiles/page/transfers.php`
  - legacy function/handler/form/control/helper: `getAccountHistoryChunk` with ops `transfer`, `transfer_to_vesting`, `claim`, `transfer_from_tip`, `transfer_to_tip`, `invite`, `invite_claim`.
  - behavior / transaction or read action: transfer/TIP/invite history table.
  - v3 equivalent file/function/UI: `golosLegacyProfileLinks` maps to static history filter with same ops.
  - test coverage: `tests/v3-golos-profiles-parity-smoke.js`.
  - status: fixed in this pass.
- legacy source file: `profiles/page/gp.php`
  - legacy function/handler/form/control/helper: ops `delegate_vesting_shares`, `transfer_to_vesting`, `withdraw_vesting`, `return_vesting_delegation`, `transfer_from_tip`; converts GESTS to GP using dynamic props.
  - behavior / transaction or read action: GP/vesting history.
  - v3 equivalent file/function/UI: profile economics show GP/SG conversion; static history filter uses same ops.
  - test coverage: `tests/v3-profiles-smoke.js`, `tests/v3-golos-profiles-parity-smoke.js`.
  - status: fixed in this pass.
- legacy source file: `profiles/page/donates.php`
  - legacy function/handler/form/control/helper: `getAccountHistoryChunk` op `donate`, target metadata rendering.
  - behavior / transaction or read action: donate history.
  - v3 equivalent file/function/UI: static history filter `ops=donate`; write donate remains Golos donate app.
  - test coverage: `tests/v3-golos-profiles-parity-smoke.js` checks donate fetch/normalization.
  - status: fixed in this pass.
- legacy source file: `profiles/page/author_rewards.php`, `curation_rewards.php`, `benefactor_rewards.php`
  - legacy function/handler/form/control/helper: filtered history ops `author_reward`, `curation_reward`, `comment_benefactor_reward`.
  - behavior / transaction or read action: reward history pages.
  - v3 equivalent file/function/UI: `golosLegacyProfileLinks` maps all reward pages to static `history` filters.
  - test coverage: `tests/v3-golos-profiles-parity-smoke.js`.
  - status: fixed in this pass.
- legacy source file: `profiles/page/comment_mention.php`, `votes.php`, `reputation.php`, `orders.php`
  - legacy function/handler/form/control/helper: filtered history ops `comment_mention`, `vote`, `account_reputation`, `fill_order`.
  - behavior / transaction or read action: mentions, votes/flags, reputation changes, internal market orders.
  - v3 equivalent file/function/UI: `golosLegacyProfileLinks` maps each to static `history` filters; operation details render key/value tables with account links.
  - test coverage: `tests/v3-golos-profiles-parity-smoke.js`.
  - status: fixed in this pass.
- legacy source file: `profiles/page/dao.php`
  - legacy function/handler/form/control/helper: filtered history ops `worker_request_vote`, `account_witness_vote`, `account_witness_proxy`, `worker_request`, `worker_request_delete`, `worker_state`.
  - behavior / transaction or read action: DAO/workers and governance events.
  - v3 equivalent file/function/UI: `golosLegacyProfileLinks` static history filter with exact op set; worker write forms are in Golos manage app, not profiles.
  - test coverage: `tests/v3-golos-profiles-parity-smoke.js`.
  - status: fixed in this pass.
- legacy source file: `profiles/page/accounts.php`
  - legacy function/handler/form/control/helper: filtered history ops `account_create`, `account_create_with_invite`, `account_update`, `account_metadata`.
  - behavior / transaction or read action: account creation/update/metadata history.
  - v3 equivalent file/function/UI: `golosLegacyProfileLinks` static history filter.
  - test coverage: `tests/v3-golos-profiles-parity-smoke.js`.
  - status: fixed in this pass.
- legacy source file: `profiles/page/blog-posts.php`, snippets `get_discussions_by_blog.php`, `discussions_by_blog.php`, `get_feed_history.php`, `get_dynamic_global_properties.php`, `get_config.php`
  - legacy function/handler/form/control/helper: `GetDiscussionsByBlogCommand`, excludes recent not-yet-paid posts for paid-post page, renders title, votes, beneficiaries, payout estimates.
  - behavior / transaction or read action: recent blog/reblog posts and post payout projections.
  - v3 equivalent file/function/UI: `v3/js/app.js` `fetchGolosProfileExtras` direct `getDiscussionsByBlog({limit:10,select_authors:[account]})`; `renderGolosContentList` shows recent blog links. Detailed reward/payout projection is not duplicated.
  - test coverage: `tests/v3-golos-profiles-parity-smoke.js` checks direct RPC mapping.
  - status: fixed in this pass / intentionally different with reason: exact PHP payout table mixed chain reward math and backend helper formatting; v3 exposes direct public post data and links, with raw account JSON kept separately.
- legacy source file: `profiles/page/posts_with_payment.php`
  - legacy function/handler/form/control/helper: `DiscussionsByBlog::get` paginates paid posts older than 7 days, uses reward fund/feed/config to calculate payouts.
  - behavior / transaction or read action: posts that received payouts.
  - v3 equivalent file/function/UI: direct blog list plus history reward filters; exact old paid-post payout table is not rebuilt.
  - test coverage: `tests/v3-golos-profiles-parity-smoke.js` covers direct blog RPC and reward filters.
  - status: intentionally different with reason: static-safe direct RPC can show post/reward primitives, but old page’s payout calculation/pagination is backend-heavy and not required as a separate PHP-style subpage.
- legacy source file: `profiles/page/comments.php`, snippet `GetContentReplies.php`
  - legacy function/handler/form/control/helper: `getDiscussionsByComments`/comments query for user comments, markdown rendered through PHP Parsedown.
  - behavior / transaction or read action: recent comments list and text preview.
  - v3 equivalent file/function/UI: `v3/js/app.js` `fetchGolosProfileExtras` calls direct `getDiscussionsByComments({limit:10,start_author:account})`; `renderGolosContentList` links comments.
  - test coverage: `tests/v3-golos-profiles-parity-smoke.js`.
  - status: fixed in this pass / intentionally different with reason: no PHP markdown renderer; v3 links direct content safely instead of injecting rendered markdown.
- legacy source file: `profiles/page/feed.php`
  - legacy function/handler/form/control/helper: custom `transliteration()`, feed/blog queries, tag links, feed of subscribers’ posts/reposts.
  - behavior / transaction or read action: feed/blog content list.
  - v3 equivalent file/function/UI: direct blog/comment lists in profile and external Golos links; no backend-style feed aggregation.
  - test coverage: `tests/v3-golos-profiles-parity-smoke.js` covers content RPC primitives.
  - status: intentionally different with reason: complete follower-feed aggregation is a separate content/feed app concern and would require larger pagination/aggregation; profiles v3 provides static-safe recent direct account content.
- legacy source file: snippets `getRewardFund.php`, `get_chain_properties.php`, `get_config.php`, `get_dynamic_global_properties.php`, `get_feed_history.php`, `get_ticker.php`
  - legacy function/handler/form/control/helper: chain economics helper commands used by profile economics and payout pages.
  - behavior / transaction or read action: read global chain state, config, feed/ticker/reward fund.
  - v3 equivalent file/function/UI: `v3/js/profiles.js` `enrichAccount` loads dynamic props/chain props/config/follow count/reward fund; calculator/manage modules load feed/ticker where those apps need it.
  - test coverage: `tests/v3-profiles-smoke.js` SG conversion and voting regeneration.
  - status: implemented.
- legacy source file: `profiles/page/snippets/get_account_balances.php`
  - legacy function/handler/form/control/helper: `GetAccountsBalancesCommand` for UIA balances.
  - behavior / transaction or read action: UIA balances for account.
  - v3 equivalent file/function/UI: `v3/js/app.js` `fetchGolosUiaBalances` uses `getAccountsBalances`/`getAccountsBalancesAsync` or direct JSON-RPC fallback.
  - test coverage: `tests/v3-profiles-smoke.js`, UIA smoke.
  - status: implemented.
- legacy source file: `blockchains/golos/js/blockchain.js`
  - legacy function/handler/form/control/helper: node failover (`checkWorkingNode`), auth variables, `sendAjax`, `getLoad` AJAX pagination, `.ajax_modal`, `copyText`, GolosDex init.
  - behavior / transaction or read action: shared Golos runtime, PHP AJAX pagination/modals.
  - v3 equivalent file/function/UI: `v3/js/profiles.js` `connect` with public node failover and `golos_node` persistence; `v3/js/app.js` static hash routing and accessible details sections replace Fancybox/PHP AJAX; DEX lives outside profiles.
  - test coverage: profile/history/route smokes.
  - status: implemented / intentionally different with reason: no PHP AJAX/Fancybox in static v3.
- legacy source file: `blockchains/golos/js/modal-accounts.js`
  - legacy function/handler/form/control/helper: save/select/delete account, OAuth login/logout, SJCL key validation/storage.
  - behavior / transaction or read action: auth and saved account compatibility used by donate modal and global header.
  - v3 equivalent file/function/UI: `v3/js/auth.js` existing localStorage schema compatibility; profile app itself remains read-only.
  - test coverage: `tests/v3-auth-broadcast-smoke.js`, account auth smoke.
  - status: implemented / profiles-specific non-goal for private-key flows.
- legacy source file: vendored `golos.min.js`, `sjcl.min.js`, `golos-dex.min.js`, `jquery-ui.js`
  - legacy function/handler/form/control/helper: browser blockchain/client libraries and UI library.
  - behavior / transaction or read action: RPC, crypto, DEX, jQuery UI.
  - v3 equivalent file/function/UI: `v3/vendor/golos/golos.min.js`, `v3/vendor/golos/sjcl.min.js`, optional `golos-dex.min.js`; vanilla DOM UI replaces jQuery UI.
  - test coverage: syntax/smoke tests and static library path checks.
  - status: implemented / intentionally different with reason: no jQuery UI dependency in v3 profiles.

Recheck after implementation:
- Static-safe gaps fixed in this pass: legacy profile quick links now map every history-backed subpage to concrete `history` filters; followers/following, vesting delegations, witness, blog posts, and comments are loaded through direct public Golos RPC extras when available.
- Remaining intentional differences/non-goals: profile-local donate write modal is moved to explicit Golos donate app; exact PHP payout tables and follower feed aggregation are not rebuilt as separate backend-style subpages; v3 links direct content and exposes read-only public RPC data instead.


### Rigorous parity: Golos / stakebot

Scope guard: this section covers only legacy `/blockchains/golos/apps/stakebot` plus shared Golos JS/template files that the app could inherit. It does not audit or implement any next Golos app.

Files inspected in this one-app pass:

- `/root/ai-projects/dpos.space/blockchains/golos/apps/stakebot/config.json`
- `/root/ai-projects/dpos.space/blockchains/golos/apps/stakebot/index.php`
- `/root/ai-projects/dpos.space/blockchains/golos/apps/stakebot/content.php`
- `/root/ai-projects/dpos.space/blockchains/golos/apps/stakebot/pages/jackpot/config.json`
- `/root/ai-projects/dpos.space/blockchains/golos/apps/stakebot/pages/jackpot/content.php`
- `/root/ai-projects/dpos.space/blockchains/golos/apps/stakebot/pages/loto/config.json`
- `/root/ai-projects/dpos.space/blockchains/golos/apps/stakebot/pages/loto/content.php`
- `/root/ai-projects/dpos.space/blockchains/golos/js/blockchain.js`
- `/root/ai-projects/dpos.space/blockchains/golos/js/modal-accounts.js`
- `/root/ai-projects/dpos.space/blockchains/golos/js/golos.min.js`, `sjcl.min.js`, `golos-dex.min.js`, `jquery-ui.js` checked as chain-level libraries; stakebot itself did not call their functions directly.

Matrix:

- legacy source file: `stakebot/config.json`
  - legacy function/handler/form/control/helper: app metadata (`title`, `description`, `in_menu: Stake_bot`, `category: games`).
  - behavior / transaction or read action: exposes a games menu entry named Stake_bot for the current bids page.
  - v3 equivalent file/function/UI: `v3/js/chains.js` adds Golos app `{ id: 'stakebot', title: 'Stake bot', accountField: false }`.
  - test coverage: `tests/v3-golos-stakebot-smoke.js` asserts route exposure and no account field.
  - status: fixed in this pass.
- legacy source file: `stakebot/index.php`
  - legacy function/handler/form/control/helper: `generateAppPages($blockchain_snippet)`, `pageUrl()[2]`, `is_dir(__DIR__.'/pages/'.$page)`, page config/content include.
  - behavior / transaction or read action: dispatches only nested pages under `stakebot/pages/<page>` and prepends the chain snippet; no direct blockchain transaction.
  - v3 equivalent file/function/UI: `v3/js/app.js` `renderGolosStakebot(chain, state)` uses `stakebotPage` hash state with `bids`, `jackpot`, `loto`, and labelled subpage nav.
  - test coverage: `tests/v3-golos-stakebot-smoke.js` asserts `stakebotPage`, dedicated renderer, dispatch, labelled nav, active `aria-current`.
  - status: fixed in this pass / intentionally different with reason: static hash state replaces PHP path/page include.
- legacy source file: `stakebot/content.php`
  - legacy function/handler/form/control/helper: `file_get_contents('http://178.20.43.121:3000/golos-api?service=stakebot&type=bids')`, `json_decode`, generated links to `jackpot`, `loto`, `golos/profiles/golos-stake-bot/donates`, table `#table/#target` with columns `№`, `Логин`, `Сумма`.
  - behavior / transaction or read action: backend read of current bids; list reset at 18:00 Moscow; renders account links and GOLOS amounts.
  - v3 equivalent file/function/UI: `renderGolosStakebot` bids page preserves the reset explanation, links to v3 `history`/`profiles` for `golos-stake-bot`, and shows an accessible table documenting legacy fields as backend-only.
  - test coverage: `tests/v3-golos-stakebot-smoke.js` checks the concrete title, history link, table caption/fields, and absence of legacy backend endpoint/PHP fetch strings.
  - status: fixed in this pass for static-safe informational/link parity; backend-only non-goal for live participants/amount rows because the data came from a private server endpoint and bot state.
- legacy source file: `stakebot/pages/jackpot/config.json`
  - legacy function/handler/form/control/helper: nested page metadata title/description for jackpot participants.
  - behavior / transaction or read action: titles the jackpot page.
  - v3 equivalent file/function/UI: `renderGolosStakebot` `stakebotPage=jackpot` with `h2` `Джекпот golos_stake_bot`.
  - test coverage: `tests/v3-golos-stakebot-smoke.js`.
  - status: fixed in this pass.
- legacy source file: `stakebot/pages/jackpot/content.php`
  - legacy function/handler/form/control/helper: `file_get_contents('http://178.20.43.121:3000/golos-api?service=stakebot&type=jackpot')`, `json_decode`, optional `amount`, table rows from `result.data`, back link, history-of-donates link.
  - behavior / transaction or read action: backend read of jackpot amount and participant accounts; explains monthly clearing at 00:00 GMT/03:00 Moscow on the 1st and fund as 5% of participant bids.
  - v3 equivalent file/function/UI: `renderGolosStakebot` jackpot page preserves clearing/fund rules and links to v3 bot history/profile; live amount/table are documented as backend-only.
  - test coverage: `tests/v3-golos-stakebot-smoke.js` checks jackpot text and no backend endpoint usage.
  - status: fixed in this pass for static-safe informational/link parity; backend-only non-goal for live jackpot amount/participant list.
- legacy source file: `stakebot/pages/loto/config.json`
  - legacy function/handler/form/control/helper: nested page metadata title/description for CLAIM lottery tickets.
  - behavior / transaction or read action: titles the loto page.
  - v3 equivalent file/function/UI: `renderGolosStakebot` `stakebotPage=loto` with `h2` `Лотерея golos_stake_bot` and rules.
  - test coverage: `tests/v3-golos-stakebot-smoke.js`.
  - status: fixed in this pass.
- legacy source file: `stakebot/pages/loto/content.php`
  - legacy function/handler/form/control/helper: `file_get_contents('http://178.20.43.121:3000/golos-api?service=stakebot&type=loto')`, `nl2br`, back link, Telegram link to `https://t.me/golos_stake_bot`.
  - behavior / transaction or read action: backend text list of lottery tickets; static rules: twice daily at midnight/noon Moscow, threshold `50000 GESTS (18000 СГ)`, participate by starting Telegram bot and authorizing Golos account.
  - v3 equivalent file/function/UI: `renderGolosStakebot` loto page preserves rules and Telegram link; backend ticket text is documented as omitted.
  - test coverage: `tests/v3-golos-stakebot-smoke.js` checks loto text, threshold, Telegram link, and no backend endpoint usage.
  - status: fixed in this pass for static-safe informational/link parity; backend-only non-goal for live ticket list.
- legacy source file: `blockchains/golos/js/blockchain.js`
  - legacy function/handler/form/control/helper: `checkWorkingNode`, current-user auth/key display, `sendAjax`, AJAX pagination `getLoad`, `.ajax_modal`, `copyText`, `getParameterByName`, GolosDex init.
  - behavior / transaction or read action: shared runtime helpers available globally to Golos pages; stakebot content did not bind forms/buttons or call these helpers directly.
  - v3 equivalent file/function/UI: `v3/js/profiles.js` public node failover and `golos_node`; `v3/js/app.js` static router and semantic nav/table; no Fancybox/PHP AJAX required for stakebot.
  - test coverage: `tests/v3-golos-stakebot-smoke.js` plus existing route/auth smokes for shared runtime.
  - status: implemented / intentionally different with reason: stakebot has no local transaction/helper flow; PHP AJAX/modal helpers are not restored in static v3.
- legacy source file: `blockchains/golos/js/modal-accounts.js`
  - legacy function/handler/form/control/helper: `saveAccount`, `pass_gen`, OAuth login/logout, localStorage `golos_users` and `golos_current_user` management.
  - behavior / transaction or read action: shared auth modal; stakebot pages are read-only and did not require an account form.
  - v3 equivalent file/function/UI: `v3/js/auth.js` preserves account storage compatibility globally; stakebot route sets `accountField: false`.
  - test coverage: `tests/v3-golos-stakebot-smoke.js` asserts no account field; auth compatibility remains covered by existing auth tests.
  - status: implemented / intentionally different with reason: no stakebot transaction or auth-gated form exists to port.
- legacy source file: chain-level vendored libraries `golos.min.js`, `sjcl.min.js`, `golos-dex.min.js`, `jquery-ui.js`
  - legacy function/handler/form/control/helper: RPC/signing/crypto/DEX/UI libraries included at chain level.
  - behavior / transaction or read action: generic support libraries; stakebot app-local PHP rendered backend data and had no app-local JS operation builder.
  - v3 equivalent file/function/UI: existing `v3/vendor/golos/*` libraries remain for other Golos apps; stakebot renderer is static HTML and does not load extra libraries.
  - test coverage: `tests/v3-route-coverage-smoke.js` checks vendored Golos paths; `tests/v3-golos-stakebot-smoke.js` checks stakebot has no backend/PHP dependency.
  - status: implemented / intentionally different with reason: no jQuery UI or DEX dependency is needed for this read-only/static informational page.

Gaps identified after matrix:

- Static-safe gap before this pass: Golos `stakebot` was documented only as a generic backend-service placeholder and was not exposed as a concrete static page/route with jackpot/loto informational parity.
- Backend-only gaps intentionally not implemented: live bids table, jackpot amount/table, and loto ticket list, all sourced exclusively from `http://178.20.43.121:3000/golos-api?service=stakebot&type=...`; restoring them would resurrect a private backend/bot dependency and stale server state.

Recheck after implementation:

- `v3/js/chains.js` exposes only the Golos `stakebot` route needed for this app; no other Golos app or chain was added.
- `v3/js/app.js` has a dedicated static `renderGolosStakebot` with subpage nav for `bids`, `jackpot`, `loto`, v3 profile/history links for `golos-stake-bot`, and exact backend-only warnings.
- `tests/v3-golos-stakebot-smoke.js` covers route exposure, concrete legacy text/rules/links, screen-reader nav markers, table-field documentation, and absence of `178.20.43.121`, `golos-api?service=stakebot`, `file_get_contents`, and `backend.dpos.space` runtime dependencies.
- Remaining gaps are precise backend-only non-goals above; no broken placeholder was added.

### Rigorous parity: Golos / swap

Scope lock: this section covers only legacy `blockchains/golos/apps/swap` and shared Golos frontend helpers needed by that app. No other Golos app is marked complete here.

Files inspected for this one-app pass:

- `blockchains/golos/apps/swap/config.json`
- `blockchains/golos/apps/swap/index.php`
- `blockchains/golos/apps/swap/content.php`
- `blockchains/golos/apps/swap/js/app.js`
- `blockchains/golos/apps/swap/pages/my-orders/config.json`
- `blockchains/golos/apps/swap/pages/my-orders/content.php`
- `blockchains/golos/js/golos-dex.min.js`
- `blockchains/golos/js/golos.min.js`
- `blockchains/golos/js/blockchain.js`
- `blockchains/golos/js/modal-accounts.js`
- `blockchains/golos/js/sjcl.min.js`

Parity matrix:

- legacy source file: `blockchains/golos/apps/swap/config.json`
  - legacy function/handler/form/control/helper: app metadata (`title`, `description`, `in_menu`, `category`).
  - behavior / transaction or read action: exposes Swap in tools menu as GOLOS/GBG/UIA exchange service.
  - v3 equivalent file/function/UI: `v3/js/chains.js` Golos app `swap`, `v3/js/app.js:renderSwap` title/description.
  - test coverage: `tests/v3-route-coverage-smoke.js`; `tests/v3-golos-swap-smoke.js` verifies swap UI/DEX markers.
  - status: implemented.

- legacy source file: `blockchains/golos/apps/swap/index.php`
  - legacy function/handler/form/control/helper: `generateAppPages($blockchain_snippet)` page dispatcher and `pages/<page>/content.php` inclusion.
  - behavior / transaction or read action: routes base swap and nested `my-orders`; prepends shared blockchain snippet/auth controls.
  - v3 equivalent file/function/UI: static SPA router dispatches `chain=golos&app=swap` to one accessible `renderSwap` surface; my-orders behavior is included inside the same static page as read-only open orders plus cancel form.
  - test coverage: `tests/v3-route-coverage-smoke.js`; `tests/v3-golos-swap-smoke.js` checks open-orders/cancel/create forms.
  - status: intentionally different with reason — static v3 has no PHP include system; one route preserves the actual swap/my-orders functions without PHP paths.

- legacy source file: `blockchains/golos/apps/swap/content.php`
  - legacy function/handler/form/control/helper: `#active_auth_msg`, `#active_page`, link to `/golos/swap/my-orders[/sell/buy]`.
  - behavior / transaction or read action: requires active key; points to order management page while preserving pair suffix.
  - v3 equivalent file/function/UI: `bindOperationForm`/`DposBroadcast.prepare` require active authority for direct exchange/create/cancel; v3 exposes direct exchange, limit order and open-orders sections on one static page.
  - test coverage: `tests/v3-golos-swap-smoke.js` asserts active `sendOperations`, `createLimitOrder`, `cancelOrder` prepare paths.
  - status: implemented.

- legacy source file: `blockchains/golos/apps/swap/content.php`
  - legacy function/handler/form/control/helper: direct swap form controls `#sell_token`, `#sell_amount`, `#max_amount`, `#buy_token`, readonly `#buy_amount`, hidden `#pr1/#pr2`, `#market_fee`, `#market_price`, `#action_buy_token`, `#orders_history`.
  - behavior / transaction or read action: user selects sell token from non-zero balances, selects buy token from allowed GOLOS/GBG/UIA pair list, previews computed buy amount/market price/fee, then sends direct exchange.
  - v3 equivalent file/function/UI: `renderSwap` direct form `swap-direct-form`; `golos-swap-load-tokens`, datalists `golos-swap-sell-symbols`/`golos-swap-buy-symbols`, `golos-swap-max-amount`; `buildGolosDirectExchangePrepared` returns sanitized preview with input/output/best_price/steps.
  - test coverage: `tests/v3-golos-swap-smoke.js` checks token loader, datalists, maximum hint, DEX quote and operation-chain preview.
  - status: fixed in this pass — previous v3 had direct inputs but did not expose legacy-style balance/pair/max hints.

- legacy source file: `blockchains/golos/apps/swap/pages/my-orders/config.json`
  - legacy function/handler/form/control/helper: subpage metadata for order management.
  - behavior / transaction or read action: labels page as creation/change/deletion of orders.
  - v3 equivalent file/function/UI: `renderSwap` sections `swap-create-form`, `swap-cancel-form`, `swap-open-orders-load`.
  - test coverage: `tests/v3-golos-swap-smoke.js` checks these forms and operation names.
  - status: implemented.

- legacy source file: `blockchains/golos/apps/swap/pages/my-orders/content.php`
  - legacy function/handler/form/control/helper: link back to instant exchange and order form controls `#sell_token`, `#sell_amount`, `#buy_token`, editable `#buy_amount`, `#order_endtime`, `#action_create_order`, table `#my_orders_list`.
  - behavior / transaction or read action: creates limit order with expiration in hours and displays current open orders for the selected pair.
  - v3 equivalent file/function/UI: `swap-create-form` accepts explicit order id, sell asset, buy asset, fill-or-kill checkbox and UTC expiration; `swap-open-orders-load` reads current open orders through public RPC.
  - test coverage: `tests/v3-golos-swap-smoke.js` checks `createLimitOrder` and `getOpenOrders`; `tests/v3-route-coverage-smoke.js` checks read-only open orders.
  - status: intentionally different with reason — v3 uses explicit UTC expiration instead of legacy “hours from now” because static preview/send should show the exact timestamp before broadcast; operation payload remains `limit_order_create`.

- legacy source file: `blockchains/golos/apps/swap/js/app.js`
  - legacy function/handler/form/control/helper: `Number.prototype.toFixedNoRounding(n)`.
  - behavior / transaction or read action: truncates amounts to token precision without rounding before quoting or broadcasting.
  - v3 equivalent file/function/UI: `formatFixedNoRounding(value, precision, label)` used by direct exchange; generic limit order uses `normalizeAssetInput` because user enters exact chain asset string.
  - test coverage: `tests/v3-golos-swap-smoke.js` checks direct exchange path uses precision lookup and DEX amount building; syntax checks cover helper.
  - status: implemented.

- legacy source file: `blockchains/golos/apps/swap/js/app.js`
  - legacy function/handler/form/control/helper: `getPrices({ amount, symbol, direction })`.
  - behavior / transaction or read action: calls `dex.getExchange({ node: 'wss://api-full.golos.id/ws', amount, symbol, direction: 'sell' })` and returns direct/best quote.
  - v3 equivalent file/function/UI: `buildGolosDirectExchangePrepared` calls `dex.getExchange({ node: bestGolosRpcNode(chain), amount, symbol: buySymbol, direction: 'sell' })`.
  - test coverage: `tests/v3-golos-swap-smoke.js` asserts `dex.getExchange`, `direction: 'sell'`, and public node/DEX bootstrap.
  - status: implemented.

- legacy source file: `blockchains/golos/apps/swap/js/app.js`
  - legacy function/handler/form/control/helper: `creationOrder` (`creationOrder(sell_amount, selected_sell_token, selected_buy_token, fee1, fee2, pr1, pr2)`).
  - behavior / transaction or read action: clears buy/fee/price, disables action, formats sell amount by precision, fetches DEX quote, chooses `direct || best`, validates output symbol, fills readonly buy amount, displays best price and fee, stores `window.currentExchangeSteps`.
  - v3 equivalent file/function/UI: `buildGolosDirectExchangePrepared` formats sell amount, chooses `quote.direct || quote.best || quote`, validates `path.res` output symbol, includes `best_price` and `steps` in sanitized preview; no private key is included.
  - test coverage: `tests/v3-golos-swap-smoke.js` checks quote selection markers, output-symbol validation, `steps: path.steps`, no backend hosts.
  - status: implemented.

- legacy source file: `blockchains/golos/apps/swap/js/app.js`
  - legacy function/handler/form/control/helper: `checkApprovedToken(asset)`.
  - behavior / transaction or read action: populates buy token choices from GOLOS/GBG and UIA `symbols_whitelist`; for UIA sell token, either uses whitelist or falls back to GOLOS/GBG/all UIA.
  - v3 equivalent file/function/UI: `loadGolosSwapAccountAssets`, `golosSwapBuySymbolsForSell`, `renderGolosSwapTokenHints`, datalist pair hints.
  - test coverage: `tests/v3-golos-swap-smoke.js` asserts `getAssetsAsync`, `symbols_whitelist`, GOLOS/GBG fallback, datalist controls.
  - status: fixed in this pass.

- legacy source file: `blockchains/golos/apps/swap/js/app.js`
  - legacy function/handler/form/control/helper: `sellTokens(max_amounts)`.
  - behavior / transaction or read action: displays max balance for currently selected sell token and refreshes allowed buy tokens.
  - v3 equivalent file/function/UI: `renderGolosSwapTokenHints` updates `golos-swap-max-amount` and buy-token datalist after loading balances and on sell token change.
  - test coverage: `tests/v3-golos-swap-smoke.js` asserts maximum hint and `loadGolosSwapAccountAssets` RPC calls.
  - status: fixed in this pass.

- legacy source file: `blockchains/golos/apps/swap/js/app.js`
  - legacy function/handler/form/control/helper: `orderConfig(selected_sell_token, selected_buy_token)`.
  - behavior / transaction or read action: calls `getAssetsAsync('', [sell,buy])`, resolves UIA precision and `fee_percent / 100`, writes hidden `#pr1/#pr2`.
  - v3 equivalent file/function/UI: `getGolosTokenPrecision` fetches UIA precision for direct exchange; direct preview includes DEX price/steps. UIA fee display is not separately recalculated in v3 because `makeExchangeTx` builds exact operations from Golos DEX steps and fee is visible in the DEX quote/operation preview rather than a separate DOM field.
  - test coverage: `tests/v3-golos-swap-smoke.js` checks precision and DEX operation-chain preview.
  - status: intentionally different with reason — operation semantics are preserved; separate fee label is replaced by sanitized structured preview.

- legacy source file: `blockchains/golos/apps/swap/js/app.js`
  - legacy function/handler/form/control/helper: `main()` account/balance initialization.
  - behavior / transaction or read action: reads `getAccountsAsync([golos_login])` for GOLOS/GBG, `getAccountsBalancesAsync([golos_login])` for UIA balances; my-orders page also lists zero-balance GOLOS/GBG/all UIA so orders can be viewed/cancelled.
  - v3 equivalent file/function/UI: `loadGolosSwapAccountAssets` reads account/UIA balances; `swap-open-orders-load` is not pair-limited and can show all account open orders through public RPC; create/cancel forms allow manual symbols/order id.
  - test coverage: `tests/v3-golos-swap-smoke.js` checks account balance/UIA balance RPCs and open-orders RPC.
  - status: fixed in this pass for balance/pair hints; implemented for open-order visibility.

- legacy source file: `blockchains/golos/apps/swap/js/app.js`
  - legacy function/handler/form/control/helper: `#sell_token change`.
  - behavior / transaction or read action: refreshes maximum and buy-token options.
  - v3 equivalent file/function/UI: `bindGolosSwapTokenLoader` attaches `change` handler to `#swap-direct-sell-symbol` and re-renders hints.
  - test coverage: `tests/v3-golos-swap-smoke.js` asserts loader/hint functions and datalists.
  - status: fixed in this pass.

- legacy source file: `blockchains/golos/apps/swap/js/app.js`
  - legacy function/handler/form/control/helper: `#buy_token change`.
  - behavior / transaction or read action: updates path `/golos/swap[/my-orders]/SELL/BUY`, recalculates precision/quote, reloads my orders.
  - v3 equivalent file/function/UI: static hash route does not encode pair suffix; the current pair remains in fields. Quote recalculation happens on preview/send; open orders can be reloaded with button.
  - test coverage: `tests/v3-golos-swap-smoke.js` covers quote/read RPC functions.
  - status: intentionally different with reason — static hash router avoids legacy PHP path suffixes while preserving exchange/read actions.

- legacy source file: `blockchains/golos/apps/swap/js/app.js`
  - legacy function/handler/form/control/helper: `#sell_amount change`.
  - behavior / transaction or read action: validates amount >0 and <= max, enables/disables direct exchange, recalculates quote.
  - v3 equivalent file/function/UI: HTML required input plus `formatFixedNoRounding` positive number validation; max is shown as guidance after loading balances; preview/send prepares quote only when user submits.
  - test coverage: `tests/v3-golos-swap-smoke.js` checks positive amount formatting/quote path markers.
  - status: intentionally different with reason — v3 does not silently auto-query on every edit; explicit preview avoids accidental live RPC churn while keeping max visible.

- legacy source file: `blockchains/golos/apps/swap/js/app.js`
  - legacy function/handler/form/control/helper: `#buy_amount change`.
  - behavior / transaction or read action: on my-orders editable buy amount, updates displayed market price as buy/sell.
  - v3 equivalent file/function/UI: limit-order form takes exact sell and buy assets; preview shows `amount: sell → buy` before send.
  - test coverage: `tests/v3-golos-swap-smoke.js` checks limit-order prepare path.
  - status: intentionally different with reason — static form preview replaces jQuery inline price label; operation payload remains exact.

- legacy source file: `blockchains/golos/apps/swap/js/app.js`
  - legacy function/handler/form/control/helper: `#max_amount click`.
  - behavior / transaction or read action: copies max balance to sell amount and recalculates direct quote.
  - v3 equivalent file/function/UI: `golos-swap-max-amount` displays max balance for copy/manual use.
  - test coverage: `tests/v3-golos-swap-smoke.js` asserts max hint.
  - status: intentionally different with reason — no automatic value overwrite; safer for accessible/static form users and still exposes exact maximum.

- legacy source file: `blockchains/golos/apps/swap/js/app.js`
  - legacy function/handler/form/control/helper: `#action_buy_token click`.
  - behavior / transaction or read action: confirms direct exchange, calls `dex.makeExchangeTx(window.currentExchangeSteps, { owner: golos_login, fill_or_kill: true })`, broadcasts `golos.broadcast.sendOperationsAsync(operations, active_key)`, reloads on success.
  - v3 equivalent file/function/UI: `buildGolosDirectExchangePrepared` calls `dex.makeExchangeTx(path.steps, { owner, fill_or_kill: true })` and prepares `sendOperations`; `DposBroadcast.broadcast` executes `sendOperationsAsync(prepared.params[0], key)` only after explicit send confirmation.
  - test coverage: `tests/v3-golos-swap-smoke.js` asserts `makeExchangeTx`, `fill_or_kill: true`, `sendOperations`, and broadcast execution path.
  - status: implemented.

- legacy source file: `blockchains/golos/apps/swap/js/app.js`
  - legacy function/handler/form/control/helper: `#action_create_order click`.
  - behavior / transaction or read action: confirms, creates preferred order id `Math.floor(Date.now()/1000)`, converts hours to ISO expiration, broadcasts `limitOrderCreateAsync(active_key, owner, orderid, amount_to_sell, min_to_receive, false, expiration)`.
  - v3 equivalent file/function/UI: `swap-create-form` prepares `createLimitOrder` with active authority, explicit order id, exact asset strings, fill-or-kill checkbox, and explicit UTC expiration.
  - test coverage: `tests/v3-golos-swap-smoke.js` asserts `swap-create-form` and `createLimitOrder` prepare path.
  - status: intentionally different with reason — user-visible order id/UTC expiration make preview deterministic; same transaction operation is preserved.

- legacy source file: `blockchains/golos/apps/swap/js/app.js`
  - legacy function/handler/form/control/helper: `myOrders()`.
  - behavior / transaction or read action: reads selected sell/buy pair, calls `golos.api.getOpenOrdersAsync(golos_login, [sell_token, buy_token])`, renders created date, sell_price base/quote, real price, delete link.
  - v3 equivalent file/function/UI: `loadGrapheneOpenOrders(chain, auth.getCurrentLogin(chain))` calls public RPC `getOpenOrders`; `renderOrderRows` renders price/base/quote/raw details; cancel form handles deletion.
  - test coverage: `tests/v3-golos-swap-smoke.js` and `tests/v3-route-coverage-smoke.js` assert `getOpenOrders` and cancel form.
  - status: implemented.

- legacy source file: `blockchains/golos/apps/swap/js/app.js`
  - legacy function/handler/form/control/helper: `deleteOrder(orderid)`.
  - behavior / transaction or read action: confirm deletion, broadcasts `limitOrderCancelAsync(active_key, golos_login, orderid)`, refreshes `myOrders()`.
  - v3 equivalent file/function/UI: `swap-cancel-form` prepares `cancelOrder` with active authority and order id; user can reload open orders after send.
  - test coverage: `tests/v3-golos-swap-smoke.js` asserts `cancelOrder`; route coverage checks open-orders button.
  - status: implemented.

- legacy source file: `blockchains/golos/apps/swap/js/app.js`
  - legacy function/handler/form/control/helper: `fast_str_replace`, `date_str`.
  - behavior / transaction or read action: formats open-order timestamps for table.
  - v3 equivalent file/function/UI: `renderOrderRows` renders available rows/raw JSON; dates appear if returned in raw/details rather than custom `date_str` formatting.
  - test coverage: `tests/v3-golos-swap-smoke.js` checks open-orders rendering path exists via `renderOrderRows`/RPC markers indirectly.
  - status: intentionally different with reason — display formatting is simplified but read action and cancel/create semantics are preserved.

- legacy source file: `blockchains/golos/js/golos-dex.min.js`
  - legacy function/handler/form/control/helper: `GolosDexApi`, `getExchange`, `makeExchangeTx`, default API host `https://api-dex.golos.app`.
  - behavior / transaction or read action: wraps Golos DEX quote API/Golos `getExchange`; `makeExchangeTx` converts DEX steps/subchains into `limit_order_create` operations with owner, `amount_to_sell`, `min_to_receive`, `fill_or_kill`, expiration/order id.
  - v3 equivalent file/function/UI: vendored `v3/vendor/golos/golos-dex.min.js`; `ensureGolosDex`; direct exchange uses `dex.getExchange` then `dex.makeExchangeTx`.
  - test coverage: `tests/v3-golos-swap-smoke.js` verifies vendored path, bootstrap, DEX host, `getExchange`, `makeExchangeTx`, `fill_or_kill`.
  - status: implemented.

- legacy source file: `blockchains/golos/js/golos.min.js`
  - legacy function/handler/form/control/helper: Golos browser library RPC/broadcast methods used by swap (`getExchange`, `getAssetsAsync`, `getAccountsAsync`, `getAccountsBalancesAsync`, `getOpenOrdersAsync`, `limitOrderCreateAsync`, `limitOrderCancelAsync`, `sendOperationsAsync`).
  - behavior / transaction or read action: public RPC reads and signed active-key broadcasts.
  - v3 equivalent file/function/UI: `v3/vendor/golos/golos.min.js`, `profiles.connect/apiCall`, `DposBroadcast.broadcast`.
  - test coverage: `tests/v3-golos-swap-smoke.js` checks calls/wrappers; required syntax checks cover source.
  - status: implemented.

- legacy source file: `blockchains/golos/js/blockchain.js`
  - legacy function/handler/form/control/helper: `checkWorkingNode`, `golos_current_user`, SJCL decrypt of posting/active keys, `#active_auth_msg`/`#active_page` gating, OAuth setup.
  - behavior / transaction or read action: chooses working public node; hides swap if active key absent; supports local encrypted keys and Golos OAuth/multiauth.
  - v3 equivalent file/function/UI: `v3/js/chains.js` node list; `v3/js/auth.js` legacy localStorage compatibility; `v3/js/broadcast.js` decrypts legacy active key and verifies authority; OAuth backend flow is not reintroduced.
  - test coverage: existing auth/broadcast smoke tests plus `tests/v3-golos-swap-smoke.js` active operation assertions.
  - status: implemented for local static key path; backend/OAuth signing intentionally different with reason — static v3 has no `https://golos.app/api/oauth/sign` backend session dependency.

- legacy source file: `blockchains/golos/js/modal-accounts.js`
  - legacy function/handler/form/control/helper: `saveAccount`, active/posting public key validation, localStorage schema, OAuth permission list including `limit_order_create` and `limit_order_cancel`.
  - behavior / transaction or read action: saves encrypted active key that swap needs; grants OAuth operation permissions.
  - v3 equivalent file/function/UI: existing auth compatibility reads `<chain>_current_user`/`<chain>_users`; `DposBroadcast.prepare(..., 'active', ...)` enforces active key for swap operations.
  - test coverage: existing v3 auth/broadcast smoke coverage; `tests/v3-golos-swap-smoke.js` checks active operation prepare paths and no key-in-params sendOperations.
  - status: implemented for local encrypted key; OAuth permission flow intentionally different with reason — no static-safe OAuth signer backend.

- legacy source file: `blockchains/golos/js/sjcl.min.js`
  - legacy function/handler/form/control/helper: SJCL encryption/decryption of local private keys.
  - behavior / transaction or read action: decrypts legacy active key by password namespace `dpos.space_golos_<login>_activeKey` before broadcast.
  - v3 equivalent file/function/UI: `v3/vendor/golos/sjcl.min.js`; `DposBroadcast.decryptLegacyKey`/auth compatibility.
  - test coverage: existing v3 broadcast/key smoke tests; `tests/v3-golos-swap-smoke.js` verifies no private key is passed in operation params/log preview path.
  - status: implemented.

Gaps found and handled in this pass:

- Added legacy-style Golos swap balance/pair/max helper UI (`golos-swap-load-tokens`, datalists, max hint) using static-safe public Golos RPC.
- Added focused `tests/v3-golos-swap-smoke.js` to lock direct DEX exchange, UIA whitelist pair hints, create/cancel order, open-orders RPC, vendored DEX, `sendOperations`, and no backend host regression.

Recheck after changes:

- The matrix above was re-opened after implementation. Remaining differences are intentional static-v3 differences: no PHP path subpage, no OAuth signer backend, explicit UTC expiration/order id instead of implicit jQuery-generated values, explicit preview/send instead of auto-quote on every field mutation, and no automatic max overwrite.

### Rigorous parity: Golos / top

Scope lock for this stop-gate: only legacy `blockchains/golos/apps/top` is audited and changed here. Wallet, witnesses-rewards, VIZ/Steem/Hive/Minter/Decimal and any other apps are explicitly out of scope for this pass.

Legacy files fully inventoried for this app:

- `blockchains/golos/apps/top/config.json`
- `blockchains/golos/apps/top/content.php`
- `blockchains/golos/apps/top/index.php`
- `blockchains/golos/apps/top/js/app.js`
- `blockchains/golos/apps/top/pages/config.json`
- `blockchains/golos/apps/top/pages/top.php`
- `blockchains/golos/apps/top/pages/uia.php`

Referenced/shared Golos helpers inspected as needed:

- `blockchains/golos/js/blockchain.js`: public node list and `golos.config.set("websocket", node)` connection bootstrap; no top-specific ranking logic.
- `blockchains/golos/js/modal-accounts.js`: account/key modal helpers only; no top-specific ranking logic.
- `blockchains/golos/js/golos.min.js`: vendored Golos client exposes `golos.api.getAssetsAsync`, used by app-local `top/js/app.js` to discover UIA assets.
- `blockchains/golos/js/golos-dex.min.js`: searched for `getAssets`/UIA/top references; not relevant to top.
- `blockchains/golos/js/sjcl.min.js`: auth crypto helper; not relevant to read-only top.

Parity matrix:

| Legacy file / function / handler / control / helper | Behavior / transaction or read action | v3 equivalent file/function/UI | Concrete test coverage | Status |
|---|---|---|---|---|
| `config.json` metadata (`title`, `description`, `in_menu`, `category`) | Declares “Топ пользователей”, description for Golos GOLOS/GBG/СГ rankings, menu category `reytings`. Read-only page. | `v3/js/chains.js` adds Golos app id `top` with title “Топ пользователей”; `renderGolosTop` shows the same read-only purpose. | `tests/v3-golos-top-smoke.js` asserts Golos route exposure and app title. | fixed in this pass |
| `content.php` heading `Выберите вариант сортировки рейтинга` | Base top page lists ranking variants before any specific leaderboard page. | `renderGolosTop` renders an accessible `<section>` and `<nav aria-label="Варианты сортировки рейтинга Golos">` with all static ranking variants. | Smoke asserts the heading and labelled nav. | fixed in this pass |
| `content.php` links: `GBG`, `GOLOS`, `TIP-баланс`, `СГ`, delegated/received/effective/emission/withdraw/reputation | Read-only navigation to `/golos/top/<type>`; the full row data was loaded later by PHP/backend pages. | Hash links `#chain=golos&app=top&topType=<type>` preserve all legacy categories and labels without old URL/backend runtime. | Smoke asserts every legacy category id/label string and `topType=...` links. | fixed in this pass |
| `content.php` `<ul id="uia_assets_users"></ul>` | Placeholder for app-local JS to populate UIA token links. | `renderGolosTop` includes `#golos-top-uia-assets` with `role="status" aria-live="polite"` and a button `#golos-top-load-uia`. | Smoke asserts UIA container, aria-live, loader button. | fixed in this pass |
| `index.php::generateAppPages()` token parsing | Reads `pageUrl()[2]`, lowercases it, maps known native ranking ids to native `pages/top.php`, otherwise treats it as a UIA token and includes `pages/uia.php`; page number from `pageUrl()[3]`; sets title/description from `pages/config.json`. | Static v3 uses hash `topType`; `renderGolosTop` maps known ids locally and treats unknown symbols as UIA tokens only as an explanatory selected view, without server-side leaderboard fetch. | Smoke asserts `golosTopRankingOptions`, `golosTopRankingById`, native ids, selected UIA/static notice. | fixed in this pass |
| `index.php` token label map includes extra `market_balance` | Supports `/golos/top/market_balance` title even though base `content.php` does not list it. | `golosTopRankingOptions` includes `market_balance` as a preserved legacy direct route/category. | Smoke asserts `market_balance` and “Маркет-баланс”. | fixed in this pass |
| `pages/config.json` | Prefixes dynamic page title/description with “Топ пользователей Голоса по …”. | Dedicated heading and selected-category panel use “Топ пользователей Golos” and category labels; no document title mutation required in static SPA. | Smoke checks selected panel text and category labels. | intentionally different with reason: SPA keeps route title in page content instead of PHP document metadata |
| `pages/top.php::getLevel($gp_percent)` | Maps GP percent to gamification image file/name (`Повелители морей`, `Киты`, `Косатки`, `Акулы`, `Дельфины`, `Черепахи`, `Рыбы`, `Осьминоги`, `Крабы`, `Креветки`) for backend leaderboard rows. | `renderGolosTop` documents these levels in an accessible table because static v3 does not receive row `gp_percent` from the removed backend. | Smoke asserts all gamification level labels and that no image-only state is required. | fixed in this pass |
| `pages/top.php` backend read `service=top&type=<type>&page=<page>` | Fetches server-ranked full leaderboards with `users`, `counter`, 100-row pagination. Requires old private backend aggregation. | Static v3 does not fetch old backend. The selected native ranking panel explains that live full leaderboards are not ported and points users to v3 profiles/history/public RPC tools. | Smoke asserts absence of old backend host/service in top runtime slice and presence of honest non-goal copy. | backend-only non-goal |
| `pages/top.php` table fields and sortable headers | Displays `№`, `Логин`, `СГ (%)`, delegated/received/effective/emission GP, withdraw rate, GOLOS/GBG percentages, TIP/market balance, reputation; links login to profile. | `renderGolosTop` preserves the column set as an accessible “Legacy поля native top” table and uses v3 hash profile links for examples/guidance. | Smoke asserts table caption/field labels and `appHash({ chain: chain.id, app: 'profiles'... })`. | fixed in this pass |
| `pages/top.php` pagination controls | Previous/next/last page links based on backend `counter` and 100 rows/page. | Not rendered as live controls because no static/public RPC endpoint returns the ranked page/counter. Documented in selected-category notice. | Smoke asserts no `golos-api?service=top` fetch and notice mentions 100-row/pagination backend dependency. | backend-only non-goal |
| `pages/uia.php` backend read `service=uia-top&token=<token>&page=<page>` | Fetches server-ranked UIA holder leaderboard with `data`, `counter`, pagination. | Static v3 does not fetch old UIA leaderboard backend. It preserves UIA token discovery and per-token hash links; selected token panel classifies holder ranking as backend-only. | Smoke asserts no `uia-top` runtime fetch and presence of UIA leaderboard limitation. | backend-only non-goal |
| `pages/uia.php` UIA table fields | Displays `№`, `Логин`, `Суммарный баланс аккаунта`, `Основной баланс (ликвид)`, `TIP баланс (донаты)`, `Market-баланс`; login links to profile. | `renderGolosTop` preserves these fields as an accessible “Legacy поля UIA top” table and uses v3 profile hash route for account lookup guidance. | Smoke asserts all UIA table labels. | fixed in this pass |
| `js/app.js::main()` | Calls `golos.api.getAssetsAsync('')`, extracts token name from `asset.supply.split(' ')[1]`, appends `/golos/top/<TOKEN>` links to `#uia_assets_users`. | `loadGolosTopUiaAssets` loads vendor library/public node via existing `profiles.connect`, calls `fetchAllGolosAssets(api, 200)`, extracts symbols via `golosSymbolFromAssetField(asset.max_supply || asset.supply)`, and renders hash links into `#golos-top-uia-assets`. | Smoke asserts `loadGolosTopUiaAssets`, `fetchAllGolosAssets(api, 200)`, `getAssetsAsync`, symbol extraction from `asset.supply`, and no legacy `/golos/top/` runtime links. | fixed in this pass |
| Shared `blockchain.js` public node bootstrap | Selects public Golos websocket node and stores `golos_node`; top JS relies on global Golos client. | v3 reuses chain nodes in `v3/js/chains.js` and `profiles.connect`; no legacy localStorage key migration needed for read-only top. | Existing syntax/route tests plus top smoke check `chains.golos.nodes` and dedicated loader. | implemented |
| Shared `modal-accounts.js`, `sjcl.min.js` | Account/key management helper; top is read-only and does not require auth. | `top` app has `accountField: false`; render path does not request private keys, transactions, or broadcast. | Smoke asserts `accountField === false` and no operation form/private key text in top slice. | implemented |

Implementation plan for this pass:

1. Add Golos `top` route metadata with `accountField: false`.
2. Add dedicated `renderGolosTop` and `loadGolosTopUiaAssets` using public Golos RPC only.
3. Dispatch Golos `top` to the dedicated renderer.
4. Add focused `tests/v3-golos-top-smoke.js` covering route exposure, preserved categories/fields/UIA loader, accessibility, and old backend absence.
5. Run the required validation gate and re-open this section to ensure every gap is either fixed or precisely classified.

Recheck after changes:

- This `### Rigorous parity: Golos / top` section was re-opened after implementation.
- All legacy app-local files and referenced helpers listed above are represented in the matrix.
- Static-feasible gaps were fixed: Golos `top` route exposure, preserved ranking categories/labels, accessible native/UIA field documentation, text GP gamification levels, public-RPC UIA token discovery, profile hash links, no auth/private-key requirement.
- Remaining gaps are precisely classified as backend-only non-goals: server-ranked native top pages, UIA holder leaderboards, backend counters and 100-row pagination. No old private backend URL is used at runtime.

### Rigorous parity: Golos / witnesses-rewards

Scope lock for this stop-gate: only legacy `blockchains/golos/apps/witnesses-rewards` is audited and changed here. VIZ/Steem/Hive/Minter/Decimal and every other Golos app are explicitly out of scope for this pass.

Legacy files fully inventoried for this app:

- `blockchains/golos/apps/witnesses-rewards/config.json`
- `blockchains/golos/apps/witnesses-rewards/content.php`
- `blockchains/golos/apps/witnesses-rewards/index.php`

Referenced/shared Golos helpers inspected as needed:

- `blockchains/golos/js/blockchain.js`: legacy public node bootstrap (`golosapi.ecurrex.ru`, `api.aleksw.space`, `golos.lexai.top`, `api-full.golos.id`, `api-golos.blckchnd.com`) and stored `golos_node`; no witness reward aggregation logic.
- `blockchains/golos/js/golos.min.js`: vendored Golos client includes witness RPC descriptors in `witness_api`: `get_witness_by_account`, `get_witnesses_by_vote`, `lookup_witness_accounts`, `get_witness_count`, `get_active_witnesses`. This makes a public read-only witness/delegate list static-feasible, but it does not provide historical daily/monthly reward aggregation.
- `blockchains/golos/js/modal-accounts.js`: account/key modal, OAuth and localStorage helpers; not used by this read-only legacy app.
- `blockchains/golos/js/sjcl.min.js`: key encryption/decryption helper for legacy auth; not used by this read-only legacy app.

Parity matrix:

| Legacy file / function / handler / control / helper | Behavior / transaction or read action | v3 equivalent file/function/UI | Concrete test coverage | Status |
|---|---|---|---|---|
| `config.json` metadata (`title`, `description`, `in_menu`, `category`) | Declares page title “Награды делегатов”; description: list of Golos delegates and rewards for current day/month and previous day/month; menu label/category `Делегаты` / `reytings`. Read-only page. | `v3/js/chains.js` exposes Golos app id `witnesses-rewards` with title “Награды делегатов”, `accountField: false`; `renderGolosWitnessesRewards` keeps the same purpose as a static parity section. | `tests/v3-golos-witnesses-rewards-smoke.js` checks route exposure, exact title, description meaning, and accountField false. | fixed in this pass |
| `content.php` guard `if (!defined('NOTLOAD')) exit(...)` | PHP include guard only; no user-facing behavior. | Static SPA has no PHP include runtime; not applicable. | Smoke asserts no PHP/backend runtime dependency strings are introduced. | intentionally different with reason: static v3 has no PHP execution layer |
| `content.php` backend read `file_get_contents('http://178.20.43.121:3000/golos-api?service=witnesses')` | Reads old private backend aggregation for all witness reward rows. This is not a public browser-safe dependency and must not be restored. | v3 does not fetch `178.20.43.121`, `backend.dpos.space`, or `golos-api?service=witnesses`. The page documents that historical reward aggregates are backend-only. | Smoke asserts forbidden backend host/service strings are absent from the witnesses-rewards runtime slice and the test itself checks global forbidden host absence. | backend-only non-goal |
| `content.php` `json_decode($html, true)` and `$table` guard | Parses backend JSON array; renders no rows when backend response is empty/invalid. | v3 does not parse backend reward JSON. Public witness loader handles RPC errors through an accessible `role="status" aria-live="polite"` region. | Smoke asserts the `golos-witnesses-rewards-status` live region and RPC error/status copy. | fixed in this pass |
| `content.php` explanatory note | Shows strong notice: “Обновление происходит в полночь по GMT, но не все сразу делегаты обновляются, а те, которые подписывают блоки.” | `renderGolosWitnessesRewards` preserves this notice verbatim in an accessible paragraph. | Smoke asserts the GMT/midnight update notice text. | fixed in this pass |
| `content.php` table header `Логин` | Shows delegate login and links each login to legacy profile witness URL. Read-only navigation. | v3 reward-column table preserves the legacy column; public witness list links each owner to `#chain=golos&app=profiles&account=<owner>`, with text “профиль witness”. | Smoke asserts `Логин`, profile hash route generation, and no old `/golos/profiles/.../witness` runtime dependency. | fixed in this pass |
| `content.php` table header `за вчерашний день`; row field `round($witness['old_daily_profit'], 3)` | Displays old backend's previous-day witness reward aggregate rounded to 3 decimals. | v3 preserves the exact column meaning in an accessible documentation table but does not compute it because public witness RPC returns current witness state, not historical daily reward sums. | Smoke asserts `old_daily_profit`, “за вчерашний день”, and backend-only classification copy. | backend-only non-goal |
| `content.php` table header `за сегодня`; row field `round($witness['now_daily_profit'], 3)` | Displays old backend's current-day witness reward aggregate rounded to 3 decimals. | v3 preserves the exact column meaning in documentation; no static reward calculation. | Smoke asserts `now_daily_profit` and “за сегодня”. | backend-only non-goal |
| `content.php` table header `за прошлый месяц`; row field `round($witness['old_monthly_profit'], 3)` | Displays old backend's previous-month witness reward aggregate rounded to 3 decimals. | v3 preserves the exact column meaning in documentation; no static monthly aggregation. | Smoke asserts `old_monthly_profit` and “за прошлый месяц”. | backend-only non-goal |
| `content.php` table header `за текущий месяц`; row field `round($witness['now_monthly_profit'], 3)` | Displays old backend's current-month witness reward aggregate rounded to 3 decimals. | v3 preserves the exact column meaning in documentation; no static monthly aggregation. | Smoke asserts `now_monthly_profit` and “за текущий месяц”. | backend-only non-goal |
| `content.php` login link `$conf['siteUrl'].'golos/profiles/'.$witness['login'].'/witness'` | Opens legacy profile witness page in a new tab. | Public witness loader renders v3 profile hash links with the account login and a witness context label; no `target=_blank` required. | Smoke asserts `appHash({ chain: chain.id, app: 'profiles'` and witness profile text. | fixed in this pass |
| `index.php` | Empty app entry file after include guard; all behavior comes from `content.php`. | Static v3 dispatches `chain.id === 'golos' && effectiveAppId === 'witnesses-rewards'` to `renderGolosWitnessesRewards`. | Smoke asserts dedicated dispatch function call. | fixed in this pass |
| Shared `blockchain.js` node bootstrap | Chooses a working public Golos websocket node and stores `golos_node`. | v3 reuses `chains.golos.nodes` plus `profiles.connect(chain)` for public RPC. | Existing syntax checks plus smoke checks loader uses `profiles.connect(chain)`. | implemented |
| Shared `golos.min.js` witness RPC descriptors | Provides public witness read methods (`get_witnesses_by_vote`, `lookup_witness_accounts`, etc.). Does not provide the backend's daily/monthly reward summaries. | `loadGolosWitnessesByVote` uses the loaded Golos library and `profiles.apiCall(connection, 'getWitnessesByVote', ['', 50])`, with a fallback to `lookupWitnessAccounts` + `getWitnessByAccount` when needed. | Smoke asserts method names `getWitnessesByVote`, `lookupWitnessAccounts`, `getWitnessByAccount`, limit `50`, and no private-key/auth text in the route. | fixed in this pass |
| Shared `modal-accounts.js` and `sjcl.min.js` | Legacy auth helpers available globally, but witnesses-rewards does not use account selection, keys, signatures, or transactions. | v3 app is read-only: no operation form, no private key, no broadcast, no transaction preview/send. | Smoke asserts no `private_key`, `posting_key`, `active_key`, `broadcast`, or transaction form strings in the dedicated witnesses-rewards slice. | implemented |

Implementation plan for this pass:

1. Add Golos `witnesses-rewards` route metadata with `accountField: false`.
2. Add a dedicated accessible static parity renderer preserving legacy title, description, update note, and exact reward columns/field names.
3. Add a public-RPC witness/delegate list loader using `getWitnessesByVote` when available and fallback lookup/account methods, clearly separated from backend-only reward aggregates.
4. Dispatch Golos `witnesses-rewards` to the dedicated renderer.
5. Add focused `tests/v3-golos-witnesses-rewards-smoke.js` covering route exposure, legacy columns/field names, public witness loader, accessibility, backend-host absence, no auth/private-key requirement, and this plan evidence.
6. Run the required validation gate and re-open this section to ensure every gap is fixed or precisely classified.

Recheck after changes:

- This `### Rigorous parity: Golos / witnesses-rewards` section was re-opened after implementation.
- All legacy app-local files and referenced helpers listed above are represented in the matrix.
- Static-feasible gaps were fixed: Golos `witnesses-rewards` route exposure, preserved legacy title/description/update notice, exact reward-column documentation, accessible `aria-live` public RPC status, and a bounded public witness/delegate list loader using `getWitnessesByVote` with `lookupWitnessAccounts`/`getWitnessByAccount` fallback.
- Remaining gaps are precisely classified as backend-only non-goals: `old_daily_profit`, `now_daily_profit`, `old_monthly_profit`, and `now_monthly_profit` historical aggregates from the old private `golos-api?service=witnesses` backend. No old private backend URL/IP is used at runtime, and the route requires no auth/private keys/transactions.

### Rigorous parity: VIZ / wallet

Scope lock: this section covers exactly `VIZ / wallet`. Other VIZ apps (`analytics`, `awards`, `calc`, `custom-generator`, `exchanges`, `explorer`, `help`, `manage`, `polls`, `profiles`, `projects`, `randomblockchain`, `registration`, `search`, `top`, `vmp`, `voice-import`, `witnesses-rewards`) are not audited or implemented in this stop-gate pass.

Legacy files inspected completely in this pass:

- `blockchains/viz/apps/wallet/config.json` — 5-line app title/menu metadata.
- `blockchains/viz/apps/wallet/content.php` — 147-line wallet DOM/forms/control tree.
- `blockchains/viz/apps/wallet/index.php` — one-line direct-access guard.
- `blockchains/viz/apps/wallet/js/app.js` — 835-line wallet logic, forms, history, invite, memo, delegation and templates.
- `blockchains/viz/apps/wallet/css/style.css` — 52-line modal/layout CSS.
- `blockchains/viz/apps/wallet/css/jquery-ui.css` — 1311-line vendored jQuery UI theme CSS; no app business logic.
- `blockchains/viz/js/blockchain.js` — shared VIZ auth/node/Vizonator helper (`checkWorkingNode`, `viz_current_user`, SJCL key passphrases, `sendToVizonator`).
- `blockchains/viz/js/modal-accounts.js` — shared account add/auth helper and legacy weak `pass_gen`.
- `blockchains/viz/js/viz.min.js` — referenced VIZ browser API/auth/memo/broadcast library; reused in v3 as `v3/vendor/viz/viz.min.js`.
- `blockchains/viz/js/sjcl.min.js` — referenced SJCL decrypt library; reused in v3 as `v3/vendor/viz/sjcl.min.js`.

Current v3 files inspected for this pass:

- `v3/js/app.js` (`renderVizWallet`, `loadVizWalletData`, `renderVizWalletBalances`, `renderVizWalletForms`, `bindVizWalletForms`, `encodeVizMemoIfNeeded`, invite/key helpers, history rendering, shared operation form binding).
- `v3/js/chains.js` (VIZ route, symbols, nodes, library paths).
- `v3/js/broadcast.js` (VIZ authority mapping, legacy passphrases, preview/broadcast sanitizer, Vizonator bridge behavior).
- `v3/js/profiles.js` (VIZ public RPC connection, `getAccounts`, balances, energy/power helpers).
- `v3/js/history.js` (VIZ wallet operation allow-list and history normalization).
- `tests/v3-viz-wallet-smoke.js` and related v3 smoke tests.

Matrix:

| Legacy source item | Behavior / transaction or read action | v3 equivalent file/function/UI | Concrete test coverage | Status |
| --- | --- | --- | --- | --- |
| `config.json` | Title/menu metadata: `Кошелёк`, wallet description, menu entry. | `v3/js/chains.js` common app `wallet` plus VIZ chain route. | `tests/v3-route-coverage-smoke.js`; `tests/v3-viz-wallet-smoke.js` checks plan evidence. | implemented |
| `index.php` | PHP direct-access guard only. | Static SPA has no PHP entry; `index.html`/hash router is the entry. | Static constraint checked by route/source smoke tests and validation. | backend-only non-goal |
| `content.php` `auth_msg` / `active_auth_msg` / `active_page` | Require selected account and active key for wallet write operations. | `v3/js/auth.js`, `v3/js/broadcast.js` authority checks, key status text in `renderVizWallet`; active submit paths call `broadcast.prepare(..., 'active', ...)`. | `tests/v3-auth-broadcast-smoke.js`; `tests/v3-viz-wallet-smoke.js` checks operation forms. | implemented |
| `content.php` `main_wallet_info`, balance spans | Show VIZ balance, own SHARES, received/delegated SHARES and full vesting. | `loadVizWalletData`, `renderVizWalletBalances`, `vizEffectiveShares`. | `tests/v3-viz-wallet-smoke.js` checks VIZ/SHARES/energy/full-SHARES labels. | implemented |
| `content.php` balance action links | Open transfer, transfer-to-vesting, create invite, deposit/use invite panels. | Static semantic `<details>` sections in `renderVizWalletForms`. | `tests/v3-viz-wallet-smoke.js` checks form ids. | implemented |
| `content.php` shares action links | Open withdraw and delegation panels. | `wallet-withdraw-vesting-form`, `wallet-viz-cancel-withdraw-form`, `wallet-delegation-form`. | `tests/v3-viz-wallet-smoke.js`. | implemented |
| `content.php` `viz_diposit_modal`, `invite_secret`, `to_shares`, `getInviteWithForm`, `action_vesting_diposit_start` | Check invite by WIF/public key; claim invite to VIZ balance or use invite to SHARES. | `wallet-viz-use-invite-form`, `wallet-viz-invite-check`, `vizInvitePublic`, `getInviteByKey`, `claimInviteBalance`, `useInviteBalance`. | `tests/v3-viz-wallet-smoke.js` checks `getInviteByKey(publicKey)`, `claimInviteBalance`, `useInviteBalance`, `wifToPublic`. | implemented |
| `content.php` `vesting_withdraw_modal`, max/cancel warning | Start `withdraw_vesting`; cancel with `0.000000 SHARES`; max excludes delegated and pending 28 withdrawals. | `wallet-withdraw-vesting-form`, `wallet-viz-cancel-withdraw-form`, withdraw max calculation in `renderVizWalletForms`. | `tests/v3-viz-wallet-smoke.js` checks `withdrawVesting` and cancel form. | implemented |
| `content.php` `viz_transfer_modal`, template select and remove button | Transfer VIZ, optional transfer-to-vesting, built-in exchange/gateway templates and custom localStorage templates. | `renderVizTransferTemplateSelect`, `readVizTransferTemplates`, `writeVizTransferTemplates`, `bindVizTemplateControls`, `wallet-transfer-form`. | `tests/v3-viz-wallet-smoke.js` checks `viz_transfer_templates`, built-in template strings and transfer methods. | implemented |
| `content.php` `to_shares_transfer_modal` | Transfer current account's VIZ to own SHARES. | `wallet-vesting-form` builds `transferToVesting(from, from, amount)`. | `tests/v3-viz-wallet-smoke.js` checks `wallet-vesting-form` and `transferToVesting`. | implemented |
| `content.php` `vesting_delegate_modal` | Delegate SHARES to another account; max is own minus already delegated. | `wallet-delegation-form`, `delegateVestingShares`, delegated max calculation. | `tests/v3-viz-wallet-smoke.js` checks `delegateVestingShares`; matrix row covers max. | implemented |
| `content.php` `create_invite_form_modal` | Generate invite secret, copy it, create invite using public key and amount. | `wallet-viz-create-invite-form`, `generateVizInviteSecret` with `crypto.getRandomValues`, `vizInvitePublic`, `createInvite`. | `tests/v3-viz-wallet-smoke.js` checks crypto generation and `createInvite`; `tests/v3-auth-broadcast-smoke.js` checks Vizonator unsupported createInvite fails clearly. | implemented |
| `content.php` received/delegated delegation tables | Read `getVestingDelegations` received/delegated and show min delegation time; delegated rows can cancel. | `fetchVizDelegationsWithNodeFallback`, `renderVizDelegations`, `data-viz-cancel-delegation` populates cancellation form with `0.000000 SHARES`. | `tests/v3-viz-wallet-smoke.js` checks `getVestingDelegations` API order/fallback and cancellation phrase. | implemented |
| `content.php` withdraw info panel | Show vesting withdraw rate, next withdraw, total 28-interval amount, cancel button. | `renderVizWalletBalances` rows `Выводится по`, `Следующий вывод`; cancel form. | `tests/v3-viz-wallet-smoke.js` checks withdraw operation and labels. | implemented |
| `content.php` witness vote button | Encourage vote for `denis-skripnik`; old UI hides if already voted or vote limit reached. | `wallet-viz-witness-vote-form` prepares `accountWitnessVote(login, 'denis-skripnik', true)`. Dynamic hide is intentionally not reproduced because static preview/send is explicit and safe. | `tests/v3-viz-wallet-smoke.js` checks form and `accountWitnessVote`. | intentionally different with reason: explicit form stays visible instead of hidden auto-state |
| `content.php` `wallet_transfer_history` filters/button | Read account history, append transfer/award/reward rows, filter all/in/out/award types and load more. | `history.fetchAccountHistory`, `history.getWalletOperations`, `renderHistoryTable`; route-level `history` app provides richer filtering via `ops` hash. Wallet shows latest 50 only. | `tests/v3-viz-wallet-smoke.js` checks wallet history operation names; `tests/v3-route-coverage-smoke.js` covers history route. | intentionally different with reason: static wallet keeps latest table; full filtering lives in history route |
| `content.php` inline `walletData();` | Auto-load balances/history after render. | `renderVizWallet` calls `loadVizWalletData` before rendering. | `tests/v3-viz-wallet-smoke.js` checks dedicated loader. | implemented |
| `js/app.js` `createCryptMemo(to, memo)` | If memo starts `#` and memo key exists, read recipient `memo_key` via `getAccountsAsync` and encode with `viz.memo.encode(active_key, to_public_memo_key, memo)`. | `encodeVizMemoIfNeeded` uses public RPC and `client.memo.encode(privateKey, account.memo_key, text)`. | `tests/v3-viz-wallet-smoke.js` checks `encodeVizMemoIfNeeded`, `client.memo.encode`, `getAccountsAsync`. | implemented |
| `js/app.js` `getUrlVars` and transfer prefill block | Parse URL `to`, `amount`, `memo`; open transfer modal; prefill readonly combinations. | `prefillVizTransferFromUrl` reads query/hash params and fills transfer form after render. | `tests/v3-viz-wallet-smoke.js` checks `prefillVizTransferFromUrl`, params `to/amount/memo`, and form input names. | fixed in this pass |
| `js/app.js` `pass_gen` | Legacy weak random WIF for invite secret. | `secureRandomLegacySeed` + `generateVizInviteSecret` with `crypto.getRandomValues`, then `viz.auth.toWif`. | `tests/v3-viz-wallet-smoke.js` checks crypto generation; no `Math.random` in VIZ invite generation path. | intentionally different with reason: safer crypto randomness required |
| `js/app.js` `inviteRegPage` | Register account from invite using hardcoded private key and `inviteRegistration`; not wired by wallet DOM. | Registration is handled by VIZ `registration` app, not wallet; v3 avoids hardcoded WIF and wallet scope excludes app audit. | `tests/v3-viz-registration-smoke.js` covers existing registration route separately; this wallet test records non-goal. | intentionally different with reason: static-safe/no hardcoded signer; separate app |
| `js/app.js` `accountHistoryCompareDate`, `date_str`, `fast_str_replace` | Sort and format wallet history timestamps. | `v3/js/history.js` normalization and `renderTransactionsTable` date formatting. | Existing history smoke tests and `tests/v3-viz-wallet-smoke.js` operation checks. | implemented |
| `js/app.js` `getTransferTemplates` | Load custom templates from `localStorage.viz_transfer_templates`. | `readVizTransferTemplates`, `renderVizTransferTemplateSelect`. | `tests/v3-viz-wallet-smoke.js` checks storage key. | implemented |
| `js/app.js` `removeTransferTemplate` | Confirm/remove selected custom template and clear form. | `wallet-viz-template-remove` removes selected custom template and re-renders; built-ins cannot be removed. | `tests/v3-viz-wallet-smoke.js` checks remove control and storage. | implemented |
| `js/app.js` `cancelDelegatedVestingShares(delegatee)` | Broadcast `delegate_vesting_shares` with `0.000000 SHARES` or Vizonator bridge. | Delegated table cancel buttons fill `wallet-delegation-form` with `0.000000 SHARES`; send uses `delegateVestingShares`; Vizonator bridge exists in `broadcast.js`. | `tests/v3-viz-wallet-smoke.js`; `tests/v3-auth-broadcast-smoke.js` Vizonator cases. | implemented |
| `js/app.js` `load_balance` `getAccounts` | Read account balances, received/delegated SHARES, withdraw data, witness votes. | `loadGrapheneWalletData`/`profiles.fetchAccount`/`profiles.normalizeAccount`, `renderVizWalletBalances`. | `tests/v3-viz-wallet-smoke.js`; `tests/v3-profiles-smoke.js`. | implemented |
| `js/app.js` received/delegated `getVestingDelegations` calls | RPC `getVestingDelegations(viz_login, '', 100, type)` for `received` and `delegated`. | `fetchVizVestingDelegations` and fallback across VIZ nodes. | `tests/v3-viz-wallet-smoke.js` exact API order assertion. | implemented |
| `js/app.js` cancel withdraw click | Broadcast `withdrawVesting(active_key, viz_login, '0.000000 SHARES')`. | `wallet-viz-cancel-withdraw-form`. | `tests/v3-viz-wallet-smoke.js`. | implemented |
| `js/app.js` invite deposit click | `useInviteBalance(active_key, viz_login, viz_login, invite_secret)` or `claimInviteBalance(active_key, viz_login, viz_login, invite_secret)`. | `wallet-viz-use-invite-form` with optional receiver, default current account, and toVesting switch. | `tests/v3-viz-wallet-smoke.js`. | implemented |
| `js/app.js` transfer submit | Normalize amount to `0.000 VIZ`, encrypted memo, WIF memo guard, optional `transferToVesting`, otherwise `transfer`. | `wallet-transfer-form`; `normalizeAssetInput`; `encodeVizMemoIfNeeded`; WIF memo guard before `broadcast.prepare`; `transferToVesting` or `transfer`. | `tests/v3-viz-wallet-smoke.js` checks methods, encrypted memo and WIF guard. | fixed in this pass |
| `js/app.js` save template click | Prompt for name, upsert template `{name,to,memo,transfer_to_vesting}` in `viz_transfer_templates`. | `wallet-viz-template-save`, `readVizTransferTemplates`, `writeVizTransferTemplates`. | `tests/v3-viz-wallet-smoke.js` checks key and controls. | implemented |
| `js/app.js` to-own-SHARES submit | `transferToVesting(active_key, viz_login, viz_login, amount)`. | `wallet-vesting-form`. | `tests/v3-viz-wallet-smoke.js`. | implemented |
| `js/app.js` delegation submit | `delegateVestingShares(active_key, viz_login, delegatee, amount)`. | `wallet-delegation-form`. | `tests/v3-viz-wallet-smoke.js`. | implemented |
| `js/app.js` invite generation/copy/create | Generate secret, copy, derive public key, `createInvite(active_key, viz_login, amount, invite_key)`, show secret/amount. | `generateVizInviteSecret`, copy button, `vizInvitePublic`, `wallet-viz-create-invite-form`. Secret is not put in operation params; only public key is sent. | `tests/v3-viz-wallet-smoke.js`; broadcast sanitizer tests. | implemented |
| `js/app.js` witness vote submit | `accountWitnessVote(active_key, viz_login, 'denis-skripnik', true)`. | `wallet-viz-witness-vote-form`. | `tests/v3-viz-wallet-smoke.js`. | implemented |
| `js/app.js` `prepareContent` | Decode encrypted incoming memo with active/memo key; autolink URLs/images/videos and profile mentions. | v3 renders escaped normalized transaction details and does not prompt/store memo keys during wallet history display. | Static safety covered by table rendering tests. | intentionally different with reason: no prompt-driven memo-key storage or unsafe HTML injection in static history table |
| `js/app.js` `walletData`, `walletDataSettings`, `appendWalletData` | Paginated `getAccountHistoryAsync`, filter transfer/award/receive_award/benefactor_award/witness_reward, render rows with links. | `v3/js/history.js` wallet op allow-list and `renderHistoryTable`; full pagination/filtering available in history route. | `tests/v3-viz-wallet-smoke.js` checks operation names; history smoke tests. | intentionally different with reason: static wallet shows latest slice; route handles broad history |
| `js/app.js` transfer template select change | Built-ins `xchng_market`, `golos_xchng_market`, `gph_xchng_market`, `vmp_market`; custom templates populate fields and toVesting flag. | `renderVizTransferTemplateSelect` and `bindVizTemplateControls` with same built-ins plus additive self-SHARES shortcut. | `tests/v3-viz-wallet-smoke.js` checks built-ins and storage. | implemented |
| `js/app.js` history filter buttons | Show/hide rows by incoming/outgoing/award classes. | `history` route `ops` filters; wallet latest table remains unfiltered. | `tests/v3-route-coverage-smoke.js` and source checks. | intentionally different with reason: filtering moved to reusable static history route |
| `js/app.js` `getInviteWithForm` | Derive public key and call `getInviteByKey`, show balance/creator or receiver. | `wallet-viz-invite-check` with `vizInvitePublic` and public RPC. | `tests/v3-viz-wallet-smoke.js`. | implemented |
| `css/style.css` | Legacy modal/container/textarea CSS. | v3 global `v3/css/style.css` panel/forms/table styles; no fancybox modal dependency. | Visual/static smoke via source checks; no backend dependency. | intentionally different with reason: static accessible forms replace modal plugin |
| `css/jquery-ui.css` | Vendored jQuery UI theme for legacy widgets. | Not carried into v3; native semantic forms/tables/details instead of jQuery UI. | Source validation confirms no PHP/backend dependency; accessibility rules in AGENTS. | intentionally different with reason: remove unused legacy UI dependency |
| `blockchains/viz/js/blockchain.js` `checkWorkingNode` | Try VIZ nodes, store `viz_node`. | `profiles.connect` plus `fetchVizDelegationsWithNodeFallback`; VIZ does not prefer stale stored node first for core profile load, but delegation fallback writes a working `viz_node`. | `tests/v3-viz-wallet-smoke.js` checks fallback; `tests/v3-profiles-smoke.js` covers node handling. | implemented |
| `blockchains/viz/js/blockchain.js` current user / SJCL keys | Read `viz_current_user`, decrypt `regular`/`active` with old passphrases. | `v3/js/auth.js`, `v3/js/broadcast.js` `dpos.space_viz_<login>_regularKey` and active key passphrase. | `tests/v3-auth-broadcast-smoke.js`. | implemented |
| `blockchains/viz/js/blockchain.js` `sendToVizonator` | Bridge transfer, transfer_to_vesting, withdraw_vesting, delegate_vesting_shares; reject unsupported operations. | `v3/js/broadcast.js` `executeVizonator`; wallet warns for encrypted memo and unsupported create/use invite. | `tests/v3-auth-broadcast-smoke.js`; `tests/v3-viz-wallet-smoke.js`. | implemented |
| `blockchains/viz/js/modal-accounts.js` `saveAccount` | Validate regular/active WIF public keys against account authorities and save old localStorage schema. | `v3/js/app.js` accounts form, `auth.saveUser`, `auth.createKeyUser`, same old schema. | `tests/v3-auth-broadcast-smoke.js`. | implemented |
| `blockchains/viz/js/modal-accounts.js` `pass_gen` | Weak `Math.random` WIF helper. | `secureRandomLegacySeed` for new generated VIZ invite/registration secrets; legacy account helper generation is not copied. | `tests/v3-viz-wallet-smoke.js` checks crypto path. | intentionally different with reason: security fix |
| `viz.min.js` / `sjcl.min.js` | Browser VIZ API/auth/memo/broadcast and decrypt primitives. | Vendored under `v3/vendor/viz/` and referenced by `v3/js/chains.js`. | `tests/v3-viz-wallet-smoke.js`; `node --check v3/js/chains.js`. | implemented |

Gaps identified before code edits in this pass:

- VIZ wallet did not have a VIZ-specific URL transfer prefill helper equivalent to legacy `getUrlVars` + modal prefill.
- VIZ raw memo did not hard-stop when it looked like a private WIF before preparing `transfer`; broadcast sanitizer warned, but legacy stopped the transfer.

Implementation checklist for this stop-gate:

- Add `prefillVizTransferFromUrl()` and call it from `bindVizWalletForms` after template controls are bound.
- Add VIZ transfer raw memo WIF guard before `broadcast.prepare(..., 'transfer', ...)`.
- Extend `tests/v3-viz-wallet-smoke.js` to assert the prefill helper, `to`/`amount`/`memo` params, raw WIF guard, crypto invite generation, built-in templates, cancel controls, and absence of private WIF in createInvite params.
- Re-run the required validation command.

Post-implementation verification for this stop-gate:

- Matrix rows for `js/app.js` `getUrlVars`/transfer prefill and transfer submit are now `fixed in this pass`.
- The static-safe fixes are present in `v3/js/app.js`: `prefillVizTransferFromUrl()` runs from `bindVizWalletForms`, and raw VIZ transfer memo is checked with `isSteemMemoWif(chain, rawMemo)` before `broadcast.prepare(..., 'transfer', ...)`.
- Focused smoke coverage is present in `tests/v3-viz-wallet-smoke.js` for URL prefill, query/hash `to`/`amount`/`memo`, raw WIF memo guard, crypto invite secret generation, custom template controls, delegation/withdraw cancellation, and no private invite WIF in `createInvite` params.
- Required validation passed: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && for f in tests/v3-*.js; do node "$f" || exit 1; done && git diff --check`.

### Rigorous parity: VIZ / awards

Scope lock: this section covers exactly `VIZ / awards`. This is the one-app stop-gate immediately after completed `VIZ / wallet`. Other VIZ apps (`calc`, `custom-generator`, `exchanges`, `explorer`, `manage`, `profiles`, `randomblockchain`, `registration`, `witnesses-rewards`, etc.) are not audited or implemented in this pass.

Legacy files inspected completely in this pass:

- `blockchains/viz/apps/awards/config.json` — app metadata: `Сервис награждения`, tools category, menu `Награждение`.
- `blockchains/viz/apps/awards/content.php` — main award form, explanation copy, `target`, `isFixed`, `energy`, `payout`, `custom_sequence`, `memo`, beneficiaries table/range, `award_user_form` to `/viz/awards/send/`.
- `blockchains/viz/apps/awards/index.php` — PHP subpage dispatcher for `pages/<page>/content.php`; static v3 uses hash `awardPage` instead.
- `blockchains/viz/apps/awards/js/app.js` — main award operation logic, payout/energy calculators, beneficiaries storage, url/QR generator, Vizonator bridge calls.
- `blockchains/viz/apps/awards/css/style.css` — builder sortable/non-sortable field styling only; business logic not present.
- `blockchains/viz/apps/awards/css/jquery-ui.css` — vendored jQuery UI theme for sortable/slider widgets; static v3 uses native controls.
- `blockchains/viz/apps/awards/js/qrcode.min.js` — legacy QR canvas plugin used only by url page; v3 exposes copyable QR payload/link without vendoring a new QR plugin.
- `blockchains/viz/apps/awards/pages/link/config.json` — legacy link title/description.
- `blockchains/viz/apps/awards/pages/link/content.php` — path-param form prefill for `target`, `custom_sequence`, `memo`, `energy`, `isFixed`.
- `blockchains/viz/apps/awards/pages/builder/config.json` — builder page metadata.
- `blockchains/viz/apps/awards/pages/builder/content.php` — builder DOM controls: target checkbox/default, pay method, energy field/slider, custom_sequence, memo mode, app/user beneficiaries, url mode, output `head_code`/`final_code`.
- `blockchains/viz/apps/awards/pages/builder/builder.js` — standalone generated-form runtime: node selection, local auth, field validation, `send_award`, `viz.broadcast.awardAsync`.
- `blockchains/viz/apps/awards/pages/builder/footer.js` — builder code generator, percent-sum guard, generated auth/send form snippets, CDN dependencies.
- `blockchains/viz/apps/awards/pages/url/config.json` — url generator page metadata.
- `blockchains/viz/apps/awards/pages/url/content.php` — url/QR form with `target`, `isFixed`, `energy`, `payout`, `custom_sequence`, `memo`, beneficiaries and `view_url()`.
- `blockchains/viz/apps/awards/pages/send/config.json` — send page metadata.
- `blockchains/viz/apps/awards/pages/send/content.php` — PHP GET parsing and inline `send_award(target, energy, custom_sequence, memo, beneficiaries, payout, isFixed)` auto-call.
- `blockchains/viz/js/blockchain.js` — shared VIZ node/auth/Vizonator bridge (`sendToVizonator('award'...)`, `sendToVizonator('fixed_award'...)`).
- `blockchains/viz/js/modal-accounts.js` — shared legacy account storage/auth helper; awards depends on selected `viz_current_user` and regular key.
- `blockchains/viz/js/viz.min.js` / `blockchains/viz/js/sjcl.min.js` — browser VIZ API/auth/broadcast and decrypt primitives; v3 uses vendored static equivalents.

Current v3 files inspected for this pass:

- `v3/js/app.js` (`legacyAppTarget`, `APP_SCOPED_HASH_PARAMS`, `renderVizAward`, `parseVizBeneficiaries`, calculators, operation form binding, route dispatch).
- `v3/js/chains.js` (VIZ `award` app, alias expectations from `awards`).
- `v3/js/broadcast.js` (regular authority, Vizonator mapping for `award`/`fixedAward`, sanitizer paths).
- `v3/js/auth.js` (legacy-compatible selected account/key storage, no new key storage schema).
- `v3/js/profiles.js` and `v3/js/history.js` (public RPC helpers and formatting used by operation result/error paths).
- `tests/v3-route-coverage-smoke.js`, `tests/v3-viz-registration-smoke.js`, `tests/v3-auth-broadcast-smoke.js`, and the focused `tests/v3-viz-awards-smoke.js` added in this pass.

Matrix:

| Legacy source item | Behavior / transaction or read action | v3 equivalent file/function/UI | Concrete test coverage | Status |
| --- | --- | --- | --- | --- |
| `config.json` | Awards app metadata and menu entry. | `v3/js/chains.js` VIZ app `{ id: 'award', title: 'Награды' }`; `legacyAppTarget` maps legacy `awards` to `award`. | `tests/v3-viz-awards-smoke.js`; existing route coverage checks `parseVizBeneficiaries`/`fixedAward`. | implemented |
| `index.php` subpage dispatcher | Loads `/url`, `/builder`, `/link`, `/send` PHP pages by server path. | Static hash router with `awardPage` app-scoped param and `renderVizAward(chain, state)`. | `tests/v3-viz-awards-smoke.js` checks `awardPage`, state pass-through and page renderers. | fixed in this pass |
| `content.php` explanatory copy and service page links | Explain reward fund, energy, beneficiaries; links to url and builder pages. | `renderVizAward`, `vizAwardNav`, static copy in award/url/builder sections. | Focused smoke checks nav/page markers. | implemented |
| `content.php` `award_user_form` target control | Recipient login field, lowercased before broadcast. | `award-target` input; `normalizeAccountInput(chain, form.get('target'))` before prepare. | `tests/v3-viz-awards-smoke.js` checks control and operation path. | implemented |
| `content.php` `isFixed` checkbox and `payout` | If checked, use `fixedAward` with `parseFloat(payout).toFixed(3) + ' VIZ'`; payout has priority over energy. | `award-fixed`, `award-payout`, `normalizeVizPayout`, `broadcast.prepare(..., 'fixedAward', [from,target,rewardAmount,energy,custom,memo,beneficiaries])`. | Focused smoke checks `fixedAward`, `award-payout`, Vizonator map in `broadcast.js`. | implemented |
| `content.php` `energy` | Percent UI; operation uses hundredths of percent (`energy * 100` from user percent in send page). | `normalizeVizEnergy` converts percent to integer hundredths, range >0..100. | Focused smoke checks `award-energy`; route smoke checks award support. | implemented |
| `content.php` `custom_sequence` | Non-negative custom operation id, default 0. | `award-custom-sequence`, `normalizeVizCustomSequence`, params position preserved for award/fixedAward. | Focused smoke and route smoke check `custom_sequence`. | implemented |
| `content.php` `memo` | Memo/description; legacy hard-stops if memo is WIF. | `award-memo`, `broadcast.isLikelyWif(memoValue)` hard-stop before prepare. | `tests/v3-viz-awards-smoke.js` checks WIF memo guard and sanitizer evidence. | implemented |
| `content.php` beneficiaries table/range | Adds beneficiaries to `localStorage.viz_benif`; default author `denis-skripnik` 1%; max user-added total 99%; hidden JSON. | `award-beneficiaries` textarea accepts `account:10, other:5` or JSON `[{account,weight}]`; `parseVizBeneficiaries` validates weights and max 100%. | Focused smoke checks parser markers and total-weight guard. | intentionally different with reason: semantic textarea replaces jQuery table/range while preserving operation payload |
| `js/app.js` `shares1Energy`, payout click/change calculators | Estimate award payout from dynamic global props and effective SHARES; derive energy from payout. | `calculateVizAwardPayout`, `calculateVizEnergyForPayout`, `vizEffectiveShares`; static form keeps preview/JSON and operation verification. | Focused smoke checks calculators; syntax/full tests cover helpers. | implemented |
| `js/app.js` `accountData` | Read current account, energy regen and effective shares. | Existing profile/auth helpers plus VIZ award calculators; no automatic account polling in static form. | Focused smoke records helper presence; profile tests cover energy exposure. | intentionally different with reason: static form does not require live account load before preview |
| `js/app.js` `send_award` regular operation | Confirm, fetch props/account, parse fields, `viz.broadcast.awardAsync(posting_key,viz_login,target,energy,custom_sequence,memo,benef_list, cb)`. | `bindVizAwardOperationForm` uses `broadcast.prepare(chain, 'regular', 'award', [from,target,energy,custom,memo,beneficiaries])` with preview/send confirmation. | `tests/v3-viz-awards-smoke.js`; `tests/v3-auth-broadcast-smoke.js` covers VIZ regular/Vizonator patterns. | implemented |
| `js/app.js` fixed award operation | `viz.broadcast.fixedAwardAsync(posting_key,viz_login,target,parseFloat(payout).toFixed(3) + ' VIZ',energy,custom_sequence,memo,benef_list, cb)`. | `fixedAward` prepare with amount string and regular authority; preview/result sanitized by `DposBroadcast`. | Focused smoke exact evidence and sanitizer checks. | implemented |
| `js/app.js` Vizonator award bridge | `sendToVizonator('award', {receiver, energy, custom_sequence, memo, beneficiaries})`. | `v3/js/broadcast.js` `executeVizonator` maps operationName `award` to bridge method `award` and same option names. | Focused smoke checks evidence in plan and operation map. | implemented |
| `js/app.js` Vizonator fixed award bridge | `sendToVizonator('fixed_award', {receiver, reward_amount, energy, custom_sequence, memo, beneficiaries})`. | `executeVizonator` maps `fixedAward` to `fixed_award` with `reward_amount`. | Focused smoke and auth/broadcast smoke. | implemented |
| `js/app.js` error handling for energy/beneficiary/account errors | Legacy maps broadcast error regexes to Russian messages. | v3 uses common `profiles.formatError(error)` in `bindOperationForm`, explicit preview, and operation JSON; does not duplicate all regex-specific HTML. | Full smoke tests and final validation. | intentionally different with reason: shared static error rendering avoids unsafe legacy HTML branches |
| `js/app.js` `view_url(siteUrl)` | Build `/viz/awards/send/?target=...&energy=...&custom_sequence=...&memo=...&beneficiaries=...`, render QR canvas via qrcode plugin. | `renderVizAwardUrlGenerator`, `viz-award-url-form`, `buildVizAwardLink`, `viz-award-generated-link`, `viz-award-qr-payload`; static hash link instead of PHP URL. | Focused smoke checks url/QR renderer and controls. | fixed in this pass |
| `pages/url/content.php` | Separate generator page with same controls as main form plus button `Сформировать url`. | `awardPage=url` renders generator with target/fixed/energy/payout/custom_sequence/memo/beneficiaries and copyable outputs. | `tests/v3-viz-awards-smoke.js`. | fixed in this pass |
| `js/qrcode.min.js` | Client QR canvas plugin for generated URL. | Not vendored/loaded; v3 exposes `QR payload` and copyable link suitable for screen readers/static use. | Focused smoke checks no old builder path and QR payload marker. | intentionally different with reason: accessible static payload avoids plugin dependency |
| `pages/send/content.php` | PHP GET parsing then inline auto-call to `send_award(...)`. | `awardPage=send` + `renderVizAwardSendPage` prefilled form; explicitly says send page does not auto-broadcast and requires preview/send confirmation. | Focused smoke checks `viz-award-send-review` and `send page не отправляет транзакцию автоматически`. | fixed in this pass |
| `pages/link/content.php` | Path-param prefill for target/custom_sequence/memo/energy/fixed checkbox; no beneficiaries/payout. | `renderVizAwardLinkPage` with `viz-award-link-form`, fields `link-target`, `link-custom-sequence`, `link-memo`, `link-energy`, `link-fixed`, and embedded main operation form. | Focused smoke checks link route controls. | fixed in this pass |
| `pages/builder/content.php` controls | Builder checkboxes/radios/selectors for target, pay method, energy view/notification, custom_sequence, memo mode, app/user beneficiaries, url redirect, head/final code textareas. | `renderVizAwardBuilder` native semantic form with matching control ids (`builder-target-enabled`, `builder-pay-method`, `builder-energy-view`, `builder-note-mode`, `builder-app-beneficiary-enabled`, `builder-user-beneficiary-enabled`, `builder-url-mode`) and output textareas. | Focused smoke checks every builder control/output marker. | fixed in this pass |
| `pages/builder/footer.js` `generate`, `get_code` | Generate standalone HTML snippet with auth form, send form, hidden beneficiaries, energy/payout fields, `head_code`, `final_code`. | `buildVizAwardBuilderSnippet`, `bindVizAwardBuilderForm`, `viz-award-builder-head-code`, `viz-award-builder-final-code`; generated snippet targets v3 hash `awardPage=send`. | Focused smoke checks snippet builder and output controls. | fixed in this pass |
| `pages/builder/footer.js` `check_100` | Alert if app + user beneficiary percentages exceed 100. | `checkVizAwardBuilderPercentLimit` throws an accessible status error. | Focused smoke checks helper marker. | fixed in this pass |
| `pages/builder/builder.js` local standalone auth | Stores raw login/posting in local/session storage using generic `login`/`PostingKey`, decrypts directly, hides form if unauthenticated. | Static v3 intentionally reuses existing `v3/js/auth.js` selected account and `DposBroadcast` prepare/broadcast; no new storage schema. | Auth/broadcast smoke and focused source checks. | intentionally different with reason: architecture unity and no new/old parallel key storage |
| `pages/builder/builder.js` `checkWorkingNode` | Browser tries old websocket nodes and stores `node`. | v3 uses existing chain nodes in `v3/js/chains.js` and profile/broadcast connection helpers. | Existing profile/broadcast tests. | intentionally different with reason: shared v3 node handling |
| `css/style.css` / `css/jquery-ui.css` | Visual styling for sortable/builder widgets and jQuery UI. | v3 global accessible forms (`panel`, `stacked-form`, native inputs/selects/textareas); no jQuery UI dependency. | Source validation and focused smoke. | intentionally different with reason: accessible static controls replace legacy widgets |
| `blockchains/viz/js/blockchain.js` / `modal-accounts.js` shared auth | Current account, SJCL encrypted regular key, Vizonator support. | `v3/js/auth.js` and `v3/js/broadcast.js` preserve legacy account records and Vizonator compatibility for award/fixedAward. | `tests/v3-auth-broadcast-smoke.js`; focused smoke. | implemented |

Gaps identified before code edits in this pass:

- Router called `renderVizAward(chain)` without `state`, so hash/query prefill and legacy url/send/link behavior could not work reliably.
- Legacy `/viz/awards/url`, `/builder`, `/link`, and `/send` pages had no explicit v3 static page equivalents beyond the single award form.
- Builder controls/code-output parity was missing; v3 had only a generic link/JSON payload.

Implementation checklist completed in this stop-gate:

- Added `awardPage` to app-scoped hash params and passed `state` into `renderVizAward(chain, state)`.
- Split awards UI into static page renderers: `renderVizAwardMainForm`, `renderVizAwardUrlGenerator`, `renderVizAwardBuilder`, `renderVizAwardLinkPage`, and `renderVizAwardSendPage`.
- Kept operation authority/path unified through `DposBroadcast.prepare` regular authority and existing sanitizer/confirmation flow.
- Added source-level focused smoke coverage in `tests/v3-viz-awards-smoke.js` for operation params, route/page coverage, forms/controls, QR/link/url/builder/send behavior, Vizonator evidence, sanitizer evidence, and this plan matrix.

Post-implementation verification for this stop-gate:

- Static-only constraint held: no PHP runtime, `backend.dpos.space`, old private IP, or old `blockchains/viz/apps/awards/pages/builder/builder.js` runtime load was introduced.
- Vizonator compatibility for legacy awards operations is preserved through `v3/js/broadcast.js` mappings for `award` and `fixedAward`.
- Transaction previews/results remain sanitized by existing `DposBroadcast.sanitizePrepared` and `DposBroadcast.sanitizeResult`; WIF-like memo input is blocked before prepare.
- Required validation gate was run after implementation; see final report for exact output summary.

### Rigorous parity: VIZ / randomblockchain

Scope lock: this gap-check covers exactly `VIZ / randomblockchain`. The app already had shared runtime support from earlier social-chain randomblockchain work, but this pass makes the VIZ-specific evidence durable with a focused smoke test and exact legacy matrix before moving on to VIZ / top.

Legacy files inspected completely in this pass:

- `blockchains/viz/apps/randomblockchain/config.json` — metadata: title `Генератор случайных чисел`, description `Генератор случайных чисел с использованием блоков блокчейна Viz`, menu entry `ГСЧ`, category `tools`.
- `blockchains/viz/apps/randomblockchain/content.php` — GET form for `block1`, `block2`, `participants`, optional `data_list`; result page renders links to Ropox block API, hidden participant/list values, two signature textareas, calculate button, hash/lucky number fields, and calls `blocksData(start,end)`.
- `blockchains/viz/apps/randomblockchain/index.php` — only NOTLOAD guard; no route logic or backend service.
- `blockchains/viz/apps/randomblockchain/js/app.js` — uses public VIZ browser API `getDynamicGlobalPropertiesAsync()` and `getBlock`, then computes `keccak_256.update(sig1 + sig2)`, `bigInt(h, 16).mod(participants)`, outputs `d.value + 1`, and maps optional `data_list` line to the zero-based result.
- `blockchains/viz/apps/randomblockchain/js/sha3.min.js` and `BigInteger.min.js` — legacy browser hashing/big integer helpers; v3 reuses vendored `v3/vendor/viz/sha3.min.js` and native `BigInt`.
- Shared context inspected: `blockchains/viz/js/blockchain.js`, `modal-accounts.js`, `viz.min.js`; randomblockchain is read-only and does not use auth, ajax, PHP backend, or broadcast helpers.

Current v3 files inspected for this pass:

- `v3/js/chains.js` — VIZ app registry and `randomHashPath: 'v3/vendor/viz/sha3.min.js'`.
- `v3/js/app.js` — `resolveRandomBlockchainSeed`, `hashRandomBlockchainSeeds`, `renderRandomBlockchain`, route dispatch, public RPC connection helpers, status rendering.
- `v3/js/broadcast.js` — inspected to confirm no randomblockchain write/broadcast path is needed.
- `v3/js/profiles.js` and `v3/js/history.js` — public RPC/profile/history helpers inspected; only `profiles.apiCall(connection, 'getBlock', ...)` is needed for block reads.
- Existing tests: `tests/v3-route-coverage-smoke.js`, `tests/v3-social-randomblockchain-smoke.js`; focused VIZ coverage added in `tests/v3-viz-randomblockchain-smoke.js`.

Matrix:

| Legacy source item | Behavior / data dependency | v3 equivalent file/function/UI | Concrete test coverage | Status |
| --- | --- | --- | --- | --- |
| `config.json` | Exposes VIZ tool titled `Генератор случайных чисел` / menu `ГСЧ`. | `v3/js/chains.js` registers VIZ app `randomblockchain`, title `Случайный блокчейн`, description for deterministic random by VIZ block signatures. | `tests/v3-viz-randomblockchain-smoke.js` checks route registration and title. | implemented |
| `content.php` initial form | Inputs `block1`, `block2`, `participants`, textarea `data_list`, submit to legacy GET route. | `renderRandomBlockchain` provides one accessible static form with labels for first/second block-or-seed, participant count, optional `randomblockchain-list`, submit button and aria-live result. | Focused smoke checks dedicated form, `randomblockchain-list`, `role="status" aria-live="polite"`. | implemented |
| `content.php` result state | Server echoes block links/signature fields/result fields and invokes `blocksData(start,end)`. | v3 keeps a single-page form; on submit it resolves numeric blocks through public RPC and shows lucky number, optional winner, algorithm, hash and JSON details without PHP result route. | Focused smoke checks public `getBlock` path and no `.php` dependency in runtime slice. | implemented static-safe |
| `js/app.js::getLastBlocks` | Uses `viz.api.getDynamicGlobalPropertiesAsync()` to fill current and previous block numbers. | Existing v3 form accepts explicit block numbers/seeds; dynamic current-block autofill is not required for parity stop-gate because calculation works with user-provided public block numbers. | Plan records as minor UI convenience gap, not backend dependency. | acceptable gap |
| `js/app.js::blocksData` | Calls `viz.api.getBlock(start_block/end_block)` and reads `witness_signature`. | `resolveRandomBlockchainSeed` uses existing public RPC connection and `profiles.apiCall(connection, 'getBlock', blockNum)` for numeric input; non-numeric input remains a manual seed fallback. | `tests/v3-viz-randomblockchain-smoke.js` and route coverage check `profiles.apiCall(connection, 'getBlock'`. | implemented |
| `js/app.js::calculate` | `keccak_256.update(sig1 + sig2).toString()`, then `bigInt(h, 16).mod(participants)`, output `(d.value + 1)`. | `hashRandomBlockchainSeeds` loads `chain.randomHashPath`, calls `keccak_256(witness_signature_1 + witness_signature_2)`, uses `BigInt` modulo and returns `luckyNumber: value + 1`. | Focused smoke checks `keccak_256(witness_signature_1 + witness_signature_2)`, `luckyNumber: value + 1`, and vendored sha3 path. | implemented |
| Optional `data_list` | If non-empty, participant count becomes line count and `resultMember` displays `data_array[d.value]`. | v3 trims non-empty textarea lines, uses list length as modulo, and displays winner from zero-based `random.value`. | Focused smoke checks `randomblockchain-list`; route coverage checks participant list winner output. | implemented |
| `index.php` | Only PHP NOTLOAD guard. | No runtime equivalent; SPA hash route handles rendering. | Focused smoke forbids `.php` in randomblockchain runtime slice. | static-only non-goal |
| Shared `blockchain.js` / `modal-accounts.js` | Available globally but not used by randomblockchain for auth, ajax, or broadcast. | v3 route is read-only and has no account selector, no signing form, no broadcast preparation. | Focused smoke forbids `broadcast.prepare`, `broadcast.broadcast`, `bindOperationForm`. | read-only/no broadcast |
| Legacy helper libraries | `sha3.min.js` and `BigInteger.min.js` shipped inside legacy app. | v3 vendors sha3 at `v3/vendor/viz/sha3.min.js`; native browser/Node `BigInt` replaces BigInteger dependency. | Focused smoke checks file exists and `randomHashPath` value. | implemented |

Validation plan for this app:
- Focused RED/GREEN smoke: `node tests/v3-viz-randomblockchain-smoke.js` (RED observed on missing durable plan section before this plan update).
- Per-app gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-viz-randomblockchain-smoke.js && git diff --check`.

Remaining gaps/non-goals:
- No PHP result route, private backend, private IP runtime fetch, `backend.dpos.space`, hidden server API, cron/bot/server state, auth, or broadcast is introduced.
- `getLastBlocks()` auto-fill for current/previous block is not yet ported as a separate button; static v3 accepts explicit block numbers/seeds and resolves numeric blocks through public RPC, preserving the core calculation.

### Rigorous parity: VIZ / top

Scope lock: this section covers exactly `VIZ / top`, immediately after the VIZ randomblockchain gap-check. This pass does not add a backend/indexer replacement; it ports static-safe navigation/documentation and classifies the live leaderboard dependency honestly.

Legacy files inspected completely in this pass:

- `blockchains/viz/apps/top/config.json` — metadata: title `Топ пользователей`, description for VIZ, social capital and other sort fields, menu `Пользователи`, category `reytings`.
- `blockchains/viz/apps/top/content.php` — landing list of six category links: `shares`, `VIZ`, `effective_shares`, `received_shares`, `delegated_shares`, `vesting_withdraw_rate`.
- `blockchains/viz/apps/top/index.php` — validates `pageUrl()[2]` against token map, lowercases the token, builds page title/description from `pages/config.json`, and routes to `pages/top.php`; unknown token returns 404.
- `blockchains/viz/apps/top/pages/config.json` — subpage title/description prefix `Топ пользователей Viz по ...`.
- `blockchains/viz/apps/top/pages/top.php` — private backend read `file_get_contents('http://178.20.43.121:3100/viz-api?service=top&type='.mb_strtolower(pageUrl()[2]).'&page='.$pagenum)`, JSON fields `users` and `counter`, 100-row pagination, table fields `name`, `shares`, `shares_percent`, `delegated_shares`, `received_shares`, `effective_shares`, `vesting_withdraw_rate`, `viz`, `viz_percent`, and profile links.
- Shared VIZ helpers inspected: `blockchains/viz/js/blockchain.js`, `modal-accounts.js`, `viz.min.js`; VIZ top has no auth or broadcast behavior in app files.

Current v3 files inspected for this pass:

- `v3/js/chains.js` — VIZ app registry.
- `v3/js/app.js` — app route state, `topType` hash parameter, existing Golos top pattern, profile hash links, status rendering, route dispatch.
- `v3/js/broadcast.js` — confirmed top is read-only and needs no operation path.
- `v3/js/profiles.js` and `v3/js/history.js` — static public RPC alternatives for individual account/profile/history checks, not a ranked leaderboard replacement.
- Existing `tests/v3-*.js`; focused coverage added in `tests/v3-viz-top-smoke.js`.

Matrix:

| Legacy file/content/control/helper/data dependency | Exact legacy evidence | v3 equivalent / test | Status |
| --- | --- | --- | --- |
| `config.json` | `Топ пользователей`, `Топ пользователей блокчейна Viz по VIZ, соц. капиталу и другим полям сортировки`, menu `Пользователи` | `v3/js/chains.js` registers VIZ `top`, `accountField: false`, static-only description | `tests/v3-viz-top-smoke.js` checks registration | implemented |
| `content.php` category list | Links to `shares`, `VIZ`, `effective_shares`, `received_shares`, `delegated_shares`, `vesting_withdraw_rate` | `vizTopRankingOptions` renders the same six hash-route category links using `topType` | Focused smoke checks all six category markers | implemented |
| `index.php` token map/title routing | Accepts only known token keys, lowercases token, appends `страница N` text | v3 keeps selected category via `topType` and displays selected heading; unknown/empty category stays documented instead of 404 because static hash routes are non-destructive | Focused smoke checks dedicated renderer/dispatch | implemented static-safe |
| `pages/top.php` backend fetch | `viz-api?service=top&type=<type>&page=<page>` from private IP; returns JSON `users` and `counter` | v3 documents exact service name as evidence but does not fetch it, and marks live ranked table/counter/pages as `backend-only non-goal` | Focused smoke checks evidence string and forbids private IP/PHP/backend fetch in runtime slice | static-only non-goal |
| Table fields | `name`, `shares`, `shares_percent`, `delegated_shares`, `received_shares`, `effective_shares`, `vesting_withdraw_rate`, `viz`, `viz_percent` | `renderVizTopFieldRows` preserves human-readable fields: `Логин`, `Соц. капитал`, `% от всего соц. капитала`, delegation fields, `Баланс VIZ`, `% от всех VIZ` | Focused smoke checks representative fields including `shares_percent` and `vesting_withdraw_rate` through plan/source evidence | implemented as documentation |
| Profile links | Each row links `viz/profiles/<name>` | v3 points users to static VIZ profiles hash route as public RPC alternative for individual account checks | Focused smoke checks `appHash({ chain: chain.id, app: 'profiles'` | implemented |
| Pagination controls | Uses 100-row pages and `counter` to show `Предыдущая`, `Следующая`, `Последняя` | v3 documents the controls and explains the missing backend counter/100-row leaderboard | Focused smoke checks `Предыдущая`, `Следующая`, `Последняя`, `100-row` | implemented as static-only docs |
| Auth/broadcast/shared helpers | App files do not call auth, WIF, ajax form submit, or broadcast; shared helpers only exist globally | v3 has no account selector requirement, no `bindOperationForm`, no `broadcast.prepare`, no `broadcast.broadcast` for top | Focused smoke forbids write helpers in runtime slice | read-only/no broadcast |

Validation plan for this app:
- Focused RED/GREEN smoke: `node tests/v3-viz-top-smoke.js` (RED observed on missing VIZ top registration before implementation).
- Per-app gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-viz-top-smoke.js && git diff --check`.

Remaining gaps/non-goals:
- Live VIZ leaderboard rows, `counter`, exact 100-row pages and previous/next/last page URLs remain backend/indexer-only because legacy depended on a private `viz-api?service=top` endpoint.
- v3 does not add PHP, private IP runtime fetches, `backend.dpos.space`, hidden server APIs, cron/indexer state, auth, or broadcast behavior for VIZ top.

### Rigorous parity: VIZ / search

Scope lock: this section covers exactly `VIZ / search` / `Viz-links`, after VIZ top. This pass preserves static-safe search/add-link UX while classifying the removed search index as backend-only.

Files inspected:
- Legacy exact app files: `blockchains/viz/apps/search/config.json`, `blockchains/viz/apps/search/content.php`, `blockchains/viz/apps/search/index.php`, `blockchains/viz/apps/search/js/app.js`.
- Legacy subpages: `blockchains/viz/apps/search/pages/other/config.json`, `blockchains/viz/apps/search/pages/other/search.php`, `blockchains/viz/apps/search/pages/add/config.json`, `blockchains/viz/apps/search/pages/add/content.php`.
- Shared helpers: `blockchains/viz/js/blockchain.js`, `modal-accounts.js`, `viz.min.js` for award/auth context.
- Current v3 inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing `tests/v3-*.js`; focused coverage added in `tests/v3-viz-search-smoke.js`.

Matrix:

| Legacy item | Exact dependency / behavior | v3 equivalent / test | Status |
| --- | --- | --- | --- |
| `config.json` | title `Поиск -links`, description references API service `viz-links`, menu `Viz-links` | VIZ `search` route registered in `v3/js/chains.js` | `tests/v3-viz-search-smoke.js` checks route | implemented |
| `content.php` search form | hidden `chain=viz`, `service=search`, radio `full_search` / `unfull_search`, text `search`, submit `Найти` | `renderVizSearch` form `viz-search-form` with same search types and `query` hash state | focused smoke checks forms, `full_search`, `unfull_search` | implemented |
| `index.php` routing | `add-link` loads add page; other route uses `type/query/page` and `pages/other/search.php` | v3 uses `searchPage`, `searchType`, `query` app-scoped hash params; unknown live result pages are documented non-destructively | smoke checks state params and dispatch | implemented static-safe |
| `pages/other/search.php` | `file_get_contents('http://178.20.43.121:3100/viz-api?service=links&type=...&query=...&page=...')`; decodes result list/inlinks; next/previous pagination | v3 documents exact `viz-api?service=links` evidence but does not fetch private IP/PHP/backend; live search result index is `backend-only non-goal` | smoke forbids private IP/PHP/backend fetch in runtime slice and checks evidence string | static-only non-goal |
| Result link conversion | `viz://` maps to Free-Speech-Project dapp hash; `ipfs://` maps to `https://ipfs.io/ipfs/` | `normalizeVizLinkValue` preserves these conversion rules for manual/static context | smoke checks both conversion URL markers | implemented |
| `pages/add/content.php` | Auth-required add-link form: energy, payout helper, `custom_sequence` protocol options `viz://`, `https://`, `ipfs`, `magnet`, keyword/link/inlink, button calls `send_award(...)` | `viz-search-add-link-form` exposes accessible fields and explicit preview/send flow through existing broadcast confirmation | focused smoke checks add-link form and protocol markers | implemented |
| `js/app.js::send_award` | sends `viz.broadcast.awardAsync(posting_key, viz_login, 'committee', energy, custom_sequence, memo, [])`, memo `keyword~link~inlink`; Vizonator award bridge supported | v3 prepares `broadcast.prepare(chain, 'regular', 'award', [from, 'committee', energy, custom_sequence, memo, []])`; no hardcoded key, no auto-send | smoke checks `targetAccount = 'committee'`, `keyword~link~inlink`, and award prepare | implemented static-safe write flow |
| `js/app.js::accountData` / `shares1Energy` | optional current energy/max payout helper via `getAccounts` and `getDynamicGlobalProperties` | Not ported in this stop-gate; form accepts explicit energy, and existing VIZ calculator/award pages cover value estimation | documented as convenience gap | acceptable gap |
| Auth/broadcast safety | Legacy requires selected account/posting key; no server secret in app files | v3 uses existing auth/broadcast confirmation, WIF-like memo guard, no secrets, no hidden daemon | smoke checks runtime no private/PHP backend fetch | implemented |

Validation plan:
- Focused RED/GREEN smoke: `node tests/v3-viz-search-smoke.js` (RED observed first on missing registration, then on missing plan evidence).
- Per-app gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-viz-search-smoke.js && git diff --check`.

Remaining static-only non-goals:
- Live search results, inlinks, backend pagination and index freshness require the removed private `viz-api?service=links` service; v3 does not fake or recreate them.
- No PHP, private IP runtime fetch, `backend.dpos.space`, hidden server API, cron/indexer service, or new daemon is introduced.

### Rigorous parity: VIZ / calc

Scope lock: this section covers exactly `VIZ / calc` after completed `VIZ / wallet` and `VIZ / awards`. Other VIZ apps (`analytics`, `manage`, `witnesses-rewards`, `polls`, `top`, `search`, `voice-import`, `profiles`, `custom-generator`, `explorer`, `projects`, `exchanges`, `registration`, etc.) are not audited or implemented in this pass.

Legacy files inspected completely in this pass:

- `blockchains/viz/apps/calc/config.json` — metadata: title `Блокчейн-калькулятор`, menu `Калькулятор`, description for upvote cost, GESTS/SHARES and blockchain parameters.
- `blockchains/viz/apps/calc/content.php` — three static forms/controls: `#sp` + `#vp` + `#result_power` + `#let1`; `#fund_sp` + `#result_fund` + `#let3`; `#sp_tec` + `#result_vests` + `#let2`.
- `blockchains/viz/apps/calc/index.php` — no additional behavior beyond NOTLOAD guard.
- `blockchains/viz/apps/calc/js/app.js` — jQuery click handlers strip whitespace and call `https://dpos.space/blockchains/viz/apps/calc/ajax.php` with `type=result_power`, `type=result_fund`, or `type=result_vests`.
- `blockchains/viz/apps/calc/ajax.php` — formula implementation and PHP snippet orchestration for `get_dynamic_global_properties`, `get_chain_properties`, and `get_config`.
- `blockchains/viz/apps/calc/snippets/get_chain_properties.php` — PHP/Composer GrapheneNodeClient `GetChainPropertiesCommand`; static-safe public RPC equivalent is `getChainProperties`.
- `blockchains/viz/apps/calc/snippets/get_config.php` — PHP/Composer GrapheneNodeClient `GetConfigCommand`; static-safe public RPC equivalent is `getConfig`.
- `blockchains/viz/apps/calc/snippets/get_dynamic_global_properties.php` — PHP/Composer GrapheneNodeClient `GetDynamicGlobalPropertiesCommand`; static-safe public RPC equivalent is `getDynamicGlobalProperties`.
- `blockchains/viz/js/blockchain.js` — shared VIZ node selection/auth/broadcast helpers; calc only needed node/API access, not auth or broadcast.
- `blockchains/viz/js/modal-accounts.js` — shared legacy account storage/auth helper; not used by calc because calc is read-only.
- `blockchains/viz/js/viz.min.js` — browser VIZ API library; v3 uses vendored `v3/vendor/viz/viz.min.js` through `v3/js/chains.js` and `profiles.connect`.

Current v3 files inspected for this pass:

- `v3/js/app.js` (`legacyAppTarget`, calculator dispatch, `renderVizCalculator`, shared formula helpers, public RPC connection flow).
- `v3/js/chains.js` (VIZ `calculator` app registration, public node list and vendored VIZ library path).
- `v3/js/broadcast.js` (confirmed no calc operation path is needed; calc remains read-only and transaction-free).
- `v3/js/profiles.js` (public RPC connection and `apiCall` method used by calc).
- `v3/js/history.js`, `v3/js/auth.js`, existing route/profile/broadcast tests (confirmed no extra calc auth/history dependency is required).
- `tests/v3-viz-calc-smoke.js` added in this pass.

Matrix:

| Legacy source item | Behavior / read action | v3 equivalent file/function/UI | Concrete test coverage | Status |
| --- | --- | --- | --- | --- |
| `config.json` | App metadata and menu entry for `calc`. | `v3/js/chains.js` VIZ app `{ id: 'calculator', title: 'Калькулятор' }`; `legacyAppTarget` maps legacy `calc` to `calculator`. | `tests/v3-viz-calc-smoke.js` checks app registration and alias scope. | implemented |
| `content.php` first form `#sp`, `#vp`, `#result_power`, `#let1` | User enters social capital SHARES and energy percent; result prints `Награда даст ...`. | `renderVizCalculator` form `viz-award-value-calculator-form`, controls `viz-calc-shares`, `viz-calc-charge`, aria-live result. | Focused smoke checks controls, copy and formula markers. | implemented |
| `content.php` second form `#fund_sp`, `#result_fund`, `#let3` | Developer reward-fund helper: award own account every 432 seconds at 0.1%, then daily withdrawal and required capital. | `viz-award-fund-calculator-form`, `viz-calc-fund-shares`, exact legacy explanatory result copy in aria-live result. | Focused smoke checks controls and result-copy markers. | implemented |
| `content.php` third form `#sp_tec`, `#result_vests`, `#let2` | Convert entered VIZ amount using `steem_per_vests` into social capital/SHARES. | `viz-vesting-calculator-form`, `viz-calc-vesting`, `Перевод VIZ в SHARES` label and `Результат конвертации` aria-live result. | Focused smoke checks controls, labels and conversion formula. | implemented |
| `index.php` | Only NOTLOAD guard; no behavior. | No route-specific PHP equivalent needed; static SPA hash route handles `#chain=viz&app=calc` through alias to `calculator`. | Focused smoke route/dispatch checks. | static-only non-goal: PHP guard not applicable |
| `js/app.js` whitespace stripping and jQuery `.load(...)` | Browser calls legacy PHP `ajax.php` endpoint and injects HTML result. | Native submit handlers, `FormData`, numeric inputs and local formula execution; no PHP endpoint or HTML injection. | Focused smoke forbids `ajax.php`, old app path, private backend/IP in calc runtime slice. | fixed in this pass |
| `ajax.php` `result_power` | Formula: `sp * charge / 100 / (total_reward_shares / 1000000) * total_reward_fund / (total_vesting_fund / total_vesting_shares) * 1000000`, integer-truncated to 6 decimals. | `calculateVizAwardValue` and `awardValue(form.get('shares'), form.get('charge'))`. | Focused smoke checks formula tokens including `Math.trunc`, reward shares/fund and vesting ratio. | implemented |
| `ajax.php` `result_fund` | Same formula with fixed `0.1` energy; then `withdraw_amount = award_fund * 200`; `all_shares_for_withdrawal = withdraw_amount * 28`. | `awardValue(shares, 0.1)`, `awardFund * 200`, `withdrawAmount * 28`. | Focused smoke checks all formula markers and legacy copy. | implemented |
| `ajax.php` `result_vests` | `steem_per_vests = 1000000 * total_vesting_fund / total_vesting_shares`; `round(sptec / 1000000 * steem_per_vests, 3)`. | Render handler computes `steemPerVests` and `Math.round((value / 1000000 * steemPerVests) * 1000) / 1000`. | Focused smoke checks conversion formula markers. | implemented |
| `snippets/get_dynamic_global_properties.php` | PHP server reads dynamic global props through GrapheneNodeClient. | `loadVizCalculatorContext` calls `profiles.apiCall(connection, 'getDynamicGlobalProperties', [])` through public VIZ RPC. | Focused smoke checks static-safe public RPC call. | implemented |
| `snippets/get_chain_properties.php` | PHP server fetches chain properties, but `ajax.php` never uses `$chain_mass` in any formula/output. | `loadVizCalculatorContext` attempts public RPC `getChainProperties`; UI states it is audited/replaced and optional because formulas do not use it. | Focused smoke checks public RPC call and plan classification. | implemented; optional data |
| `snippets/get_config.php` | PHP server fetches config, but `ajax.php` never uses `$config_mass` in any formula/output. | `loadVizCalculatorContext` attempts public RPC `getConfig`; UI states it is audited/replaced and optional because formulas do not use it. | Focused smoke checks public RPC call and plan classification. | implemented; optional data |
| PHP/backend-only runtime | Composer, `$_SERVER['DOCUMENT_ROOT']`, PHP snippets and `ajax.php` cannot run in static v3. | Static-safe public RPC and local formula execution; `VIZ_CALCULATOR_FALLBACK_PROPS` keeps UI usable if public RPC/library fails. | Focused smoke checks fallback and forbids backend/private paths. | static-only non-goal for PHP runtime itself |
| `blockchains/viz/js/blockchain.js` node handling | Legacy shared helper chose among old VIZ nodes and stored `viz_node`. | Existing `profiles.connect`/`v3/js/chains.js` uses public VIZ nodes and selected node storage; calc reuses this architecture. | Focused smoke checks `profiles.apiCall`; existing profile/broadcast tests cover connect helper. | implemented via shared helper |
| `modal-accounts.js` and auth state | Not used by calc forms; calc is read-only. | No auth form and no selected-account requirement for calc; optional account in status only. | Focused smoke forbids `broadcast.prepare`/`broadcast.broadcast` in calc slice. | read-only non-goal |
| `viz.min.js` | Browser VIZ API methods available in legacy shared environment. | Vendored static `v3/vendor/viz/viz.min.js` loaded by `getConnection(chain)` using `chain.libraryPath`. | Focused smoke plus existing route/profile tests. | implemented |

Gaps identified before code edits in this pass:

- The existing VIZ calculator already had the three broad forms and core formulas, but it hard-failed when VIZ public RPC/library connection failed and did not expose an accessible loading/fallback state.
- Legacy `get_chain_properties.php` and `get_config.php` dependencies had not been explicitly classified; inspection showed both are fetched by PHP but unused in `ajax.php` formulas or output.
- There was no focused VIZ calc test tying route alias, controls, formulas, public RPC replacement, no-backend constraint and this plan evidence together.

Implementation checklist completed in this stop-gate:

- Added `tests/v3-viz-calc-smoke.js` before implementation and observed RED on missing `loadVizCalculatorContext`.
- Added `VIZ_CALCULATOR_FALLBACK_PROPS`, `loadVizCalculatorContext`, and `calculateVizAwardValue` in `v3/js/app.js`.
- Updated `renderVizCalculator` with an explicit loading status, public RPC reads for dynamic global properties plus optional chain properties/config, accessible fallback notice, and legacy copy/control parity.
- Kept calc read-only: no `DposBroadcast.prepare`, transaction form, private backend, PHP endpoint, secrets, or old server path was introduced.

Post-implementation verification for this stop-gate:

- Static-only constraint held: VIZ calc runtime uses public RPC/client helpers and local formulas, not PHP/backend.dpos.space/178.20.43.121/private APIs.
- Required focused smoke is `tests/v3-viz-calc-smoke.js`.
- Required validation gate was run after implementation; see final one-app report for exact output summary.

### Rigorous parity: VIZ / analytics

Scope lock: this section covers exactly `VIZ / analytics` after completed `VIZ / wallet`, `VIZ / awards`, and `VIZ / calc`. Other VIZ apps (`manage`, `witnesses-rewards`, `polls`, `top`, `search`, `voice-import`, `profiles`, `custom-generator`, `explorer`, `projects`, `exchanges`, `registration`, etc.) are not audited or implemented in this pass.

Legacy files inspected completely in this pass:

- `blockchains/viz/apps/analytics/config.json` — metadata: title `Аналитика`, description `Страница с виджетом аналитики по Viz от Inov8`, menu entry `Аналитика`, category `info`.
- `blockchains/viz/apps/analytics/content.php` — only app content: author link to `/viz/profiles/inov8`, five public Yandex DataLens iframe dashboards for 2022, 2021, 2020, 2019 and 2018.
- `blockchains/viz/apps/analytics/index.php` — only NOTLOAD guard; no route logic, form handling, API call, auth, or broadcast.
- `blockchains/viz/js/blockchain.js` — shared VIZ node/auth/broadcast helper inspected; analytics content does not call its send/broadcast/ajax helpers.
- `blockchains/viz/js/modal-accounts.js` — shared legacy account storage/auth helper inspected; analytics does not need auth because it is read-only.
- `blockchains/viz/js/viz.min.js` — shared browser VIZ API library inspected as a dependency in the old VIZ environment; analytics content does not call it.

Current v3 files inspected for this pass:

- `v3/js/app.js` (`legacyAppTarget`, app routing dispatch, `renderUnsupported`, profile links, status rendering, existing VIZ renderers).
- `v3/js/chains.js` (VIZ app registry and public VIZ node list).
- `v3/js/broadcast.js` (confirmed analytics has no operation path; read-only/no broadcast).
- `v3/js/profiles.js` (profile/public RPC helper available for alternatives, not required by embedded DataLens dashboards).
- `v3/js/history.js` (account history helper available as static RPC alternative for per-account checks, not a replacement for historical DataLens/indexer aggregates).
- Existing `tests/v3-*.js`; focused coverage added in `tests/v3-viz-analytics-smoke.js`.

Matrix:

| Legacy source item | Behavior / data dependency | v3 equivalent file/function/UI | Concrete test coverage | Status |
| --- | --- | --- | --- | --- |
| `config.json` | App metadata: title/menu `Аналитика`, description credits an Inov8 analytics widget, category `info`. | `v3/js/chains.js` VIZ app `{ id: 'analytics', title: 'Аналитика' }` with read-only DataLens description. | `tests/v3-viz-analytics-smoke.js` checks app registration. | implemented |
| `content.php` author paragraph | Shows `Автор: inov8` linking to legacy `/viz/profiles/inov8`. | `renderVizAnalytics` shows author `inov8` linking to static v3 profile route via `appHash({ chain: 'viz', app: 'profiles', account: 'inov8' })`. | Focused smoke checks `Автор`, `inov8`, and route renderer evidence. | implemented |
| `content.php` 2022 iframe | Embeds public `https://datalens.yandex/c3hgr4n693ue3?` dashboard. | `renderVizAnalytics` includes 2022 section, accessible link and lazy iframe to the same public DataLens dashboard. | Focused smoke checks `2022 год` and `c3hgr4n693ue3`. | implemented |
| `content.php` 2021 iframe | Embeds public `https://datalens.yandex/lcqihrxwopkwc?` dashboard. | `renderVizAnalytics` includes 2021 section, accessible link and lazy iframe to the same public DataLens dashboard. | Focused smoke checks `2021 год` and `lcqihrxwopkwc`. | implemented |
| `content.php` 2020 iframe | Embeds public `https://datalens.yandex/qhaak9837szoi?` dashboard. | `renderVizAnalytics` includes 2020 section, accessible link and lazy iframe to the same public DataLens dashboard. | Focused smoke checks `2020 год` and `qhaak9837szoi`. | implemented |
| `content.php` 2019 iframe | Embeds public `https://datalens.yandex/8zsqzsvwlvqo0?` dashboard. | `renderVizAnalytics` includes 2019 section, accessible link and lazy iframe to the same public DataLens dashboard. | Focused smoke checks `2019 год` and `8zsqzsvwlvqo0`. | implemented |
| `content.php` 2018 iframe | Embeds public `https://datalens.yandex/ja318lzhxucub?` dashboard. | `renderVizAnalytics` includes 2018 section, accessible link and lazy iframe to the same public DataLens dashboard. | Focused smoke checks `2018 год` and `ja318lzhxucub`. | implemented |
| `index.php` | Only PHP NOTLOAD guard; no behavior. | No PHP runtime equivalent; static SPA route `#chain=viz&app=analytics` handles rendering. | Focused smoke checks dedicated dispatch. | static-only non-goal: PHP guard not applicable |
| Shared `blockchains/viz/js/blockchain.js` | Provides node probing, localStorage auth, Vizonator bridge, sendAjax/pagination helpers for other apps. Analytics content does not reference those helpers. | No analytics dependency on shared auth/broadcast/ajax helpers; v3 route is pure render-only HTML plus public DataLens iframe links. | Focused smoke forbids `sendAjax(`, private backend/IP, old app path and broadcast calls in analytics runtime slice. | read-only/no broadcast |
| Shared `modal-accounts.js` | Saves encrypted VIZ keys and selected account for write flows. Analytics has no forms and does not need selected account. | No auth controls or key access in analytics route. | Focused smoke checks no `bindOperationForm` and no `broadcast.prepare`/`broadcast.broadcast`. | read-only/no broadcast |
| Shared `viz.min.js` | Browser VIZ API library available globally in old VIZ pages. Analytics does not call VIZ RPC directly. | v3 keeps existing `v3/vendor/viz/viz.min.js` and public RPC helpers for profile/wallet/history alternatives, but analytics route itself has no RPC requirement. | Focused smoke checks shared helpers exist while analytics runtime stays read-only. | implemented via existing architecture; not directly used |
| Yandex DataLens aggregate data | External dashboard service supplies historical analytics; source/indexer behind the dashboard is not part of dpos.space PHP runtime and cannot be reproduced from one static RPC call. | Static-safe page embeds/links the same public dashboards and documents `Публичная RPC-альтернатива`: v3 profile/wallet/history via public VIZ RPC for current/per-account checks, not full historical aggregate replacement. | Focused smoke checks `Yandex DataLens`, `static-only`, `Публичная RPC-альтернатива`. | implemented with static-only classification |

Gaps identified before code edits in this pass:

- VIZ analytics was present only in legacy; `v3/js/chains.js` had no `analytics` app registration and `v3/js/app.js` had no dedicated route renderer.
- Legacy analytics was confirmed to be static public DataLens iframe embeds, not a PHP/backend/indexer endpoint inside dpos.space and not a blockchain write flow.
- The static v3 route needed accessible links/status text around iframes because screen readers and iframe blockers may not expose embedded dashboards reliably.

Implementation checklist completed in this stop-gate:

- Added `tests/v3-viz-analytics-smoke.js` before implementation and observed RED on missing `renderVizAnalytics`.
- Added VIZ `analytics` app registration in `v3/js/chains.js`.
- Added `renderVizAnalytics(chain)` in `v3/js/app.js` with author link, five public Yandex DataLens dashboards, accessible direct links, lazy iframes, status text, and explicit read-only/static-only explanation.
- Added VIZ analytics route dispatch in `renderRoute`.
- Kept analytics read-only: no `DposBroadcast.prepare`, transaction form, auth key access, private backend, PHP endpoint, old app runtime path, or server-side API was introduced.

Post-implementation verification for this stop-gate:

- Static-only constraint held: VIZ analytics runtime uses public DataLens embeds/links and existing static v3 navigation only; no PHP/backend.dpos.space/178.20.43.121/private APIs.
- Required focused smoke is `tests/v3-viz-analytics-smoke.js`.
- Required validation gate was run after implementation; see final one-app report for exact output summary.

### Rigorous parity: VIZ / manage

Scope: strict one-app parity for legacy `blockchains/viz/apps/manage` into static-only v3 VIZ manage. This section covers exactly the VIZ manage app after completed VIZ wallet, awards, calc, and analytics. v3 must not call PHP, `backend.dpos.space`, `178.20.43.121`, private server APIs, or store any private WIF/service secret.

Files inspected for this pass:
- `/root/ai-projects/dpos.space/blockchains/viz/apps/manage/config.json`, `content.php`, `index.php`, `js/app.js`.
- `/root/ai-projects/dpos.space/blockchains/viz/apps/manage/pages/access/{config.json,content.php,dostup.js}`.
- `/root/ai-projects/dpos.space/blockchains/viz/apps/manage/pages/create-account/{config.json,content.php,footer.js}`.
- `/root/ai-projects/dpos.space/blockchains/viz/apps/manage/pages/many-invites/{config.json,content.php,footer.js}`.
- `/root/ai-projects/dpos.space/blockchains/viz/apps/manage/pages/multisig/config.json`, `/root/ai-projects/dpos.space/blockchains/viz/apps/manage/pages/multisig/content.php`, `/root/ai-projects/dpos.space/blockchains/viz/apps/manage/pages/multisig/footer.js`.
- `/root/ai-projects/dpos.space/blockchains/viz/apps/manage/pages/profile/{config.json,content.php,footer.js}`.
- `/root/ai-projects/dpos.space/blockchains/viz/apps/manage/pages/reset-keys/{config.json,content.php,sbros.js}`.
- `/root/ai-projects/dpos.space/blockchains/viz/apps/manage/pages/witness/{config.json,content.php,footer.js}`.
- `/root/ai-projects/dpos.space/blockchains/viz/apps/manage/pages/witnesses/{config.json,content.php,footer.js}`.
- `/root/ai-projects/dpos.space/blockchains/viz/apps/manage/pages/workers/{config.json,content.php,footer.js}`.
- Shared helpers inspected as needed: `/root/ai-projects/dpos.space/blockchains/viz/js/blockchain.js`, `modal-accounts.js`, `viz.min.js`, `sjcl.min.js`.
- Current v3 inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/auth.js`, `v3/js/profiles.js`, `v3/js/history.js`, `tests/v3-*.js`, route config.

Matrix:

| Legacy file/page/function/control | Legacy dependency / operation | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `config.json`, `content.php`, `index.php` | Manage landing and subpage table: profile, witnesses, witness, workers, create-account, access, reset-keys, many-invites, multisig | `chains.js` VIZ `manage` route + `renderManage(chain)` with `#viz-manage-nav` anchors for all nine legacy subpages | `tests/v3-viz-manage-smoke.js` checks route, renderer, anchors | Implemented |
| `js/app.js::pass_gen` | Legacy secret WIF generation used `Math.random` | v3 secret/key generation uses `secureRandomLegacySeed` with `crypto.getRandomValues`; old `Math.random` helper is not used by VIZ manage secret flows | smoke checks `generateVizInviteSecret` and `generateVizResetKeys` slices contain no `Math.random` | Implemented, safer than legacy |
| `pages/profile/content.php`, `footer.js::profile_save` | Loads `json_metadata`, edits profile fields, `viz.broadcast.accountMetadata(posting_key, viz_login, json_metadata)`; legacy Imgur upload uses external API | `manage-profile-form` prepares `accountMetadata` with static profile/social fields; no Imgur API upload | smoke checks `manage-profile-form` and `accountMetadata`; forbidden backend scan | Implemented; Imgur upload is non-goal external API |
| `pages/witnesses/content.php`, `footer.js`, manage `proxyVote`, `oneWitnessVote`, `witnessesVote` | `accountWitnessProxy`, `accountWitnessVote`, batch raw `send({operations})`, `getWitnessesByVote`, `getAccounts` | `manage-proxy-form`, `manage-witness-form`, `manage-witnesses-batch-form`, `loadWitnessVoteList` + `DposBroadcast.prepare(..., sendOperations)` | smoke checks witness forms, ops, Vizonator unsupported behavior | Implemented static-safe |
| `pages/witness/content.php`, `footer.js#witness_options` | `getWitnessByAccount`, `witnessUpdate(active_key, viz_login, url, blockSigningKey)` | `manage-witness-update-form`; for VIZ prepares `witnessUpdate(account,url,signingKey)` with public signing key validation | smoke checks `witnessUpdate`; syntax gate | Implemented |
| `pages/witness/footer.js#save_props` | Builds props from current witness settings and calls `versionedChainPropertiesUpdate(active_key, viz_login, [3, props])` | `viz-witness-props-form` accepts explicit JSON and prepares `versionedChainPropertiesUpdate(account,[3,props])` with warning | smoke checks `versionedChainPropertiesUpdate` and plan evidence | Implemented static-safe explicit JSON |
| `pages/workers/content.php`, `footer.js` | `getCommitteeRequestsList`, `getCommitteeRequest`, `getDynamicGlobalProperties`, `committeeWorkerCreateRequest(posting_key, ...)`, `committeeVoteRequest(posting_key, ...)`; Vizonator only legacy committee_vote_request bridge | `viz-committee-form` prepares `committeeWorkerCreateRequest` and `committeeVoteRequest`; broadcast has Vizonator bridge for `committeeVoteRequest` and clear unsupported error for create | smoke checks `committeeWorkerCreateRequest`, `committeeVoteRequest`, Vizonator behavior | Implemented; full list reader is later/read-only optional |
| `pages/create-account/content.php`, `footer.js#create_account` | Generates master/active/regular/memo via `pass_gen`, checks existing account, calls `accountCreate(active_key, token_amount, shares_amount, creator, account, master, active, regular, memo, json_metadata, referrer, [])`, downloads private keys after success; Vizonator unsupported | `viz-create-account-form`; local secure key generation, public-key preview only, explicit backup confirmation, `accountCreate` via DposBroadcast; subaccount suffix supported | smoke checks form/control, `accountCreate`, crypto generation, backup download evidence | Implemented; no private WIF in preview/result |
| `pages/access/content.php`, `dostup.js::manage_access_save` | Preload account authorities, add key/account auths, generate memo, `accountUpdate(master_key, account, master, active, regular, memo_key, json_metadata)`; legacy generated keys with `Math.random` and exposed private keys in DOM | Existing `manage-authority-form` supports public owner/active/regular/memo keys and owner/master WIF memory-only signing via `prepareWithPrivateKey`; v3 does not auto-display private WIF in DOM | smoke checks `manage-authority-form`, `accountUpdate`, WIF warning and sanitizer | Implemented static-safe minimal; dynamic auth builder is non-goal for this slice |
| `pages/reset-keys/content.php`, `sbros.js::reset_access` | Generates master/active/regular/memo via `Math.random`, fetches metadata, `accountUpdate(master_key, account, master, active, regular, memo_key, json_metadata)`, displays private keys in page | `viz-reset-keys-form`; secure generation with `crypto.getRandomValues`, backup download only, owner/master WIF memory-only, metadata preserved | smoke checks reset form/helper/no `Math.random`/redaction | Implemented safer than legacy |
| `pages/many-invites/content.php`, `footer.js#send_invites_data` | Generates many invite secrets with `Math.random`, maps to public `invite_key`, raw ops `create_invite`, `viz.broadcast.send({extensions:[],operations}, [active_key])`; Vizonator unsupported | `viz-many-invites-form`; secure generation, preview only public invite keys, backup download for secrets, `sendOperations` with `create_invite` ops | smoke checks form, `create_invite`, `sendOperations`, crypto, no WIF leak | Implemented |
| `pages/many-invites/footer.js#claim_invites_balance/#use_invites_balance` | Builds raw ops `claim_invite_balance` / `use_invite_balance` with `invite_secret` | Same `viz-many-invites-form` use/claim modes create sanitized `sendOperations`; single invite forms remain available | smoke checks operation names and sanitizer redacts `secret` keys | Implemented |
| `pages/multisig/content.php`, `footer.js` | Client-side multisig UI for authority account auths and signed tx submit; relies on browser VIZ library, no PHP backend | `viz-multisig-authority-form` prepares `accountUpdate` for regular/active account_auths; `viz-multisig-signed-tx-form` prepares external `broadcastTransactionSynchronous` signed JSON submit | smoke checks multisig forms and `broadcastTransactionSynchronous` | Implemented static-safe; full signing wizard is non-goal because it would handle private keys extensively |
| `blockchains/viz/js/blockchain.js::sendToVizonator` | Extension bridge supports transfer, transfer_to_vesting, delegate, withdraw, committee_vote_request, custom, awards; many manage ops explicitly alert unsupported | `broadcast.js::executeVizonator` maps supported operation subset and throws `Vizonator не поддерживает операцию ...` for unsupported manage ops | smoke checks committee Vizonator support and unsupported error text | Implemented compatibility/fail-clear |
| Legacy PHP URLs and private APIs | PHP routing and old static page includes; no required backend API for manage operations except public VIZ node reads | v3 static only: no PHP/backend/private server strings in `renderManage` runtime | smoke forbidden string scan; full validation gate | Implemented |

Validation target for this app:
- Focused: `node tests/v3-viz-manage-smoke.js`.
- Mandatory gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && for f in tests/v3-*.js; do node "$f" || exit 1; done && git diff --check`.

Remaining static-safe non-goals:
- No PHP/backend/private server implementation, no hardcoded signer WIF, no `.env` or private service keys.
- No legacy Imgur upload token/API workflow.
- No automatic private-key display in page DOM for access/reset/account creation; v3 uses explicit backup downloads and sanitized preview/result.
- No full read-only committee request list UI beyond operation forms in this write pass; creation/vote operations are covered.

### Rigorous parity: VIZ / witnesses-rewards

Scope and result:
- Legacy app order context: VIZ `randomblockchain`, `calc`, `analytics`, `awards`, `manage`, `witnesses-rewards`, then `polls`; wallet/awards/calc/analytics/manage were already closed, so this pass covers only `witnesses-rewards`.
- Legacy purpose from `config.json`: `Награды делегатов`; description: `Страница со списком делегатов Viz и их наград за текущий день и месяц, предыдущий день и месяц.`; menu/category: `Делегаты` / `reytings`.
- Exact backend dependency confirmed before classification: `content.php` backend read `file_get_contents('http://178.20.43.121:3100/viz-api?service=witnesses')`, decoded JSON, then rendered daily/monthly reward aggregate fields.
- Static-only decision: historical day/month reward sums are backend/indexer-only non-goals for v3 because public VIZ RPC witness methods expose current witness records/votes/properties, not those precomputed reward aggregates. v3 must not call PHP, `178.20.43.121`, `backend.dpos.space`, or a replacement private API.
- Public RPC alternative: vendored VIZ client includes witness RPC descriptors in `witness_api`: `get_witnesses_by_vote`, `lookup_witness_accounts`, `get_witness_by_account`, `get_active_witnesses`. v3 exposes a bounded public RPC witness list loader as honest static-safe replacement context, while marking reward aggregate columns unavailable.
- Runtime safety: route is read-only, uses no auth keys, no operation forms, no `bindOperationForm`, no `broadcast.prepare`, and no broadcast execution.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/viz/apps/witnesses-rewards/config.json`, `/root/ai-projects/dpos.space/blockchains/viz/apps/witnesses-rewards/content.php`, `/root/ai-projects/dpos.space/blockchains/viz/apps/witnesses-rewards/index.php`.
- Legacy linked/shared files: `/root/ai-projects/dpos.space/blockchains/viz/js/blockchain.js`, `/root/ai-projects/dpos.space/blockchains/viz/js/modal-accounts.js`, `/root/ai-projects/dpos.space/blockchains/viz/js/viz.min.js`.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing `tests/v3-*.js`, especially `tests/v3-golos-witnesses-rewards-smoke.js` and route coverage tests.

File/function/form/control/helper matrix:

| Legacy file/content/link/script/data dependency | Exact legacy evidence | v3 equivalent / test | Status |
| --- | --- | --- | --- |
| `config.json` app metadata | title `Награды делегатов`; description `Страница со списком делегатов Viz и их наград за текущий день и месяц, предыдущий день и месяц.`; `in_menu` `Делегаты`; category `reytings` | `v3/js/chains.js` VIZ app route `witnesses-rewards`, title preserved, `accountField: false`; asserted by `tests/v3-viz-witnesses-rewards-smoke.js` | Implemented static route |
| `content.php` backend read `file_get_contents('http://178.20.43.121:3100/viz-api?service=witnesses')` | Direct private IP/indexer service call; no public browser-safe URL; JSON decoded with `json_decode($html, true)` | Runtime does not fetch this service; `renderVizWitnessesRewards` documents `viz-api?service=witnesses` only as evidence; smoke test forbids `178.20.43.121`, `backend.dpos.space`, `file_get_contents`, and runtime `viz-api` fetches | Static-only non-goal for backend/indexer dependency |
| `content.php` table notice | `<strong>Обновление происходит в полночь по GMT, но не все сразу делегаты обновляются, а те, которые подписывают блоки.</strong>` | Same notice in v3 renderer; smoke test asserts `Обновление происходит в полночь по GMT` | Ported as user-facing context |
| `content.php` table header `Логин`; row link `$conf['siteUrl'].'viz/profiles/'.$witness['login'].'/witness'` | Legacy profile/witness link per row | v3 public RPC rows link to `#chain=viz&app=profiles&account=<witness>` with text `профиль witness`; smoke test asserts hash profile link and text | Implemented static-safe alternative |
| `content.php` table header `за вчерашний день`; row field `round($witness['old_daily_profit'], 3)` | Historical previous UTC-day reward aggregate from private backend | v3 legacy column matrix lists `old_daily_profit`; marked backend-only non-goal and does not invent numbers; smoke test asserts evidence and classification | Static-only non-goal |
| `content.php` table header `за сегодня`; row field `round($witness['now_daily_profit'], 3)` | Historical/current UTC-day reward aggregate from private backend | v3 legacy column matrix lists `now_daily_profit`; marked backend-only non-goal | Static-only non-goal |
| `content.php` table header `за прошлый месяц`; row field `round($witness['old_monthly_profit'], 3)` | Historical previous UTC-month reward aggregate from private backend | v3 legacy column matrix lists `old_monthly_profit`; marked backend-only non-goal | Static-only non-goal |
| `content.php` table header `за текущий месяц`; row field `round($witness['now_monthly_profit'], 3)` | Historical/current UTC-month reward aggregate from private backend | v3 legacy column matrix lists `now_monthly_profit`; marked backend-only non-goal; smoke test asserts exact evidence | Static-only non-goal |
| `index.php` | Guard-only stub: `if (!defined('NOTLOAD')) exit(...)`; no UI or logic | No v3 runtime equivalent needed; route is handled by static SPA renderer | Not needed |
| Shared `blockchain.js` | Node setup and auth helpers exist globally, but `witnesses-rewards/content.php` does not call browser JS or broadcast | v3 uses existing `profiles.connect(chain)` and `loadScript(chain.libraryPath)` only for public RPC; no key/account dependency | Reused safe helper path |
| Shared `modal-accounts.js` | Account save/select, key encryption and `sendToVizonator` helpers are unrelated to this read-only page | v3 route sets `accountField: false`, no account selector requirement, no key prompt | Excluded as unrelated auth/broadcast helper |
| `viz.min.js` witness API descriptors | Contains `witness_api` descriptors for `get_witnesses_by_vote`, `lookup_witness_accounts`, `get_witness_by_account`, `get_active_witnesses` | `loadVizWitnessesByVote(chain)` calls `getWitnessesByVote('', 50)` and falls back to `lookupWitnessAccounts('', 50)` + `getWitnessByAccount(name)`; smoke test asserts methods and plan evidence | Implemented public RPC alternative |
| Forms / controls | Legacy app has no form, no button, no transaction submit; it renders a backend-filled table server-side | v3 adds one explicit keyboard button to load current public witness records and an aria-live status; no write operation controls | Static-safe accessibility improvement |
| Broadcast behavior | No legacy broadcast in app files; shared helpers contain broadcast operations but are not used here | v3 slice has no `bindOperationForm`, no `broadcast.prepare`, no `broadcast.broadcast`; smoke test asserts read-only behavior | Read-only preserved |

Validation plan for this app:
- Focused RED/GREEN smoke: `node tests/v3-viz-witnesses-rewards-smoke.js`.
- Mandatory final gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && for f in tests/v3-*.js; do node "$f" || exit 1; done && git diff --check`.

Remaining gaps/non-goals:
- Exact daily/monthly reward aggregates (`old_daily_profit`, `now_daily_profit`, `old_monthly_profit`, `now_monthly_profit`) remain unavailable without the legacy private indexer/backend. Static v3 must not fake or scrape them.
- The public RPC witness list is intentionally bounded to 50 records for a lightweight static page; it is a current witness context, not a historical reward replacement.

### Rigorous parity: VIZ / polls

Scope and result:
- Legacy purpose from `config.json`: title `Опросы`, description `Страница опросов Viz`, menu/category `Опросы` / `tools`.
- Legacy landing `content.php` had only two links: `viz/polls/create` and `viz/polls/list`; `index.php` routed subpages from `pages/<type>/content.php` and appended title/description for `results` and `voteing`.
- Backend yes/no: **yes for index/list/view/results**. `pages/list/content.php`, `pages/voteing/content.php`, and `pages/results/content.php` all depended on `http://178.20.43.121:3100/viz-api?service=votes`. This is backend/indexer-only for listing, poll lookup, active/end state, answer lookup, top voters, and weighted result aggregation.
- Static-safe writable pieces: `pages/create/page.js` can be represented by a VIZ `transfer` to `committee` with `1.000 VIZ` and `viz-votes/createVote` memo; `pages/voteing/page.js` can be represented by a `custom` operation id `viz-votes` with `voteing` JSON when the user already knows permlink and answer id.
- Static-only decision: v3 does not add a replacement server/indexer and does not invent poll lists/results. In short: backend/indexer-only for listing, poll lookup, and weighted result aggregation. It offers minimal accessible forms through existing auth/broadcast helpers plus an honest History/RPC fallback.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/viz/apps/polls/config.json`, `content.php`, `index.php`.
- Legacy subpages/scripts: `pages/list/{config.json,content.php}`, `pages/create/{config.json,content.php,page.js}`, `pages/voteing/{config.json,content.php,page.js}`, `pages/results/{config.json,content.php,get_dynamic_global_properties.php}`.
- Legacy/shared evidence: `/root/ai-projects/dpos.space/README.md` (`polls - сервис проведения опросов... custom_json`), `sitemap.xml` (`/golos/polls` legacy mention only), shared VIZ browser helpers for `viz.broadcast.send` / `sendToVizonator` behavior.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing smoke tests.

Matrix:

| Legacy file/page/function/control | Exact legacy dependency / operation | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `config.json` | title `Опросы`; description `Страница опросов Viz`; menu `Опросы`; category `tools` | `v3/js/chains.js` VIZ app route `polls`, title preserved, `accountField: false`, description names `viz-votes` | `tests/v3-viz-polls-smoke.js` route assertions | Implemented |
| `content.php` landing | Links to `viz/polls/create` and `viz/polls/list`; no backend itself | `renderVizPolls(chain)` single static page with nav sections `Создание опроса`, `Список/просмотр опросов`, `Голосование`, `Результаты` | smoke checks headings/nav text | Implemented |
| `index.php` | PHP directory router, `pageUrl()[2]`, `require_once pages/<type>/content.php`; no standalone browser logic | Static SPA dispatch `chain.id === 'viz' && effectiveAppId === 'polls'` | smoke checks dispatch string | Implemented |
| `pages/list/content.php` | `pages/list/content.php` backend read `file_get_contents('http://178.20.43.121:3100/viz-api?service=votes&type=list')`; rendered backend `permlink`/`question` | No runtime backend fetch. v3 documents backend-only indexer dependency and links to History with `ops=transfer,custom&query=viz-votes` | smoke forbids runtime `fetch(...viz-api)`, `file_get_contents`; checks backend evidence only as documentation | Static-only non-goal with safe RPC/history fallback |
| `pages/create/content.php` | Form fields login, question, answer list, end datetime, consider, service selector; included `pages/create/page.js` | `viz-polls-create-form` with question, multiline answers, datetime-local, consider select; aria-live operation result | smoke checks form/result/status text | Implemented accessible form |
| `pages/create/page.js` | `pages/create/page.js` built a paid transfer to `committee` for `1.000 VIZ` with memo `contractName: "viz-votes"`, `contractAction: "createVote"`; legacy sign URL and optional local active-key/Vizonator send | `buildVizPollCreateMemo(...)`; `broadcast.prepare(chain, 'active', 'transfer', [creator, 'committee', '1.000 VIZ', memo])`; existing `bindOperationForm` preview/send/confirm handles local key or Vizonator | smoke checks memo builder, `committee`, `1.000 VIZ`, `broadcast.prepare` active transfer | Implemented static-safe |
| `pages/voteing/content.php` | Backend read `file_get_contents('http://178.20.43.121:3100/viz-api?service=votes&type=voteing&permlink='.pageUrl()[3])`; rendered answer radio buttons only if not ended | v3 does not fetch/guess answers; manual `permlink` + `answerId` form for known poll data | smoke checks backend-only classification and manual fields | Partial: write operation only; dynamic view is backend/indexer non-goal |
| `pages/voteing/page.js` | `pages/voteing/page.js` built custom operation id `viz-votes` / `contractAction: "voteing"`, payload `votePermlink` and `answerId`; used sign URL, local posting/regular key, or Vizonator custom bridge | `buildVizPollVoteMemo(...)`; `broadcast.prepare(chain, 'regular', 'custom', [from, 'viz-votes', memo])`; existing `bindOperationForm` handles preview/send/confirm | smoke checks `voteing`, `votePermlink`, `answerId`, regular custom helper | Implemented static-safe for known permlink/answerId |
| `pages/results/content.php` | Backend read `file_get_contents('http://178.20.43.121:3100/viz-api?service=votes&type=vote&permlink='.pageUrl()[3])`, plus dynamic global properties, `all_shares`, `variants`, `percent`, `voters` | v3 documents Results as backend/indexer-only; no fake percentages/top voters | smoke checks `Результаты` and `backend-only non-goal` text | Static-only non-goal |
| `get_dynamic_global_properties.php` | Server-side PHP RPC helper for total vesting shares in result percentages | Existing v3 public RPC can read globals elsewhere, but cannot replace missing indexed vote totals; not used for fake result calc | plan evidence and renderer note | Non-goal for polls results aggregation |
| Shared `viz.broadcast.send` / `sendToVizonator` | Local active transfer and regular custom could be broadcast without poll backend if payload is known | v3 reuses existing `DposBroadcast.prepare`, `bindOperationForm`, local key decrypt/Vizonator mapping; no new service/app/backend | smoke checks no old PHP runtime refs | Implemented |

Validation plan for this app:
- TDD RED observed before implementation: `node tests/v3-viz-polls-smoke.js` failed with `AssertionError [ERR_ASSERTION]: VIZ exposes polls app route`.
- Focused GREEN target: `node tests/v3-viz-polls-smoke.js`.
- Mandatory final gate: `node --check v3/js/app.js v3/js/chains.js v3/js/broadcast.js v3/js/profiles.js && node tests/v3-viz-polls-smoke.js && git diff --check`.

Remaining gaps/non-goals:
- No backend/indexer replacement for global poll list, permlink lookup, active answer rendering, weighted result percentages, top voters, or historical poll discovery.
- Voting form intentionally requires known `votePermlink` and zero-based `answerId`; static v3 does not infer them without the old `viz-api?service=votes` data.
- Create poll sends the legacy paid transfer only through existing explicit preview/send/confirm flow; no automatic broadcast and no new key storage.

### Rigorous parity: VIZ / profiles

Scope and result:
- Legacy purpose from `config.json`: title `Просмотр профилей`, description `Просмотрщик профилей в блокчейне Viz`, menu `Профили`, `no_category`.
- Legacy landing `content.php` was a simple POST search form for a VIZ login without `@`.
- Legacy `index.php` routed profile subpages: `history`, `transfers`, `shares`, `dao`, `awards`, `receive-awards`, `benefactor-awards`, `accounts`, `subscriptions`, `witness`, plus the main `page/userinfo.php` profile page.
- Backend yes/no: **yes for several paginated subpages and modal award UI**. Main account/userinfo and witness data were direct VIZ RPC through PHP snippets, while transfers/shares/dao/awards/receive-awards/benefactor-awards/accounts/subscriptions used PHP page endpoints and `getLoad(...)` pagination. The award modal used `award_modal/ajax.php` and legacy JS around local keys/Vizonator.
- Static-safe result: v3 already has a public-RPC profile renderer and history route. This pass adds VIZ-specific legacy profile quick links that map PHP subpages to static `history` operation filters, and maps the old award/edit-profile actions to existing static `award` and `manage` apps without restoring PHP endpoints.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/viz/apps/profiles/config.json`, `content.php`, `index.php`.
- Legacy page files/snippets/scripts: `page/userinfo.php`, `page/history.php`, `page/transfers.php`, `page/shares.php`, `page/dao.php`, `page/awards.php`, `page/receive_awards.php`, `page/benefactor_awards.php`, `page/accounts.php`, `page/subscriptions.php`, `page/witness.php`, `page/snippets/get_account.php`, `page/snippets/get_dynamic_global_properties.php`, `page/snippets/get_chain_properties.php`, `page/snippets/get_config.php`, `page/snippets/get_witness_by_account.php`, `page/snippets/get_account_history_chunk.php`, `js/app.js`, `award_modal/ajax.php`, `award_modal/builder.js`.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/profiles.js`, `v3/js/history.js`, `v3/js/broadcast.js`, existing `tests/v3-profiles-smoke.js`, existing VIZ app smoke tests.

Matrix:

| Legacy file/page/function/control | Exact legacy dependency / operation | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `config.json` | title/menu `Просмотр профилей` / `Профили`, category `no_category` | Existing `v3/js/chains.js` base app `profiles`, account field enabled, public API description | `tests/v3-viz-profiles-smoke.js` checks route registration | Implemented |
| `content.php` | POST form with hidden `chain=viz`, `service=profiles`, `user` input without `@` | Existing SPA account input + `#chain=viz&app=profiles&account=<name>` route | focused smoke checks legacy form evidence and route renderer | Implemented through shared v3 account route |
| `index.php` main page | Strips `@`, emits legacy subpage nav and loads `page/userinfo.php`; has `award_modal/ajax.php` link and manage/profile link | `renderProfileRoute` + `renderProfile` load public account data; new `vizLegacyProfileLinks(account)` exposes static replacements for the old nav/actions | smoke checks function and labels | Implemented |
| `page/userinfo.php` | PHP snippets call `getAccounts`, `getDynamicGlobalProperties`, `getChainProperties`, `getConfig`; computes energy regen, social capital, profile metadata, authorities/stats | `v3/js/profiles.js` VIZ normalization exposes VIZ, SHARES, delegated/received, energy, current energy, custom sequence, metadata, socials, authorities, governance, raw JSON | existing `tests/v3-profiles-smoke.js`; focused smoke checks VIZ-specific normalizer evidence | Implemented |
| `page/history.php` + `js/app.js` | Browser fetched up to 1000 history entries and filtered selected ops/query; operation map includes transfer, award, receive_award, benefactor_award, subscriptions, DAO, witness, account-sale operations | Existing `history` app fetches public account history and supports `ops` + `query`; VIZ profile quick links now prefill static filters | focused smoke checks representative op-filter links | Implemented static-safe |
| `page/transfers.php` | PHP AJAX endpoint over `get_account_history_chunk.php`; filters transfer/invite operations and paginates 10 rows | Link to `history` with `transfer,transfer_to_vesting,create_invite,claim_invite_balance,use_invite_balance` | focused smoke checks filter string; no PHP endpoint in runtime | Implemented as static history filter |
| `page/shares.php` | PHP AJAX over account history for social-capital operations | Link to `history` with `delegate_vesting_shares,transfer_to_vesting,withdraw_vesting,return_vesting_delegation` | focused smoke checks filter string | Implemented as static history filter |
| `page/dao.php` | PHP AJAX over account history for committee/DAO request/vote/pay operations | Link to `history` with `committee_worker_create_request,committee_worker_cancel_request,committee_vote_request,committee_cancel_request,committee_approve_request,committee_payout_request,committee_pay_request` | focused smoke checks filter string | Implemented as static history filter |
| `page/awards.php` | PHP AJAX over account history for sent awards | Link to `history` with `award,fixed_award` | focused smoke checks labels/filter | Implemented as static history filter |
| `page/receive_awards.php` | PHP AJAX over account history for received awards | Link to `history` with `receive_award` | focused smoke checks filter | Implemented as static history filter |
| `page/benefactor_awards.php` | PHP AJAX over account history for beneficiary awards | Link to `history` with `benefactor_award` | focused smoke checks filter | Implemented as static history filter |
| `page/accounts.php` | PHP AJAX over account-history account/subaccount sale and bid operations | Link to `history` with account-sale/bid operation filters | focused smoke checks no PHP runtime; plan matrix documents mapping | Implemented as static history filter |
| `page/subscriptions.php` | PHP AJAX over paid subscription operations | Link to `history` with `set_paid_subscription,paid_subscribe,paid_subscription_action,cancel_paid_subscription` | focused smoke checks filter | Implemented as static history filter |
| `page/witness.php` | PHP snippet `get_witness_by_account.php`, renders witness URL/status/props; no hidden backend beyond public RPC wrapper | Link to existing VIZ witnesses-rewards/public witness context; detailed per-account witness profile remains available through public raw profile/governance data when account is loaded | focused smoke checks `Делегат` link | Partial static-safe parity; no PHP snippet restored |
| `award_modal/ajax.php` + `award_modal/builder.js` | Legacy modal built award form, checked regular key, used local encrypted key or Vizonator; dependency was `award_modal/ajax.php` | Link `Наградить пользователя` goes to existing static award app (`award`) with target/account route params; no modal PHP endpoint | focused smoke checks `app: 'award'`; plan documents replacement | Implemented through existing static app |
| `Изменить профиль` link in `index.php` | Legacy pointed to `/viz/manage/profile` and only displayed for current login via JS | Link `Изменить профиль` points to existing static `manage` app profile section; actual auth/broadcast remains in manage app | focused smoke checks `app: 'manage'` | Implemented through existing static app |

Validation plan for this app:
- TDD RED observed before implementation: `node tests/v3-viz-profiles-smoke.js` failed with `AssertionError [ERR_ASSERTION]: VIZ profiles expose a legacy subpage to static history-link mapper`.
- Focused GREEN target: `node tests/v3-viz-profiles-smoke.js`.
- Mandatory app gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-viz-profiles-smoke.js && git diff --check`.

Remaining gaps/non-goals:
- No legacy PHP routes, `getLoad(...)` endpoints, `award_modal/ajax.php`, or hidden server pagination are restored.
- Profile subpages that were PHP/AJAX paginated are represented as static history filters over public account history. They may not exactly reproduce legacy pagination depth or table formatting.
- The old per-account witness PHP page is not restored; v3 keeps public profile/governance data and the current witness-list context.

### Rigorous parity: VIZ / projects

Scope and result:
- Legacy purpose from `config.json`: title `projects - каталог проектов`, description `Сервис каталога проектов и задач Viz, а также всего, что с этим связано.`, menu `Проекты`, category `no_category`.
- Legacy landing `content.php` linked `catalog`, `tasks`, `add`, and `new-task`; `index.php` routed to `pages/<page>/content.php`.
- Backend yes/no: **yes for catalog/tasks/news/working-tasks/update screens**. The legacy pages repeatedly called `http://178.20.43.121:3100/viz-api?service=viz-projects` for `types`, `categories`, `projects`, `tasks`, `working_tasks`, and `news`.
- Static-safe result: v3 registers a `projects` app and renders an honest static-safe Projects page: backend/indexer-only lists are documented, while the add-project/add-task write flows are preserved as explicit paid VIZ transfers to `viz-projects` with legacy memo JSON.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/viz/apps/projects/config.json`, `content.php`, `index.php`, `js/app.js`.
- Legacy pages: `pages/catalog/content.php`, `pages/tasks/content.php`, `pages/add/content.php`, `pages/new-task/content.php`, `pages/update-project/content.php`, `pages/update-task/content.php`, `pages/working-tasks/content.php`, `pages/news/content.php`, `pages/news-editor/content.php`, `pages/one-news/content.php`, plus page configs for these routes.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing VIZ smoke tests.

Matrix:

| Legacy file/page/function/control | Exact legacy dependency / operation | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `config.json` | title/menu/category for Projects | `v3/js/chains.js` VIZ app `{ id: 'projects', title: 'Проекты' }`, `accountField: false` | `tests/v3-viz-projects-smoke.js` route assertion | Implemented |
| `content.php` | Static navigation links to catalog/tasks/add/new-task | `renderVizProjects(chain)` sections/nav for `Каталог проектов`, `Список задач`, `Добавить проект`, `Добавить задачу` | focused smoke checks section IDs/text | Implemented |
| `index.php` | PHP router `pages/<page>/content.php` | SPA dispatch `chain.id === 'viz' && effectiveAppId === 'projects'` | focused smoke checks router dispatch | Implemented |
| `pages/catalog/content.php` | Backend reads `service=viz-projects&type=types`, `categories`, `projects`; filters type/category/dev_status; renders project action links | No private runtime fetch. v3 documents backend/indexer-only catalog and links to History with `ops=transfer,custom&query=viz-projects` | focused smoke checks backend evidence and runtime forbids private IP/PHP | Static-only non-goal with history/RPC fallback |
| `pages/tasks/content.php` | Backend reads `service=viz-projects&type=tasks`; status filter; task members and update links | No private runtime fetch. v3 documents backend/indexer-only task list and preserves add-task form | focused smoke checks tasks evidence and section | Static-only non-goal for indexed task list |
| `pages/add/content.php` + `js/app.js sendTransfer('project')` | Paid `transfer` to `viz-projects`, amount `1.000 VIZ`, memo `JSON.stringify(['project', data])`, active key/Vizonator | `buildVizProjectMemo('project', data)` and `broadcast.prepare(chain, 'active', 'transfer', [from, 'viz-projects', '1.000 VIZ', memo])` | focused smoke checks `sendTransfer(`project`)` evidence, `['project', data]`, target/amount | Implemented static-safe paid transfer |
| `pages/new-task/content.php` + `js/app.js sendTransfer('task')` | Paid `transfer` to `viz-projects`, amount `1.000 VIZ`, memo `JSON.stringify(['task', {name, description, mambers: [], status: 'open'}])` | `buildVizProjectMemo('task', data)` and second accessible form with role=status result | focused smoke checks `['task', data]`, fee text, form id | Implemented static-safe paid transfer |
| `pages/update-project/content.php` | Backend fetches existing project, then `sendCustom('update_project', data)` to protocol `viz-projects`; author/moderator UI depends on indexed lookup | Not implemented as a live form because the initial project lookup is backend/indexer-only. v3 documents non-goal and keeps raw history fallback | plan evidence | Static-only non-goal for this pass |
| `pages/update-task/content.php` | Backend fetches existing task, then `sendCustom('update_task', data)`; author/moderator UI | Not implemented as a live form without indexed lookup. Could be added later as manual known-data custom form, but not required for safe parity pass | plan evidence | Static-only non-goal for this pass |
| `pages/working-tasks/content.php` | Backend `type=working_tasks`; optional `sendCustom('add_task_member'/'working_tasks'/'delete_working_task')` | Lists/reports remain backend/indexer-only. No hidden backend or fake reports in v3 | plan evidence | Static-only non-goal |
| `pages/news*.php` | Backend `type=news`; create/update/delete news via `sendCustom('news'/'delete_one_news')`, whitelist from project index | News list/one-news/editor remain backend/indexer-only because whitelist and existing news lookup require indexer | plan evidence | Static-only non-goal |

Validation plan for this app:
- TDD RED observed before implementation: `node tests/v3-viz-projects-smoke.js` failed with `AssertionError [ERR_ASSERTION]: VIZ projects app route registered`.
- Focused GREEN target: `node tests/v3-viz-projects-smoke.js`.
- Mandatory app gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-viz-projects-smoke.js && git diff --check`.

Remaining gaps/non-goals:
- No private `178.20.43.121:3100/viz-api`, PHP pages, backend.dpos.space, or hidden server API is restored.
- Indexed catalog/tasks/news/working-task/update pages remain backend/indexer-only. v3 exposes a transparent History/RPC fallback instead of fake data.
- Only create project/task paid transfers are implemented in this pass because their legacy payloads are self-contained and static-safe.

### Rigorous parity: VIZ / custom-generator

Scope and result:
- Legacy purpose from `config.json`: title `Генератор custom операций`, description `Сервис генерации custom операций для блокчейна Viz.`, menu `JSON-генератор`, category `tools`.
- Backend yes/no: **yes for the generated submit script only**. The visible builder UI was browser-side, but the generated form POSTed to `json_encode.php` to convert form-urlencoded fields to JSON before `viz.broadcast.custom`.
- Static-safe result: v3 registers `custom-generator`, documents removed PHP/jQuery UI builder pieces, validates protocol id and JSON locally, and uses the existing `broadcast.prepare`/confirmation flow for explicit VIZ `custom` broadcast. No PHP endpoint, private backend, generated external app, or hidden server API is restored.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/viz/apps/custom-generator/config.json`, `content.php`, `index.php`, `js/app.js`, `generated-script-to-minify.js`, `json_encode.php`, `css/style.css`, `css/jquery-ui.css`.
- Legacy shared files checked for classification: `/root/ai-projects/dpos.space/blockchains/viz/js/blockchain.js`, `/root/ai-projects/dpos.space/blockchains/viz/js/modal-accounts.js`, vendored `viz.min.js` usage through generated script.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing `tests/v3-viz-*-smoke.js`.

Matrix:

| Legacy file/page/function/control | Exact legacy dependency / operation | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `config.json` | title/menu `Генератор custom операций` / `JSON-генератор`, category `tools` | `v3/js/chains.js` VIZ app `{ id: 'custom-generator', title: 'JSON-генератор' }`, `accountField: false` | `tests/v3-viz-custom-generator-smoke.js` route assertion | Implemented |
| `content.php` controls | Inputs `form-id`, `form-operation`, starter nested form, buttons `Получить код формы на сайт`, `Получить JSON текущей формы`, `Вставить свой JSON`, `Открыть получившуюся форму` | Static v3 exposes explicit `ID/protocol custom_json` and `JSON payload` fields plus preview/send buttons; it does not recreate the drag/drop HTML form builder | focused smoke checks legacy controls and v3 controls/status region | Implemented minimum static-safe parity |
| `js/app.js` builder helpers | jQuery UI sortable builder, `readNodes`, `getForm`, `getField`, `getArrayStart`, `generateResultForm` | Not ported as runtime builder because safe parity only needs local JSON validation and explicit operation confirmation; arbitrary generated website script is not embedded into v3 | plan evidence; runtime slice forbids legacy paths/PHP | Static-only non-goal for drag/drop/generated HTML builder |
| `generated-script-to-minify.js` | Generated form waits for `viz`, prompts for login/regular key, POSTs serialized fields to `json_encode.php`, then calls `viz.broadcast.custom(posting_key, [], [viz_login], formId, xhr.responseText, ...)` | `renderVizCustomGenerator(chain)` calls `broadcast.prepare(chain, 'regular', 'custom', [from, protocol, json], { title: 'VIZ custom_json' })`; shared v3 flow handles preview, confirmation, key selection/broadcast | focused smoke checks `generated-script-to-minify.js`, `broadcast.prepare`, and router dispatch | Implemented static-safe broadcast flow |
| `json_encode.php` | PHP endpoint `json_encode($_POST)` after removing `viz_json_operation_name`; CORS JSON output | Replaced by local `JSON.parse`/`JSON.stringify` in `normalizeVizCustomJson`; no network request, `XMLHttpRequest`, `fetch`, PHP, or server state | focused smoke checks PHP evidence and forbids `json_encode.php`/fetch in runtime slice | Static-only non-goal, safely replaced locally |
| `css/style.css` / `css/jquery-ui.css` | Modal/drag/drop styles for legacy builder UI | Existing v3 `.stacked-form`, `.field`, `.operation-result`, panel styles; no new CSS required | visual/accessibility structure in renderer | Implemented through existing v3 styles |
| Auth/shared VIZ helpers | Legacy generated script used localStorage/sessionStorage regular key and direct `viz.broadcast.custom`; no private indexer needed for the operation itself | Existing v3 auth/broadcast stack preserves explicit key/confirmation path and regular authority semantics | focused smoke checks regular custom prepare; existing broadcast tests cover shared flow | Implemented |

Validation plan for this app:
- TDD RED observed before implementation: `node tests/v3-viz-custom-generator-smoke.js` failed with `AssertionError [ERR_ASSERTION]: VIZ custom-generator route registered`.
- Focused GREEN target: `node tests/v3-viz-custom-generator-smoke.js`.
- Mandatory app gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-viz-custom-generator-smoke.js && git diff --check`.

Remaining gaps/non-goals:
- No `json_encode.php`, old PHP pages, private IP, backend.dpos.space, generated external mini-app, hidden server API, or jQuery UI drag/drop builder is restored.
- v3 expects a ready JSON payload. Users who need complex nested payloads can prepare JSON locally and paste it into the accessible textarea.
- The operation is powerful and arbitrary by design, so v3 keeps explicit preview and confirmation before any real broadcast.

### Rigorous parity: VIZ / explorer

Scope and result:
- Legacy purpose from `config.json`: title `Блок-эксплорер`, description `block explorer (просмотр блоков) в Viz`, menu `Explorer`, category `info`.
- Backend yes/no: **no private indexer**, but legacy used PHP GrapheneNodeClient wrappers (`get_dynamic_global_properties.php`, `get_chain_properties.php`, `pages/block/block.php`, `pages/tx/get_transaction.php`) as server-side public RPC adapters.
- Static-safe result: v3 keeps the shared `explorer` app route for VIZ, adds VIZ overview parity for latest irreversible/head blocks and chain properties, and uses direct public RPC from the browser for block/transaction lookup. The app is read-only and does not bind broadcast forms.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/viz/apps/explorer/config.json`, `content.php`, `index.php`, `get_dynamic_global_properties.php`, `get_chain_properties.php`, `pages/block/config.json`, `pages/block/content.php`, `pages/block/block.php`, `pages/tx/config.json`, `pages/tx/content.php`, `pages/tx/get_transaction.php`.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing explorer/profile/history helper tests.

Matrix:

| Legacy file/page/function/control | Exact legacy dependency / operation | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `config.json` | title/menu `Блок-эксплорер` / `Explorer`, category `info` | Base `explorer` app in `v3/js/chains.js` is available to VIZ as `Проводник` | `tests/v3-viz-explorer-smoke.js` route assertion | Implemented |
| `content.php` search form | Form accepts block number or transaction hash, hidden `chain=viz`, `service=explorer` | Existing SPA explorer form accepts kind `account/block/tx` and value, with status region | focused smoke checks form/route evidence in v3 source | Implemented through shared route |
| `content.php` overview | Calls `get_dynamic_global_properties.php`, lists 10 `last_irreversible_block_num` blocks and 10 `head_block_number` blocks; calls `get_chain_properties.php` and labels core chain params | `loadVizExplorerOverview(chain, connection)` calls `getDynamicGlobalProperties` and `getChainProperties`; `renderVizExplorerOverview(data)` renders latest irreversible/head block links and `Основные параметры` with legacy labels where known | focused smoke checks `last_irreversible_block_num`, `head_block_number`, `getChainProperties` | Implemented static-safe read-only |
| `index.php` router | Redirects numeric path to `viz/explorer/block/<num>` and 40-char hash to `viz/explorer/tx/<hash>` | SPA hash route uses `#chain=viz&app=explorer&kind=block|tx&value=...`; source links use `appHash` | focused smoke checks legacy redirect evidence and v3 route dispatch | Implemented in static router pattern |
| `pages/block/block.php` | Server-side public RPC wrappers `GetOpsInBlock` and `GetBlockHeaderCommand` | `loadVizExplorerBlock(connection, blockNum)` calls `profiles.apiCall(connection, 'getOpsInBlock', [blockNum, false])` and `profiles.apiCall(connection, 'getBlockHeader', [blockNum])` directly against the public node | focused smoke checks both legacy and v3 RPC names | Implemented static-safe read-only |
| `pages/block/content.php` | Renders `Блок №`, previous/next links, timestamp, witness profile link, operations table; `convert_operation_data` links account-like fields to profiles | Existing `renderExplorerResult` renders block fields, operation table with accessible caption, account links via `renderExplorerFields`/`formatExplorerValue` | focused smoke checks legacy block rendering and v3 block loader; route coverage tests cover table/accessibility helpers | Implemented with shared renderer |
| `pages/tx/get_transaction.php` | Server-side public RPC wrapper `GetTransaction` | Existing tx branch uses `profiles.apiCall(connection, 'getTransaction', [tx_id])` | focused smoke checks legacy/v3 RPC names | Implemented static-safe read-only |
| `pages/tx/content.php` | Renders block link and operations table for a transaction; account-like fields link to profiles | Existing `renderExplorerResult(kind='tx')` renders summary, block link, operations table, raw JSON details | focused smoke checks tx route evidence | Implemented through shared renderer |
| PHP/vendor helpers | `vendor/autoload.php`, `helpers.php`, `CONNECTORS_MAP['viz']` only wrapped public node calls | Removed from runtime; browser loads vendored VIZ JS and uses configured public nodes via `profiles.connect` | focused smoke forbids `.php`, private IP, `backend.dpos.space`, legacy runtime paths in VIZ explorer slice | Static-only non-goal |

Validation plan for this app:
- TDD RED observed before implementation: `node tests/v3-viz-explorer-smoke.js` failed with `AssertionError [ERR_ASSERTION]: v3 has VIZ explorer overview loader` after legacy evidence was corrected.
- Focused GREEN target: `node tests/v3-viz-explorer-smoke.js`.
- Mandatory app gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-viz-explorer-smoke.js && git diff --check`.

Remaining gaps/non-goals:
- No PHP GrapheneNodeClient wrappers, legacy path redirects, private IP, backend.dpos.space, or server-side connector state is restored.
- The v3 renderer is static/browser-side and may display raw JSON details instead of duplicating every legacy PHP formatting quirk.
- Explorer remains read-only; no broadcast path is added.

### Rigorous parity: VIZ / exchanges

Scope and result:
- Legacy purpose from `config.json`: title `Купить и продать VIZ`, description `Страница со способами покупки и продажи VIZ`, menu `Обмен VIZ`, category `info`.
- Backend yes/no: **no**. Legacy `content.php` is static direct links only; `index.php` contains only the `NOTLOAD` guard.
- Static-safe result: v3 keeps a dedicated `exchanges` route for VIZ and preserves the exact legacy link set as read-only static links. No broadcast, fetch, PHP, private backend, or exchange integration service is added.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/viz/apps/exchanges/config.json`, `content.php`, `index.php`.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing route smoke tests.

Matrix:

| Legacy file/page/function/control | Exact legacy dependency / operation | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `config.json` | title/menu `Купить и продать VIZ` / `Обмен VIZ`, category `info` | `v3/js/chains.js` VIZ app `{ id: 'exchanges', title: 'Обмен VIZ' }` | `tests/v3-viz-exchanges-smoke.js` route assertion | Implemented |
| `content.php` item 1 | Static link `https://swap.viz.world/` with text `swap.viz.world` | `renderVizExchanges(chain)` keeps the same URL as a read-only external link | focused smoke checks URL | Implemented |
| `content.php` item 2 | Static link to `https://control.viz.world/media/@urri77/покупка-viz-за-usdt-на-бирже-рудекс/` | `renderVizExchanges(chain)` keeps the same article URL | focused smoke checks URL slug | Implemented |
| `content.php` item 3 | Static link `https://readdle.me/#viz://@denis-skripnik/60937915/publication/` about the Minter gateway | `renderVizExchanges(chain)` keeps the same Readdle/VIZ URL | focused smoke checks URL | Implemented |
| `index.php` | Only `NOTLOAD` direct-access guard; no runtime logic | SPA router dispatches `chain.id === 'viz' && effectiveAppId === 'exchanges'` | focused smoke checks router dispatch | Implemented |
| Backend/broadcast dependencies | None in legacy; no forms or RPC calls | No `fetch`, `broadcast.prepare`, `bindOperationForm`, PHP, private IP, or backend.dpos.space in runtime slice | focused smoke checks static read-only classification | Implemented read-only |

Validation plan for this app:
- TDD RED observed before implementation/plan update: `node tests/v3-viz-exchanges-smoke.js` failed with `AssertionError [ERR_ASSERTION]: plan contains VIZ exchanges parity section`.
- Focused GREEN target: `node tests/v3-viz-exchanges-smoke.js`.
- Mandatory app gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-viz-exchanges-smoke.js && git diff --check`.

Remaining gaps/non-goals:
- No new exchange API integration, backend service, price widget, swap daemon, embedded trading UI, or wallet operation is added.
- v3 intentionally remains a read-only static link page, matching the legacy app's static direct links.

### Rigorous parity: VIZ / help

Scope and result:
- Legacy purpose from `config.json`: title `Справка по dpos.space`, description `Страница со ссылками на информацию по сервисам dpos.space.`, menu `Справка`, category `info`.
- Backend yes/no: **no**. Legacy `content.php` only emitted a JavaScript `location.replace("https://viz.media/obzor-servisov-dpos-space-viz/")`; `index.php` contains only the direct-access guard.
- Static-safe result: v3 registers `help` for VIZ and replaces the auto-redirect with an explicit accessible link to the same destination. The route is read-only, preserves context for screen-reader users, and does not call PHP/backend services.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/viz/apps/help/config.json`, `content.php`, `index.php`.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing route smoke tests.

Matrix:

| Legacy file/page/function/control | Exact legacy dependency / operation | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `config.json` | title/menu `Справка по dpos.space` / `Справка`, category `info` | `v3/js/chains.js` VIZ app `{ id: 'help', title: 'Справка' }` | `tests/v3-viz-help-smoke.js` route assertion | Implemented |
| `content.php` | JavaScript `location.replace` to `https://viz.media/obzor-servisov-dpos-space-viz/` | `renderVizHelp(chain)` renders the same URL as an explicit accessible link named `Обзор сервисов dpos.space` | focused smoke checks legacy redirect and v3 URL/text | Implemented static direct link |
| `index.php` | Only `NOTLOAD` direct-access guard; no runtime logic | SPA router dispatches `chain.id === 'viz' && effectiveAppId === 'help'` | focused smoke checks router dispatch | Implemented |
| Auto redirect behavior | Browser immediately leaves dpos.space page, which can be disorienting for screen-reader users | Auto redirect is intentionally not restored; v3 uses an explicit link and status text | focused smoke forbids `location.replace` in runtime slice | Static-safe accessibility improvement |
| Backend/broadcast dependencies | None in legacy | No `fetch`, `broadcast.prepare`, `bindOperationForm`, PHP, private IP, or backend.dpos.space in runtime slice | focused smoke checks read-only classification | Implemented read-only |

Validation plan for this app:
- TDD RED observed before implementation: `node tests/v3-viz-help-smoke.js` failed with `AssertionError [ERR_ASSERTION]: VIZ help app route registered`.
- Focused GREEN target: `node tests/v3-viz-help-smoke.js`.
- Mandatory app gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-viz-help-smoke.js && git diff --check`.

Remaining gaps/non-goals:
- No auto-redirect is restored; this is an intentional static/accessibility replacement.
- No backend, PHP, hidden API, fetch, or broadcast behavior is added.

### Rigorous parity: VIZ / voice-import

Scope and result:
- Legacy purpose from `config.json`: title `Импорт в voice (readdle.me)`, description `Это сервис, реализующий функционал импорта статьи из telegra.ph и mirror.xyz в readdle.me (протокол Voice).`, menu `Импорт в Voice`, category `tools`.
- Legacy landing `content.php` exposed a `posting_auth_msg`, URL input for `telegra.ph` / `mirror.xyz`, `Импортировать` button, and `results` area.
- Backend yes/no: **yes for URL fetching and image rehosting**. `js/app.js` fetched article HTML through `https://dpos.space/blockchains/viz/apps/voice-import/proxy.php?url=...`; `proxy.php` did `file_get_contents($url)`; images were optionally uploaded to Imgur with a public `Imgur Client-ID`. Publishing itself was a VIZ `custom` operation under protocol `V` and regular authority.
- Static-safe result: v3 registers a dedicated `voice-import` app. It tries direct browser fetch when CORS allows it, supports manual HTML/text paste, builds the Voice payload locally, and publishes only through the existing explicit preview/send/confirm `broadcast.prepare` flow for custom protocol `V`. The legacy proxy, PHP, server-side URL fetch, and Imgur upload are not restored.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/viz/apps/voice-import/config.json`, `content.php`, `index.php`, `js/app.js`, `proxy.php`, `js/axios.min.js`.
- Relative legacy evidence paths: `blockchains/viz/apps/voice-import/config.json`, `blockchains/viz/apps/voice-import/content.php`, `blockchains/viz/apps/voice-import/index.php`, `blockchains/viz/apps/voice-import/js/app.js`, `blockchains/viz/apps/voice-import/proxy.php`.
- Legacy shared files checked for classification: `/root/ai-projects/dpos.space/blockchains/viz/js/blockchain.js`, `/root/ai-projects/dpos.space/blockchains/viz/js/modal-accounts.js`, vendored VIZ library behavior through `viz.broadcast.customAsync`.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing `tests/v3-viz-*-smoke.js`.

Matrix:

| Legacy file/page/function/control | Exact legacy dependency / operation | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `config.json` | title/menu `Импорт в voice (readdle.me)` / `Импорт в Voice`, category `tools` | `v3/js/chains.js` VIZ app `{ id: 'voice-import', title: 'Импорт в Voice' }` | `tests/v3-viz-voice-import-smoke.js` route assertion | Implemented |
| `content.php` `posting_auth_msg` | Regular-key auth notice before posting | `renderVizVoiceImport(chain)` shows an accessible notice for selected VIZ account with regular key or Vizonator | focused smoke checks `posting_auth_msg` marker | Implemented |
| `content.php` form | `url-input`, `import-button`, `results` for a Telegra.ph/Mirror URL | Static parser form preserves URL field, import button, and `role="status" aria-live="polite"` results. Manual HTML/text paste is added for CORS-safe operation | focused smoke checks controls and status region | Implemented static-safe |
| `js/app.js importArticle(url)` | `axios.get(.../voice-import/proxy.php?url=...)`; parses `#_tl_editor` for Telegra.ph and Mirror CSS selectors | v3 uses local `DOMParser`/`parseImportedArticleHtml`; direct `fetch(url)` is best-effort only and manual paste is the reliable static path | focused smoke forbids proxy runtime fetch and `proxy.php` in runtime slice | Implemented without backend proxy |
| `proxy.php` | `file_get_contents($_GET['url'])` with CORS header | Not restored; classified as backend-only non-goal because static v3 has no PHP/server URL fetcher | plan evidence and runtime forbidden-string check | Static-only non-goal |
| `uploadImage(imageUrl)` | downloads images through axios/Buffer/FormData, posts to `https://api.imgur.com/3/image` with `Imgur Client-ID 372d5f766d47d1d` | Not restored; v3 leaves image URLs/text as user-provided content and warns that image rehosting is not performed | focused smoke checks plan includes `Imgur Client-ID` and runtime excludes `api.imgur.com` | Static-only non-goal |
| `publishPost(title, content)` | Reads `viz.api.getAccountAsync(viz_login, 'V')`, uses `custom_sequence_block_num`, builds `{p,t:'p',d:{t,m,d}}`, then `viz.broadcast.customAsync(posting_key, [], [viz_login], 'V', JSON.stringify(data))` | `buildVizVoicePostPayload(account,title,content)` preserves `custom_sequence_block_num`, `t: 'p'`, and d/t/m/d fields; `broadcast.prepare(chain, 'regular', 'custom', [from, 'V', payload])` handles preview/send | focused smoke checks `custom_sequence_block_num`, protocol `V`, and regular custom prepare | Implemented static-safe broadcast |
| Footer/source marker | Appends `Пост импортирован при помощи ... voice-import` plus source link | `buildVizVoiceFooter(sourceUrl)` appends same attribution/source concept before publish | focused smoke checks `readdle.me`/Voice markers and app source | Implemented |

Validation plan for this app:
- TDD RED observed before implementation: `node tests/v3-viz-voice-import-smoke.js` failed with `AssertionError [ERR_ASSERTION]: VIZ voice-import route is registered`.
- Focused GREEN target: `node tests/v3-viz-voice-import-smoke.js`.
- Mandatory app gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-viz-voice-import-smoke.js && git diff --check`.

Remaining gaps/non-goals:
- No PHP `proxy.php`, old runtime path, private IP, backend.dpos.space, hidden server API, server-side URL fetcher, or image rehosting service is restored.
- Browser direct URL import may fail because of CORS; manual HTML/text paste is the static-safe fallback.
- The app publishes only after explicit preview/confirmation through the shared v3 broadcast flow; no automatic posting is performed.

### Rigorous parity: VIZ / vmp

Scope and result:
- Legacy purpose from `config.json`: title `Шлюз в Minter`, description `Страница шлюза VIZ в Minter`, menu `vmp`, category `tools`.
- Legacy landing `content.php` rendered supported Minter token pool links, a VIZ/Minter gateway article link, and a farm profitability form with `farmer`, `farm_calc`, and `farm_result`.
- Backend yes/no: **no dpos.space private backend**, but legacy did depend on public remote APIs: VIZ public history through `viz.api.getAccountHistoryAsync(login, -1, 1000)` and Minter public `https://explorer-api.minter.network/api/v2/pools/coins/<pair>/providers?page=<page>`. No PHP data endpoint or hidden server was used beyond static PHP rendering.
- Static-safe result: v3 registers a dedicated read-only `vmp` app, preserves the VIZCHAIN pool links and article link, and ports the profitability calculation to browser-side public VIZ/Minter API calls. No signing form, backend service, private IP, or hidden API is added.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/viz/apps/vmp/config.json`, `content.php`, `index.php`, `js/app.js`, `js/axios.min.js`.
- Relative legacy evidence paths: `blockchains/viz/apps/vmp/config.json`, `blockchains/viz/apps/vmp/content.php`, `blockchains/viz/apps/vmp/index.php`, `blockchains/viz/apps/vmp/js/app.js`.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing `tests/v3-viz-*-smoke.js`.

Matrix:

| Legacy file/page/function/control | Exact legacy dependency / operation | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `config.json` | title/menu `Шлюз в Minter` / `vmp`, category `tools` | `v3/js/chains.js` VIZ app `{ id: 'vmp', title: 'Шлюз в Minter', accountField: false }` | `tests/v3-viz-vmp-smoke.js` route assertion | Implemented |
| `content.php` token list | `USDTE`, `USDCE`, `USDTBSC`, `USDCBSC`, `DAIE`, `DAIBSC`, `BTC`, `BTCBSC`, `ETH`, `MUSD`, `HUB`, `METAGARDEN`, `BIP` rendered as `https://chainik.io/pool/<token>/VIZCHAIN` | `vizVmpPoolTokens` + `renderVizVmpPoolLinks()` preserve the same VIZCHAIN pool links | focused smoke checks representative token/link markers | Implemented |
| `content.php` article link | `https://viz.media/zapusk-shlyuza-viz-v-minter/` with text `Читать` | `renderVizVmp(chain)` keeps the same explicit external link | focused smoke source inspection | Implemented |
| `content.php` farm form | `farmer` input, `farm_calc` button, `farm_result` result div | Accessible form with same ids and `role="status" aria-live="polite"` result region | focused smoke checks IDs/status region | Implemented |
| `js/app.js calcAwards(login)` | `viz.api.getAccountHistoryAsync(login, -1, 1000)`, scan first seven `receive_award` where `initiator === 'viz-projects'`, sum `shares`, parse Minter address from memo `for <address>:` | `loadVizVmpAwardData(chain, login)` uses public VIZ RPC `getAccountHistory`, scans `receive_award`/`viz-projects`, averages annual SHARES, parses memo address | focused smoke checks `getAccountHistory`, `receive_award`, `viz-projects` | Implemented static-safe read-only |
| `js/app.js getProviders/selectProvider` | Public `explorer-api.minter.network/api/v2/pools/coins/<pair>/providers?page=<page>` for VIZCHAIN pairs; add `amount1 * 2` for matching Minter address | `loadVizVmpPairLiquidity` / `loadVizVmpLiquidity` use the same public Minter provider API and VIZCHAIN pair list, with bounded pagination | focused smoke checks API URL marker and VIZCHAIN pairs | Implemented with bounded public API pagination |
| Result links | Legacy output linked `/viz/profiles/<farmer>` and `/minter/profiles/<address>` | `renderVizVmpResult(data)` links to v3 `appHash({ chain: 'viz', app: 'profiles' ... })` and `appHash({ chain: 'minter', app: 'profiles' ... })` | focused smoke checks profile hash links | Implemented |
| Broadcast/backend behavior | Legacy VMP calculator was read-only; no operation broadcast | v3 runtime slice has no `broadcast.prepare`, `broadcast.broadcast`, or `bindOperationForm`; no private IP/backend/PHP dependency | focused smoke forbidden checks | Implemented read-only |

Validation plan for this app:
- TDD RED observed before implementation: `node tests/v3-viz-vmp-smoke.js` failed with `AssertionError [ERR_ASSERTION]: VIZ vmp route is registered as account-free app`.
- Focused GREEN target: `node tests/v3-viz-vmp-smoke.js`.
- Mandatory app gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-viz-vmp-smoke.js && git diff --check`.

Remaining gaps/non-goals:
- No backend daemon/service, PHP route, private IP, backend.dpos.space, hidden server API, or Minter integration service is added.
- Profitability depends on browser access to public VIZ/Minter APIs and may fail if those APIs are down or CORS-restricted.
- The calculation preserves the legacy heuristic; it is not a financial guarantee or a full farm accounting backend.

### Rigorous parity: Steem / swap

Scope and result:
- Legacy purpose from `config.json`: title `Swap`, description `Dpos.space Steem swap - сервис по обмену STEEM и SBD.`, menu `Swap`, category `tools`.
- Backend yes/no: **no** private/backend dpos.space dependency found. Legacy app used browser-side Steem JS against public Steem API calls and active-key broadcasts.
- Static-safe result: v3 keeps the Steem `swap` route as a static browser app: read-only order book/open orders through public RPC, create/cancel limit-order forms through the existing explicit preview/send broadcast flow, and Steem-specific documentation for the old STEEM/SBD instant/custom-order UX. No service, PHP endpoint, private IP, or hidden server API is added.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/steem/apps/swap/config.json`, `content.php`, `index.php`, `js/app.js`.
- Relative legacy evidence paths: `blockchains/steem/apps/swap/config.json`, `blockchains/steem/apps/swap/content.php`, `blockchains/steem/apps/swap/index.php`, `blockchains/steem/apps/swap/js/app.js`.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing `tests/v3-*.js`.

Matrix:

| Legacy file/page/function/control | Exact legacy dependency / operation | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `config.json` | `Swap`, description `Dpos.space Steem swap - сервис по обмену STEEM и SBD.`, menu `Swap` | `v3/js/chains.js` `steemApps` keeps `id: 'swap'`, title `Обмен`, description with `swap` meaning | `tests/v3-steem-swap-smoke.js` route assertion | Implemented |
| `content.php` form | `sell_token` select with `STEEM`/`SBD`, `sell_amount`, read-only `buy_amount`, `market_price`, `change_mode`, `action_buy_token` | v3 generic swap create form supports `STEEM`/`SBD` amounts; Steem-specific notice documents the legacy instant/custom-order mode and STEEM/SBD pair | focused smoke checks `STEEM/SBD`, `Legacy Steem swap`, create form markers | Implemented static-safe |
| `content.php` open orders | `my_orders_list`, delete action per order, `orders_history` link | v3 has `swap-open-orders-load` for public RPC `getOpenOrders`, cancel form for `cancelOrder`, and a Steem history link for `limit_order_create,limit_order_cancel,fill_order` | focused smoke checks `swap-open-orders-load`, `История обменов`, `cancelOrder` | Implemented |
| `js/app.js creationOrder` | `steem.api.getOrderBookAsync(100)` and client-side quote calculation from bids/asks | v3 exposes read-only `loadGrapheneOrderBook()` via `getOrderBook`; exact auto-price calculation is not hidden behind a backend and can be repeated manually with create-order fields | focused smoke checks `getOrderBook` and no backend dependency | Static-safe partial parity |
| `js/app.js myOrders` | `steem.api.getOpenOrdersAsync(steem_login)` | `loadGrapheneOpenOrders(chain, account)` uses public RPC and renders raw/readable rows | focused smoke checks `getOpenOrders` | Implemented |
| `js/app.js limit order create` | `steem.broadcast.limitOrderCreateAsync(active_key, steem_login, orderid, sell, buy, moment_swap, expiration)` | `broadcast.prepare(chain, 'active', 'createLimitOrder', [owner, orderId, sell, buy, fillOrKill, expiration])` with explicit preview/send buttons | focused smoke checks `createLimitOrder` | Implemented static-safe broadcast |
| `js/app.js deleteOrder` | `steem.broadcast.limitOrderCancelAsync(active_key, steem_login, orderid)` | `broadcast.prepare(chain, 'active', 'cancelOrder', [owner, orderId])` | focused smoke checks `cancelOrder` | Implemented static-safe broadcast |
| Backend/PHP behavior | `index.php` guard-only; no `file_get_contents`, private IP, backend.dpos.space, or service daemon in inspected app | v3 runtime slice has no `.php`, private IP, backend.dpos.space, hidden server API, or new daemon | focused smoke forbidden-string checks | Implemented/no backend |

Validation plan for this app:
- TDD RED observed before implementation: `node tests/v3-steem-swap-smoke.js` failed with `AssertionError [ERR_ASSERTION]: swap renderer has Steem-specific legacy parity copy`.
- Focused GREEN target: `node tests/v3-steem-swap-smoke.js`.
- Mandatory app gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-steem-swap-smoke.js && git diff --check`.

Remaining gaps/non-goals:
- No backend service, PHP route, private IP, backend.dpos.space, hidden server API, indexer, daemon, or auto-market service is added.
- v3 does not silently broadcast an instant swap; it requires preview/send confirmation through the shared v3 flow.
- Automatic legacy `creationOrder` price filling is represented by public order-book visibility plus explicit create-order fields; it is not a separate backend/indexer feature.

### Rigorous parity: Steem / randomblockchain

Scope and result:
- Legacy purpose from `config.json`: title `Генератор случайных чисел`, description `Генератор случайных чисел с использованием блоков блокчейна Steem.`, menu `ГСЧ`, category `tools`.
- Backend yes/no: **no** backend service dependency found in the exact app files. Legacy `content.php` emitted a GET form/result page; `index.php` was guard-only; the calculation and block loading lived in browser JS using `steem.api.getBlock` plus local `keccak_256`/BigInteger helpers.
- Static-safe result: v3 keeps the Steem `randomblockchain` route as a browser-only read-only form. Block numbers are resolved through public Steem RPC, `witness_signature` is used as the seed when available, `keccak_256(sig1 + sig2) mod participants + 1` is preserved, and optional `data_list` winner output is kept. No PHP endpoint, private IP, backend.dpos.space, hidden server API, new indexer, daemon, or service was added.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/steem/apps/randomblockchain/config.json`, `content.php`, `index.php`, `js/app.js`, `js/BigInteger.min.js`, `js/sha3.min.js`.
- Relative legacy evidence paths: `blockchains/steem/apps/randomblockchain/config.json`, `blockchains/steem/apps/randomblockchain/content.php`, `blockchains/steem/apps/randomblockchain/index.php`, `blockchains/steem/apps/randomblockchain/js/app.js`, `blockchains/steem/apps/randomblockchain/js/BigInteger.min.js`, `blockchains/steem/apps/randomblockchain/js/sha3.min.js`.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing `tests/v3-*.js` including `tests/v3-viz-randomblockchain-smoke.js` and `tests/v3-social-randomblockchain-smoke.js`.

Matrix:

| Legacy file/page/function/control | Exact legacy dependency / operation | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `config.json` | title `Генератор случайных чисел`, description says Steem blocks, menu `ГСЧ`, category `tools` | `v3/js/chains.js` exposes Steem app `id: 'randomblockchain'`, title `Случайный блокчейн`, with shared social-chain description | `tests/v3-steem-randomblockchain-smoke.js` route assertion | Implemented |
| `content.php` empty GET form | `block1`, `block2`, `participants`, optional `data_list`, submit `Сгенерировать` | `renderRandomBlockchain()` form with `randomblockchain-first`, `randomblockchain-second`, `randomblockchain-participants`, `randomblockchain-list` | focused smoke checks controls and `data_list` marker | Implemented static-safe |
| `content.php` result view | hidden participants/data_list, `sig1`, `sig2`, `hash`, `luckyNumber`, `resultMember`, `blocksData(block1, block2)` | v3 resolves block numbers in-browser and renders result/status with accessible `role="status" aria-live="polite"`; raw calculation details are available in JSON details | focused smoke checks dedicated renderer and status region | Implemented |
| `js/app.js blocksData` | `steem.api.getBlock(start_block/end_block)` and assigns `res.witness_signature` to sig fields | `resolveRandomBlockchainSeed()` uses `profiles.apiCall(connection, 'getBlock', [blockNum])`; `blockRandomSeed()` now uses exact `witness_signature` for Steem/Hive/VIZ when present | focused smoke checks public RPC call and exact social-chain `witness_signature` seed condition | Implemented |
| `js/app.js calculate` | `keccak_256.update(sig1 + sig2).toString()`, `bigInt(h, 16).mod(participants)`, lucky number `d.value + 1`; if `data_list` exists, participants become list length and row `d.value` is shown | `hashRandomBlockchainSeeds()` uses vendored `v3/vendor/viz/sha3.min.js`, JS `BigInt` modulo, `luckyNumber: value + 1`, and optional list winner | focused smoke checks `keccak_256`, `luckyNumber: value + 1`, `data_list`; existing social smoke checks shared Steem/Hive path | Implemented |
| `js/sha3.min.js`, `js/BigInteger.min.js` | vendored browser helpers for hash/modulo | v3 reuses existing vendored `v3/vendor/viz/sha3.min.js`; native `BigInt` replaces legacy BigInteger helper without a backend | focused smoke checks `steem.randomHashPath` exists | Implemented |
| Backend/PHP behavior | `index.php` is guard-only; no backend.dpos.space, private IP, hidden API, daemon, indexer, broadcast, or auth in inspected app | v3 randomblockchain runtime slice has no `.php`, private IP, backend, hidden service, `broadcast.prepare`, `broadcast.broadcast`, or `bindOperationForm` | focused smoke forbidden-string/no-broadcast checks | Implemented/no backend |

Validation plan for this app:
- TDD RED observed before implementation: `node tests/v3-steem-randomblockchain-smoke.js` failed with `AssertionError [ERR_ASSERTION]: Steem uses exact legacy witness_signature seed when available`.
- Focused GREEN target: `node tests/v3-steem-randomblockchain-smoke.js`.
- Mandatory app gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-steem-randomblockchain-smoke.js && git diff --check`.

Remaining gaps/non-goals:
- No backend service, PHP route, private IP, backend.dpos.space, hidden server API, indexer, daemon, or application service is added.
- v3 does not recreate the PHP query-result page as a separate server-rendered URL; the static SPA form/result state is the accepted browser-safe equivalent.
- If a public Steem RPC node is unavailable or CORS-blocked, the app reports an error in the live region rather than falling back to a private service.

### Rigorous parity: Steem / wallet

Scope and result:
- Legacy purpose from `config.json`: title `Кошелёк`, description `Кошелёк с возможностью просмотра и работы с балансами блокчейна Steem.`, menu `Кошелёк`, category `no_category`.
- Backend yes/no: **no** dpos.space backend service dependency is required for the wallet itself. The exact legacy app used browser Steem RPC plus localStorage/SJCL keys and direct `steem.broadcast.*` calls. The linked app JS still contained generic `sendAjax` helpers, but the wallet transfer/balance/history flow inspected here did not require a private PHP endpoint.
- Static-safe result: v3 keeps Steem wallet as a static browser app using public Steem RPC, existing vendored Steem/SJCL libraries, existing legacy localStorage auth compatibility, explicit preview/send broadcast controls, and accessible status regions. No PHP runtime, private IP, backend.dpos.space, hidden server API, indexer, daemon, or new service/application is added.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/steem/apps/wallet/config.json`, `content.php`, `index.php`, `js/app.js`, `css/style.css`, `css/jquery-ui.css`.
- Relative legacy evidence paths: `blockchains/steem/apps/wallet/config.json`, `blockchains/steem/apps/wallet/content.php`, `blockchains/steem/apps/wallet/index.php`, `blockchains/steem/apps/wallet/js/app.js`, `blockchains/steem/apps/wallet/css/style.css`, `blockchains/steem/apps/wallet/css/jquery-ui.css`.
- Shared legacy helpers inspected: `blockchains/steem/js/blockchain.js`, `blockchains/steem/js/modal-accounts.js`.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing wallet-related smoke tests and `tests/v3-*.js`.

Matrix:

| Legacy file/page/function/control | Exact legacy dependency / operation | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `config.json` | title `Кошелёк`, description for viewing/working with Steem balances, menu `Кошелёк` | `v3/js/chains.js` inherits base app `id: 'wallet'`, title `Кошелёк`, account field enabled, Steem library/node metadata points to vendored Steem library and public `https://api.steemit.com` | `tests/v3-steem-wallet-smoke.js` route/library assertions | Implemented |
| `content.php` auth notices | `auth_msg`, `active_auth_msg`, `active_page`; active key required for legacy write controls | v3 uses shared account/key status text and shared broadcast layer; preview/send fails safely if active/posting key is unavailable and never displays private keys | focused smoke checks broadcast authority map and sanitized preview support | Implemented static-safe |
| `content.php` balances | STEEM, SBD, SP, received/delegated vesting, effective voting share, withdrawal information, claim balances | `renderSteemWalletBalances()` renders STEEM/SBD/SP, savings balances, delegated/received/effective SP, rewards, withdrawal rate/next withdrawal | focused smoke checks dedicated renderer and STEEM/SBD/SP markers | Implemented |
| `js/app.js load_balance` | `steem.api.getAccounts`, `steem.api.getDynamicGlobalProperties`, VESTS→SP conversion from `total_vesting_fund_steem/total_vesting_shares` | `loadSteemWalletData()` and `steemPowerRateFromProfile()` use public RPC/profile context to convert VESTS to SP in-browser | focused smoke checks `loadSteemWalletData`, `steemPowerRateFromProfile`, `steemVestsToSp` | Implemented |
| `content.php` STEEM/SBD transfer modal | `action_steem_transfer_*`, `transfer_to_vesting` checkbox, memo WIF warning | `wallet-transfer-form` supports STEEM/SBD transfer, optional STEEM→SP recipient checkbox, URL prefill, WIF-like memo guard, encrypted memo helper, explicit preview/send buttons | focused smoke checks `wallet-transfer-form`, `prefillSteemTransferFromUrl`, `isSteemMemoWif(chain, rawMemo)`, `encodeSteemMemoIfNeeded` | Implemented static-safe broadcast |
| `js/app.js STEEM transfer` | `steem.broadcast.transfer(active_key, steem_login, action_steem_transfer_to, action_steem_transfer_amount, action_steem_transfer_memo, cb)` | `broadcast.prepare(chain, 'active', 'transfer', [from, to, amount, memo])`, then shared explicit send/confirm flow | focused smoke checks `'transfer'` and sanitized prepared data | Implemented |
| `js/app.js transfer to vesting` | `steem.broadcast.transferToVesting(active_key, steem_login, action_steem_transfer_to, action_steem_transfer_amount, cb)` and self-SP form | `wallet-transfer-form` checkbox and `wallet-vesting-form` both prepare `transferToVesting` for recipient/self | focused smoke checks `'transferToVesting'`, `STEEM в SP этого аккаунта` | Implemented |
| `content.php` SP withdraw modal | amount in SP, max button, warning that a new withdraw resets the current one; `steem.broadcast.withdrawVesting(active_key, steem_login, withdraw_vests, cb)` | `wallet-withdraw-vesting-form` accepts SP, converts to `VESTS` through `normalizeSteemPowerInput()`, and sends `withdrawVesting` only after preview/confirm | focused smoke checks `normalizeSteemPowerInput`, `'withdrawVesting'`, `Вывод SP в STEEM` | Implemented |
| `js/app.js cancel vesting withdraw` | `steem.broadcast.withdrawVesting(active_key, steem_login, '0.000000 VESTS', cb)` | `wallet-steem-cancel-withdraw-form` prepares `withdrawVesting` with `0.000000 VESTS` | focused smoke checks `wallet-steem-cancel-withdraw-form` and `'0.000000 VESTS'` | Implemented |
| `content.php` delegation table/action | `steem.api.getVestingDelegations(steem_login, '', 100, cb)` and `cancelDelegatedVestingShares(delegatee)` | `fetchSteemDelegations()` reads public RPC, `steemDelegationRows()` shows outgoing delegation rows with per-row cancel form preparing `delegateVestingShares` with zero VESTS | focused smoke checks `getVestingDelegations`, `wallet-steem-cancel-delegation-*`, `'delegateVestingShares'` | Implemented |
| `js/app.js delegate` | `steem.broadcast.delegateVestingShares(active_key, steem_login, action_vesting_delegate_to, delegate_vests, cb)` | `wallet-delegation-form` accepts SP, converts to VESTS, prepares `delegateVestingShares` through shared broadcast | focused smoke checks `Делегирование SP`, `normalizeSteemPowerInput` | Implemented |
| `content.php` claim block | reward STEEM/SBD/VESTS display and `claim_action`; `steem.broadcast.claimRewardBalance(posting_key, steem_login, acc.reward_steem_balance, acc.reward_sbd_balance, acc.reward_vesting_balance, cb)` | `wallet-claim-form` uses current reward balances as hidden values and prepares `claimRewardBalance` with posting authority | focused smoke checks `'claimRewardBalance'`, `Получение наград` | Implemented |
| `content.php` transfer history | `walletData()` paginated `steem.api.getAccountHistoryAsync`, filters transfers/rewards/order fills | `DposHistory` Steem allowlist and `renderHistoryTable()` show latest financial operations fetched through public RPC | focused smoke checks `walletData()`, `history.js` Steem allowlist, `Последние финансовые операции Steem` | Implemented static-safe first page/sample |
| Legacy savings parity from shared Steem/Hive wallet capabilities | `transfer_to_savings`, `transfer_from_savings`, `cancel_transfer_from_savings` are public Steem operations, not in the old visible modal list but supported by Steem wallet semantics | v3 exposes savings forms via explicit preview/send; they use public RPC/direct broadcast only | focused smoke checks savings form IDs and operation names | Implemented static-safe extra wallet parity |
| `blockchains/steem/js/modal-accounts.js` | validates account keys, stores `steem_current_user` / `steem_users`, SJCL passphrases `dpos.space_steem_<login>_postingKey` and `..._activeKey` | `v3/js/auth.js` / `v3/js/broadcast.js` preserve existing localStorage schema and decrypt passphrases; no new key storage format | focused smoke checks Steem authority map; existing auth/profile smokes cover shared schema | Implemented |
| Backend/PHP behavior | `index.php` guard-only; linked CSS is static; wallet JS uses Steem public RPC and direct broadcasts; generic `sendAjax` helper is not required for v3 wallet | v3 runtime slice has no `.php`, private IP, `backend.dpos.space`, hidden service, new daemon, or old `blockchains/...` runtime path | focused smoke forbidden-string/runtime-slice checks | Implemented/no backend |

Validation plan for this app:
- TDD RED observed before plan evidence implementation: `node tests/v3-steem-wallet-smoke.js` failed with `AssertionError [ERR_ASSERTION]: plan.md contains required Steem/wallet rigorous parity section`.
- Focused GREEN target: `node tests/v3-steem-wallet-smoke.js`.
- Mandatory app gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-steem-wallet-smoke.js && git diff --check`.

Remaining gaps/non-goals:
- No backend service, PHP route, private IP, backend.dpos.space, hidden server API, new indexer, daemon, or application service is added.
- v3 does not recreate the old fancybox/modal UI or jQuery implementation; accessible inline forms/details are the static SPA equivalent.
- v3 does not implement the old paginated `walletData()` loop exactly; the static wallet/history loader shows a bounded recent financial history through public RPC and avoids a new indexer/service.
- If public Steem RPC is unavailable or CORS-blocked, v3 reports the error in the live region instead of falling back to a private service.

### Rigorous parity: Steem / manage

Scope and result:
- Legacy purpose from `config.json`: title `Управление блокчейном и аккаунтом`, description `Сервис управления аккаунтом (изменение профиля) и блокчейном (делегаты, комитет) в Steem.`, menu `Управление`, category `no_category`.
- Backend yes/no: **no** dpos.space backend service is required for Steem manage. The exact legacy app used public Steem browser RPC, legacy localStorage/SJCL account keys, and direct client-side `steem.broadcast.*` calls.
- Static-safe result: v3 exposes Steem manage through the existing static SPA `manage` route with profile metadata editing, witness proxy, one-witness vote, batch witness voting from public RPC, and witness settings update. No PHP runtime, backend service, private IP, hidden server API, new indexer, daemon, or new application service is added.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/steem/apps/manage/config.json`, `content.php`, `index.php`, `js/app.js`, `pages/profile/config.json`, `pages/profile/content.php`, `pages/profile/footer.js`, `pages/witnesses/config.json`, `pages/witnesses/content.php`, `pages/witnesses/footer.js`, `pages/witness/config.json`, `pages/witness/content.php`, `pages/witness/footer.js`.
- Relative legacy evidence paths: `blockchains/steem/apps/manage/config.json`, `blockchains/steem/apps/manage/content.php`, `blockchains/steem/apps/manage/index.php`, `blockchains/steem/apps/manage/js/app.js`, `blockchains/steem/apps/manage/pages/profile/content.php`, `blockchains/steem/apps/manage/pages/profile/footer.js`, `blockchains/steem/apps/manage/pages/witnesses/content.php`, `blockchains/steem/apps/manage/pages/witnesses/footer.js`, `blockchains/steem/apps/manage/pages/witness/content.php`, `blockchains/steem/apps/manage/pages/witness/footer.js`.
- Shared legacy helpers inspected: `blockchains/steem/js/blockchain.js`, `blockchains/steem/js/modal-accounts.js`.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, and existing `tests/v3-*.js`.

Matrix:

| Legacy file/page/function/control | Exact legacy dependency / operation | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `config.json` | Steem manage title/menu/category and account/blockchain management purpose | `v3/js/chains.js` inherits `socialApps` route `id: 'manage'`, title `Управление`; router dispatches `effectiveAppId === 'manage'` to `renderManage(chain)` | `tests/v3-steem-manage-smoke.js` route/renderer assertions | Implemented |
| `content.php` overview | Links to `steem/manage/profile`, `steem/manage/witnesses`, `steem/manage/witness`; explanatory sections `Профиль`, `Делегаты`, `Управление блокчейном и профилем` | `renderManage(chain)` shows the same management purpose and forms/sections inside a static accessible panel with live status regions | focused smoke checks legacy UI/control markers | Implemented static SPA equivalent |
| `index.php` | PHP dispatcher loads a page directory from URL segment | v3 uses the static hash router and one `manage` renderer; no PHP dispatcher/runtime path is referenced | focused smoke forbids `.php` and legacy runtime paths in Steem manage slice | Implemented/no PHP |
| `pages/profile/content.php` | Profile form fields: nickname/name, about, avatar/profile_image, cover_image, gender, location, interests, website, mail, Telegram, Instagram, VK, Facebook, Twitter, Skype, WhatsApp, Viber | `manage-profile-form` keeps corresponding fields, preloads current `json_metadata`, preserves other metadata, and sends explicit `accountUpdate` preview/send | focused smoke checks profile field IDs, prefill status, `fetchChainAccount(chain, account)`, `accountUpdate` | Implemented static-safe broadcast |
| `pages/profile/footer.js` load | `steem.api.getAccounts([steem_login])`, parse `json_metadata.profile`, fill inputs; `Interests` array joined with comma | `prefillManageProfile(chain)` supports Steem, reads public RPC through shared profile helpers, fills profile fields, and maps legacy `interests` to the shared interest input | focused smoke checks Steem profile prefill function and current metadata preservation | Implemented |
| `pages/profile/footer.js save` | `steem.broadcast.accountUpdate(active_key, steem_login, undefined, undefined, undefined, memo, json_metadata, cb)` | `broadcast.prepare(chain, 'active', 'accountUpdate', [account, undefined, undefined, undefined, undefined, json])` for Steem/Hive profile update; shared layer handles preview/send | focused smoke checks exact legacy operation evidence and v3 behavior markers | Implemented |
| `pages/profile/footer.js upload` | Imgur `XMLHttpRequest` upload with hardcoded public Client-ID | v3 does not upload files or proxy images; users paste avatar/cover URL directly into URL fields | focused smoke forbids `XMLHttpRequest` in runtime slice | Static-only non-goal |
| `pages/witnesses/content.php` proxy form | `proxyVote('proxy_login')` / `proxyVote('delete_proxy_login')` using `steem.broadcast.accountWitnessProxy(active_key, steem_login, proxy_login, cb)` | `manage-proxy-form` prepares `accountWitnessProxy` with empty proxy meaning remove proxy | focused smoke checks `accountWitnessProxy` | Implemented static-safe broadcast |
| `pages/witnesses/content.php` one witness vote | login field and `oneWitnessVote()` using `steem.broadcast.accountWitnessVote(active_key, steem_login, witness_login, true, cb)` | `manage-witness-form` prepares `accountWitnessVote` with approve checkbox | focused smoke checks `accountWitnessVote` | Implemented static-safe broadcast |
| `pages/witnesses/footer.js` list | `steem.api.getAccounts`, account `witness_votes`/`proxy`, recursive `steem.api.getWitnessesByVote(from, 100, cb)`, checkbox list and remaining vote count | `loadWitnessVoteList(chain, witnessVoteState)` now includes Steem, reads account/proxy and public witness list, renders checkboxes, and warns when proxy is set | focused smoke checks `getWitnessesByVote`, batch form, and `witnessVoteState.proxy` | Implemented |
| `js/app.js witnessesVote` | Builds `account_witness_vote` operations for checkbox changes and sends `steem.broadcast.send({extensions: [], operations}, [active_key], cb)` | `manage-witnesses-batch-form` now includes Steem and prepares `sendOperations` with `account_witness_vote` operations only for changes | focused smoke checks `['account_witness_vote'` and `broadcast.prepare(chain, 'active', 'sendOperations'` | Implemented static-safe broadcast |
| `pages/witness/content.php` witness options | URL/signing key form; empty signing key deactivates witness | `manage-witness-update-form` supports Steem, prefills witness settings, uses legacy `STM1111111111111111111111111111111114T1Anm` deactivation key when Steem signing key is blank | focused smoke checks `STM1111111111111111111111111111111114T1Anm` and `getWitnessByAccount` | Implemented |
| `pages/witness/footer.js` witness update | `steem.api.getWitnessByAccount`, `steem.broadcast.witnessUpdate(active_key, steem_login, url, blockSigningKey, props, fee, cb)` | `loadManageWitnessSettings(chain)` now includes Steem; form prepares `witnessUpdate` with URL, signing key, props JSON, and `0.000 STEEM` fee | focused smoke checks `witnessUpdate` and public RPC prefill | Implemented static-safe broadcast |
| `pages/witness/footer.js` chain properties | Builds `chain_properties_update` operation and broadcasts raw operations | v3 keeps a generic props JSON on `witnessUpdate`. A separate Steem `chain_properties_update` form is not added in this pass because the legacy operation is a dangerous witness-network-parameter write and exact Steem library support varies; users can inspect/update witness URL/key without a new service. | plan non-goal and smoke static-safe operation checks | Static-only non-goal for this bounded app |
| `blockchains/steem/js/blockchain.js` / `modal-accounts.js` | Public `https://api.steemit.com`, `steem_current_user`, `steem_users`, SJCL-encrypted `postingKey` and `activeKey`; active key hides write pages when absent | v3 preserves chain node/library metadata and existing auth/broadcast key schema; operations require explicit preview/send and fail safely without keys | focused smoke checks library/crypto path and broadcast authority map | Implemented |
| Backend/service constraints | No app-specific backend endpoint in exact manage files; PHP only served static page fragments; upload used third-party Imgur XHR | v3 runtime slice contains no `.php`, `backend.dpos.space`, `178.20.43.121`, private server API, hidden service, indexer, daemon, or legacy `blockchains/steem/apps/manage` runtime path | focused smoke forbidden-string/runtime-slice checks | Implemented/no backend |

Validation plan for this app:
- TDD RED observed before implementation: `node tests/v3-steem-manage-smoke.js` failed with `AssertionError [ERR_ASSERTION]: Steem manage keeps legacy UI/control marker: Управление блокчейном и профилем`.
- Focused GREEN target: `node tests/v3-steem-manage-smoke.js`.
- Mandatory focused gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-steem-manage-smoke.js && git diff --check`.

Remaining gaps/non-goals:
- No backend service, PHP route, private IP, backend.dpos.space, hidden server API, new indexer, daemon, or application service is added.
- v3 does not recreate legacy PHP subpage URLs or the old jQuery show/hide implementation; the static SPA route with accessible inline forms is the accepted equivalent.
- v3 does not implement Imgur file upload from legacy profile footer; image URL fields are direct static-safe inputs, avoiding embedded third-party upload credentials and XHR behavior.
- v3 does not add a dedicated Steem chain-properties service/indexer or backend. Dangerous witness parameter updates requiring exact library support beyond `witnessUpdate` remain explicit non-goal for this bounded static pass.
- If public Steem RPC is unavailable or CORS-blocked, v3 reports the error in the live region instead of falling back to a private service.

### Rigorous parity: Steem / post

Scope and result:
- Legacy purpose from `config.json`: title `Публикация постов`, menu `Редактор`, category `no_category`. The description says Golos, but the exact app is under `blockchains/steem/apps/post` and uses Steem browser RPC/broadcast globals.
- Route mapping: **Steem / post -> editor**. Legacy `post` is normalized by `v3/js/app.js` route aliases (`post: 'editor'`) and rendered through the static v3 editor route for Steem.
- Backend yes/no: **no backend service is required or added**. The exact legacy app used PHP only to emit static markup, public `steem.api.getContent`, local FileReader markdown import, third-party Imgur XHR upload, and direct `steem.broadcast.send` comment/comment_options operations with the browser posting key.
- Static-safe result: v3 keeps the Steem editor in the existing static SPA, adds legacy `.md` import, edit-by-URL loading through public RPC, legacy popular tag affordances, post metadata marker, payout mode, beneficiaries extension, and explicit preview/send through the existing shared broadcast flow. No PHP runtime, backend service, private IP, hidden server API, new indexer, daemon, or application service is added.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/steem/apps/post/config.json`, `content.php`, `index.php`, `js/_interface.js`, `js/simplemde.min.js`, `css/simplemde.min.css`.
- Shared legacy helpers inspected: `/root/ai-projects/dpos.space/blockchains/steem/js/blockchain.js`, `/root/ai-projects/dpos.space/blockchains/steem/js/modal-accounts.js`.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing editor/post tests including `tests/v3-social-editor-smoke.js` and the new `tests/v3-steem-post-smoke.js`.

Matrix:

| Legacy file/page/function/control | Exact legacy dependency / operation | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `apps/post/config.json` | Declares title `Публикация постов`, menu `Редактор`, category `no_category` | `v3/js/chains.js` Steem inherits `socialApps` route `id: 'editor'`; `v3/js/app.js` maps legacy `post` alias to `editor` | `tests/v3-steem-post-smoke.js` route/mapping assertions | Implemented |
| `apps/post/index.php` | `NOTLOAD` guard only | Static `index.html` + hash router; no PHP guard/runtime in v3 | focused smoke forbids `<?php` and legacy runtime paths in v3 JS | Backend-only non-goal |
| `apps/post/content.php` main form | Title, image URL, body textarea, tags, payout mode, optional permlink, beneficiaries, publish/reset controls | `renderEditor(chain)` for Steem renders labeled fields, payout select, beneficiaries fieldset, preview/send/reset buttons, and `role="status" aria-live="polite"` result regions | focused smoke checks UI/control markers and live status | Implemented static SPA equivalent |
| `content.php` / `_interface.js` markdown upload | `#files` + FileReader: line 1 title, line 2 tags, rest body | `bindSteemPostLegacyHelpers` with `editor-md-file` reads local `.md` files and fills the editor entirely client-side | focused smoke checks `editor-md-file` and legacy format help | Implemented/no backend |
| `content.php` / `_interface.js` edit loader | URL field `postediturl`, `load4edit`, `steem.api.getContent(author, permlink)` fills title/tags/image/permlink/payout/body | `bindSteemPostLegacyHelpers` parses `@author/permlink` and uses public `getContentAsync`/`getContent` from the selected Steem RPC | focused smoke checks `editor-edit-url`, `Загрузить в редактор`, and public `getContent` evidence | Implemented static-safe public RPC |
| `_interface.js` post payload | `comment` with `parent_permlink` from first tag/default, author, permlink, title, body, JSON metadata app `dpos.space/post`, format `markdown`, tags/image | `buildGenericEditorOperations` keeps Steem comment payload and now uses legacy `dpos.space/post` app marker plus `format: markdown` for Steem | focused smoke checks operation builder and metadata markers | Implemented |
| `_interface.js` payout/options | `comment_options` with `max_accepted_payout: 1000000.000 SBD`, `percent_steem_dollars`, votes/curation enabled | `buildGenericEditorOperations` uses `chain.debtSymbol` (`SBD`) and Steem `percent_steem_dollars` via shared `sendOperations` | focused smoke checks payout/comment_options evidence | Implemented |
| `_interface.js` beneficiaries | Default 1% `denis-skripnik`, optional extra beneficiaries in extension `[0,{beneficiaries}]` | `normalizeEditorBeneficiaries` keeps default 1% and optional extra beneficiary; `comment_options.extensions` sends beneficiaries through shared broadcast flow | focused smoke checks `extensions: [[0, { beneficiaries }]]` | Implemented |
| `_interface.js` popular tags | Legacy buttons: `liga-avtorov`, `vp-liganovi4kov`, `ladyzarulem`, `psk`, `chaos-legion`, `ru--megagalxyan`, `botbod`, `boonmood`, `steem`, `blockchain`, `vox-populi`, `earth-citizens` | Steem editor exposes the legacy tag list as copy buttons, with `dpos-post` still appended automatically by payload builder | focused smoke checks representative tag strings and `dpos-post` | Implemented static-safe affordance |
| `_interface.js` Imgur upload | Direct `XMLHttpRequest` to `https://api.imgur.com/3/image.json` with public Client-ID and drag/drop SimpleMDE insertion | v3 does not copy upload/client-id behavior; users paste a preview image URL. No upload proxy/service is added. | focused smoke forbids `api.imgur.com/3/image.json`; this section documents `Imgur` as non-goal | Static-only / backend-only non-goal |
| `_interface.js` SimpleMDE/Garlic/jQuery UI | Rich markdown editor, autosave, jQuery spoilers/ranges, form persistence | Native accessible textarea/details/buttons in the static SPA; no SimpleMDE/Garlic dependency copied | focused smoke forbids `SimpleMDE`; accessibility covered by labels/status regions | Intentionally different static equivalent |
| `blockchains/steem/js/blockchain.js` / `modal-accounts.js` | `https://api.steemit.com`, `steem_current_user`, `steem_users`, SJCL-encrypted posting/active keys, direct `posting_key` broadcast | v3 preserves chain node/library metadata and legacy auth/broadcast key schema; `broadcast.prepare(chain, 'posting', 'sendOperations', ...)` requires explicit preview/send | focused smoke checks public broadcast prepare flow; existing auth/broadcast smokes cover key schema | Implemented |
| Backend/service constraints | PHP emitted markup; no app-specific server API needed for posting. Upload was third-party Imgur, not a dpos.space backend. | v3 runtime contains no `.php`, `backend.dpos.space`, private IP, hidden service, new indexer/daemon, or legacy `blockchains/steem/apps/post` runtime path | focused smoke forbidden dependency checks | Implemented/no backend |

Validation plan for this app:
- TDD RED observed before implementation: `node tests/v3-steem-post-smoke.js` failed with `AssertionError [ERR_ASSERTION]: Steem post ports legacy static-safe helper binding`.
- Focused GREEN target: `node tests/v3-steem-post-smoke.js`.
- Mandatory focused gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-steem-post-smoke.js && git diff --check`.
- Broad smoke loop: `for f in tests/v3-*.js; do node "$f" || exit 1; done`.

Remaining gaps/non-goals:
- No backend service, PHP route, private IP, backend.dpos.space, hidden server API, new indexer, daemon, or application service is added.
- The legacy Imgur upload/client-id flow is not copied and no upload proxy is created; preview image URL input is the static-safe equivalent.
- The legacy SimpleMDE/Garlic/jQuery editor widgets are not vendored into v3; native textarea/details/buttons preserve the required posting flow without adding dependencies.
- If public Steem RPC is unavailable or CORS-blocked, v3 reports the error in the live region instead of falling back to a private service.

### Rigorous parity: Steem / profiles

Scope and result:
- Legacy purpose from `config.json`: title `Просмотр профилей`, menu `Профили`, category `no_category`; `content.php` renders the search form for a Steem login without `@`.
- Backend yes/no: **no backend service is required or added**. The legacy profile app used PHP fragments for page assembly, GrapheneNodeClient snippets, AJAX pagination, and modal helpers; v3 replaces safe read-only pieces with public browser Steem RPC and maps large paginated subpages to static history filters. No PHP runtime, private IP runtime call, `backend.dpos.space`, hidden server API, new indexer, daemon, or new application service is added.
- Static-safe result: v3 keeps Steem `profiles` through the existing base app route, adds Steem-specific legacy quick links, loads bounded direct profile extras from public RPC, and documents backend/indexer-style pagination tables as non-goals instead of creating services.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/steem/apps/profiles/config.json`, `/root/ai-projects/dpos.space/blockchains/steem/apps/profiles/content.php`, `/root/ai-projects/dpos.space/blockchains/steem/apps/profiles/index.php`, `/root/ai-projects/dpos.space/blockchains/steem/apps/profiles/js/app.js`.
- Legacy linked profile pages/fragments inspected: `profiles/page/config.json`, `profiles/page/content.php`, `profiles/page/userinfo.php`, `profiles/page/history.php`, `profiles/page/transfers.php`, `profiles/page/sp.php`, `profiles/page/dao.php`, `profiles/page/author_rewards.php`, `profiles/page/curation_rewards.php`, `profiles/page/benefactor_rewards.php`, `profiles/page/accounts.php`, `profiles/page/blog-posts.php`, `profiles/page/posts_with_payment.php`, `profiles/page/feed.php`, `profiles/page/comments.php`, `profiles/page/witness.php`, `profiles/page/orders.php`, `profiles/page/votes.php`, `profiles/page/delegat.php`, `profiles/page/delegations.php`, `profiles/page/followers.php`.
- Legacy snippets inspected: `page/snippets/get_account.php`, `get_dynamic_global_properties.php`, `get_chain_properties.php`, `get_config.php`, `get_ticker.php`, `get_follow_count.php`, `getRewardFund.php`, `Get_Followers.php`, `Get_Followings.php`, `get_vesting_delegations.php`, `get_witness_by_account.php`, `get_discussions_by_blog.php`, `discussions_by_blog.php`, `GetContentReplies.php`, `get_account_history_chunk.php`, `get_delegate.php`.
- Shared legacy helpers inspected: `/root/ai-projects/dpos.space/blockchains/steem/js/blockchain.js` for AJAX pagination (`getLoad`, `ajax_options`) and `/root/ai-projects/dpos.space/blockchains/steem/js/modal-accounts.js` for legacy localStorage/SJCL account behavior.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing profile tests `tests/v3-profiles-smoke.js`, `tests/v3-viz-profiles-smoke.js`, `tests/v3-golos-profiles-parity-smoke.js`, and new `tests/v3-steem-profiles-smoke.js`.

Matrix:

| Legacy file/page/function/control | Exact legacy dependency / operation | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `apps/profiles/config.json` | Declares `Просмотр профилей`, description `Просмотрщик профилей в блокчейне Steem`, menu `Профили` | `v3/js/chains.js` Steem inherits base `profiles` app with account field | `tests/v3-steem-profiles-smoke.js` checks route registration | Implemented |
| `apps/profiles/content.php` and `page/content.php` | Login form with hidden `chain=steem`, `service=profiles`, `user`, submit `узнать инфу` | Existing v3 profile account field/hash route `#chain=steem&app=profiles&account=...`; no PHP form post | focused smoke checks legacy form evidence and v3 renderer | Implemented static SPA equivalent |
| `apps/profiles/index.php` page nav | Subpages: Основное, История, Переводы средств, Steem Power, ДАО, rewards, Аккаунты, posts/feed/comments, Делегат, Ордера, votes | `steemLegacyProfileLinks(account)` maps exact read-only subpages to profile/history filters with public route hashes | focused smoke checks `function steemLegacyProfileLinks(account)`, labels, and op filter strings | Implemented static-safe mapping |
| `page/userinfo.php` | Server-side snippets: account, dynamic props, chain props, config, ticker, follow count, reward fund; metadata/socials/profile image; modal links for delegations/followers/witness votes | `v3/js/profiles.js` `fetchAccount`/`enrichAccount`/`normalizeAccount` uses public Steem RPC fields and renders balances, SP, metadata, socials, authorities, governance, activity | focused smoke checks Steem normalizer, effective SP, follow count, socials | Implemented |
| `Get_Followers.php` / `Get_Followings.php` | Graphene `GetFollowersCommand` / `GetFollowingCommand` with `blog` and limit 11 | `fetchSteemProfileExtras(connection, account)` calls `getFollowers` and `getFollowing` through existing public RPC wrapper | focused smoke checks exact method argument markers | Implemented bounded direct RPC |
| `get_vesting_delegations.php` and `delegations.php` | Graphene `GetVestingDelegationsCommand(account, from, 100, type)` with PHP modal pagination | `fetchSteemProfileExtras` calls `getVestingDelegations` for `delegated` and `received`, rendered as bounded direct lists | focused smoke checks `GetVestingDelegationsCommand` evidence and v3 method calls | Implemented bounded direct RPC; full pagination non-goal |
| `get_witness_by_account.php`, `witness.php`, `delegat.php` | Witness data and witness vote/proxy modal derived through PHP snippets/history chunks | `fetchSteemProfileExtras` loads `getWitnessByAccount`; witness votes/proxy already appear in normalized governance rows; history quick links cover witness-vote ops | focused smoke checks `getWitnessByAccount` and DAO/witness links | Implemented / history-filter fallback |
| `blog-posts.php` / `posts_with_payment.php` / `feed.php` / `comments.php` | Graphene discussions commands plus PHP/Parsedown rendering and pagination | Recent own blog/comments use bounded direct public RPC (`getDiscussionsByBlog`, `getDiscussionsByComments`); large old-post/feed/payment pages are exposed as links/non-goals where a full backend/indexer would be needed | focused smoke checks direct public RPC calls and plan non-goal | Partial static-safe direct RPC + explicit non-goal |
| `history.php` and `js/app.js` | Client-side filter UI calling `steem.api.getAccountHistoryAsync(user, from, limit)` with local filters, op names, query search | Existing v3 history route supports Steem `getAccountHistory`, selected `ops`, and wallet/reward/order filters; links route users to history instead of PHP pages | focused smoke checks history support and op labels/strings | Implemented static-safe mapping |
| `transfers.php`, `sp.php`, `dao.php`, reward pages, `accounts.php`, `votes.php`, `orders.php` | PHP GrapheneNodeClient history chunk filtering and AJAX next/previous buttons | v3 maps each category to history route filters (`transfer...`, `delegate_vesting_shares...`, `proposal...`, `author_reward`, `curation_reward`, `comment_benefactor_reward`, `vote`, `limit_order...`) | focused smoke checks representative mappings | Implemented as static history filters; PHP pagination non-goal |
| `blockchains/steem/js/blockchain.js` | `getLoad`, `ajax_options`, jQuery `.ajax_modal` and PHP endpoint URLs under `blockchains/steem/apps/profiles/page/*.php` | v3 runtime has no legacy profile PHP calls; browser-only RPC via loaded Steem library and selected public node | focused smoke forbids legacy runtime PHP/backend strings in the Steem profile runtime slice | Implemented/no backend |
| `modal-accounts.js` | Legacy account storage and key verification for Steem localStorage/SJCL | Profiles remain read-only and do not request keys; existing v3 auth compatibility remains for other broadcast apps | focused smoke checks no `bindOperationForm(chain, 'profiles'...)` and no broadcast profile operation | Read-only/no broadcast |

Validation plan for this app:
- TDD RED observed before implementation: `node tests/v3-steem-profiles-smoke.js` failed with `AssertionError [ERR_ASSERTION]: Steem profiles expose a legacy subpage to static history-link mapper`.
- Focused GREEN target: `node tests/v3-steem-profiles-smoke.js`.
- Mandatory focused gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-steem-profiles-smoke.js && git diff --check`.
- Broad smoke loop: `for f in tests/v3-*.js; do node "$f" || exit 1; done`.

Remaining gaps/non-goals:
- No backend service, PHP route, private IP runtime call, `backend.dpos.space`, hidden server API, new indexer, daemon, or new application service is added.
- Full old AJAX/PHP pagination for rewards, transfers, feed, orders, account chunks, and modal lists is not recreated; where public RPC can provide bounded current data it is shown directly, otherwise v3 links to history filters and documents the backend/indexer-style table as static-only non-goal.
- If public Steem RPC is unavailable or CORS-blocked, v3 reports the error in the live region instead of falling back to a private service.

### Rigorous parity: Steem / calc

Scope and result:
- Legacy purpose from `config.json`: title `Блокчейн-калькулятор`, description `Рассчёт стоимости апвота, GESTS в СГ и другие параметры блокчейна Steem.`, menu `Калькулятор`, category `tools`.
- Backend yes/no: **no backend service is required or added**. Legacy `ajax.php` used PHP GrapheneNodeClient snippets as a server-side RPC adapter; v3 replaces it with browser-only public Steem RPC calls through existing `profiles.apiCall`/`getConnection` patterns. No PHP runtime, private IP runtime call, `backend.dpos.space`, hidden server API, new indexer, daemon, or new application service is added.
- Static-safe result: Steem `calc` aliases to v3 `calculator`, which dispatches Steem to a dedicated read-only renderer preserving the legacy upvote-value and VESTS→SP controls/formulas with accessible live result regions.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/steem/apps/calc/config.json`, `/root/ai-projects/dpos.space/blockchains/steem/apps/calc/content.php`, `/root/ai-projects/dpos.space/blockchains/steem/apps/calc/index.php`, `/root/ai-projects/dpos.space/blockchains/steem/apps/calc/js/app.js`, `/root/ai-projects/dpos.space/blockchains/steem/apps/calc/ajax.php`.
- Legacy snippet dependencies inspected: `/root/ai-projects/dpos.space/blockchains/steem/apps/calc/snippets/get_dynamic_global_properties.php`, `/root/ai-projects/dpos.space/blockchains/steem/apps/calc/snippets/get_chain_properties.php`, `/root/ai-projects/dpos.space/blockchains/steem/apps/calc/snippets/get_feed_history.php`, `/root/ai-projects/dpos.space/blockchains/steem/apps/calc/snippets/get_ticker.php`, `/root/ai-projects/dpos.space/blockchains/steem/apps/calc/snippets/get_config.php`, `/root/ai-projects/dpos.space/blockchains/steem/apps/calc/snippets/getRewardFund.php`.
- Shared legacy helpers inspected: `/root/ai-projects/dpos.space/blockchains/steem/js/blockchain.js` for public node selection and AJAX/modal helper patterns, `/root/ai-projects/dpos.space/blockchains/steem/js/modal-accounts.js` for localStorage/SJCL account behavior, and `/root/ai-projects/dpos.space/blockchains/steem/js/steem.min.js` as the vendored browser chain library.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing calc/profile smoke tests, and new `tests/v3-steem-calc-smoke.js`.

Formula evidence preserved from legacy `ajax.php`:
- `steem_per_vests = 1000000 * total_vesting_fund_steem / total_vesting_shares`.
- SP to VESTS: `vesting_shares = sp * 1000000 / steem_per_vests`.
- Upvote legacy intermediate values: `steem_a = total_vesting_fund_steem / total_vesting_shares`, `steem_n = 100`, `steem_r = sp / steem_a`, `steem_m2 = 100 * charge * (100 * steem_n) / 10000`, `steem_m = (steem_m2 + 49) / 50`, `steem_i = reward_balance / recent_claims`, `median_price = round(base / quote, 2)`.
- Upvote result: `STEEM = round(steem_r * steem_m * 100 * steem_i, 3) * (vote_weight / 100)` and `SBD = round(steem_r * steem_m * 100 * steem_i * median_price, 3) * (vote_weight / 100)`.
- VESTS to SP result: `sp_result = round(vests / 1000000 * steem_per_vests, 3)`.

Matrix:

| Legacy file/control/helper/data dependency | Exact legacy behavior | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `apps/calc/config.json` | Declares `Блокчейн-калькулятор`, menu `Калькулятор`, category `tools` | Steem inherits `socialApps` `{ id: 'calculator', title: 'Калькулятор' }` in `v3/js/chains.js` | `tests/v3-steem-calc-smoke.js` checks Steem calculator registration | Implemented |
| Old route `/blockchains/steem/apps/calc` | Legacy route name is `calc` | `legacyAppTarget` maps `calc` to `calculator` for Steem | focused smoke checks alias and chain coverage | Implemented |
| `content.php` upvote form | Inputs `sp`, `vp`, `vote_weight`, button `Вывести стоимость апвота`, result div `let1` | `renderSteemCalculator` renders `steem-upvote-calculator-form`, SP/battery/weight inputs, submit button, `role="status" aria-live="polite"` result | focused smoke checks exact legacy labels/copy/control markers | Implemented |
| `content.php` VESTS form | Input `sp_tec`, button `Рассчитать VESTS в SP`, result div `let2` | `renderSteemCalculator` renders `steem-vests-form` and client-side VESTS→SP result | focused smoke checks legacy UI/result copy and helper formula | Implemented |
| `js/app.js` | jQuery `.load('/blockchains/steem/apps/calc/ajax.php', ...)` for both buttons | Replaced by local submit handlers and public RPC context; runtime slice forbids `ajax.php` and old app path | focused smoke forbids PHP/private/backend strings in the calc runtime slice | Implemented static-safe replacement |
| `ajax.php` `type=result_power` | Reads dynamic props, chain props, feed history, ticker, config, reward fund via PHP snippets; calculates upvote STEEM/SBD | `loadSteemCalculatorContext` calls public RPC `getDynamicGlobalProperties`, `getChainProperties`, `getFeedHistory`, `getTicker`, `getConfig`, `getRewardFund(['post'])`; `calculateSteemUpvoteValue` preserves formulas | focused smoke checks each RPC marker and formula marker | Implemented |
| `ajax.php` `type=result_vests` | Reads dynamic props and converts VESTS to SP via `steem_per_vests` | Browser calculation uses current public RPC props and `vests / 1000000 * steemPerVests` | focused smoke checks formula evidence and result copy | Implemented |
| PHP snippets `get_*` | Require `vendor/autoload.php`, `helpers.php`, `CONNECTORS_MAP['steem']`, GrapheneNodeClient command classes | Existing browser chain library and v3 `profiles.apiCall` replace PHP connector layer | focused smoke checks public RPC replacements and plan evidence | Implemented/no PHP runtime |
| `blockchains/steem/js/blockchain.js` | Node selection via `steem.api.setOptions`, plus unrelated AJAX pagination helpers | Existing v3 `getConnection(chain)` and `profiles.connect` select public nodes; calc does not use legacy AJAX helpers | plan evidence + runtime forbidden-string test | Implemented |
| `blockchains/steem/js/modal-accounts.js` | Legacy account/key storage; not used by calc | Calc remains read-only and never requests keys or broadcasts | focused smoke forbids `broadcast.prepare`/`broadcast.broadcast` in calc slice | Read-only/no broadcast |

Validation plan for this app:
- TDD RED observed before implementation: `node tests/v3-steem-calc-smoke.js` failed with `AssertionError [ERR_ASSERTION]: generic calculator dispatches Steem to dedicated renderer`.
- Focused GREEN target: `node tests/v3-steem-calc-smoke.js`.
- Mandatory focused gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-steem-calc-smoke.js && git diff --check`.
- Broad smoke loop: `for f in tests/v3-*.js; do node "$f" || exit 1; done`.

Remaining gaps/non-goals:
- No backend service, PHP route, private IP runtime call, `backend.dpos.space`, hidden server API, new indexer, daemon, or new application service is added.
- If public Steem RPC is unavailable or CORS-blocked, v3 reports the problem in an accessible live status instead of falling back to a private service.
- Legacy PHP snippets are not recreated; they are classified as PHP/backend-only adapters and replaced only by static-safe public RPC calls already supported by v3.

### Rigorous parity: Steem / backup

Scope and result:
- Legacy purpose from `config.json`: title `Бекап постов`, description `Резервное копирование постов в Steem.`, menu `Бекап постов`, category `tools`.
- Backend yes/no: **legacy backend/server filesystem yes, v3 backend no**. The old app required PHP `GrapheneNodeClient`, payment verification via `GetAccountHistoryCommand`, `GetDiscussionsByBlogCommand`, server-side `users/` and `archives/` folders, `ZipArchive`, and generated download URLs. v3 does not add backend services, PHP runtime, private IP runtime calls, hidden server APIs, new indexers, daemons, or new applications.
- Static-safe result: Steem gets a dedicated `backup` route that fetches public blog discussions from a public Steem RPC node in the browser and creates a local Markdown/HTML download with `Blob`/`URL.createObjectURL`. It never handles private keys, never stores export data in localStorage, never charges/verifies payment, and never writes server files.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/steem/apps/backup/config.json`, `/root/ai-projects/dpos.space/blockchains/steem/apps/backup/content.php`, `/root/ai-projects/dpos.space/blockchains/steem/apps/backup/index.php`.
- Legacy nested page/files inspected: `/root/ai-projects/dpos.space/blockchains/steem/apps/backup/page/config.json`, `/root/ai-projects/dpos.space/blockchains/steem/apps/backup/page/content.php`, `/root/ai-projects/dpos.space/blockchains/steem/apps/backup/page/functions.php`, `/root/ai-projects/dpos.space/blockchains/steem/apps/backup/page/GetDiscussionsByLogin.php`, and the existing sample archive `/root/ai-projects/dpos.space/blockchains/steem/apps/backup/archives/html_denis-skripnik.zip` only as evidence of server-side archive output.
- Shared legacy helpers inspected/classified: `/root/ai-projects/dpos.space/blockchains/steem/js/blockchain.js` for public node selection/AJAX helper patterns, `/root/ai-projects/dpos.space/blockchains/steem/js/modal-accounts.js` for localStorage/SJCL account behavior, and `/root/ai-projects/dpos.space/blockchains/steem/js/steem.min.js` as the vendored browser chain library. Backup legacy did not use localStorage/SJCL key export/import; it used public account/post data plus server archive generation.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, `v3/js/auth.js`/account storage behavior as exposed through app code, existing Steem calc/profile/history tests, and new `tests/v3-steem-backup-smoke.js`.

Data/key-safety notes:
- Export scope is public post data only: title, author/permlink, created time, body, and tags parsed from `json_metadata`.
- No key backup is implemented because legacy Steem backup was post backup, not account/private-key backup. v3 must not read `PostingKey`, decrypt SJCL, export WIF/private keys, or write account secrets.
- Downloads are browser-local (`Blob` + temporary object URL) and do not persist to a server, hidden API, `localStorage`, or old `archives/` path.

Matrix:

| Legacy file/control/helper/data dependency | Exact legacy behavior | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `apps/backup/config.json` | Declares `Бекап постов`, menu item, tools category | Dedicated Steem-only `{ id: 'backup', title: 'Бекап постов' }` app in `v3/js/chains.js` | `tests/v3-steem-backup-smoke.js` checks registration and Steem route list | Implemented |
| Old route `/blockchains/steem/apps/backup` | PHP app route with optional account/page args | `legacyAppTarget` keeps `backup` alias and router dispatches `chain.id === 'steem' && effectiveAppId === 'backup'` to `renderSteemBackup` | focused smoke checks alias and router slice | Implemented |
| `content.php` form | Instructions, account login, reblogs radio `yes2`/`yes3`, content format `Markdown`/`HTML`, submit `Запуск` | `renderSteemBackup` preserves the controls/copy in an accessible static form with `role="status" aria-live="polite"` result | focused smoke checks legacy UI/control markers | Implemented static-safe |
| `page/content.php` payment gate | Requires transfer `0.500 SBD` or `1.000 STEEM` to `denis-skripnik` with memo `posts`; scans last 2000 history operations by PHP `GetAccountHistoryCommand` | Not implemented; payment verification and service billing require server-side business logic and are a backend/service feature | plan non-goal + smoke forbids broadcast/payment/server archive dependencies in runtime slice | Explicit non-goal |
| `page/GetDiscussionsByLogin.php` | Server-side GrapheneNodeClient `GetDiscussionsByBlogCommand`, `limit=100`, paginated by `start_author`/`start_permlink`, `tag=$login` | Browser `profiles.apiCall(connection, 'getDiscussionsByBlog', [{ tag: account, limit: STEEM_BACKUP_LIMIT, ... }])` with bounded pagination via public RPC | focused smoke checks RPC method and pagination markers | Implemented |
| `page/functions.php` `generator()` | Writes Markdown-ish `.txt` files under server `users/<login>/`, includes title/body/tags and optionally filters reblogs | Browser formats all selected posts into one `.md` text download; `yes2` filters `post.author === account`, `yes3` includes reblogs | focused smoke checks `filterSteemBackupPosts`, `formatSteemBackupPost`, reblog markers | Implemented local-only |
| `page/functions.php` `html_generator()` | Uses Parsedown and writes `.html` files under server `users/<login>/` | Browser creates simple escaped HTML document locally. Markdown-to-HTML conversion beyond safe escaping is not recreated without adding a parser dependency/service | focused smoke checks `HTML`, local download and no server paths | Implemented safe subset |
| `archive()`/`html_archive()` | Uses PHP `ZipArchive`, writes `archives/<login>.zip` or `archives/html_<login>.zip`, returns server download URL | v3 uses browser `Blob` download; no zip/server filesystem path is created | focused smoke forbids `ZipArchive`, `archives/`, `users/`, old backup app paths in runtime slice | Implemented as static-safe local download |
| Shared `blockchain.js` | Legacy node/AJAX helpers | Existing v3 `getConnection(chain)`/`profiles.connect` select public Steem RPC nodes; backup uses no jQuery/AJAX/PHP | focused smoke checks public RPC helper evidence | Implemented |
| `modal-accounts.js` and SJCL/localStorage | Legacy account/key storage exists globally but backup did not need private keys | v3 backup does not read/decrypt/export keys and does not write localStorage | focused smoke forbids `PostingKey`, `privateKey`, `sjcl.decrypt`, `localStorage.setItem` in runtime slice | Key-safe |

Validation plan for this app:
- TDD RED expected before implementation: `node tests/v3-steem-backup-smoke.js` should fail because `renderSteemBackup` and Steem backup registration do not exist yet.
- Focused GREEN target: `node tests/v3-steem-backup-smoke.js`.
- Mandatory focused gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-steem-backup-smoke.js && git diff --check`.
- Broad smoke loop: `for f in tests/v3-*.js; do node "$f" || exit 1; done`.

Remaining gaps/non-goals:
- No backend service, PHP route, private IP runtime call, `backend.dpos.space`, hidden server API, new indexer, daemon, or new application service is added.
- Legacy paid service enforcement, payment history scan, and server-hosted `.zip` archives are backend/service behavior and are intentionally not restored.
- Public Steem RPC may be limited to recent/available discussions. v3 reports node errors in the live status and does not fall back to a private server.

### Rigorous parity: Steem / explorer

Scope and result:
- Legacy purpose from `config.json`: title `Блок-эксплорер`, description `block explorer (просмотр блоков) в Steem`, menu `Explorer`.
- Backend yes/no: **legacy PHP adapter yes, v3 backend no**. Legacy `get_dynamic_global_properties.php`, `get_chain_properties.php`, `pages/block/block.php`, and `pages/tx/get_transaction.php` required Composer `GrapheneNodeClient` and `CONNECTORS_MAP['steem']`; v3 replaces those wrappers with browser-only public Steem RPC through the already vendored Steem library. No backend service, PHP route, private IP runtime call, `backend.dpos.space`, hidden server API, new indexer, daemon, or hosted helper app is added.
- Static-safe result: the existing Steem `explorer` route now shows the legacy overview (irreversible/head block links and chain properties) plus block/tx lookup via public RPC. It remains read-only and uses the existing accessible explorer form/status region.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/steem/apps/explorer/config.json`, `/root/ai-projects/dpos.space/blockchains/steem/apps/explorer/content.php`, `/root/ai-projects/dpos.space/blockchains/steem/apps/explorer/index.php`.
- Legacy linked pages/helpers inspected: `/root/ai-projects/dpos.space/blockchains/steem/apps/explorer/get_dynamic_global_properties.php`, `/root/ai-projects/dpos.space/blockchains/steem/apps/explorer/get_chain_properties.php`, `/root/ai-projects/dpos.space/blockchains/steem/apps/explorer/pages/block/config.json`, `/root/ai-projects/dpos.space/blockchains/steem/apps/explorer/pages/block/content.php`, `/root/ai-projects/dpos.space/blockchains/steem/apps/explorer/pages/block/block.php`, `/root/ai-projects/dpos.space/blockchains/steem/apps/explorer/pages/tx/config.json`, `/root/ai-projects/dpos.space/blockchains/steem/apps/explorer/pages/tx/content.php`, `/root/ai-projects/dpos.space/blockchains/steem/apps/explorer/pages/tx/get_transaction.php`.
- Shared legacy helpers inspected/classified: `/root/ai-projects/dpos.space/blockchains/steem/js/blockchain.js` for public node selection/AJAX helper patterns, `/root/ai-projects/dpos.space/blockchains/steem/js/modal-accounts.js` for localStorage/SJCL account behavior, and `/root/ai-projects/dpos.space/blockchains/steem/js/steem.min.js` as the browser chain library.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing VIZ/Golos/Steem explorer/profile tests, and new `tests/v3-steem-explorer-smoke.js`.

Matrix:

| Legacy file/control/helper/data dependency | Exact legacy behavior | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `apps/explorer/config.json` | Declares Steem `Блок-эксплорер`, menu `Explorer` | Steem inherits social `explorer` app in `v3/js/chains.js` with title `Проводник` | `tests/v3-steem-explorer-smoke.js` checks route registration | Implemented |
| `content.php` form | Hidden `chain=steem`, `service=explorer`, `data` input for block number or tx id, submit `узнать инфу` | Existing v3 explorer form exposes labelled kind selector and value input, with `role="status" aria-live="polite"` result | focused smoke checks renderer and status markers through app source | Implemented accessible SPA equivalent |
| `content.php` overview | Calls `get_dynamic_global_properties.php` and `get_chain_properties.php`; renders 10 links from `last_irreversible_block_num`, 10 from `head_block_number`, and chain property labels | `loadSteemExplorerOverview` calls public `getDynamicGlobalProperties` and `getChainProperties`; `renderSteemExplorerOverview` renders the same overview headings/links/properties | focused smoke checks `last_irreversible_block_num`, `head_block_number`, `getChainProperties`, overview loader/renderer | Implemented |
| `index.php` redirect router | Numeric path redirects to `steem/explorer/block/<num>`; 40-char tx-like path redirects to `steem/explorer/tx/<id>` | Hash route uses `#chain=steem&app=explorer&kind=block|tx&value=...`; form lets user choose block/tx/account directly | focused smoke checks legacy redirect evidence and v3 dispatch | Implemented as hash-router behavior |
| `pages/block/block.php` | PHP GrapheneNodeClient `GetOpsInBlock(block,false)` and `GetBlockHeaderCommand(block)` | `loadSteemExplorerBlock` calls public `getBlockHeader` and `getOpsInBlock` through `profiles.apiCall` | focused smoke checks `GetOpsInBlock`/`GetBlockHeaderCommand` and v3 `getOpsInBlock`/`getBlockHeader` | Implemented read-only public RPC |
| `pages/block/content.php` | Renders `Блок №`, previous/next block links, witness profile link, and grouped operation rows via `convert_operation_data` | Existing `renderExplorerResult`/`renderOperationsTable` show block fields, operation table, account/profile links, and raw JSON details; Steem block path feeds it header+ops | focused smoke checks Steem block dispatch and operation renderer evidence | Implemented |
| `pages/tx/get_transaction.php` and `pages/tx/content.php` | PHP `GetTransaction(tx_id)`, block link, operation table with account links | Existing tx path calls public `getTransaction` and `renderExplorerResult` renders tx summary, block link, operation table, account-like links | focused smoke checks `getTransaction` and tx legacy files | Implemented |
| `blockchains/steem/js/blockchain.js` | Public node setup plus legacy AJAX helper patterns | Existing v3 `getConnection(chain)`/`profiles.connect` select public Steem nodes; no jQuery/PHP AJAX is used | runtime slice in smoke forbids old app path, `.php`, private IP, backend strings | Implemented/no backend |
| `modal-accounts.js` | Legacy account/key modal not used by explorer | Explorer remains read-only; no auth/key decrypt or broadcast binding | focused smoke forbids `broadcast.prepare` and `bindOperationForm` in explorer slice | Read-only/no broadcast |

Validation plan for this app:
- TDD RED observed before implementation: `node tests/v3-steem-explorer-smoke.js` failed with `AssertionError [ERR_ASSERTION]: v3 has Steem explorer overview loader`.
- Focused GREEN target: `node tests/v3-steem-explorer-smoke.js`.
- Mandatory focused gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-steem-explorer-smoke.js && git diff --check`.
- Broad smoke loop: `for f in tests/v3-*.js; do node "$f" || exit 1; done`.

Remaining gaps/non-goals:
- No backend service, PHP route, private IP runtime call, `backend.dpos.space`, hidden server API, new indexer, daemon, or new application service is added.
- Legacy PHP GrapheneNodeClient wrappers are not recreated; they are classified as backend adapters and replaced only by direct public RPC where Steem browser nodes support it.
- If public Steem RPC is unavailable or CORS-blocked, v3 reports the error in the existing live status/result area instead of falling back to a private server.

### Rigorous parity: Steem / help

Scope and result:
- Legacy purpose from `config.json`: title `Справка по dpos.space`, description `Страница со ссылками на информацию по сервисам dpos.space.`, menu `Справка`.
- Backend yes/no: **no backend data dependency**. Legacy `content.php` only returned a script with `location.replace(...)`; `index.php` was a guard-only stub. v3 does not add backend services, PHP runtime, private IP runtime calls, hidden server APIs, new indexers, daemons, or hosted helper apps.
- Static-safe result: Steem gets a dedicated `help` route that replaces the old automatic redirect with an explicit static link to the original Steem article. The page is read-only, accessible, and announces status without moving the browser unexpectedly.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/steem/apps/help/config.json`, `/root/ai-projects/dpos.space/blockchains/steem/apps/help/content.php`, `/root/ai-projects/dpos.space/blockchains/steem/apps/help/index.php`.
- Shared legacy helpers classified: no Steem `blockchain.js`, `modal-accounts.js`, SJCL, RPC, AJAX, or broadcast helper is referenced by the exact help app; the only behavior is a static browser redirect.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing VIZ help smoke pattern, and new `tests/v3-steem-help-smoke.js`.

Matrix:

| Legacy file/control/helper/data dependency | Exact legacy behavior | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `apps/help/config.json` | Declares `Справка по dpos.space`, menu `Справка`, no category | Dedicated Steem `{ id: 'help', title: 'Справка' }` app in `v3/js/chains.js` | `tests/v3-steem-help-smoke.js` checks route registration | Implemented |
| `apps/help/content.php` | Emits `<script>location.replace("https://steemit.com/.../obzor-servisov-prilozheniya-dpos-space-dlya-blokcheina-steem")</script>` | `renderSteemHelp` renders the same URL as an explicit `<a>` with `target="_blank" rel="noopener"` | focused smoke checks legacy URL and explicit static link copy | Implemented static-safe |
| `apps/help/index.php` | Guard-only `NOTLOAD` stub; no page logic | No runtime PHP route is used in v3 | focused smoke checks guard file inspected and runtime slice forbids `.php`/legacy app path | Implemented/no PHP |
| Redirect behavior | Browser auto-navigation via `location.replace`, which can disorient screen-reader users | v3 documents the redirect replacement and leaves navigation under user control | focused smoke checks no `location.replace` in Steem help runtime slice | Implemented accessible behavior |
| RPC/auth/broadcast dependencies | None in exact app files | No public RPC, key handling, localStorage, or broadcast is used | focused smoke forbids `broadcast.prepare`/`bindOperationForm`; app source has no backend/private strings in the slice | Read-only/no broadcast |

Validation plan for this app:
- TDD RED observed before implementation: `node tests/v3-steem-help-smoke.js` failed with `AssertionError [ERR_ASSERTION]: Steem help route is registered`.
- Focused GREEN target: `node tests/v3-steem-help-smoke.js`.
- Mandatory focused gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-steem-help-smoke.js && git diff --check`.
- Broad smoke loop: `for f in tests/v3-*.js; do node "$f" || exit 1; done`.

Remaining gaps/non-goals:
- No backend service, PHP route, private IP runtime call, `backend.dpos.space`, hidden server API, new indexer, daemon, or new application service is added.
- Automatic redirect is intentionally not restored; it becomes an explicit static link for accessibility and user control.
- No hidden status/checking service is added for the external article; if the link target changes, v3 still exposes the legacy documented URL.

### Rigorous parity: Hive / swap

Scope and result:
- Legacy purpose from `config.json`: title `Swap`, description `Dpos.space Hive swap - сервис по обмену HIVE и HBD.`, menu `Swap`, category `tools`.
- Backend yes/no: **no** private/backend dpos.space dependency found in the exact swap app. Legacy app used browser-side Hive JS against public Hive API calls and active-key broadcasts.
- Static-safe result: v3 keeps the Hive `swap` route as a static browser app: read-only order book/open orders through public RPC, create/cancel limit-order forms through the existing explicit preview/send broadcast flow, and Hive-specific documentation for the old HIVE/HBD instant/custom-order UX. No service, PHP endpoint, private IP, hidden server API, or backend/indexer is added.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/hive/apps/swap/config.json`, `content.php`, `index.php`, `js/app.js`.
- Relative legacy evidence paths: `blockchains/hive/apps/swap/config.json`, `blockchains/hive/apps/swap/content.php`, `blockchains/hive/apps/swap/index.php`, `blockchains/hive/apps/swap/js/app.js`.
- Shared legacy helpers inspected/classified: `/root/ai-projects/dpos.space/blockchains/hive/js/blockchain.js` for public node setup/generic AJAX helper patterns and `/root/ai-projects/dpos.space/blockchains/hive/js/modal-accounts.js` for legacy localStorage/SJCL account behavior.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing `tests/v3-*.js`, and new `tests/v3-hive-swap-smoke.js`.

Matrix:

| Legacy file/page/function/control | Exact legacy dependency / operation | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `config.json` | `Swap`, description `Dpos.space Hive swap - сервис по обмену HIVE и HBD.`, menu `Swap` | `v3/js/chains.js` `hive` apps include `id: 'swap'`, title `Обмен`, description with `swap` meaning | `tests/v3-hive-swap-smoke.js` route assertion | Implemented |
| `content.php` form | `sell_token` select with `HIVE`/`HBD`, `sell_amount`, read-only `buy_amount`, `market_price`, `change_mode`, `action_buy_token` | v3 generic swap create form supports `HIVE`/`HBD` amounts; Hive-specific notice documents the legacy instant/custom-order mode and HIVE/HBD pair | focused smoke checks `HIVE/HBD`, `Legacy Hive swap`, `fill_or_kill=true`, create form markers | Implemented static-safe |
| `content.php` open orders | `my_orders_list`, delete action per order, `orders_history` link | v3 has `swap-open-orders-load` for public RPC `getOpenOrders`, cancel form for `cancelOrder`, and a Hive history link for `limit_order_create,limit_order_cancel,fill_order` | focused smoke checks `swap-open-orders-load`, `История обменов`, `cancelOrder` | Implemented |
| `js/app.js creationOrder` | `hive.api.getOrderBookAsync(100)` and client-side quote calculation from bids/asks | v3 exposes read-only `loadGrapheneOrderBook()` via `getOrderBook`; exact auto-price calculation is not hidden behind a backend and can be repeated manually with create-order fields | focused smoke checks `getOrderBook` and no backend dependency | Static-safe partial parity |
| `js/app.js myOrders` | `hive.api.getOpenOrdersAsync(hive_login)` | `loadGrapheneOpenOrders(chain, account)` uses public RPC and renders raw/readable rows | focused smoke checks `getOpenOrders` | Implemented |
| `js/app.js limit order create` | `hive.broadcast.limitOrderCreateAsync(active_key, hive_login, orderid, sell, buy, moment_swap, expiration)` | `broadcast.prepare(chain, 'active', 'createLimitOrder', [owner, orderId, sell, buy, fillOrKill, expiration])` with explicit preview/send buttons | focused smoke checks `createLimitOrder` | Implemented static-safe broadcast |
| `js/app.js deleteOrder` | `hive.broadcast.limitOrderCancelAsync(active_key, hive_login, orderid)` | `broadcast.prepare(chain, 'active', 'cancelOrder', [owner, orderId])` | focused smoke checks `cancelOrder` | Implemented static-safe broadcast |
| `blockchains/hive/js/blockchain.js` | Public nodes `https://anyx.io`, `https://rpc.usehive.com`; generic `sendAjax` helper exists for other page snippets | v3 uses configured public Hive nodes through `getConnection(chain)`/profiles helpers; swap runtime does not call PHP/AJAX helpers | focused smoke runtime bundle forbids `XMLHttpRequest`, `.php`, private IP, backend strings | Implemented/no backend |
| `modal-accounts.js` | Legacy `hive_current_user`/`hive_users`, SJCL active key required for swap broadcasts | Existing v3 auth/broadcast layer preserves old key storage and requires active authority for limit-order operations | existing auth/broadcast coverage plus focused smoke operation markers | Implemented |
| Backend/PHP behavior | `index.php` guard-only; no `file_get_contents`, private IP, backend.dpos.space, hidden service, daemon, or indexer in inspected app | v3 runtime slice has no `.php`, private IP, `backend.dpos.space`, hidden server API, or new service | focused smoke forbidden-string checks | Implemented/no backend |

Validation plan for this app:
- TDD RED observed before implementation: `node tests/v3-hive-swap-smoke.js` failed with `AssertionError [ERR_ASSERTION]: swap renderer has Hive-specific legacy parity copy`.
- Focused GREEN target: `node tests/v3-hive-swap-smoke.js`.
- Mandatory app gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-hive-swap-smoke.js && git diff --check`.
- Broad smoke loop: `for f in tests/v3-*.js; do node "$f" || exit 1; done`.

Remaining gaps/non-goals:
- No backend service, PHP route, private IP runtime call, `backend.dpos.space`, hidden server API, indexer, daemon, hosted helper application, or newly hosted app is added.
- v3 does not silently broadcast an instant swap; it requires preview/send confirmation through the shared v3 flow.
- Automatic legacy `creationOrder` price filling is represented by public order-book visibility plus explicit create-order fields; it is not a separate backend/indexer feature.
- If public Hive RPC is unavailable or CORS-blocked, v3 reports the error in the live region instead of falling back to a private service.

### Rigorous parity: Hive / manage

Scope and result:
- Legacy purpose from `config.json`: title `Управление блокчейном и аккаунтом`, description `Сервис управления аккаунтом (изменение профиля) и блокчейном (делегаты, комитет) в Hive.`, menu `Управление`, category `no_category`.
- Backend yes/no: **no private dpos.space backend required for the exact managed actions**. The inspected app is PHP-rendered pages plus browser Hive RPC/broadcast calls: profile metadata, witness proxy, witness vote list/vote, witness update, and chain properties update. The profile page also had direct Imgur upload via hardcoded public Client-ID; v3 does not add or depend on that hosted helper/upload flow.
- Static-safe result: v3 uses the existing static `manage` route for Hive with accessible forms, explicit preview/send confirmation, direct public Hive RPC for account/witness reads, and direct wallet broadcasts for the legacy active-key actions. No backend service, PHP runtime, private IP, hidden server API, indexer, daemon, or new hosted app is added.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/hive/apps/manage/config.json`, `/root/ai-projects/dpos.space/blockchains/hive/apps/manage/content.php`, `/root/ai-projects/dpos.space/blockchains/hive/apps/manage/index.php`, `/root/ai-projects/dpos.space/blockchains/hive/apps/manage/js/app.js`.
- Legacy page files: `/root/ai-projects/dpos.space/blockchains/hive/apps/manage/pages/profile/content.php`, `/root/ai-projects/dpos.space/blockchains/hive/apps/manage/pages/profile/footer.js`, `/root/ai-projects/dpos.space/blockchains/hive/apps/manage/pages/witnesses/content.php`, `/root/ai-projects/dpos.space/blockchains/hive/apps/manage/pages/witnesses/footer.js`, `/root/ai-projects/dpos.space/blockchains/hive/apps/manage/pages/witness/content.php`, `/root/ai-projects/dpos.space/blockchains/hive/apps/manage/pages/witness/footer.js`.
- Shared legacy helpers inspected/classified: `blockchains/hive/js/blockchain.js`, `blockchains/hive/js/modal-accounts.js`, and vendored `blockchains/hive/js/hive.min.js` only to classify auth/public RPC/broadcast behavior.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing manage smokes, and new `tests/v3-hive-manage-smoke.js`.

Matrix:

| Legacy file/control/helper/data dependency | Exact legacy behavior | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `blockchains/hive/apps/manage/config.json` | Registers Hive `Управление` in `no_category` | Hive inherits `socialApps` `manage` route in `v3/js/chains.js` | `tests/v3-hive-manage-smoke.js` route assertion | Implemented |
| `content.php` | Landing page links to `profile`, `witnesses`, `witness`; describes profile fields, delegate voting/proxy, workers | `renderManage(chain)` exposes profile, witness proxy, one-witness vote, batch witness votes, witness update, authority/profile sections | focused smoke checks headings/forms/control markers | Implemented static-safe |
| `index.php` | PHP page dispatcher reads `pageUrl()[2]` and includes `pages/<page>/content.php` | Single static router renders the manage route and anchor sections; no runtime PHP dispatcher | focused smoke forbids legacy runtime path and `.php` in Hive manage slice | Implemented/no PHP runtime |
| `js/app.js` `proxyVote` | `hive.broadcast.accountWitnessProxy(active_key, hive_login, proxy_login, cb)` | `broadcast.prepare(chain, 'active', 'accountWitnessProxy', [currentLogin, proxy])` with preview/send confirmation | focused smoke checks exact operation marker | Implemented static-safe broadcast |
| `js/app.js` `oneWitnessVote` | `hive.broadcast.accountWitnessVote(active_key, hive_login, witness_login, true, cb)` | `manage-witness-form` builds `accountWitnessVote` with approve checkbox | focused smoke checks operation and UI marker | Implemented static-safe broadcast |
| `js/app.js` `witnessesVote` | `hive.api.getAccounts([hive_login])`, compares checkboxes with `witness_votes`, sends `hive.broadcast.send({extensions: [], operations}, [active_key], cb)` | `loadWitnessVoteList` fetches current account and witnesses via public RPC; batch form prepares `sendOperations` with `account_witness_vote` diffs | focused smoke checks `getWitnessesByVote`, `['account_witness_vote'`, `sendOperations` | Implemented for Hive |
| `pages/witnesses/footer.js` | `hive.api.getWitnessesByVote(from, 100, cb)`, proxy display, 30-vote count | v3 public RPC witness loader renders checkboxes and proxy conflict notice in `role=status` region | focused smoke checks loader/status markers | Implemented static-safe |
| `pages/profile/content.php` | Profile form fields: nickname/name, about, avatar, cover, gender, location, interests, website/mail/social links | `manage-profile-form` keeps matching accessible labels and fields (`profile_image`, `cover_image`, `gender`, `mail`, social handles) | focused smoke checks field IDs/control markers | Implemented |
| `pages/profile/footer.js` | Reads current `json_metadata`, preserves metadata, updates `metadata.profile`, and broadcasts `hive.broadcast.accountUpdate(active_key, hive_login, undefined, undefined, undefined, memo, json_metadata, cb)` | v3 fetches current account before update for Hive, preserves metadata, maps `interests` as an array, then prepares active `accountUpdate` | focused smoke checks `fetchChainAccount(chain, account)` and `accountUpdate` | Implemented for Hive |
| `pages/profile/footer.js` Imgur upload | Direct `XMLHttpRequest` to `https://api.imgur.com/3/image.json` with hardcoded public Client-ID for avatar/cover upload | v3 accepts image URLs only; no upload helper service or third-party upload API is introduced | focused smoke forbids `XMLHttpRequest`; non-goal recorded | Static-only non-goal |
| `pages/witness/content.php` + `footer.js` | Witness URL/signing key update and props editing; empty key disables witness with `HIVE1111111111111111111111111111111114T1Anm`; broadcasts `hive.broadcast.witnessUpdate(active_key, hive_login, url, blockSigningKey, props, fee, cb)` and `chain_properties_update` via raw send | v3 witness update form uses Hive inactive signing key fallback, explicit props JSON and `witnessUpdate`; chain props can be sent through the shared `sendOperations`/props pattern where supported by the library | focused smoke checks inactive key and `witnessUpdate`; props change is marked dangerous explicit preview | Implemented with explicit warning |
| `blockchains/hive/js/blockchain.js` | Public node setup and generic helper patterns; no required private backend for manage actions | v3 uses configured public Hive nodes (`rpc.usehive.com`, `api.hive.blog`, `anyx.io`) through shared profiles connection | focused smoke includes chain slice and forbids private/backend strings | Implemented/no private backend |
| `blockchains/hive/js/modal-accounts.js` | Legacy `hive_current_user`/`hive_users` with SJCL encrypted active/posting keys | Existing v3 auth/broadcast layer keeps legacy localStorage/SJCL compatibility and active authority checks | focused smoke checks crypto path and broadcast authority map | Implemented |

Validation plan for this app:
- TDD RED observed before implementation: `node tests/v3-hive-manage-smoke.js` failed with `AssertionError [ERR_ASSERTION]: Hive manage keeps static-safe operation behavior: HIVE1111111111111111111111111111111114T1Anm`.
- Focused GREEN target: `node tests/v3-hive-manage-smoke.js`.
- Mandatory app gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-hive-manage-smoke.js && git diff --check`.
- Broad smoke loop: `for f in tests/v3-*.js; do node "$f" || exit 1; done`.

Remaining gaps/non-goals:
- No backend service, PHP route, private IP runtime call, `backend.dpos.space`, hidden server API, indexer, daemon, hosted helper application, or newly hosted app is added.
- The legacy Imgur upload button is not recreated; users paste avatar/cover URLs manually because adding/uploading via a third-party hosted API is outside static parity.
- No server-side committee/worker indexer is added for Hive; the exact inspected manage app did not include Hive worker page files beyond the landing-page description.
- If public Hive RPC is unavailable or CORS-blocked, v3 reports the error in the live region instead of falling back to a private service.

### Rigorous parity: Hive / post

Scope and result:
- Legacy purpose from `config.json`: title `Публикация постов`, description `Сервис публикации постов в блокчейне Golos` (copied legacy text in the Hive app), menu `Редактор`, category `no_category`.
- Backend yes/no: **no dpos.space backend required for publishing/editing**. The exact legacy app is PHP-rendered static form plus client-side `hive.api.getContent`, `hive.api.getChainProperties`, `FileReader`, localStorage beneficiaries, and `hive.broadcast.send` with posting key. The legacy image upload used direct Imgur `XMLHttpRequest` with a public Client-ID; v3 does not add or depend on that hosted upload flow.
- Static-safe result: legacy `/hive/post` aliases to the v3 static `editor` route. The route keeps post title/body/tags/image URL, legacy Hive community choices, payout mode, beneficiary 1% default, optional extra beneficiary, permlink generation, local markdown file import, public-RPC post load for editing, and explicit preview/send broadcast through the shared posting-authority flow.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/hive/apps/post/config.json`, `/root/ai-projects/dpos.space/blockchains/hive/apps/post/content.php`, `/root/ai-projects/dpos.space/blockchains/hive/apps/post/index.php`, `/root/ai-projects/dpos.space/blockchains/hive/apps/post/js/_interface.js`, `/root/ai-projects/dpos.space/blockchains/hive/apps/post/js/simplemde.min.js`, `/root/ai-projects/dpos.space/blockchains/hive/apps/post/css/simplemde.min.css`.
- Shared legacy helpers inspected/classified: `blockchains/hive/js/blockchain.js`, `blockchains/hive/js/modal-accounts.js`, and `blockchains/hive/js/hive.min.js` for public RPC, legacy localStorage/SJCL account compatibility, and posting-key broadcast behavior.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing social editor smoke, and new `tests/v3-hive-post-smoke.js`.

Matrix:

| Legacy file/control/helper/data dependency | Exact legacy behavior | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `blockchains/hive/apps/post/config.json` | Registers menu `Редактор`; legacy app path is `/hive/post` | `normalizeAppId` maps `post` to `editor`; Hive `socialApps` registers `editor` | `tests/v3-hive-post-smoke.js` checks alias and route | Implemented |
| `content.php` title/body/tags/image/permlink fields | Form fields `content_title`, `content_text`, `content_tags`, `content_image`, `permlink_filde` | `renderEditor` exposes accessible `editor-title`, `editor-body`, `editor-tags`, `editor-image`, `editor-permlink` | focused smoke checks field markers | Implemented |
| `content.php` Hive communities | Select includes `hive-142159`, `hive-194913`, `hive-158694`, `hive-155530`, `hive-117778`, `hive-119845`, `hive-127788`, `hive-106444`, `hive-151327`, `hive-179017`, `hive-142821`, `hive-167922`, `hive-120078` | v3 Hive editor includes the same community `parent_permlink` choices plus `dpos-post` fallback | focused smoke checks representative community IDs | Implemented |
| `content.php` payout mode | `10000` = 50% HBD/HIVE and 50% HP; `0` = 100% HP | v3 Hive editor sends `percent_hbd` with the selected value in `comment_options` | focused smoke checks `percent_hbd: chain.id === 'hive' ? payoutPercent : undefined` | Implemented |
| `content.php` beneficiaries | Legacy default `denis-skripnik` 1%, optional extra beneficiary via range/text controls | `normalizeEditorBeneficiaries` keeps default 1% and optional extra beneficiary; `comment_options.extensions` includes beneficiaries | focused smoke checks `Бенефициарские 1%` and extensions marker | Implemented |
| `_interface.js` transliteration/permlink | `transform(title, '-')`, user permlink override, append `dpos-post` tag | `golosLegacyTransform` and `buildGenericEditorOperations` produce permlink and append `dpos-post` | focused smoke checks permlink and tag markers | Implemented |
| `_interface.js` markdown import | `FileReader` loads first line title, second tags, remaining body | `bindSteemPostLegacyHelpers` now supports Hive and loads local `.md` into the same form | focused smoke checks markdown helper UI and helper slice | Implemented static/local |
| `_interface.js` edit existing post | Parses URL, calls `hive.api.getContent(Author, Permlink, cb)`, fills form for editing | v3 helper supports Hive/Steem public RPC `getContent` and fills form; no server/indexer is used | focused smoke checks `getContent` | Implemented public RPC |
| `_interface.js` publish/edit broadcast | Builds `comment` and `comment_options`; calls `hive.broadcast.send({extensions: [], operations}, [wif], cb)` with posting key | `broadcast.prepare(chain, 'posting', 'sendOperations', [operations])` with explicit preview/send confirmation | focused smoke checks `sendOperations`, `comment`, `comment_options`, and broadcast authority map | Implemented static-safe broadcast |
| `_interface.js` `hive.api.getChainProperties(cb)` | Reads curation min/max, but exact Hive post form has no rendered curation input in `content.php` | No separate curation range is added for Hive; payout mode and beneficiaries are preserved. Public RPC remains available only where needed for edit loading. | focused smoke records evidence; non-goal below | Static-safe partial parity |
| `_interface.js` Imgur upload | Direct `XMLHttpRequest` to `https://api.imgur.com/3/image.json` with public Client-ID `372d5f766d47d1d` | v3 accepts image URL(s) manually; no upload endpoint, third-party upload token, hosted helper, or backend is added | focused smoke forbids `XMLHttpRequest`, `api.imgur.com`, Client-ID | Static-only non-goal |
| `index.php` | Guard-only PHP stub | No v3 PHP runtime or old `blockchains/...` runtime path | focused smoke forbids `.php` and legacy app path in runtime slice | Implemented/no PHP |

Validation plan for this app:
- TDD RED observed before implementation: `node tests/v3-hive-post-smoke.js` failed with `AssertionError [ERR_ASSERTION]: Hive post/editor keeps legacy UI/control marker: Публикация поста`, then uncovered missing exact Hive helpers/plan evidence.
- Focused GREEN target: `node tests/v3-hive-post-smoke.js`.
- Mandatory app gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-hive-post-smoke.js && git diff --check`.
- Broad smoke loop: `for f in tests/v3-*.js; do node "$f" || exit 1; done`.

Remaining gaps/non-goals:
- No backend service, PHP route, private IP runtime call, `backend.dpos.space`, hidden server API, indexer, daemon, hosted helper application, or newly hosted app is added.
- Legacy SimpleMDE/Garlic UI libraries are not reintroduced; v3 keeps a plain accessible textarea and local file import.
- Legacy Imgur upload is not recreated; users paste image URLs manually to avoid adding third-party upload dependency/token-like Client-ID behavior.
- Legacy curation min/max range from `getChainProperties` is not exposed because the exact rendered Hive form did not include a curation input; this can be a future static public-RPC enhancement if explicitly requested.
- If public Hive RPC is unavailable or CORS-blocked, v3 reports the error in the live region instead of falling back to a private service.

### Rigorous parity: Hive / profiles

Scope and result:
- Legacy purpose from `config.json`: title `Просмотр профилей`, description `Просмотрщик профилей в блокчейне Hive`, menu `Профили`, category `no_category`.
- Backend yes/no: **partial PHP backend in legacy, no v3 backend added**. The top-level search form is static, but legacy profile subpages use PHP-rendered snippets and `getLoad()` pagination for history/transfers/HP/DAO/rewards/votes/accounts/feed/comments plus modal AJAX snippets. The static v3 replacement uses public Hive RPC for account data/direct extras and maps broad paginated subpages to static history filters.
- Static-safe result: v3 `profiles` stays read-only, exposes Hive profile/account data through `DposProfiles`, adds Hive legacy subpage quick links to `history` filters, and loads direct public RPC extras for followers/following/delegations/witness/blog/comments without PHP, private IPs, backend.dpos.space, hidden APIs, or broadcast behavior.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/hive/apps/profiles/config.json`, `/root/ai-projects/dpos.space/blockchains/hive/apps/profiles/content.php`, `/root/ai-projects/dpos.space/blockchains/hive/apps/profiles/index.php`, `/root/ai-projects/dpos.space/blockchains/hive/apps/profiles/js/app.js`, `/root/ai-projects/dpos.space/blockchains/hive/apps/profiles/page/config.json`, `/root/ai-projects/dpos.space/blockchains/hive/apps/profiles/page/content.php`, `page/userinfo.php`, `page/history.php`, `page/transfers.php`, `page/hp.php`, `page/dao.php`, `page/author_rewards.php`, `page/curation_rewards.php`, `page/benefactor_rewards.php`, `page/votes.php`, `page/accounts.php`, `page/witness.php`, `page/blog-posts.php`, `page/posts_with_payment.php`, `page/comments.php`, `page/feed.php`, `page/delegat.php`, `page/delegations.php`, `page/followers.php`, and snippets under `page/snippets/` including `Get_Followers.php`, `Get_Followings.php`, `get_vesting_delegations.php`, `get_witness_by_account.php`, `get_discussions_by_blog.php`, `GetContentReplies.php`, `get_account_history_chunk.php`, `get_account.php`, `get_dynamic_global_properties.php`, `get_chain_properties.php`, `get_config.php`, `get_feed_history.php`, `getRewardFund.php`, and `get_follow_count.php`.
- Shared legacy helpers inspected/classified: `blockchains/hive/js/blockchain.js`, `blockchains/hive/js/modal-accounts.js`, and `blockchains/hive/js/hive.min.js` for public RPC/auth/ajax classification. Profiles is read-only and does not need broadcast helpers.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing Steem/Golos/VIZ profile smokes, and new `tests/v3-hive-profiles-smoke.js`.

Matrix:

| Legacy file/control/helper/data dependency | Exact legacy behavior | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `blockchains/hive/apps/profiles/config.json` | Registers menu `Профили` in Hive `no_category` | Hive inherits base `profiles` app in `v3/js/chains.js` | `tests/v3-hive-profiles-smoke.js` checks Hive registration | Implemented |
| `content.php` and `page/content.php` | Form asks for `user` without `@` and posts `chain=hive&service=profiles` | v3 route account input/selector routes to `#chain=hive&app=profiles&account=...`; profile route has accessible headings/status through shared router | focused smoke checks legacy form and v3 profile renderer | Implemented static |
| `index.php` profile navigation | Renders `Основное`, `История`, `Переводы средств`, `Hive Power`, `ДАО`, rewards, accounts, posts/feed/comments/witness/votes pages | `hiveLegacyProfileLinks(account)` maps pages to profile/history filters; direct profile extras render where one-shot public RPC is enough | focused smoke checks labels/filter op lists | Implemented static-safe |
| `index.php` `getLoad(...profiles/page/*.php...)` | Server PHP pagination for transfers/HP/DAO/rewards/votes/accounts/feed/comments/paid posts | v3 does not call PHP; paginated tables become `history` filter links using public RPC account-history route | focused smoke forbids `profiles/page/*.php` and old runtime paths in Hive profile slice | Implemented/no PHP |
| `js/app.js` | Client-side history page calls `hive.api.getDynamicGlobalPropertiesAsync()` and `hive.api.getAccountHistoryAsync(user, from, limit)` with ops/query filters | Existing v3 `history` app handles Hive account history and operation filter hashes | focused smoke checks `hive: new Set`, op filters, no broadcast | Implemented |
| `page/userinfo.php` and snippets | Reads account, dynamic props, chain config, feed history, reward fund, follow count; displays balances, metadata, governance, authorities, activity | `DposProfiles.fetchAccount/enrichAccount/normalizeAccount` reads `getAccounts`, dynamic props/config/reward fund/follow count and renders details/metadata/economy/activity | focused smoke normalizes HIVE/HBD/HP, follow count, metadata/social links | Implemented public RPC |
| `Get_Followers.php` / `Get_Followings.php` | Modal lists followers/followings via `GetFollowersCommand`/`getFollowing` | `fetchHiveProfileExtras` calls public RPC `getFollowers`/`getFollowing` and `renderHiveLegacyDirectSections` displays limited lists | focused smoke checks snippet evidence and fetch/render markers | Implemented public RPC, limited list |
| `get_vesting_delegations.php` | Modal/list for HP delegations via `GetVestingDelegationsCommand` | `fetchHiveProfileExtras` calls `getVestingDelegations(account, '', 100)` and renders outgoing delegations | focused smoke checks `GetVestingDelegationsCommand` and v3 call | Implemented public RPC, limited list |
| `get_witness_by_account.php` | Witness details for profile | `fetchHiveProfileExtras` calls `getWitnessByAccount` and renders witness rows when available | focused smoke checks call and render marker | Implemented public RPC |
| `get_discussions_by_blog.php` / `GetContentReplies.php` | Blog posts and comments via public RPC snippets | `fetchHiveProfileExtras` calls `getDiscussionsByBlog({limit:10, tag: account})` and `getDiscussionsByComments({limit:10,start_author:account})`; `renderHiveContentList` links to PeakD | focused smoke checks calls and direct section marker | Implemented public RPC, limited list |
| History-derived PHP pages (`transfers.php`, `hp.php`, `dao.php`, `author_rewards.php`, `curation_rewards.php`, `benefactor_rewards.php`, `votes.php`, `accounts.php`, `comments.php`) | Server iterates `getAccountHistoryChunk` with selected ops and paginates | v3 quick links map exact page categories to public history filters; no server iteration/indexer | focused smoke checks op sets for transfers/HP/DAO/comments and plan evidence | Static-only replacement |
| `broadcast.js` / operation helpers | Profiles app is read-only; legacy profile pages do not broadcast | v3 profiles do not bind operation forms and broadcast has no Hive profiles operation | focused smoke checks no `bindOperationForm(chain, 'profiles')` and no profile broadcast markers | Implemented read-only |

Validation plan for this app:
- TDD RED observed before implementation: `node tests/v3-hive-profiles-smoke.js` failed with `AssertionError [ERR_ASSERTION]: Hive profiles expose a legacy subpage to static history-link mapper`.
- Focused GREEN target: `node tests/v3-hive-profiles-smoke.js`.
- Mandatory app gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-hive-profiles-smoke.js && git diff --check`.
- Broad smoke loop: `for f in tests/v3-*.js; do node "$f" || exit 1; done`.

Remaining gaps/non-goals:
- No backend service, PHP route, private IP runtime call, `backend.dpos.space`, hidden server API, indexer, daemon, hosted helper application, or newly hosted app is added.
- Legacy PHP pagination and modal AJAX are not recreated as a service; v3 uses limited direct public RPC extras plus history filters.
- Paid/old posts, large feed/comment/reward/account-history tables may require many paginated RPC calls; v3 intentionally avoids an indexer and exposes honest public-RPC alternatives.
- If public Hive RPC is unavailable or CORS-blocked, v3 reports the error in the live region instead of falling back to a private service.

### Rigorous parity: Hive / backup

Scope and result:
- Legacy purpose from `config.json`: title `Бекап постов`, description `Резервное копирование постов в Hive.`, menu `Бекап постов`, category `tools`.
- Backend yes/no: **yes in legacy, no v3 backend added**. Legacy asks the user to pay `0.5 HBD или 1 HIVE` with memo `posts`, then PHP `index.php` loads `functions.php` and `page/content.php` to generate a server-side archive/download flow. Static v3 does not verify payments, create server archives, store files, or run PHP.
- Static-safe result: Hive gets a dedicated `backup` route that locally exports publicly available blog posts through direct public Hive RPC (`getDiscussionsByBlog`) into Markdown or HTML. Reblog inclusion, format selection, accessible labels, and live status are preserved; payment-gated server archive behavior is documented as non-goal.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/hive/apps/backup/config.json`, `/root/ai-projects/dpos.space/blockchains/hive/apps/backup/content.php`, `/root/ai-projects/dpos.space/blockchains/hive/apps/backup/index.php`.
- Linked backend/page dependency from `index.php`: `functions.php` and `page/content.php` are required when present; the exact Hive checkout exposes that dependency through the PHP loader even though only the top app files are present in the file list returned for this pass.
- Shared legacy helpers inspected/classified: `blockchains/hive/js/blockchain.js`, `blockchains/hive/js/modal-accounts.js`, and `blockchains/hive/js/hive.min.js` for public RPC/auth classification. Backup export is read-only and does not need broadcast helpers.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing Steem backup smoke, and new `tests/v3-hive-backup-smoke.js`.

Matrix:

| Legacy file/control/helper/data dependency | Exact legacy behavior | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `blockchains/hive/apps/backup/config.json` | Registers tools menu `Бекап постов` | `hiveApps` adds `{ id: 'backup', title: 'Бекап постов' }`; router dispatches Hive backup | `tests/v3-hive-backup-smoke.js` checks registration/router | Implemented |
| `content.php` payment instructions | User pays `0.5 HBD или 1 HIVE` to `@denis-skripnik` with memo `posts` before server archive | v3 explicitly states old payment-gated server archive is not restored; no payment verification or server storage is added | focused smoke checks payment evidence and non-goal wording | Static-only non-goal |
| `content.php` login form | Hidden `chain=hive`, `service=backup`, text user login without `@` | `renderHiveBackup` exposes `hive-backup-user` with accessible label and route account default | focused smoke checks form ids/labels | Implemented static |
| `content.php` reblog choice | Radio `reblogs=yes2` only own posts, `yes3` all reblogs | `bindHiveBackupForm` uses the same values and `filterSteemBackupPosts` keeps all posts only for `yes3` | focused smoke checks values/filter marker | Implemented |
| `content.php` format choice | `contentformat` select `Markdown`/`HTML` | `renderHiveBackup` keeps Markdown/HTML select and local file extension | focused smoke checks format controls/download filename | Implemented |
| `index.php` PHP loader | `require_once 'functions.php'`, reads `page/content.php`, builds server page/archive flow | v3 has no PHP runtime; export is local browser download via `downloadTextFile` | focused smoke forbids old app paths, `ZipArchive`, `archives/`, `users/`, `ajax.php` | Implemented/no PHP |
| Public posts source | Legacy archive service ultimately depends on blockchain post data and payment window | `loadSteemBackupPosts(chain, account)` is reused with Hive chain and calls public RPC `getDiscussionsByBlog` with pagination fields | focused smoke checks `getDiscussionsByBlog`, `tag`, `start_author`, `start_permlink` evidence | Implemented public RPC |
| `broadcast.js` / keys | Backup is read/export-only; no chain operation should be sent | v3 backup does not call `broadcast.prepare`, `broadcast.broadcast`, private-key/SJCL decrypt, or `localStorage.setItem` | focused smoke checks runtime slice and broadcast source | Implemented read-only |

Validation plan for this app:
- TDD RED observed before implementation: `node tests/v3-hive-backup-smoke.js` failed with `AssertionError [ERR_ASSERTION]: renderHiveBackup exists`.
- Focused GREEN target: `node tests/v3-hive-backup-smoke.js`.
- Mandatory app gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-hive-backup-smoke.js && git diff --check`.
- Broad smoke loop: `for f in tests/v3-*.js; do node "$f" || exit 1; done`.

Remaining gaps/non-goals:
- No backend service, PHP route, private IP runtime call, `backend.dpos.space`, hidden server API, indexer, daemon, hosted helper application, newly hosted app, server-side archive, or payment verification is added.
- Legacy paid archive validity window (`2000` positions) is not implemented because it requires server-side payment/history verification and storage.
- Static export is limited by public Hive RPC availability/CORS and pagination caps; v3 reports errors in the live region instead of falling back to private services.

### Rigorous parity: Hive / calc

Scope and result:
- Legacy purpose from `config.json`: title `Блокчейн-калькулятор`, description `Рассчёт стоимости апвота, GESTS в СГ и другие параметры блокчейна Hive.`, menu `Калькулятор`, category `tools`.
- Backend yes/no: **yes in legacy, no v3 backend added**. Legacy `js/app.js` posts to `/blockchains/hive/apps/calc/ajax.php`; `ajax.php` requires PHP snippets and server-side GrapheneNodeClient commands. Static v3 replaces this with direct browser public Hive RPC calls.
- Static-safe result: Hive `calc` aliases to the shared `calculator` app, but now dispatches to a dedicated Hive renderer preserving upvote-value and VESTS→HP controls instead of the previous generic vesting-only calculator.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/hive/apps/calc/config.json`, `/root/ai-projects/dpos.space/blockchains/hive/apps/calc/content.php`, `/root/ai-projects/dpos.space/blockchains/hive/apps/calc/index.php`, `/root/ai-projects/dpos.space/blockchains/hive/apps/calc/js/app.js`, `/root/ai-projects/dpos.space/blockchains/hive/apps/calc/ajax.php`.
- Linked snippet/backend dependencies: `blockchains/hive/apps/calc/snippets/get_dynamic_global_properties.php`, `blockchains/hive/apps/calc/snippets/get_chain_properties.php`, `blockchains/hive/apps/calc/snippets/get_feed_history.php`, `blockchains/hive/apps/calc/snippets/get_ticker.php`, `blockchains/hive/apps/calc/snippets/get_config.php`, `blockchains/hive/apps/calc/snippets/getRewardFund.php`.
- Shared legacy helpers inspected/classified: `blockchains/hive/js/blockchain.js`, `blockchains/hive/js/modal-accounts.js`, and `blockchains/hive/js/hive.min.js` for public RPC/auth/ajax classification. Calc is read-only and does not need broadcast helpers.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing Steem calculator smoke, and new `tests/v3-hive-calc-smoke.js`.

Matrix:

| Legacy file/control/helper/data dependency | Exact legacy behavior | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `blockchains/hive/apps/calc/config.json` | Registers tools menu `Калькулятор` | Hive inherits `{ id: 'calculator', title: 'Калькулятор' }`; legacy `calc` aliases to calculator | `tests/v3-hive-calc-smoke.js` checks registration and alias | Implemented |
| `content.php` HP upvote form | Inputs `sp`, `vp`, `vote_weight`; button `Вывести стоимость апвота`; result div `let1` | `renderHiveCalculator` renders accessible HP/battery/weight form and status result | focused smoke checks form ids/copy/live region | Implemented static |
| `content.php` VESTS form | Input `sp_tec`; button `Рассчитать VESTS в HP`; result div `let2` | `renderHiveCalculator` renders VESTS→HP form using current `total_vesting_fund_hive`/`total_vesting_shares` | focused smoke checks VESTS controls/result copy | Implemented static |
| `js/app.js` jQuery handlers | `.load('/blockchains/hive/apps/calc/ajax.php', ...)` for `result_power` and `result_vests` | v3 uses in-browser event handlers and direct public RPC; no jQuery/PHP endpoint | focused smoke forbids `ajax.php` and old runtime app path in runtime slice | Implemented/no PHP |
| `ajax.php` formula | Computes HIVE/HBD upvote value from dynamic props, feed median, reward fund and vote weight | `calculateHiveUpvoteValue` keeps the same formula evidence (`hivePerVests`, `hiveM`, reward balance/recent claims, median price, weight multiplier) | focused smoke checks formula markers | Implemented |
| PHP snippets | Server GrapheneNodeClient calls for dynamic props, chain props, feed history, ticker, config, reward fund | `loadHiveCalculatorContext` calls public RPC `getDynamicGlobalProperties`, `getChainProperties`, `getFeedHistory`, `getTicker`, `getConfig`, `getRewardFund(['post'])` | focused smoke checks each public RPC call and snippet evidence | Implemented public RPC |
| `broadcast.js` / keys | Calculator is read-only; no transaction operation | v3 calc does not call `broadcast.prepare`, `broadcast.broadcast`, or bind operation forms | focused smoke checks runtime slice and shared helper availability | Implemented read-only |

Validation plan for this app:
- TDD RED observed before implementation: `node tests/v3-hive-calc-smoke.js` failed with `AssertionError [ERR_ASSERTION]: loadHiveCalculatorContext exists`.
- Focused GREEN target: `node tests/v3-hive-calc-smoke.js`.
- Mandatory app gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-hive-calc-smoke.js && git diff --check`.
- Broad smoke loop: `for f in tests/v3-*.js; do node "$f" || exit 1; done`.

Remaining gaps/non-goals:
- No backend service, PHP route, private IP runtime call, `backend.dpos.space`, hidden server API, indexer, daemon, hosted helper application, or newly hosted app is added.
- Legacy PHP snippets are not recreated as a runtime; public RPC failures are shown in the live region instead of falling back to a private service.
- `get_ticker`/`get_chain_properties`/`get_config` are queried as legacy evidence where public RPC supports them, but the browser formula relies on dynamic props, feed history, and reward fund just like the legacy value path.

### Rigorous parity: Hive / randomblockchain

Scope and result:
- Legacy purpose from `config.json`: title `Генератор случайных чисел`, description `Генератор случайных чисел с использованием блоков блокчейна Hive.`, menu `ГСЧ`, category `tools`.
- Backend yes/no: **no private backend required in legacy runtime; no v3 backend added**. Legacy uses browser `hive.api.getBlock`, vendored `sha3.min.js`, and `BigInteger.min.js`; PHP only renders static form/result scaffolding.
- Static-safe result: Hive `randomblockchain` uses the existing static v3 randomblockchain renderer with public Hive RPC `getBlock`, witness signatures, vendored keccak helper, local BigInt modulo, accessible form/result, and no server-side service.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/hive/apps/randomblockchain/config.json`, `/root/ai-projects/dpos.space/blockchains/hive/apps/randomblockchain/content.php`, `/root/ai-projects/dpos.space/blockchains/hive/apps/randomblockchain/index.php`, `/root/ai-projects/dpos.space/blockchains/hive/apps/randomblockchain/js/app.js`, `/root/ai-projects/dpos.space/blockchains/hive/apps/randomblockchain/js/BigInteger.min.js`, `/root/ai-projects/dpos.space/blockchains/hive/apps/randomblockchain/js/sha3.min.js`.
- Shared legacy helpers inspected/classified: `blockchains/hive/js/blockchain.js`, `blockchains/hive/js/modal-accounts.js`, and `blockchains/hive/js/hive.min.js` for public RPC/auth classification. Randomblockchain is read-only and does not need broadcast helpers.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing `tests/v3-social-randomblockchain-smoke.js`, existing Steem randomblockchain smoke, and new `tests/v3-hive-randomblockchain-smoke.js`.

Matrix:

| Legacy file/control/helper/data dependency | Exact legacy behavior | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `blockchains/hive/apps/randomblockchain/config.json` | Registers tools menu `ГСЧ` | Hive exposes `{ id: 'randomblockchain' }` with vendored `randomHashPath` | `tests/v3-hive-randomblockchain-smoke.js` checks route and vendored helper path | Implemented |
| `content.php` initial form | GET form asks `block1`, `block2`, `participants`, optional `data_list`; submit text `Сгенерировать` | `renderRandomBlockchain` exposes accessible first/second/participants/data_list controls | focused smoke checks control ids/copy and live result | Implemented static |
| `content.php` result scaffold | Shows start/end block, help post, repository link, textareas `sig1`/`sig2`, button `Вычислить счастливое число`, hash/lucky number/result member | v3 keeps help/repository links and computes/display result in accessible live region rather than PHP-rendered second page | focused smoke checks help, repo/copy markers, result labels | Implemented static |
| `js/app.js blocksData` | Calls `hive.api.getBlock(start_block/end_block)` and reads `witness_signature` into fields | `resolveRandomBlockchainSeed`/`blockRandomSeed` call public RPC `getBlock` and prefer `witness_signature` for Hive | focused smoke checks `getBlock` and witness signature seed branch | Implemented public RPC |
| `js/app.js calculate` | `keccak_256.update(sig1 + sig2).toString()`, `bigInt(h,16).mod(participants)`, lucky number `d.value+1` | `hashRandomBlockchainSeeds` uses vendored `keccak_256(witness_signature_1 + witness_signature_2)` and BigInt modulo, returns `luckyNumber: value + 1` | focused smoke checks algorithm markers | Implemented |
| `data_list` winner | If list exists, participants becomes row count and winner is `data_array[d.value]` | v3 derives `list.length` and shows `list[random.value]` as winner | focused smoke checks `data_list` and winner lookup | Implemented |
| `BigInteger.min.js`/`sha3.min.js` | Browser helper libraries for hash modulo | v3 uses native BigInt plus vendored `v3/vendor/viz/sha3.min.js` for the same keccak algorithm | focused smoke checks helper evidence and file existence | Implemented static |
| `broadcast.js` / keys | Random generator is read-only; no signing/broadcast | v3 randomblockchain does not call `broadcast.prepare`, `broadcast.broadcast`, or bind operation forms | focused smoke checks runtime slice and shared helper availability | Implemented read-only |

Validation plan for this app:
- TDD RED observed before implementation: `node tests/v3-hive-randomblockchain-smoke.js` failed first on missing exact legacy UI marker, then on missing exact `### Rigorous parity: Hive / randomblockchain` plan evidence.
- Focused GREEN target: `node tests/v3-hive-randomblockchain-smoke.js`.
- Mandatory app gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-hive-randomblockchain-smoke.js && git diff --check`.
- Broad smoke loop: `for f in tests/v3-*.js; do node "$f" || exit 1; done`.

Remaining gaps/non-goals:
- No backend service, PHP route, private IP runtime call, `backend.dpos.space`, hidden server API, indexer, daemon, hosted helper application, or newly hosted app is added.
- v3 does not recreate PHP GET pages as separate server-rendered URLs; it provides the same controls and calculation in the static SPA route.
- Public Hive RPC/CORS failures are surfaced in the live region instead of falling back to a private service.

### Rigorous parity: Hive / wallet

Scope and result:
- Legacy purpose from `config.json`: Hive wallet UI for balances, transfers, power up/down, delegation, rewards, savings-related operation support, memo safety, and history shortcuts.
- Backend yes/no: **no backend service added**. Legacy wallet is a browser/action app using Hive RPC/broadcast helpers plus static PHP-rendered markup; v3 keeps this as a direct client-side wallet/action app using existing broadcast patterns.
- Static-safe result: dedicated `renderHiveWallet` and Hive wallet forms preserve native HIVE/HBD/HP labels, delegation/status/rewards/savings actions, WIF memo guard, optional encrypted memo handling, and direct wallet broadcasts only after explicit user submit/confirm.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/hive/apps/wallet/config.json`, `/root/ai-projects/dpos.space/blockchains/hive/apps/wallet/content.php`, `/root/ai-projects/dpos.space/blockchains/hive/apps/wallet/css/jquery-ui.css`, `/root/ai-projects/dpos.space/blockchains/hive/apps/wallet/css/style.css`, `/root/ai-projects/dpos.space/blockchains/hive/apps/wallet/index.php`, `/root/ai-projects/dpos.space/blockchains/hive/apps/wallet/js/app.js`.
- Shared legacy helpers inspected/classified: `blockchains/hive/js/blockchain.js`, `blockchains/hive/js/modal-accounts.js`, `blockchains/hive/js/hive.min.js`, `blockchains/hive/js/jquery-ui.js`, `blockchains/hive/js/sjcl.min.js`.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, and `tests/v3-hive-wallet-smoke.js`.

Matrix:

| Legacy file/control/helper/data dependency | Exact legacy behavior | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `blockchains/hive/apps/wallet/config.json` | Registers Hive wallet menu/description | Hive base apps include `wallet`; dedicated renderer handles Hive | `tests/v3-hive-wallet-smoke.js` checks dedicated Hive wallet root | Implemented |
| `content.php` balances/actions | Shows HIVE/HBD/HP, savings, reward fields, transfer/power/delegation/reward actions | `renderHiveWalletBalances` and `renderHiveWalletForms` expose native labels and forms | focused smoke checks labels/form ids | Implemented |
| `js/app.js` wallet data | Loads account data and vesting delegations | `loadHiveWalletData` calls public RPC including `getVestingDelegations(account, '', 100)` | focused smoke checks call order | Implemented public RPC |
| `js/app.js` transfer/power/delegation/rewards | Uses Hive broadcasts such as `hive.broadcast.transfer(active_key, hive_login, to, amount, memo, cb)`, power up/down, delegation, claim | `bindHiveWalletForms` prepares `transfer`, `transferToVesting`, `withdrawVesting`, `delegateVestingShares`, `claimRewardBalance` via v3 broadcast layer | focused smoke checks method markers | Implemented client-side action |
| `hive.min.js` savings operations | Shared library supports `transfer_to_savings(from,to,amount,memo)`, `transfer_from_savings(from,request_id,to,amount,memo)`, `cancel_transfer_from_savings(from,request_id)` | v3 exposes savings to/from/cancel forms using same operation order | focused smoke checks operation evidence | Implemented client-side action |
| Memo safety | Legacy warns if memo looks like WIF; shared library can encode memos | v3 keeps `isSteemMemoWif` guard and `encodeHiveMemoIfNeeded` for `#` memo where available | focused smoke checks guard/encode markers | Implemented |
| History filters | Legacy wallet embeds paged history filters | v3 keeps wallet latest/history links and uses dedicated static `history` route for operation filters instead of duplicating PHP pagination | plan evidence plus broad smokes | Static-safe replacement |

Validation plan for this app:
- Focused coverage: `node tests/v3-hive-wallet-smoke.js`.
- Mandatory app gate pattern: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-hive-wallet-smoke.js && git diff --check`.
- Broad smoke loop: `for f in tests/v3-*.js; do node "$f" || exit 1; done`.

Remaining gaps/non-goals:
- No backend service, PHP route, private IP runtime call, `backend.dpos.space`, hidden server API, indexer, daemon, hosted helper application, or newly hosted app is added.
- Wallet broadcasts are direct client-side user actions; no automatic transaction is sent in tests or without explicit UI submit/confirm.
- Legacy paged wallet-history tables are not recreated as a server/indexer; v3 uses the static public-RPC history route.

### Rigorous parity: Minter / long

Scope and result:
- Legacy purpose from `config.json`: `LONG farming`, an app for viewing BIP/LONG provider/farming data.
- Backend yes/no: **backend yes in legacy, no backend service added in v3**. Legacy reads private smartfarm endpoints and PHP-generated state; v3 documents those as static-only non-goals and keeps only public/static-safe read-only information.
- Static-safe result: Minter `long` route renders the legacy app title, public BIP/LONG pool summary, Telegram/Chainik links, farming sender wallet, and honest backend/indexer-only non-goals. It does not call private IPs, `backend.dpos.space`, PHP endpoints, or new hidden services.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/minter/apps/long/config.json`, `/root/ai-projects/dpos.space/blockchains/minter/apps/long/content.php`, `/root/ai-projects/dpos.space/blockchains/minter/apps/long/index.php`, `/root/ai-projects/dpos.space/blockchains/minter/apps/long/js/app.js`.
- Legacy linked pages inspected/classified: `pages/bids`, `pages/calc`, `pages/deferred-txs`, `pages/dragon`, `pages/loto`, `pages/payd-loto`, `pages/rps`, `pages/surveys`, `pages/phelosophy`, `pages/roadmap` configs/content where present.
- Shared/helper evidence inspected: legacy LONG JS references to `send(...)`, public Minter pool/route APIs, private smartfarm endpoints, and the Minter wallet/action helpers only to classify backend vs direct wallet behavior.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing `tests/v3-minter-wallet-smoke.js`, and updated `tests/v3-minter-long-smoke.js`.

Matrix:

| Legacy file/control/helper/data dependency | Exact legacy behavior | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `blockchains/minter/apps/long/config.json` | Registers no-category `LONG` app titled `LONG farming` | Minter apps include `long`; `renderMinterLong` handles `chain=minter&app=long` | `tests/v3-minter-long-smoke.js` checks route output and title | Implemented static |
| `content.php` overview | PHP reads private `smartfarm` state, public Minter pool, computes max amount/prize/farming/provider rows | v3 does not recreate private backend state; it shows public BIP/LONG pool stats, sender wallet and explanation | smoke checks public pool call and no smartfarm/private backend call | Static-safe replacement |
| Provider ranking table | Legacy renders provider liquidity, invest days, future farming and 50-day bonus from backend provider list | v3 states provider ranking is unavailable without legacy backend and avoids fake data | smoke checks `Рейтинг провайдеров` non-goal copy | Backend/indexer-only non-goal |
| `pages/bids` + `js/app.js updateBidsTable` | Reads projects/active bids from private smartfarm/backend and uses memo send instructions | v3 documents bids as backend-only and does not introduce a new transaction form or service | smoke checks subservice copy and no broadcast binding in LONG slice | Backend/indexer-only non-goal |
| `pages/deferred-txs` | Reads deferred transaction list from private smartfarm backend | v3 points to public history of the farming sender wallet instead of hosting a list | smoke checks subservice copy and sender address | Backend/indexer-only non-goal |
| `pages/surveys`, `loto`, `payd-loto`, `rps`, `dragon`, `calc` | Mix of private backend state and optional direct Minter sends to LONG service address | v3 keeps them documented as requiring server state/indexed lists; direct wallet actions are not added under LONG in this pass | plan + smoke check non-goal and no `bindOperationForm`/broadcast calls in slice | Static-only non-goal |
| Public pool dependency | Legacy uses public Minter pool endpoint for BIP/LONG reserves/pricing | v3 fetches `https://api-minter.mnst.club/v2/swap_pool/0/2782` read-only | smoke checks exact public API call | Implemented public API |
| Forbidden runtime dependencies | Legacy uses `http://178.20.43.121:3852/smartfarm`, `https://backend.dpos.space/smartfarm`, PHP app pages | v3 Minter LONG runtime slice has no private IP, backend.dpos.space, `/api/smartfarm`, `.php`, or hidden server API dependency | focused smoke isolates `function longPageHash` to validators boundary | Enforced |

Validation plan for this app:
- TDD RED observed before implementation: `node tests/v3-minter-long-smoke.js` failed on unexpected `/api/smartfarm` fetch and missing exact `### Rigorous parity: Minter / long` plan section.
- Focused GREEN target: `node tests/v3-minter-long-smoke.js`.
- Mandatory app gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-minter-long-smoke.js && git diff --check`.
- Broad smoke loop: `for f in tests/v3-*.js; do node "$f" || exit 1; done`.

Remaining gaps/non-goals:
- No backend service, PHP route, private IP runtime call, `backend.dpos.space`, hidden server API, indexer, daemon, hosted helper application, or newly hosted app is added.
- Legacy LONG server-maintained provider ranking, active bids, survey lists/results, lottery state, dragons, family calculator data and deferred transaction list are backend/indexer-only non-goals for static v3.
- v3 does not add LONG-specific direct broadcast forms; users can use existing Minter wallet/swap routes for explicitly supported actions only.

### Rigorous parity: Minter / explorer

Scope and result:
- Legacy purpose from `config.json`: `Блок-эксплорер`, viewing Minter blocks and transaction hashes.
- Backend yes/no: **no private backend service added**. Legacy is PHP-rendered but reads public Minter APIs: `https://api-minter.mnst.club/v2/` for status/block and `https://explorer-api.minter.network/api/v2/` for status-page/transactions. v3 replaces PHP routing with direct browser public REST calls.
- Static-safe result: Minter explorer overview, block page, and tx page use public APIs, preserve legacy prompt/sections (`Последние блоки`, `Статус`, `Блок №`, tx `Данные`), render accessible form/status region, and remain read-only.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/minter/apps/explorer/config.json`, `/root/ai-projects/dpos.space/blockchains/minter/apps/explorer/content.php`, `/root/ai-projects/dpos.space/blockchains/minter/apps/explorer/index.php`.
- Legacy linked pages inspected: `/root/ai-projects/dpos.space/blockchains/minter/apps/explorer/pages/block/config.json`, `/root/ai-projects/dpos.space/blockchains/minter/apps/explorer/pages/block/content.php`, `/root/ai-projects/dpos.space/blockchains/minter/apps/explorer/pages/tx/config.json`, `/root/ai-projects/dpos.space/blockchains/minter/apps/explorer/pages/tx/content.php`.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing `tests/v3-route-coverage-smoke.js`, and new `tests/v3-minter-explorer-smoke.js`.

Matrix:

| Legacy file/control/helper/data dependency | Exact legacy behavior | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `config.json` | Registers `Explorer` no-category Minter app titled `Блок-эксплорер` | Minter apps include `explorer`; generic explorer form routes to Minter-specific REST handlers | `tests/v3-minter-explorer-smoke.js` opens `chain=minter&app=explorer` | Implemented |
| `content.php` form | Prompt asks for block number or transaction hash and posts `chain=minter`, `service=explorer`, `data` | v3 keeps accessible `explorer-form`, `explorer-kind`, `explorer-value`, and legacy prompt copy | focused smoke checks prompt copy and route rendering | Implemented static |
| `content.php` overview | Calls `status?` and `status-page`, shows last 10 blocks and status fields | `loadMinterExplorerOverview` calls `chain.apiBase/status` and `chain.explorerBase/status-page`; `renderMinterExplorerOverview` renders sections/links | focused smoke checks exact public fetches and rendered latest block/status | Implemented public REST |
| `index.php` redirect logic | Numeric `/minter/explorer/<n>` redirects to block page; hex-like value redirects to tx page | v3 route uses explicit `kind=block|tx&value=...`; form navigation replaces PHP redirects | focused smoke covers block and tx route hashes | Static-safe SPA replacement |
| `pages/block/content.php` | Calls `block/{height}`, renders previous/next links, tx count, tx hash links, Minter tx type labels and readable operation data | `loadMinterExplorerBlock`, `renderMinterExplorerBlock`, `minterTxTypeLabel`, `renderMinterExplorerData` render same core fields | focused smoke checks public block endpoint, navigation, type and readable amount marker | Implemented public REST |
| `pages/tx/content.php` | Calls explorer transaction endpoint, renders block link, timestamp, type, sender, gas coin/fee and operation data | `loadMinterExplorerTx` and `renderMinterExplorerTx` render tx details and raw details secondary | focused smoke checks endpoint and tx sections | Implemented public REST |
| Broadcast/auth dependencies | Explorer legacy is read-only; no signing needed | v3 Minter explorer slice does not call broadcast prepare/broadcast or bind operation forms | focused smoke checks isolated runtime slice | Implemented read-only |
| Forbidden runtime dependencies | Legacy explorer uses public APIs, not private smartfarm/backend services | v3 Minter explorer slice has no private IP, `backend.dpos.space`, PHP endpoint or hidden server API dependency | focused smoke enforces forbidden strings in runtime slice | Enforced |

Validation plan for this app:
- TDD RED observed before implementation: `node tests/v3-minter-explorer-smoke.js` failed because Minter explorer overview did not fetch/render public status endpoint and no exact plan section existed.
- Focused GREEN target: `node tests/v3-minter-explorer-smoke.js`.
- Mandatory app gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-minter-explorer-smoke.js && git diff --check`.
- Broad smoke loop: `for f in tests/v3-*.js; do node "$f" || exit 1; done`.

Remaining gaps/non-goals:
- No backend service, PHP route, private IP runtime call, `backend.dpos.space`, hidden server API, indexer, daemon, hosted helper application, or newly hosted app is added.
- v3 does not recreate old PHP clean URLs or server redirects; static SPA hash routes replace them.
- If public Minter REST APIs are unavailable/CORS-blocked, v3 surfaces the error instead of falling back to a private proxy.

### Rigorous parity: Minter / wallet

Scope and result:
- Legacy purpose from `config.json`: Minter wallet for viewing balances/delegations/history and performing explicit account actions.
- Backend yes/no: **no dpos.space backend service added**. Legacy wallet is a browser/action app using public Minter APIs, shared Minter JS helpers and optional public Minter Hub endpoints for withdrawal metadata. v3 keeps direct client-side wallet actions only after explicit user submit/confirm.
- Static-safe result: dedicated Minter wallet renderer loads address balances, delegations and transactions from public explorer API; exposes send, delegate/unbond, swap/liquidity, hub withdraw, and coin/token actions already covered by v3 broadcast helpers; check/BIP-wallet helper behavior that needs external flows is documented without inventing a service.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/minter/apps/wallet/config.json`, `/root/ai-projects/dpos.space/blockchains/minter/apps/wallet/content.php`, `/root/ai-projects/dpos.space/blockchains/minter/apps/wallet/index.php`, `/root/ai-projects/dpos.space/blockchains/minter/apps/wallet/js/app.js`, wallet CSS/jquery-ui assets, and `wallet/delegation/config.json` + `wallet/delegation/content.php` where linked.
- Shared legacy helpers inspected/classified: `/root/ai-projects/dpos.space/blockchains/minter/js/blockchain.js`, `/root/ai-projects/dpos.space/blockchains/minter/js/modal-accounts.js`, and vendored Minter SDK/wallet/sjcl libraries for seed/auth/broadcast compatibility.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing `tests/v3-minter-wallet-smoke.js`, `tests/v3-minter-decimal-smoke.js`, and `tests/v3-route-coverage-smoke.js`.

Matrix:

| Legacy file/control/helper/data dependency | Exact legacy behavior | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `config.json` | Registers no-category `кошелёк` with Minter wallet description | Minter base apps include `wallet`; route dispatch sends wallet/swap/my-coin to dedicated Minter renderer before generic Cosmos | `tests/v3-minter-wallet-smoke.js` route-dispatch assertions | Implemented |
| `content.php` auth/wallet shell | Shows seed auth warning, address/copy, balances, delegated coins link, transfer/withdraw/convert/delegate modals and history table | `renderMinterWallet`, `renderMinterWalletBalances`, `renderMinterWalletForms` provide accessible sections/forms/tables without jQuery modals | focused smoke checks dedicated root, balances/forms, labels | Implemented static UI |
| `js/app.js loadBalances/getDelegations/getHistory` | Loads balances, delegations and transactions for current Minter address | `loadMinterWalletData` fetches `/addresses/{address}`, `/delegations`, `/transactions?page=1` from public explorer API | focused smoke checks endpoint strings | Implemented public REST |
| Transfer modal + `send(to, value, coin, memo, mode, gasCoin)` | Sends Minter transfer, blocks invalid/seed-like memo patterns | `minter-send-form` maps to `minterTx('SEND')` and checks `global.minterWallet.isValidMnemonic(memo)` before preparing | focused smoke checks form and memo guard | Implemented client-side action |
| Delegate/anbond modals | Delegates and unbonds by public validator key; legacy helper spelling `anbond` maps to unbond | `minter-delegate-form` maps mode to `DELEGATE`/`UNBOND` with public key label | focused smoke checks tx type mapping and label | Implemented client-side action |
| Convert/swap modal | Legacy `convert(coin,to,value,minimum_buy_amount,swap_route,mode,gasCoin)` supports direct and pool swaps | v3 swap route under Minter wallet uses `SELL`/`SELL_SWAP_POOL` and public route inputs | focused smoke checks swap tx mapping | Implemented client-side action |
| Liquidity/create pool helper | Shared `blockchain.js` supports add/remove/create pool payload variants | `minter-liquidity-form` covers add/remove/create with correct `volume1`/`maximumVolume1` naming | route/minter wallet smoke checks form and names | Implemented client-side action |
| Hub withdraw | Legacy calls public Hub metadata and sends to `Mx68f4839d7f32831b9234f9575f3b95e1afe21a56` with memo `{recipient,type:'send_to_<chain>',fee}` | `minter-hub-withdraw-form` preserves target address and memo shape; no private fee service invented | focused smoke checks target and memo type | Implemented static-safe direct send |
| Coin/token operations | Legacy shared helper supports create/recreate coin/token, mint/burn and edit owner | `minter-coin-form` and broadcast helpers expose supported operations including `EDIT_COIN_OWNER`, `MINT_TOKEN`, `BURN_TOKEN` | focused smoke checks operation markers | Implemented client-side action |
| Checks/BIP wallet external flow | Legacy had check/BIP wallet helper flows and external `prepareLink` paths | v3 wallet displays checks guidance instead of faking unsupported external helper flow | focused smoke checks visible `Checks` text and plan evidence | Static-only non-goal for unsupported helper flow |
| Secrets/auth | Legacy stores encrypted seed in localStorage via modal accounts | v3 keeps existing seed-chain auth compatibility and does not expose seed/private key text in wallet UI | focused smoke checks no developer/seed-private-key copy | Enforced |

Validation plan for this app:
- TDD RED observed in this continuation: `node tests/v3-minter-wallet-smoke.js` failed on missing exact `### Rigorous parity: Minter / wallet` plan section before this section was added.
- Focused GREEN target: `node tests/v3-minter-wallet-smoke.js`.
- Mandatory app gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-minter-wallet-smoke.js && git diff --check`.
- Broad smoke loop: `for f in tests/v3-*.js; do node "$f" || exit 1; done`.

Remaining gaps/non-goals:
- No backend service, PHP route, private IP runtime call, `backend.dpos.space`, hidden server API, indexer, daemon, hosted helper application, or newly hosted app is added.
- BIP wallet external `prepareLink`/legacy helper flows and template storage UX are not recreated as hidden services; v3 supports explicit local form inputs and direct prepared transactions.
- Automated tests do not send real transactions; they validate route/source mappings only.

### Rigorous parity: Minter / help

Scope and result:
- Legacy purpose from `config.json`: `Справка по dpos.space`, a Minter no-category help page with video links for dpos.space services and LONG.
- Backend yes/no: **no backend required**. Legacy is PHP-rendered static HTML only; `index.php` contains only the standard no-direct-access guard, and `content.php` returns two YouTube iframes with static copy.
- Static-safe result: v3 registers the `minter/help` route, renders the same intro/caption and both YouTube embed URLs directly in the browser, and does not fetch RPC/API, call PHP, or prepare/broadcast operations.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/minter/apps/help/config.json`, `/root/ai-projects/dpos.space/blockchains/minter/apps/help/content.php`, `/root/ai-projects/dpos.space/blockchains/minter/apps/help/index.php`.
- Legacy linked assets/pages: none; app directory contains only the three files above.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing route/focused Minter tests, and new `tests/v3-minter-help-smoke.js`.

Matrix:

| Legacy file/control/helper/data dependency | Exact legacy behavior | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `config.json` | Registers Minter no-category route `help`, menu label `Справка`, title `Справка по dpos.space` | `v3/js/chains.js` adds `help` to Minter app registry with account field disabled | `tests/v3-minter-help-smoke.js` checks registry includes `help` | Implemented |
| `content.php` intro | Returns `<p>Здесь только видео справка.</p>` and `<h3>Сервисы Minter</h3>` | `renderMinterHelp` preserves intro and service heading in an accessible panel | focused smoke checks exact legacy intro and heading route output | Implemented static |
| `content.php` first iframe | Embeds `https://www.youtube.com/embed/Hk0GYmc_efo` for Minter services help | v3 renders the same iframe URL with descriptive title | focused smoke checks `Hk0GYmc_efo` | Implemented static |
| `content.php` LONG caption/iframe | Shows `Ставим на курс криптовалют и пулов в Minter... LONG` and embeds `https://www.youtube.com/embed/Fl2-6LXfX4k` | v3 preserves caption and iframe URL under a dedicated subsection | focused smoke checks caption and `Fl2-6LXfX4k` | Implemented static |
| `index.php` | Only no-direct-access guard; no server behavior beyond PHP include shell | Static SPA route replaces PHP include; no clean URL/server redirect is recreated | inspected file and focused smoke route render | Static-safe replacement |
| Auth/RPC/broadcast/backend dependencies | None in legacy help app | v3 Minter help uses no fetch, no profile RPC, no broadcast helpers, and no bind operation form | focused smoke stubs fetch/broadcast/RPC as errors and checks isolated runtime slice | Enforced read-only |
| Forbidden runtime dependencies | No private IP/backend/PHP endpoint needed for the help content | v3 runtime slice has no `178.20.43.121`, `backend.dpos.space`, or `.php` strings | focused smoke checks isolated `renderMinterHelp` slice | Enforced |

Validation plan for this app:
- TDD RED observed before implementation: `node tests/v3-minter-help-smoke.js` failed because Minter app registry did not expose `help`.
- Focused GREEN target: `node tests/v3-minter-help-smoke.js`.
- Mandatory app gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-minter-help-smoke.js && git diff --check`.
- Broad smoke loop: `for f in tests/v3-*.js; do node "$f" || exit 1; done`.

Remaining gaps/non-goals:
- No backend service, PHP route, private IP runtime call, `backend.dpos.space`, hidden server API, indexer, daemon, hosted helper application, or newly hosted app is added.
- v3 does not recreate old PHP clean URLs; the static hash route `#chain=minter&app=help` replaces them.
- YouTube availability/privacy mode is not proxied or rehosted; the static page links directly to the same public YouTube embeds as legacy.

### Rigorous parity: Minter / my-coin

Scope and result:
- Legacy purpose from `config.json`: `Моя монета`, a Minter owner/action app for creating/recreating coins or tokens, changing owner, minting tokens, and burning tokens.
- Backend yes/no: **no dpos.space backend service added**. Legacy `content.php` is a static PHP-rendered form shell, and `js/app.js` only populates the burn-token selector from the current address balances via shared public Minter helpers when a seed account exists.
- Static-safe result: v3 routes `minter/my-coin` to the existing dedicated Minter client-side action renderer, keeps coin/token operation forms, prepares direct `minterTx` operations only after explicit submit, and does not add server storage, indexers, private APIs, PHP runtime, or hidden services.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/minter/apps/my-coin/config.json`, `/root/ai-projects/dpos.space/blockchains/minter/apps/my-coin/content.php`, `/root/ai-projects/dpos.space/blockchains/minter/apps/my-coin/index.php`, `/root/ai-projects/dpos.space/blockchains/minter/apps/my-coin/js/app.js`.
- Shared legacy helpers classified from prior Minter wallet pass: `/root/ai-projects/dpos.space/blockchains/minter/js/blockchain.js`, modal account helpers, and vendored Minter SDK/wallet/sjcl. This app depends on browser seed auth and direct Minter transaction helpers, not a dpos.space backend.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing `tests/v3-minter-wallet-smoke.js`, and new `tests/v3-minter-my-coin-smoke.js`.

Matrix:

| Legacy file/control/helper/data dependency | Exact legacy behavior | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `config.json` | Registers no-category `my-coin` with menu label `Моя монета` | `v3/js/chains.js` includes `my-coin` under Minter apps; route dispatch sends it to Minter action renderer | `tests/v3-minter-my-coin-smoke.js` checks registry and dispatch | Implemented |
| `content.php` auth notice | Shows seed authorization warning and says coin management requires creator ownership | v3 relies on shared saved-account/key status and prepares operations only through explicit seed-chain broadcast flow | focused smoke checks direct client-side `broadcast.prepare(... 'seed', 'minterTx' ...)` | Implemented static-safe action |
| `content.php` create/recreate form | `createCoin(this.form.type.value, this.form.name.value, this.form.symbol.value, parseFloat(this.form.initialAmount.value), parseFloat(this.form.maxSupply.value), ...)` for `CREATE_COIN`, `RECREATE_COIN`, `CREATE_TOKEN`, `RECREATE_TOKEN` | `minter-coin-form` has mode/name/symbol/amount/max/CRR/reserve inputs; binder maps create/recreate coin/token to `minterTx` payloads | focused smoke checks operation markers and payload branches | Implemented |
| `content.php` edit owner form | `editCoinOwner(this.form.symbol.value, this.form.newOwner.value)` | `EDIT_COIN_OWNER` mode validates Minter address and prepares owner-change tx | focused smoke checks mode and `minter-coin-new-owner` | Implemented |
| `content.php` mint token form | `mintToken(this.form.coin.value, parseFloat(this.form.amount.value))` | `MINT_TOKEN` mode maps `{ coin, value }` to direct Minter tx | focused smoke checks explicit mint/burn branch | Implemented |
| `content.php` burn token form | Token selector populated from balances, then `burnToken(this.form.token.value, parseFloat(this.form.amount.value))` | v3 keeps manual symbol/amount input for static-safe operation preview/send; balance auto-fill is not required for transaction correctness | focused smoke checks `BURN_TOKEN` mode and accessible result region | Implemented static-safe |
| `js/app.js loadBalances` | Calls shared `getBalance(sender.address)` and jQuery-populates token dropdown for token balances only | v3 Minter wallet renderer already loads public balances; my-coin action form avoids jQuery and does not require server state | inspected legacy JS; focused smoke ensures no hidden `fetch` in action slice | Static-safe replacement |
| Forbidden runtime dependencies | Legacy my-coin is browser/action code, no private backend endpoint found | v3 my-coin action slice has no `178.20.43.121`, `backend.dpos.space`, `.php`, hidden fetch service, or server helper | focused smoke checks isolated runtime slice | Enforced |

Validation plan for this app:
- TDD RED observed before implementation/plan update: `node tests/v3-minter-my-coin-smoke.js` failed before the exact `### Rigorous parity: Minter / my-coin` evidence section and before explicit mint/burn payload branching.
- Focused GREEN target: `node tests/v3-minter-my-coin-smoke.js`.
- Mandatory app gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-minter-my-coin-smoke.js && git diff --check`.
- Broad smoke loop: `for f in tests/v3-*.js; do node "$f" || exit 1; done`.

Remaining gaps/non-goals:
- No backend service, PHP route, private IP runtime call, `backend.dpos.space`, hidden server API, indexer, daemon, hosted helper application, or newly hosted app is added.
- Legacy jQuery dropdown auto-population for burnable token balances is not recreated as a separate service; users provide the token symbol/amount in a static-safe form, while wallet balances remain visible in the same Minter renderer.
- Automated tests do not send real Minter transactions; they validate source/route mappings and operation preparation only.

### Rigorous parity: Minter / profiles

Scope and result:
- Legacy purpose from `config.json`: `Просмотр профилей`, a read-only Minter address/profile viewer for an `Mx...` address.
- Backend yes/no: **no dpos.space backend service added**. Legacy is PHP-rendered but its profile JS uses public Minter explorer REST, public Etherscan/BscScan tokenbalance APIs, and Minter SDK nonce lookup; no private server state is required for the covered profile view.
- Static-safe result: v3 keeps Minter profiles under the shared `profiles` app route, fetches balances/delegations/transactions/rewards from public Minter explorer REST, preserves HUB-in-Ethereum/BSC public token lookups, exposes nonce with an accessible copy button, and remains read-only with no transaction prepare/broadcast behavior.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/minter/apps/profiles/config.json`, `/root/ai-projects/dpos.space/blockchains/minter/apps/profiles/content.php`, `/root/ai-projects/dpos.space/blockchains/minter/apps/profiles/index.php`, `/root/ai-projects/dpos.space/blockchains/minter/apps/profiles/page/config.json`, `/root/ai-projects/dpos.space/blockchains/minter/apps/profiles/page/content.php`, `/root/ai-projects/dpos.space/blockchains/minter/apps/profiles/js/app.js`.
- Shared legacy helpers inspected/classified: `/root/ai-projects/dpos.space/blockchains/minter/js/blockchain.js` (`getBalance`, `minter.getNonce`, broadcast helpers) and `/root/ai-projects/dpos.space/blockchains/minter/js/modal-accounts.js` (auth/BIP helper) only to classify auth/ajax/RPC/API/broadcast dependencies.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing Minter smoke tests, and new `tests/v3-minter-profiles-smoke.js`.

Matrix:

| Legacy file/control/helper/data dependency | Exact legacy behavior | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `config.json` | Registers `Просмотр профилей`, menu label `Профили`, no-category app | Shared base `profiles` app remains registered for all chains and Minter inherits it without duplicate minterApps entry | `tests/v3-minter-profiles-smoke.js` checks base app and inherited Minter route | Implemented |
| `content.php` lookup form | Prompts for any Minter address, hidden `chain=minter`, `service=profiles`, text input named `user` | v3 global account/address field with `accountField: true` drives `#chain=minter&app=profiles&account=...` | route coverage and focused smoke check account field/dispatch | Implemented static SPA form |
| `index.php` page routing | Strips `@`, loads `page/content.php`, sets page title/description for selected address | `renderProfileRoute` fetches selected account/address and renders profile panel; static hash route replaces PHP clean URL | focused smoke checks `profiles.fetchAccount` and `profiles.normalizeAccount` | Static-safe replacement |
| `page/content.php` balances block | Renders `Балансы` list populated by JS `getBalance(address)` | `fetchMinterAccount` calls public explorer address endpoint; `normalizeRestBalances` and `detailsSection('Балансы')` render balances | focused smoke checks `/addresses/${encodeURIComponent(address)}` and balance rendering path | Implemented public REST |
| `js/app.js` HUB in other chains | Converts `Mx...` to `0x...` and calls Etherscan/BscScan public tokenbalance APIs for HUB contract balances | `fetchMinterHubBalances` calls Etherscan/BscScan public tokenbalance APIs for the same HUB contracts and adds `HUB в Ethereum` / `HUB в BSC` REST rows | focused smoke checks Etherscan/BscScan hosts and both contract addresses | Implemented public APIs |
| `js/app.js` rewards | Calls `https://explorer-api.minter.network/api/v2/addresses/{address}/statistics/rewards?start_time=...&end_time=...` for yesterday rewards | `fetchMinterAccount` keeps the same public rewards endpoint and `rawListSection('Rewards из API')` renders returned rows | focused smoke checks `/statistics/rewards?start_time=` and rewards section | Implemented public REST |
| `js/app.js` nonce + `copy_nonce` | Calls `minter.getNonce(address)`, displays `NONCE (для создания транзакций)`, and copies nonce to clipboard | v3 reads nonce/tx_count from public REST account data and renders `copy-minter-nonce` with `role="status" aria-live="polite"`; it uses `navigator.clipboard.writeText` only | focused smoke checks `copy_nonce` evidence, copy button, live status, and clipboard API | Implemented static UI |
| `js/app.js getHistory(page)` | Calls public explorer transactions endpoint and renders date/block/hash/type/amount/memo table with pagination links | v3 profile fetches first transactions page and renders accessible `Последние транзакции из API` table with explorer links through existing history helpers | focused smoke checks `/transactions?page=1` and transaction table | Implemented first-page public REST |
| Shared `blockchain.js` broadcast helpers | File contains seed auth and broadcast helpers, but profiles only uses `getBalance`/nonce/read APIs | Minter profiles is read-only: no `broadcast.prepare`, no `broadcast.broadcast`, no `bindOperationForm` in renderer | focused smoke checks no broadcast markers in profile render slice | Enforced read-only |
| Forbidden runtime dependencies | No private IP/backend/PHP endpoint is needed for profile data; legacy PHP only wraps static content | v3 runtime uses public REST/API hosts only and has no `178.20.43.121`, `backend.dpos.space`, `.php`, hidden server API, secret, or token dependency in focused slices | focused smoke checks forbidden strings | Enforced |

Validation plan for this app:
- TDD RED observed before implementation/plan update: `node tests/v3-minter-profiles-smoke.js` failed on missing Etherscan/BscScan HUB lookup coverage and missing exact `### Rigorous parity: Minter / profiles` plan section.
- Focused GREEN target: `node tests/v3-minter-profiles-smoke.js`.
- Mandatory app gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-minter-profiles-smoke.js && git diff --check`.
- Broad smoke loop: `for f in tests/v3-*.js; do node "$f" || exit 1; done`.

Remaining gaps/non-goals:
- No backend service, PHP route, private IP runtime call, `backend.dpos.space`, hidden server API, indexer, daemon, hosted helper application, or newly hosted app is added.
- v3 does not recreate PHP clean URLs or jQuery pagination controls; the static SPA hash route and first public transactions page replace them, while broader history remains available via the generic history route.
- If public Etherscan/BscScan/Minter explorer APIs are unavailable or rate-limited, v3 surfaces missing/empty optional data instead of adding a proxy or hidden service.

### Rigorous parity: Minter / randomblockchain

Scope and result:
- Legacy purpose from `config.json`: `Генератор случайных чисел`, a read-only random-number generator using two Minter block hashes and participant count/list.
- Backend yes/no: **no backend service added**. Legacy `content.php` is PHP-rendered form/page switching, but the runtime data dependency is public Minter node API `https://api.minter.one/v2/block/{height}` via axios defaults; no private backend or storage is required.
- Static-safe result: v3 keeps the `minter/randomblockchain` route, preserves the form fields and Minter article/repository links, fetches public block hashes directly from the browser, computes `block_hash_1 + block_hash_2` modulo participant count locally, and remains read-only.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/minter/apps/randomblockchain/config.json`, `/root/ai-projects/dpos.space/blockchains/minter/apps/randomblockchain/content.php`, `/root/ai-projects/dpos.space/blockchains/minter/apps/randomblockchain/js/app.js`.
- Legacy linked/shared helpers inspected/classified: `/root/ai-projects/dpos.space/blockchains/minter/js/blockchain.js` and `/root/ai-projects/dpos.space/blockchains/minter/js/modal-accounts.js` only to confirm randomblockchain does not use auth, seed storage, or broadcast helpers.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing social randomblockchain smoke tests, and new `tests/v3-minter-randomblockchain-smoke.js`.

Matrix:

| Legacy file/control/helper/data dependency | Exact legacy behavior | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `config.json` | Registers Minter `randomblockchain`, menu `ГСЧ`, title `Генератор случайных чисел` | `v3/js/chains.js` includes Minter app `randomblockchain` and route dispatch calls `renderRandomBlockchain` | `tests/v3-minter-randomblockchain-smoke.js` checks registry and dispatch | Implemented |
| `content.php` empty-query form | Shows labels for `block1`, `block2`, `participants`, `data_list`, and submit `Сгенерировать` | v3 renders accessible `randomblockchain-form` with the same labels/prompts and status region | focused smoke checks label text and `role="status" aria-live="polite"` | Implemented static form |
| `content.php` result page | Reads GET params, shows start/end block explorer links, participants count, hidden `data_list`, hash textareas, calculate button, hash/result/member fields | v3 keeps one static form/result panel: the submitted data is handled client-side, result shows lucky number, optional winner, and raw calculation details | focused smoke checks calculate label and data-list handling markers | Static SPA replacement |
| Legacy article/repository links | Links to `https://mcorp.space/post/65` and `https://github.com/denis-skripnik/minter_random` | v3 shows the same Minter-specific links when `chain.id === 'minter'` | focused smoke checks both URLs | Implemented |
| `js/app.js blocksData` | Sets axios base `https://api.minter.one/v2`, calls `/block/{start}` and `/block/{end}`, fills `sig1`/`sig2` from `response.data.hash` | `fetchMinterRandomBlock` calls `${chain.apiBase}/block/${encodeURIComponent(text)}` and `blockRandomSeed` uses `block.hash` for Minter | focused smoke checks `/block/${encodeURIComponent(text)}`, `block.hash`, and plan public API evidence `https://api.minter.one/v2/block/` | Implemented public API |
| `js/app.js calculate` | Concatenates two hex hashes, computes `bigInt(h,16).mod(participants)`, shows `parseInt(d.value)+1`, and uses `data_list` lines as winner list when present | `hashRandomBlockchainSeeds` uses `BigInt(0x${hex}) % BigInt(modulo)` and `random.value + 1`; list length overrides participant count and winner is rendered | focused smoke checks modulo expression and Minter algorithm label | Implemented local calculation |
| Multi-digit block numbers | Legacy GET form accepts normal block heights, not single digits only | v3 route now accepts `/^\d+$/` block-number input before fetching | focused smoke checks multi-digit regex | Fixed |
| Auth/broadcast/backend dependencies | Minter randomblockchain is read-only; it does not use shared seed/auth/broadcast helpers | v3 randomblockchain renderer does not call `broadcast.prepare`, `broadcast.broadcast`, or `bindOperationForm` | focused smoke checks isolated render slice | Minter randomblockchain is read-only |
| Forbidden runtime dependencies | Legacy uses public `api.minter.one` only for block data; no private IP/backend/PHP endpoint is required for runtime | v3 focused slices have no `178.20.43.121`, `backend.dpos.space`, `.php`, hidden server API, secret, or token dependency | focused smoke checks forbidden strings | Enforced |

Validation plan for this app:
- TDD RED observed before implementation/plan update: `node tests/v3-minter-randomblockchain-smoke.js` failed because Minter randomblockchain lacked dedicated Minter public block/hash handling and exact plan coverage.
- Focused GREEN target: `node tests/v3-minter-randomblockchain-smoke.js`.
- Mandatory app gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-minter-randomblockchain-smoke.js && git diff --check`.
- Broad smoke loop: `for f in tests/v3-*.js; do node "$f" || exit 1; done`.

Remaining gaps/non-goals:
- No backend service, PHP route, private IP runtime call, `backend.dpos.space`, hidden server API, indexer, daemon, hosted helper application, or newly hosted app is added.
- v3 does not recreate PHP clean URLs or GET result pages; the static SPA form/result panel replaces them.
- If public Minter block API is unavailable/CORS-blocked, v3 surfaces the error instead of adding a proxy or hidden service.

### Rigorous parity: Minter / swap

Scope and result:
- Legacy purpose from `config.json`: `Minter swap - сервис, позволяющий обменивать токены через пулы ликвидности и добавлять в них активы`, menu label `Swap`.
- Backend yes/no: **no backend service added**. Legacy runtime is a PHP-rendered form plus browser JavaScript that uses seed-auth wallet operations, public `https://explorer-api.minter.network/api/v2/pools/...` endpoints, Minter SDK estimation, and direct Minter tx helpers from shared `blockchain.js`; no private dpos.space backend is needed for the static-safe operation subset.
- Static-safe result: v3 keeps Minter `/swap` routed to the Minter-specific wallet/action renderer, preserves direct client-side SELL/SELL_SWAP_POOL swap payloads and ADD_LIQUIDITY/REMOVE_LIQUIDITY/CREATE_SWAP_POOL payloads, exposes accessible forms/status regions, and documents that legacy auto-quote/autocomplete/provider-pool listing must be filled manually rather than recreated through a proxy/service.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/minter/apps/swap/config.json`, `/root/ai-projects/dpos.space/blockchains/minter/apps/swap/content.php`, `/root/ai-projects/dpos.space/blockchains/minter/apps/swap/js/app.js`.
- Legacy shared helpers inspected/classified: `/root/ai-projects/dpos.space/blockchains/minter/js/blockchain.js` and `/root/ai-projects/dpos.space/blockchains/minter/js/modal-accounts.js` only to classify seed auth, Minter SDK calls, public API usage, and direct broadcast helpers.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing Minter smoke tests, and new `tests/v3-minter-swap-smoke.js`.

Matrix:

| Legacy file/control/helper/data dependency | Exact legacy behavior | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `config.json` | Registers Minter `swap`, title/menu `Swap`, no-category app | `v3/js/chains.js` includes Minter app `swap` with `Обмен монет и операции swap-pool` and route dispatch treats it as a Minter-specific action page | `tests/v3-minter-swap-smoke.js` checks registry and dispatch | Implemented |
| `content.php` auth notice | Shows message requiring seed auth before using Minter swap | v3 action renderer shows key status and uses browser-stored account/seed only through `bindOperationForm`/`broadcast.prepare`; no seed is printed in preview/results | wallet/swap renderer and existing broadcast tests cover safe prepare flow | Implemented client-side wallet flow |
| `content.php` `Обмен` tab | Token select, conversion amount, receive coin, fee, buy amount, route, and `Обменять` button | v3 `minter-swap-form` exposes sell coin, buy coin, sell amount, minimum buy amount, optional swap-pool route, preview/send buttons, and `role="status" aria-live="polite"` result | focused smoke checks all form markers | Implemented static-safe explicit form |
| `js/app.js getConvertPrice` | Calls public explorer route endpoint `/api/v2/pools/coins/{coin}/{to}/route?amount=...&type=input`, then Minter SDK estimate/fee helpers | v3 documents the public endpoint as evidence and keeps explicit min/route inputs instead of adding a quote proxy or hidden helper | focused smoke checks endpoint note and explicit route/min inputs | Static-safe manual replacement |
| `js/app.js convert click` | Confirms and broadcasts direct `convert`/Minter sell operation with optional route and gas coin | `bindMinterWalletForms` builds `SELL` for plain swap and `SELL_SWAP_POOL` for route, with `coinToSell`, `coinToBuy`, `valueToSell`, `minimumValueToBuy`, or `coins` route payload | focused smoke checks tx type branching and payload fields | Implemented direct wallet broadcast |
| `content.php` `Вложить` tab | Add liquidity form for token1/token2, pool amount inputs, fee, create-new-pool notice | v3 `minter-liquidity-form` exposes ADD_LIQUIDITY, CREATE_SWAP_POOL and coin/volume/gas fields with preview/send buttons | focused smoke checks liquidity form markers and tx payload names | Implemented direct wallet broadcast |
| `js/app.js remove liquidity modal` | Lists provider pools from public `/api/v2/pools/providers/{address}` and opens modal to remove selected liquidity | v3 does not auto-list provider pools, but preserves explicit `REMOVE_LIQUIDITY` form where user enters pair and liquidity amount | focused smoke checks provider endpoint documentation and remove-liquidity mode | Static-safe manual replacement |
| Public coin autocomplete | Legacy calls public `/api/v2/coins` to populate jQuery UI autocomplete | v3 does not recreate jQuery autocomplete; user types coin symbols directly in labelled inputs | focused smoke checks explicit field labels; documented non-goal | Static-only non-goal |
| Shared `blockchain.js` helpers | Swap uses direct signed Minter operations (`convert`, `addToPool`, `removeFromPool`) from browser seed auth | v3 uses `broadcast.prepare(chain, 'seed', 'minterTx', ...)`; no server-side operation service is added | focused smoke checks `broadcast.prepare` in Minter bind slice | Implemented |
| Forbidden runtime dependencies | Legacy PHP only renders the page; runtime data sources are public Minter APIs and wallet SDK helpers, not private IP/backend.dpos.space | v3 focused slices have no `178.20.43.121`, `backend.dpos.space`, `ajax.php`, PHP endpoint/runtime dependency, hidden server API, secret, or token | focused smoke checks forbidden markers in isolated slices | Enforced |

Validation plan for this app:
- TDD RED observed before implementation/plan update: `node tests/v3-minter-swap-smoke.js` failed because the Minter swap page lacked explicit legacy public route/provider endpoint documentation and the exact `### Rigorous parity: Minter / swap` plan section.
- Focused GREEN target: `node tests/v3-minter-swap-smoke.js`.
- Mandatory app gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-minter-swap-smoke.js && git diff --check`.
- Broad smoke loop: `for f in tests/v3-*.js; do node "$f" || exit 1; done`.

Remaining gaps/non-goals:
- Static-only non-goals: no backend service, PHP route/runtime, private IP runtime call, `backend.dpos.space`, hidden server API, indexer, daemon, hosted helper application, newly hosted app, proxy for explorer APIs, or server-side quote service is added.
- v3 does not recreate the jQuery tabs/autocomplete, automatic buy-amount/fee quote, automatic provider-pool table, or modal UX. Users provide minimum buy amount, optional route, and liquidity amount explicitly in the static wallet forms.
- If public Minter explorer APIs or wallet SDK estimation are unavailable, v3 does not add a fallback backend; explicit form submission/preview remains browser-only.

### Rigorous parity: Minter / validators

Scope and result:
- Legacy purpose from `config.json`: `Список валидаторов Minter`, menu label/title `Валидаторы`.
- Backend yes/no: **no backend service added**. Legacy `content.php` is PHP-rendered but fetches only public `https://explorer-api.minter.network/api/v2/validators`; no private backend, storage, indexer, seed auth, or broadcast is required for the validators list.
- Static-safe result: v3 keeps the Minter `validators` route, reads the same public explorer validators endpoint, sorts by descending stake, separates status `2` active validators from status `1` candidates, preserves public key/name/icon/site/stake/min-stake/commission display, and adds accessible key-copy status without adding PHP/backend runtime.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/minter/apps/validators/config.json`, `/root/ai-projects/dpos.space/blockchains/minter/apps/validators/content.php`; no `js/app.js` exists for this app.
- Legacy shared helpers inspected/classified: `/root/ai-projects/dpos.space/blockchains/minter/js/blockchain.js` and `/root/ai-projects/dpos.space/blockchains/minter/js/modal-accounts.js` only to confirm validators does not need seed auth or broadcast helpers.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing Minter smoke tests, and new `tests/v3-minter-validators-smoke.js`.

Matrix:

| Legacy file/control/helper/data dependency | Exact legacy behavior | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `config.json` | Registers `validators`, title/menu `Валидаторы`, no-category app | `v3/js/chains.js` includes Minter app `validators` with legacy purpose preserved | `tests/v3-minter-validators-smoke.js` checks registry | Implemented |
| `content.php` public fetch | `file_get_contents('https://explorer-api.minter.network/api/v2/validators')` and decodes `data` | `renderCosmosValidators` uses `${chain.explorerBase}/validators` for Minter | focused smoke checks exact public endpoint expression and plan evidence URL | Implemented public API |
| `cmp_function_desc` | Sorts validators descending by `stake` | v3 sorts `(data.data/result/validators).slice()` by `Number(b.stake || b.power || 0) - Number(a.stake || a.power || 0)` | focused smoke checks sort expression | Implemented |
| Status grouping | Builds separate sections: `Активные валидаторы` for status `2`, `Кандидаты` for status `1` | v3 filters status `2` and status `1` into separate accessible table sections | focused smoke checks both headings and status filters | Implemented |
| Table columns | Shows number, public key, name/site/icon, stake with `Мин.`, and commission percent | v3 table preserves `Публичный ключ`, `Название`, `Stake`, `Мин.`, `Комиссия`, `icon_url`, `site_url` | focused smoke checks column/field markers | Implemented |
| `copyText` button | Copies each validator public key from readonly input | v3 renders `copy-validator-key` buttons and `navigator.clipboard.writeText` with `role="status" aria-live="polite"` feedback | focused smoke checks copy/status markers | Implemented browser-only copy |
| Delegation/action behavior | Legacy validators page is read-only; action forms are elsewhere | v3 validators renderer has no `broadcast.prepare`/`bindOperationForm`; delegation remains in wallet/send sections | focused smoke checks isolated renderer slice | Enforced read-only |
| Forbidden runtime dependencies | Legacy PHP only renders public API result; no private IP/backend.dpos.space/PHP endpoint is required in browser runtime | v3 renderer slice has no `178.20.43.121`, `backend.dpos.space`, `ajax.php`, `content.php`, `index.php`, hidden server API, secret, or token | focused smoke checks forbidden markers | Enforced |

Validation plan for this app:
- TDD RED observed before implementation/plan update: `node tests/v3-minter-validators-smoke.js` failed because the generic validators renderer did not preserve Minter active/candidate grouping, table/copy markers, and exact `### Rigorous parity: Minter / validators` plan section.
- Focused GREEN target: `node tests/v3-minter-validators-smoke.js`.
- Mandatory app gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-minter-validators-smoke.js && git diff --check`.
- Broad smoke loop: `for f in tests/v3-*.js; do node "$f" || exit 1; done`.

Remaining gaps/non-goals:
- Static-only non-goals: no backend service, PHP route/runtime, private IP runtime call, `backend.dpos.space`, hidden server API, indexer, daemon, hosted helper application, newly hosted app, proxy, server-side cache, or validator-list backend is added.
- v3 does not recreate PHP anchors/readonly input markup exactly; accessible tables plus copy buttons replace them.
- If the public Minter explorer validators API is unavailable/CORS-blocked, v3 surfaces the error instead of adding a fallback backend.

### Rigorous parity: Minter / broadcast

Scope and result:
- Legacy purpose from `config.json`: `Minter Broadcast - сервис, позволяющий отправлять готовые транзакции с просмотром информации по ним перед отправкой`, category `tools`.
- Backend yes/no: **no backend service added**. Legacy `content.php` only renders forms; `js/app.js` uses browser Minter SDK methods (`decodeTx`, `postSignedTx`, `postTx`, `getNonce`) and no private dpos.space backend, PHP endpoint, storage, indexer, or hidden API.
- Static-safe result: v3 keeps the shared `broadcast` app route for Minter with a dedicated `renderMinterBroadcast` renderer: signed TX can be decoded/previewed then submitted as an external prepared operation, and multisig JSON/signatures are accepted as external submit data after client-side address/JSON/signature validation.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/minter/apps/broadcast/config.json`, `/root/ai-projects/dpos.space/blockchains/minter/apps/broadcast/content.php`, `/root/ai-projects/dpos.space/blockchains/minter/apps/broadcast/index.php`, `/root/ai-projects/dpos.space/blockchains/minter/apps/broadcast/js/app.js`.
- Legacy shared helpers inspected/classified: `/root/ai-projects/dpos.space/blockchains/minter/js/blockchain.js` and `/root/ai-projects/dpos.space/blockchains/minter/js/modal-accounts.js` only to confirm the broadcast page uses public/client Minter SDK helpers, not server services.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing Minter smoke tests, and new `tests/v3-minter-broadcast-smoke.js`.

Matrix:

| Legacy file/control/helper/data dependency | Exact legacy behavior | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `config.json` | Registers Broadcast in tools category with ready-transaction submit purpose | `broadcast` is available from `baseApps`; Minter route dispatches `renderMinterBroadcast(chain)` before generic broadcast | `tests/v3-minter-broadcast-smoke.js` checks base app and dedicated Minter dispatch | Implemented |
| `content.php` signed tx form | Input `tx`, hidden `results`, button `submit_broadcast` (`Отправить в сеть`) | `minter-signed-tx-form` has labelled signed TX textarea, preview/send buttons, and accessible `operation-result` status | focused smoke checks form/status markers | Implemented |
| `js/app.js decodeTx` | On tx change, runs `minterSDK.decodeTx`, renders decoded tx contents, and enables submit | v3 calls `global.minterSDK.decodeTx(tx)` when available and adds sanitized decoded tx summary to external prepare warnings | focused smoke checks `minterSDK.decodeTx` and `Расшифрованная транзакция` | Implemented preview evidence |
| `js/app.js postSignedTx` | Confirms, calls `minter.postSignedTx(tx)`, then shows explorer tx link | v3 uses `broadcast.prepareExternal(chain, 'minterSignedTx', [{ tx }], ...)`; generic confirmed broadcast flow sends external prepared operation without exposing seed | focused smoke checks `broadcast.prepareExternal(chain, 'minterSignedTx'` | Implemented external broadcast path |
| `content.php` multisig form | Multisig address, JSON tx textarea, one signature input with dynamic list, submit button | v3 `minter-multisig-form` exposes multisig address, JSON transaction textarea, newline-separated signatures textarea, preview/send buttons, and status region | focused smoke checks multisig fields | Implemented static form |
| `js/app.js add/updateText` | Adds unique signatures to client-side list | v3 accepts signatures as newline-separated text, trims/filter empties, and validates `signatures.length` before prepare | focused smoke checks signature validation | Implemented simpler static UX |
| `js/app.js submitMultisigTX` | Parses JSON, confirms, gets nonce for multisig address, sets `signatureType = 2`, adds `signatureData.multisig/signatures`, then calls `minter.postTx` | v3 validates multisig address and JSON locally, then prepares external `minterMultisigSubmit` payload `{ multisig, tx, signatures }` for the broadcast layer. The mutation/signing/submission stays client-side; no server helper is added | focused smoke checks `parseJsonInput`, address validation, and `minterMultisigSubmit` | Implemented static-safe external submit |
| Auth/seed behavior | Signed TX and multisig external submit do not need stored seed in the old page | v3 renderer does not call `broadcast.prepare(chain, 'seed', ...)`; it uses `prepareExternal` | focused smoke checks no seed prepare in isolated renderer | Enforced |
| Forbidden runtime dependencies | Legacy PHP only renders forms; runtime uses client Minter SDK calls and public node/explorer behavior | v3 renderer slice has no `178.20.43.121`, `backend.dpos.space`, `ajax.php`, `content.php`, `index.php`, hidden server API, secret, or token | focused smoke checks forbidden markers | Enforced |

Validation plan for this app:
- TDD RED observed before implementation/plan update: `node tests/v3-minter-broadcast-smoke.js` failed because the exact `### Rigorous parity: Minter / broadcast` plan section was missing; existing runtime was then verified against focused legacy markers.
- Focused GREEN target: `node tests/v3-minter-broadcast-smoke.js`.
- Mandatory app gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-minter-broadcast-smoke.js && git diff --check`.
- Broad smoke loop: `for f in tests/v3-*.js; do node "$f" || exit 1; done`.

Remaining gaps/non-goals:
- Static-only non-goals: no backend service, PHP route/runtime, private IP runtime call, `backend.dpos.space`, hidden server API, indexer, daemon, hosted helper application, newly hosted app, server-side tx decoder, or multisig coordination service is added.
- v3 does not recreate jQuery/fancybox UI, one-by-one signature list buttons, or exact old explorer link markup; accessible textareas and the shared confirmed broadcast result UI replace them.
- If Minter SDK decode/submission helpers are unavailable in the browser, v3 surfaces the error instead of adding a backend proxy.

### Rigorous parity: Decimal / validators

Scope and result:
- Legacy purpose from `config.json`: `Список валидаторов Decimal`, menu label/title `Валидаторы`.
- Backend yes/no: **no backend service added**. Legacy `content.php` is PHP-rendered, but it only fetches the public `https://api.decimalchain.com/api/v1/validators/validators` endpoint and formats the response; no private backend, indexer, stored account, seed auth, or broadcast is required for the validators list.
- Static-safe result: v3 keeps the Decimal `validators` route, reads the same public Decimal validators endpoint directly from the browser, sorts validators by big integer `stake`, separates `kind === 'Approved'` active validators from candidates, preserves address/name/stake/min-stake/fee/skipped-blocks display, and adds accessible copy feedback without adding PHP/backend runtime.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/decimal/apps/validators/config.json`, `/root/ai-projects/dpos.space/blockchains/decimal/apps/validators/content.php`, `/root/ai-projects/dpos.space/blockchains/decimal/apps/validators/index.php`.
- Legacy shared Decimal files inspected/classified: `/root/ai-projects/dpos.space/blockchains/decimal/config.json`, `/root/ai-projects/dpos.space/blockchains/decimal/content.html`, `/root/ai-projects/dpos.space/blockchains/decimal/index.html`, `/root/ai-projects/dpos.space/blockchains/decimal/js/blockchain.js`, `/root/ai-projects/dpos.space/blockchains/decimal/js/modal-accounts.js`, `/root/ai-projects/dpos.space/blockchains/decimal/js/decimal-sdk-web.js` only as needed to classify auth/RPC/broadcast dependencies.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing `tests/v3-*.js`, and new `tests/v3-decimal-validators-smoke.js`.

Matrix:

| Legacy file/control/helper/data dependency | Exact legacy behavior | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `config.json` | Registers `validators`, title/menu `Валидаторы`, no-category app | `v3/js/chains.js` includes Decimal app `validators` with legacy purpose preserved | `tests/v3-decimal-validators-smoke.js` checks Decimal registry | Implemented |
| `content.php` public fetch | Calls `fetch_all_validators('https://api.decimalchain.com/api/v1/validators/validators', 200)` with paged `limit/offset`, reads `Result.validators` and `Result.count` | `renderCosmosValidators` uses `${chain.apiBase}/validators/validators` for Decimal, reads `Result/result/data.validators` | focused smoke checks exact endpoint expression and `Result` evidence | Implemented public API |
| `cmp_function_desc` | Sorts validators descending by string/big-integer `stake` | `sortDecimalValidatorsByStake` and `compareDecimalStakeDesc` sort stake strings without lossy `Number()` conversion | focused smoke checks helper marker | Implemented |
| Status grouping | `kind === 'Approved'` goes to `Активные валидаторы`; everything else becomes `Кандидаты` | Decimal branch filters `kind === 'Approved'` and `kind !== 'Approved'` into separate tables | focused smoke checks both filters/headings | Implemented |
| Table columns | Shows number/status, `evmAddress` copy input/button, moniker, `stake DEL (Мин. mins)`, fee percent, and `skippedBlocks` | v3 shows `Адрес`, `Название`, `Stake`, `Мин.`, `Комиссия`, `Пропущено блоков`, copy buttons, and DEL-formatted 1e18 amounts | focused smoke checks UI/data markers | Implemented |
| `wei18_to_del` | Formats 1e18 integer strings to DEL with limited precision | `formatDecimalAmount` handles long digit strings with BigInt and 18-decimal scaling; regex fixed to accept multi-digit raw values | focused smoke checks `formatDecimalAmount` in validators slice | Implemented |
| `copyText` button | Copies each validator address from readonly input | v3 renders `copy-validator-key` buttons and `navigator.clipboard.writeText` with `role="status" aria-live="polite"` feedback | focused smoke checks copy/status markers | Implemented browser-only copy |
| Delegation/action behavior | Legacy validators page is read-only; Decimal SDK/broadcast helpers are shared for wallet pages | v3 validators renderer has no `broadcast.prepare` or `bindOperationForm`; delegation/unbond remains in wallet/send sections with explicit user authorization | focused smoke checks isolated renderer slice | Enforced read-only |
| Forbidden runtime dependencies | Legacy PHP renders public API output; no private IP/backend.dpos.space/PHP endpoint is required in browser runtime | v3 renderer slice has no `178.20.43.121`, `backend.dpos.space`, `ajax.php`, `content.php`, `index.php`, hidden server API, secret, token, indexer, daemon, or hosted helper app | focused smoke checks forbidden markers | Enforced |

Validation results for this app:
- TDD RED observed before implementation/plan update: `node tests/v3-decimal-validators-smoke.js` failed because the generic validators renderer did not use `${chain.apiBase}/validators/validators`, did not preserve Decimal `Result`/`kind`/`evmAddress`/`skippedBlocks` behavior, and the exact `### Rigorous parity: Decimal / validators` plan section was missing.
- Focused GREEN target: `node tests/v3-decimal-validators-smoke.js`.
- Mandatory app gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-decimal-validators-smoke.js && git diff --check`.
- Broad smoke loop: `for f in tests/v3-*.js; do node "$f" || exit 1; done`.
- Final checkpoint gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && for f in tests/v3-decimal-*-smoke.js; do node "$f" || exit 1; done && for f in tests/v3-*.js; do node "$f" || exit 1; done && git diff --check`.

Remaining gaps/non-goals:
- Static-only non-goals: no backend service, PHP route/runtime, private IP runtime call, `backend.dpos.space`, hidden server API, indexer, daemon, hosted helper application, newly hosted app, proxy, server-side cache, or validator-list backend is added.
- v3 does not recreate PHP anchors/readonly input markup exactly; accessible tables plus copy buttons replace them.
- If the public Decimal validators API is unavailable/CORS-blocked, v3 surfaces the error instead of adding a fallback backend.

Next app recommendation: Decimal / explorer.

### Rigorous parity: Decimal / explorer

Scope and result:
- Legacy purpose from `config.json`: `Блок-эксплорер`, description `block explorer (просмотр блоков) в Decimal`, menu label `Explorer`.
- Backend yes/no: **no backend service added**. Legacy explorer PHP performed server-side `file_get_contents`/cURL against public Decimal endpoints; v3 replaces the PHP runtime with direct browser public API calls through the configured `https://api.decimalchain.com/api/v1` base.
- Static-safe result: v3 keeps the Decimal `explorer` route, shows an accessible address/tx/block form, loads overview sections for `Последние блоки` and `Статус`, opens block/tx/address details, and keeps raw JSON details for audit without private IPs, PHP endpoints, backend.dpos.space, indexers, or hidden helper services.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/decimal/apps/explorer/config.json`, `/root/ai-projects/dpos.space/blockchains/decimal/apps/explorer/content.php`, `/root/ai-projects/dpos.space/blockchains/decimal/apps/explorer/index.php`, `/root/ai-projects/dpos.space/blockchains/decimal/apps/explorer/pages/block/config.json`, `/root/ai-projects/dpos.space/blockchains/decimal/apps/explorer/pages/block/content.php`, `/root/ai-projects/dpos.space/blockchains/decimal/apps/explorer/pages/tx/config.json`, `/root/ai-projects/dpos.space/blockchains/decimal/apps/explorer/pages/tx/content.php`.
- Legacy shared Decimal files inspected/classified: `/root/ai-projects/dpos.space/blockchains/decimal/js/blockchain.js`, `/root/ai-projects/dpos.space/blockchains/decimal/js/modal-accounts.js`, `/root/ai-projects/dpos.space/blockchains/decimal/js/decimal-sdk-web.js` only to confirm explorer is read-only and does not require seed auth or broadcast helpers.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing `tests/v3-*.js`, and new `tests/v3-decimal-explorer-smoke.js`.

Matrix:

| Legacy file/control/helper/data dependency | Exact legacy behavior | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `config.json` | Registers `explorer`, title `Блок-эксплорер`, menu `Explorer` | `v3/js/chains.js` includes Decimal app `explorer` with public Decimal API purpose | `tests/v3-decimal-explorer-smoke.js` checks registry | Implemented |
| `content.php` form | Renders prompt `Введите номер блока или хэш-сумму транзакции`, hidden chain/service inputs, and submit button | `renderCosmosExplorer` renders labelled select/input/button and `role="status" aria-live="polite"` result region | focused smoke checks prompt and status markers | Implemented accessible form |
| `content.php` overview blocks | Server fetches `https://mainnet-gate.decimalchain.com/api/blocks?limit=10&offset=0`, lists latest 10 blocks, tx count, and emission in DEL | `loadDecimalExplorerOverview` fetches `${chain.apiBase}/blocks?limit=10&offset=0`; `renderDecimalExplorerOverview` lists `Последние блоки`, `txsCount`, and `emission` via `formatDecimalAmount` | focused smoke checks overview helper markers | Implemented public API alternative |
| `content.php` status | Server fetches `rpc/node_info`, shows network plus latest block hash/height/date from blocks list | v3 fetches `${chain.apiBase}/rpc/node_info` and renders `Статус` with network/hash/height/date when present | focused smoke checks status markers | Implemented public API alternative |
| `index.php` route redirect | Numeric path redirects to `/decimal/explorer/block/{height}`; hex-like path redirects to `/decimal/explorer/tx/{hash}` | v3 uses explicit `kind=block|tx|address` hash route selection and form submit, avoiding server redirects | focused smoke checks route dispatch and `renderExplorerResult` | Implemented static route |
| `pages/block/content.php` | Fetches `https://mainnet-explorer-api.decimalchain.ru/api/block/{height}` and `.../block/{height}/txs`, links txs, shows block time and validators count | v3 opens `${chain.apiBase}/blocks/${state.value}`, renders normalized block fields and any transactions/operations returned, plus raw JSON | focused smoke checks block endpoint and result renderer | Implemented static-safe block detail |
| `pages/tx/content.php` | Fetches `https://mainnet-gate.decimalchain.com/api/tx/{hash}`, shows block, timestamp, type, sender, fee and operation data | v3 opens `${chain.apiBase}/txs/${state.value}`, renders tx summary/operations through shared `renderExplorerResult`, links known addresses through profile helpers | focused smoke checks tx endpoint and result renderer | Implemented static-safe tx detail |
| Address lookup | Legacy explorer form was block/tx-oriented; account data existed in Decimal profiles/wallet | v3 also supports `${chain.apiBase}/addresses/${state.value}/balances` from the existing Decimal explorer branch for useful static address lookup | focused smoke checks address endpoint | Implemented safe additive read-only lookup |
| Forbidden runtime dependencies | Legacy used stale public domains through PHP; no dpos.space private service is required | v3 runtime avoids `mainnet-gate.decimalchain.com`, `mainnet-explorer-api.decimalchain.ru`, `178.20.43.121`, `backend.dpos.space`, `ajax.php`, PHP runtime strings, private APIs, indexers, daemons, and hosted helper apps | focused smoke checks renderer/helper slices | Enforced |
| Broadcast/auth behavior | Explorer is read-only; shared Decimal SDK/broadcast helpers are unrelated | v3 explorer renderer has no `broadcast.prepare` or `bindOperationForm`; direct wallet operations remain in wallet apps only | focused smoke checks isolated renderer slice | Enforced read-only |

Validation results for this app:
- TDD RED observed before implementation/plan update: `node tests/v3-decimal-explorer-smoke.js` failed because the Decimal explorer renderer did not expose Decimal overview markers/public endpoint evidence and the exact `### Rigorous parity: Decimal / explorer` plan section was missing.
- Focused GREEN target: `node tests/v3-decimal-explorer-smoke.js`.
- Mandatory app gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-decimal-explorer-smoke.js && git diff --check`.
- Broad smoke loop: `for f in tests/v3-*.js; do node "$f" || exit 1; done`.
- Final checkpoint gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && for f in tests/v3-decimal-*-smoke.js; do node "$f" || exit 1; done && for f in tests/v3-*.js; do node "$f" || exit 1; done && git diff --check`.

Remaining gaps/non-goals:
- Static-only non-goals: no backend service, PHP route/runtime, private IP runtime call, `backend.dpos.space`, hidden server API, indexer, daemon, hosted helper application, newly hosted app, proxy, server-side cache, or explorer backend is added.
- v3 does not recreate PHP redirects, Russian month-name date formatting, or exact legacy `<ol>/<table>` markup; accessible form, cards/tables, raw JSON, and explicit route parameters replace them.
- If public Decimal API endpoints are unavailable/CORS-blocked, v3 surfaces the API error instead of adding a fallback backend.

Next app recommendation: Decimal / profiles.

### Rigorous parity: Decimal / profiles

Scope and result:
- Legacy purpose from `config.json`: `Просмотр профилей`, description `Просмотрщик профилей в блокчейне Decimal`, menu label `Профили`.
- Backend yes/no: **no backend service added**. Legacy `content.php` and `page/content.php` are PHP templates, but the browser logic in `js/app.js` reads public Decimal OpenAPI endpoints (`api.decimalchain.com`) for address, rewards and transactions. Shared Decimal auth/broadcast helpers are present globally for wallet pages, but profiles itself is read-only.
- Static-safe result: v3 keeps Decimal `profiles` through the shared profiles route, fetches address/balances/transactions/rewards/NFTs from public Decimal API, exposes balances, nonce copy, recent transaction table, raw rewards/NFT lists and a client-side rewards-by-days calculator without PHP runtime, private APIs, indexers, hidden services or broadcast.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/decimal/apps/profiles/config.json`, `/root/ai-projects/dpos.space/blockchains/decimal/apps/profiles/content.php`, `/root/ai-projects/dpos.space/blockchains/decimal/apps/profiles/index.php`, `/root/ai-projects/dpos.space/blockchains/decimal/apps/profiles/js/app.js`, `/root/ai-projects/dpos.space/blockchains/decimal/apps/profiles/page/config.json`, `/root/ai-projects/dpos.space/blockchains/decimal/apps/profiles/page/content.php`.
- Legacy shared Decimal files inspected/classified: `/root/ai-projects/dpos.space/blockchains/decimal/js/blockchain.js`, `/root/ai-projects/dpos.space/blockchains/decimal/js/modal-accounts.js`, `/root/ai-projects/dpos.space/blockchains/decimal/js/decimal-sdk-web.js` only to classify auth/RPC/broadcast dependencies.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing `tests/v3-*.js`, and new `tests/v3-decimal-profiles-smoke.js`.

Matrix:

| Legacy file/control/helper/data dependency | Exact legacy behavior | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `config.json` | Registers profiles app, title `Просмотр профилей`, menu `Профили` | Decimal inherits base app `profiles` with `accountField: true`; no duplicated Decimal app entry required | `tests/v3-decimal-profiles-smoke.js` checks route/registry | Implemented |
| `content.php` search form | POST form with hidden `chain=decimal`, `service=profiles`, address input beginning with `Dx`, submit `узнать инфу` | v3 global account/address field plus hash route `#chain=decimal&app=profiles&account=...` replaces PHP POST routing and keeps accessible labelled input | focused smoke checks `effectiveAppId === 'profiles'` and profile fetch/normalize route | Implemented static route |
| `index.php` page routing | PHP strips `@`, reads route segment, loads `page/content.php` with title/description for address | v3 SPA uses hash state and `profiles.fetchAccount(connection, account)`; no PHP page generator | focused smoke checks profile route and forbidden PHP/backend markers in runtime slices | Implemented static route |
| `page/content.php` balances | Renders `Балансы` list populated by `decimal.getAddress(address).address.balance` | `fetchDecimalAccount` calls `/addresses/{address}` and `/addresses/{address}/balances`; `normalizeRestBalances` renders balances through shared `detailsSection('Балансы', ...)` | focused smoke checks address/balances endpoints | Implemented public API |
| `page/content.php` `calc_rewards` | Days input and button call `getRewards(days)` | `renderDecimalRewardsCalculator` renders `decimal-rewards-days`, `calc_rewards` button and `decimal-rewards-result`; `fetchDecimalRewards` paginates `/rewards/{address}?limit=200&offset=...`, groups by `reward.currency` and stops at selected `endTime` | focused smoke checks helper/form/status markers | Implemented browser-only public API |
| `page/content.php` `copy_nonce` | Shows `NONCE` and copies it to clipboard | REST rows expose `Nonce`; shared rest nonce component renders Decimal/Minter nonce copy buttons using `navigator.clipboard.writeText` and `role="status" aria-live="polite"` feedback | focused smoke checks `Nonce`, copy helper and live status markers | Implemented browser-only copy |
| `js/app.js getHistory` | Calls `/txs/txs-by-address/{address}?limit=10&offset={offset}`, renders date/block/tx/type/amount/message table and prev/next links | v3 `fetchDecimalAccount` loads the first transaction page for profile summary; `v3/js/history.js` keeps the same public endpoint for dedicated history view | focused smoke checks transaction endpoint and history module marker | Implemented public API |
| `js/app.js type formatting` | Maps many Decimal tx/NFT/validator op types to Russian names | v3 `v3/js/history.js` contains Decimal op-name mappings including coin/validator/NFT protobuf names and renders recent API transactions through `renderTransactionsTable` | focused smoke checks history endpoint; existing history smokes cover shared table behavior | Implemented shared history |
| `js/app.js prepareContent` | Linkifies URLs and `@user` mentions, but contains a stale `/minter/profiles/` mention link | Decimal OpenAPI profile data has no social profile text field equivalent; v3 keeps raw JSON and address links only | documented as non-goal | Static-only non-goal |
| Shared `blockchain.js` / `modal-accounts.js` | Loads Decimal SDK, decrypts local seed, can broadcast wallet transactions; profiles uses only read calls and clipboard | v3 profiles renderer has no `broadcast.prepare`, `broadcast.broadcast`, or `bindOperationForm`; direct wallet/broadcast operations remain in wallet routes only | focused smoke checks renderer slice | Decimal profiles is read-only |
| Forbidden runtime dependencies | Legacy PHP templates are server-rendered, but browser calls public `https://api.decimalchain.com/api/v1` endpoints | v3 runtime has no `178.20.43.121`, `backend.dpos.space`, PHP route/runtime, hidden server API, indexer, daemon, hosted helper app, or newly hosted app | focused smoke checks fetch/reward/render slices | Enforced |

Validation results for this app:
- TDD RED observed before implementation/plan update: `node tests/v3-decimal-profiles-smoke.js` failed first because `fetchDecimalRewards` was missing, then because durable Decimal nonce/rewards UI evidence was missing from the focused runtime slice.
- Focused GREEN target: `node tests/v3-decimal-profiles-smoke.js`.
- Mandatory app gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-decimal-profiles-smoke.js && git diff --check`.
- Broad smoke loop: `for f in tests/v3-*.js; do node "$f" || exit 1; done`.
- Final checkpoint gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && for f in tests/v3-decimal-*-smoke.js; do node "$f" || exit 1; done && for f in tests/v3-*.js; do node "$f" || exit 1; done && git diff --check`.

Remaining gaps/non-goals:
- Static-only non-goals: no backend service, PHP route/runtime, private IP runtime call, `backend.dpos.space`, hidden server API, indexer, daemon, hosted helper application, newly hosted app, server-side profile cache, or server-side rewards aggregator is added.
- v3 does not recreate PHP POST URLs, jQuery table pagination links, stale `/minter/profiles/` mention linkification, or exact old date formatting; accessible SPA route, public API sections, raw JSON details and the dedicated history view replace them.
- If public Decimal API endpoints are unavailable/CORS-blocked, v3 surfaces the API error instead of adding a fallback backend.

Next app recommendation: Decimal / randomblockchain.

### Rigorous parity: Decimal / randomblockchain

Scope and result:
- Legacy purpose from `config.json`: `Генератор случайных чисел`, description `Генератор случайных чисел с использованием блоков блокчейна decimal`, menu label `ГСЧ`.
- Backend yes/no: **no backend service added**. Legacy `content.php` is a PHP template, but runtime `js/app.js` only requests block data and performs browser-side `block_hash_1 + block_hash_2` modulo arithmetic. The old `axios.get('/block/' + n)` path depended on a route/proxy not available in static v3; v3 replaces it with direct public Decimal OpenAPI block calls.
- Static-safe result: v3 registers Decimal `randomblockchain`, uses the shared accessible randomblockchain form, fetches `${chain.apiBase}/blocks/{height}` from `https://api.decimalchain.com/api/v1`, preserves Decimal/Minter legacy hex modulo algorithm, keeps optional line-list winner mapping, and avoids PHP/runtime backend/broadcast.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/decimal/apps/randomblockchain/config.json`, `/root/ai-projects/dpos.space/blockchains/decimal/apps/randomblockchain/content.php`, `/root/ai-projects/dpos.space/blockchains/decimal/apps/randomblockchain/index.php`, `/root/ai-projects/dpos.space/blockchains/decimal/apps/randomblockchain/js/app.js`, `/root/ai-projects/dpos.space/blockchains/decimal/apps/randomblockchain/js/sha3.min.js`, `/root/ai-projects/dpos.space/blockchains/decimal/apps/randomblockchain/js/BigInteger.min.js`.
- Legacy shared Decimal files inspected/classified: `/root/ai-projects/dpos.space/blockchains/decimal/js/blockchain.js`, `/root/ai-projects/dpos.space/blockchains/decimal/js/modal-accounts.js`, `/root/ai-projects/dpos.space/blockchains/decimal/js/decimal-sdk-web.js` only to confirm the app is read-only and does not need auth/broadcast helpers.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing `tests/v3-*.js`, and new `tests/v3-decimal-randomblockchain-smoke.js`.

Matrix:

| Legacy file/control/helper/data dependency | Exact legacy behavior | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `config.json` | Registers Decimal random generator, menu `ГСЧ`, no-category app | `v3/js/chains.js` registers Decimal app `randomblockchain`, title `Случайный блокчейн` | focused smoke checks Decimal app slice | Implemented |
| `content.php` initial form | GET fields `block1`, `block2`, `participants`, optional `data_list`, submit `Сгенерировать` | `renderRandomBlockchain` provides labelled first/second block inputs, participant number, `randomblockchain-list`, submit button and `role="status" aria-live="polite"` result | focused smoke checks form/list/status/control markers | Implemented accessible form |
| `content.php` result page | Shows start/end explorer links, `mcorp.space/post/65`, repository `denis-skripnik/decimal_random`, hidden participants/list, hash textareas, calculate button and winner result | v3 keeps the principle link and Decimal repository link, computes on submit in one static route, and shows raw calculation details | focused smoke checks `mcorp.space/post/65` and `decimal_random` markers | Implemented static UX |
| `js/app.js blocksData` | Calls `axios.get('/block/' + start_block)` and `axios.get('/block/' + end_block)`, reads `response.data.result.hash` into `sig1/sig2` | `fetchDecimalRandomBlock` calls `${chain.apiBase}/blocks/${height}`, unwraps `Result/result/data`, and `blockRandomSeed` extracts `block.hash` | focused smoke checks `/blocks/${encodeURIComponent(text)}` and `block.hash` | Implemented public API replacement |
| `js/app.js calculate` | Concatenates the two block hashes, converts as hex with `bigInt(h, 16)`, computes `mod(participants)`, displays `d.value + 1` | `hashRandomBlockchainSeeds` treats Decimal like Minter: concatenate hex hashes, native `BigInt('0x' + hex) % BigInt(modulo)`, lucky number `value + 1` | focused smoke checks `chain.id === 'minter' || chain.id === 'decimal'` and algorithm label | Implemented |
| Optional `data_list` | If list provided, participant count becomes line count and `resultMember` displays zero-based line | v3 trims non-empty textarea lines, uses list length as modulo, and displays winner text from zero-based result | focused smoke checks `randomblockchain-list` | Implemented |
| `index.php` | Only NOTLOAD guard | No runtime equivalent; SPA hash route handles rendering | focused smoke forbids PHP/runtime markers in renderer slice | Static-only non-goal |
| `sha3.min.js` | Vendored but Decimal random app does not call keccak in `js/app.js` | v3 Decimal path does not load sha3; only social-chain randomblockchain uses keccak | focused smoke checks Decimal hex modulo path | Static-safe parity |
| Shared auth/broadcast helpers | Available globally for Decimal wallet pages, not used by randomblockchain | v3 randomblockchain renderer has no `broadcast.prepare`, `broadcast.broadcast`, or `bindOperationForm`; no account/seed needed | focused smoke checks renderer slice | Decimal randomblockchain is read-only |
| Forbidden runtime dependencies | Legacy PHP route/proxy `/block/` is not valid for static hosting | v3 uses only public Decimal API and no `178.20.43.121`, `backend.dpos.space`, PHP route/runtime, hidden server API, indexer, daemon, hosted helper app, or newly hosted app | focused smoke checks seed/render slices | Enforced |

Validation results for this app:
- TDD RED observed before implementation/plan update: `node tests/v3-decimal-randomblockchain-smoke.js` failed because Decimal `randomblockchain` was not registered and no Decimal-specific public block/hash evidence existed.
- Focused GREEN target: `node tests/v3-decimal-randomblockchain-smoke.js`.
- Mandatory app gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-decimal-randomblockchain-smoke.js && git diff --check`.
- Broad smoke loop: `for f in tests/v3-*.js; do node "$f" || exit 1; done`.
- Final checkpoint gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && for f in tests/v3-decimal-*-smoke.js; do node "$f" || exit 1; done && for f in tests/v3-*.js; do node "$f" || exit 1; done && git diff --check`.

Remaining gaps/non-goals:
- Static-only non-goals: no backend service, PHP route/runtime, private IP runtime call, `backend.dpos.space`, hidden server API, indexer, daemon, hosted helper application, newly hosted app, or `/block/` proxy is added.
- v3 does not recreate PHP GET result pages or hidden textarea layout exactly; the accessible SPA form/result block replaces them.
- If the public Decimal block API is unavailable/CORS-blocked, v3 surfaces the error instead of adding a fallback backend.

Next app recommendation: verify Decimal wallet has exact focused smoke plus exact `### Rigorous parity: Decimal / wallet` plan section; if present, Decimal complete.

### Rigorous parity: Decimal / wallet

Scope and result:
- Legacy purpose from `config.json`: `Кошелёк`, description `Кошелёк с возможностью просмотра и работы с балансами блокчейна Decimal`, menu label `кошелёк`.
- Backend yes/no: **no backend service added**. Legacy wallet is a PHP-rendered UI plus browser Decimal SDK/OpenAPI calls; shared `blockchain.js` decrypts the user-selected local seed and broadcasts directly through the Decimal SDK. v3 keeps only direct user-authorized wallet/broadcast operations and public Decimal API reads.
- Static-safe result: v3 has a dedicated Decimal wallet renderer, public balance/stake/NFT/history loaders, and explicit forms for send, delegate/unbond, convert, create token and NFT delegate/unbond. All operations go through `broadcast.prepare(chain, 'seed', ...)` and the shared confirm/send guard; no PHP runtime, private API, indexer, daemon, or hidden helper service is added.

Files inspected for this one-app pass:
- Legacy exact app files: `/root/ai-projects/dpos.space/blockchains/decimal/apps/wallet/config.json`, `/root/ai-projects/dpos.space/blockchains/decimal/apps/wallet/content.php`, `/root/ai-projects/dpos.space/blockchains/decimal/apps/wallet/index.php`, `/root/ai-projects/dpos.space/blockchains/decimal/apps/wallet/js/app.js`, `/root/ai-projects/dpos.space/blockchains/decimal/apps/wallet/delegation/config.json`, `/root/ai-projects/dpos.space/blockchains/decimal/apps/wallet/delegation/content.php`, `/root/ai-projects/dpos.space/blockchains/decimal/apps/wallet/css/style.css`, `/root/ai-projects/dpos.space/blockchains/decimal/apps/wallet/css/jquery-ui.css`.
- Legacy shared Decimal files inspected/classified: `/root/ai-projects/dpos.space/blockchains/decimal/js/blockchain.js`, `/root/ai-projects/dpos.space/blockchains/decimal/js/modal-accounts.js`, `/root/ai-projects/dpos.space/blockchains/decimal/js/decimal-sdk-web.js`, `/root/ai-projects/dpos.space/blockchains/decimal/js/sjcl.min.js`.
- Current v3 files inspected: `v3/js/app.js`, `v3/js/chains.js`, `v3/js/broadcast.js`, `v3/js/profiles.js`, `v3/js/history.js`, existing `tests/v3-*.js`, and `tests/v3-decimal-wallet-smoke.js`.

Matrix:

| Legacy file/control/helper/data dependency | Exact legacy behavior | v3 equivalent | Test/evidence | Status |
| --- | --- | --- | --- | --- |
| `config.json` | Registers Decimal wallet and describes balance/work actions | Decimal inherits base app `wallet`; route dispatch sends `wallet`, `swap`, `my-coin` and `broadcast` to Decimal-specific renderer before generic Cosmos fallback | `tests/v3-decimal-wallet-smoke.js` route assertions | Implemented |
| `content.php` auth block | Shows seed-auth warning and wallet panel only after local account selection | v3 `renderDecimalWallet` loads Decimal SDK/crypto, uses existing auth compatibility and shows wallet controls only through explicit local account context | focused smoke checks dedicated renderer and no generic alias | Implemented |
| `content.php` balances/actions | Shows current address, copy button, balances, action links for transfer/convert/delegate | `loadDecimalWalletData` calls `/addresses/{address}/balances`; `renderDecimalWalletBalances` and max-fill helpers render balances/actions in static accessible panels | focused smoke checks balance endpoint, labels and max buttons | Implemented |
| `content.php` transfer modal | Recipient, amount, memo, fee, templates, `Перевести` | `decimal-send-form` prepares `decimalSend`; `broadcast.js` maps SDK `sendDEL` / `transferToken` | focused smoke checks form and broadcast prepare markers | Implemented direct authorized op |
| `content.php` convert modal | Token conversion fields and route/amount/fee placeholders | `decimal-convert-form` prepares `decimalConvert`; `broadcast.js` maps `buyTokenForExactDEL`, `sellExactTokensForDEL`, `convertToken` where SDK supports them | focused smoke checks form and SDK method evidence | Implemented direct authorized op |
| `content.php` delegate modal | Validator key, token, amount, templates, `Делегировать` | `decimal-delegate-form` maps mode to `decimalDelegate`/`decimalUnbond`; SDK methods include `delegateDEL`, `delegateToken`, `withdrawStakeToken` | focused smoke checks operation mapping | Implemented direct authorized op |
| `content.php` NFT delegate/unbond modals | NFT ID actions for delegate/unbond | `decimal-nft-form` maps mode to `decimalDelegateNFT`/`decimalUnbondNFT`; SDK methods include `delegateNFT` and `withdrawStakeNFT` | focused smoke checks NFT mapping | Implemented direct authorized op |
| `delegation/content.php` | Reads/show delegated coins and NFT stakes, exposes unbond/delegate actions | `loadDecimalWalletData` calls `/validators/wallet/{stakeAddress}/stakes/coins` and `/stakes/nfts`; v3 wallet renders stakes and NFT sections | focused smoke checks both stake endpoints | Implemented public API |
| `js/app.js getHistory` | Reads `/txs/txs-by-address/{sender.address}?limit=10&offset=...` and formats history table | v3 wallet loads first page for wallet summary; `v3/js/history.js` keeps dedicated Decimal history route with same public endpoint | focused smoke checks tx endpoint | Implemented public API |
| `modal-accounts.js` / `blockchain.js` | Local seed account management, `bip.to` branch, SDK wallet/DecimalEVM broadcast helpers | v3 preserves old localStorage account schema and routes seed-required operations through shared broadcast guard; `bip.to` wallet-link branch remains documented as not statically recreated | focused smoke checks plan evidence and no direct `decimalEVM.broadcast` in form binder | Implemented with non-goal |
| Forbidden runtime dependencies | Legacy page has PHP templates, but operational calls are browser SDK/public API | v3 has no private IP runtime call, `backend.dpos.space`, hidden server API, indexer, daemon, hosted helper app, newly hosted app, or PHP runtime dependency | focused/broad smoke coverage | Enforced |

Validation results for this app:
- Focused smoke already exists and is green: `node tests/v3-decimal-wallet-smoke.js`.
- Mandatory app gate for this section: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && node tests/v3-decimal-wallet-smoke.js && git diff --check`.
- Broad smoke loop: `for f in tests/v3-*.js; do node "$f" || exit 1; done`.
- Final checkpoint gate: `node --check v3/js/app.js && node --check v3/js/chains.js && node --check v3/js/broadcast.js && node --check v3/js/profiles.js && for f in tests/v3-decimal-*-smoke.js; do node "$f" || exit 1; done && for f in tests/v3-*.js; do node "$f" || exit 1; done && git diff --check`.

Remaining gaps/non-goals:
- Static-only non-goals: no backend service, PHP route/runtime, private IP runtime call, `backend.dpos.space`, hidden server API, indexer, daemon, hosted helper application, newly hosted app, server-side fee/route proxy, template modal clone, or `bip.to` hosted wallet-link flow is added.
- Dynamic token autocomplete, exact jQuery/fancybox modal UX, permit-signing branch, live fee/max rewriting and TX status polling remain intentionally simplified into accessible static forms and shared confirmed broadcast results.

Next app recommendation: Decimal complete.

### UX polish: Minter wallet quick actions

Scope: small Minter wallet form/action UX pass after static-safe parity completion. No services, PHP runtime, private APIs, hidden server APIs, daemons, indexers, or new hosted apps are added.

Files inspected:
- Legacy: `/root/ai-projects/dpos.space/blockchains/minter/apps/wallet/content.php` — modal forms for transfer/convert/delegate/hub withdraw with visible legacy maximum labels such as `max_token_transfer`, `max_token_convert`, `max_token_delegate`.
- Legacy: `/root/ai-projects/dpos.space/blockchains/minter/apps/wallet/js/app.js` — balance action spoiler links, token-specific actions, and balance-derived maximum values.
- v3: `v3/js/app.js` — `renderMinterWalletBalances`, `renderMinterWalletForms`, `bindMinterQuickActions`, `bindMaxButtons`.
- Test: `tests/v3-minter-wallet-smoke.js`.

UX matrix:
| Legacy UX/control | v3 before this pass | UX polish in this pass | Test coverage | Status |
| --- | --- | --- | --- | --- |
| Balance row action opens transfer modal and carries selected token/amount maximum. | Balance action opened transfer details and prefilled amount/coin, but the operation form had no explicit reusable maximum button. | Transfer form now has a hidden `Максимум` button; selecting a balance row fills amount/coin and reveals the button with the selected balance. | `v3-minter-wallet-smoke.js` checks `data-fill-target="minter-send-amount"`, balance action amount markers, and quick action binding. | Implemented static-safe. |
| Balance row action opens convert modal with max convert amount. | Swap action selected the source coin, but left amount empty. | Swap quick action now also prefills `minter-swap-amount` from the selected balance row. | Focused smoke checks `setMinterField('minter-swap-amount', button.dataset.minterAmount)`. | Implemented static-safe. |
| Balance row action opens delegate modal with selected token maximum. | Stake action selected coin; amount was not filled for balance rows. | Stake action now carries selected amount and reveals a `Максимум` button for the stake amount. | Focused smoke checks `data-fill-target="minter-delegate-amount"`. | Implemented static-safe. |
| Legacy action list exposed token-specific pool/convert context from the selected balance. | Liquidity form existed but required manual coin0/volume0 retyping. | Balance table now includes a `Pool` quick action that opens liquidity details and prefills coin0/volume0. | Focused smoke checks liquidity prefill marker. | Implemented static-safe. |
| Modal/spoiler behavior. | Static v3 already uses `<details class="operation-details">` instead of Fancybox. | Preserved; no class/id churn beyond new scoped buttons/action markers. | Existing wallet smoke checks details sections. | Kept. |

Validation notes:
- Focused RED was confirmed before implementation by `node tests/v3-minter-wallet-smoke.js` failing on the new maximum-button assertion.
- Backend-only legacy pieces remain non-goals; this pass only changes static client-side form UX.

### UX polish: Decimal wallet NFT actions

Scope: small Decimal wallet NFT-stake UX pass. No services, PHP runtime, private APIs, hidden server APIs, daemons, indexers, or new hosted apps are added.

Files inspected:
- Legacy: `/root/ai-projects/dpos.space/blockchains/decimal/apps/wallet/content.php` — NFT delegate/anbond modal forms (`delegate_nft_modal`, `anbond_nft_modal`) with NFT ID field and explicit operation buttons.
- Legacy: `/root/ai-projects/dpos.space/blockchains/decimal/apps/wallet/js/app.js` — balance action spoiler pattern and Decimal wallet public API balance loading.
- v3: `v3/js/app.js` — `renderDecimalWalletBalances`, `renderDecimalWalletForms`, `bindDecimalQuickActions`.
- Test: `tests/v3-decimal-wallet-smoke.js`.

UX matrix:
| Legacy UX/control | v3 before this pass | UX polish in this pass | Test coverage | Status |
| --- | --- | --- | --- | --- |
| NFT stake/anbond modal keeps NFT ID visible and operation-specific. | v3 had the NFT stake/unbond form, but the NFT stake table was read-only and required manual NFT ID/validator copying. | NFT stake rows now expose `Анбонд NFT` action buttons that open the NFT details form and prefill NFT ID + validator. | `v3-decimal-wallet-smoke.js` checks `data-decimal-nft-action="unbond"`, `openDecimalOperationDetails('decimal-nft-details')`, and field prefill markers. | Implemented static-safe. |
| Table/card action should reveal the matching form rather than forcing manual scrolling. | Coin stake rows already opened stake/unbond details; NFT rows did not. | `bindDecimalQuickActions` now also binds scoped NFT action buttons. | Focused smoke covers the binding markers. | Implemented static-safe. |
| Human-readable NFT/stake columns. | v3 already uses NFT label/validator/status; raw token addresses are not primary for Decimal stake. | Preserved, with one additional action column. | Existing Decimal wallet smoke checks native labels and no primary raw token address column. | Kept. |

Validation notes:
- Focused RED was confirmed before implementation by `node tests/v3-decimal-wallet-smoke.js` failing on the new NFT action marker.
- This is direct client-side form prefill only; backend-only legacy behavior remains a non-goal.
