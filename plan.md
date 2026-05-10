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

- Golos apps inspected: `activities`, `api`, `backup`, `calc`, `donate`, `donates`, `escrow`, `explorer`, `help`, `import`, `instant-view`, `manage`, `polls`, `post`, `randomblockchain`, `referrers`, `registration`, `stakebot`, `swap`, `top`, `wallet`, `witnesses-rewards`.
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

- Golos: `activities`, `api`, `backup`, `calc`, `donate`, `donates`, `escrow`, `explorer`, `help`, `import`, `instant-view`, `manage`, `polls`, `post`, `profiles`, `randomblockchain`, `referrers`, `registration`, `stakebot`, `swap`, `top`, `wallet`, `witnesses-rewards`; key files include `blockchains/golos/apps/{profiles,wallet,post,donate,manage,registration,explorer,calc,import,instant-view,swap}/**/*.{php,js,json}` and `blockchains/golos/js/{blockchain.js,modal-accounts.js,golos.min.js}`.
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
- `blockchains/{minter,decimal}/js/modal-accounts.js`: login/address + seed, mnemonic validation, same `*_users`/`*_current_user` writes, import of seed accounts from another dpos.space chain with `importFrom`.
- `blockchains/{minter,decimal}/js/blockchain.js`: decrypts imported seed with `dpos.space_<sourceChain>_<login>_seed`.
- Browser `/chro` old-site smoke: Golos profile page exposes `Добавить аккаунт` with login/posting/active fields; Decimal wallet exposes manual seed login plus import and create account sections; Minter profile and Decimal wallet routes load legacy service content.

Implemented in v3:

- `v3/js/auth.js`: added legacy-compatible account writers/removers, current-user writer, key/seed user creation, seed-chain scanner, duplicate protection, imported-seed source-chain handling.
- `v3/js/app.js`: `Аккаунты` now shows saved users, current user, switch, confirm-delete, add key-account forms for Golos/VIZ/Steem/Hive, add seed-account forms for Minter/Decimal, local seed generation, and cross-chain seed import.
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
