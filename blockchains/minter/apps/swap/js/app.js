function openMode(evt, modeName) {
  var i, tabcontent, tablinks;

  tabcontent = document.getElementsByClassName("tabcontent");
  for (i = 0; i < tabcontent.length; i++) {
      tabcontent[i].style.display = "none";
  }
  
  tablinks = document.getElementsByClassName("tablinks");
  for (i = 0; i < tablinks.length; i++) {
      tablinks[i].className = tablinks[i].className.replace(" active", "");
      tablinks[i].removeAttribute('aria-current')
    }
      
    if (modeName === 'Обмен') {
      history.pushState([], '', `/minter/swap`);
    } else {
      history.pushState([], '', `/minter/swap/pool`);
    }
    document.getElementById(modeName).style.display = "block";
try {
  evt.currentTarget.className += " active";
  evt.currentTarget.setAttribute("aria-current", "page");
} catch(e) {
 let elements = document.querySelectorAll('.tablinks');
  evt = elements[0];
 if (modeName === 'Вложить') evt = elements[1];
  evt.className += " active";
  evt.setAttribute("aria-current", "page");
}
}

function compareCoins(a, b)
{
	if(parseFloat(a.reserve_balance) > parseFloat(b.reserve_balance))
	{
		return -1;
	}
	else{
		return 1;
	}
}



function bind_range(){
	$('input[type=range]').each(function(i){
		if(typeof $(this).attr('data-fixed') !== 'undefined'){
			let fixed_name=$(this).attr('data-fixed');
			let fixed_min=parseInt($(this).attr('min'));
			let fixed_max=parseInt($(this).attr('max'));
			$(this).unbind('change');
			$(this).bind('change',function(){
				if($(this).is(':focus')){
					$('input[name='+fixed_name+']').val($(this).val());
				}
			});
			$('input[name='+fixed_name+']').unbind('change');
			$('input[name='+fixed_name+']').bind('change',function(){
				let fixed_name=$(this).attr('data-fixed');
				let val=parseInt($(this).val());
				if(val>fixed_max){
					val=fixed_max;
				}
				if(val<fixed_min){
					val=fixed_min;
				}
				$(this).val(val);
				$('input[name='+fixed_name+']').val($(this).val());
			});
		}
	});
}

  async function loadBalances() {
let tokens = await getBalance(sender.address);
    let balances_list = '';
    for (let token of tokens) {
        let amount = parseFloat(token.amount);
        balances_list += `<option value="${token.coin}" data-max="${amount}">${token.coin}</option>`;
    }
$('[name=tokens]').html(balances_list);
$('[name=tokens1]').html('<option value="">Выберите токен №1</option>' + balances_list);
$('[name=tokens2]').html('<option value="">Выберите токен №2</option>' + balances_list);
}

function byteCount(s) {
  return encodeURI(s).split(/%..|./).length - 1;
}

async function getFee(coin, type, memo) {
  let memo_bytes = byteCount(memo) * 0.2;
let type_fee = 1;
if (type === 'convert') type_fee = 10;
if (type === 'delegate' || type === 'anbond') type_fee = 20;  
let fee = (memo_bytes + type_fee).toFixed(3);
if (coin !== 'BIP') {
  let coin_info = await minter.getCoinInfo(coin);
  let price = (coin_info.volume / coin_info.reserve_balance) * (coin_info.crr / 100);
  fee = ((memo_bytes + type_fee) * price).toFixed(3);
  }
  let minGasPrice = await axios.get('/min_gas_price');
  let gasPrice = parseInt(minGasPrice.data.min_gas_price)
  fee *= gasPrice;
  $(`#${type}_fee`).html(fee);
return fee;
}

async function getConvertPrice() {
  let coin = $('.convert_modal_token').html();
  let to = $('#action_convert_to').val().toUpperCase();
  let amount = $('#action_convert_amount').val();
  amount = parseFloat(amount);
  let max_amount = $('#max_convert_amount').html();
  max_amount = parseFloat(max_amount);
  if (amount && amount !== '' && amount > 0 && to !== '') {
    try {
      let response = await axios.get(`https://explorer-api.minter.network/api/v2/pools/coins/${coin}/${to}/route?amount=${amount * (10 ** 18)}&type=input`);
      let coins = [];
      let counter = 0;
      let all_coins = response.data.coins.length;
      for (let coin of response.data.coins) {
if (counter > 0 && counter < all_coins - 1) {
  coins.push(coin.id);
}
      counter++;
        }
        let coins_list = `${coin},${coins.join(',')},${to}`;
        if (coins.length === 0) coins_list = `${coin},${to}`;
        let fee = parseFloat(await convert(coin, to, amount, 0, coins_list, 'fee'));
        if (amount === max_amount) {
          amount -= fee;
        }
        let to_buy = await minter.estimateCoinSell({
      coinToSell: coin,
      valueToSell: amount,
      coinToBuy: to,
      swap_from: 'optimal',
      route: coins
    });
    $('#buy_amount').html(parseFloat(to_buy.will_get).toFixed(3));
  $('#convert_fee').html(parseFloat(fee).toFixed(3));
  $('#swap_route_block').css('display', 'block');
  $('#swap_route').html(coins_list);
    } catch(e) {
      let fee = parseFloat(await convert(coin, to, amount, 0, '', 'fee'));
      if (amount === max_amount) {
        amount -= fee;
      }
      let to_buy = await minter.estimateCoinSell({
        coinToSell: coin,
        valueToSell: amount,
        coinToBuy: to,
        swap_from: 'optimal'
      });
      $('#buy_amount').html(parseFloat(to_buy.will_get).toFixed(3));
    $('#convert_fee').html(parseFloat(fee).toFixed(3));
    $('#swap_route_block').css('display', 'none');
    $('#swap_route').html('');
  }
  $('#action_convert_amount').val(amount.toFixed(3));
} else {
    $('#buy_amount').html('');
    $('#convert_fee').html('');
    $('#swap_route_block').css('display', 'none');
    $('#swap_route').html('');
  }
}

