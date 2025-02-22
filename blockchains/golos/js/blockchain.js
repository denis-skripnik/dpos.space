function checkWorkingNode() {
    const NODES = [
        "https://api-golos.blckchnd.com",
        "https://api.aleksw.space",
        "https://api-full.golos.id"
    ];
    let node = localStorage.getItem("golos_node") || NODES[0];
    const idx = Math.max(NODES.indexOf(node), 0);
    let checked = 0;
    const find = (idx) => {
        if (idx >= NODES.length) {
            idx = 0;
        }
        if (checked >= NODES.length) {
            alert("no working nodes found");
            return;
        }
        node = NODES[idx];
        console.log("check", idx, node);
        golos.config.set("websocket", node);
        try {
            golos.api.stop();
        } catch(e) {
        }
        
        let timeout = false;
        let timer = setTimeout(() => {
            console.log("timeout", NODES[idx])
            timeout = true;
            find(idx + 1);
        }, 3000);
        golos.api.getDynamicGlobalPropertiesAsync()
            .then(props => {
                if(!timeout) {
                    check = props.head_block_number;
                    console.log("found working node", node);
                    localStorage.setItem("golos_node", node);
                    clearTimeout(timer);
                }
            })
            .catch(e => {
                console.log("connection error", node, e);
                find(idx + 1);
            });
    }
    find(idx);
}
checkWorkingNode();

const API_HOST = 'https://golos.app';

let current_user = JSON.parse(localStorage.getItem("golos_current_user"));
if (current_user && !current_user.type || current_user && current_user.type !== 'golos.app') {
    if (document.querySelector('.oauth_login')) {
        golos.config.set('oauth.client', 'dposspace');
        golos.config.set('oauth.host', API_HOST);
        golos.config.set('websocket', API_HOST + '/api/oauth/sign');
        golos.config.set('credentials', 'include');
        golos.use(new middlewares.MultiAuthMiddleware())
    }
    
    var golos_login = current_user.login;
var posting_key = sjcl.decrypt('dpos.space_golos_' + golos_login + '_postingKey', current_user.posting);
var active_key = sjcl.decrypt('dpos.space_golos_' + golos_login + '_activeKey', current_user.active);
$( document ).ready(function() {
    if (!posting_key) {
        document.getElementById('auth_msg').style = 'display: block';
        document.getElementById('posting_page').style = 'display: none';
       }
if (!active_key) {
    document.getElementById('active_auth_msg').style = 'display: block';
    document.getElementById('active_page').style = 'display: none';
}
});    
} else if (current_user && current_user.type === 'golos.app') {
        golos.config.set('oauth.client', 'dposspace');
        golos.config.set('oauth.host', API_HOST);
        golos.config.set('websocket', API_HOST + '/api/oauth/sign');
        golos.config.set('credentials', 'include');
        golos.use(new middlewares.MultiAuthMiddleware())

    var golos_login = current_user.login;
    var posting_key = current_user.posting;
    var active_key = current_user.active;
    $( document ).ready(function() {
            if (typeof posting_key === 'undefined') {
            if (document.getElementById('auth_msg')) document.getElementById('auth_msg').style = 'display: block';
            if (document.getElementById('posting_page')) document.getElementById('posting_page').style = 'display: none';
            } else {
                if (document.getElementById('auth_msg')) document.getElementById('auth_msg').style = 'display: none';
                if (document.getElementById('posting_page')) document.getElementById('posting_page').style = 'display: block';
        }
    if (!typeof active_key === 'undefined') {
        if (document.getElementById('active_auth_msg')) document.getElementById('active_auth_msg').style = 'display: block';
        if (document.getElementById('active_page')) document.getElementById('active_page').style = 'display: none';
    } else {
        if (document.getElementById('active_auth_msg')) document.getElementById('active_auth_msg').style = 'display: none';
        if (document.getElementById('active_page')) document.getElementById('active_page').style = 'display: block';
    }
    });    
} else {
        golos.config.set('oauth.client', 'dposspace');
        golos.config.set('oauth.host', API_HOST);
        golos.config.set('websocket', API_HOST + '/api/oauth/sign');
        golos.config.set('credentials', 'include');
        golos.use(new middlewares.MultiAuthMiddleware())

    $( document ).ready(function() {
        let active_auth_msg = document.getElementById('active_auth_msg');
        let auth_msg = document.getElementById('auth_msg');
        if (active_auth_msg) {
        document.getElementById('active_auth_msg').style = 'display: block';
        }
        if (auth_msg) {
            document.getElementById('auth_msg').style = 'display: block';
            }
            let posting_page = document.getElementById('posting_page');
            let active_page = document.getElementById('active_page');
            if (posting_page) {
                document.getElementById('posting_page').style = 'display: none';
                }
                if (active_page) {
                    document.getElementById('active_page').style = 'display: none';
                    }
    });
        }

