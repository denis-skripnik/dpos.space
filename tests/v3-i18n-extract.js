const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const extractorPath = path.join(__dirname, '..', 'tools', 'i18n-extract.cjs');
const { extractSourceText, extractHtmlText, discoverActiveSources } = require(extractorPath);

const source = [
  "const title = 'Настройки аккаунта';",
  'const card = `<section title="Подробности"><h2>Привет, ${user.name}!</h2>',
  '  <input placeholder="Введите имя" value="${user.name}">',
  '  <a href="https://example.test/${user.name}" aria-label="Открыть профиль">Профиль</a>',
  '  <code>const пароль = true;</code><span data-token="РУБ">Готово</span></section>`;',
  "const url = 'https://пример.рф/страница';",
  "const selector = '.кнопка-настройки';",
  "const protocol = 'VIZ';",
  "const tokenSymbols = ['РУБ', 'ДОЛЛАР'];",
  "const commonPasswords = ['йцукен', 'пароль'];"
].join('\n');

assert.deepStrictEqual(extractSourceText(source, { filename: 'fixture.js' }), [
  'Настройки аккаунта',
  'Подробности',
  'Привет, ⟦0⟧!',
  'Введите имя',
  'Открыть профиль',
  'Профиль',
  'Готово'
]);

assert.deepStrictEqual(extractHtmlText(`
  <!doctype html><html lang="ru"><head><title>DPoS — инструменты</title></head>
  <body><button title="Сохранить изменения" aria-label="Сохранить"> Сохранить </button>
  <input placeholder="Введите аккаунт" value="чужой ввод">
  <a href="https://пример.рф/путь">Документация</a>
  <script>const ignored = 'Не выполнять';</script>
  <style>.x::before { content: 'Не текст'; }</style></body></html>
`), [
  'DPoS — инструменты',
  'Сохранить изменения',
  'Сохранить',
  'Введите аккаунт',
  'Документация'
]);

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dpos-i18n-'));
fs.mkdirSync(path.join(temp, 'v3', 'js'), { recursive: true });
fs.mkdirSync(path.join(temp, 'v3', 'vendor'), { recursive: true });
fs.writeFileSync(path.join(temp, 'index.html'), `
  <h1>Главная</h1>
  <script src="https://cdn.example/x.js"></script>
  <script src="v3/vendor/lib.js"></script>
  <script src="v3/js/live.js?v=7"></script>`);
fs.writeFileSync(path.join(temp, 'v3', 'js', 'live.js'), "const x = 'Активный текст';");
fs.writeFileSync(path.join(temp, 'v3', 'js', 'old.js'), "const x = 'Исторический текст';");
fs.writeFileSync(path.join(temp, 'v3', 'vendor', 'lib.js'), "const x = 'Текст библиотеки';");

assert.deepStrictEqual(
  discoverActiveSources(path.join(temp, 'index.html')).map(item => path.relative(temp, item)),
  ['index.html', path.join('v3', 'js', 'live.js')]
);

console.log('v3 i18n extractor tests passed');