async function getPoolPrice(direction) {
  let coin = $('[name=tokens' + direction + ']').val();
  let direction_z = 1;
if (direction === 1) direction_z = 2;
  let to = $('[name=tokens' + direction_z + ']').val().toUpperCase();
let amount = $('#action_pool_amount' + direction).val();
amount = parseFloat(amount);
let max_amount = $('#max_pool_amount' + direction_z).html();
max_amount = parseFloat(max_amount);

if (amount > 0 && to !== '') {
let coin_ids = await minter.getCoinId([coin, to])
try {
  let pool_data = await axios.get(`/swap_pool/${coin_ids[0]}/${coin_ids[1]}`);
  let res = pool_data.data;
  let amounts = [];
amounts[0] = res.amount0 / (10 ** 18);
  amounts[1] = res.amount1 / (10 ** 18);
let price = amounts[0] / amounts[1];
  let will_get = amount / price;
  let fee = await addToPool(coin, to, amount, will_get, 'fee');
  let fee_amount = amount - fee;
  will_get = fee_amount / price;
  $('#action_pool_amount1').val(parseFloat(fee_amount).toFixed(3));
  $('#action_pool_amount' + direction_z).val(parseFloat(will_get).toFixed(3));
$('#pool_fee').html(parseFloat(fee).toFixed(3));
$('#new_pool').css('display', 'none');
} catch(pool_error) {
  if (pool_error.message === 'Request failed with status code 404') {
$('#new_pool').css('display', 'block');
let fee = await addToPool(coin, to, amount, 1, 'fee', 'create_pool');
$('#pool_fee').html(parseFloat(fee).toFixed(3));
let fee_amount = amount - fee;
$('#action_pool_amount1').val(parseFloat(fee_amount).toFixed(3));
}
}
} else {
$('#action_pool_amount' + direction_z).val('');
$('#pool_fee').html('');
}
}

async function addLiquidity(coin0, coin1) {
  let max1 = $("select[name=tokens1] option[value=" + coin0 + "]").attr('selected', 'true').data('max');
  let max2 = $("select[name=tokens2] option[value=" + coin1 + "]").attr('selected', 'true').data('max');
  $('.convert_modal_token1').html(coin0);
  $('.convert_modal_token2').html(coin1);
  $('#max_pool_amount1').html(max1);
  $('#max_pool_amount2').html(max2);
  await getPoolPrice(1);
  $("html, body").animate({ scrollTop: 0 }, "slow");
}

