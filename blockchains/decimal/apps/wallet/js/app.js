function compareCoins(a, b)
{
	if(parseFloat(a.reserve) > parseFloat(b.reserve))
	{
		return -1;
	}
	else{
		return 1;
	}
}

var del_balance = 0;

async function links(token) {
  $('#actions').html(`<li><a data-fancybox class="transfer_modal" data-src="#transfer_modal" href="javascript:;" data-token="${token}" onclick="getTransferTemplates('${token}');">Перевести ${token}</a></li>
<li><a data-fancybox class="convert_modal" data-src="#convert_modal" href="javascript:;" data-token="${token}">Конвертировать ${token}</a></li>
<li><a data-fancybox class="delegate_modal" data-src="#delegate_modal" href="javascript:;" data-token="${token}" onclick="getDelegateTemplates('${token}');">Делегировать ${token}</a></li>
`);
}

var link_state = {};
async function actionsSpoiler(t) {
    let token = $(t).attr('data-token');
    style = document.getElementById('actions').style;
    if (!link_state.display || link_state.token === token) {
      style.display = (style.display == 'block') ? 'none' : 'block';
      }
      await links(token);
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
    let acc = (await decimal.getAddress(sender.address)).address;
    let balances_list = '';
    for (let token in acc.balance) {
      let amount = parseFloat(acc.balance[token]) / (10 ** 18);
        balances_list += `<li><a class="spoiler" data-tipe="main_balance" data-token="${token}" onclick="actionsSpoiler(this);" title="Клик для выбора действия"><span id="max_${token}">${amount.toFixed(3)}</span> ${token}</a></li>`;
    if (token === 'DEL') {
      del_balance = amount;
    }
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
  
  let transfer_templates = JSON.parse(localStorage.getItem(token + '_decimal_transfer_templates'));
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
  let delegate_templates = JSON.parse(localStorage.getItem(token + '_decimal_delegate_templates'));
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
      }).replace(/ (@[^< \.,]+)/gi, user => ` <a href="/decimal/profiles/${user.trim().slice(1)}">${user.trim()}</a>`)
  } catch(e) {
    return text;
  }
 }

 async function getHistory(page) {
  jQuery("#wallet_transfer_history").css("display", "block");try {
  let offset = (page * 10) - 10;
   
  let response = await axios.get('https://mainnet-gate.decimalchain.com/api/address/' + sender.address + '/txs?limit=10&offset=' + offset);
  let results = '';
  let res = response.data.result.txs;
  
    let types = {
      buy_coin: 'Покупка монет',
      create_coin: 'Создание монеты',
      update_coin: 'Обновление монеты',
      sell_coin: 'Продажа монеты',
     send_coin: 'Отправка',
     multisend_coin: 'Мультисенд (мульти-отправка)',
     sell_all_coin: 'Продажа всех монет',
     redeem_check: 'Получение чека',
     issue_check: 'Создание чека',
     declare_candidate: 'Объявление кандидата в валидаторы',
     delegate: 'Делегирование',
     set_online: 'Установка кандидата в статусе онлайн',
     set_offline: 'Установка кандидата в статусе оффлайн',
     unbond: 'Анбонд',
     edit_candidate: 'Редактирование кандидата',
     create_wallet: 'Создание мультисига',
     create_transaction: 'Создание мультисиг транзакции',
     sign_transaction: 'Подпись мультисигом транзакции',
     MsgSubmitProposal: 'Отправленный пропозал',
     MsgVote: 'Голосование по пропозалу',
     msg_initialize: 'Инициализация свопа',
     msg_redeem_v2: 'Получение свопа',
     msg_mint: 'Создание NFT',
     msg_burn: 'Сжигание NFT',
     msg_edit_metadata: 'Редактирование мета-данных NFT',
     msg_transfer: 'Передача NFT',
     delegate_nft: 'Делегирование NFT',
     unbond_nft: 'Анбонд NFT'
    };
     for (let tr of res) {
let amount;
let coin_str = 'coin';
let value_str = 'amount';
let type = types[tr.type];
if (tr.type === 'COIN_SEND' && tr.data.to === sender.address) {
type = 'Получение';
} else if (tr.type === 'COIN_SELL' || tr.type === 'COIN_SELL_ALL' || tr.type === 'COIN_BUY') {
type = 'Конвертация';
coin_str = 'sellCoin'
value_str = 'amount';
} else if (tr.type === 'transfer_nft') {
type = 'Передача NFT';
coin_str = 'transfer_nft'
value_str = 'nft';
} else if (tr.type === 'mint_nft') {
type = 'Создание NFT';
coin_str = 'mint_nft';
value_str = 'nft';
} else if (tr.type === 'delegate_nft') {
type = 'Делегирование NFT';
coin_str = 'delegate_nft'
value_str = 'nft';
} else if (tr.type === 'unbond_nft') {
type = 'Анбонд NFT';
coin_str = 'unbond_nft'
value_str = 'nft';
}

if (!tr.data.list && tr.type !== 'COIN_CREATE') {
if (value_str !== 'nft') {
  amount = parseFloat(tr.data[value_str]) / (10 ** 18);
  amount = amount.toFixed(3);
  amount += ' ' + tr.data[coin_str];
} else {
  amount = parseFloat(tr.data[value_str]['quantity']) + tr.data[value_str].nftCollection;
}
} else if (!tr.data.list && (tr.type === 'COIN_CREATE')) {
amount = parseFloat(tr.data.initSupply) / (10 ** 18);
amount = amount.toFixed(3);
amount += ' ' + tr.data.ticker;
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
let memo = tr.message;
results += `
<tr><td>${date_str(get_time, true, false, true)}</td>
<td><a href="/decimal/explorer/block/${tr.blockId}" target="_blank">${tr.blockId}</a></td>
<td><a href="/decimal/explorer/tx/${tr.hash}" target="_blank">${tr.hash}</a></td>
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

async function getConvertPrice() {
  let coin = $('.convert_modal_token').html();
  let to = $('#action_convert_to').val().toLowerCase();
  let amount = $('#action_convert_amount').val();
  amount = parseFloat(amount);
  let max_amount = $('#max_convert_amount').html();
  max_amount = parseFloat(max_amount);
  if (amount && amount !== '' && amount > 0 && to !== '') {
    try {
  let coin_response = await axios.get(`https://mainnet-gate.decimalchain.com/api/coin/${coin}`);
  let to_response = await axios.get(`https://mainnet-gate.decimalchain.com/api/coin/${to}`);
  let to_amount = sell(coin_response.data.result, amount, to_response.data.result);
      let del_fee = await convert(coin, to, amount, to_amount, 'fee');
      let fee = del_fee;
      let fee_coin = 'DEL';
      if (coin !== 'del') {
        fee = sell(to_response.data.result, del_fee, coin_response.data.result);
      fee_coin = coin;
      }
      if (amount === max_amount && fee !== del_fee || coin === 'DEL' && amount === max_amount && fee === del_fee) {
        amount -= fee;
      }
  $('#buy_amount').html(parseFloat(to_amount).toFixed(3));
  $('#convert_fee').html(parseFloat(fee).toFixed(5) + ` ${fee_coin}`);
    } catch(e) {
      let coin_response = await axios.get(`https://mainnet-gate.decimalchain.com/api/coin/${coin}`);
      let to_response = await axios.get(`https://mainnet-gate.decimalchain.com/api/coin/${to}`);
      let to_amount = sell(coin_response.data.result, amount, to_response.data.result);
      to_amount = to_amount.value;
      let del_fee = await convert(coin, to, amount, to_amount, 'fee');
          let fee = del_fee;
    let fee_coin = 'DEL';
    if (coin !== 'del') {
      fee = sell(to_response.data.result, del_fee, coin_response.data.result);
    fee = fee.value;
      fee_coin = coin;
    }
    if (amount === max_amount && fee !== del_fee || coin === 'DEL' && amount === max_amount && fee === del_fee) {
      amount -= fee;
    }
$('#buy_amount').html(parseFloat(to_amount).toFixed(3));
  $('#convert_fee').html(parseFloat(fee).toFixed(5) + ` ${fee_coin}`);
  }
  $('#action_convert_amount').val(amount.toFixed(3));
} else {
    $('#buy_amount').html('');
    $('#convert_fee').html('');
    $('#swap_route_block').css('display', 'none');
    $('#swap_route').html('');
  }
}

async function getDelegations() {
  try {
    let result = await axios.get('https://mainnet-gate.decimalchain.com/api/address/' + sender.address + '/stakes');
let res = result.data.result.validators;
    if (res && res.length > 0) {
  $('#delegation_tbody').css('display', 'block');
  let table = '';
  for (let el of res) {
    let validator_key = el.validatorId;
    let validator_name = el.validator.details;
    let validator_status = el.validator.status;
    
    for (let stake of el.stakes) {
  let amount = (parseFloat(stake.amount) / (10 ** 18)).toFixed(3) + ' ' + stake.coin;
let del_amount = (parseFloat(stake.baseAmount) / (10 ** 18)).toFixed(3) + ' DEL';13263144
table += `<tr>
<td><strong>${validator_status}</strong>
<input type="text" readonly id="validator_${stake.coin}_${validator_key}" value="${validator_key}"> (<input type="button" value="копировать" onclick="copyText('validator_${stake.coin}_${validator_key}');">)<br>
${validator_name}</td>
<td>${amount}<br>
${del_amount}</td>
<td><a data-fancybox class="delegate_modal" data-src="#delegate_modal" href="javascript:;" data-token="${stake.coin}" data-pubkey="${validator_key}" onclick="getDelegateTemplates('${stake.coin}');">Делегировать ${stake.coin}</a>, <a data-fancybox class="anbond_modal" data-src="#anbond_modal" href="javascript:;" data-token="${stake.coin}" data-pubkey="${validator_key}" data-amount="${amount}">Анбонд ${stake.coin}</a></td>
</tr>`;
}
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
  $('#address_link').attr('href', `https://dpos.space/decimal/profiles/${sender.address}`)
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
  });

  $(document).on('click', '.convert_modal', async function(e) {
    let token = $(this).attr('data-token');
$('.convert_modal_token').html(token);
$('#max_convert_amount').html($('#max_' + token).html());
  });
  
  $(document).on('click', '.delegate_modal', async function(e) {
    let token = $(this).attr('data-token');
    let key = $(this).attr('data-pubkey');
    if (key) {
      $('#action_delegate_key').val(key);
      let stake = $('#action_delegate_stake').val();
      if (stake === '') stake = 1;
        let max_amount = $('#max_delegate_amount').html();
        max_amount = parseFloat(max_amount);
        if (key !== '') {
          let del_fee = await delegate(token, key, stake, 'fee');
          let coin_response = await axios.get(`https://mainnet-gate.decimalchain.com/api/coin/DEL`);
          let to_response = await axios.get(`https://mainnet-gate.decimalchain.com/api/coin/${coin}`);
              let fee = del_fee;
        let fee_coin = 'DEL';
        if (coin !== 'del') {
          fee = sell(coin_response.data.result, del_fee, to_response.data.result);
        fee = fee.value;
          fee_coin = coin;
        }
          $('#delegate_fee').html(fee.toFixed(5) + ` ${fee_coin}`)
          if (stake !== '' && stake + fee > max_amount && (fee !== del_fee || token === 'DEL')) {
            stake = parseFloat(stake);
                  stake = stake - (stake + fee - max_amount);
                  $('#action_delegate_stake').val(new Number(stake).toFixed(3));  
                }
        }
    }
    $('.delegate_modal_token').html(token);
    $('#max_delegate_amount').html($('#max_' + token).html());
  });

  $(document).on('click', '.anbond_modal', async function(e) {
    let token = $(this).attr('data-token');
    let key = $(this).attr('data-pubkey');
      $('#action_anbond_key').val(key);
      if (key !== '') {
        let stake = $('#action_anbond_stake').val();
        if (stake === '') stake = 1;
          let max_amount = $('#max_anbond_amount').html();
          max_amount = parseFloat(max_amount);
          let fee = await anbond(token, key, stake, 'fee');
          $('#anbond_fee').html(fee + ` DEL`)
          }
      let amount = $(this).attr('data-amount');
      $('.anbond_modal_token').html(token);
    $('#max_anbond_amount').html(amount);
  });

  $("#max_token_anbond").click(async function(){
    let coin = $('.anbond_modal_token').html();
    let max_amount = $('#max_anbond_amount').html();
    max_amount = parseFloat(max_amount);
    let fee = parseFloat($('#anbond_fee').html());
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
 let gasCoin = $('#transfer_fee').html().split(' ')[1];

 try {
  $.fancybox.close(); 
  await send(to, amount, coin, memo, '')
 await loadBalances();
} catch(e) {
window.alert('Ошибка: ' + e);
 }
}
  }); // end subform

  $('#action_transfer_to').change(async function() {
    let memo = $('#action_transfer_memo').val();
    let coin = $('.transfer_modal_token').html();
    let to = $('#action_transfer_to').val();
    let max_amount = $('#max_transfer_amount').html();
    max_amount = parseFloat(max_amount);
    let amount = $('#action_transfer_amount').val();
    if (amount === '') {
      amount = 1;
    } else {
      amount = parseFloat(amount);
    }
    if (to !== '') {
      let del_fee = await send(to, amount, coin, memo, 'fee');
      let coin_response = await axios.get(`https://mainnet-gate.decimalchain.com/api/coin/DEL`);
      let to_response = await axios.get(`https://mainnet-gate.decimalchain.com/api/coin/${coin}`);
          let fee = del_fee;
    let fee_coin = 'DEL';
    if (coin !== 'del') {
      fee = sell(coin_response.data.result, del_fee, to_response.data.result);
    fee = fee.value;
      fee_coin = coin;
    }
    if (amount === max_amount && fee !== del_fee || coin === 'DEL' && amount === max_amount && fee === del_fee) {
      amount -= fee;
    }
      $('#transfer_fee').html(fee.toFixed(5) + ` ${fee_coin}`);
    $('#action_transfer_amount').val(amount.toFixed(3));
    }
  });

  $('#action_transfer_memo').change(async function() {
let memo = $('#action_transfer_memo').val();
let coin = $('.transfer_modal_token').html();
let to = $('#action_transfer_to').val();
let amount = $('#action_transfer_amount').val();
amount = parseFloat(amount);
let max_amount = $('#max_transfer_amount').html();
max_amount = parseFloat(max_amount);
if (to !== '') {
  let del_fee = await send(to, amount, coin, memo, 'fee');
  let coin_response = await axios.get(`https://mainnet-gate.decimalchain.com/api/coin/DEL`);
  let to_response = await axios.get(`https://mainnet-gate.decimalchain.com/api/coin/${coin}`);
      let fee = del_fee;
let fee_coin = 'DEL';
if (coin !== 'del') {
  fee = sell(coin_response.data.result, del_fee, to_response.data.result);
fee = fee.value;
  fee_coin = coin;
}
if (amount === max_amount && fee !== del_fee || coin === 'DEL' && amount === max_amount && fee === del_fee) {
  amount -= fee;
}
  $('#transfer_fee').html(fee.toFixed(5) + ` ${fee_coin}`);
$('#action_transfer_amount').val(amount.toFixed(3));
}
});

$("#action_convert_start").click(async function(){
  let q = window.confirm('Вы действительно хотите сделать обмен средств?');
  if (q == true) {
    let coin = $('.convert_modal_token').html();
   let to = $('#action_convert_to').val().toUpperCase();
    let amount = $('#action_convert_amount').val();
    amount = parseFloat(amount);
    let buy_amount = $('#buy_amount').html();
    buy_amount = (buy_amount !== '' ? parseFloat(buy_amount) : 0) * 0.9;
    let swap_route = $('#swap_route').html();
    let gasCoin = $('#convert_fee').html().split(' ')[1];
   
    try {
    $.fancybox.close(); 
    await convert(coin, to, amount, buy_amount, '');
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
    let gasCoin = $('#delegate_fee').html().split(' ')[1];

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
    

        $('#action_anbond_key').change(async function() {
          let publicKey = $('#action_anbond_key').val();
          let coin = $('.anbond_modal_token').html();
          let stake = $('#action_anbond_stake').val();
        if (stake === '') stake = 1;
          let max_amount = $('#max_anbond_amount').html();
          max_amount = parseFloat(max_amount);
          if (publicKey !== '') {
            let fee = await anbond(coin, publicKey, stake, 'fee');
if (del_balance > fee && fee === del_fee) {
  $('#anbond_fee').html(fee + ` DEL`)
  stake = parseFloat(stake);
  $('#action_anbond_stake').val(new Number(stake).toFixed(3));  
} else {
  window.alert('Баланс DEL < комиссии.');
}
          }
        });        

        $("#action_save_transfer_template").click(function(){
       let name = window.prompt('Введите название шаблона');
       if (name && name !== '') {
         try {
          let  token = $('.transfer_modal_token').html();
          let action_transfer_to = $('#action_transfer_to').val();
         let action_transfer_memo = $('#action_transfer_memo').val();
       
       let transfer_templates = JSON.parse(localStorage.getItem(token + '_decimal_transfer_templates'));
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
             localStorage.setItem(token + '_decimal_transfer_templates', JSON.stringify(transfer_templates));
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
  let transfer_templates = JSON.parse(localStorage.getItem(token + '_decimal_transfer_templates'));
  let templates = [];
  if (transfer_templates && transfer_templates.length > 0) {
    let counter = 1;
    for (let template of transfer_templates) {
      if (counter !== parseInt(value)) {
        templates.push(template);
      }
    counter++;
    }
    localStorage.setItem(token + '_decimal_transfer_templates', JSON.stringify(templates));
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
    
      $('#select_delegate_template').change(async function() {
        if ($('#select_delegate_template').val() === '') {
          $('#remove_delegate_template').css('display', 'none');
          $('#action_delegate_key').val('');
        } else {
          $('#remove_delegate_template').css('display', 'inline');
          $('#action_delegate_key').val(String($(':selected', this).data('key')));
          let publicKey = $('#action_delegate_key').val();
          let coin = $('.delegate_modal_token').html();
          let stake = $('#action_delegate_stake').val();
        if (stake === '') stake = 1;
          let max_amount = $('#max_delegate_amount').html();
          max_amount = parseFloat(max_amount);
          if (publicKey !== '') {
            let del_fee = await delegate(coin, publicKey, stake, 'fee');
            let coin_response = await axios.get(`https://mainnet-gate.decimalchain.com/api/coin/DEL`);
            let to_response = await axios.get(`https://mainnet-gate.decimalchain.com/api/coin/${coin}`);
                let fee = del_fee;
          let fee_coin = 'DEL';
          if (coin !== 'del') {
            fee = sell(coin_response.data.result, del_fee, to_response.data.result);
          fee = fee.value;
            fee_coin = coin;
          }
            $('#delegate_fee').html(fee.toFixed(5) + ` ${fee_coin}`)
            if (stake !== '' && stake + fee > max_amount && (fee !== del_fee || coin === 'DEL')) {  
              stake = parseFloat(stake);
                    stake = stake - (stake + fee - max_amount);
                    $('#action_delegate_stake').val(new Number(stake).toFixed(3));  
                  }
          }
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
        let delegate_templates = JSON.parse(localStorage.getItem(token + '_decimal_delegate_templates'));
        let templates = [];
        if (delegate_templates && delegate_templates.length > 0) {
          let counter = 1;
          for (let template of delegate_templates) {
            if (counter !== parseInt(value)) {
              templates.push(template);
            }
          counter++;
          }
          localStorage.setItem(token + '_decimal_delegate_templates', JSON.stringify(templates));
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
        let coin = $('.transfer_modal_token').html();
        let to = $('#action_transfer_to').val();
        let max_amount = parseFloat($('#max_transfer_amount').html());
        let memo = $('#action_transfer_memo').val();

        if (to !== '') {
          let del_fee = await send(to, max_amount, coin, memo, 'fee');
          let coin_response = await axios.get(`https://mainnet-gate.decimalchain.com/api/coin/DEL`);
          let to_response = await axios.get(`https://mainnet-gate.decimalchain.com/api/coin/${coin}`);
              let fee = del_fee;
        let fee_coin = 'DEL';
        if (coin !== 'del') {
          fee = sell(coin_response.data.result, del_fee, to_response.data.result);
        fee = fee.value;
          fee_coin = coin;
        }
    
          $('#transfer_fee').html(fee.toFixed(5) + ` ${fee_coin}`);
          if (fee !== del_fee || coin === 'DEL' && fee === del_fee) {
            max_amount -= fee;
          }
        $('#action_transfer_amount').val(max_amount.toFixed(3));
        }
      });
    
         $("#max_token_convert").click(async function(){
          let token = $('.convert_modal_token').html();
          $('#action_convert_amount').val(new Number(parseFloat($('#max_' + token).html())).toFixed(3));
          await getConvertPrice();   
        });

$('#action_delegate_key').change(async function() {
  let publicKey = $('#action_delegate_key').val();
  let coin = $('.delegate_modal_token').html();
  let stake = $('#action_delegate_stake').val();
if (stake === '') stake = 1;
  let max_amount = $('#max_delegate_amount').html();
  max_amount = parseFloat(max_amount);
  if (publicKey !== '') {
    let del_fee = await delegate(coin, publicKey, stake, 'fee');
    let coin_response = await axios.get(`https://mainnet-gate.decimalchain.com/api/coin/DEL`);
    let to_response = await axios.get(`https://mainnet-gate.decimalchain.com/api/coin/${coin}`);
        let fee = del_fee;
  let fee_coin = 'DEL';
  if (coin !== 'del') {
    fee = sell(coin_response.data.result, del_fee, to_response.data.result);
  fee = fee.value;
    fee_coin = coin;
  }
    $('#delegate_fee').html(fee + ` ${fee_coin}`)
    if (stake !== '' && stake + fee > max_amount && (fee !== del_fee || coin === 'DEL')) {
      stake = parseFloat(stake);
            stake = stake - (stake + fee - max_amount);
            $('#action_delegate_stake').val(new Number(stake).toFixed(3));  
          }
  }
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
           
           let delegate_templates = JSON.parse(localStorage.getItem( token + '_decimal_delegate_templates'));
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
                 localStorage.setItem(token + '_decimal_delegate_templates', JSON.stringify(delegate_templates));
           window.alert('Шаблон добавлен.');
    await getDelegateTemplates(token);
           } catch(e) {
             window.alert('Ошибка: '  + JSON.stringify(e))
           }
           } else {
             window.alert('Вы отменили создание шаблона.');
           }
         }); // end subform
       
      $('#username').html(decimal_login);
      if (localStorage.getItem('wallet_history_filtr')) {
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
  }

try {
  $("#action_convert_to").change(async function() {
let q = $("#action_convert_to").val();
let result = await axios.get('https://mainnet-gate.decimalchain.com/api/coin?limit=10&offset=0&query=' + q);
  let res = result.data.result.coins;
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