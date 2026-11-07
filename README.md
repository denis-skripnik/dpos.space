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

## Голосовой ввод в редакторе

В редакторе **Golos, Steem и Hive** первая вкладка «Редактор» сохраняет существующую форму публикации; вторая — **«Голос в текст»**. Настройки доступны прямо во второй вкладке, без ухода со страницы и потери незаполненных полей, или внизу сайта по ссылке **«Голосовой ввод и ИИ»** (`#app=voice-settings`).

1. Разблокируйте хранилище и сохраните API-ключ Groq в настройках. Поле пароля после сохранения пустое; ключ не входит в синхронизацию настроек и обычный экспорт аккаунтов. Для смены устройства сохраните ключ отдельно безопасным способом. «Проверить соединение» проверяет доступ без отправки аудио; «Удалить ключ» не удаляет запись.
2. Нажмите **«Начать запись»** и разрешите микрофон. Разрешение не запрашивается при открытии страницы. Доступны пауза, продолжение и остановка. Повторный Start не заменяет сохранённое аудио: сначала нужно явно удалить его.
3. После остановки две основные кнопки — **«Удалить»** и **«Распознать»**. Отправка не начинается автоматически. Лимит Groq — 25 МБ; браузер останавливает запись с запасом до лимита. Ошибки сети, разрешений и API не удаляют уже записанное аудио. Повтор выполняется только вручную и может тарифицироваться провайдером.
4. Выберите **«Исходный текст»** (Whisper `whisper-large-v3`) или **«Оформленный текст»** (дополнительно `openai/gpt-oss-120b`: пунктуация и абзацы без новых идей). Проверьте результат: ИИ может ошибаться. Исходная расшифровка сохраняется даже при ошибке оформления; можно вернуться к ней без повторного распознавания аудио.
5. Исправьте текст и нажмите **«Перенести в редактор»**. Он вставится в сохранённую позицию курсора или в конец, не заменяя существующий текст, заголовок и теги. Форма откроется для проверки. **Перенос ничего не публикует**: отправка остаётся отдельным подтверждаемым действием редактора.

В **web/PWA** остановленное аудио и расшифровка сохраняются локально в IndexedDB и восстанавливаются после перезагрузки; они не зашифрованы как ключ. Общий компьютер не подходит для приватной диктовки. Очистка данных сайта удалит запись. При ошибке хранения не закрывайте вкладку. Микрофон требует HTTPS (или localhost) и современного MediaRecorder. Уход в другой раздел останавливает браузерную запись; при закрытии вкладки, блокировке экрана или выгрузке процесса сохранение последних фрагментов не гарантируется. Запись в фоне для PWA не обещается. Прямой запрос в Groq зависит от CORS, сети и лимитов провайдера; скрытого сервера/прокси нет.

В **Android** при наличии `getAppInfo.voiceInput === true` используются только нативные запись, настройки и запросы: ключ никогда не возвращается JavaScript. Для старого APK показывается требование обновления, без скрытого перехода к браузерному микрофону или ключу. Новая поддержка требует совместимой сборки; опубликованные версия и download-ссылки этой веб-доработкой не меняются.

## Обложка поста

В форме публикации Golos, Steem и Hive откройте **«Обложка поста»**. **«Создать обложку»** читает текущий существующий заголовок поста: отдельного поля текста обложки нет. Изменение заголовка очищает прежний PNG и разрешение его загрузки; создайте обложку заново. Можно выбрать **«Без текста»**. PNG 1200 × 675 рисуется на устройстве, используя только комплектные изображение и шрифт; при их недоступности появится ошибка, без подмены шрифта. Крупный текст занимает максимум четыре строки; лишние слова заменяются многоточием только на картинке, полный заголовок сохраняется. Под превью есть текстовое описание для скринридера.

**«Скачать PNG»** сохраняет файл средствами браузера, ничего не загружая в сеть. В Android-приложении blob-скачивание не поддерживается: используйте явную кнопку **«Загрузить в Imgur и вставить в начало»** или браузер. Только эта кнопка отправляет PNG напрямую в Imgur через существующий загрузчик редактора. Она добавляет картинку перед текущим текстом поста и заполняет пустую ссылку превью; имеющаяся ссылка меняется только с отметкой **«Заменить имеющееся изображение превью»**. Если черновик изменился во время загрузки, вставка отменяется. Это не публикация поста: отправка в блокчейн по-прежнему требует отдельного подтверждения.

Обложка не сохраняется при перезагрузке или выходе из редактора: скачайте или явно загрузите нужный результат. Для проверки: `node tests/v3-post-cover.js`, `node tests/v3-post-cover-ui.js`, `node tests/v3-post-cover-entry.js`, `node tools/web-checks.cjs`. Проверка физического Android/TalkBack — отдельный этап.

## Предложения заголовков

Рядом с существующим полем **«Заголовок»** есть необязательная кнопка **«Предложить заголовки»**. Только её явное нажатие отправляет текущий текст поста (1–20000 символов UTF-16) в Groq. Модель `openai/gpt-oss-120b` возвращает три коротких варианта; выбор временной кнопки заполняет тот же заголовок поста и очищает устаревшую обложку. Это не новые поля публикации: FormData, операции, тело, теги, ссылки превью и параметры выплат остаются прежними. Ни публикация, ни распознавание голоса не запускают эту функцию автоматически.

