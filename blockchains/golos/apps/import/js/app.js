import cheerio from 'https://cdn.skypack.dev/cheerio';

var assoc = {
  "а": "a",
  "б": "b",
  "в": "v",
  "ґ": "g",
  "г": "g",
  "д": "d",
  "е": "e",
  "ё": "yo",
  "є": "ye",
  "ж": "zh",
  "з": "z",
  "и": "i",
  "і": "i",
  "ї": "yi",
  "й": "ij",
  "к": "k",
  "л": "l",
  "м": "m",
  "н": "n",
  "о": "o",
  "п": "p",
  "р": "r",
  "с": "s",
  "т": "t",
  "у": "u",
  "ф": "f",
  "х": "kh",
  "ц": "cz",
  "ч": "ch",
  "ш": "sh",
  "щ": "shch",
  "ъ": "xx",
  "ы": "y",
  "ь": "x",
  "э": "ye",
  "ю": "yu",
  "я": "ya"
}
function transform(str, spaceReplacement) {
  if (!str) {
      return "";
  }
  var new_str = '';
  var ru = '';
  for (var i = 0; i < str.length; i++) {
      var strLowerCase = str[i].toLowerCase();
      if (strLowerCase === " " && spaceReplacement) {
          new_str += spaceReplacement;
          continue;
      }
      if (!assoc[strLowerCase]) {
         new_str += strLowerCase;
      } else {
          new_str += assoc[strLowerCase];
         ru = 'ru--';
      }
  }
  return ru + new_str;
}

var featuredImage = [];
async function importArticle(url) {
  try {
    const response = await axios.get('https://dpos.space/blockchains/golos/apps/import/proxy.php?url=' + url);
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
    let imgURL = articleContent.find(imgElements[i]).attr('src');
if (imgURL.indexOf('http') === -1) imgURL = `https://telegra.ph${imgURL}`;
    const newURL = await uploadImage(imgURL);
    articleContent.find(imgElements[i]).attr('src', newURL).attr('style', 'max-width: 100%; height: auto;');
    featuredImage.push(newURL);
    images.push(newURL)
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
featuredImage.push(newURL);
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

 async function publishPost(title, body) {
  var benif = [{
    account: 'denis-skripnik',
    weight: 100
}]
  var category = document.getElementById('content_category').value;
    if (document.getElementById('content_tags').value === '') {
      var content_tags = 'import_article dpos-post';
     } else {
      var content_tags = document.getElementById('content_tags').value + ' import_article dpos-post';
     }
     var tagspace = content_tags.toLowerCase().replace(/,/g, ' ').replace(/  /g, ' ');
     let tagsraw = tagspace.split(' ');
     let tags = [];
 for (let tag of tagsraw) {
      tags.push(transform(tag, "-"));
      }
      var jsonMetadata = {
        "app": "dpos.space/post",
        "format": "markdown",
        "tags": tags,
        "image": featuredImage
        };
var permlink = transform(title, "-");
permlink=permlink.replace(/([^a-zA-Z0-9 \-]*)/g,'');
permlink=permlink.replace(/---/g,'-');
permlink=permlink.replace(/--/g,'-');
permlink=permlink.replace(/--/g,'-');
permlink=permlink.replace(/^\-+|\-+$/g, '');
let content = await golos.api.getContentAsync(golos_login, permlink, 0);
let isEdit = false;
if (content.author !== '') {
  var q = window.confirm('Пост с таким пермлинком существует. Вы действительно хотите его заменить?');
  if (q == false) return;
  isEdit = true;
}
     try {
      const extensions = [];
if (isEdit === false) {
  extensions.push([0,{beneficiaries:benif}]);
  extensions.push([2,{percent:5000}]);
}
      const operations = [
        ['comment', {'parent_author':'','parent_permlink':category,'author':golos_login,'permlink':permlink,'title':title,'body':body,'json_metadata':JSON.stringify(jsonMetadata)}],['comment_options',{'author':golos_login,'permlink':permlink,'max_accepted_payout':'1000000.000 GBG','percent_steem_dollars':10000,'allow_votes':true,'allow_curation_rewards':true,extensions}]];
       console.log(JSON.stringify(operations));
       golos.broadcast.send({extensions: [], operations}, [posting_key], function(err, res) {
                if(err) {
                    if(err == 'RPCError: Assert Exception:( now - auth.last_root_post ) > STEEM_MIN_ROOT_COMMENT_INTERVAL: You may only post once every 5 minutes.') {
                    alert('Подождите хотя-бы 5 минут перед публикацией следующего поста!');
           } else if(err == 'AssertionError: private_key required') {
                    alert('Ошибка: Приватный постинг ключ обязателен к вводу!');
                                  } else {
                    console.log(JSON.stringify(err));
                                    alert(err);
                    }
                    } else {
                  alert('Пост опубликован успешно! \n URL поста: \n@' + golos_login + '/' + permlink);
               }
            })
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
      article.content += `<p>Пост импортирован при помощи <a href="https://dpos.space/golos/import" target="_blank">dpos.space/golos/import</a>.<br>
<b><a href="${url}" target="_blank">источник</a></b></p>`;
      await publishPost(article.title, article.content);
    });
  });