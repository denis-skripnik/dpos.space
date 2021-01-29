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

  async function deleteOrder(orderid) {
    let q = window.confirm('Вы действительно хотите удалить этот ордер?');
    if (q == true) {
      try {
        await golos.broadcast.limitOrderCancelAsync(active_key, golos_login, orderid);
    window.alert('Ордер удалён.');
      await myOrders();
    } catch(e) {
      console.log(e);
    }
    }
  }
  
  function fast_str_replace(search,replace,str){
      return str.split(search).join(replace);
  }
  
  function date_str(timestamp,add_time,add_seconds,remove_today=false){
      if(-1==timestamp){
          var d=new Date();
      }
      else{
          var d=new Date(timestamp);
      }
      var day=d.getDate();
      if(day<10){
          day='0'+day;
      }
      var month=d.getMonth()+1;
      if(month<10){
          month='0'+month;
      }
      var minutes=d.getMinutes();
      if(minutes<10){
          minutes='0'+minutes;
      }
      var hours=d.getHours();
      if(hours<10){
          hours='0'+hours;
      }
      var seconds=d.getSeconds();
      if(seconds<10){
          seconds='0'+seconds;
      }
      var datetime_str=day+'.'+month+'.'+d.getFullYear();
      if(add_time){
          datetime_str=datetime_str+' '+hours+':'+minutes;
          if(add_seconds){
              datetime_str=datetime_str+':'+seconds;
          }
      }
      if(remove_today){
          datetime_str=fast_str_replace(date_str(-1)+' ','',datetime_str);
      }
      return datetime_str;
  }
  
  
  async function myOrders() {
    let sell_token = $('#sell_token').val();
    let buy_token = $('#buy_token').val();
    try {
    let orders = await golos.api.getOpenOrdersAsync(golos_login, [sell_token, buy_token]);
    const timezoneOffset = (new Date()).getTimezoneOffset() * 60000;
  let table = '';
    for (let order of orders) {
    let sell_price = order.sell_price;
      let get_time = Date.parse(order.created);
  table += `<tr>
  <td>${date_str(get_time - timezoneOffset, true, false, true)}</td>
  <td>${sell_price.base}</td>
  <td>${sell_price.quote}</td>
  <td>${parseFloat(order.real_price).toFixed(5)} ${buy_token} / ${sell_token}</td>
  <td><a onclick="deleteOrder(${order.orderid});">Удалить</a></td>
  </tr>`;
  }
    $('#my_orders_list').css('display', 'block');
  $('#my_orders_list').html(table);
  } catch(e) {
    console.log('Ошибка: ' + e);
    }
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
        asset1_counter += parseFloat(order.asset1) / (10 ** pr1);
        price_counter += parseFloat(order.price);
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
            $('#market_price').html(`${price.toFixed(5)} ${selected_buy_token} / ${selected_sell_token}`);
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
                        $('#buy_token').append(`<option value="GOLOS">GOLOS</option>`);
                        assets = await golos.api.getAssetsAsync('');
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
    var tokens = document.location.pathname.toUpperCase().slice(12).split('/');
    var max_amounts = {};
    let accounts = await golos.api.getAccountsAsync([golos_login]);
    if (accounts && accounts.length > 0) {
        let acc = accounts[0];
        if (parseFloat(acc.balance) > 0) {
            $('#sell_token').append(`<option value="GOLOS">GOLOS</option>`);
                         max_amounts['GOLOS'] = parseFloat(acc.balance);
        }
         
        if (parseFloat(acc.sbd_balance) > 0) {
            $('#sell_token').append(`<option value="GBG">GBG</option>`);
                            max_amounts['GBG'] = parseFloat(acc.sbd_balance);
        }

        let assets = await golos.api.getAccountsBalancesAsync([golos_login]);
        let account_tokens = [];
        if (assets && assets.length > 0) {
        let account_balances = assets[0];
            for (let asset in account_balances) {
            let token = account_balances[asset];
            if (parseFloat(token.balance) !== 0) {
                $('#sell_token').append(`<option value="${asset}">${asset}</option>`);
                max_amounts[asset] = parseFloat(token.balance);
                account_tokens.push(asset);
            }
       
}
    }
        
    if (document.location.pathname.indexOf('my-orders') > -1) {
            tokens = document.location.pathname.toUpperCase().slice(22).split('/');
              if (parseFloat(acc.balance) === 0) {
                $('#sell_token').append(`<option value="GOLOS">GOLOS</option>`);
                max_amounts['GOLOS'] = parseFloat(acc.balance);
              }
            
              if (parseFloat(acc.sbd_balance) === 0) {
                $('#sell_token').append(`<option value="GBG">GBG</option>`);
                max_amounts['GBG'] = parseFloat(acc.sbd_balance);
              }

              let assets = await golos.api.getAssetsAsync('');
              for (let asset of assets) {
                let name = asset.max_supply.split(' ')[1];
                if (account_tokens.indexOf(name) === -1) {
                    $('#sell_token').append(`<option value="${name}">${name}</option>`);
                    max_amounts[name] = 0;
                    }
            }
        }
        
$('#sell_token').change(async function() {
await sellTokens(max_amounts);
});

$('#buy_token').change(async function() {
let sell_token = $('#sell_token').val()
let buy_token = $('#buy_token').val()
if (document.location.pathname.indexOf('my-orders') > -1) {
    history.pushState([], '', `/golos/swap/my-orders/${sell_token}/${buy_token}`);
} else {
    history.pushState([], '', `/golos/swap/${sell_token}/${buy_token}`);
}
let sell_amount = $('#sell_amount').val();
let {pr1, pr2, fee1, fee2} = await orderConfig(sell_token, buy_token);
await creationOrder(sell_amount, sell_token, buy_token, fee1, fee2, pr1, pr2);
await myOrders();
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


$('#buy_amount').change(async function() {
    let sell_token = $('#sell_token').val();
    let buy_token = $('#buy_token').val();
    let sell_amount = parseFloat($('#sell_amount').val());
    let buy_amount = parseFloat($('#buy_amount').val());
    let order_price = parseFloat(buy_amount) / parseFloat(sell_amount)
    $('#market_price').html(`${order_price.toFixed(5)} ${buy_token} / ${sell_token}`);
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
           window.alert(JSON.stringify(e));
       }
    }
});

$('#action_create_order').click(async function() {
    let selected_sell_token = $('#sell_token').val();
    let selected_buy_token = $('#buy_token').val();
    let sell_amount = parseFloat($('#sell_amount').val());
    let buy_amount = parseFloat($('#buy_amount').val());
    let pr1 = parseFloat($('#pr1').val());
    let pr2 = parseFloat($('#pr2').val());
    let q = window.confirm('Вы действительно хотите создать ордер на обмен?');
    if (q == true) {
        let orderid = Math.floor(Date.now() / 1000); // it is golos.id way and it is preferred
        let order_endtime = parseInt($('#order_endtime').val());
        let expiration = new Date();
        expiration.setHours(expiration.getHours() + order_endtime);
        expiration = expiration.toISOString().substr(0, 19); // i.e. 2020-09-07T11:33:00
       try {
        let res = await golos.broadcast.limitOrderCreateAsync(active_key, golos_login, orderid, sell_amount.toFixedNoRounding(pr1) + ' ' + selected_sell_token, buy_amount.toFixedNoRounding(pr2) + ' ' + selected_buy_token, false, expiration);
if (res) {
    window.alert('Ордер создан');
location.reload();
}
} catch(e) {
           console.log(e);
       }
    }
});
    
if (tokens && tokens.length === 1 && tokens[0] !== '') {
    $("#sell_token option[value=" + tokens[0] + "]").attr('selected', 'true');
    await sellTokens(max_amounts);
} else if (tokens && tokens.length === 2 && tokens[0] !== '') {
        $("#sell_token option[value=" + tokens[0] + "]").attr('selected', 'true');
        await sellTokens(max_amounts);
        $("#buy_token option[value=" + tokens[1] + "]").attr('selected', 'true');
await myOrders();
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