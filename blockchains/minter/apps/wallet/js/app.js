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



async function links(token, variant) {
$('#actions').html(`<li><a data-fancybox class="transfer_modal" data-src="#transfer_modal" href="javascript:;" data-token="${token}" onclick="getTransferTemplates('${token}');">Перевести ${token}</a></li>
<li><a data-fancybox class="convert_modal" data-src="#convert_modal" href="javascript:;" data-token="${token}">Конвертировать ${token}</a></li>
`);
if (variant === 'coin') {
  $('#actions').append(`<li><a data-fancybox class="delegate_modal" data-src="#delegate_modal" href="javascript:;" data-token="${token}" onclick="getDelegateTemplates('${token}');">Делегировать ${token}</a></li>
  `);
}
}

var link_state = {};
async function actionsSpoiler(t) {
    let token = $(t).attr('data-token');
    let variant = $(t).attr('data-variant');
    style = document.getElementById('actions').style;
    if (!link_state.display || link_state.token === token) {
      style.display = (style.display == 'block') ? 'none' : 'block';
      }
      await links(token, variant);
    link_state.token = token;
    link_state.display = style.display;
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
        amount = amount.toFixed(3);
        balances_list += `<li><a class="spoiler" data-tipe="main_balance" data-token="${token.coin}" data-variant="${token.type}" onclick="actionsSpoiler(this);" title="Клик для выбора действия"><span id="max_${token.coin}">${amount}</span> ${token.coin}</a></li>`;
    }
$('#balances').html(balances_list);
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

function getTransferTemplates(token) {
  $('#select_transfer_template').html('<option value="">Выберите шаблон (данные будут установлены в поля при выборе)</option>');
  
  let transfer_templates = JSON.parse(localStorage.getItem(token + '_minter_transfer_templates'));
 if (transfer_templates && transfer_templates.length > 0) {
  let template_count = 1;
  for (let template of transfer_templates) {
$('#select_transfer_template').append(`<option value="${template_count}" data-to="${template.to}" data-memo="${template.memo}">${template.name}</option>
`);
template_count++;
}
 }
}

function getDelegateTemplates(token) {
  $('#select_delegate_template').html('<option value="">Выберите шаблон (данные будут установлены в поля при выборе)</option>');
  let delegate_templates = JSON.parse(localStorage.getItem(token + '_minter_delegate_templates'));
 if (delegate_templates && delegate_templates.length > 0) {
  let template_count = 1;
  for (let template of delegate_templates) {
$('#select_delegate_template').append(`<option value="${template_count}" data-key="${template.key}">${template.name}</option>
`);
template_count++;
}
 }
}

