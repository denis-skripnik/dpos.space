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
        let amount = token.amount / (10 ** 18);
        amount = amount.toFixed(3);
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
  let coin = $('[name=tokens]').val();
  let to = $('#action_convert_to').val().toUpperCase();
  let amount = $('#action_convert_amount').val();
  amount = parseFloat(amount);
  let max_amount = $('#max_convert_amount').html();
  max_amount = parseFloat(max_amount);
  if (amount > 0 && to !== '') {
    let to_buy = await minter.estimateCoinSell({
      coinToSell: coin,
      valueToSell: amount,
      coinToBuy: to,
      swap_from: 'optimal'
    });
    $('#buy_amount').html(parseFloat(to_buy.will_get).toFixed(3));
    $('#convert_fee').html(parseFloat(fee).toFixed(3));
    $('#convert_from').html(to_buy.swap_from);
} else {
    $('#buy_amount').html('');
    $('#convert_fee').html('');
    $('#convert_from').html('');
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
let to_buy = await minter.estimateCoinSell({
  coinToSell: coin,
  valueToSell: amount,
  coinToBuy: to,
});
$('#action_pool_amount' + direction_z).val(parseFloat(to_buy.will_get).toFixed(3));
$('#pool_fee').html(parseFloat(to_buy.commission).toFixed(3));
} else {
$('#action_pool_amount' + direction_z).val('');
$('#pool_fee').html('');
}
}

$(document).ready(async function() {
  if (seed) {
    jQuery("#main_wallet_info").css("display", "block");
    await loadBalances();
  }

let select = $("[name=tokens] option:selected");
let token = $(select).val();
  let max = select.data('max');
  let fee = parseFloat(await getFee(token, 'convert', ''));
    max -= fee + 0.001;
  if (max < 0) {
    $('#max_convert_amount').html(0);
  } else {
    $('#max_convert_amount').html(max);
  }
  $('.convert_modal_token').html(token);

$('[name=tokens]').change(async function() {
  let token = $(this).val();
  let max = $("[name=tokens] option:selected").data('max');
  $('#max_convert_amount').html(max);
  let fee = parseFloat(await getFee(token, 'convert', ''));
  max -= fee + 0.001;
if (max < 0) {
  $('#max_convert_amount').html(0);
} else {
  $('#max_convert_amount').html(max);
}
  $('.convert_modal_token').html(token);
});

$('[name=tokens1]').change(async function() {
  let token = $(this).val();
  let max = $("[name=tokens1] option:selected").data('max');
  $('#max_pool_amount1').html(max);
  let fee = parseFloat(await getFee(token, 'convert', ''));
  max -= fee + 0.001;
if (max < 0) {
  $('#max_pool_amount1').html(0);
} else {
  $('#max_pool_amount1').html(max);
}
  $('.convert_modal_token').html(token);
});

$('[name=tokens2]').change(async function() {
  let token = $(this).val();
  let max = $("[name=tokens2] option:selected").data('max');
  $('#max_pool_amount2').html(max);
  let fee = parseFloat(await getFee(token, 'convert', ''));
  max -= fee + 0.002;
if (max < 0) {
  $('#max_pool_amount2').html(0);
} else {
  $('#max_pool_amount2').html(max);
}
  $('.convert_modal_token').html(token);
});

$("#action_convert_start").click(async function(){
  let q = window.confirm('Вы действительно хотите сделать обмен средств?');
  if (q == true) {
    let coin = $('.convert_modal_token').html();
   let to = $('#action_convert_to').val().toUpperCase();
    let amount = $('#action_convert_amount').val();
    amount = parseFloat(amount);
   
   try {
    $.fancybox.close(); 
    await convert(coin, to, amount)
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