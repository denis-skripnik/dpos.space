# Dpos space

Статическая v3-версия DPoS-инструментов для Golos, VIZ, Steem, Hive, Minter и Decimal.

## Локальный запуск

Запускайте из корня репозитория через обычный HTTP-сервер, не через `file://`:

```bash
python3 -m http.server 8080
```

Откройте:

```text
http://127.0.0.1:8080/
```

Альтернатива через Node.js:

```bash
npx serve . -l 8080
```

## Текущая структура v3

- `index.html` — статическая точка входа.
- `v3/css/style.css` — стили.
- `v3/js/*.js` — SPA, роутинг, профили, история, auth и broadcast helpers.
- `v3/vendor/<chain>/` — минимальный набор browser-библиотек, которые нужны v3 в runtime.
- `tests/*.js` — smoke-проверки v3.
- `favicon.ico`, `LICENSE`, `plan.md` — сопутствующие файлы.
- `.well-known/assetlinks.json` — Digital Asset Links для Android WebView/passkey support текущего debug APK.

## Резервное копирование

Глобальная страница `#app=backup` поддерживает два локальных формата:

- парольный encrypted backup: PBKDF2 + AES-GCM, работает как основной fallback во всех современных браузерах;
- passkey-backup: WebAuthn PRF + HKDF-SHA-256 + AES-GCM, если устройство/Chrome/WebView возвращает PRF output после отпечатка, лица или PIN.

Passkey-backup не использует clipboard, URL/hash или незашифрованный JSON. Если PRF недоступен, интерфейс предлагает использовать backup с паролем.

PHP/backend runtime старой версии в ветке `v3` больше не требуется.

## Golos web corrective stage (local, not published)

- Canonical confirmation no longer depends on optional `get_block.transaction_ids`. The vendored Golos SDK has one narrow additive export, `auth.unsignedTransactionId(tx)`: SHA-256 of its existing unsigned transaction serializer, first 20 bytes, excluding chain ID/signatures. Existing signing code and serializer are unchanged. Blocks with IDs must agree; full unsigned fields, intended operation, exact block/index and a fresh LIB from the same configured endpoint are still mandatory.
- Every authorized browser tick reconciles up to eight pending intents in a fair, durable rotation **before** content/own-vote/energy checks. Missing receipt metadata uses an exact-ID lookup, then fresh history plus an independently persisted older sweep. Lookup/history/proof reads are bounded (1s/2s/4s; concurrent reconciliation deadline 9.5s). Late confirmation adds no new-send success/counters and never catches up donations. ID-less, endpoint-mismatched, malformed or unproven intents remain quarantined by account/author/permlink.
- Positive automation votes require a matching root post, `allow_votes=true`, unpaid content and cashout more than 60 seconds away using fresh canonical chain head time plus elapsed monotonic read time (not the browser wall clock). Favorite posts additionally require canonical `created == last_update` and `num_changes == 0`; reply-driven `active` is not edit evidence. Eligibility and battery are reread after TAPOS preparation and immediately before signing. Unavailable/low battery, unavailable content/eligibility and cancelled **unsent** attempts retain their unread events; an attempted unknown RPC is never replayed.
- Golos curator votes **and favorite root-comment events** now come from paginated account history, rather than latest-30/latest-20 history/blog windows. One endpoint-hashed localStorage record atomically holds source progress plus the recipient-specific inbox, under the same lifetime Web Lock as the scanner. Fresh head/gap continuation and historical backfill are independent. At most eight sources (up to two pages each) are read concurrently per tick with a 4s per-read deadline; a rotated batch of 64 inbox entries is considered. Source errors/gaps retain that source's progress, not healthy sources' results. Empty validated older pages are retention boundaries, rechecked periodically; unavailable pruned history cannot be reconstructed.
- Limits fail closed without eviction: 100 retained source/role records per endpoint, 1,000 inbox entries per source/role, and the existing 5,000 lifetime intent ceiling. Inactive sources retain their data and do not run; membership changes backfill independently for newly selected recipients. Browser storage quotas can stop all signing. Public inbox/history/feed records contain no signing keys and confer neither unlock nor Start consent. No user-data migration or backend was added.
- Independent-review boundaries: synchronous RPC receipts supply only inclusion coordinates; transaction, operation, node binding and canonical SDK ID remain locally captured/durable. Conflicting receipt IDs cannot confirm or overwrite the original intent. Planning uses a temporary dedupe set; only reached actions reserve scanner seen. Definitely unsent failures across preparation/authority/TAPOS release their provisional reservation and retain the inbox, while attempted RPC errors remain quarantined. Cashout ages include DGP request latency plus subsequent reads at intake, pre-send and post-TAPOS checks.
- Existing browser-session unlock, separate Start/Stop control, cadence, feed, non-Golos and native paths remain in place. This is foreground web recovery, not a closed-browser scheduler. No production publication, live broadcast or Android artifact was performed.

