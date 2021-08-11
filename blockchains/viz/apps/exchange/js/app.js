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

function copytext(el) {
	var $tmp = $("<textarea>");
	$("body").append($tmp);
	$tmp.val($(el).val()).select();
	document.execCommand("copy");
	$tmp.remove();
}	

var exchange_listen_timer=0;
var exchange_listen_from_block=0;
var exchange_listen_find=false;
async function exchange_start_listen(){
	console.log('exchange_start_listen');
    let data = JSON.parse($('#config').html());    
    viz.api.getDynamicGlobalProperties(function(err,response){
		if(err){
			console.log(err);
		}
		else{
			exchange_listen_find=false;
			if(response.head_block_number>exchange_listen_from_block){
				while(response.head_block_number>exchange_listen_from_block){
					exchange_listen_from_block++;
					console.log('exchange_start_listen getBlock',exchange_listen_from_block);
					viz.api.getBlock(exchange_listen_from_block,async function(err,result){
						if(!err){
							for(trans of result['transactions']){
								for(oper of trans['operations']){
									if(oper[0] == 'custom' && oper[1]['id']=='vizplus_exchanger'){
										//look for exchange trusted account
										if(oper[1]['required_regular_auths'].includes(data.viz_wallet)){
											let json=JSON.parse(oper[1]['json']);
											if(json[0]=='new_wallet'){
												if(json[1]['login']==viz_login){
                                                    let expires_timestamp = (parseInt(json[1]['expiration_block_num'])-exchange_listen_from_block) / 3;
expires_timestamp = parseInt(expires_timestamp);
let end_timestamp = parseInt(new Date().getTime()) + (expires_timestamp * 1000);
end_timestamp = parseInt(end_timestamp);
let expires = date_str(end_timestamp, true, false, true);
exchange_listen_find={wallet: json[1]['eth_wallet'], expires};
													console.log('find!',exchange_listen_find.wallet);
												}
											}
										}
									}
								}
							}
							if(!exchange_listen_find){
								clearTimeout(exchange_listen_timer);
								exchange_listen_timer=setTimeout(function(){exchange_start_listen();},3000);
							}
							else{
								clearTimeout(exchange_listen_timer);
$('#exchange_result').css('display','block');
								$('.exchange-buy-success').html('Адрес успешно получен');
$('#expired_address').html(exchange_listen_find.expires);
                                $('input[name=exchange-income-eth-address]').val(exchange_listen_find.wallet);
							}
						}
						else{
							console.log(err);
						}
					});
				}
            }

		}
	});
}

async function createBuyAmount() {
    let data = JSON.parse($('#config').html());
let balance = $('#balance').html();
let sell_amount = parseFloat($('#sell_amount').val());
   if (sell_amount === 0 || !sell_amount) {
       $('#action_buy_token').attr('disabled', true);
   } else {
    $('#action_buy_token').attr('disabled', false);
   }
let sell_token = $('#sell_token').val().toLowerCase();
    $('#sell_amount').attr('min', data[sell_token + '_limit_min']);
    $('#sell_amount').attr('max', data[sell_token + '_limit_max']);
    if (sell_token === 'viz' && balance <= data[sell_token + '_limit_max']) {
        $('#max_amount').html(balance);
    } else {
        $('#max_amount').html(data[sell_token + '_limit_max']);
    }
    
    if (sell_token === 'viz') {
        $('#sell_amount').attr('step', 0.001);
        $('#buy_amount').attr('step', 0.00001);
    $('#buy_token').html('USDT');
        let usdt_balance = parseFloat(data.usdt_balance);
        let viz_balance = parseFloat(data.viz_balance);
        let exchange_ratio = parseFloat(data.exchange_ratio);
let usdt_fee = parseFloat(data.usdt_fee);
let SUMUSDT = usdt_balance * ((1 + sell_amount / (viz_balance + sell_amount)) ** (1 / exchange_ratio) - 1) / (1 + sell_amount / (viz_balance + sell_amount)) ** (1 / exchange_ratio) - usdt_fee;
SUMUSDT = SUMUSDT.toFixed(5);
SUMUSDT = parseFloat(SUMUSDT);
$('#buy_amount').val(SUMUSDT);
    $('#market_price').html(`${(SUMUSDT/sell_amount).toFixed(5)} USDT/VIZ`)
$('#market_fee').html(`${usdt_fee} USDT`);
} else {
    $('#sell_amount').attr('step', 0.00001);
    $('#buy_amount').attr('step', 0.001);
    $('#buy_token').html('VIZ');
    let usdt_balance = parseFloat(data.usdt_balance);
    let viz_balance = parseFloat(data.viz_balance);
    let exchange_ratio = parseFloat(data.exchange_ratio);
let usdt_fee = parseFloat(data.usdt_fee);
let SUMVIZ = (((sell_amount - usdt_fee) / usdt_balance +1)**exchange_ratio - 1) * viz_balance;
SUMVIZ = SUMVIZ.toFixed(3);
SUMVIZ = parseFloat(SUMVIZ);
$('#buy_amount').val(SUMVIZ);
$('#market_price').html(`${(sell_amount/SUMVIZ).toFixed(5)} USDT/VIZ`)
$('#market_fee').html(`${usdt_fee} USDT`);
}
}

