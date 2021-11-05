var author = golos_login;

function bind_range(){
	$('input[type=range]').each(function(i){
		if(typeof $(this).attr('data-fixed') !== 'undefined'){
			let fixed_name=$(this).attr('data-fixed');
			let fixed_min=parseInt($(this).attr('min'));
			let fixed_max=parseInt($(this).attr('max'));
			$(this).unbind('change');
			$(this).bind('change',function(){
				if($(this).is(':focus')){
					$('input[name='+fixed_name+']').val($(this).val());
				}
			});
			$('input[name='+fixed_name+']').unbind('change');
			$('input[name='+fixed_name+']').bind('change',function(){
				let fixed_name=$(this).attr('data-fixed');
				let val=parseInt($(this).val());
				if(val>fixed_max){
					val=fixed_max;
				}
				if(val<fixed_min){
					val=fixed_min;
				}
				$(this).val(val);
				$('input[name='+fixed_name+']').val($(this).val());
			});
		}
	});
}

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

    autofocus: false,
    autosave: {
        enabled: true,
        uniqueId: "content_text",
        delay: 3000,
    },
    blockStyles: {
        bold: "**",
        italic: "*"
    },
    element: document.getElementById("content_text"),
    forceSync: true,
    spellChecker: true,
    indentWithTabs: true,
    insertTexts: {
        horizontalRule: ["", "\n\n-----\n\n"],
        image: ["![](","#url#)"],
        link: ["[","](#url#)"],
        table: ["", "\n\n| Column 1 | Column 2 | Column 3 |\n| -------- | -------- | -------- |\n| Text     | Text      | Text     |\n\n"],
    },

    parsingConfig: {
        allowAtxHeaderWithoutSpace: true,
        strikethrough: true,
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

function loadStorage() {
        benif = localStorage.getItem('array') ? JSON.parse(localStorage.getItem('array')) : [];

        if (benif.length) {
            benif.forEach(a => weightsum += (a.weight/100));
        }

        document.getElementById('per').setAttribute('max', maxweightsum - weightsum);
}

function updateStorage() {
    localStorage.removeItem('array');
        localStorage.setItem('array', JSON.stringify(benif));
}

function updateText() {
       const table = document.getElementById('out');
     
     while (table.getElementsByTagName('tr').length > 1) {
         table.deleteRow(1);
     }		

       for (const element of benif) {
         var row = table.insertRow(1);

         row.insertCell(0).innerHTML = element.account;
         row.insertCell(1).innerHTML = element.weight;
         if (element.account !== authorLogin) {
             row.insertCell(2).innerHTML = `<button type="button" onclick="deleteElement('${element.account}', ${element.weight})">Удалить</button>`;
         }
       }

       document.getElementById('json').innerHTML = JSON.stringify(benif)
}

function addElement(account, weight) {
        if (benif.length && account === authorLogin) {
            const current = benif.find(a => a.account === authorLogin);

            if (!current) {
                benif.push({
                    account: account,
                    weight: weight
                });
            }

            return;
        }

        benif.push({
            account: account,
            weight: weight
        });

        updateStorage();
}

function deleteElement(account, w) {
        benif = benif.filter((element) => (
            element.account !== account
        ));

        var per = parseFloat(document.getElementById('per').value);
        weightsum -= w/100
        document.getElementById('per').setAttribute('max', maxweightsum - weightsum);

        updateText();
        updateStorage();
}

function add() {
    var nick = document.getElementById('nick').value;
    var per = parseFloat(document.getElementById('per').value);

    if (!nick) {
            return alert('Вы не введи ник');
    }

    if (!per) {
            return alert('Нельзя добавить с нулевым значением процента');
    }

    const current = benif.find(a => a.account === nick);

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
                if (current) {
                    current.weight += per * 100;
                } else {
                 addElement(nick, per * 100);
                }
        }

        weightsum += per;
        document.getElementById('per').setAttribute('max', maxweightsum - weightsum);

        updateText()
    }
}

loadStorage();

addElement(authorLogin, authorWeight*100);
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
        $(`#content_category option[value=${result.category}]`).attr("selected", "selected");
        $('#content_tags').val(jmeta.tags.join(' '));
        $('#content_image').val(jmeta.image.join(' '));
        $('#permlink_filde').val(result.permlink);
 $('#content_payouts').val(result.percent_steem_dollars);
                   $('#blockchain_login').val(result.author);
                   FixParentPermForEdit = jmeta.tags[0];
        MD.value(result.body);
        $('#permlink_filde').fadeOut();
        $('.postedit').fadeOut();
}

function hasPost(Author, Permlink, callback)
{
 golos.api.getContent(Author, Permlink, 0, function(err, result) {
if (result.author !== '') {
 callback(true);
} else {
callback(false);
}
})
}
    
$("#load4edit").click(function() {

        var editUrl = document.getElementById("postediturl").value.toLowerCase();
        if(!editUrl)return alert('Введите ссылку!');
        if (editUrl.indexOf('?') > -1) {
            editUrl = editUrl.split('?')[0];
        }
        var urlPrepare = editUrl.split("@");
         urlPrepare = urlPrepare[1].split("/")
        var Permlink = urlPrepare[1].replace('/','').replace(/ /g,'');
        var Author = urlPrepare[0].replace(/ /g,'');
        if(!Author||!Permlink)return alert('Ссылка не действительна!')

         golos.api.getContent(Author, Permlink, 0, fillContent)

});

golos.api.getChainProperties(function(err, res) {
if (!err) {
 $('#curation_rewards_percent').attr("min", res.min_curation_percent/100);
 $('#curation_rewards_percent').attr("max", res.max_curation_percent/100);
} else {
console.log(err);
}
});