Используется существующий зашифрованный ключ Groq из разблокированного хранилища и прежняя страница настроек; новых полей ключа нет. В Android обязателен `getAppInfo.titleSuggestions === true`: старый APK просит обновиться и никогда не переходит к браузерному ключу. Web-запрос имеет общий лимит 90 секунд, не следует редиректам и не повторяется автоматически. Некорректные, обрезанные, слишком большие ответы и ошибки оставляют черновик без изменений. Варианты не сохраняются: изменение текста или заголовка, очистка формы, смена раздела, блокировка/повторная разблокировка и смена ключа отменяют устаревшие результаты. Не отправляйте приватный текст без согласия на обработку Groq; проверяйте предложенные формулировки перед выбором.

Проверки: `node tests/v3-title-suggestions.js`, `node tests/v3-title-suggestions-ui.js`, `node tests/v3-post-cover-entry.js`, затем `node tools/web-checks.cjs`. Публичный сайт и APK этой локальной работой не обновляются.

## Резервное копирование

Глобальная страница `#app=backup` поддерживает два локальных формата:

- парольный encrypted backup: PBKDF2 + AES-GCM, работает как основной fallback во всех современных браузерах;
- passkey-backup: WebAuthn PRF + HKDF-SHA-256 + AES-GCM, если устройство/Chrome/WebView возвращает PRF output после отпечатка, лица или PIN.

Passkey-backup не использует clipboard, URL/hash или незашифрованный JSON. Если PRF недоступен, интерфейс предлагает использовать backup с паролем.

PHP/backend runtime старой версии в ветке `v3` больше не требуется.

## Синхронизация настроек через блокчейн

Откройте **«Синхронизация настроек»** внизу страницы (`#app=settings-sync`).

На общих страницах, включая уведомления и синхронизацию настроек, верхние списки блокчейнов и сервисов доступны и при прямом открытии ссылки. Выберите блокчейн и сервис, затем нажмите кнопку перехода в верхней форме.

1. Выберите **VIZ** или **Golos** и укажите **аккаунт-источник**. Читать можно любой публичный аккаунт; сохранять — только текущий авторизованный аккаунт выбранной сети.
2. **«Сохранить в блокчейн»** публикует полный текущий снимок после обычного подтверждения транзакции. Другие страницы сохраняют настройки только локально, без автоматической публикации. Для VIZ используется regular, для Golos — posting.
3. **«Синхронизировать»** заново находит последний снимок этого автора и после подтверждения **заменяет**, а не объединяет, все три группы: фильтры блокчейн-уведомлений, настройки автоапвоутера Golos/Hive/Steem и настройки VIZ автонаграды себе. Пустые списки удаляют старые записи; привязки настроек к аккаунтам и имена избранных/кураторов сохраняются, но не импортируют аккаунты авторизации.

Снимок **публичен навсегда**, включая имена аккаунтов и списки избранных/кураторов. Не используйте эти поля для секретов. Экспорт/импорт ограничен строгой версионной схемой: ключи, vault, пароли, авторизованные аккаунты, inbox/непрочитанное, история, курсоры, pending-транзакции, согласия Start/Stop и настройки устройства не передаются. Неизвестная версия или повреждённый последний снимок отклоняются; более старый снимок вместо него молча не применяется. Ошибка локального хранения откатывает все затронутые группы; при ошибке самого отката интерфейс сообщает об этом отдельно.

Синхронизация не вызывает Start/Stop, не импортирует ключи и не включает ранее остановленную автоматизацию. Уже разрешённые браузерные задачи получают новые параметры только для своих прежних аккаунтов, без расширения разрешения на авто-донат; после reload параметры также ограничены прежним локальным Start. Существующая защита VIZ связывает Start с точными настройками: **после изменения параметров VIZ в браузере требуется новый явный Start**, старое доказательство не переподписывается автоматически. Локальная галочка автозапуска сохраняется, но импортированный снимок не служит основанием для legacy Android grant-import/autostart.

Android получает только параметры существующих локальных записей через `replaceSettingsPreferences`; отдельные локальные grants, ключи, расписание/состояние worker и pending-операции остаются на устройстве. Это небольшое изменение native bridge/фильтра требует приложения, собранного с этим кодом; старый APK может сохранить веб-настройки, но покажет предупреждение о неподдерживаемом обновлении native-параметров. Версия Android — **3.1.14 / code92**, файл `/downloads/dpos-space-3.1.14.apk`; приложение проверяет подписанный update manifest. Отключённая настройка может запретить новые действия, но не отзывает локальный grant и не перезапускает worker.

