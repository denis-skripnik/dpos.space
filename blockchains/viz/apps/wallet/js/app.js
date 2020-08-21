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
	let wif=viz.auth.toWif('',ret,'')
	return wif;
}

function inviteRegPage(new_account_name, invite_secret, new_account_key, private_key) {
	viz.broadcast.inviteRegistration('5KcfoRuDfkhrLCxVcE9x51J6KN9aM9fpb78tLrvvFckxVV6FyFW', 'invite', new_account_name, invite_secret, new_account_key, function(err, result) {
		if (!err) {
		console.log('inviteRegistration', result);
window.alert('Регистрация прошла успешно.\nВаш логин: '+ new_account_name + ',\nВаш ключ: ' + private_key + '\n\nДобро пожаловать! И не забудьте сохранить ваш ключ, так как его нельзя восстановить.')
	}
	else console.error(err);
  	});
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
  let transfer_templates = JSON.parse(localStorage.getItem('viz_transfer_templates'));
 if (transfer_templates && transfer_templates.length > 0) {
  let template_count = 1;
  for (let template of transfer_templates) {
$('#select_transfer_template').append(`<option value="${template_count}" data-to="${template.to}" data-memo="${template.memo}" data-to_vesting="${template.transfer_to_vesting}">${template.name}</option>
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
  let transfer_templates = JSON.parse(localStorage.getItem('viz_transfer_templates'));
  let templates = [];
  if (transfer_templates && transfer_templates.length > 0) {
    let counter = 1;
    for (let template of transfer_templates) {
      if (counter !== parseInt(value)) {
        templates.push(template);
      }
    counter++;
    }
    localStorage.setItem('viz_transfer_templates', JSON.stringify(templates));
  window.alert('Шаблон удалён.');
  $('#action_viz_transfer_to').val('');
  $('#action_viz_transfer_memo').val('');
 document.getElementById('transfer_to_vesting').checked = false;
}
} catch(e) {
  window.alert('Ошибка: ' + e);
}
  }
}

function load_balance(account, active_key) {
	viz.api.getAccounts([account], function(err, result){
 if (!err) {
 result.forEach(function(acc) {

 $(".viz_balance").html(new Number(parseFloat(acc.balance)).toFixed(3));
$(".viz_vesting_shares").html(parseFloat(acc.vesting_shares).toFixed(3));
$(".received_vesting_shares_result").html(parseFloat(acc.received_vesting_shares).toFixed(3));
$(".delegated_vesting_shares_result").html(parseFloat(acc.delegated_vesting_shares).toFixed(3));

const timezoneOffset = (new Date()).getTimezoneOffset() * 60000;
var type = 'received';
viz.api.getVestingDelegations(account, '', 100, type, function(err, res) {
  if ( ! err) {
    var vs_amount = '';
  var body_received_vesting_shares = '';
  res.forEach(function(item) {
vs_amount = parseFloat(item.vesting_shares).toFixed(3);
let min_delegation_time = Date.parse(item.min_delegation_time);
let min_delegation_datetime = date_str(min_delegation_time - timezoneOffset, true, false, true);
body_received_vesting_shares = '<tr><td><a href="/viz/profiles/' + item.delegator + '" target="_blank">@' + item.delegator + '</a></td><td>' + vs_amount + ' Ƶ</td><td>' + min_delegation_datetime + '</td></tr>';
		jQuery("#body_received_vesting_shares").append(body_received_vesting_shares);
	});
 }
  else console.error(err);
});

var type = 'delegated';
viz.api.getVestingDelegations(account, '', 100, type, function(err, res) {
  //console.log(err, res);
  if ( ! err) {
    var vesting_shares_amount = '';
  var body_delegated_vesting_shares = '';
  res.forEach(function(item) {
vesting_shares_amount = parseFloat(item.vesting_shares).toFixed(3);
let min_delegation_time = Date.parse(item.min_delegation_time);
let min_delegation_datetime = date_str(min_delegation_time - timezoneOffset, true, false, true);
body_delegated_vesting_shares = '<tr id="delegated_vesting_shares_' + item.delegatee + '"><td><a href="/viz/profiles/' + item.delegatee + '" target="_blank">@' + item.delegatee + '</a></td><td>' + vesting_shares_amount + ' Ƶ</td><td>' + min_delegation_datetime + '</td><td><input type="button" id="cancel_delegated_vesting_shares_' + item.delegatee + '" value="Отменить делегирование"></td></tr>';
		jQuery("#body_delegated_vesting_shares").append(body_delegated_vesting_shares);
 $('#cancel_delegated_vesting_shares_' + item.delegatee).click(function(){
viz.broadcast.delegateVestingShares(active_key, account, item.delegatee, '0.000000 SHARES', function(err, result) {
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

var full_vesting = (parseFloat(acc.vesting_shares) - parseFloat(acc.delegated_vesting_shares) + parseFloat(acc.received_vesting_shares)).toFixed(3);
$("#full_vesting").html(full_vesting);

 $("#cancel_vesting_withdraw").click(function(){
viz.broadcast.withdrawVesting(active_key, account, '0.000000 SHARES', function(err, result) {
  if (!err) {
window.alert('Вывод отменён.');
$('#info_vesting_withdraw').css('display', 'none');
  } else {
window.alert(err);
  }
});
}); // end subform

var vesting_withdraw_rate = parseFloat(acc.vesting_withdraw_rate);
$("#vesting_withdraw_rate").html(vesting_withdraw_rate);
var nvwithdrawal = Date.parse(acc.next_vesting_withdrawal);
$("#nvwithdrawal").html(nvwithdrawal);
var next_vesting_withdrawal = date_str(nvwithdrawal-(new Date().getTimezoneOffset()*60000),true,false,true);
$("#next_vesting_withdrawal").html(next_vesting_withdrawal);
var full_vesting_withdraw = (vesting_withdraw_rate*28).toFixed(6) + ' SHARES';
$("#full_vesting_withdraw").html(full_vesting_withdraw);
if (full_vesting_withdraw !== '0.000000 SHARES') {
jQuery("#info_vesting_withdraw").css("display", "block");
}
 $("#action_vesting_diposit_start").click(function(){
var invite_secret = $('#invite_secret').val();
var to_shares = $('#to_shares').prop("checked");
if (to_shares == true) {
  viz.broadcast.useInviteBalance(active_key, account, account, invite_secret, function(err, result) {
    if (!err) {
    window.alert('Пополнение прошло успешно.');
    location.reload();
    } else {
    window.alert('Ошибка: ' + err);
    }
    });
} else {
viz.broadcast.claimInviteBalance(active_key, account, account, invite_secret, function(err, result) {
if (!err) {
window.alert('Пополнение прошло успешно.');
location.reload();
} else {
window.alert('Ошибка: ' + err);
}
});
}
}); // end subform

var max_vesting_withdraw = (parseFloat(acc.vesting_shares) - parseFloat(acc.delegated_vesting_shares) - parseFloat(full_vesting_withdraw)).toFixed(6);
$("#max_vesting_withdraw_result").html(new Number(parseFloat(max_vesting_withdraw)).toFixed(6));

  $("#max_vesting_withdraw").click(function(){
 $('#action_vesting_withdraw_amount').val(new Number(parseFloat(max_vesting_withdraw)).toFixed(6));
  });
 $("#action_vesting_withdraw_start").click(function(){
var action_vesting_withdraw_amount = parseFloat($('#action_vesting_withdraw_amount').val().replace(/,/, '.')).toFixed(6) + ' SHARES';
viz.broadcast.withdrawVesting(active_key, account, action_vesting_withdraw_amount, function(err, result) {
if (!err) {
window.alert('Вывод на ' + action_vesting_withdraw_amount + ' начат.');
location.reload();
} else {
window.alert('Ошибка: ' + err);
}
  });

}); // end subform

  $("#max_vesting_transfer").click(function(){
 $('#action_viz_transfer_amount').val(new Number(parseFloat(acc.balance)).toFixed(3));
  });
 $("#action_viz_transfer_start").click(function(){
 var action_viz_transfer_to = $('#action_viz_transfer_to').val();
 var action_viz_transfer_amount = $('#action_viz_transfer_amount').val().replace(/,/, '.');
 action_viz_transfer_amount = parseFloat(action_viz_transfer_amount);
 action_viz_transfer_amount = action_viz_transfer_amount.toFixed(3) + ' VIZ';
 var action_viz_transfer_memo = $('#action_viz_transfer_memo').val();
var transfer_to_vesting = document.getElementById('transfer_to_vesting');

if (transfer_to_vesting.checked) {
viz.broadcast.transferToVesting(active_key, account, action_viz_transfer_to, action_viz_transfer_amount, function(err, result) {
if (!err) {
window.alert('Вы перевели ' + action_viz_transfer_amount + ' пользователю ' + action_viz_transfer_to + ' в SHARES.');
location.reload();
} else {
window.alert('Ошибка: ' + err);
}
  });
} else {
	viz.broadcast.transfer(active_key, account, action_viz_transfer_to, action_viz_transfer_amount, action_viz_transfer_memo, function(err, result) {
if (!err) {
window.alert('Вы перевели ' + action_viz_transfer_amount + ' пользователю ' + action_viz_transfer_to + '.');
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
    let action_viz_transfer_to = $('#action_viz_transfer_to').val();
    let action_viz_transfer_memo = $('#action_viz_transfer_memo').val();
   let transfer_to_vesting = document.getElementById('transfer_to_vesting').checked
  let transfer_templates = JSON.parse(localStorage.getItem('viz_transfer_templates'));
   if (transfer_templates && transfer_templates.length > 0) {
    let counter = 0; 
    for (let template of transfer_templates) {
       if (name === template.name) {
        counter = 1;
        template.to = action_viz_transfer_to;
        template.memo = action_viz_transfer_memo;
         template.transfer_to_vesting = transfer_to_vesting;
       } // end if to.
     } // end for.
   if (counter === 0) {
    transfer_templates.push({name, to: action_viz_transfer_to, memo: action_viz_transfer_memo, transfer_to_vesting});
   }
    } // end if templates.
   else {
     transfer_templates = [];
     transfer_templates.push({name, to: action_viz_transfer_to, memo: action_viz_transfer_memo, transfer_to_vesting});
   }
  localStorage.setItem('viz_transfer_templates', JSON.stringify(transfer_templates));
  window.alert('Всё Ok: Шаблон создан.');
  location.reload();
  } catch(e) {
    window.alert('Ошибка: '  + JSON.stringify(e))
  }
} else {
  window.alert('Вы отменили создание шаблона.');
}
}); // end subform

  $("#max_to_shares_transfer").click(function(){
 $('#action_to_shares_transfer_amount').val(new Number(parseFloat(acc.balance)).toFixed(3));
  });
 $("#action_to_shares_transfer_start").click(function(){
 var action_to_shares_transfer_amount = $('#action_to_shares_transfer_amount').val().replace(/,/, '.');
 action_to_shares_transfer_amount = parseFloat(action_to_shares_transfer_amount);
 action_to_shares_transfer_amount = action_to_shares_transfer_amount.toFixed(3) + ' VIZ';
viz.broadcast.transferToVesting(active_key, account, account, action_to_shares_transfer_amount, function(err, result) {
if (!err) {
window.alert('Вы успешно перевели ' + action_to_shares_transfer_amount + ' viz в SHARES своего аккаунта.');
location.reload();
} else {
window.alert('Ошибка: ' + err);
}
  });
}); // end subform

var max_vesting_deligate = (parseFloat(acc.vesting_shares) - parseFloat(acc.delegated_vesting_shares)).toFixed(6);
$("#max_vesting_deligate").html(max_vesting_deligate);

  $("#max_vesting_delegate").click(function(){
 $('#action_vesting_delegate_amount').val(new Number(parseFloat(max_vesting_deligate)).toFixed(6));
  });
 $("#action_vesting_delegate_start").click(function(){
 var action_vesting_delegate_to = $('#action_vesting_delegate_to').val();
 var action_vesting_delegate_amount = parseFloat($('#action_vesting_delegate_amount').val().replace(/,/, '.')).toFixed(6) + ' SHARES';
viz.broadcast.delegateVestingShares(active_key, account, action_vesting_delegate_to, action_vesting_delegate_amount, function(err, result) {
if (!err) {
window.alert('Вы делегировали ' + action_vesting_delegate_amount + '.');
location.reload();
} else {
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
 var create_invite_amount = parseFloat($('#create_invite_amount').val().replace(/,/, '.')).toFixed(3) + ' VIZ';
 var create_private_invite_key = $('#create_invite_key').val();
$("#create_private_invite_key_result").html(create_private_invite_key);
$("#invite_reg_link").html('https://liveblogs.space/reg.html?invite=' + create_private_invite_key);
$("#create_invite_result_amount").html(create_invite_amount);
		var create_invite_key = viz.auth.wifToPublic(create_private_invite_key);
viz.broadcast.createInvite(active_key, account, create_invite_amount, create_invite_key, function(err, result) {
if (!err) {
$('#invite_created').css('display', 'block');
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
viz.broadcast.accountWitnessVote(active_key, account, 'denis-skripnik', true, function(err, result) {
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
$("#viz_transfer_modal").modal('show');
$('#action_viz_transfer_to').val(to).prop('readonly', true);
$('#action_viz_transfer_amount').val(amount).prop('readonly', true);
$('#action_viz_transfer_memo').val(decodeURIComponent(memo)).prop('readonly', true);
});
} else if (to && memo) {
$(document).ready(function(){
$("#viz_transfer_modal").modal('show');
$('#action_viz_transfer_to').val(to).prop('readonly', true);
$('#action_viz_transfer_memo').val(decodeURIComponent(memo)).prop('readonly', true);
}); 
} else if (amount && memo) {
$(document).ready(function(){
$("#viz_transfer_modal").modal('show');
$('#action_viz_transfer_amount').val(amount).prop('readonly', true);
$('#action_viz_transfer_memo').val(decodeURIComponent(memo)).prop('readonly', true);
});
} else if (to && amount) {
$(document).ready(function(){
$("#viz_transfer_modal").modal('show');
$('#action_viz_transfer_to').val(to).prop('readonly', true);
$('#action_viz_transfer_amount').val(amount).prop('readonly', true);
});
} else if (to) {
$(document).ready(function(){
$("#viz_transfer_modal").modal('show');
$('#action_viz_transfer_to').val(to).prop('readonly', true);
});
} else if (amount) {
$(document).ready(function(){
$("#viz_transfer_modal").modal('show');
$('#action_viz_transfer_amount').val(amount).prop('readonly', true);
});
} else if (memo) {
$(document).ready(function(){
$("#viz_transfer_modal").modal('show');
$('#action_viz_transfer_memo').val(decodeURIComponent(memo)).prop('readonly', true);
});
}

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
  }).replace(/ (@[^< \.,]+)/gi, user => ` <a href="/viz/profiles/${user.trim().slice(1)}">${user.trim()}</a>`)
 }
 
 const walletDataSettings = {
	limit: 100,
	limit_max: 2000,
	from: -1,
  get isFirstRequest() {
		return this.from === -1;
	},
  buttonId: 'wallet-data-button',
};

async function walletData() {
  if (active_key) {
  jQuery("#main_wallet_info").css("display", "block");
  load_balance(viz_login, active_key);

  // История переводов:
  jQuery("#wallet_transfer_history").css("display", "block");

  const result = [];
  let isCompleted = false;
  let isEnd = false;
  let isValidElement;

  const {limit, limit_max, buttonId} = walletDataSettings;

  while (! isCompleted && ! isEnd) {
    const {from, isFirstRequest} = walletDataSettings;

    const limitReal = (isFirstRequest || limit_max <= from) ? limit_max : from;

    const data = await viz.api.getAccountHistoryAsync(viz_login, from, limitReal);

    data.sort(accountHistoryCompareDate);

    for (const operation of data) {
      const op = operation[1].op;
      isValidElement = (op[1].from && op[1].to && op[1].amount) ||
        op[0] === 'award' ||
        op[0] === 'receive_award' ||
        op[0] === 'benefactor_award' ||
        op[0] === 'witness_reward';

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

  console.dir(result);

  appendWalletData(result);
  }
}

function appendWalletData(items) {
	const timezoneOffset = (new Date()).getTimezoneOffset() * 60000;

	items.forEach(item => {

    var get_time = Date.parse(item[1].timestamp);
    var transfer_datetime = date_str(get_time - timezoneOffset, true, false, true);

    var op = item[1].op;
    if (op[1].from && op[1].to && op[1].amount) {
      var from = op[1].from;
      var to = op[1].to;
      var amount = op[1].amount;
      if (op[1].memo) {
        var memo = prepareContent(op[1].memo);
      } else if (op[0] === 'transfer_to_vesting') {
        var memo = 'Перевод в SHARES.';
      } else {
        var memo = '';
      }
      jQuery("#transfer_history_tbody").append('<tr class="filtered ' + from + '"><td>' + transfer_datetime + '</td>\
<td><a href="/viz/profiles/' + from + '" target="_blank">@' + from + '</a></td>\
<td><a href="/viz/profiles/' + to + '" target="_blank">@' + to + '</a></td>\
<td>' + amount + '</td>\
<td>' + memo + '</td>\
  </tr>');
    } else if (op[0] === 'award') {
      var initiator = op[1].initiator;
      var receiver = op[1].receiver;
      var energy = op[1].energy/100;
      var memo = 'Награда на '+energy+'% энергии. Заметка: ' + op[1].memo;
      jQuery("#transfer_history_tbody").append('<tr class="filtered_award"><td>' + transfer_datetime + '</td>\
<td><a href="/viz/profiles/' + initiator + '" target="_blank">@' + initiator + '</a></td>\
<td><a href="/viz/profiles/' + receiver + '" target="_blank">@' + receiver + '</a></td>\
<td></td>\
<td>' + memo + '</td>\
  </tr>');
    } else if (op[0] === 'receive_award') {
      var from = op[1].initiator;
      var to = op[1].receiver;
      var amount = op[1].shares;
      var memo = `Вы получили награду из фонда наград Viz. Заметка: ${op[1].memo}.`;
      jQuery("#transfer_history_tbody").append('<tr class="filtered_receive_award"><td>' + transfer_datetime + '</td>\
  <td><a href="/viz/profiles/' + from + '" target="_blank">@' + from + '</a></td>\
  <td><a href="/viz/profiles/' + to + '" target="_blank">@' + to + '</a></td>\
  <td>' + amount + '</td>\
  <td>' + memo + '</td>\
	</tr>');
    } else if (op[0] === 'benefactor_award') {
      var from = op[1].initiator;
      var benefactor = op[1].benefactor;
      var receiver = op[1].receiver;
      var amount = op[1].shares;
      var memo = `Вы получили бенефициарские. Получатель награды: <a href="/viz/profiles/${receiver}" target="_blank">@${receiver}</a>. Заметка: ${op[1].memo}`;
      jQuery("#transfer_history_tbody").append('<tr class="filtered_benefactor_award"><td>' + transfer_datetime + '</td>\
  <td><a href="/viz/profiles/' + from + '" target="_blank">@' + from + '</a></td>\
  <td><a href="/viz/profiles/' + benefactor + '" target="_blank">@' + benefactor + '</a></td>\
  <td>' + amount + '</td>\
  <td>' + memo + '</td>\
	</tr>');
    } else if (op[0] === 'witness_reward') {
      var from = 'пул viz';
      var witness = op[1].witness;
      var shares = op[1].shares;
      var memo = 'Награда делегата.';
      jQuery("#transfer_history_tbody").append('<tr class="filtered_witness_reward"><td>' + transfer_datetime + '</td>\
  <td>' + from + '</td>\
  <td><a href="/viz/profiles/' + witness + '" target="_blank">@' + witness + '</a></td>\
  <td>' + shares + '</td>\
  <td>' + memo + '</td>\
	</tr>');
    }

  });
}

$( document ).ready(function() {
  $('#select_transfer_template').change(function() {
    if ($('#select_transfer_template').val() === '') {
      $('#remove_transfer_template').css('display', 'none');
      $('#action_viz_transfer_to').val('');
      $('#action_viz_transfer_memo').val('');
     document.getElementById('transfer_to_vesting').checked = false;
    } else if ($('#select_transfer_template').val() === 'xchng_market') {
      $('#remove_transfer_template').css('display', 'none');
      $('#action_viz_transfer_to').val('xchng');
      $('#action_viz_transfer_memo').val('log:');
     document.getElementById('transfer_to_vesting').checked = false;
    } else {
      $('#remove_transfer_template').css('display', 'inline');
      $('#action_viz_transfer_to').val($(':selected', this).data('to'));
      $('#action_viz_transfer_memo').val($(':selected', this).data('memo'))
     if ($(':selected', this).data('to_vesting') == true) {
      document.getElementById('transfer_to_vesting').checked = true;
     } else {
        document.getElementById('transfer_to_vesting').checked = false;
      }
     }
    });
    
  $('#username').html(viz_login);
  $("#all_transfers").click(function ()
{
    $("#transfer_history_tbody tr").css("display", "table-row");
});

$("#get_transfers").click(function ()
{
 $("#transfer_history_tbody tr").css("display", "table-row");
    if ($("#transfer_history_tbody tr").hasClass(user.login))
    {
        $("#transfer_history_tbody ." + user.login).css("display", "none");
    }
});

$("#send_transfers").click(function ()
{
 $("#transfer_history_tbody tr").css("display", "table-row");
    $("#transfer_history_tbody tr").css("display", "none");
    if ($("tr").hasClass(user.login))
    {
        $("#transfer_history_tbody ." + user.login).css("display", "table-row");
    }
});

$("#award").click(function ()
{
    $("#transfer_history_tbody tr").css("display", "none");
    $("#transfer_history_tbody .filtered_award").css("display", "table-row");
});


$("#receive_award").click(function ()
{
    $("#transfer_history_tbody tr").css("display", "none");
    $("#transfer_history_tbody .filtered_receive_award").css("display", "table-row");
});

$("#benefactor_award").click(function ()
{
    $("#transfer_history_tbody tr").css("display", "none");
    $("#transfer_history_tbody .filtered_benefactor_award").css("display", "table-row");
});

$("#witness_reward").click(function ()
{
    $("#transfer_history_tbody tr").css("display", "none");
    $("#transfer_history_tbody .filtered_witness_reward").css("display", "table-row");
});
});
function getInviteWithForm() {
  let code = $('#invite_secret').val();
let resultWifToPublic = viz.auth.wifToPublic(code);
viz.api.getInviteByKey(resultWifToPublic, function(err, result) {
if (!err) {
if (result.receiver === '') {
  $('#invite_code_data').html(`Баланс: ${result.balance}, создатель: <a href="https://dpos.space/viz/profiles/${result.creator}" target="_blank">${result.creator}</a>.`)
} else {
  $('#invite_code_data').html(`Получил инвайт-код (чек): <a href="https://dpos.space/viz/profiles/${result.receiver}" target="_blank">${result.receiver}</a>.`)
}

}
});
}

