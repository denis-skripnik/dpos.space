var ref_address = window.location.search.split('r=')[1];
var referer = '';
if (localStorage.getItem('minter_long_referer') !== null) {
    referer = localStorage.getItem('minter_long_referer');
    } else if (typeof ref_address !== 'undefined') {
        localStorage.setItem('minter_long_referer', ref_address);
        referer = ref_address;
    }

    function updateBidsTable(url) {
        $.ajax({
          url: `https://backend.dpos.space/smartfarm/bids/active?coin=${url[4]}`,
          success: function(data) {
            // Разбор полученных данных
            var active_bids = JSON.parse(data);

            var sum_plus = 0;
            var sum_minus = 0;
            var count_plus = 0;
            var count_minus = 0;
            var coefficient = 0;
      
            // Подсчет суммы ставок и их количества
            for (var i = 0; i < active_bids.length; i++) {
              var bid = active_bids[i];
              if (bid.direction === "+") {
                sum_plus += bid.amount;
                count_plus++;
              } else if (bid.direction === "-") {
                sum_minus += bid.amount;
                count_minus++;
              }
            }
      
            // Вычисление коэффициента
            if (count_plus === 0 || count_minus === 0) {
              coefficient = "Все ставки будут возвращены";
            } else {
                coefficient = ((sum_plus - (sum_plus * 0.1)) / sum_minus) + 1;
                coefficient = coefficient.toFixed(2);
            }

            // Обновление таблицы
            var table = $("#bids_table");
            table.empty();
            table.append("<thead><tr><th>Токен</th><th>Адрес</th><th>Сумма</th><th>Прогноз направления</th></tr></thead>");
            var tbody = $("<tbody>");
            for (var i = 0; i < active_bids.length; i++) {
              var bid = active_bids[i];
              var row = $("<tr>");
              row.append("<td>" + bid.token + "</td>");
              row.append("<td><a href='https://dpos.space/minter/profiles/" + bid.address + "' target='_blank'>" + bid.address + "</a></td>");
              row.append("<td>" + bid.amount.toFixed(8) + " " + bid.send_coin + "</td>");
              row.append("<td>" + bid.direction + "</td>");
              tbody.append(row);
            }
            table.append(tbody);
      
            // Обновление коэффициента
            $("#coefficient").text("Коэффициент: " + coefficient);
      
            // Рекурсивный вызов функции через 3 секунды
            setTimeout(updateBidsTable(url), 3000);
          }
        });
      }
      
