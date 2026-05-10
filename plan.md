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