var users = JSON.parse(localStorage.getItem('golos_users'));
$( document ).ready(function() {
            if (users && users.length > 0) {
                document.getElementById('show_accounts_list').style = 'display: block';
    } else {
        document.getElementById('show_accounts_list').style = 'display: none';
    }
            });

            function spoiler(elem, group){
                style = document.getElementById(elem).style;
                if(document.querySelector("#" + elem).classList.contains(group) && style.display === 'none') {
                    $('.' + group).hide();
                }
    
                style.display = (style.display == 'block') ? 'none' : 'block';
            }
    
function selectAccount() {
    let current_user = JSON.parse(localStorage.getItem("golos_current_user"));
    users = JSON.parse(localStorage.getItem('golos_users'));
    if (users) {
    let radioButtons = '';
    if (users.length === 1) {
        radioButtons += '<input type="radio" name="users" value="' + users[0].login + '" placeholder="' + users[0].login + '" checked> ' + users[0].login + ', <a onclick="deleteAccount(`' + users[0].login + '`);">Удалить</a><br />';
    } else if (users.length > 1) {
    for (user of users) {
        if (current_user.login === user.login) {
        radioButtons += '<input type="radio" name="users" value="' + user.login + '" placeholder="' + user.login + '" checked> ' + user.login + ', <a onclick="deleteAccount(`' + user.login + '`);">Удалить</a><br />';
        }     else {
            radioButtons += '<input type="radio" name="users" value="' + user.login + '" placeholder="' + user.login + '"> ' + user.login + ', <a onclick="deleteAccount(`' + user.login + '`);">Удалить</a><br />';
        }
    }
    }
    $('#accounts').html(radioButtons);
}
}

async function deleteAccount(login) {
    let new_list = [];
    if (users.length > 1) {
    for (let user of users) {
        if (user.login === login && user.type === 'golos.app') {
            await golos.multiauth.logout();

        }
    
        if (user.login !== login) {
        new_list.push(user);
    }
    }
    localStorage.setItem("golos_users", JSON.stringify(new_list));
    selectAccount()
    $('#delete_msg').html('Аккаунт ' + login + ' удалён из списка.');
    } else if (users.length === 1) {
        selectAccount()
            $('#delete_msg').html('Аккаунт ' + login + ' удалён из списка.');
            localStorage.removeItem('golos_users');
            localStorage.removeItem('golos_current_user');
        }
}