$(document).ready(async function() {
  if (seed) {
    jQuery("#main_wallet_info").css("display", "block");
    await loadBalances();
  }

  $(document).on('click', '.remove_liquidity_modal', async function(e) {
    let token = $(this).attr('data-token');
    let liquidity = $(this).attr('data-liquidity');
    let coin0 = $(this).attr('data-coin0');
    let coin1 = $(this).attr('data-coin1');
$('#rl_modal_pool').html(`${coin0}/${coin1}`);
$('#rl_modal_token').html(token);
$('#rl_lp_balance').html(liquidity);
let fee = await removeFromPool(coin0, coin1, liquidity, 'fee');
$('#rl_fee').html(fee);
});

$('#action_rl_start').click(async function() {
let q = window.confirm('Вы действительно хотите удалить ликвидность?');
if (q === true) {
  let coins = $('#rl_modal_pool').html().split('/');
  let token = $('#rl_modal_token').html();
let lp_balance = parseFloat($('#rl_lp_balance').html())
let percent = parseFloat($('#action_rl_percent').val());
let remove_balance = lp_balance / 100 * percent;
await removeFromPool(coins[0], coins[1], remove_balance, '');
}
});

let select = $("[name=tokens] option:selected");
let token = $(select).val();
  let max = select.data('max');
  $('.convert_modal_token').html(token);
  $('#max_convert_amount').html(max);
  await getConvertPrice();

$('[name=tokens]').change(async function() {
  let token = $(this).val();
  let max = $("[name=tokens] option:selected").data('max');
  $('.convert_modal_token').html(token);
  $('.convert_modal_token').html(token);
  $('#max_convert_amount').html(max);
  await getConvertPrice();
});

$('[name=tokens1]').change(async function() {
  let token = $(this).val();
  let max = $("[name=tokens1] option:selected").data('max');
  $('.convert_modal_token1').html(token);
  $('#max_pool_amount1').html(max);
  await getPoolPrice(1);
});

$('[name=tokens2]').change(async function() {
  let token = $(this).val();
  let max = $("[name=tokens2] option:selected").data('max');
  $('.convert_modal_token2').html(token);
  $('#max_pool_amount2').html(max);
  await getPoolPrice(2);
});

$("#action_pool_start").click(async function(){
  let q = window.confirm('Вы действительно хотите добавить ликвидность?');
  if (q == true) {
    let coin = $('.convert_modal_token1').html();
    let to = $('.convert_modal_token2').html();
    let amount1 = parseFloat($('#action_pool_amount1').val());
    let amount2 = parseFloat($('#action_pool_amount2').val());

    try {
    $.fancybox.close(); 
  await addToPool(coin, to, amount1, amount2, '');
   await loadBalances();
  } catch(e) {
  window.alert('Ошибка: ' + e);
   }
  }
    }); // end subform

$("#action_convert_start").click(async function(){
  let q = window.confirm('Вы действительно хотите сделать обмен средств?');
  if (q == true) {
    let coin = $('.convert_modal_token').html();
   let to = $('#action_convert_to').val().toUpperCase();
    let amount = $('#action_convert_amount').val();
    amount = parseFloat(amount);
    let buy_amount = $('#buy_amount').html();
    buy_amount = parseFloat(buy_amount) * 0.9;
    let swap_route = $('#swap_route').html();

    try {
    $.fancybox.close(); 
    await convert(coin, to, amount, buy_amount, swap_route);
   await loadBalances();
  } catch(e) {
  window.alert('Ошибка: ' + e);
   }
  }
    }); // end subform
  
    $('#action_convert_to').change(async function() {
    await getConvertPrice();
});

$('#action_convert_amount').change(async function() {
  await getConvertPrice();
});

         $("#max_token_convert").click(async function(){
          let token = $('[name=tokens]').val();
          $('#action_convert_amount').val(new Number(parseFloat($('#max_convert_amount').html())).toFixed(3));
          await getConvertPrice();   
        });

        $('#action_pool_amount1').change(async function() {
          await getPoolPrice(1);
        });

        $('#action_pool_amount2').change(async function() {
          await getPoolPrice(2);
        });

        $("#max_token_pool1").click(async function(){
          let token = $('[name=tokens1]').val();
          $('#action_pool_amount1').val(new Number(parseFloat($('#max_pool_amount1').html())).toFixed(3));
          await getPoolPrice(1);   
        });
        
        $("#max_token_pool2").click(async function(){
          let token = $('[name=tokens2]').val();
          $('#action_pool_amount2').val(new Number(parseFloat($('#max_pool_amount2').html())).toFixed(3));
          await getPoolPrice(2);   
        });
            
        var mode = document.location.pathname.split('/')[3];
            if (mode === 'pool') {
  openMode(event, `Вложить`);
} else {
  openMode(event, `Обмен`);
}

       
if(0<$('input[type=range]').length){
  bind_range();
}

// Получаем пулы.
let pools_res = await axios.get(`https://explorer-api.minter.network/api/v2/pools/providers/${sender.address}`);
let pools = pools_res.data.data;
for (let pool of pools) {
  $('#my_pools').append(`<tr>
<td><a href="https://chainik.io/coin/${pool.token.symbol}" target="_blank">${pool.token.symbol}</a></td>
  <td><a href="https://chainik.io/pool/${pool.coin0.symbol}/${pool.coin1.symbol}" target="_blank">${pool.coin0.symbol}/${pool.coin1.symbol}</a></td>
<td>${parseFloat(pool.amount0).toFixed(3)} ${pool.coin0.symbol}</td>
<td>${parseFloat(pool.amount1).toFixed(3)} ${pool.coin1.symbol}</td>
<td>${parseFloat(pool.liquidity).toFixed(3)}</td>
<td>${parseFloat(pool.liquidity_share).toFixed(2)}%</td>
<td><a onclick="addLiquidity('${pool.coin0.symbol}', '${pool.coin1.symbol}')">Добавить ликвидность</a>, <a data-fancybox class="remove_liquidity_modal" data-src="#remove_liquidity_modal" href="javascript:;" data-token="${pool.token.symbol}" data-coin0="${pool.coin0.symbol}" data-coin1="${pool.coin1.symbol}" data-liquidity="${pool.liquidity}">Удалить ликвидность</a></td>
</tr>`);
}

$(async function() {
  try {
  let result = await axios.get('https://explorer-api.minter.network/api/v2/coins');
  let res = result.data.data;
  res.sort(compareCoins);
  let coins = res.reduce(function(p,c){return p + ',' + c.symbol;},[]).split(',');
  $("#action_convert_to").autocomplete({ //на какой input:text назначить результаты списка
      source: function(request, response) {
          var term = request.term;
          var pattern = new RegExp("^" + term, "i");

          var results = $.map(coins, function(elem) {                       
              if (pattern.test(elem)) {
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