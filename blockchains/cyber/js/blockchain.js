const {builder, codec, crypto, constants, keypair} = window.bundle;
// https://cyber.cybernode.ai
axios.defaults.baseURL = 'https://dpos.space/blockchains/cyber/node.php';

let current_user = JSON.parse(localStorage.getItem("cyber_current_user"));
if (current_user) {
var cyber_login = current_user.login;
var seed = sjcl.decrypt('dpos.space_cyber_' + cyber_login + '_seed', current_user.seed);
$( document ).ready(function() {
    if (!seed) {
        document.getElementById('auth_msg').style = 'display: block';
        document.getElementById('seed_page').style = 'display: none';
       }
});    
} else {
    $( document ).ready(function() {
      if (!seed) {
        document.getElementById('auth_msg').style = 'display: block';
        document.getElementById('seed_page').style = 'display: none';
       }
        });
        }
        
var users = JSON.parse(localStorage.getItem('cyber_users'));
$( document ).ready(function() {
        if (users && users.length > 0) {
            document.getElementById('show_accounts_list').style = 'display: block';
} else {
    document.getElementById('show_accounts_list').style = 'display: none';
}
        });
        
        var sender = {};
        if (seed) {
            const secret = sjcl.decrypt('dpos.space_cyber_' + current_user.login + '_seed', current_user.seed);
            const import_data = crypto.recover(secret, 'en');
            sender = {
                'address': import_data.address,
                'privateKey': import_data.privateKey,
                'node': "https://api.cyber.cybernode.ai",
                'chain': "euler-6"
            }
        }
            
        async function transfer(addressTo, amount) {
        const addressInfo = await axios({
            method: 'get',
            url: `${sender.node}/account?address="${sender.address}"`,
        });
    
        if(!addressInfo.data.result) { return console.log ("error") };
        const account = addressInfo.data.result.account;
        if(!account) { return console.error('error: addressInfo.data.result.account undefined') }
    
        const acc = {
            address: account.address,
            chain_id: sender.chain,
            account_number: parseInt(account.account_number, 10),
            sequence: parseInt(account.sequence, 10)
        };
    
        const sendRequest = {
            acc,
            amount,
            from: sender.address,
            to: addressTo,
            type: 'send'
        };
    
        const txRequest = builder.buildAndSignTxRequest(sendRequest, sender.privateKey, sender.chain);
        const signedSendHex = codec.hex.stringToHex(JSON.stringify(txRequest));
    
        return axios({
            method: 'get',
            url: `${sender.node}/submit_signed_send?data="${signedSendHex}"`,
        })
        .then(res => {
            if (!res.data) {
              throw new Error('Empty data');
            }
            if (res.data.error) {
              throw res.data.error;
            }
            return res.data;
          })
        .catch(error => console.log('Cannot send', error));
    }
    
    async function link(from, to) {
        const addressInfo = await axios({
            method: 'get',
            url: `${sender.node}/account?address="${sender.address}"`,
        });
        
        if(!addressInfo.data.result) { return console.error('error: addressInfo.data.result undefined') };
        const account = addressInfo.data.result.account;
        if(!account) { return console.error('error: addressInfo.data.result.account undefined') }
        
        const acc = {
            address: account.address,
            chain_id: sender.chain,
            account_number: parseInt(account.account_number, 10),
            sequence: parseInt(account.sequence, 10)
        };
        
        const sendRequest = {
            acc,
            fromCid: from,
            toCid: to,
            type: 'link'
        };
        
        const txRequest = builder.buildAndSignTxRequest(sendRequest, sender.privateKey, sender.chain);
        const signedSendHex = codec.hex.stringToHex(JSON.stringify(txRequest));
    
        return axios({
            method: 'get',
            url: `${sender.node}/submit_signed_link?data="${signedSendHex}"`,
        })
        .then(res => {
            if (!res.data) {
              throw new Error('Empty data');
            }
            if (res.data.error) {
              throw res.data.error;
            }
            return res.data;
          })
        .catch(error => console.log('Cannot send', error));
    }

    function spoiler(elem, group){
        style = document.getElementById(elem).style;
        if(document.querySelector("#" + elem).classList.contains(group) && style.display === 'none') {
            $('.' + group).hide();
        }

        style.display = (style.display == 'block') ? 'none' : 'block';
    }

function copyText(id) {
    let text = document.getElementById(id);
    text.select();    
  document.execCommand("copy");
    }

function selectAccount() {
    let current_user = JSON.parse(localStorage.getItem("cyber_current_user"));
    users = JSON.parse(localStorage.getItem('cyber_users'));
    if (users) {
    let radioButtons = '';
    if (users.length === 1) {
        radioButtons += '<input type="radio" name="users" value="' + users[0].login + '" placeholder="' + users[0].login + '" checked> ' + users[0].login + '<a onclick="deleteAccount(`' + users[0].login + '`);">Удалить</a><br />';
    } else if (users.length > 1) {
    for (user of users) {
        if (current_user.login === user.login) {
        radioButtons += '<input type="radio" name="users" value="' + user.login + '" placeholder="' + user.login + '" checked> ' + user.login + ' <a onclick="deleteAccount(`' + user.login + '`);">Удалить</a><br />';
        }     else {
            radioButtons += '<input type="radio" name="users" value="' + user.login + '" placeholder="' + user.login + '"> ' + user.login + '<a onclick="deleteAccount(`' + user.login + '`);">Удалить</a><br />';
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
    if (user.login !== login) {
        new_list.push(user);
    }
    }
        localStorage.setItem("cyber_users", JSON.stringify(new_list));
        selectAccount()
    $('#delete_msg').html('Аккаунт ' + login + ' удалён из списка.');
    } else if (users.length === 1) {
        selectAccount()
            $('#delete_msg').html('Аккаунт ' + login + ' удалён из списка.');
            localStorage.removeItem('cyber_users');
            localStorage.removeItem('cyber_current_user');
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
if (user.login === group[x].value) {
    let acc_data = {login: user.login, seed: user.seed};
    localStorage.setItem("cyber_current_user", JSON.stringify(acc_data));
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

$(document).on('click', '.ajax_modal', function(e) {
    let url = $(this).attr('data-url');
    let params_str = $(this).attr('data-params');
    sendAjax(url + '?' + params_str, 'ajax_modal_content');
});