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