Checks: `node tests/v3-golos-unsigned-id.js`, `node tests/v3-golos-web-correction.js`, `node tests/v3-golos-web-recovery.js`, `python3 tests/browser/golos-web-correction.py`, `python3 tests/browser/golos-review-corrections.py <case>` (receipt, receipt-fields, receipt-same-id-alternate, stop, lock, prepare, authority, tapos, attempted, clock-initial, clock-presend, clock-final, clock-content), the existing session/feed browser suites, and `node tools/web-checks.cjs`. Browser tests use actual vendored SDK TAPOS/signatures and intercepted synthetic RPC only. Physical Android, TalkBack, production RPC latency and external publication remain separate acceptance.

## Browser-session reload continuity (local implementation, not published)

- VIZ self-award and browser auto-upvoter retain the latest 100 local feed entries per feature/chain (1,000 characters per message); the visible panel shows the latest 30. Public account/post identifiers may be present. Writes strip arbitrary action/result/error objects and sanitize messages before storage; restored upvoter cards are read-only.
- Unlock is shared across same-origin tabs in the **browser cookie session**, including independently opened tabs, duplicated/opener tabs and tab reordering. A random 256-bit wrapping capability lives only in a `__Host-` session cookie (`Secure`, `SameSite=Strict`, path `/`, no expiry); localStorage holds the AES-GCM-wrapped vault key, never the password or plaintext account keys. The decrypted vault and imported AES key remain in page memory. Resume binds to origin, the exact encrypted vault digest/revision (therefore account records) and revocation generation. Existing envelope encryption and transactional migration/restore remain authoritative.
- Unavailable/corrupt history storage blocks browser automation Start; failure detected during feed checkpoints cancels future browser ticks. A transaction already submitted cannot be recalled. No background cadence is guaranteed for a closed/frozen page.
- Security boundary explicitly approved for convenience: same-origin JS/XSS can use the session capability; the JS-set cookie cannot be HttpOnly and is sent to this host over HTTPS. Browser profiles/restores may retain session cookies across browser restarts. **Exact browser-close detection is not promised**: losing the cookie locks new/reloaded pages even with ciphertext retained; use explicit **Lock** for guaranteed origin-wide revocation. No unload handler deletes the capability. This is not an indefinite localStorage plaintext-DEK unlock. HTTPS, cookies, Web Crypto and Web Locks are required; capability/write/readback failures fail closed.

