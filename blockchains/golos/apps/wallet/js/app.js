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

function getUrlVars() {
  var vars = {};
  var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
      vars[key] = value;
  });
  return vars;
}

function spoiler(elem)
{
    style = document.getElementById(elem).style;
    style.display = (style.display == 'block') ? 'none' : 'block';
}

function pass_gen(){
	let length=100;
	let charset='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+-=_:;.,@!^&*$';
	let ret='';
	for (var i=0,n=charset.length;i<length;++i){
		ret+=charset.charAt(Math.floor(Math.random()*n));
	}
	let wif=golos.auth.toWif('',ret,'')
	return wif;
}

function accountHistoryCompareDate(a, b)
{
	if(a[1].timestamp > b[1].timestamp)
	{
		return -1;
	}
	else{
		return 1;
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

function getTransferTemplates() {
  let transfer_templates = JSON.parse(localStorage.getItem('golos_transfer_templates'));
 if (transfer_templates && transfer_templates.length > 0) {
  let template_count = 1;
  for (let template of transfer_templates) {
$('#select_transfer_template').append(`<option value="${template_count}" data-to="${template.to}" data-memo="${template.memo}" data-in="${template.in}">${template.name}</option>
`);
template_count++;
}
 }
}

function removeTransferTemplate(value) {
  let q = window.confirm('Вы действительно хотите удалить выбранный шаблон?');
  if (q == true) {
    let option = document.querySelector("#select_transfer_template option[value='" + value + "']");
    if (option) {
        option.remove();
    }
try {
  let transfer_templates = JSON.parse(localStorage.getItem('golos_transfer_templates'));
  let templates = [];
  if (transfer_templates && transfer_templates.length > 0) {
    let counter = 1;
    for (let template of transfer_templates) {
      if (counter !== parseInt(value)) {
        templates.push(template);
      }
    counter++;
    }
    localStorage.setItem('golos_transfer_templates', JSON.stringify(templates));
  window.alert('Шаблон удалён.');
  $('#remove_transfer_template').css('display', 'none');
  $('#action_golos_transfer_to').val('');
  $('#action_golos_transfer_memo').val('');
  $('#golos_transfer_in').prop('selectedIndex',0);
}
} catch(e) {
  window.alert('Ошибка: ' + e);
}
  }
}

function getGBGTransferTemplates() {
  let transfer_templates = JSON.parse(localStorage.getItem('golos_gbg_transfer_templates'));
 if (transfer_templates && transfer_templates.length > 0) {
  let template_count = 1;
  for (let template of transfer_templates) {
$('#select_gbg_transfer_template').append(`<option value="${template_count}" data-to="${template.to}" data-memo="${template.memo}">${template.name}</option>
`);
template_count++;
}
 }
}

function removeGBGTransferTemplate(value) {
  let q = window.confirm('Вы действительно хотите удалить выбранный шаблон?');
  if (q == true) {
    let option = document.querySelector("#select_gbg_transfer_template option[value='" + value + "']");
    if (option) {
        option.remove();
    }
try {
  let transfer_templates = JSON.parse(localStorage.getItem('golos_gbg_transfer_templates'));
  let templates = [];
  if (transfer_templates && transfer_templates.length > 0) {
    let counter = 1;
    for (let template of transfer_templates) {
      if (counter !== parseInt(value)) {
        templates.push(template);
      }
    counter++;
    }
    localStorage.setItem('golos_gbg_transfer_templates', JSON.stringify(templates));
  window.alert('Шаблон удалён.');
  $('#remove_gbg_transfer_template').css('display', 'none');
  $('#action_golos_gbg_transfer_to').val('');
  $('#action_golos_gbg_transfer_memo').val('');
}
} catch(e) {
  window.alert('Ошибка: ' + e);
}
  }
}

function getDonateTemplates() {
  let donate_templates = JSON.parse(localStorage.getItem('golos_donate_templates'));
 if (donate_templates && donate_templates.length > 0) {
  let template_count = 1;
  for (let template of donate_templates) {
$('#select_donate_template').append(`<option value="${template_count}" data-to="${template.to}" data-memo="${template.memo}">${template.name}</option>
`);
template_count++;
}
 }
}

function removeDonateTemplate(value) {
  let q = window.confirm('Вы действительно хотите удалить выбранный шаблон?');
  if (q == true) {
    let option = document.querySelector("#select_donate_template option[value='" + value + "']");
    if (option) {
        option.remove();
    }
try {
  let donate_templates = JSON.parse(localStorage.getItem('golos_donate_templates'));
  let templates = [];
  if (donate_templates && donate_templates.length > 0) {
    let counter = 1;
    for (let template of donate_templates) {
      if (counter !== parseInt(value)) {
        templates.push(template);
      }
    counter++;
    }
    localStorage.setItem('golos_donate_templates', JSON.stringify(templates));
  window.alert('Шаблон удалён.');
  $('#remove_donate_template').css('display', 'none');
  $('#donate_to').val('');
  $('#donate_memo').val('');
}
} catch(e) {
  window.alert('Ошибка: ' + e);
}
  }
}

function load_balance(account, active_key) {
	golos.api.getAccounts([account], function(err, result){
 if (!err) {
 result.forEach(function(acc) {
golos.api.getDynamicGlobalProperties(function(error, res) {
if (!error) {
let tvfs = parseFloat(res.total_vesting_fund_steem);
let tvsh = parseFloat(res.total_vesting_shares);
let golos_per_gests = 1000000 * tvfs / tvsh;

// Конвертация GESTS в GOLOS POWER
let gp = parseFloat(acc.vesting_shares) / 1000000 * golos_per_gests;
gp = gp.toFixed(6);
gp = parseFloat(gp);
let received_gp = parseFloat(acc.received_vesting_shares) / 1000000 * golos_per_gests;
received_gp = received_gp.toFixed(6);
received_gp = parseFloat(received_gp);
let delegated_gp = parseFloat(acc.delegated_vesting_shares) / 1000000 * golos_per_gests;
delegated_gp = delegated_gp.toFixed(6);
delegated_gp = parseFloat(delegated_gp);
let accumulative_balance = acc.accumulative_balance;
$('.tip_balance').html(acc.tip_balance);
if (accumulative_balance !== '0.000 GOLOS') {
  $('.accumulative_balance').html(`<a class="tt" onclick="spoiler('accumulative_actions'); return false">${accumulative_balance}</a>`);
} else {
  $('.accumulative_balance').html(`${accumulative_balance}`);
}

 $(".golos_balance").html(new Number(parseFloat(acc.balance)).toFixed(3));
 $(".gbg_balance").html(new Number(parseFloat(acc.sbd_balance)).toFixed(3));
 $(".golos_vesting_shares").html(gp);
$(".received_vesting_shares_result").html(received_gp);
$(".delegated_vesting_shares_result").html(delegated_gp);

const timezoneOffset = (new Date()).getTimezoneOffset() * 60000;
var type = 'received';
golos.api.getVestingDelegations(account, '', 100, type, function(err, res) {
  if ( ! err) {
    var vs_amount = '';
  var body_received_vesting_shares = '';
  res.forEach(function(item) {
vs_amount = parseFloat(item.vesting_shares) / 1000000 * golos_per_gests;
vs_amount = vs_amount.toFixed(6);
vs_amount = parseFloat(vs_amount);
let interest_rate = item.interest_rate/100;
let min_delegation_time = Date.parse(item.min_delegation_time);
let min_delegation_datetime = date_str(min_delegation_time - timezoneOffset, true, false, true);
body_received_vesting_shares = '<tr><td><a href="/golos/profiles/' + item.delegator + '" target="_blank">@' + item.delegator + '</a></td><td>' + vs_amount + '</td><td>' + interest_rate + '%</td><td>' + min_delegation_datetime + '</td></tr>';
		jQuery("#body_received_vesting_shares").append(body_received_vesting_shares);
	});
 }
  else console.error(err);
});

var type = 'delegated';
golos.api.getVestingDelegations(account, '', 100, type, function(err, res) {
  //console.log(err, res);
  if ( ! err) {
var vesting_shares_amount = '';
  var body_delegated_vesting_shares = '';
  res.forEach(function(item) {
vesting_shares_amount = parseFloat(item.vesting_shares) / 1000000 * golos_per_gests;
vesting_shares_amount = vesting_shares_amount.toFixed(6);
vesting_shares_amount = parseFloat(vesting_shares_amount);
let interest_rate = item.interest_rate/100;
let min_delegation_time = Date.parse(item.min_delegation_time);
let min_delegation_datetime = date_str(min_delegation_time - timezoneOffset, true, false, true);
body_delegated_vesting_shares = '<tr id="delegated_vesting_shares_' + item.delegatee + '"><td><a href="/golos/profiles/' + item.delegatee + '" target="_blank">@' + item.delegatee + '</a></td><td>' + vesting_shares_amount + '</td><td>' + interest_rate + '%</td><td>' +  min_delegation_datetime + '</td><td><input type="button" id="cancel_delegated_vesting_shares_' + item.delegatee + '" value="Отменить делегирование"></td></tr>';
		jQuery("#body_delegated_vesting_shares").append(body_delegated_vesting_shares);
 $('#cancel_delegated_vesting_shares_' + item.delegatee).click(function(){
golos.broadcast.delegateVestingShares(active_key, account, item.delegatee, '0.000000 GESTS', function(err, result) {
if (!err) {
window.alert('Делегирование пользователю ' + item.delegatee + ' отменено.');
$('#delegated_vesting_shares_' + item.delegatee).css("display", "none");
} else {
window.alert(err);
}
});
 });
 });
 }
  else console.error(err);
});

var full_vesting = (gp - delegated_gp + received_gp).toFixed(6);
$("#full_vesting").html(full_vesting);

 $("#cancel_vesting_withdraw").click(function(){
golos.broadcast.withdrawVesting(active_key, account, '0.000000 GESTS', function(err, result) {
  if (!err) {
window.alert('Вывод отменён.');
$('#info_vesting_withdraw').css('display', 'none');
  } else {
window.alert(err);
  }
});
}); // end subform

var vesting_withdraw_rate = parseFloat(acc.vesting_withdraw_rate) / 1000000 * golos_per_gests;
vesting_withdraw_rate = vesting_withdraw_rate.toFixed(6);
vesting_withdraw_rate = parseFloat(vesting_withdraw_rate);
$("#vesting_withdraw_rate").html(vesting_withdraw_rate);
var nvwithdrawal = Date.parse(acc.next_vesting_withdrawal);
$("#nvwithdrawal").html(nvwithdrawal);
var next_vesting_withdrawal = date_str(nvwithdrawal-(new Date().getTimezoneOffset()*60000),true,false,true);
$("#next_vesting_withdrawal").html(next_vesting_withdrawal);
var full_vesting_withdraw = (vesting_withdraw_rate*13).toFixed(6) + ' СГ';
$("#full_vesting_withdraw").html(full_vesting_withdraw);
if (full_vesting_withdraw !== '0.000000 СГ') {
jQuery("#info_vesting_withdraw").css("display", "block");
}

var max_vesting_withdraw = (gp - delegated_gp - parseFloat(full_vesting_withdraw)).toFixed(6);
$("#max_vesting_withdraw_result").html(new Number(parseFloat(max_vesting_withdraw)).toFixed(6));

  $("#max_vesting_withdraw").click(function(){
 $('#action_vesting_withdraw_amount').val(new Number(parseFloat(max_vesting_withdraw)).toFixed(6));
  });
 $("#action_vesting_withdraw_start").click(function(){
var action_vesting_withdraw_amount = parseFloat($('#action_vesting_withdraw_amount').val());
let withdraw_gests = action_vesting_withdraw_amount * 1000000 / golos_per_gests;
withdraw_gests =  withdraw_gests.toFixed(6) + ' GESTS';
golos.broadcast.withdrawVesting(active_key, account, withdraw_gests, function(err, result) {
if (!err) {
window.alert('Вывод на ' + action_vesting_withdraw_amount + ' начат.');
location.reload();
} else {
window.alert('Ошибка: ' + err);
}
  });

}); // end subform

  $("#max_vesting_transfer").click(function(){
 $('#action_golos_transfer_amount').val(new Number(parseFloat(acc.balance)).toFixed(3));
  });
 $("#action_golos_transfer_start").click(function(){
 var action_golos_transfer_to = $('#action_golos_transfer_to').val();
 var action_golos_transfer_amount = $('#action_golos_transfer_amount').val();
 action_golos_transfer_amount = parseFloat(action_golos_transfer_amount);
 action_golos_transfer_amount = action_golos_transfer_amount.toFixed(3) + ' GOLOS';
 var action_golos_transfer_memo = $('#action_golos_transfer_memo').val();
 var golos_transfer_in = $('#golos_transfer_in').val();

if (golos_transfer_in === 'to_vesting') {
golos.broadcast.transferToVesting(active_key, account, action_golos_transfer_to, action_golos_transfer_amount, function(err, result) {
if (!err) {
window.alert('Вы перевели ' + action_golos_transfer_amount + ' пользователю ' + action_golos_transfer_to + ' в СГ.');
location.reload();
} else {
window.alert('Ошибка: ' + err);
}
  });
} else if (golos_transfer_in === 'to_tip') {
	golos.broadcast.transferToTip(active_key, account, action_golos_transfer_to, action_golos_transfer_amount, action_golos_transfer_memo, [], function(err, result) {
    if (!err) {
    window.alert('Вы перевели ' + action_golos_transfer_amount + ' пользователю ' + action_golos_transfer_to + ' на баланс донатов.');
    location.reload();
    } else {
    window.alert('Ошибка: ' + err);
    }
      });
} else {
	golos.broadcast.transfer(active_key, account, action_golos_transfer_to, action_golos_transfer_amount, action_golos_transfer_memo, function(err, result) {
if (!err) {
window.alert('Вы перевели ' + action_golos_transfer_amount + ' пользователю ' + action_golos_transfer_to + '.');
location.reload();
} else {
window.alert('Ошибка: ' + err);
}
  });
}
}); // end subform

$("#action_save_transfer_template").click(function(){
    let name = window.prompt('Введите название шаблона');
    if (name && name !== '') {
      try {
      let action_golos_transfer_to = $('#action_golos_transfer_to').val();
      let action_golos_transfer_memo = $('#action_golos_transfer_memo').val();
      let golos_transfer_in = $('#golos_transfer_in').val();
    
    let transfer_templates = JSON.parse(localStorage.getItem('golos_transfer_templates'));
     if (transfer_templates && transfer_templates.length > 0) {
      let counter = 0; 
      for (let template of transfer_templates) {
         if (name === template.name) {
          counter = 1;
          template.to = action_golos_transfer_to;
          template.memo = action_golos_transfer_memo;
           template.in = golos_transfer_in;
         } // end if to.
       } // end for.
     if (counter === 0) {
      transfer_templates.push({name, to: action_golos_transfer_to, memo: action_golos_transfer_memo, in: golos_transfer_in});
     }
      } // end if templates.
     else {
       transfer_templates = [];
       transfer_templates.push({name, to: action_golos_transfer_to, memo: action_golos_transfer_memo, in: golos_transfer_in});
     }
          localStorage.setItem('golos_transfer_templates', JSON.stringify(transfer_templates));
    window.alert('Шаблон добавлен.');
          location.reload();
    } catch(e) {
      window.alert('Ошибка: '  + JSON.stringify(e))
    }
    } else {
      window.alert('Вы отменили создание шаблона.');
    }
  }); // end subform
  
  $("#action_save_gbg_transfer_template").click(function(){
    let name = window.prompt('Введите название шаблона');
    if (name && name !== '') {
      try {
      let action_golos_gbg_transfer_to = $('#action_golos_gbg_transfer_to').val();
      let action_golos_gbg_transfer_memo = $('#action_golos_gbg_transfer_memo').val();
    
    let transfer_templates = JSON.parse(localStorage.getItem('golos_gbg_transfer_templates'));
     if (transfer_templates && transfer_templates.length > 0) {
      let counter = 0; 
      for (let template of transfer_templates) {
         if (name === template.name) {
          counter = 1;
          template.to = action_golos_gbg_transfer_to;
          template.memo = action_golos_gbg_transfer_memo;
         } // end if to.
       } // end for.
     if (counter === 0) {
      transfer_templates.push({name, to: action_golos_gbg_transfer_to, memo: action_golos_gbg_transfer_memo});
     }
      } // end if templates.
     else {
       transfer_templates = [];
       transfer_templates.push({name, to: action_golos_gbg_transfer_to, memo: action_golos_gbg_transfer_memo});
     }
     localStorage.setItem('golos_gbg_transfer_templates', JSON.stringify(transfer_templates));
     window.alert('Шаблон добавлен.');
     location.reload();
    } catch(e) {
      window.alert('Ошибка: '  + JSON.stringify(e))
    }
    } else {
      window.alert('Вы отменили создание шаблона.');
    }
  }); // end subform

  $("#action_save_donate_template").click(function(){
    let name = window.prompt('Введите название шаблона');
    if (name && name !== '') {
      try {
      let donate_to = $('#donate_to').val();
      let donate_memo = $('#donate_memo').val();
    
    let donate_templates = JSON.parse(localStorage.getItem('golos_donate_templates'));
     if (donate_templates && donate_templates.length > 0) {
      let counter = 0; 
      for (let template of donate_templates) {
         if (name === template.name) {
          counter = 1;
          template.to = donate_to;
          template.memo = donate_memo;
         } // end if to.
       } // end for.
     if (counter === 0) {
      donate_templates.push({name, to: donate_to, memo: donate_memo});
     }
      } // end if templates.
     else {
       donate_templates = [];
       donate_templates.push({name, to: donate_to, memo: donate_memo});
     }
          localStorage.setItem('golos_donate_templates', JSON.stringify(donate_templates));
    window.alert('Шаблон добавлен.');
          location.reload();
    } catch(e) {
      window.alert('Ошибка: '  + JSON.stringify(e))
    }
    } else {
      window.alert('Вы отменили создание шаблона.');
    }
  }); // end subform

  $("#max_vesting_donate").click(function(){
  $('#donate_amount').val(new Number(parseFloat(acc.tip_balance)).toFixed(3));
   });
  $("#donate_start").click(function(){
  var donate_to = $('#donate_to').val();
  var donate_amount = $('#donate_amount').val();
  donate_amount = parseFloat(donate_amount);
  donate_amount = donate_amount.toFixed(3) + ' GOLOS';
  var donate_memo = $('#donate_memo').val();
  golos.broadcast.donate(posting_key, account, donate_to, donate_amount, {app: 'dpos-space', version: 1, comment: donate_memo, target: {type: 'personal_donate'}}, [], function(err, result) {
 if (!err) {
 window.alert('Вы отблагодарили пользователя ' + donate_to + ' на ' + donate_amount + '.');
 location.reload();
 } else {
 window.alert('Ошибка: ' + err);
 }
   });
 }); // end subform

 $('#accumulative_balance_to').val(account);
 $('#max_accumulative_balance').html(`Перевести все доступные ${accumulative_balance}`);
 $("#max_accumulative_balance").click(function(){
    $('#accumulative_balance_amount').val(new Number(parseFloat(acc.accumulative_balance)).toFixed(3));
   });
  $("#accumulative_balance_start").click(function(){
  var accumulative_balance_to = $('#accumulative_balance_to').val();
  var accumulative_balance_amount = $('#accumulative_balance_amount').val();
  accumulative_balance_amount = parseFloat(accumulative_balance_amount);
  accumulative_balance_amount = accumulative_balance_amount.toFixed(3) + ' GOLOS';
  var accumulative_balance_vesting = $('#accumulative_balance_vesting').prop("checked");
    golos.broadcast.claim(posting_key, account, accumulative_balance_to, accumulative_balance_amount, accumulative_balance_vesting, [], function(err, res) {
 if (!err) {
 window.alert('Вы получили GOLOS из баланса начислений на СГ. Сумма: ' + accumulative_balance_amount + ', получатель: ' + accumulative_balance_to + '.');
 location.reload();
 } else {
 window.alert('Ошибка: ' + err);
 }
   });
 }); // end subform

 $("#max_vesting_transfer_from_tip").click(function(){
  $('#transfer_from_tip_amount').val(new Number(parseFloat(acc.tip_balance)).toFixed(3));
   });
  $("#transfer_from_tip_start").click(function(){
  var transfer_from_tip_to = $('#transfer_from_tip_to').val();
  var transfer_from_tip_amount = $('#transfer_from_tip_amount').val();
  transfer_from_tip_amount = parseFloat(transfer_from_tip_amount);
  transfer_from_tip_amount = transfer_from_tip_amount.toFixed(3) + ' GOLOS';
  var transfer_from_tip_memo = $('#transfer_from_tip_memo').val();
   golos.broadcast.transferFromTip(active_key, account, transfer_from_tip_to, transfer_from_tip_amount, transfer_from_tip_memo, [], function(err, result) {
 if (!err) {
 window.alert('Вы перевели ' + transfer_from_tip_amount + ' пользователю ' + transfer_from_tip_to + ' в СГ.');
 location.reload();
 } else {
 window.alert('Ошибка: ' + err);
 }
   });
 }); // end subform
 

 
   $("#max_to_shares_transfer").click(function(){
 $('#action_to_shares_transfer_amount').val(new Number(parseFloat(acc.balance)).toFixed(3));
  });
 $("#action_to_shares_transfer_start").click(function(){
 var action_to_shares_transfer_amount = parseFloat($('#action_to_shares_transfer_amount').val());
 action_to_shares_transfer_amount = action_to_shares_transfer_amount.toFixed(3) + ' GOLOS';
golos.broadcast.transferToVesting(active_key, account, account, action_to_shares_transfer_amount, function(err, result) {
if (!err) {
window.alert('Вы успешно перевели ' + action_to_shares_transfer_amount + ' golos в СГ своего аккаунта.');
location.reload();
} else {
window.alert('Ошибка: ' + err);
}
  });
}); // end subform

var max_vesting_deligate = (gp - delegated_gp).toFixed(6);
$("#max_vesting_deligate").html(max_vesting_deligate);

  $("#max_vesting_delegate").click(function(){
 $('#action_vesting_delegate_amount').val(new Number(parseFloat(max_vesting_deligate)).toFixed(6));
  });
 $("#action_vesting_delegate_start").click(function(){
 var action_vesting_delegate_to = $('#action_vesting_delegate_to').val();
 var action_vesting_delegate_amount = parseFloat($('#action_vesting_delegate_amount').val());
 let delegate_gests = action_vesting_delegate_amount * 1000000 / golos_per_gests;
 delegate_gests = delegate_gests.toFixed(6) + ' GESTS';
var delegate_interest = parseFloat($('#action_vesting_delegate_interest_rate').val()) * 100;
delegate_interest = parseInt(delegate_interest);
golos.broadcast.delegateVestingSharesWithInterest(active_key, account, action_vesting_delegate_to, delegate_gests, delegate_interest, [], function(err, result) {
if (!err) {
window.alert('Вы делегировали ' + action_vesting_delegate_amount + '.');
location.reload();
} else {
console.log(JSON.stringify(err));
  window.alert('Ошибка: ' + err);
}
  });

}); // end subform

$("#new_private_gen").click(function(){
	$('#create_invite_key').val(pass_gen());
});

//цепляем событие на onclick кнопки
var button = document.getElementById('new_private_copy');
button.addEventListener('click', function () {
  //нашли наш контейнер
  var ta = document.querySelector('#create_invite_key');
    ta.focus();
    ta.setSelectionRange(0, ta.value.length);
 
  try { 
    document.execCommand('copy'); 
  } catch(err) { 
    console.log('Can`t copy, boss'); 
  } 
  //очистим выделение текста, чтобы пользователь не парился
  window.getSelection().removeAllRanges();
});
  
  $("#max_invite_balance").click(function(){
 $('#create_invite_amount').val(new Number(parseFloat(acc.balance)).toFixed(3));
  });
 $("#create_invite_start").click(function(){
 var create_invite_amount = parseFloat($('#create_invite_amount').val()).toFixed(3) + ' GOLOS';
 var create_private_invite_key = $('#create_invite_key').val();
$("#create_private_invite_key_result").html(create_private_invite_key);
$("#invite_reg_link").html('https://liveblogs.space/reg.html?invite=' + create_private_invite_key);
$("#create_invite_result_amount").html(create_invite_amount);
		var create_invite_key = golos.auth.wifToPublic(create_private_invite_key);
golos.broadcast.invite(active_key, account, create_invite_amount, create_invite_key, [], function(err, result) {
if (!err) {
$('#invite_created').css('display', 'block');
} else {
window.alert('Ошибка: ' + err);
}
  });
}); // end subform

$("#action_vesting_diposit_start").click(function(){
  var invite_secret = $('#invite_secret').val();
  golos.broadcast.inviteClaim(active_key, account, account, invite_secret, [], function(err, result) {
  if (!err) {
  window.alert('Пополнение прошло успешно.');
  location.reload();
  } else {
  window.alert('Ошибка: ' + err);
  }
  });
  }); // end subform
  
var witness_votes = acc.witness_votes;
var witness_votes_count = witness_votes.length;
witness_votes.forEach(function(witness_vote) {
if (witness_votes_count === 2 || witness_vote === 'denis-skripnik') {
$("#witnesses_vote_button").css("display", "none");
} else {
$("#witnesses_vote_button").css("display", "inline");
}
	});

  $("#witnesses_vote_button").click(function(){
golos.broadcast.accountWitnessVote(active_key, account, 'denis-skripnik', true, function(err, result) {
if (!err) {
window.alert('Благодарю вас за голос!');
} else {
window.alert('Ошибка: ' + err);
}
});
$("#witnesses_vote_button").css("display", "none");
  });
  
var to = getUrlVars()['to'];
var amount = getUrlVars()['amount'];
var memo = getUrlVars()['memo'];

if (to && amount && memo) {
$(document).ready(function(){
$("#golos_transfer_modal").modal('show');
$('#action_golos_transfer_to').val(to).prop('readonly', true);
$('#action_golos_transfer_amount').val(amount).prop('readonly', true);
$('#action_golos_transfer_memo').val(decodeURIComponent(memo)).prop('readonly', true);
});
} else if (to && memo) {
$(document).ready(function(){
$("#golos_transfer_modal").modal('show');
$('#action_golos_transfer_to').val(to).prop('readonly', true);
$('#action_golos_transfer_memo').val(decodeURIComponent(memo)).prop('readonly', true);
}); 
} else if (amount && memo) {
$(document).ready(function(){
$("#golos_transfer_modal").modal('show');
$('#action_golos_transfer_amount').val(amount).prop('readonly', true);
$('#action_golos_transfer_memo').val(decodeURIComponent(memo)).prop('readonly', true);
});
} else if (to && amount) {
$(document).ready(function(){
$("#golos_transfer_modal").modal('show');
$('#action_golos_transfer_to').val(to).prop('readonly', true);
$('#action_golos_transfer_amount').val(amount).prop('readonly', true);
});
} else if (to) {
$(document).ready(function(){
$("#golos_transfer_modal").modal('show');
$('#action_golos_transfer_to').val(to).prop('readonly', true);
});
} else if (amount) {
$(document).ready(function(){
$("#golos_transfer_modal").modal('show');
$('#action_golos_transfer_amount').val(amount).prop('readonly', true);
});
} else if (memo) {
$(document).ready(function(){
$("#golos_transfer_modal").modal('show');
$('#action_golos_transfer_memo').val(decodeURIComponent(memo)).prop('readonly', true);
});
}
}
});
 });
 }
});
}

function prepareContent(text) {
  return text.replace(/[^=][^""][^"=\/](https?:\/\/[^" <>\n]+)/gi, data => {
  const link = data.slice(3);
    if(/(jpe?g|png|svg|gif)$/.test(link)) return `${data.slice(0,3)} <img src="${link}" alt="" /> `
    if(/(vimeo)/.test(link)) return `${data.slice(0,3)} <iframe src="${link}" frameborder="0" allowfullscreen></iframe> `;
    if(/(youtu)/.test(link)) return `${data.slice(0,3)} <iframe src="${link.replace(/.*v=(.*)/, 'https://www.youtube.com/embed/$1')}" frameborder="0" allowfullscreen></iframe> `;
    return `${data.slice(0,3)} <a href="${link}">${link}</a> `
  }).replace(/ (@[^< \.,]+)/gi, user => ` <a href="/golos/profiles/${user.trim().slice(1)}">${user.trim()}</a>`)
 }

const walletDataSettings = {
	limit: 100,
	limit_max: 10000,
	from: -1,
  get isFirstRequest() {
		return this.from === -1;
	},
  buttonId: 'wallet-data-button',
};

async function thisAccountHistory(type) {
    // История переводов:
    jQuery("#wallet_transfer_history").css("display", "block");

    const result = [];
    let isCompleted = false;
    let isEnd = false;
    let isValidElement;
  
    const {limit, limit_max, buttonId} = walletDataSettings;

    while (! isCompleted && ! isEnd) {
      let {from, isFirstRequest} = walletDataSettings;
      let limitReal = (isFirstRequest || limit_max <= from) ? limit_max : from;
 if (type === 'filtr') {
   from = -1;
   limitReal = 10000;
  }

 const data = await golos.api.getAccountHistoryAsync(golos_login, from, limitReal, JSON.parse(localStorage.getItem('wallet_history_filtr')));
  data.sort(accountHistoryCompareDate);
      for (const operation of data) {
        const op = operation[1].op;
        isValidElement = (op[1].from && op[1].to && op[1].amount) ||
        op[0] === 'transfer' ||
        op[0] === 'transfer_to_vesting' ||
        op[0] === 'transfer_from_tip' ||
        op[0] === 'transfer_to_tip' ||
        op[0] === 'donate' ||
        op[0] === 'claim' ||
        op[0] === 'delegate_vesting_shares' ||
        op[0] === 'delegate_vesting_shares_with_interest' ||
        op[0] === 'delegation_reward' ||
        op[0] === 'curation_reward' ||
        op[0] === 'author_reward' ||
        op[0] === 'comment_benefactor_reward' ||
        op[0] === 'producer_reward';
  
      if (isValidElement) {
        result.push(operation);
  
        if (result.length === limit + 1) {
          isCompleted = true;
          break;
        }
      }
    }
  
    if (! isCompleted) {
      if (data.length < limitReal + 1) {
        isEnd = true;
      } else {
        const lastElement = data[data.length - 1];
  
        walletDataSettings.from = lastElement[0];
  
        if (isValidElement) {
          result.pop();
        }
      }
    }
  }
  
  if (isEnd) {
    const button = document.getElementById(buttonId);
    if (button) {
      button.remove();
    }
  } else {
    const lastElement = result.pop();
  
    walletDataSettings.from = lastElement[0];
  }
  
  appendWalletData(result);
}

async function walletData() {
  if (active_key) {
  jQuery("#main_wallet_info").css("display", "block");
  load_balance(golos_login, active_key);
thisAccountHistory();
  }
}

function appendWalletData(items) {
  golos.api.getDynamicGlobalProperties(function(error, res) {
    if (!error) {
    let tvfs = parseFloat(res.total_vesting_fund_steem);
    let tvsh = parseFloat(res.total_vesting_shares);
    let golos_per_gests = 1000000 * tvfs / tvsh;

  const timezoneOffset = (new Date()).getTimezoneOffset() * 60000;

items.forEach(item => {

  var get_time = Date.parse(item[1].timestamp);
  var transfer_datetime = date_str(get_time - timezoneOffset, true, false, true);

  var op = item[1].op;
  if (op[0] === 'transfer' || op[0] === 'claim' || op[0] === 'transfer_to_tip' || op[0] === 'donate') {
    var from = op[1].from;
    var to = op[1].to;
    var amount = op[1].amount;
      var memo = '';
      if (op[0] === 'transfer') memo = prepareContent(op[1].memo);
      if (op[0] === 'claim' && op[1]['to_vesting'] === true) memo = 'Получение своих начислений на СГ.';
      if (op[0] === 'claim' && op[1]['to_vesting'] === false) memo = 'Получение своих начислений в TIP-баланс.';
      if (op[0] === 'transfer_to_tip') memo = 'Перевод в TIP баланс. ' + op[1]['memo'];
      if (op[0] === 'donate') memo = 'Донат. Заметка: ' + op[1]['memo']['comment'];
      jQuery("#transfer_history_tbody").append('<tr class="filtered ' + from + '"><td>' + transfer_datetime + '</td>\
<td><a href="/golos/profiles/' + from + '" target="_blank">@' + from + '</a></td>\
<td><a href="/golos/profiles/' + to + '" target="_blank">@' + to + '</a></td>\
<td>' + amount + '</td>\
<td>' + memo + '</td>\
</tr>');
  } else if (op[0] === 'transfer_to_vesting' || op[0] === 'transfer_from_tip') {
  var from = op[1].from;
  var to = op[1].to;
  var amount = op[1].amount;
    var memo = 'Перевод в СГ';
  jQuery("#transfer_history_tbody").append('<tr class="filtered ' + from + '"><td>' + transfer_datetime + '</td>\
<td><a href="/golos/profiles/' + from + '" target="_blank">@' + from + '</a></td>\
<td><a href="/golos/profiles/' + to + '" target="_blank">@' + to + '</a></td>\
<td>' + amount + '</td>\
<td>' + memo + '</td>\
</tr>');
} else if (op[0] === 'delegate_vesting_shares') {
  var from = op[1].delegator;
  var to = op[1].delegatee;
  var amount = parseFloat(op[1].vesting_shares) / 1000000 * golos_per_gests;
    amount = amount.toFixed(6) + ' СГ';
  var memo = 'Делегирование Силы Голоса.';
  jQuery("#transfer_history_tbody").append('<tr class="filtered ' + from + '"><td>' + transfer_datetime + '</td>\
<td><a href="/golos/profiles/' + from + '" target="_blank">@' + from + '</a></td>\
<td><a href="/golos/profiles/' + to + '" target="_blank">@' + to + '</a></td>\
<td>' + amount + '</td>\
<td>' + memo + '</td>\
</tr>');
} else if (op[0] === 'delegate_vesting_shares_with_interest') {
  var from = op[1].delegator;
  var to = op[1].delegatee;
  var amount = parseFloat(op[1].vesting_shares) / 1000000 * golos_per_gests;
    amount = amount.toFixed(6) + ' СГ';
  var interest_rate = op[1].interest_rate;
    var memo = 'Делегирование Силы Голоса с возвратом ' + interest_rate/100 + '% от кураторских.';
  jQuery("#transfer_history_tbody").append('<tr class="filtered ' + from + '"><td>' + transfer_datetime + '</td>\
<td><a href="/golos/profiles/' + from + '" target="_blank">@' + from + '</a></td>\
<td><a href="/golos/profiles/' + to + '" target="_blank">@' + to + '</a></td>\
<td>' + amount + '</td>\
<td>' + memo + '</td>\
</tr>');
} else if (op[0] === 'delegation_reward') {
  var from = op[1].delegator;
  var to = op[1].delegatee;
  var amount = parseFloat(op[1].vesting_shares) / 1000000 * golos_per_gests;
    amount = amount.toFixed(6) + ' СГ';
  var payout_strategy = op[1].payout_strategy;
  var payout_strategy_str = '';
  if (payout_strategy === 'to_delegator') {
    payout_strategy_str = 'делегатору';
  } else {
    payout_strategy_str = 'делегируемому';
  }
  var memo = 'Награда с делегирования Силы Голоса. Направление: ' + payout_strategy_str + '.';
  jQuery("#transfer_history_tbody").append('<tr class="filtered ' + from + '"><td>' + transfer_datetime + '</td>\
<td><a href="/golos/profiles/' + from + '" target="_blank">@' + from + '</a></td>\
<td><a href="/golos/profiles/' + to + '" target="_blank">@' + to + '</a></td>\
<td>' + amount + '</td>\
<td>' + memo + '</td>\
</tr>');
} else if (op[0] === 'curation_reward') {
    var author = op[1].comment_author;
    var permlink = op[1].comment_permlink;
    var curator = op[1].curator;
    var reward = parseFloat(op[1].reward) / 1000000 * golos_per_gests;
    reward = reward.toFixed(6) + ' СГ';
    var memo = 'Кураторская награда за пост или комментарий <a href="https://golos.id/@' + author + '/' + permlink + '" target="_blank">https://golos.id/@' + author + '/' + permlink + '</a>';
    jQuery("#transfer_history_tbody").append('<tr class="filtered_curation_reward"><td>' + transfer_datetime + '</td>\
<td><a href="/golos/profiles/' + author + '" target="_blank">@' + author + '</a></td>\
<td><a href="/golos/profiles/' + curator + '" target="_blank">@' + curator + '</a></td>\
<td>' + reward + '</td>\
<td>' + memo + '</td>\
</tr>');
  } else if (op[0] === 'author_reward') {
    var from = 'пул golos';
    var author = op[1].author;
    var permlink = op[1].permlink;
var gbg_payout = op[1].sbd_payout;
var golos_payout = op[1].steem_payout;
var vesting_payout = parseFloat(op[1].vesting_payout) / 1000000 * golos_per_gests;
vesting_payout = vesting_payout.toFixed(6) + ' СГ';
    var memo = 'Авторская награда за пост или комментарий <a href="https://golos.id/@' + author + '/' + permlink + '" target="_blank">https://golos.id/@' + author + '/' + permlink + '</a>';
    jQuery("#transfer_history_tbody").append('<tr class="filtered_author_reward"><td>' + transfer_datetime + '</td>\
<td>' + from + '</td>\
<td><a href="/golos/profiles/' + author + '" target="_blank">@' + author + '</a></td>\
<td>' + gbg_payout + ', ' + golos_payout + ' и ' + vesting_payout + '</td>\
<td>' + memo + '</td>\
</tr>');
  } else if (op[0] === 'comment_benefactor_reward') {
    var author = op[1].author;
    var permlink = op[1].permlink;
    var benefactor = op[1].benefactor;
    var vesting_payout = parseFloat(op[1].reward) / 1000000 * golos_per_gests;
    vesting_payout = vesting_payout.toFixed(6) + ' СГ';
    var memo = 'Бенефициарская награда за пост или комментарий <a href="https://golos.id/@' + author + '/' + permlink + '" target="_blank">https://golos.id/@' + author + '/' + permlink + '</a>';
    jQuery("#transfer_history_tbody").append('<tr class="filtered_content_benefactor_reward"><td>' + transfer_datetime + '</td>\
<td><a href="/golos/profiles/' + author + '" target="_blank">@' + author + '</a></td>\
<td><a href="/golos/profiles/' + benefactor + '" target="_blank">@' + benefactor + '</a></td>\
<td>' + vesting_payout + '</td>\
<td>' + memo + '</td>\
</tr>');
  } else if (op[0] === 'producer_reward') {
    var from = 'пул golos';
    var witness = op[1].producer;
    var shares = parseFloat(op[1].vesting_shares) / 1000000 * golos_per_gests;
    shares = shares.toFixed(6) + ' СГ';
    var memo = 'Награда делегата.';
    jQuery("#transfer_history_tbody").append('<tr class="filtered_witness_reward"><td>' + transfer_datetime + '</td>\
<td>' + from + '</td>\
<td><a href="/golos/profiles/' + witness + '" target="_blank">@' + witness + '</a></td>\
<td>' + shares + '</td>\
<td>' + memo + '</td>\
</tr>');
  }

});
}
});
}

function createFiltr() {
  $('#transfer_history_tbody').html('');
  let direction = $('#direction').val();
  var gr = document.getElementsByName('ops');
  var select_ops = [];
  for(var i=0; i<gr.length; i++)
    if (gr[i].checked) {
      select_ops.push(gr[i].value);
    }
        if (direction !== '' && select_ops.length > 0) {
    let query = {direction, select_ops};
    localStorage.setItem('wallet_history_filtr', JSON.stringify(query));
  } else if (direction !== '' && select_ops.length === 0) {
          let query = {direction};
          localStorage.setItem('wallet_history_filtr', JSON.stringify(query));
        } else if (direction === '' && select_ops.length > 0) {
          let query = {select_ops};
          localStorage.setItem('wallet_history_filtr', JSON.stringify(query));
        } else if (direction === '' && select_ops.length === 0) {
          localStorage.removeItem('wallet_history_filtr')
        }
        thisAccountHistory('filtr');
}

$( document ).ready(function() {
  if(0<$('input[type=range]').length){
  bind_range();
}
});

$(document).ready(function() {
  $('#select_transfer_template').change(function() {
    if ($('#select_transfer_template').val() === '') {
      $('#remove_transfer_template').css('display', 'none');
      $('#action_golos_transfer_to').val('');
      $('#action_golos_transfer_memo').val('');
      $('#golos_transfer_in').prop('selectedIndex',0);
    } else if ($('#select_transfer_template').val() === 'rudex') {
      $('#remove_transfer_template').css('display', 'none');
      $('#action_golos_transfer_to').val('rudex');
      $('#action_golos_transfer_memo').val('');
      $('#golos_transfer_in').prop('selectedIndex',0);
    } else if ($('#select_transfer_template').val() === 'livecoin') {
      $('#remove_transfer_template').css('display', 'none');
      $('#action_golos_transfer_to').val('livecoin');
      $('#action_golos_transfer_memo').val('');
      $('#golos_transfer_in').prop('selectedIndex',0);
    } else {
      $('#remove_transfer_template').css('display', 'inline');
      $('#action_golos_transfer_to').val(String($(':selected', this).data('to')));
      $('#action_golos_transfer_memo').val($(':selected', this).data('memo'));
      $(`#golos_transfer_in option[value=${$(':selected', this).data('in')}]`).prop("selected", "selected");
     }
    });
  
    $('#select_gbg_transfer_template').change(function() {
      if ($('#select_gbg_transfer_template').val() === '') {
        $('#remove_gbg_transfer_template').css('display', 'none');
        $('#action_golos_gbg_transfer_to').val('');
        $('#action_golos_gbg_transfer_memo').val('');
      } else if ($('#select_gbg_transfer_template').val() === 'null') {
        $('#remove_gbg_transfer_template').css('display', 'none');
        $('#action_golos_gbg_transfer_to').val('null');
        $('#action_golos_gbg_transfer_memo').val('');
      } else {
        $('#remove_gbg_transfer_template').css('display', 'inline');
        $('#action_golos_gbg_transfer_to').val(String($(':selected', this).data('to')));
        $('#action_golos_gbg_transfer_memo').val($(':selected', this).data('memo'));
       }
      });

      $('#select_donate_template').change(function() {
        if ($('#select_donate_template').val() === '') {
          $('#remove_donate_template').css('display', 'none');
          $('#donate_to').val('');
          $('#donate_memo').val('');
        } else {
          $('#remove_donate_template').css('display', 'inline');
          $('#donate_to').val(String($(':selected', this).data('to')));
          $('#donate_memo').val($(':selected', this).data('memo'));
         }
        });

    $('#username').html(golos_login);
  let filtr = JSON.parse(localStorage.getItem('wallet_history_filtr'));
let select_ops = filtr['select_ops'];
for (let op of select_ops) {
  $(`input[value=${op}]`).prop("checked", true);
}
let direction = filtr['direction'];
if (direction !== '') {
  $(`#direction option[value=${direction}]`).attr("selected", "selected");
}

});