Таймер браузера читает актуальные эффективные параметры; уже начатая проверка со старыми параметрами отменяется до подписи, в том числе после ожидания TAPOS. Native bridge также отменяет старые in-flight проверки до очереди записи параметров, даже если `enabled` остаётся `true`. Уже попытанные pending-транзакции сохраняются и не отправляются повторно. Повторная синхронизация после пустого/отключённого снимка снова пересекает параметры с исходным локальным Start, а не с предыдущим пересечением; нового разрешения это не создаёт. Импортированные Golos-строки сохраняют запрет legacy-миграции авто-доната после обычного сохранения и reload, в том числе на старом APK.

### Как ищется снимок и ограничивается размер

- Выделенный ID обеих сетей: `dpos.space.settings` (не Voice `V`). Версия данных: `format: "dpos.space/settings", version: 1`. В VIZ `custom.json` содержит `{p: <предыдущий блок этого протокола>, d: <полный снимок>}`; `p=0` для первой записи. Снимки полные: обходить старые `p` для объединения не нужно.
- VIZ сначала вызывает `call` с `['custom_protocol_api','get_account',[account,protocol]]`; ненулевой protocol index проверяется по операциям блока, ID и автору. Отсутствующий/нулевой/невалидный/неподтверждённый индекс использует постраничную историю аккаунта. Golos использует `account_history.get_account_history(account, from, limit, {select_ops:['custom_json']})` с проверкой ID/автора и пагинацией по исходным sequence, а не по количеству фильтрованных строк. RPC-чтения ограничены по времени; изменение страницы, источника или текущего аккаунта отменяет применение результата.
- В обоих актуальных C++ протоколах ID ограничен 32 байтами, а **вся транзакция**, не один JSON, — 64 КиБ. Прикладной предел — **60 КиБ UTF-8** для JSON, с запасом 4 КиБ под одну операцию, authorities, заголовок и подпись. Это собственный консервативный предел приложения, не выдуманный лимит `custom_json`; oversized снимок не дробится и не отправляется частично.
- Первичные контракты: [VIZ custom protocol API](https://github.com/VIZ-Blockchain/viz-cpp-node/blob/master/plugins/custom_protocol_api/custom_protocol_api.cpp), [VIZ operations](https://github.com/VIZ-Blockchain/viz-cpp-node/blob/master/libraries/protocol/chain_operations.cpp), [VIZ config](https://github.com/VIZ-Blockchain/viz-cpp-node/blob/master/libraries/protocol/include/graphene/protocol/config.hpp), [спецификация обратной ссылки p](https://github.com/VIZ-Blockchain/Free-Speech-Project/blob/master/specification.md), [Golos history](https://github.com/golos-blockchain/golos/blob/master/plugins/account_history/plugin.cpp), [Golos protocol config](https://github.com/golos-blockchain/golos/blob/master/libraries/protocol/include/golos/protocol/config.hpp). Используются поставляемые в репозитории SDK и существующий guarded confirmation/broadcast flow. Доступность старой истории зависит от выбранной ноды; отсутствующие pruned-данные восстановить нельзя.

### Кураторские награды в уведомлениях

В списках уведомлений кураторские награды показываются в СГ для Golos, SP для Steem и HP для Hive. Это оценка по текущему соотношению фонда и долей сети, а не историческая стоимость награды и не зачисление на ликвидный баланс. Исходные GESTS/VESTS доступны в «Технических подробностях». Если курс получить не удалось, интерфейс сообщает об этом и сохраняет исходную сумму в подробностях.

Пересчёт меняет только отображение. Сохранённые события, счётчики и отметки прочтения не переписываются. Он применяется также к событиям из Android-хранилища на общей странице уведомлений. Текст системного Android push формирует установленный APK; эта веб-правка его не меняет.

### Автоматические награды и уведомления

В VIZ по умолчанию скрывается только точно узнаваемая автонаграда себе: `memo == "dpos.space: VIZ self-award"` и `initiator == receiver`, когда сам получатель получает награду. В настройках уведомлений VIZ есть явный флажок **«Показывать автоматические награды себе»**; он входит в снимок и поддерживается браузерным и native scanner. Ручная награда с другим memo, награда от другого инициатора и реальная награда стороннему бенефициару остаются видимыми. Для `benefactor_award` получатель — `benefactor`, а не `receiver`. Уже сохранённая история уведомлений не удаляется и не переписывает непрочитанное задним числом.

Golos `post_donate` не скрывается целиком: он встречается и в ручных входящих донатах автора. Неидентифицируемые как автоматика операции не подавляются; `fee_donate` не добавлялся в входящий notification allowlist. История кошелька остаётся полной.

Проверки: `node tests/v3-settings-sync-smoke.js`, `node tools/web-checks.cjs`, `python tests/browser/settings-sync.py`, `python tests/browser/settings-sync-runtime.py` (Playwright/CDP, изолированный контекст, локальные assets и fixture RPC), `ANDROID_HOME=<sdk> ./gradlew testDebugUnitTest --tests 'space.dpos.android.SettingsPreferencesSyncTest' --tests 'space.dpos.android.GolosNotificationScannerTest' --no-daemon` из `android/`. В тестах нет реальных транзакций; Save проходит настоящий confirmation flow с отменой отправки. Проверка физического Android/TalkBack и публикация — отдельные этапы.

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