async function loadBalance() {
    let bird = (await viz.api.getAccountAsync('bird.exch.bank.viz.plus', 'vizplus_exchanger')).custom_sequence_block_num;
let timestamp_status = (await viz.api.getBlockAsync(bird)).timestamp;
let status_unixtime = new Date(timestamp_status + '.0000Z').getTime() / 1000;
let now_unixtime = new Date().getTime() / 1000;
let status_seconds = (now_unixtime - status_unixtime);
if (status_seconds <= 420) {
    $('#status').html(`Обменник работает. Последнее сообщение статуса было ${parseInt(status_seconds)} секунд назад.`);
    } else {
        $('#active_page').css('display', 'none');
        $('#status').html(`к сожалению, сейчас обменник не работает. Просим зайти позже. Последнее сообщение статуса было ${parseInt(status_seconds)} секунд назад.`);
    }

    let accounts = await viz.api.getAccountsAsync([viz_login]);
            if (accounts && accounts.length > 0) {
    let acc = accounts[0];
                let balance = parseFloat(acc.balance);
        if (balance > 0) {
            $('#balance').html(`${balance} VIZ`);
        }

        let exchange_data = (await viz.api.getAccountsAsync(['data.exch.bank.viz.plus']))[0].custom_sequence_block_num;
        let block = await viz.api.getOpsInBlockAsync(exchange_data, false);
    for(let tr of block) {
        const [op, opbody] = tr.op;
        switch(op) {
            case "custom":
            if (opbody.required_regular_auths[0] === "data.exch.bank.viz.plus" && opbody.id === 'vizplus_exchanger') {
                let json = JSON.parse(opbody.json)[1];
$('#config').html(JSON.stringify(json));
}
            break;
                  default:
                    //неизвестная команда
            }
        }
    }
    
}

window.onload = async function() {
        await loadBalance();
        
        $('#max_amount').click(async function() {
            let amount = $('#max_amount').html();
            $('#sell_amount').val(parseFloat(amount));
            });

            await createBuyAmount();

            $('#sell_token').change(async function() {
                await createBuyAmount();
                       });

    $('#sell_amount').change(async function() {
await createBuyAmount();
       });
        
       $('#action_buy_token').click(async function() {
$('.exchange-buy-error').html('');
$('.exchange-buy-success').html('');
        $('#action_buy_token').attr('disabled', true);
        let sell_token = $('#sell_token').val();
        let sell_amount = parseFloat($('#sell_amount').val());
        let buy_amount = $('#buy_amount').val();
        let data = JSON.parse($('#config').html());
        if (sell_token === 'VIZ' && sell_amount >= parseFloat(data.viz_limit_min) && sell_amount <= parseFloat(data.viz_limit_max)) {
let address = window.prompt('Введите ваш Ethereum адрес, на который переводить USDT.');
            if (address && address !== '') {
                let viz_wallet = data.viz_wallet;
                sell_amount = sell_amount.toFixed(3) + ' VIZ';
                try {
                    if(current_user.type && current_user.type === 'vizonator') {
                                sendToVizonator('transfer', {"to":viz_wallet,"amount": sell_amount,"memo": address.trim()})
                      return;
                    }
                    await viz.broadcast.transferAsync(active_key, viz_login, viz_wallet, sell_amount, address.trim());
                window.alert('Ваши Viz поступили в обменник viz+. Ожидайте получение USDT.');
                } catch(e) {
                    $('.exchange-buy-error').html(`Ошибка: ${e}`);
                }
                            } else {
                                window.alert('Введите адрес Ethereum кошелька.');
                            }
            } else         if (sell_token === 'USDT' && sell_amount >= parseFloat(data.usdt_limit_min) && sell_amount <= parseFloat(data.usdt_limit_max)) {
let eth_wallet_cost = data.eth_wallet_cost + ' VIZ';
try {
    window.alert('Ожидайте получение Ethereum адреса. Не обновляйте и не закрывайте страницу.');
    viz.api.getDynamicGlobalProperties(function(err,response){
		if(err){
			$('.exchange-buy-error').html(`Ошибка: ${err}`);

			console.log(err);
		}
		else{
			exchange_listen_from_block=response.head_block_number;
        }
    });			
    if(current_user.type && current_user.type === 'vizonator') {
        sendToVizonator('transfer', {"to": 'data.exch.bank.viz.plus',"amount": eth_wallet_cost,"memo": ''})
        await loadBalance();

        clearTimeout(exchange_listen_timer);
        exchange_listen_timer=setTimeout(function(){exchange_start_listen();},3000);
} else {
    await viz.broadcast.transferAsync(active_key, viz_login, 'data.exch.bank.viz.plus', eth_wallet_cost, '');
await loadBalance();

    clearTimeout(exchange_listen_timer);
    exchange_listen_timer=setTimeout(function(){exchange_start_listen();},3000);
}
} catch(e) {
    $('.exchange-buy-error').html(`Ошибка: ${e}`);
}
}
    });
    }