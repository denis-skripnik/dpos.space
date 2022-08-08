const TX_TYPE = decimalJS.TX_TYPE;

axios.defaults.baseURL = 'https://mainnet-gate.decimalchain.com/api';
let current_user = JSON.parse(localStorage.getItem("decimal_current_user"));
if (current_user && !current_user.type  || current_user && current_user.type !== 'bip.to') {
var decimal_login = current_user.login;
let chain = 'decimal';
if (current_user.importFrom) chain = current_user.importFrom;
var seed = sjcl.decrypt(`dpos.space_${chain}_` + decimal_login + '_seed', current_user.seed);
$( document ).ready(function() {
    if (!seed) {
        if (document.getElementById('auth_msg')) document.getElementById('auth_msg').style = 'display: block';
        if (document.getElementById('seed_page')) document.getElementById('seed_page').style = 'display: none';
       }
});    
} else if (current_user && current_user.type && current_user.type === 'bip.to') {
    var decimal_login = current_user.login;            
    $( document ).ready(function() {
            if (document.getElementById('seed_page')) document.getElementById('seed_page').style = 'display: block';
    });    
} else {
    $( document ).ready(function() {
      if (!seed) {
        if (document.getElementById('auth_msg')) document.getElementById('auth_msg').style = 'display: block';
        if (document.getElementById('seed_page')) document.getElementById('seed_page').style = 'display: none';
       }
        });
    }
        
var users = JSON.parse(localStorage.getItem('decimal_users'));
$( document ).ready(function() {
        if (users && users.length > 0) {
            document.getElementById('show_accounts_list').style = 'display: block';
} else {
    document.getElementById('show_accounts_list').style = 'display: none';
}
        });

const options = {
    gateUrl: 'https://mainnet-gate.decimalchain.com/api/',
}

        var sender = {};
        if (seed) {
            let chain = 'decimal';
            if (current_user && current_user.importFrom) chain = current_user.importFrom;
            const secret = sjcl.decrypt(`dpos.space_${chain}_` + current_user.login + '_seed', current_user.seed);
            const wallet = new decimalJS.Wallet(secret);
            sender = {
                'address': wallet.address,
                'privateKey': wallet.getPrivateKeyString(),
                'node': "https://mainnet-gate.decimalchain.com/api/"
            }
        options.wallet = wallet;
        }
        const decimal = new decimalJS.Decimal(options);

        function isValidMnemonic(mnemonic) {
          if (!mnemonic) return false;
          try {
            new decimalJS.Wallet(mnemonic);
            return true;
          } catch (e) {
            return false;
          }
        }

        async function getTransaction(txHash) {
                try {
                    let response = await axios.get('/tx/' + txHash);
                    if (response.data.ok !== true) {
                    return false;
                } else {
                    return true;
                }
                    } catch(e) {
                        console.log(e);
                    return false;
                    }
        }
        
async function broadcasting(type, data) {
    const broadcastTx = await decimal.getTransaction(type, data, options);
    const result = await decimal.postTx(broadcastTx);

        if (result.success === true) {
            $.fancybox.open(`<p id="message"><strong>Пожалуйста, подождите. Идёт отправка и проверка доставки транзакции.</strong></p>`);
            await new Promise(r => setTimeout(r, 12000));
            let res = await decimal.getTransactionByHash(result.hash);
            console.log(JSON.stringify(res));
            if (res.status === 'Success') {
                document.getElementById('message').innerHTML = (`<strong>Ok. Транзакция создана и отправлена: <a href="/decimal/explorer/tx/${result.hash}" target="_blank">${result.hash}</a></strong>`);
    } else {
    document.getElementById('message').innerHTML = ('Ошибка. Транзакция отправлена, но не принята.');
    }
            } else {
            const errorMessage = result.error;
            throw `Ошибка: ${errorMessage}`;
        }
}


        async function send(to, amount, coin, memo, mode) {
            const data = {
                to: to.toString(),
                coin: coin.toString(),
                amount: amount.toString(),
              }
              
if (mode !== 'fee') {
    await broadcasting(TX_TYPE.COIN_SEND, data);
} else {
    const fee = await decimal.estimateTxFee(TX_TYPE.COIN_SEND, data, options);
    return fee;
}
        }
        
        async function convert(coin, to, value, minimum_buy_amount, mode) {
            const data = {
                sellCoin: coin.toString(),
                amount: value.toString(),
                getCoin: to.toString(),
                minBuyLimit: minimum_buy_amount.toString(),
              }
            if (mode !== 'fee') {
                await broadcasting(TX_TYPE.COIN_SELL, data);
            } else {
                let fee_data = await decimal.estimateTxFee(TX_TYPE.COIN_SELL, data, options);
                return fee_data;;
            }
        }
        
        async function delegate(coin, address, stake, mode) {
            const data = {
                address: address.toString(),
                coin: coin.toString(),
                stake: stake.toString(),
              }

            if (mode !== 'fee') {
                await broadcasting(TX_TYPE.VALIDATOR_DELEGATE, data);
            } else {
               let fee_data = await decimal.estimateTxFee(TX_TYPE.VALIDATOR_DELEGATE, data, options);
                return fee_data;;
            }
        }

        async function anbond(coin, address, stake, mode) {
            const data = {
                address: address.toString(),
                coin: coin.toString(),
                stake: stake.toString(),
              }
              
            if (mode !== 'fee') {
                await broadcasting(TX_TYPE.VALIDATOR_UNBOND, data);
            } else {
                let fee_data = await decimal.estimateTxFee(TX_TYPE.VALIDATOR_UNBOND, data, options);
                return fee_data;;
            }
        }

        async function createCoin(title, ticker, initSupply, maxSupply, options, mode) {
            const data = {
                title,
                ticker,
                initSupply: initSupply.toString(),
                maxSupply: maxSupply.toString(),
                reserve: options.initialReserve,
                crr: options.constantReserveRatio
              }

              let fee = await decimal.estimateTxFee(TX_TYPE.CREATE_COIN, data, options);
let q = window.confirm('Вы действительно хотите сделать это? Комиссия составит ' + fee + ' DEL');
if (q === true) {
    await broadcasting(txParams);
}
        }
        
        async function getBalance(address) {
            try {
            let response = await axios.get('https://mainnet-explorer-api.decimalchain.ru/api/addresses/' + address);
            let balances = [];
            for (let token of response.data.data.balances) {
              let balance = parseFloat(token.amount);
if (balance < 0.001) {
    balance = balance.toFixed(8);
} else {
    balance = balance.toFixed(3);
}
              balances.push({coin: token.coin.symbol, amount: balance, type: token.coin.type});
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
        let current_user = JSON.parse(localStorage.getItem("decimal_current_user"));
        users = JSON.parse(localStorage.getItem('decimal_users'));
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
            localStorage.setItem("decimal_users", JSON.stringify(new_list));
            selectAccount()
        $('#delete_msg').html('Аккаунт ' + login + ' удалён из списка.');
        } else if (users.length === 1) {
            selectAccount()
                $('#delete_msg').html('Аккаунт ' + login + ' удалён из списка.');
                localStorage.removeItem('decimal_users');
                localStorage.removeItem('decimal_current_user');
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
        localStorage.setItem("decimal_current_user", JSON.stringify(user));
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