function prepareContent(text) {
  try {
    return text.replace(/[^=][^""][^"=\/](https?:\/\/[^" <>\n]+)/gi, data => {
      const link = data.slice(3);
        if(/(jpe?g|png|svg|gif)$/.test(link)) return `${data.slice(0,3)} <img src="${link}" alt="" /> `
        if(/(vimeo)/.test(link)) return `${data.slice(0,3)} <iframe src="${link}" frameborder="0" allowfullscreen></iframe> `;
        if(/(youtu)/.test(link)) return `${data.slice(0,3)} <iframe src="${link.replace(/.*v=(.*)/, 'https://www.youtube.com/embed/$1')}" frameborder="0" allowfullscreen></iframe> `;
        return `${data.slice(0,3)} <a href="${link}">${link}</a> `
      }).replace(/ (@[^< \.,]+)/gi, user => ` <a href="/minter/profiles/${user.trim().slice(1)}">${user.trim()}</a>`)
  } catch(e) {
    return text;
  }
 }

 async function getHistory(page) {
    jQuery("#wallet_transfer_history").css("display", "block");try {
    let response = await axios.get('https://explorer-api.minter.network/api/v2/addresses/' + sender.address + '/transactions?page=' + page);
    let results = '';
    let res = response.data.data;
let types = {
1: 'Отправка',
2: 'Продажа монеты',
3: 'Продажа всех монет',
4: 'Покупка монет',
5: 'Создание монеты',
6: 'Объявление кандидата в валидаторы',
7: 'Делегирование',
8: 'Анбонд',
9: 'Получение чека',
10: 'Установка кандидата в статусе онлайн',
11: 'Установка кандидата в статусе оффлайн',
12: 'Создание мультисига',
13: 'Мультисенд (мульти-отправка)',
14: 'Редактирование кандидата',
15: 'Установка блока остановки',
16: 'Пересоздание монеты',
17: 'Изменение владельца монеты',
18: 'Редактирование мультисига',
19: 'Голосование за цену',
20: 'Изменение публичного ключа кандидата',
21: 'Добавление ликвидности',
22: 'Удаление ликвидности',
23: 'Продажа через пул',
24: 'Покупка через пул',
25: 'Продажа всех монет через пул',
26: 'Покупка всех монет через пул',
27: 'Изменение комиссии кандидата',
28: 'Перемещение стейка',
29: 'Эмиссия токена',
30: 'Сжигание токена',
31: 'Создание токена',
32: 'Пересоздание токена',
33: 'Голосование за комиссию',
34: 'Голосование за обновление',
35: 'Создание пула ликвидности'
};
for (let tr of res) {
let amount;
let coin_str = 'coin';
let value_str = 'value';
let type = types[tr.type];
if (tr.type === 1 && tr.data.to === sender.address) {
type = 'Получение';
} else if (tr.type === 2 || tr.type === 3 || tr.type === 23 || tr.type === 25) {
  coin_str = 'coin_to_buy'
  value_str = 'value_to_sell';
  } else if (tr.type === 4 || tr.type === 24 || tr.type === 26) {
    coin_str = 'coin_to_sell'
    value_str = 'value_to_buy';
  } else if (tr.type === 21 || tr.type === 22 || tr.type === 35) {
    coin_str = 'coin0'
    value_str = 'volume0';
  }
  
if (!tr.data.list) {
  amount = parseFloat(tr.data[value_str]);
  amount += ' ' + tr.data[coin_str].symbol;
  } else {
let sum_amount = 0;
    let coin = '';
for (let el of tr.data.list) {
  if (tr.from === sender.address || el.to === sender.address) {
  sum_amount += parseFloat(el[value_str]);
  coin = el[coin_str].symbol;
}
}
amount = sum_amount;
amount += coin;
}
let get_time = Date.parse(tr.timestamp);
let memo = decodeURIComponent(escape(window.atob(tr.payload)));
memo = prepareContent(memo);
results += `
<tr><td>${date_str(get_time, true, false, true)}</td>
<td><a href="/minter/explorer/block/${tr.height}" target="_blank">${tr.height}</a></td>
<td><a href="/minter/explorer/tx/${tr.hash}" target="_blank">${tr.hash}</a></td>
<td>${type}</td>
<td>${amount}</td>
<td>${memo}</td>
</tr>`;
}
let next_page = page + 1;
let prev_page = page - 1;
if (page === 1) {
$('#history_pages').html(`<a onclick="getHistory(${next_page});">Следующая</a>`);
} else if (page > 1 && res.length === 50) {
$('#history_pages').html(`<a onclick="getHistory(${prev_page});">Предыдущая</a>
<a onclick="getHistory(${next_page});">Следующая</a>`);
} else {
$('#history_pages').html(`<a onclick="getHistory(${prev_page});">Предыдущая</a>`);
}
$('#history_tbody').css('display', 'block');
$('#history_tbody').html(results);
} catch(e) {
       console.log(e);
     }
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
  let fee = parseFloat(await getFee(coin, 'convert', ''));
  if (amount === max_amount) {
    amount -= fee + 0.001;
  }
  $('#action_convert_amount').val(amount.toFixed(3));
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

async function getDelegations() {
  try {
    let result = await axios.get('https://explorer-api.minter.network/api/v2/addresses/' + sender.address + '/delegations');
let res = result.data.data;
    if (res && res.length > 0) {
  $('#delegation_tbody').css('display', 'block');
  let table = '';
  for (let el of res) {
let amount = parseFloat(el.value).toFixed(3) + ' ' + el.coin.symbol;
let bip_amount = parseFloat(el.bip_value).toFixed(3) + ' BIP';
let validator_key = el.validator.public_key;
let validator_name = el.validator.name;
let validator_status = 'Валидатор';
if (el.validator.status === 1) {
  validator_status = 'Кандидат';
} else if (el.validator.status === 0) {
  validator_status = 'Отключён';
}
let is_waitlisted = (el.is_waitlisted == false ? 'Нет' : 'Да');
table += `<tr>
<td><strong>${validator_status}</strong>
<input type="text" readonly id="validator_${el.coin.symbol}_${validator_key}" value="${validator_key}"> (<input type="button" value="копировать" onclick="copyText('validator_${el.coin.symbol}_${validator_key}');">)<br>
${validator_name}</td>
<td>${amount}<br>
${bip_amount}</td>
<td>${is_waitlisted}</td>
<td><a data-fancybox class="delegate_modal" data-src="#delegate_modal" href="javascript:;" data-token="${el.coin.symbol}" data-pubkey="${validator_key}" onclick="getDelegateTemplates('${el.coin.symbol}');">Делегировать ${el.coin.symbol}</a>, <a data-fancybox class="anbond_modal" data-src="#anbond_modal" href="javascript:;" data-token="${el.coin.symbol}" data-pubkey="${validator_key}" data-amount="${parseFloat(el.value).toFixed(3)}">Анбонд ${el.coin.symbol}</a></td>
</tr>`;
} // end for
$('#delegation_tbody').html(table);
} // end if res.

} catch(e) {
    console.log('Ошибка с делегированием: ' + e);
  }
}

$(document).ready(async function() {
  if (seed) {
    jQuery("#main_wallet_info").css("display", "block");
    await loadBalances();
    setInterval(async function() {await loadBalances();}, 5000);
  $('#current_address').html(sender.address);
  $('#address_link').attr('href', `https://dpos.space/minter/profiles/${sender.address}`)
     $('#copy_address').click(async function() {
       try {
         await navigator.clipboard.writeText(sender.address);
       } catch(e) {
         console.log(e);
       }
     });    
     await getHistory(1);
    }
  
  $(document).on('click', '.transfer_modal', async function(e) {
    let token = $(this).attr('data-token');
$('.transfer_modal_token').html(token);
    $('#max_transfer_amount').html($('#max_' + token).html());
  await getFee(token, 'transfer', '');
  });

  $(document).on('click', '.convert_modal', async function(e) {
    let token = $(this).attr('data-token');
$('.convert_modal_token').html(token);
    $('#max_convert_amount').html($('#max_' + token).html());
  await getFee(token, 'convert', '');
  });
  
  $(document).on('click', '.delegate_modal', async function(e) {
    let token = $(this).attr('data-token');
    let key = $(this).attr('data-pubkey');
    if (key) {
      $('#action_delegate_key').val(key);
    }
    $('.delegate_modal_token').html(token);
    $('#max_delegate_amount').html($('#max_' + token).html());
  await getFee(token, 'delegate');
  });

  $(document).on('click', '.anbond_modal', async function(e) {
    let token = $(this).attr('data-token');
    let key = $(this).attr('data-pubkey');
      $('#action_anbond_key').val(key);
      let amount = $(this).attr('data-amount');
      $('.anbond_modal_token').html(token);
    $('#max_anbond_amount').html(amount);
  await getFee(token, 'anbond');
  });

  $("#max_token_anbond").click(async function(){
    let coin = $('.anbond_modal_token').html();
    let max_amount = $('#max_anbond_amount').html();
    max_amount = parseFloat(max_amount);
    let fee = parseFloat($('#anbond_fee').html());
      max_amount -= fee + 0.001;
      $('#action_anbond_stake').val(new Number(max_amount).toFixed(3));
      });

  $("#action_transfer_start").click(async function(){
let q = window.confirm('Вы действительно хотите сделать перевод средств?');
if (q == true) {
  let coin = $('.transfer_modal_token').html();
 let to = $('#action_transfer_to').val();
  let amount = $('#action_transfer_amount').val();
  amount = parseFloat(amount);
let memo = $('#action_transfer_memo').val();
 
 try {
  $.fancybox.close(); 
  await send(to, amount, coin, memo)
 await loadBalances();
} catch(e) {
window.alert('Ошибка: ' + e);
 }
}
  }); // end subform

$('#action_transfer_memo').change(async function() {
let memo = $('#action_transfer_memo').val();
let coin = $('.transfer_modal_token').html();
let fee = parseFloat(await getFee(coin, 'transfer', memo));
let amount = $('#action_transfer_amount').val();
amount = parseFloat(amount);
let max_amount = $('#max_transfer_amount').html();
max_amount = parseFloat(max_amount) - 0.001;
if (amount + fee > max_amount) {
  amount = amount - (amount + fee - max_amount);
}
$('#action_transfer_amount').val(amount.toFixed(3));
});

$("#action_convert_start").click(async function(){
  let q = window.confirm('Вы действительно хотите сделать обмен средств?');
  if (q == true) {
    let coin = $('.convert_modal_token').html();
   let to = $('#action_convert_to').val().toUpperCase();
    let amount = $('#action_convert_amount').val();
    amount = parseFloat(amount);
   let swap_from = $('#convert_from').html();
   
   try {
    $.fancybox.close(); 
    await convert(coin, to, amount, swap_from);
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

$("#action_delegate_start").click(async function(){
  let q = window.confirm('Вы действительно хотите делегировать?');
  if (q == true) {
    let coin = $('.delegate_modal_token').html();
   let publicKey = $('#action_delegate_key').val();
    let stake = $('#action_delegate_stake').val();
    stake = parseFloat(stake);
   
   try {
    $.fancybox.close(); 
    await delegate(coin, publicKey, stake)
   await loadBalances();
  } catch(e) {
  window.alert('Ошибка: ' + e);
   }
  }
    }); // end subform

    $("#action_anbond_start").click(async function(){
      let q = window.confirm('Вы действительно хотите сделать анбонд?');
      if (q == true) {
        let coin = $('.anbond_modal_token').html();
       let publicKey = $('#action_anbond_key').val();
        let stake = $('#action_anbond_stake').val();
        stake = parseFloat(stake);
       
       try {
        $.fancybox.close(); 
        await anbond(coin, publicKey, stake)
       await loadBalances();
      } catch(e) {
      window.alert('Ошибка: ' + e);
       }
      }
        }); // end subform
    
   $("#action_save_transfer_template").click(function(){
       let name = window.prompt('Введите название шаблона');
       if (name && name !== '') {
         try {
          let  token = $('.transfer_modal_token').html();
          let action_transfer_to = $('#action_transfer_to').val();
         let action_transfer_memo = $('#action_transfer_memo').val();
       
       let transfer_templates = JSON.parse(localStorage.getItem(token + '_minter_transfer_templates'));
        if (transfer_templates && transfer_templates.length > 0) {
         let counter = 0; 
         for (let template of transfer_templates) {
            if (name === template.name) {
             counter = 1;
             template.to = action_transfer_to;
             template.memo = action_transfer_memo;
            } // end if to.
          } // end for.
        if (counter === 0) {
         transfer_templates.push({name, to: action_transfer_to, memo: action_transfer_memo});
        }
         } // end if templates.
        else {
          transfer_templates = [];
          transfer_templates.push({name, to: action_transfer_to, memo: action_transfer_memo});
        }
             localStorage.setItem(token + '_minter_transfer_templates', JSON.stringify(transfer_templates));
       window.alert('Шаблон добавлен.');
       getTransferTemplates(token);
      } catch(e) {
         window.alert('Ошибка: '  + JSON.stringify(e))
       }
       } else {
         window.alert('Вы отменили создание шаблона.');
       }
     }); // end subform
   
  $('#select_transfer_template').change(function() {
    if ($('#select_transfer_template').val() === '') {
      $('#remove_transfer_template').css('display', 'none');
      $('#action_transfer_to').val('');
      $('#action_transfer_memo').val('');
    } else {
      $('#remove_transfer_template').css('display', 'inline');
      $('#action_transfer_to').val(String($(':selected', this).data('to')));
      $('#action_transfer_memo').val($(':selected', this).data('memo'));
     }
    });
  
$('#action_remove_transfer_template').click(function() {
  let q = window.confirm('Вы действительно хотите удалить выбранный шаблон?');
  if (q == true) {
    let value = $('#select_transfer_template').val();
    let token = $('.transfer_modal_token').html();
    let option = document.querySelector("#select_transfer_template option[value='" + value + "']");
    if (option) {
        option.remove();
    }
try {
  let transfer_templates = JSON.parse(localStorage.getItem(token + '_minter_transfer_templates'));
  let templates = [];
  if (transfer_templates && transfer_templates.length > 0) {
    let counter = 1;
    for (let template of transfer_templates) {
      if (counter !== parseInt(value)) {
        templates.push(template);
      }
    counter++;
    }
    localStorage.setItem(token + '_minter_transfer_templates', JSON.stringify(templates));
  window.alert('Шаблон удалён.');
  $('#remove_transfer_template').css('display', 'none');
  $('#action_transfer_to').val('');
  $('#action_transfer_memo').val('');
}
} catch(e) {
  window.alert('Ошибка: ' + e);
}
  }
}); // end action_remove_transfer_template
    
      $('#select_delegate_template').change(function() {
        if ($('#select_delegate_template').val() === '') {
          $('#remove_delegate_template').css('display', 'none');
          $('#action_delegate_key').val('');
        } else {
          $('#remove_delegate_template').css('display', 'inline');
          $('#action_delegate_key').val(String($(':selected', this).data('key')));
         }
        });

        $('#action_remove_delegate_template').click(function() {
        let q = window.confirm('Вы действительно хотите удалить выбранный шаблон?');
        if (q == true) {
          let value = $('#select_delegate_template').val();
          let token = $('.delegate_modal_token').html();
          let option = document.querySelector("#select_delegate_template option[value='" + value + "']");
          if (option) {
              option.remove();
          }
      try {
        let delegate_templates = JSON.parse(localStorage.getItem(token + '_minter_delegate_templates'));
        let templates = [];
        if (delegate_templates && delegate_templates.length > 0) {
          let counter = 1;
          for (let template of delegate_templates) {
            if (counter !== parseInt(value)) {
              templates.push(template);
            }
          counter++;
          }
          localStorage.setItem(token + '_minter_delegate_templates', JSON.stringify(templates));
        window.alert('Шаблон удалён.');
        $('#remove_delegate_template').css('display', 'none');
        $('#action_delegate_key').val('');
      }
      } catch(e) {
        window.alert('Ошибка: ' + e);
      }
        } else {
          window.alert('Вы отменили удаление шаблона.');
        }
    }); // end action_remove_delegate_template
   
      $("#max_token_transfer").click(async function(){
        let token = $('.transfer_modal_token').html();
        let amount = parseFloat($('#max_' + token).html());
        let max_amount = $('#max_transfer_amount').html();
        max_amount = parseFloat(max_amount);
        let fee = parseFloat($('#transfer_fee').html());
      if (amount === max_amount) {
        amount -= fee + 0.001;
      }
        $('#action_transfer_amount').val(new Number(amount).toFixed(3));
      });
    
         $("#max_token_convert").click(async function(){
          let token = $('.convert_modal_token').html();
          $('#action_convert_amount').val(new Number(parseFloat($('#max_' + token).html())).toFixed(3));
          await getConvertPrice();   
        });

        $("#max_token_delegate").click(async function(){
          let coin = $('.delegate_modal_token').html();
          let max_amount = $('#max_delegate_amount').html();
          max_amount = parseFloat(max_amount);
          let fee = parseFloat($('#delegate_fee').html());
            max_amount -= fee + 0.001;
            $('#action_delegate_stake').val(new Number(max_amount).toFixed(3));
            });

         $("#action_save_delegate_template").click(async function(){
           let name = window.prompt('Введите название шаблона');
           if (name && name !== '') {
            let  token = $('.delegate_modal_token').html();
            try {
             let delegate_key = $('#action_delegate_key').val();
           
           let delegate_templates = JSON.parse(localStorage.getItem( token + '_minter_delegate_templates'));
            if (delegate_templates && delegate_templates.length > 0) {
             let counter = 0; 
             for (let template of delegate_templates) {
                if (name === template.name) {
                 counter = 1;
                 template.key = delegate_key;
                } // end if to.
              } // end for.
            if (counter === 0) {
             delegate_templates.push({name, key: delegate_key});
            }
             } // end if templates.
            else {
              delegate_templates = [];
              delegate_templates.push({name, key: delegate_key});
            }
                 localStorage.setItem(token + '_minter_delegate_templates', JSON.stringify(delegate_templates));
           window.alert('Шаблон добавлен.');
    await getDelegateTemplates(token);
           } catch(e) {
             window.alert('Ошибка: '  + JSON.stringify(e))
           }
           } else {
             window.alert('Вы отменили создание шаблона.');
           }
         }); // end subform
       
      $('#username').html(minter_login);
  let filtr = JSON.parse(localStorage.getItem('wallet_history_filtr'));
let select_ops = filtr['select_ops'];
for (let op of select_ops) {
  $(`input[value=${op}]`).prop("checked", true);
}
let direction = filtr['direction'];
if (direction !== '') {
  $(`#direction option[value=${direction}]`).attr("selected", "selected");
}

if(0<$('input[type=range]').length){
  bind_range();
}

try {
$(async function() {
  let result = await axios.get('https://explorer-api.minter.network/api/v2/coins');
  let res = result.data.data;
  res.sort(compareCoins);
  let coins = res.reduce(function(p,c){return p + ',' +c.symbol;},[]).split(',');
  $("#action_convert_to").autocomplete({ //на какой input:text назначить результаты списка
      source: function(request, response) {
          var term = request.term;
          var pattern = new RegExp("^" + term, "i");
          
          var results = $.map(coins, function(elem) {                       
              if (pattern.test(elem)) {
                  return elem;
              }
          })                    
          response(results);
}
})
  });
} catch(e) {
  console.log(e);
}
});