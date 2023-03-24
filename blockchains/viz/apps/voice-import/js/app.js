import cheerio from 'https://cdn.skypack.dev/cheerio';

async function importArticle(url) {
  try {
    const response = await axios.get('https://dpos.space/blockchains/viz/apps/voice-import/proxy.php?url=' + url);
      const $$ = cheerio.load(response.data);
      let title = $$('#_tl_editor h1').text();
      let articleContent = $$('#_tl_editor').clone();
if (url.indexOf('telegra.ph') > -1) {
  articleContent.find('h1, address').remove();
  articleContent.find('h6').replaceWith((i, el) => $$(el).text()).end()
  .find('h5').replaceWith((i, el) => $$(el).html(`<h4>${$$(el).html()}</h4>`)).end()
  .find('h4').replaceWith((i, el) => $$(el).html(`<h3>${$$(el).html()}</h3>`)).end()
  .find('h3').replaceWith((i, el) => $$(el).html(`<h2>${$$(el).html()}</h2>`)).end();
} else if (url.indexOf('mirror.xyz') > -1) {
        title = $$('title').text().split(' — ')[0];
        articleContent = $$('.css-175qwzc div').clone();
}
      const content = articleContent.html();
      const images = await Promise.all($$('img').map(async (i, el) => {
        const imgURL = $$(el).attr('src');
        const imgName = imgURL.split('/').pop();
        const newURL = await uploadImage(imgURL);
        $$(el).attr('src', newURL).attr('style', 'max-width: 100%; height: auto;');
        return newURL;;
      }).get());
      const result = { title, content };
    return result;
    } catch (error) {
      console.error(error);
    }
  }

  async function uploadImage(imageUrl) {
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
      console.error(error);
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
      window.alert('Пост опубликован успешно!');
    } catch (error) {
      console.error(error);
      window.alert('Ошибка при публикации поста!');
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