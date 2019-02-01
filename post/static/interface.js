(function (){ 
 
    var chian = {
     'viz': window['viz'],
     'WLS':  window['wlsjs'],
     'steem':  window['steem'],
     'golos':  window['golos']
    };
   
    var blockchain = window.location.pathname.replace(/\/+$/g, '').split('/');
    blockchain = blockchain[blockchain.length-1];
   
    if (blockchain === 'WLS') {
           chian[blockchain].api.setOptions({url: 'https://api.wls.services'});
    chian[blockchain].config.set('address_prefix','WLS');
   chian[blockchain].config.set('chain_id','de999ada2ff7ed3d3d580381f229b40b5a0261aec48eb830e540080817b72866');
   window.amount3 = 'WLS';
    } else if (blockchain === 'viz') {
    chian[blockchain].config.set('websocket','wss://viz.lexai.host/');   
window.amount3 = 'VIZ';
} else  if (blockchain === 'golos') {
       chian[blockchain].config.set('websocket','wss://ws.golos.io');   
       window.amount3 = 'GBG';
} else  if (blockchain === 'steem') {
    window.amount3 = 'SBD';
}

    window.chain = chian[blockchain];
    window.chain.chainName = blockchain;
     window.chainApi = window.chain.api;
    window.chainBroadcast = window.chain.broadcast;
   
   })();
   
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
   
   var MD = new SimpleMDE({
   
       autofocus: true,
       autosave: {
           enabled: true,
           uniqueId: "MyUniqueID",
           delay: 1000,
       },
       blockStyles: {
           bold: "**",
           italic: "*"
       },
       element: document.getElementById("content_text"),
       forceSync: true,
       spellChecker: false,
       indentWithTabs: true,
       insertTexts: {
           horizontalRule: ["", "\n\n-----\n\n"],
           image: ["![](","#url#)"],
           link: ["[","](#url#)"],
           table: ["", "\n\n| Column 1 | Column 2 | Column 3 |\n| -------- | -------- | -------- |\n| Text     | Text      | Text     |\n\n"],
       },
   
       parsingConfig: {
           allowAtxHeaderWithoutSpace: true,
           strikethrough: false,
           underscoresBreakWords: true,
       },
       placeholder: "Пишите тут...",
   
       promptURLs: true,
       renderingConfig: {
           singleLineBreaks: false,
           codeSyntaxHighlighting: true,
       },
   
       showIcons: ["code", "table"],
       status: ["autosave", "lines", "words", "cursor", {
           className: "keystrokes",
           defaultValue: function(el) {
               this.keystrokes = 0;
               el.innerHTML = "0 Нажатий";
           },
           onUpdate: function(el) {
               el.innerHTML = ++this.keystrokes + " Нажатий";
           }
       }], // Another optional usage, with a custom status bar item that counts keystrokes
       styleSelectedText: true,
       tabSize: 4,
       toolbar: true,
       toolbar: ["preview", "bold", "italic", "|", "heading", "heading-1", "heading-2", "heading-3", "|", "quote", "code", "unordered-list", "ordered-list", "table", "horizontal-rule", "link", "image", "fullscreen", {
        name:"side-by-side",
        action: function customFunction(){
          $('.drdrop').toggleClass('fullscreen')
            MD.toggleSideBySide();
        },
        title: "Справа редактор | Слева просмотр",
        className: "fa fa-columns"
    }],
       toolbarTips: true,
   
   });
      
   var featuredImage = [];
       window.ondragover = function(e) {e.preventDefault()}
       window.ondrop = function(e) {e.preventDefault(); upload(e.dataTransfer.files[0]); }
   function upload(file) {
       if (!file || !file.type.match(/image.*/)) return;
       document.getElementById("addimg").classList.add('Загрузка');
       var fd = new FormData();
       fd.append("image", file);
       var xhr = new XMLHttpRequest();
       xhr.open("POST", "https://api.imgur.com/3/image.json");
       xhr.onload = function() {
           var imgurl = JSON.parse(xhr.responseText).data.link;
   
           MD.value(MD.value() + "\
   ![](" + imgurl + ")");
           featuredImage.push(imgurl);
           document.getElementById("addimg").classList.add('hasload');
   
   
       }
       xhr.setRequestHeader('Authorization', 'Client-ID 372d5f766d47d1d');
   
       xhr.send(fd);
   }
   
   var benif = [];
   var authorLogin = 'denis-skripnik';
   var authorWeight = 1;
   var maxweightsum = 100 - authorWeight;
   var weightsum = 0;
   
   function updateText() {
       document.getElementById('out').innerHTML = 'Итоговый список: ' + JSON.stringify(benif);
   }
   
   function add() {
       var nick = document.getElementById('nick').value;
       var per = parseFloat(document.getElementById('per').value);
   
       if (weightsum + per > maxweightsum) {
           if (weightsum === 0) {
               alert("Процент превышает " + maxweightsum + "%.");
           } else {
               alert("Сумма процентов превышает " + maxweightsum + "%." +
                   " Вы можете ввести максимум " + (maxweightsum - weightsum) + "%.");
           }
       } else {
           if (nick === authorLogin) {
               benif[0].weight += per * 100;
           } else {
               benif.push({account: nick, weight: per * 100});
           }
   
           weightsum += per;
   
           updateText()
       }
   }
   
   benif.push({account: authorLogin, weight: authorWeight * 100});
   updateText();
   
   updateText();
   
           function handleFileSelectEvent(e)
           {
               //Получаем объект выбранных файлов
               var files = e.target.files;
               //Я не использую мульти выбор файлов для простоты. Поэтому берем сразу первый элемент массива
               var file = files[0];
   
               //Объект для чтения данных
               var reader = new FileReader();
   
               //Вызываем метод чтения содержимого
               reader.readAsText(file);
   
               //Отлавливаем рещультат
               reader.onload = function (fileObj)
               {
                   //console.log(fileObj.target.result);
                   //document.getElementById('file_content').innerHTML  = fileObj.target.result;
                   var splitted = fileObj.target.result.split('\n');
                   var content = "";
   
                   for (i = 2; i < splitted.length; i++) {
                       content += splitted[i];
                       content += '\n';
                   }
   
                   document.getElementById('content_title').value = splitted[0];
                   document.getElementById('content_tags').value = splitted[1];
                   MD.value(content);
               }
           }
   
           document.getElementById('files').addEventListener('change', handleFileSelectEvent);
   
   
   function fillContent(err, result) {
               if(err)return alert('Не найден пост ',Author, Permlink);
           console.log(result);
   
           var jmeta = JSON.parse(result.json_metadata);
          
           $('#content_title').val(result.title);
           $('#content_tags').val(jmeta.tags.join(' '));
           $('#content_image').val(jmeta.image.join(' '));
           $('#permlink_filde').val(result.permlink);
if (amount3 === 'VIZ') {
    $('#content_payouts').val(result.curation_percent/100);
} else {
    $('#content_payouts').val(result.percent_steem_dollars);
}
                      $('#blockchain_login').val(result.author);
                      FixParentPermForEdit = jmeta.tags[0];
           MD.value(result.body);
           $('#permlink_filde').fadeOut();
           $('.postedit').fadeOut();
   }

   function hasPost(Author, Permlink, callback)
   {
   if (chain.chainName === 'golos' || chain.chainName === 'viz') {
    chainApi.getContent(Author, Permlink, 0, function(err, result) {
if (result.author !== '') {
    callback(true);
 } else {
   callback(false);
}
})
} else { 
chainApi.getContent(Author, Permlink, function(err, result) {
if (result.author !== '') {
    callback(true);
 } else {
   callback(false);
}
})
}
   }
       
   $("#load4edit").click(function() {
   
           var editUrl = document.getElementById("postediturl").value.toLowerCase();
           if(!editUrl)return alert('Введите ссылку!');
           var urlPrepare = editUrl.split("@");
            urlPrepare = urlPrepare[1].split("/")
           var Permlink = urlPrepare[1].replace('/','').replace(/ /g,'');
           var Author = urlPrepare[0].replace(/ /g,'');
           if(!Author||!Permlink)return alert('Ссылка не действительна!')
   
           if (chain.chainName === 'golos') {
            chainApi.getContent(Author, Permlink, 0, fillContent)
    } else {
        chainApi.getContent(Author, Permlink, fillContent)
    }

   });

   if (localStorage.getItem('PostingKey')) {
    var quote_author = localStorage.getItem('garlic:dpos.space*>form>input.blockchain_login');
    var author = quote_author.replace(/['"]+/g, '');
    var isPostingKey = sjcl.decrypt(author + '_postingKey', localStorage.getItem('PostingKey'));
    $('#posting_key').val(isPostingKey);
    $('#posting_key_delete').css('display', 'block');
$('#posting_key_form').css('display', 'none');
} else {
    $('#posting_key_delete').css('display', 'none');
}

$("#delete_active_key_link").click(function() {
    localStorage.removeItem('PostingKey'); $('#posting_key').val(); $('#posting_key_delete').css('display', 'none'); $('#posting_key_form').css('display', 'block');
});

   function post_submit() {
   var title = document.getElementById('content_title').value;
   var body = document.getElementById('content_text').value;
   if (document.getElementById('content_tags').value === '') {
    var content_tags = 'dpos-post';
   } else {
    var content_tags = document.getElementById('content_tags').value + ' ru--megagalxyan dpos-post';
   }
    var content_image = document.getElementById('content_image').value.replace(/ /g, '');
   var author = document.getElementById('blockchain_login').value;
   var wif = document.getElementById('posting_key').value;
   var default_permlink = "published-" + parseInt(new Date().getTime()/1000);
   var user_permlink = document.getElementById('permlink_filde').value;
if (amount3 !== 'VIZ') {
   var percent_steem_dollars = document.getElementById('content_payouts').value;
}

if (!user_permlink) {
       var permlink = default_permlink;
   } else {
       var permlink = user_permlink;
   }
   
           tagspace = content_tags.toLowerCase().replace(/,/g, ' ').replace(/  /g, ' '),
           tagsraw = tagspace.split(' '),
           tags = [];
       for (tag of tagsraw) {
        if (amount3 === 'VIZ') {
            tags.push(tag);
        } else {
            tags.push(transform(tag, "-"))        
        }
       }
   
       if (document.getElementById('content_tags').value === '') {
        var parentPermlink = content_tags;
       } else {
        var parentPermlink = tags[0];
       }
       var jsonMetadata = {
   "app": "dpos.space/post",
   "format": "markdown",
   "tags": tags,
   "image": (content_image)?[content_image]:featuredImage
   };
   var isSavePosting = document.getElementById('isSavePosting');
			if (isSavePosting.checked) {
		localStorage.setItem('PostingKey', sjcl.encrypt(author + '_postingKey', wif));
			}

   function postSender(isEdit) {
    console.log(isEdit);
    if (isEdit === true) {
        if (amount3 === 'VIZ') {
                viz.broadcast.content(wif, '', '', author, permlink, title, body, percent_steem_dollars, JSON.stringify(jsonMetadata), [], function(err, result) {
if (err) {
                    if(err == 'AssertionError: private_key required') {
                    alert('Ошибка: Приватный постинг ключ обязателен к вводу!');
                                  } else {
                    alert(err);
                    }
                    } else {
                  alert('Пост отредактирован успешно! \n URL поста: \n@' + author + '/' + permlink);
                }
                  });
            } else {
            const operations = [
                ['comment', {'parent_author':'','parent_permlink':parentPermlink,'author':author,'permlink':permlink,'title':title,'body':body,'json_metadata':JSON.stringify(jsonMetadata)}]];

                chainBroadcast.send({extensions: [], operations}, [wif], function(err, res) {
                    if(err) {
                        if(err == 'RPCError: Assert Exception:( now - auth.last_root_post ) > STEEM_MIN_ROOT_COMMENT_INTERVAL: You may only post once every 5 minutes.') {
                        alert('Подождите хотя-бы 5 минут перед публикацией следующего поста!');
               } else if(err == 'AssertionError: private_key required') {
                        alert('Ошибка: Приватный постинг ключ обязателен к вводу!');
                                      } else {
                        alert(err);
                        }
                        } else {
                      alert('Пост отредактирован успешно! \n URL поста: \n@' + author + '/' + permlink);
                    }
                })
            }
   } else {
    if (amount3 === 'VIZ') {
        var json=['content',{parent_permlink:'',author:author,permlink:permlink,title:title,body:body,metadata:jsonMetadata}];

        viz.broadcast.custom(wif, [], [author], 'media', JSON.stringify(json), function(err, result) {
            if(err) {
if(err == 'AssertionError: private_key required') {
                alert('Ошибка: Приватный постинг ключ обязателен к вводу!');
                              } else {
                alert(err);
                }
                } else {
              alert('Пост опубликован успешно! \n URL поста: \n@' + author + '/' + permlink);
            }
        });
} else {
    const operations = [
        ['comment', {'parent_author':'','parent_permlink':parentPermlink,'author':author,'permlink':permlink,'title':title,'body':body,'json_metadata':JSON.stringify(jsonMetadata)}],['comment_options',{'author':author,'permlink':permlink,'max_accepted_payout':'1000000.000 '+amount3,'percent_steem_dollars':+percent_steem_dollars,'allow_votes':true,'allow_curation_rewards':true,'extensions':[[0,{'beneficiaries':benif}]]}]];
        chainBroadcast.send({extensions: [], operations}, [wif], function(err, res) {
            if(err) {
                if(err == 'RPCError: Assert Exception:( now - auth.last_root_post ) > STEEM_MIN_ROOT_COMMENT_INTERVAL: You may only post once every 5 minutes.') {
                alert('Подождите хотя-бы 5 минут перед публикацией следующего поста!');
       } else if(err == 'AssertionError: private_key required') {
                alert('Ошибка: Приватный постинг ключ обязателен к вводу!');
                              } else {
                alert(err);
                }
                } else {
              alert('Пост опубликован успешно! \n URL поста: \n@' + author + '/' + permlink);
            }
        })    
}
   }
}
   hasPost(author, permlink, postSender);
   }
       function reset_button() {
       var reset_q = window.confirm('Вы действительно хотите очистить форму?');
   if (reset_q == true) {
    $('form input[type="text"]:not(#blockchain_login), form textarea').val('');
       MD.value('');
    }
   }