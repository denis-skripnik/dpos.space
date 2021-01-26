const TX_TYPE = minterSDK.TX_TYPE;
const minter = new minterSDK.Minter({apiType: 'node', baseURL: 'https://api.minter.one/v2'});

axios.defaults.baseURL = 'https://api.minter.one/v2';

let current_user = JSON.parse(localStorage.getItem("minter_current_user"));
if (current_user) {
var minter_login = current_user.login;
var seed = sjcl.decrypt('dpos.space_minter_' + minter_login + '_seed', current_user.seed);
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
        
var users = JSON.parse(localStorage.getItem('minter_users'));
$( document ).ready(function() {
        if (users && users.length > 0) {
            document.getElementById('show_accounts_list').style = 'display: block';
} else {
    document.getElementById('show_accounts_list').style = 'display: none';
}
        });
        
        var sender = {};
        if (seed) {
            const secret = sjcl.decrypt('dpos.space_minter_' + current_user.login + '_seed', current_user.seed);
            const import_data = minterWallet.walletFromMnemonic(secret);
            sender = {
                'address': import_data.getAddressString(),
                'privateKey': import_data.getPrivateKeyString(),
                'node': "https://api.minter.one/v2"
            }
        }

        async function getTransaction(txHash) {
                try {
                    let response = await axios.get('/transaction/' + txHash);
                    if (response.data.code !== "0") {
                    return false;
                } else {
                    return true;
                }
                    } catch(e) {
                        console.log(e);
                    return false;
                    }
        }
        
        async function send(to, value, coin, memo) {
            let wif = sender.privateKey;
            const txParams = {
                chainId: 1,
                type: TX_TYPE.SEND,
                data: {
                    to,
                    value,
                    coin,    
                },
                gasCoin: coin,
                gasPrice: 1,
                payload: memo,
            };
            const idTxParams = await minter.replaceCoinSymbol(txParams);
            console.log(idTxParams);
            minter.postTx(idTxParams, {privateKey: wif})
                .then(async (txHash) => {
                    $.fancybox.open(`<p id="message"><strong>Пожалуйста, подождите. Идёт отправка и проверка доставки транзакции.</strong></p>`);
                    await new Promise(r => setTimeout(r, 5000));
                    let res = await getTransaction(txHash.hash);
                    if (res === true) {
                        document.getElementById('message').innerHTML = (`<strong>Ok. Транзакция создана и отправлена: <a href="/minter/explorer/tx/${txHash.hash}" target="_blank">${txHash.hash}</a></strong>`);
    } else {
        document.getElementById('message').innerHTML = ('Ошибка. Транзакция отправлена, но не принята.');
    }
                }).catch((error) => {
                    const errorMessage = error.response.data.error.message
                    throw `Ошибка: ${errorMessage}`;
                });
        }
        
        async function convert(coin, to, value) {
            let wif = sender.privateKey;
            const txParams = {
                chainId: 1,
                type: TX_TYPE.SELL,
                data: {
                    coinToSell: coin,
                    coinToBuy: to,
                    valueToSell: value,
                },
            };
            const idTxParams = await minter.replaceCoinSymbol(txParams);
            console.log(idTxParams);
            minter.postTx(idTxParams, {privateKey: wif})
                .then(async (txHash) => {
                    $.fancybox.open(`<p id="message"><strong>Пожалуйста, подождите. Идёт отправка и проверка доставки транзакции.</strong></p>`);
                    await new Promise(r => setTimeout(r, 5000));
                    let res = await getTransaction(txHash.hash);
                    if (res === true) {
                        document.getElementById('message').innerHTML = (`<strong>Ok. Транзакция создана и отправлена: <a href="/minter/explorer/tx/${txHash.hash}" target="_blank">${txHash.hash}</a></strong>`);
    } else {
        document.getElementById('message').innerHTML = ('Ошибка. Транзакция отправлена, но не принята.');
    }
                }).catch((error) => {
                    const errorMessage = error.response.data.error.message
                    throw `Ошибка: ${errorMessage}`;
                });
        }
        
        async function delegate(coin, publicKey, stake) {
            let wif = sender.privateKey;
            const txParams = {
                chainId: 1,
                type: TX_TYPE.DELEGATE,
                data: {
                    publicKey,
                    coin,
                    stake,
                },
                gasCoin: coin,
            };
            const idTxParams = await minter.replaceCoinSymbol(txParams);
            console.log(idTxParams);
            minter.postTx(idTxParams, {privateKey: wif})
                .then(async (txHash) => {
                    $.fancybox.open(`<p id="message"><strong>Пожалуйста, подождите. Идёт отправка и проверка доставки транзакции.</strong></p>`);
                    await new Promise(r => setTimeout(r, 5000));
                    let res = await getTransaction(txHash.hash);
                    if (res === true) {
                        document.getElementById('message').innerHTML = (`<strong>Ok. Транзакция создана и отправлена: <a href="/minter/explorer/tx/${txHash.hash}" target="_blank">${txHash.hash}</a></strong>`);
    } else {
        document.getElementById('message').innerHTML = ('Ошибка. Транзакция отправлена, но не принята.');
    }
                }).catch((error) => {
                    const errorMessage = error.response.data.error.message
                    console.log(errorMessage);
                    throw `Ошибка: ${errorMessage}`;
                });
        }

        async function anbond(coin, publicKey, stake) {
            let wif = sender.privateKey;
            const txParams = {
                chainId: 1,
                type: TX_TYPE.UNBOND,
                data: {
                    publicKey,
                    coin,
                    stake,
                },
            };
            const idTxParams = await minter.replaceCoinSymbol(txParams);
            console.log(idTxParams);
            minter.postTx(idTxParams, {privateKey: wif})
                .then(async (txHash) => {
                    $.fancybox.open(`<p id="message"><strong>Пожалуйста, подождите. Идёт отправка и проверка доставки транзакции.</strong></p>`);
                    await new Promise(r => setTimeout(r, 5000));
                    let res = await getTransaction(txHash.hash);
                    if (res === true) {
                        document.getElementById('message').innerHTML = (`<strong>Ok. Транзакция создана и отправлена: <a href="/minter/explorer/tx/${txHash.hash}" target="_blank">${txHash.hash}</a></strong>`);
        } else {
        document.getElementById('message').innerHTML = ('Ошибка. Транзакция отправлена, но не принята.');
        }
                }).catch((error) => {
                    const errorMessage = error.response.error.message
                    throw `Ошибка: ${errorMessage}`;
                });
        }

        async function getBalance(address) {
            try {
            let response = await axios.get('/address/' + address);
            let balances = [];
            for (let token of response.data.balance) {
              let balance = parseFloat(token.value);
              balance = balance.toFixed(2)
              balances.push({coin: token.coin.symbol, amount: balance});
            }
            return balances;
            } catch(e) {
                console.log(JSON.stringify(e));
            return false;
            }
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
        let current_user = JSON.parse(localStorage.getItem("minter_current_user"));
        users = JSON.parse(localStorage.getItem('minter_users'));
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
            localStorage.setItem("minter_users", JSON.stringify(new_list));
            selectAccount()
        $('#delete_msg').html('Аккаунт ' + login + ' удалён из списка.');
        } else if (users.length === 1) {
            selectAccount()
                $('#delete_msg').html('Аккаунт ' + login + ' удалён из списка.');
                localStorage.removeItem('minter_users');
                localStorage.removeItem('minter_current_user');
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
        localStorage.setItem("minter_current_user", JSON.stringify(acc_data));
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