async function getPrices() {
    let get_price = (await axios.get('/swap_pool/0/2782')).data;
    let price = parseFloat(get_price.amount0) / parseFloat(get_price.amount1);
    let res_bip_prices = (await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=minter-network&vs_currencies=usd,rub')).data;
    let usd_bip_price = res_bip_prices['minter-network']['usd'];
    let rub_bip_price = res_bip_prices['minter-network']['rub'];
    let usd_price = price * usd_bip_price;
        let rub_price = price * rub_bip_price;
        if (document.getElementById('prices')) $('#prices').html(`Курс 1 LONG = <span id="current_price">${price.toFixed(5)}</span> BIP, $ ${usd_price.toFixed(5)}, ${rub_price.toFixed(5)} Руб.`);
    const date = new Date().toLocaleString();
    if (document.getElementById('page_date')) $('#page_date').html(date);
   return {price, usd_bip_price, rub_bip_price};
}

async function calculate() {
    let {price, usd_bip_price, rub_bip_price} = await getPrices();
    let long_amount = parseFloat($('[name=long_amount]').val().replace(',', '.'));
    let tec_long_amount = long_amount * (10 ** 18);
    tec_long_amount = BigInt(tec_long_amount);
    let pool_bip_amount = long_amount * price;
    $('#bip_add_amount').html(pool_bip_amount.toFixed(5));
    let liquidity = Math.sqrt(long_amount * pool_bip_amount);
    let invest_days = parseFloat($('[name=invest_days_calc]').val().replace(',', '.'));
    let power = liquidity * ( 1 + (invest_days / 100))
let farming_amount = parseFloat($('#farming_amount').html().replace(',', '.'));
    try {
    let get_bip_amount = (await axios.get(`https://explorer-api.minter.network/api/v2/pools/coins/LONG/BIP/route?amount=${tec_long_amount}&type=input`)).data.amount_out;
if (get_bip_amount) {
    let usd_adding_liquidity = ((get_bip_amount * 2) * usd_bip_price).toFixed(5);
    let rub_adding_liquidity = ((get_bip_amount * 2) * rub_bip_price).toFixed(5);
    $('#adding_liquidity').html(liquidity.toFixed(5) + `, в BIP: ${(get_bip_amount * 2).toFixed(5)}, в $: ${usd_adding_liquidity}, в руб.: ${rub_adding_liquidity}`);
} else {
    $('#adding_liquidity').html(liquidity.toFixed(5));    
}
} catch(e) {
    $('#adding_liquidity').html(liquidity.toFixed(5));
    window.alert('Explorer недоступен. Не можем рассчитать курс покупки.');
    console.error(e);
}
    let all_liquidity = parseFloat($('#lp_liquidity').html().replace(',', '.'));
    let all_power = parseFloat($('#all_power').html().replace(',', '.'));
        let share = power / all_power;
    let farming_share = farming_amount * share;
    let value = parseFloat(farming_share.toFixed(18));
return value;
}

async function endRound() {
    let api = (await axios.get('https://api.minter.one/v2/status')).data;
    let block = (api.latest_block_height? api.latest_block_height : 0);
if (block !== 0) {
    let pl_block_interval = parseInt($('#pl_block_interval').html());
    let plj_block_interval = parseInt($('#plj_block_interval').html());
    let end_round_block = pl_block_interval - (block % pl_block_interval);
let timestamp = parseInt(end_round_block * 5);
var hours = Math.floor(timestamp / 60 / 60);
var minutes = Math.floor(timestamp / 60) - (hours * 60);
var seconds = timestamp % 60;
var end_round_time = [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    seconds.toString().padStart(2, '0')
  ].join(':');
$('#end_round').html(`${end_round_block} блоков (Примерно ${end_round_time})`)
let jackpot_end_round_block = plj_block_interval - (block % plj_block_interval);
let j_timestamp = parseInt(jackpot_end_round_block * 5);
var j_hours = Math.floor(j_timestamp / 60 / 60);
var j_minutes = Math.floor(j_timestamp / 60) - (j_hours * 60);
var j_seconds = j_timestamp % 60;
var jackpot_end_round_time = [
    j_hours.toString().padStart(2, '0'),
    j_minutes.toString().padStart(2, '0'),
    j_seconds.toString().padStart(2, '0')
  ].join(':');
$('#jackpot_end_round').html(`${jackpot_end_round_block} блоков (Примерно ${jackpot_end_round_time})`)

if (document.getElementById('rps_block_interval')) {
    let rps_block_interval = parseInt($('#rps_block_interval').html());
    let rps_end_round_block = rps_block_interval - (block % rps_block_interval);
let rps_timestamp = parseInt(rps_end_round_block * 5);
var rps_hours = Math.floor(rps_timestamp / 60 / 60);
var rps_minutes = Math.floor(rps_timestamp / 60) - (rps_hours * 60);
var rps_seconds = rps_timestamp % 60;
var rps_end_round_time = [
    rps_minutes.toString().padStart(2, '0'),
    rps_seconds.toString().padStart(2, '0')
  ].join(':');
$('#end_rps_round').html(`${rps_end_round_block} блоков (Примерно ${rps_end_round_time})`)
}
}
}

function rpsResults() {
    $('#rps_results').html(`<script async src="https://telegram.org/js/telegram-widget.js?15" data-telegram-post="long_have_fun/64" data-width="100%"></script>`);
}

async function selectedSendCoin(address, memo, symbol) {
    let symbol_balance = 0;
    let bip_balance = 0;
    let bip_fee = 0;
    let symbol_fee = 0;
    if (seed || current_user && current_user.type === 'bip.to') {
      let tokens = await getBalance(sender.address);
      let fee =     await send(address, 100, "LONG", memo, 'fee', symbol);
      let coin_fee = 'BIP';
      let fee_amount = fee.bip_fee;
      if (fee.fee !== fee.bip_fee) {
          fee_amount = fee.fee;
          coin_fee = symbol;
      }
      symbol_fee = fee.fee;
      bip_fee = fee.bip_fee;
      for (let token of tokens) {
          if (token.coin === symbol) {
            symbol_balance += parseFloat(token.amount);
          } else if (token.coin === 'BIP') {
              bip_balance += parseFloat(token.amount);
          }
      }
  
    let max_amount = 0;
if (bip_balance >= bip_fee) {
    max_amount = symbol_balance;
} else if (bip_balance < bip_fee && 1 + symbol_fee <= symbol_balance) {
    max_amount = symbol_balance - symbol_fee;
    }

    $('#max_bid').html(max_amount);
$('#selected_symbol').html(symbol);
    return {bid_bip_balance: bip_balance, bid_bip_fee: bip_fee, bid_symbol_balance: symbol_balance, bid_symbol_fee: symbol_fee};
}
}

$(document).ready(async function() {
    var url = document.location.pathname;
    updateBidsTable(url.split('/'));
    const date = new Date().toLocaleString();
    if (document.getElementById('page_date')) $('#page_date').html(date);
    
await getPrices();

if (url.indexOf('surveys') > -1 && url.indexOf('voteing') > -1) {
    $.getJSON('https://dpos.space/blockchains/minter/apps/long/api.php/provider?address=' + sender.address, function(data) {
    if (Object.keys(data).length == 0) {
$('#is_provider').html('<p><strong>К сожалению вы не являетесь провайдером пула, поэтому не можете голосовать. Ну или произошла ошибка: если это так, <a href="https://t.me/long_project_chat" target="_blank">пишите в чат</a></strong></p>')
    }
});
}

    $('#max_lp').click(function() {
    let amount = $('#max_lp').html();
    $('[name=lp_tokens]').val(amount);
    $('[name=calc_percent]').val(100);
    $('#lp_percent').html(100);
    let my_share = parseFloat($('[name=my_share]').val().replace(',', '.'));
let get_amount = parseFloat($('#all_get_amount').html().replace(',', '.'));
let result = get_amount - (get_amount * (my_share / 100));
$('#send_amount').html(result);
}); // end max LP click.

$('[name=lp_tokens]').change(function() {
    let amount = parseFloat($('[name=lp_tokens]').val().replace(',', '.'));
let max = parseFloat($('#max_lp').html().replace(',', '.'));
let percent = amount / max * 100;
$('[name=calc_percent]').val(percent);
$('#lp_percent').html(percent);
let my_share = parseFloat($('[name=my_share]').val().replace(',', '.'));
let get_amount = parseFloat($('#all_get_amount').html().replace(',', '.'));
get_amount *= percent / 100;
let result = get_amount - (get_amount * (my_share / 100));
$('#send_amount').html(result);
}); // end change LP_tokens.

$('[name=calc_percent]').change(function() {
    let percent = parseFloat($('[name=calc_percent]').val().replace(',', '.'));
let max = parseFloat($('#max_lp').html().replace(',', '.'));
let amount = max * (percent / 100)
$('[name=lp_tokens]').val(amount);
let my_share = parseFloat($('[name=my_share]').val().replace(',', '.'));
let get_amount = parseFloat($('#all_get_amount').html().replace(',', '.'));
get_amount *= percent / 100;
let result = get_amount - (get_amount * (my_share / 100));
$('#lp_percent').html(percent);
$('#send_amount').html(result);
}); // end change

$('[name=my_share]').change(function() {
    let percent = parseFloat($('[name=calc_percent]').val());
let my_share = $('[name=my_share]').val();
let get_amount = parseFloat($('#all_get_amount').html().replace(',', '.'));
get_amount *= percent / 100;
let result = get_amount - (get_amount * (my_share / 100));
$('#self_percent').html(my_share);
$('#send_amount').html(result);
}); // end change my_share

if (document.querySelector('[name=friends_templates]')) {
    let friends = JSON.parse($('#json_friends').html());
    let fcount = 0;
    if (Object.keys(friends).length > 0) {
        for (let friend of friends) {
            $('[name=friends_templates]').append(`<option value="${friend.name}">${friend.name}</option>`);
            fcount += friend.lp_tokens;
        }
    }
    $('[name=friends_templates]').change(function() {
    let friend = $('[name=friends_templates]').val();
    if(friend !== '') {
        let friend_object = friends.reduce(function (acc, elem, index) {
            if (acc < 0) acc = -1;
            if( elem.name === friend) {
                acc = index;
            }
            return acc;
        }, []);
          if (friend_object === -1) return;
        let fd = friends[friend_object];
        if (sender.address === page_address) {
        $('#delete_friend').css('display', 'inline');
        $('#delete_friend').html(`(<input type="button" value="Удалить" id="delete_friend">)`);
    }
        $('[name=lp_tokens]').val(fd.lp_tokens);
    $('[name=my_share]').val(fd.my_share);
    $('#self_percent').html(fd.my_share);
    let max = parseFloat($('#max_lp').html().replace(',', '.'));
    let percent = fd.lp_tokens / max * 100;
    $('[name=calc_percent]').val(percent);
    $('#lp_percent').html(percent);
    let get_amount = parseFloat($('#all_get_amount').html().replace(',', '.'));
    get_amount *= percent / 100;
    let result = get_amount - (get_amount * (fd.my_share / 100));
    $('#send_amount').html(result);
    } else {
        $('#delete_friend').css('display', 'none');
        $('#delete_friend').html(``);
        $('[name=lp_tokens]').val('');
    $('[name=my_share]').val(0);
    $('#self_percent').html(0);
    $('[name=calc_percent]').val(0);
    $('#lp_percent').html(0);
    $('#send_amount').html(0);
    }
    });
    
    var page_address = document.location.pathname.split('/')[4];
    if (sender.address === page_address) {
        $('#save_friend').css('display', 'inline');
        
        $('#delete_friend').click(async function() {
            let friend = $('[name=friends_templates]').val();
            var q = window.confirm('Вы действительно хотите удалить?');
            if (q == false) return;
            if(friend !== '') {
                let friend_object = friends.reduce(function (acc, elem, index) {
                    if (acc < 0) acc = -1;
                    if( elem.name === friend) {
                        acc = index;
                    }
                    return acc;
                }, []);
                if (friend_object === -1) return;
                let fd = friends[friend_object];
                let data = [];
                data[0] = "delete_friend";
                    data[1] = {name: friend};
                    await send('Mx01029d73e128e2f53ff1fcc2d52a423283ad9439', 0, 0, JSON.stringify(data), '', 0);
                delete friends[friend_object];
                $('[name=friends_templates] :selected').remove();
                fcount -= fd.lp_tokens;
                $('#delete_friend').css('display', 'none');
                $('#delete_friend').html(``);
                $('[name=lp_tokens]').val('');
        $('[name=my_share]').val(0);
        $('#self_percent').html(0);
        $('[name=calc_percent]').val(0);
        $('#lp_percent').html(0);
        $('#send_amount').html(0);
            }
        });
        
        $('#save_friend').click(async function() {
            let max = parseFloat($('#max_lp').html().replace(',', '.'));
            let friend = $('[name=friends_templates]').val();
            let send_amount = parseFloat($('#send_amount').html().replace(',', '.'));
            if (friend === '' && send_amount && send_amount !== '' && send_amount > 0) {
                        var name = window.prompt('Введите имя, по которому идентифицировать будете друга');
                if (!name || typeof name == 'undefined' || name === '') return;
            } else {
            if (friend && friend !== '') {
                name = friend;
            }
            }
            var q = window.confirm('Сохранить друга?');
        if (q == true) {
  let amount = parseFloat($('[name=lp_tokens]').val().replace(',', '.'));
            let my_share = parseFloat($('[name=my_share]').val().replace(',', '.'));
            let data = [];
        data[0] = "update_friend";
            data[1] = {name, lp_tokens: amount, my_share};
            let friend_object = friends.reduce(function (acc, elem, index) {
                if (acc < 0) acc = -1;
                if( elem.name === friend) {
                    acc = index;
                }
                return acc;
            }, []);
            if (friend_object === -1) {
                $('[name=friends_templates]').append(`<option value="${name}">${name}</option>`);
                friends.push({name, lp_tokens: amount, my_share});
                fcount += amount;
            } else {
                let fd = friends[friend_object];
                friends[friend_object] = {name, lp_tokens: amount, my_share};
                fcount -= fd.lp_tokens;
                fcount += amount;
            }
            if (fcount > max) {
            window.alert('Общая сумма LP-токенов больше максимума.');
        return;
        }
        await send('Mx01029d73e128e2f53ff1fcc2d52a423283ad9439', 0, 0, JSON.stringify(data), '', 0);
       }
        }); // end click save friend.
    
    }
} // end selector.

// profit calc.
$('[name=long_amount]').change(async function() {
    let value = await calculate();
    $('#result_profit').html(value.toFixed(5));
    });

    $('[name=invest_days_calc]').change(async function() {
        let value = await calculate();
        $('#result_profit').html(value.toFixed(5));
        });
// end profit calc.

// Лотереи с покупкой билетов или "Камень, ножницы, бумага".
$('#copy_address').click(async function() {
    try {
      let address = $('#send_to_address').html();
        await navigator.clipboard.writeText(address);
    } catch(e) {
      console.log(e);
    }
  });    

  $('#copy_memo').click(async function() {
    try {
      let memo = $('#send_with_memo').html();
        await navigator.clipboard.writeText(memo);
    } catch(e) {
      console.log(e);
    }
  });

  let memo = $('#send_with_memo').html();
  let address = $('#send_to_address').html();
  if (!address) address = 'Mx01029d73e128e2f53ff1fcc2d52a423283ad9439';
  let long_balance = 0;
  let bip_balance = 0;
  let bip_fee = 0;
  let long_fee = 0;
  if (seed || current_user && current_user.type === 'bip.to') {
    let tokens = await getBalance(sender.address);
    let fee =     await send(address, 100, "LONG", memo, 'fee', 'LONG');
    let coin_fee = 'BIP';
    let fee_amount = fee.bip_fee;
    if (fee.fee !== fee.bip_fee) {
        fee_amount = fee.fee;
        coin_fee = 'LONG';
    }
    long_fee = fee.fee;
    bip_fee = fee.bip_fee;
    for (let token of tokens) {
        if (token.coin === 'LONG') {
            long_balance += parseFloat(token.amount);
        } else if (token.coin === 'BIP') {
            bip_balance += parseFloat(token.amount);
        }
    }
let types = ['10', '50', '100', '500', '1000'];
for (let type of types) {
    if (long_balance > parseInt(type))  $('[name=loto_type]').append(`<option value="${parseInt(type)}">${parseInt(type)} LONG</option>`);
}
$('#action_buy_ticket').click(async function() {
    let amount = parseFloat($('[name=loto_type]').val());
    var q = window.confirm(`Вы действительно хотите купить билет на ${amount} LONG?`);
    if (q === true && bip_balance >= bip_fee) {
        await send(address, amount, "LONG", memo, '', 0);
    } else if (q === true && bip_balance < bip_fee && amount + long_fee <= long_balance) {
        await send(address, amount, "LONG", memo, '', 'LONG');
    } else if (q === true && bip_balance < fee.bip_fee && amount + fee.fee < long_balance) {
    window.alert('Вам не хватает BIP или LONG для оплаты комиссии.');
    }
});
}

// Камень, ножницы, бумага.
let max_amount = 0;
if (bip_balance >= bip_fee) {
    max_amount = long_balance;
} else if (bip_balance < bip_fee && 1 + long_fee <= long_balance) {
    max_amount = long_balance - long_fee;
    }

    $('#max_rps').html(max_amount);
$('#max_rps').click(async function() {
let max = parseFloat($('#max_rps').html());
$('[name=amount]').val(max);
});

$('#action_rps_play').click(async function() {
let amount = $('[name=amount]').val();
let memo = "lrps";
var q = window.confirm(`Вы действительно хотите играть со ставкой ${amount} LONG?`);
if (q === true && bip_balance >= bip_fee) {
    await send(address, amount, "LONG", memo, '', 0);
} else if (q === true && bip_balance < bip_fee && amount + long_fee <= long_balance) {
        await send(address, amount, "LONG", memo, '', 'LONG');
    } else if (q === true && bip_balance < bip_fee && amount + long_fee < long_balance) {
    window.alert('Вам не хватает BIP или LONG для оплаты комиссии.');
    }
});
if (document.getElementById('rps_results')) {
    rpsResults();
    setInterval(rpsResults, 60000);
}
// конец блока игры rps.

await endRound();
setInterval(endRound, 5000);
// Конец блока кода лотерей с покупкой билетов или игры rps.

// Ставки на курс крипты и пулов.

let symbol = $('#bid_send_coin').val();
let {bid_bip_balance, bid_bip_fee, bid_symbol_balance, bid_symbol_fee} = await selectedSendCoin(address, memo, symbol);

$('#max_bid').click(async function() {
    let max = parseFloat($('#max_bid').html());
    $('[name=bid_amount]').val(max);
    });
    
$('#action_send_bid').click(async function() {
    let symbol = $('#bid_send_coin').val();
    let amount = parseFloat($('[name=bid_amount]').val());
    let min_amount = parseFloat($('[name=bid_amount]').attr('min'));
    let token = $('[name=bids_tokens]').val();
    let direction = document.querySelector('input[name="bids_direction"]:checked').value;
    let memo = `lbid ${token} ${direction}`;
    if (min_amount > amount) {
        window.alert('Для данного токена минимум ' + min_amount + '. Укажите верную сумму ставки');
    return;
    }

    var q = window.confirm(`Вы действительно хотите сделать ставку в ${token} на ${amount} LONG?`);
    if (q === true && bid_bip_balance >= bid_bip_fee) {
        await send(address, amount, symbol, memo, '', 0);
    } else if (q === true && bid_bip_balance < bid_bip_fee && amount + bid_symbol_fee <= bid_symbol_balance) {
            await send(address, amount, symbol, memo, '', symbol);
        } else if (q === true && bid_bip_balance < bid_bip_fee && amount + bid_symbol_fee < bid_symbol_balance) {
        window.alert('Вам не хватает BIP или LONG для оплаты комиссии.');
        }
    });

    // Конец блока сервиса со ставками на курс крипты и пулов.

// Добавление ликвидности:
let add_gasCoin = 'BIP';
if (document.getElementById('current_price')) {
let max_add_amount = long_balance;
    $('#max_add').html(max_add_amount);
        let max_add_bip_amount = bip_balance;
    $('#max_add_bip').html(max_add_bip_amount);
    
    $('#max_add').click(async function() {
let max = parseFloat($('#max_add').html());
let price = (await getPrices()).price;
let bip_amount = max / price;

let add_fee =     await addToPool('LONG', 'BIP', max, bip_amount, 'fee', '', 'LONG', referer);
let add_long_fee = add_fee.fee;
let add_bip_fee = add_fee.bip_fee;
if (long_balance - add_long_fee >= 0) {
    max -= add_long_fee;
    add_gasCoin = 'LONG';
}
bip_amount = max * price;

$('[name=add_bip_amount]').val(bip_amount);
$('[name=add_amount]').val(max);
});

$('#max_add_bip').click(async function() {
    let max = parseFloat($('#max_add_bip').html().replace(',', '.'));
    let price = (await getPrices()).price;
let long_amount = max * price;

let add_fee =     await addToPool('LONG', 'BIP', long_amount, max, 'fee', '', 'LONG', referer);
let add_long_fee = add_fee.fee;
let add_bip_fee = add_fee.bip_fee;
if (bip_balance - add_bip_fee >= 0) {
    max -= add_bip_fee;
    add_gasCoin = 'BIP';
}
long_amount = max / price;

$('[name=add_amount]').val(long_amount);
$('[name=add_bip_amount]').val(max);
});

$('[name=add_amount]').change(async function() {
    let amount = parseFloat($('[name=add_amount]').val().replace(',', '.'));
    let price = (await getPrices()).price;
    let bip_amount = amount / price;
    
    let add_fee =     await addToPool('LONG', 'BIP', amount, bip_amount, 'fee', '', 'LONG', referer);
let add_long_fee = add_fee.fee;
let add_bip_fee = add_fee.bip_fee;
if (long_balance - add_long_fee >= 0 && amount + add_long_fee >= long_balance) {
    amount -= add_long_fee;
    add_gasCoin = 'LONG';
}
bip_amount = amount * price;

    $('[name=add_bip_amount]').val(bip_amount);
});

$('[name=add_bip_amount]').change(async function() {
    let amount = parseFloat($('[name=add_bip_amount]').val().replace(',', '.'));
    let price = (await getPrices()).price;
    let long_amount = amount * price;
    
    let add_fee =     await addToPool('LONG', 'BIP', long_amount, amount, 'fee', '', 'LONG', referer);
let add_long_fee = add_fee.fee;
let add_bip_fee = add_fee.bip_fee;
    if (bip_balance - add_bip_fee >= 0 && amount + add_bip_fee >= bip_balance) {
    amount -= add_bip_fee;
    add_gasCoin = 'BIP';
}
long_amount = amount / price;

    $('[name=add_amount]').val(long_amount);
});

$('#action_add_liquidity').click(async function() {
    let amount1 = parseFloat($('[name=add_amount]').val().replace(',', '.'));
    let amount2 = parseFloat($('[name=add_bip_amount]').val().replace(',', '.'));    
var q = window.confirm('Вы действительно хотите добавить ликвидность?');
if (q === true) {
    await addToPool('LONG', 'BIP', amount1, amount2, '', '', add_gasCoin, referer);
}
});
}
// Конец блока добавления ликвидности.

$(async function() {
    try {
    let coins = $('#allowedCoins').html().split(',');
    let minAmountsAllowedCoins = [];
if (document.getElementById('minAmountsAllowedCoins')) minAmountsAllowedCoins = $('#minAmountsAllowedCoins').html().split(',');

    $("#bid_send_coin").autocomplete({ //на какой input:text назначить результаты списка
        source: function(request, response) {
            var term = request.term;
            var pattern = new RegExp("^" + term, "i");
  
            var results = $.map(coins, function(elem, i) {                       
                if (pattern.test(elem)) {
                  $('[name=bid_amount]').attr('min', parseFloat(minAmountsAllowedCoins[i]));
                    let token = $('[name=tokens]').val();
  if (elem !== token) return elem;
}
            })                    
            response(results);
  }
  })
  } catch(e) {
    console.log(e);
  }
  });

});