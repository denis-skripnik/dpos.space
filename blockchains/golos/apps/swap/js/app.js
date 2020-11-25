Number.prototype.toFixedNoRounding = function(n) {
    const reg = new RegExp(`^-?\\d+(?:\\.\\d{0,${n}})?`, 'g')
    const a = this.toString().match(reg)[0];
    const dot = a.indexOf('.');
  
    if (dot === -1) {
      return a + '.' + '0'.repeat(n);
    }
  
    const b = n - (a.length - dot) + 1;
  
    return b > 0 ? (a + '0'.repeat(b)) : a;
  }
  
async function creationOrder(sell_amount, selected_sell_token, selected_buy_token, fee1, fee2, pr1, pr2) {
    $('#buy_amount').val('');
    $('#market_fee').html('');
    $('#market_price').html('');
    $('#action_buy_token').attr('disabled', true);
    
    let orders = await golos.api.getOrderBookAsync(100, [selected_sell_token, selected_buy_token]);
    orders = orders.bids;
    if (orders.length > 0) {
    let asset1_counter = 0;
    let price_counter = 0;
    let orders_counter = 0;
    for (let order of orders) {
    orders_counter++;
        asset1_counter += order.asset1 / (10 ** pr1);
        price_counter += order.price;
    if (asset1_counter >= sell_amount) {
        break;
    }
}
if (asset1_counter < sell_amount) {
window.alert(`Сумма продажи больше имеющейся на рынке ${asset2_counter.toFixedNoRounding(pr2)} ${selected_buy_token}. Попробуйте позже или измените цену продажи на меньшую.`);
$('#action_buy_token').attr('disabled', true);
} else {
    $('#action_buy_token').attr('disabled', false);
    let price = price_counter / orders_counter;
    price = price.toFixedNoRounding(5);
    price = parseFloat(price);
    let buy_amount = sell_amount * price;
    if (buy_amount && parseFloat(buy_amount.toFixedNoRounding(pr2)) === 0)     $('#action_buy_token').attr('disabled', true); // Либо добавить атрибут disabled window.alert(buu)
    
    $('#buy_amount').val(buy_amount.toFixedNoRounding(pr2));
            $('#market_fee').html(`${fee2}% (${(buy_amount * (fee2 / 100)).toFixedNoRounding(pr2)} ${selected_buy_token})`);
            $('#market_price').html(`${price} ${selected_buy_token} / ${selected_sell_token}`);
    }
    } else {
        window.alert(`Ордеров на покупку ${selected_sell_token} за ${selected_buy_token} нет.`);
    }
return {pr1, pr2, fee1, fee2};
}

async function checkApprovedToken(asset) {
$('#buy_token').html(`<option value=""></option>`);
    let uia;
    if (asset !== 'GOLOS' && asset !== 'GBG') uia = [asset];
    let assets = await golos.api.getAssetsAsync('', uia);
    if (assets && assets.length > 0) {
        if (!uia) {
            if (asset !== 'GBG') {
                $('#buy_token').append(`<option value="GBG">GBG</option>`);
            } else {
                $('#buy_token').append(`<option value="GOLOS">GOLOS</option>`);
            }

            for (let token of assets) {
            if (token.symbols_whitelist.length === 0 || token.symbols_whitelist.indexOf(asset) > -1) {
            let name = token.max_supply.split(' ')[1];
            $('#buy_token').append(`<option value="${name}">${name}</option>`);
                }
        }            
    } else if (uia) {
        let token = assets[0];
        if (token.symbols_whitelist.length > 0) {
            for (let name of token.symbols_whitelist) {
if (name !== uia) {
    $('#buy_token').append(`<option value="${name}">${name}</option>`);
}
}
        } else {
                        $('#buy_token').append(`<option value="GOLOS">GOLOS</option>`);assets = await golos.api.getAssetsAsync('');
                        $('#buy_token').append(`<option value="GBG">GBG</option>`);
                        if (assets && assets.length > 0) {
                    for (let token of assets) {
                        let name = token.max_supply.split(' ')[1];
                        if (uia != name) {
    $('#buy_token').append(`<option value="${name}">${name}</option>`);
}
                    }
    }
    }
        }
    }
}

async function sellTokens(max_amounts) {
    let selected_token = $('#sell_token').val();
    $('#max_amount').html(max_amounts[selected_token]);

await checkApprovedToken(selected_token);
}

async function orderConfig(selected_sell_token, selected_buy_token) {
        let tokens = [];
        let assets = await golos.api.getAssetsAsync('', [selected_sell_token, selected_buy_token]);
        let pr1 = 3;
        let pr2 = 3;
        let fee1 = 0;
        let fee2 = 0;
        if (assets && assets.length === 1) {
            if (selected_sell_token !== 'GOLOS' && selected_sell_token !== 'GBG') {
                pr1 = assets[0].precision;
                fee1 = assets[0].fee_percent / 100;
            }
            if (selected_buy_token !== 'GOLOS' && selected_buy_token !== 'GBG') {
                pr2 = assets[0].precision;
                fee2 = assets[0].fee_percent / 100;
            }
        } else if (assets && assets.length === 2) {
                if (selected_sell_token !== 'GOLOS' && selected_sell_token !== 'GBG') {
                    pr1 = assets[0].precision;
                    fee1 = assets[0].fee_percent / 100;
                }
                if (selected_buy_token !== 'GOLOS' && selected_buy_token !== 'GBG') {
                    pr2 = assets[1].precision;
                    fee2 = assets[1].fee_percent / 100;
                }
        }
$('#pr1').val(pr1);
$('#pr2').val(pr2);
return {pr1, pr2, fee1, fee2};
    }

