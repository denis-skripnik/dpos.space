import cheerio from 'https://cdn.skypack.dev/cheerio';

async function importArticle(url) {
  try {
    const response = await axios.get('https://dpos.space/blockchains/viz/apps/voice-import/proxy.php?url=' + url);
      const $$ = cheerio.load(response.data, {
        scriptingEnabled: false,
      });
      let title = $$('#_tl_editor h1').text();
      let articleContent = $$('#_tl_editor').clone();
if (url.indexOf('telegra.ph') > -1) {
  articleContent.find('h1, address').remove();
  articleContent.find('h6').replaceWith((i, el) => $$(el).text()).end()
  .find('h5').replaceWith((i, el) => $$(el).html(`<h4>${$$(el).html()}</h4>`)).end()
  .find('h4').replaceWith((i, el) => $$(el).html(`<h3>${$$(el).html()}</h3>`)).end()
  .find('h3').replaceWith((i, el) => $$(el).html(`<h2>${$$(el).html()}</h2>`)).end();
  const images = [];
  const imgElements = articleContent.find('img');
  for (let i = 0; i < imgElements.length; i++) {
    const imgURL = articleContent.find(imgElements[i]).attr('src');
    const newURL = await uploadImage(imgURL);
    articleContent.find(imgElements[i]).attr('src', newURL).attr('style', 'max-width: 100%; height: auto;');
    images.push(newURL);
  }
  } else if (url.indexOf('mirror.xyz') > -1) {
        title = $$('title').text().split(' — ')[0];
        articleContent = $$('.css-175qwzc div').clone();
        articleContent.find('style, svg').remove();
        articleContent.find('.css-180lw20').remove();
        articleContent.find('[data-rmiz-btn-open]').remove();
        const images = [];
      let elements = articleContent.find('noscript img');
let el_variant = 1;
      if (elements.length === 0) {
  elements = articleContent.find('div[data-rmiz-wrap="visible"] div img');
el_variant = 2;
}
      for (let i = 0; i < elements.length; i++) {
                const el = elements[i];
        const percent = ((i+1) / elements.length) * 100;
                $('#results').html(`<b>Обработка изображений ${percent}%</b>`);
        let imgURL = articleContent.find(el).attr('src');
        if (imgURL.indexOf('/_next/image?url=') > -1) {
          imgURL = imgURL.split('?url=')[1].split('&')[0];
          imgURL = decodeURIComponent(imgURL);
        }
        const newURL = await uploadImage(imgURL);
        const newImg = $$('<img>').attr('src', newURL).attr('style', 'max-width: 100%; height: auto;');
if (el_variant === 1) {
  articleContent.find(el).parent().parent().parent().parent().append(newImg);
  articleContent.find(el).parent().parent().parent().remove()
} else if (el_variant === 2) {
  articleContent.find(el).parent().parent().parent().append(newImg);
  articleContent.find(el).parent().parent().remove()
}
        images.push(newURL);
      }
    }
    let content = articleContent.html();
    content = content.replace('<p>Источник:</p>', '');
    console.log(content);
    const result = { title, content };
    return result;
    } catch (error) {
      console.error(error);
    }
  }

  async function uploadImage(imageUrl) {
    if (imageUrl.indexOf('imger')) return imageUrl;
    await new Promise(r => setTimeout(r, 2000));
    try {
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const imageData = Buffer.from(response.data, 'binary').toString('base64');
      const formData = new FormData();
      formData.append("image", imageData);
      const uploadResponse = await $.ajax({
        url: "https://api.imgur.com/3/image",
        method: "POST",
        headers: {
          'Authorization': 'Client-ID 372d5f766d47d1d'
        },
        data: formData,
        processData: false,
        contentType: false
      });
      const imgurl = uploadResponse.data.link;
      return imgurl;
    } catch (error) {
      console.error(JSON.stringify(error));
    return imageUrl;
    }
  }

  async function publishPost(title, content) {
    try {
      const data = {};
      const custom_data = await viz.api.getAccountAsync(viz_login, 'V');
      data.p = custom_data.custom_sequence_block_num;
      data.t = 'p';
      data.d = {};
      data.d.t = title;
      data.d.m = content;
      data.d.d = content.slice(0, 140);
      await viz.broadcast.customAsync(posting_key, [], [viz_login], 'V', JSON.stringify(data));
      $('#results').html(`<b>Пост опубликован успешно!</b>`);
    } catch (error) {
      console.error(error);
      $('#results').html(`<b>Ошибка при публикации поста!</b>
${e}`);
    }
  }

  $(document).ready(() => {
    $('#import-button').click(async () => {
      const url = $('#url-input').val();
      const article = await importArticle(url);
      article.content += `<p>Пост импортирован при помощи <a href="https://dpos.space/viz/voice-import" target="_blank">voice-import</a>.<br>
<b><a href="${url}" target="_blank">источник</a></b></p>`;
      await publishPost(article.title, article.content);
    });
  });