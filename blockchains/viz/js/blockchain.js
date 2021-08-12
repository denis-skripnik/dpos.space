function checkWorkingNode() {
    const NODES = [
		"https://viz-node.dpos.space/",
        "https://node.viz.plus",
        "https://vizrpc.lexai.host/",
                "https://viz.lexai.host/",
                "https://node.viz.cx",
                "https://node.viz.media"
            ];
    let node = localStorage.getItem("viz_node") || NODES[0];
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
        viz.config.set("websocket", node);
        try {
            viz.api.stop();
        } catch(e) {
        }
        
        let timeout = false;
        let timer = setTimeout(() => {
            console.log("timeout", NODES[idx])
            timeout = true;
            find(idx + 1);
        }, 3000);
        viz.api.getDynamicGlobalPropertiesAsync()
            .then(props => {
                if(!timeout) {
                    check = props.head_block_number;
                    console.log("found working node", node);
                    localStorage.setItem("viz_node", node);
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

var current_user={};
if(typeof localStorage.viz_current_user !=='undefined'){
current_user = JSON.parse(localStorage.viz_current_user);
}
if (current_user && !current_user.type || current_user&& current_user.type && current_user.type !== 'vizonator') {
var viz_login = current_user.login;
var posting_key = sjcl.decrypt('dpos.space_viz_' + viz_login + '_regularKey', current_user.regular);
var active_key = sjcl.decrypt('dpos.space_viz_' + viz_login + '_activeKey', current_user.active);
$( document ).ready(function() {
    if (!posting_key) {
        if (document.getElementById('auth_msg')) document.getElementById('auth_msg').style = 'display: block';
        if (document.getElementById('posting_page')) document.getElementById('posting_page').style = 'display: none';
       }
if (!active_key) {
    if (document.getElementById('active_auth_msg')) document.getElementById('active_auth_msg').style = 'display: block';
    if (document.getElementById('active_page')) document.getElementById('active_page').style = 'display: none';
}
});    
} else if (current_user && current_user.type === 'vizonator') {
    var viz_login = current_user.last_login;
$( document ).ready(function() {
if (current_user.isActive === false) {
if(document.getElementById('active_auth_msg')) document.getElementById('active_auth_msg').style = 'display: block';
if (document.getElementById('active_page')) document.getElementById('active_page').style = 'display: none';
}
});    
} else {
    $( document ).ready(function() {
        if (!posting_key) {
            if (document.getElementById('auth_msg')) document.getElementById('auth_msg').style = 'display: block';
            if (document.getElementById('posting_page')) document.getElementById('posting_page').style = 'display: none';
            if (document.getElementById('active_page')) document.getElementById('active_page').style = 'display: none';   
        }
        });
        }

var users = JSON.parse(localStorage.getItem('viz_users'));
$( document ).ready(function() {
        if (users && users.length > 0) {
            document.getElementById('show_accounts_list').style = 'display: block';
} else {
    document.getElementById('show_accounts_list').style = 'display: none';
}
        });

function sendToVizonator(type, options) {
    if(typeof vizonator !== "undefined"){
        vizonator.get_account(function(error,result){
            if(!error && result.login === viz_login) {
                if (type === 'withdraw_vesting') {
                    vizonator.withdraw_vesting(options,function(error,result){
                        if(!error && options.vesting_shares === '0.000000 SHARES'){
                            window.alert('Вывод отменён');
                                $('#info_vesting_withdraw').css('display', 'none');
                    } else if(!error && options.vesting_shares !== '0.000000 SHARES'){
                        window.alert('Вывод запущен на .' + options.vesting_shares);
location.reload();
                              } else {
                            window.alert(error);
                        } // end if not error.
                    }); // end broadcast.
                    } // end withdraw_vesting.
                    else if (type === 'delegate_vesting_shares') {
                        vizonator.delegate_vesting_shares(options,function(error,result){
                            if(!error && options.vesting_shares === '0.000000 SHARES'){
                                window.alert('Делегирование пользователю ' + options.delegatee + ' отменено.');
                                $('#delegated_vesting_shares_' + options.delegatee).css("display", "none");
                            } else if(!error && options.vesting_shares !== '0.000000 SHARES'){
                                window.alert('Вы делегировали ' + action_vesting_delegate_amount + '.');
                                location.reload();
                            } else {
                                window.alert(error);
                            }
                            });
                    } // end type delegate_vesting_shares.
                    else if (type === 'transfer') {
                        vizonator.transfer(options,function(error,result){
                            if(!error){
                                let memo_array = JSON.parse(options.memo);
                                if (memo_array && memo_array.contractName === "viz-votes" && memo_array.contractAction === "createVote") {
                                    window.alert('Опрос успешно создан.');
                                } else if (options.to === 'viz-projects' && memo_array) {
                                    window.alert('Операция произведена успешно.');
                                                                } else {
                                    window.alert('Вы успешно перевели ' + options.amount + ' пользователю ' + ptions.to);
                                    location.reload();
                                }
                            } else {
                                window.alert('Ошибка: ' + error);
                                }
                        });
                    } // end transfer.
                    else if (type === 'transfer_to_vesting') {
    vizonator.transfer_to_vesting(options,function(error,result){
        if(!error && options.to === viz_login){
            window.alert('Вы успешно перевели ' + options.amount + ' viz в SHARES своего аккаунта.');
            location.reload();
        } else if(!error && to === viz_login){
            window.alert('Вы перевели ' + options.amount + ' пользователю ' + options.to + ' в SHARES.');
            location.reload();
        } else {
            window.alert('Ошибка: ' + error);
            }
    });
} // end transfer_to_vesting.
                     else if (type === 'committee_vote_request') {
                        vizonator.committee_vote_request(options,function(error,result){
                            if(!error){
                                window.alert('Вы успешно проголосовали за заявку.');
                            } else {
                                window.alert('Ошибка: ' + JSON.stringify(error));
                            }
                        });
                     } // end committee_vote_request.
                     else if (type === 'custom') {
                        let authority_type="regular";//can be "active"
                        let protocol_id= options.protocol_id;
                        let json_data= options.json;
                        vizonator.custom({authority:authority_type,id:protocol_id,json:json_data},function(error,result){
                            if (!error) {
                                window.alert('Успешно.');
                            } else {
                                window.alert('Ошибка: ' + JSON.stringify(error));
                            }
                        });
                     } // end custom
                     else if (type === 'award') {
                        vizonator.award(options,function(err,result){
                            if (!err) {
                                viz.api.getAccountsAsync([viz_login], (err, res) => {
                                    $('#account_energy').html(res[0].energy/100 + '%');
                                    });
                                jQuery("#main_award_info").css("display", "block");
                            let all_award_payout = parseFloat(result.approximate_amount);
                                let beneficiaries = JSON.parse(options.beneficiaries);
                            let w = 0;
                                for (let beneficiarie of beneficiaries) {
w += parseInt(beneficiarie.weight )/ 100;
                            }
                                let beneficiaries_payout = all_award_payout * (w / 100);
                                let award_payout = all_award_payout - beneficiaries_payout;
                            $('#main_award_info').html(`<h1>Результат:</h1>
                        <p><strong>Вы успешно отправили награду.</strong></p>
                        <ul><li>Направление: ${options.receiver}</li>
                        <li>Затрачиваемый процент энергии: ${options.energy/100}%</li>
                        <li>Примерная награда в SHARES:
                        общая: ${all_award_payout},
                        Бенефициарам: ${beneficiaries_payout},
                        Награждаемому: ${award_payout}</li>
                        <li>Номер Custom операции (С каждой операцией он увеличивается в get_accounts): ${options.custom_sequence}</li>
                        <li>Заметка (Memo, описание; назначение может быть любым): ${options.memo}</li>
                        <li>Бенефициары: ${options.beneficiaries}</li>
                        <li>Осталось энергии на момент последней награды: <span id="account_energy"></span></li>
                        </ul>`);
                        } else {
                            if (/used_energy <= current_energy/.test(err)) {
                                jQuery("#main_award_info").css("display", "block");
                                $('#main_award_info').html(`<h1>Указанный вами процент энергии > имеющейся у авторизованного аккаунта</h1>
                        <p align="center">Просьба проверить значение energy в адресной строке или ввести новое в <a href="/viz/awards" target="_blank">форме</a>.</p>`);
                            } else if (/beneficiaries.weight = NaN/.test(err)) {
                                jQuery("#main_award_info").css("display", "block");
                                $('#main_award_info').html(`<h1>Вы указали бенефициара, но не указали процент, который он получит</h1>
                        <p align="center">Просьба проверить значение после двоеточия в beneficiaries (адресная строка) или ввести новое в <a href="/viz/awards" target="_blank">форме</a>.</p>`);
                            } else if (/acc != nullptr: Beneficiary/.test(err)) {
                                jQuery("#main_award_info").css("display", "block");
                                $('#main_award_info').html(`<h1>1 или несколько аккаунтов бенефициаров не существует.</h1>
                        <p align="center">Просьба проверить значение beneficiaries в адресной строке или ввести новое в <a href="/viz/awards" target="_blank">форме</a>.</p>`);
                            } else if (/is_valid_account_name\(name\): Account name/.test(err)) {
                                jQuery("#main_award_info").css("display", "block");
                                $('#main_award_info').html(`<h1>Аккаунт награждаемого или бенефициара не существует.</h1>
                        <p align="center">Просьба проверить значение target и beneficiaries (Первую часть до двоеточия) в адресной строке.  Также можно ввести новое в <a href="/viz/awards" target="_blank">форме</a>.</p>`);
                        } else {
                        window.alert('Ошибка: '  + JSON.stringify(err));
                    }
                        }
                });
            } // end type award.

                } // end not error.
        }); // end get account.
        } // end if vizonator.
} // end function

        function spoiler(elem, group){
            style = document.getElementById(elem).style;
            if(document.querySelector("#" + elem).classList.contains(group) && style.display === 'none') {
                $('.' + group).hide();
            }

            style.display = (style.display == 'block') ? 'none' : 'block';
        }

        function selectAccount() {
    let current_user = JSON.parse(localStorage.getItem("viz_current_user"));
    users = JSON.parse(localStorage.getItem('viz_users'));
    if (users) {
    let radioButtons = '';
    if (users.length === 1) {
        let message = users[0].login;
        let value = users[0].login;
let type = 'standart';
        if (users[0].type && users[0].type ==='vizonator') {
            message = 'Vizonator ' + users[0].last_login;
            value = users[0].last_login;
        let type = 'vizonator';
        }
        radioButtons += '<input type="radio" name="users" data-type="' + type + '" value="' + value + '" placeholder="' + message + '" checked> ' + message + ', <a onclick="deleteAccount(`' + value + '`);">Удалить</a><br />';
    } else if (users.length > 1) {
        for (user of users) {
            if (current_user.login && user.login && current_user.login === user.login) {
                let message = user.login;
            let value = user.login;
            let type = 'standart';
            if (user.type  && user.type ==='vizonator') {
                message = 'Vizonator аккаунт ' + user.last_login;
            value = user.last_login;
            type = 'vizonator';
        }
            radioButtons += '<input type="radio" name="users" data-type="' + type + '" value="' + value + '" placeholder="' + message + '" checked> ' + message + ', <a onclick="deleteAccount(`' + value + '`);">Удалить</a><br />';
        } else         if (current_user.type && current_user.type === 'vizonator' && current_user.last_login === user.last_login) {
            let message = 'Vizonator ' + user.last_login;
            let value = user.last_login;
            radioButtons += '<input type="radio" name="users" data-type="vizonator" value="' + value + '" placeholder="' + message + '" checked> ' + message + ', <a onclick="deleteAccount(`' + value + '`);">Удалить</a><br />';
        }     else {
            let message = user.login;
            let value = user.login;
let type = "standart";
            if (user.type  && user.type === 'vizonator') {
                message = 'Vizonator ' + user.last_login;
            value = user.last_login;
            type = 'vizonator';
        }
            radioButtons += '<input type="radio" name="users" data-type="' + type + '" value="' + value + '" placeholder="' + message+ '"> ' + message + ', <a onclick="deleteAccount(`' + value + '`);">Удалить</a><br />';
        }
    }
    }
    $('#accounts').html(radioButtons);
}
}

function deleteAccount(login) {
    let new_list = [];
    if (users.length > 1) {
        for (let user of users) {
    if (user.login && user.login !== login) {
        new_list.push(user);
    } else     if (user.type && user.type === 'vizonator' && user.last_login && user.last_login !== login) {
        new_list.push(user);
    }
    }
        localStorage.setItem("viz_users", JSON.stringify(new_list));
        selectAccount()
    $('#delete_msg').html('Аккаунт ' + login + ' удалён из списка.');
    } else if (users.length === 1) {
        selectAccount()
            $('#delete_msg').html('Аккаунт ' + login + ' удалён из списка.');
            localStorage.removeItem('viz_users');
            localStorage.removeItem('viz_current_user');
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
if (group[x].getAttribute('data-type') !== 'vizonator' && user.login && user.login === group[x].value) {
    let acc_data = {login: user.login, regular: user.regular, active: user.active, memo: user.memo_key};
    localStorage.setItem("viz_current_user", JSON.stringify(acc_data));
$('#select_msg').html('Аккаунт ' + user.login + ' выбран. <font color="red"><a onclick="location.reload();">Обновить страницу</a></font>');
} else if (user.type && user.type === 'vizonator' && group[x].getAttribute('data-type') === user.type && user.last_login === group[x].value) {
    let acc_data = {type: 'vizonator', last_login: user.last_login, isActive: user.isActive};
    localStorage.setItem("viz_current_user", JSON.stringify(acc_data));
$('#select_msg').html('Аккаунт ' + user.last_login + ' выбран. <font color="red"><a onclick="location.reload();">Обновить страницу</a></font>');
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

$( document ).ready(function() {
    $('#vizonator_auth').click(function() {
    if(typeof vizonator !== "undefined"){
        if (typeof current_user.type !== 'undefined') {
            if (current_user.type && current_user.type === 'vizonator') {
                $('#vizonator_block').html('Авторизован. аккаунт ' + current_user.last_login);
            return;
            }            
        }
    vizonator.get_account(function(error,result){
        if(!error){
            let acc_data = {type: 'vizonator', last_login: result.login, isActive: result.active};
            localStorage.setItem("viz_current_user", JSON.stringify(acc_data));
            if (!users) {
                var users = [];
            }
            users.push(acc_data);
            localStorage.setItem("viz_users", JSON.stringify(users));
        $('#vizonator_block').html('Авторизован. аккаунт ' + result.login);
        }
    });
}
});
});

setTimeout(function() {
    if(typeof vizonator !== "undefined"){
        if (typeof current_user.type !== 'undefined') {
            if (current_user.type && current_user.type === 'vizonator') {
                $('#vizonator_block').html('Авторизован. Вероятный аккаунт ' + current_user.last_login);
}
        }
}
}, 1000);

document.addEventListener('DOMContentLoaded', function(){
selectAccount();
});