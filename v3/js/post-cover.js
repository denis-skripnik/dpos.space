(function exposePostCover(global) {
  'use strict';
  const WIDTH = 1200, HEIGHT = 675, TEXT_X = 72, TEXT_Y = 120, TEXT_WIDTH = 608, TEXT_HEIGHT = 440;
  const FONT = '700 64px DposCoverTitle';
  const t = value => global.DposI18n ? global.DposI18n.t(value) : value;
  let fontPromise;

  function truncateWord(word, measure, width) {
    if (!global.Intl || !global.Intl.Segmenter) throw new Error(t('Браузер не поддерживает безопасный перенос заголовка. Обновите браузер.'));
    let prefix = '';
    for (const { segment } of new global.Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(word)) {
      if (measure(prefix + segment + '…') > width) break;
      prefix += segment;
    }
    return prefix + '…';
  }

  function wrapTitle(title, measure, width = TEXT_WIDTH, maxLines = 4) {
    const words = String(title || '').trim().split(/\s+/u).filter(Boolean);
    const lines = [];
    let index = 0;
    while (index < words.length && lines.length < maxLines) {
      let line = '';
      while (index < words.length && measure(line ? `${line} ${words[index]}` : words[index]) <= width) {
        line = line ? `${line} ${words[index++]}` : words[index++];
      }
      if (!line) {
        lines.push(truncateWord(words[index], measure, width));
        return { lines, truncated: true };
      }
      lines.push(line);
    }
    if (index < words.length) {
      const lastWords = lines.pop().split(' '), firstWord = lastWords[0];
      while (lastWords.length && measure(lastWords.join(' ') + '…') > width) lastWords.pop();
      lines.push(lastWords.length ? lastWords.join(' ') + '…' : truncateWord(firstWord, measure, width));
    }
    return { lines, truncated: index < words.length };
  }

  function markup() {
    return `<details class="subpanel" data-post-cover>
      <summary>Обложка поста</summary>
      <p>Создайте обложку на устройстве. В Imgur она отправится только кнопкой загрузки.</p>
      <div class="field"><label for="cover-title">Текст на обложке</label><input id="cover-title" type="text" data-cover-title aria-describedby="cover-title-help"></div>
      <p id="cover-title-help" class="muted">До четырёх строк крупным шрифтом. Длинный текст сокращается только на обложке; заголовок поста не меняется.</p>
      <label><input type="checkbox" data-cover-no-text> Без текста</label>
      <div class="button-row">
        <button type="button" data-cover-create>Создать обложку</button>
        <button type="button" class="secondary" data-cover-download disabled>Скачать PNG</button>
        <button type="button" class="secondary" data-cover-upload disabled>Загрузить в Imgur и вставить в начало</button>
      </div>
      <p class="muted">Скачать PNG можно в браузере. В приложении Android используйте загрузку в Imgur и вставку в пост.</p>
      <label><input type="checkbox" data-cover-replace> Заменить имеющееся изображение превью</label>
      <p class="muted">Без этой отметки имеющаяся ссылка превью сохранится. Текст поста и теги сохраняются.</p>
      <p data-cover-status role="status" aria-live="polite"></p>
      <img data-cover-preview hidden width="1200" height="675" style="max-width:100%;height:auto" alt="" aria-describedby="cover-description" data-i18n-skip>
      <p id="cover-description" data-cover-description data-i18n-skip></p>
    </details>`;
  }

  function bounded(promise, message) {
    let timer;
    return Promise.race([promise, new Promise((resolve, reject) => { timer = global.setTimeout(() => reject(new Error(t(message))), 15000); })])
      .finally(() => global.clearTimeout(timer));
  }

  async function loadFont(document) {
    if (!fontPromise) {
      fontPromise = (async () => {
        if (!global.FontFace || !document.fonts) throw new Error(t('Не удалось загрузить местный шрифт обложки.'));
        const face = new global.FontFace('DposCoverTitle', 'url("/v3/assets/covers/cover-title.ttf") format("truetype")', { weight: '700' });
        await face.load();
        document.fonts.add(face);
        await document.fonts.ready;
      })().catch(() => { fontPromise = null; throw new Error(t('Не удалось загрузить местный шрифт обложки.')); });
    }
    return bounded(fontPromise, 'Не удалось загрузить местный шрифт обложки.');
  }

  function loadBase() {
    return bounded(new Promise((resolve, reject) => {
      const image = new global.Image();
      image.onload = () => image.naturalWidth === WIDTH && image.naturalHeight === HEIGHT
        ? resolve(image) : reject(new Error(t('Не удалось загрузить основу обложки 1200 × 675.')));
      image.onerror = () => reject(new Error(t('Не удалось загрузить основу обложки 1200 × 675.')));
      image.src = '/v3/assets/covers/winged-head.webp';
    }), 'Не удалось загрузить основу обложки 1200 × 675.');
  }

  async function createPng(document, title) {
    const [base] = await Promise.all([loadBase(), loadFont(document)]);
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH; canvas.height = HEIGHT;
    const context = canvas.getContext('2d');
    if (!context) throw new Error(t('Не удалось создать PNG обложки.'));
    context.drawImage(base, 0, 0, WIDTH, HEIGHT);
    context.font = FONT;
    context.textBaseline = 'top';
    context.fillStyle = '#ffffff';
    const result = wrapTitle(title, text => context.measureText(text).width);
    context.save();
    context.beginPath(); context.rect(TEXT_X, TEXT_Y, TEXT_WIDTH, TEXT_HEIGHT); context.clip();
    result.lines.forEach((line, index) => context.fillText(line, TEXT_X, TEXT_Y + index * 88));
    context.restore();
    const blob = await bounded(new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error(t('Не удалось создать PNG обложки.'))), 'image/png')), 'Не удалось создать PNG обложки.');
    return { blob, lines: result.lines, truncated: result.truncated };
  }

  function mount(root, { upload } = {}) {
    if (!root) return () => {};
    const document = root.ownerDocument;
    const form = root.closest('form');
    const part = name => root.querySelector(`[data-cover-${name}]`);
    const title = part('title'), noText = part('no-text'), create = part('create'), download = part('download'), uploadButton = part('upload');
    const replace = part('replace'), status = part('status'), preview = part('preview'), description = part('description');
    const field = name => form.querySelector(`#editor-${name}`);
    const route = global.location.hash;
    let disposed = false, revision = 0, busy = false, opened = false, result = null, objectUrl = '', uploaded = false;
    const listeners = [];
    const alive = () => !disposed && root.isConnected && global.location.hash === route;
    const listen = (element, event, fn) => { element.addEventListener(event, fn); listeners.push(() => element.removeEventListener(event, fn)); };
    const say = text => { status.textContent = t(text); };
    function buttons() {
      create.disabled = busy;
      download.disabled = busy || !result;
      uploadButton.disabled = busy || !result || uploaded || typeof upload !== 'function';
    }
    function clear() {
      revision++; result = null; uploaded = false;
      if (objectUrl) global.URL.revokeObjectURL(objectUrl);
      objectUrl = ''; preview.removeAttribute('src'); preview.hidden = true; description.textContent = '';
      buttons();
    }
    function changed() {
      clear(); title.disabled = noText.checked;
      say('Настройки изменены. Создайте обложку заново.');
    }
    listen(root, 'toggle', () => {
      if (root.open && !opened) {
        opened = true; title.value = field('title').value;
        say('Текст взят из заголовка поста. Его можно изменить только для обложки.');
      }
    });
    listen(title, 'input', changed);
    listen(noText, 'change', changed);
    listen(form, 'reset', () => { clear(); opened = false; title.value = ''; noText.checked = false; title.disabled = false; replace.checked = false; say('Обложка очищена.'); });
    listen(create, 'click', async () => {
      if (busy || !alive()) return;
      clear(); const token = revision;
      const coverTitle = noText.checked ? '' : title.value;
      busy = true; buttons(); say('Создаю обложку на устройстве…');
      try {
        const generated = await createPng(document, coverTitle);
        if (!alive() || token !== revision) return;
        result = generated; objectUrl = global.URL.createObjectURL(result.blob);
        preview.src = objectUrl; preview.hidden = false;
        preview.alt = t(result.lines.length ? 'Обложка: крылатая говорящая голова справа, текст слева.' : 'Обложка: крылатая говорящая голова справа, без текста.');
        description.textContent = t('Обложка 1200 × 675. Крылатая говорящая голова справа.') + ' ' +
          (result.lines.length ? t('Текст на обложке:') + ' «' + result.lines.join(' ') + '». ' + t(result.truncated ? 'Текст сокращён на обложке.' : 'Текст показан полностью.') : t('Обложка без текста.'));
        say(result.lines.length ? 'Обложка готова. Можно скачать PNG или явно загрузить в Imgur.' : 'Обложка готова без текста. Можно скачать PNG или явно загрузить в Imgur.');
      } catch (error) {
        if (alive() && token === revision) say(error.message || 'Не удалось создать PNG обложки.');
      } finally { busy = false; if (alive()) buttons(); }
    });
    listen(download, 'click', () => {
      if (busy || !result || !alive()) return;
      if (global.DposAndroid || (global.DposNative && global.DposNative.available())) {
        say('В приложении Android скачивание PNG не поддерживается. Загрузите обложку в Imgur или откройте сайт в браузере.');
        return;
      }
      const link = document.createElement('a'); link.href = objectUrl; link.download = 'dpos-cover.png';
      document.body.appendChild(link); link.click(); link.remove();
      say('PNG передан браузеру для скачивания. В сеть обложка не отправлялась.');
    });
    listen(uploadButton, 'click', async () => {
      if (busy || !result || uploaded || !alive() || typeof upload !== 'function') return;
      const token = revision, png = result.blob, allowReplace = replace.checked;
      const before = ['title','body','tags','image'].map(name => field(name).value);
      busy = true; buttons(); say('Загружаю обложку в Imgur…');
      try {
        const link = await upload(png);
        if (!alive() || token !== revision) return;
        // Never apply a delayed upload to a changed draft or preview URL.
        if (before.some((value, index) => value !== field(['title','body','tags','image'][index]).value)) {
          say('Обложка загружена, но черновик изменился. Вставка отменена; содержимое сохранено.');
          return;
        }
        const url = new URL(link);
        if (url.protocol !== 'https:') throw new Error(t('Не удалось получить безопасную ссылку Imgur.'));
        const safeLink = url.href.replace(/[()]/g, character => character === '(' ? '%28' : '%29');
        const body = field('body'); body.value = `![](${safeLink})\n\n${body.value}`;
        body.dispatchEvent(new global.Event('input', { bubbles: true }));
        const image = field('image');
        if (!image.value.trim() || allowReplace) { image.value = safeLink; image.dispatchEvent(new global.Event('input', { bubbles: true })); }
        uploaded = true;
        say('Обложка загружена и вставлена в начало поста. Пост не опубликован.');
      } catch (error) {
        if (alive() && token === revision) say('Не удалось загрузить обложку. Скачайте PNG или повторите загрузку явно.');
      } finally { busy = false; if (alive()) buttons(); }
    });
    buttons();
    return () => { disposed = true; clear(); listeners.forEach(remove => remove()); };
  }

  const api = Object.freeze({ wrapTitle, markup, mount });
  global.DposPostCover = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