function getRadioValue(radioboxGroupName)
{
    group=document.getElementsByName(radioboxGroupName);
    for (x=0;x<group.length;x++)
    {
        if (group[x].checked)
        {
if (users) {
for (let user of users) {
if (user.login === group[x].value && !user.type || user.login === group[x].value && user.type && user.type !== 'golos.app') {
    let acc_data = {login: user.login, posting: user.posting, active: user.active, memo: user.memo_key};
    localStorage.setItem("golos_current_user", JSON.stringify(acc_data));
$('#select_msg').html('Аккаунт ' + user.login + ' выбран. <font color="red"><a onclick="location.reload();">Обновить страницу</a></font>');
} else if (user.login === group[x].value && user.type && user.type === 'golos.app') {
    let acc_data = {login: user.login, posting: user.posting, active: user.active, type: user.type, memo: user.memo_key};
    localStorage.setItem("golos_current_user", JSON.stringify(acc_data));
$('#select_msg').html('Аккаунт ' + user.login + ' выбран. <font color="red"><a onclick="location.reload();">Обновить страницу</a></font>');
}
}
}
                return (group[x].value);
        }
    }
    return (false);
}

function sendAjax(url, id) {
    const request = new XMLHttpRequest();
 
request.open('GET', url);
request.setRequestHeader('Content-Type', 'application/x-www-form-url');

request.addEventListener("readystatechange", () => {
	if (request.readyState === 4 && request.status === 200) {
document.getElementById(id).innerHTML = request.responseText;
    }
});
 
// Выполняем запрос 
request.send();
}

var START_MODE = 'start';
var NEXT_MODE = 'next';
var PREVIOUS_MODE = 'previous';
var paginationParams = {
    'ajax_page': [],
          };
var ajax_options = {};
   var page = 1;
  
  var getLoad = (tabName, columnId, nextButtonText, previousButtonText) => {
      return (mode) => {
      const params = {options: ajax_options};
      switch (mode) {
        case START_MODE: {
            page = 1;
          break;
        }
        case NEXT_MODE: {
          page++;
          params.start = paginationParams['ajax_page'][page - 2];
          break;
        }
        case PREVIOUS_MODE: {
          page--;
          if (page !== 1) {
            params.start = paginationParams['ajax_page'][page - 2];
          }
          break;
        }
    }
    $.get(tabName, params).done(function(result){
        let res = JSON.parse(result);

        $(`#${columnId}`).html(res.content);

        // если страница не первая, нужна кнопка шага назад
        if (page !== 1) {
          const previousButtonId = `previous_ajax_page`;
          $(`#${columnId}`).append(`<button id="${previousButtonId}">${previousButtonText}</button>`);
          $(`#${previousButtonId}`).click(() => {
            getLoad(tabName, columnId, nextButtonText, previousButtonText)(PREVIOUS_MODE);
          });
        }
  
        // если есть следующая страница, нужна кнопка шага вперёд
        if (res.nextIsExists) {
          paginationParams['ajax_page'][page - 1] = res.next;
          const nextButtonId = `next_ajax_page`;
          $(`#${columnId}`).append(`<button id="${nextButtonId}" style="float: right">${nextButtonText}</button>`);
          
          $(`#${nextButtonId}`).click(() => {
            getLoad(tabName, columnId, nextButtonText, previousButtonText)(NEXT_MODE);
          });
        }

        // если это первая страница, а данных больше нет - показываем сообщение об этом
        if (page === 1 && ! res.nextIsExists) {
          $(`#${columnId}`).append('<span>Последняя страница с данными</span>');
        }
  
        $('table#rewards-ol, table#delegat-ol').attr('start', page * 50 - 49);
      }, 'json');
    }
  };

  $(document).on('click', '.ajax_modal', function(e) {
    let url = $(this).attr('data-url');
    let params_str = $(this).attr('data-params');
    let params_array = params_str.split('&');
    for (let param of params_array) {
        let data = param.split('=');
        ajax_options[data[0]] = data[1];
    }
    getLoad(url, 'ajax_modal_content', 'Следующие 10', 'Предыдущие 10')(START_MODE);
});

function copyText(id) {
    let text = document.getElementById(id);
    text.select();    
  document.execCommand("copy");
    }

    function getParameterByName(name) {
        const urlParams = new URLSearchParams(window.location.hash.substring(1));
        return urlParams.get(name) || "";
      }