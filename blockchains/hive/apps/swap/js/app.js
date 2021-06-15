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
        await hive.broadcast.limitOrderCancelAsync(active_key, hive_login, orderid);
    window.alert('Ордер удалён.');
      await myOrders();
    await getSelectedToken();
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
    $('#my_orders_list').css('display', 'block');
    let sell_token = $('#sell_token').val();
    let buy_token = $('#buy_token').html();
    try {
let orders = await hive.api.getOpenOrdersAsync(hive_login);
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
  $('#my_orders_list').html(table);
  } catch(e) {
    console.log('Ошибка: ' + e);
    }
    }
 
async function creationOrder(sell_amount, selected_sell_token, selected_buy_token) {
    $('#buy_amount').val('');
    $('#market_price').html('');
    $('#action_buy_token').attr('disabled', true);
    
    let get_orders = await hive.api.getOrderBookAsync(100);
    let orders = get_orders.bids;
    if (selected_sell_token === 'HBD') {
        orders = get_orders.asks;
    }
    if (orders.length > 0) {
    let asset1_counter = 0;
    let price_counter = 0;
    let orders_counter = 0;
    for (let order of orders) {
    orders_counter++;
        asset1_counter += parseFloat(order[selected_sell_token.toLowerCase()]) / (10 ** 3);
        price_counter += parseFloat(order.real_price);
    if (asset1_counter >= sell_amount) {
        break;
    }
}
if (asset1_counter < sell_amount) {
window.alert(`Сумма продажи больше имеющейся на рынке ${asset1_counter.toFixedNoRounding(3)} ${selected_buy_token}. Попробуйте позже или измените цену продажи на меньшую.`);
$('#action_buy_token').attr('disabled', true);
} else {
    $('#action_buy_token').attr('disabled', false);
    let price = price_counter / orders_counter;
    price = price.toFixedNoRounding(8);
    price = parseFloat(price);
    let buy_amount = sell_amount * price;
    if (selected_sell_token === 'HBD') {
        buy_amount = sell_amount / price;
    }
    if (buy_amount && parseFloat(buy_amount.toFixedNoRounding(3)) === 0)     $('#action_buy_token').attr('disabled', true); // Либо добавить атрибут disabled window.alert(buu)
    $('#buy_amount').val(buy_amount.toFixedNoRounding(3));
            $('#market_price').html(`${price.toFixed(5)} ${selected_buy_token} / ${selected_sell_token}`);
    }
    } else {
        window.alert(`Ордеров на покупку ${selected_sell_token} за ${selected_buy_token} нет.`);
    }
}

async function getSelectedToken() {
let accounts = await hive.api.getAccountsAsync([hive_login]);
if (accounts && accounts.length > 0) {
    let acc = accounts[0];
    let selected = $('#sell_token').val();
    if (selected === 'HIVE') {
        $('#max_amount').html(parseFloat(acc.balance));
            $('#buy_token').html('HBD');
    } else {
        $('#max_amount').html(parseFloat(acc.hbd_balance));
                $('#buy_token').html('HIVE');
            }
}
}

$(document).ready(async function() {
    $('#orders_history').attr('href', `https://dpos.space/hive/profiles/${hive_login}/orders`);
    $('#action_buy_token').attr('disabled', true); // Либо добавить атрибут disabled 
    var tokens = document.location.pathname.toUpperCase().slice(11).split('/');
    if (tokens[0] && tokens[0] === 'HBD') {
    $("#sell_token option[value=" + tokens[0] + "]").attr('selected', 'true');
}

await getSelectedToken();
await myOrders();

$('#sell_token').change(async function() {
    await getSelectedToken();
await myOrders();
if ($('#sell_token').val() === 'HBD') {
    history.pushState([], '', `/hive/swap/HBD`);
} else {
    history.pushState([], '', `/hive/swap`);
}
});

$('#max_amount').click(async function() {
    let max_amount = $('#max_amount').html();
    $('#sell_amount').val(max_amount);
    await creationOrder(max_amount, $('#sell_token').val(), $('#buy_token').html());
});

$('#sell_amount').change(async function() {
    await creationOrder($('#sell_amount').val(), $('#sell_token').val(), $('#buy_token').html());
});

$('#action_buy_token').click(async function() {
    let selected_sell_token = $('#sell_token').val();
    let selected_buy_token = $('#buy_token').html();
    let sell_amount = parseFloat($('#sell_amount').val());
    let buy_amount = parseFloat($('#buy_amount').val());
    let q = window.confirm('Вы действительно хотите совершить обмен?');
    if (q == true) {
        let orderid = Math.floor(Date.now() / 1000); // it is hiveit.com way and it is preferred
        let expiration = new Date();
        expiration.setHours(expiration.getHours() + 24);
        expiration = expiration.toISOString().substr(0, 19); // i.e. 2020-09-07T11:33:00
        let moment_swap = JSON.parse($('#change_mode').attr('data-mode'));
        try {
        let res = await hive.broadcast.limitOrderCreateAsync(active_key, hive_login, orderid, sell_amount.toFixedNoRounding(3) + ' ' + selected_sell_token, buy_amount.toFixedNoRounding(3) + ' ' + selected_buy_token, moment_swap, expiration);
if (res) {
if (moment_swap === true) {
    window.alert('Обмен произведён');
} else {
    window.alert('Ордер успешно создан.');
await myOrders();
}
location.reload();
}
} catch(e) {
           window.alert(e);
       }
    }
});

$('#change_mode').on('click', function() {
    let moment_swap = $('#change_mode').attr('data-mode');
    if (moment_swap === 'true') {
    $('#change_mode').attr('data-mode', `false`);
    $('#change_mode').html('Моментальный обмен');
    $('#buy_amount').attr('readonly', false);
} else {
    $('#change_mode').attr('data-mode', `true`);
    $('#change_mode').html('Создать произвольный ордер');
    $('#buy_amount').attr('readonly', true);
}
});
}); // end document ready function.