- Only an earlier explicit **Start** resumes, bound to the current capability/envelope and public settings, including refresh on unrelated routes. Persisted deadlines retain remaining 432-second VIZ / 60-second upvoter cadence; no catch-up burst or countdown reset on reload/Stop/new Start. Feed is display history, never consent/receipt evidence. Stop revokes the feature/chain in every tab; Lock revokes unlock and all run grants globally. Imports revoke resume; account/envelope/password changes invalidate old bindings/guards. A subsequent manual unlock does not recreate revoked, imported or legacy unsigned Start consent. VIZ's authenticated cookie-loss exception is described below. Notification settings/cursors/unread state are preserved; Android worker policy is unchanged.
- Browser Web Locks owns the entire scan/preparation/send/proof lifetime, not an expiring storage lease; a slow/suspended owner cannot be displaced. Immediate run control is stored separately from exclusively-owned cadence/intents, so Stop cannot erase pending or late receipts resurrect Start. Every send has durable pending plus feed checkpoint before signing/RPC. There is one broadcast attempt only. Success requires strict transaction ID/block/position, exact full unsigned transaction match in the canonical block and a fresh same-configured-node irreversible boundary. Reversible, absent, malformed or mismatched proof remains pending and is never replayed; a later exact proof may confirm without counter/donation catch-up.
- Conservative limits: a crash before receiving an identifiable receipt keeps that target quarantined indefinitely; expiry alone never clears it. Preparation/storage uncertainty also retains its reservation. Other targets remain independent. There is no unsafe ledger reset/retry UI; 5,000 retained intents is a fail-closed capacity limit, not eviction. Browser timers are best effort, not a server scheduler.

Focused checks: `node tests/v3-web-vault-resume.js`, `node tests/v3-web-automation-continuity.js`, `node tests/v3-web-automation-feed.js`, `python3 tests/browser/web-reload-continuity.py`, `python3 tests/browser/web-automation-feed.py`; full gate `node tools/web-checks.cjs`. Browser checks use isolated synthetic vaults, real SDK signing and fake RPC only; all external traffic is fulfilled locally, zero mainnet broadcasts. Independent security review and bounded two-tab revocation/control re-review passed for this local implementation; publication and live user acceptance remain separate.

## VIZ authenticated manual-unlock continuation (local, awaiting final review)

- After this update, one **new explicit Start** is required. It mints fixed-schema, domain-separated HMAC-SHA256 evidence from the vault's existing private in-memory key material. Legacy controls have no proof: unlock never backfills them. Neither the MAC key nor a new decrypt capability is persisted or exported; no backend, independent authority or session lifetime extension was added.
- Every VIZ admission (ordinary reload, observer tab, manual unlock) verifies the proof, exact envelope/revision, Start ID/epoch/binding, revocation and separate Stop token, exact ordinary/public settings, selected accounts' actual regular-key preparation, effective network/endpoint policy/order and SDK signing chain ID/address prefix. A private memory receipt is synchronously checked again by sender guards. Automatically written node-result caches are not consent configuration; actual transaction endpoint guards remain mandatory.
- Cookie loss still locks the vault. Correct manual credentials can rebind only an unchanged authenticated VIZ Start under the existing vault Web Lock. Stop is synchronous, changes its independent cancellation token without waiting for crypto, and cannot be revived by a late control write (localStorage compare/write is not cross-tab CAS). New Start/rebind serialize under the vault lock; timers/rendering and automation ownership are outside it. Late UI success **and** failure belong only to their original attempt.
- Rebind touches only the control/evidence, not ledger bytes, remaining deadline, pending intents or recovery cursor. No immediate extra award, catch-up or unknown-send replay. Stop, global Lock, imports/recovery, changed account/settings/configuration, invalid/mixed/corrupt records or missing proof fail closed; a new explicit Start collects current settings.
- Threat limit: no claim against active same-origin XSS or coordinated rollback of all origin storage to a previously valid authenticated snapshot. Browser storage has no independent monotonic authority here. No closed-browser/background liveness promise or Android policy change.
- Acceptance: `python3 tests/browser/viz-manual-unlock.py`, connected reload/retry/diagnostics browser gates, and `node tools/web-checks.cjs`; synthetic RPC and disposable storage only. Physical passkey devices, mainnet and public deployment are separate acceptance, not implied by these tests.

## Проверка

```bash
node --check v3/js/*.js
node --check tests/*.js
for test in tests/*.js; do node "$test"; done
git diff --check
```

Для ручной проверки статической раздачи:

```bash
python3 -m http.server 8080
curl -I http://127.0.0.1:8080/
curl -I http://127.0.0.1:8080/favicon.ico
curl -I http://127.0.0.1:8080/v3/js/app.js
curl -I http://127.0.0.1:8080/v3/js/chains.js
curl -I http://127.0.0.1:8080/v3/css/style.css
```