async function main() {
    var max_amounts = {};
    let accounts = await golos.api.getAccountsAsync([golos_login]);
    if (accounts && accounts.length > 0) {
        let acc = accounts[0];
        let assets = await golos.api.getAccountsBalancesAsync([golos_login]);
        if (parseFloat(acc.balance) > 0) {
            $('#sell_token').append(`<option value="GOLOS">GOLOS</option>`);
                         max_amounts['GOLOS'] = parseFloat(acc.balance);
        }
         
        if (parseFloat(acc.sbd_balance) > 0) {
            $('#sell_token').append(`<option value="GBG">GBG</option>`);
                            max_amounts['GBG'] = parseFloat(acc.sbd_balance);
        }
        
        if (assets && assets.length > 0) {
        let account_balances = assets[0];
            for (let asset in account_balances) {
            let token = account_balances[asset];
            if (parseFloat(token.balance) !== 0) {
                $('#sell_token').append(`<option value="${asset}">${asset}</option>`);
                max_amounts[asset] = parseFloat(token.balance);
    }
       
}
    }

$('#sell_token').change(async function() {
await sellTokens(max_amounts);
});

$('#buy_token').change(async function() {
let sell_token = $('#sell_token').val()
let buy_token = $('#buy_token').val()
history.pushState([], '', `/golos/swap/${sell_token}/${buy_token}`);
let sell_amount = $('#sell_amount').val();
let {pr1, pr2, fee1, fee2} = await orderConfig(sell_token, buy_token);
await creationOrder(sell_amount, sell_token, buy_token, fee1, fee2, pr1, pr2);
});

$('#sell_amount').change(async function() {
    let sell_token = $('#sell_token').val();
    let buy_token = $('#buy_token').val();
    let sell_amount = parseFloat($('#sell_amount').val());
    let max_amount = parseFloat($('#max_amount').html());
    if (sell_amount && sell_amount > 0 && sell_amount <= max_amount) {
        $('#action_buy_token').attr('disabled', false); // Либо добавить атрибут disabled 
        let {pr1, pr2, fee1, fee2} = await orderConfig(sell_token, buy_token);
        await creationOrder(sell_amount, sell_token, buy_token, fee1, fee2, pr1, pr2);
    } else {
        $('#action_buy_token').attr('disabled', true); // Либо добавить атрибут disabled 
    }
});

$('#max_amount').click(async function() {
    let max_amount = $('#max_amount').html();
    let sell_token = $('#sell_token').val();
    let buy_token = $('#buy_token').val();
    $('#sell_amount').val(max_amount);
        let {pr1, pr2, fee1, fee2} = await orderConfig(sell_token, buy_token);
        await creationOrder(max_amount, sell_token, buy_token, fee1, fee2, pr1, pr2);
});
    
$('#action_buy_token').click(async function() {
    let selected_sell_token = $('#sell_token').val();
    let selected_buy_token = $('#buy_token').val();
    let sell_amount = parseFloat($('#sell_amount').val());
    let buy_amount = parseFloat($('#buy_amount').val());
    let pr1 = parseFloat($('#pr1').val());
    let pr2 = parseFloat($('#pr2').val());
    let q = window.confirm('Вы действительно хотите совершить обмен?');
    if (q == true) {
        let orderid = Math.floor(Date.now() / 1000); // it is golos.id way and it is preferred
        let expiration = new Date();
        expiration.setHours(expiration.getHours() + 1);
        expiration = expiration.toISOString().substr(0, 19); // i.e. 2020-09-07T11:33:00
       try {
        let res = await golos.broadcast.limitOrderCreateAsync(active_key, golos_login, orderid, sell_amount.toFixedNoRounding(pr1) + ' ' + selected_sell_token, buy_amount.toFixedNoRounding(pr2) + ' ' + selected_buy_token, true, expiration);
if (res) {
    window.alert('Обмен произведён');
location.reload();
}
} catch(e) {
           console.log(e);
       }
    }
});

    var tokens = document.location.pathname.toUpperCase().slice(12).split('/');
    if (tokens && tokens.length === 1 && tokens[0] !== '') {
    $("#sell_token option[value=" + tokens[0] + "]").attr('selected', 'true');
    await sellTokens(max_amounts);
} else if (tokens && tokens.length === 2 && tokens[0] !== '') {
        $("#sell_token option[value=" + tokens[0] + "]").attr('selected', 'true');
        await sellTokens(max_amounts);
        $("#buy_token option[value=" + tokens[1] + "]").attr('selected', 'true');
} else {
    await sellTokens(max_amounts);
      }

} // end acc.
} // end function.

$(document).ready(async function() {
    $('#orders_history').attr('href', `https://dpos.space/golos/profiles/${golos_login}/orders`);
    $('#action_buy_token').attr('disabled', true); // Либо добавить атрибут disabled 
    await main();
}); // end document ready function.