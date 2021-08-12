const TX_TYPE = minterSDK.TX_TYPE;
const minter = new minterSDK.Minter({apiType: 'node', baseURL: 'https://api.minter.one/v2'});

axios.defaults.baseURL = 'https://api.minter.one/v2';

let current_user = JSON.parse(localStorage.getItem("minter_current_user"));
if (current_user) {
var minter_login = current_user.login;
let chain = 'minter';
if (current_user.importFrom) chain = current_user.importFrom;
var seed = sjcl.decrypt(`dpos.space_${chain}_` + minter_login + '_seed', current_user.seed);
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
            let chain = 'minter';
if (current_user.importFrom) chain = current_user.importFrom;
            const secret = sjcl.decrypt(`dpos.space_${chain}_` + current_user.login + '_seed', current_user.seed);
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
        
async function broadcasting(idTxParams) {
    let wif = sender.privateKey;
    minter.postTx(idTxParams, {privateKey: wif})
    .then(async (txHash) => {
        $.fancybox.open(`<p id="message"><strong>Пожалуйста, подождите. Идёт отправка и проверка доставки транзакции.</strong></p>`);
        await new Promise(r => setTimeout(r, 5500));
        let res = await getTransaction(txHash.hash);
        if (res === true) {
            document.getElementById('message').innerHTML = (`<strong>Ok. Транзакция создана и отправлена: <a href="/minter/explorer/tx/${txHash.hash}" target="_blank">${txHash.hash}</a></strong>`);
} else {
document.getElementById('message').innerHTML = ('Ошибка. Транзакция отправлена, но не принята.');
}
    }).catch(async (error) => {
        if (idTxParams.type === '0x15') {
            await addToPool(idTxParams.data.coin1, idTxParams.data.coin0, idTxParams.data.maximumVolume1, idTxParams.data.volume0, '', '');
        }
            const errorMessage = (error.response.data.error.message ? error.response.data.error.message : error.response.error.message)
            throw `Ошибка: ${errorMessage}`;
    });
}

        async function send(to, value, coin, memo, mode, gasCoin) {
            let minGasPrice = await axios.get('/min_gas_price');
            let gasPrice = parseInt(minGasPrice.data.min_gas_price)
            if (!gasCoin) gasCoin = coin;
            const txParams = {
                chainId: 1,
                type: TX_TYPE.SEND,
                data: {
                    to,
                    value,
                    coin,    
                },
                gasCoin,
                gasPrice,
                payload: memo,
            };
            const idTxParams = await minter.replaceCoinSymbol(txParams);
            console.log(idTxParams);
if (mode !== 'fee') {
    await broadcasting(idTxParams);
} else {
    let fee_data = await minter.estimateTxCommission(idTxParams, {direct: false,});
    return {fee: fee_data.commission * gasPrice, bip_fee: fee_data.baseCoinCommission * gasPrice};
}
        }
        
        async function convert(coin, to, value, minimum_buy_amount, swap_route, mode, gasCoin) {
            if (!gasCoin) gasCoin = coin;
            let txParams = {};
            txParams.chainId = 1;
            txParams.type = TX_TYPE.SELL;
            txParams.data = {};
            
            if (swap_route !== '') {
                txParams.type = TX_TYPE.SELL_SWAP_POOL;
                txParams.data.coins = swap_route.split(',');
            txParams.data.minimumValueToBuy = parseFloat(minimum_buy_amount);
        } else {
                txParams.data.coinToSell = coin;
                txParams.data.coinToBuy = to;
                txParams.data.minimumValueToBuy = parseFloat(minimum_buy_amount);
            }
                        txParams.data.valueToSell = value;
            txParams.gasCoin = gasCoin;
            const idTxParams = await minter.replaceCoinSymbol(txParams);
            console.log(idTxParams);
            if (mode !== 'fee') {
                await broadcasting(idTxParams);
            } else {
                let fee_data = await minter.estimateTxCommission(idTxParams, {direct: false,});
                return {fee: fee_data.commission * gasPrice, bip_fee: fee_data.baseCoinCommission * gasPrice};;
            }
        }
        
        async function addToPool(coin, to, amount1, amount2, mode, variant, gasCoin) {
                        let minGasPrice = await axios.get('/min_gas_price');
            let gasPrice = parseInt(minGasPrice.data.min_gas_price)
            if (!gasCoin) gasCoin = coin;
            let type = TX_TYPE.ADD_LIQUIDITY;
if (variant === 'create_pool') type = TX_TYPE.CREATE_SWAP_POOL;
            let txParams = {
                chainId: 1,
                type,
                data: {
                  coin0: coin,
                  coin1: to,
                  volume0: amount1,
                },
                gasCoin,
                gasPrice
            };
            if (variant !== 'create_pool') {
                txParams.data.maximumVolume1 = amount2;
            } else {
                txParams.data.volume1 = amount2;
            }
            const idTxParams = await minter.replaceCoinSymbol(txParams);
            console.log(idTxParams);
            if (mode !== 'fee') {
    await broadcasting(idTxParams);
            } else {
                    let fee_data = await minter.estimateTxCommission(txParams, {direct: false,});
                    return {fee: fee_data.commission * gasPrice, bip_fee: fee_data.baseCoinCommission * gasPrice};
            }
        }

        async function removeFromPool(coin0, coin1, liquidity, mode) {
            let minGasPrice = await axios.get('/min_gas_price');
let gasPrice = parseInt(minGasPrice.data.min_gas_price)
let txParams = {
    chainId: 1,
    type: TX_TYPE.REMOVE_LIQUIDITY,
    data: {
      coin0,
      coin1,
      liquidity,
    },
  gasCoin: 'BIP',
    gasPrice
};
const idTxParams = await minter.replaceCoinSymbol(txParams);
console.log(idTxParams);
if (mode !== 'fee') {
try {
await broadcasting(idTxParams);
} catch(err) {
await addToPool(to, coin, amount2, amount1, mode);
}
} else {
        let fee_data = await minter.estimateTxCommission(txParams, {direct: false,});
        return {fee: fee_data.commission * gasPrice, bip_fee: fee_data.baseCoinCommission * gasPrice};
}
}

        async function delegate(coin, publicKey, stake, mode, gasCoin) {
            if (!gasCoin) gasCoin = coin;
            const txParams = {
                chainId: 1,
                type: TX_TYPE.DELEGATE,
                data: {
                    publicKey,
                    coin,
                    stake,
                },
                gasCoin,
            };
            const idTxParams = await minter.replaceCoinSymbol(txParams);
            console.log(idTxParams);
            if (mode !== 'fee') {
                await broadcasting(idTxParams);
            } else {
                let fee_data = await minter.estimateTxCommission(txParams, {direct: false,});
                return {fee: fee_data.commission * gasPrice, bip_fee: fee_data.baseCoinCommission * gasPrice};
            }
        }

        async function anbond(coin, publicKey, stake, mode) {
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
            if (mode !== 'fee') {
                await broadcasting(idTxParams);
            } else {
                let fee_data = await minter.estimateTxCommission(txParams, {direct: false,});
                return {fee: fee_data.commission * gasPrice, bip_fee: fee_data.baseCoinCommission * gasPrice};;
            }
        }

        async function createCoin(type, name, symbol, initialAmount, maxSupply, options, mode) {
    let txParams = {
        chainId: 1,
        type: TX_TYPE[type],
        data: {
            name,
            symbol,
            initialAmount,
            maxSupply,
        },
    };

if (type === 'CREATE_COIN' || type === 'RECREATE_COIN') {
    txParams.data.constantReserveRatio = options.constantReserveRatio;
    txParams.data.initialReserve = options.initialReserve;
} else {
    txParams.data.mintable = options.mintable;
    txParams.data.burnable = options.burnable;
}
            const idTxParams = await minter.replaceCoinSymbol(txParams);
            let fee_data = await minter.estimateTxCommission(txParams, {direct: false,});
            let fee = fee_data.commission;
let q = window.confirm('Вы действительно хотите сделать это? Комиссия составит ' + fee + ' BIP');
if (q === true) {
    await broadcasting(idTxParams);
}
        }
        
        async function editCoinOwner(symbol, newOwner, mode) {
            const txParams = {
                chainId: 1,
                type: TX_TYPE.EDIT_COIN_OWNER,
                data: {
                    symbol,
                    newOwner,
                },
            };
            const idTxParams = await minter.replaceCoinSymbol(txParams);
            console.log(idTxParams);
            let fee_data = await minter.estimateTxCommission(txParams, {direct: false,});
            let fee = fee_data.commission;
let q = window.confirm('Вы действительно хотите сделать это? Комиссия составит ' + fee + ' BIP');
if (q === true) {
    await broadcasting(idTxParams);
}
        }
        
        async function mintToken(coin, value) {
            const txParams = {
                chainId: 1,
                    type: TX_TYPE.MINT_TOKEN,
                    data: {
                        coin,
                        value,
                    },
                };
            
                const idTxParams = await minter.replaceCoinSymbol(txParams);
            console.log(idTxParams);
            let fee_data = await minter.estimateTxCommission(txParams, {direct: false,});
            let fee = fee_data.commission;
let q = window.confirm('Вы действительно хотите провести эмиссию токенов? Комиссия составит ' + fee + ' BIP');
if (q === true) {
    await broadcasting(idTxParams);
}
        }

        async function burnToken(coin, value) {
            const txParams = {
                chainId: 1,
                type: TX_TYPE.BURN_TOKEN,
                    data: {
                        coin,
                        value,
                    },
                };
            
                const idTxParams = await minter.replaceCoinSymbol(txParams);
            console.log(idTxParams);
            let fee_data = await minter.estimateTxCommission(txParams, {direct: false,});
            let fee = fee_data.commission;
let q = window.confirm('Вы действительно хотите сжечь токены? Комиссия составит ' + fee + ' BIP');
if (q === true) {
    await broadcasting(idTxParams);
}
        }

        async function getBalance(address) {
            try {
            let response = await axios.get('https://explorer-api.minter.network/api/v2/addresses/' + address);
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
        localStorage.setItem("minter_current_user", JSON.stringify(user));
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