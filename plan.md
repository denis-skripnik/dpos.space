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
- прямое подключение существующих browser JS libraries из `blockchains/<chain>/js/`;
- текстовые статусы загрузки и ошибок для screen reader;
- минимальная локальная проверка без build step.

## Non-goals for current pass

- Не удалять старую PHP-версию.
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
- The old PHP tree remains available as migration source material.

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