function post_submit() {
var title = document.getElementById('content_title').value;
var body = document.getElementById('content_text').value;
var category = document.getElementById('content_category').value;
if (document.getElementById('content_tags').value === '') {
 var content_tags = 'dpos-post';
} else {
 var content_tags = document.getElementById('content_tags').value + ' dpos-post';
}
 var content_image = document.getElementById('content_image').value.replace(/ /g, '');
var percent_steem_dollars = document.getElementById('content_payouts').value;
var default_permlink = transform(title, "-");
default_permlink=default_permlink.replace(/([^a-zA-Z0-9 \-]*)/g,'');
default_permlink=default_permlink.replace(/---/g,'-');
default_permlink=default_permlink.replace(/--/g,'-');
default_permlink=default_permlink.replace(/--/g,'-');
default_permlink=default_permlink.replace(/^\-+|\-+$/g, '');
var user_permlink = document.getElementById('permlink_filde').value.toLowerCase().replace(/\,/g, '-').replace(/\./g, '-');
if (!user_permlink) {
    var permlink = default_permlink;
} else {
    var permlink = user_permlink;
}

        tagspace = content_tags.toLowerCase().replace(/,/g, ' ').replace(/  /g, ' '),
        tagsraw = tagspace.split(' '),
        tags = [];
    for (tag of tagsraw) {
         tags.push(transform(tag, "-"));
         }

              var parentPermlink = category;
    var jsonMetadata = {
"app": "dpos.space/post",
"format": "markdown",
"tags": tags,
"image": (content_image)?[content_image]:featuredImage
};
var curator_rewards_percent = document.getElementById('curation_rewards_percent').value;
curator_rewards_percent = parseInt(curator_rewards_percent)*100;
var content_datetime = document.getElementById('content_datetime').value;
var review_period_time;
if (content_datetime) {
content_datetime = new Date(content_datetime).toISOString().split('.')[0];
review_period_time = parseInt(120000 + new Date().getTime());
review_period_time = new Date(review_period_time).toISOString().split('.')[0];
}

function postSender(isEdit) {
 console.log(isEdit);
 if (isEdit === true) {
    var q = window.confirm('Пост с таким permlink уже есть. его отправка повлечёт не создание нового, а изменение старого поста. Вы действительно хотите это сделать?')
         if (q === true) {
            var wif = posting_key;
            const operations = [
             ['comment', {'parent_author':'','parent_permlink':parentPermlink,'author':author,'permlink':permlink,'title':title,'body':body,'json_metadata':JSON.stringify(jsonMetadata)}]];
             golos.broadcast.send({extensions: [], operations}, [wif], function(err, res) {
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
                   reset_button();
                }
             });
         } else {
window.alert('Вы отказались отправлять изменения. Проверьте пермлинк в расширенных настройках.');
         }
} else {
 const extensions = [];
extensions.push([0,{beneficiaries:benif}]);
 extensions.push([2,{percent:+curator_rewards_percent}]);
let operations;
if (content_datetime && active_key !== '' || content_datetime && current_user.type === 'golos.app' && active_key === '') {
var wif = active_key;
    var resultWifToPublic = golos.auth.wifToPublic(wif);
 operations = [
     ["proposal_create",
     {
       "author": author,
       "title": permlink,
       "memo": author + '-' + permlink,
       "expiration_time": content_datetime,
       "proposed_operations": [
{"op":['comment', {'parent_author':'','parent_permlink':parentPermlink,'author':author,'permlink':permlink,'title':title,'body':body,'json_metadata':JSON.stringify(jsonMetadata)}]},{"op":['comment_options',{'author':author,'permlink':permlink,'max_accepted_payout':'1000000.000 GBG','percent_steem_dollars':+percent_steem_dollars,'allow_votes':true,'allow_curation_rewards':true,extensions}]}],
       "review_period_time": review_period_time,
       "extensions": []
}]
,["proposal_update",
{
"author": author,
"title": permlink,
"active_approvals_to_add": [],
"active_approvals_to_remove": [],
"owner_approvals_to_add": [],
"owner_approvals_to_remove": [],
"posting_approvals_to_add": [],
"posting_approvals_to_remove": [],
"key_approvals_to_add": [resultWifToPublic],
"key_approvals_to_remove": [],
"extensions": []
}
]];
} else if (content_datetime && active_key === '' && current_user.type !== 'golos.app') {
$('#auth_msg').html('<p>Вы не указали на странице авторизации активный ключ, который необходим для отложенного постинга. Просьба перейти по ссылке "войти" в меню, удалить аккаунт из списка и ввести данные заново.</p>');
} else {
    var wif = posting_key;
    operations = [
 ['comment', {'parent_author':'','parent_permlink':parentPermlink,'author':author,'permlink':permlink,'title':title,'body':body,'json_metadata':JSON.stringify(jsonMetadata)}],['comment_options',{'author':author,'permlink':permlink,'max_accepted_payout':'1000000.000 GBG','percent_steem_dollars':+percent_steem_dollars,'allow_votes':true,'allow_curation_rewards':true,extensions}]];
}
console.log(JSON.stringify(operations));
golos.broadcast.send({extensions: [], operations}, [wif], function(err, res) {
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
           alert('Пост опубликован успешно! \n URL поста: \n@' + author + '/' + permlink);
           reset_button();
        }
     })    
}
}
hasPost(author, permlink, postSender);
}
    function reset_button() {
    var reset_q = window.confirm('Вы действительно хотите очистить форму?');
if (reset_q == true) {
 $('form input[type="text"]:not(#blockchain_login), form textarea').val('');
 $('#content_category').prop('selectedIndex',0);
 MD.value('');
 }
}

 if(0<$('input[type=range]').length){
   bind_range();
 }