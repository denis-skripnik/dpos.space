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

function load_balance(account, active_key) {
	steem.api.getAccounts([account], function(err, result){
 if (!err) {
 result.forEach(function(acc) {
steem.api.getDynamicGlobalProperties(function(error, res) {
if (!error) {
let tvfs = parseFloat(res.total_vesting_fund_steem);
let tvsh = parseFloat(res.total_vesting_shares);
let steem_per_vests = 1000000 * tvfs / tvsh;

// Конвертация VESTS в STEEM POWER
let sp = parseFloat(acc.vesting_shares) / 1000000 * steem_per_vests;
sp = sp.toFixed(6);
sp = parseFloat(sp);
let received_sp = parseFloat(acc.received_vesting_shares) / 1000000 * steem_per_vests;
received_sp = received_sp.toFixed(6);
received_sp = parseFloat(received_sp);
let delegated_sp = parseFloat(acc.delegated_vesting_shares) / 1000000 * steem_per_vests;
delegated_sp = delegated_sp.toFixed(6);
delegated_sp = parseFloat(delegated_sp);
 
$(".steem_balance").html(new Number(parseFloat(acc.balance)).toFixed(3));
 $(".sbd_balance").html(new Number(parseFloat(acc.sbd_balance)).toFixed(3));
 $(".steem_vesting_shares").html(sp);
$(".received_vesting_shares_result").html(received_sp);
$(".delegated_vesting_shares_result").html(delegated_sp);

const timezoneOffset = (new Date()).getTimezoneOffset() * 60000;
steem.api.getVestingDelegations(account, '', 100, function(err, res) {
  //console.log(err, res);
  if ( ! err) {
var vesting_shares_amount = '';
  var body_delegated_vesting_shares = '';
  res.forEach(function(item) {
vesting_shares_amount = parseFloat(item.vesting_shares) / 1000000 * steem_per_vests;
vesting_shares_amount = vesting_shares_amount.toFixed(6);
vesting_shares_amount = parseFloat(vesting_shares_amount);
let min_delegation_time = Date.parse(item.min_delegation_time);
let min_delegation_datetime = date_str(min_delegation_time - timezoneOffset, true, false, true);
body_delegated_vesting_shares = '<tr id="delegated_vesting_shares_' + item.delegatee + '"><td><a href="/dev/steem/profiles/' + item.delegatee + '" target="_blank">@' + item.delegatee + '</a></td><td>' + vesting_shares_amount + '</td><td>' +  min_delegation_datetime + '</td><td><input type="button" id="cancel_delegated_vesting_shares_' + item.delegatee + '" value="Отменить делегирование"></td></tr>';
		jQuery("#body_delegated_vesting_shares").append(body_delegated_vesting_shares);
 $('#cancel_delegated_vesting_shares_' + item.delegatee).click(function(){
steem.broadcast.delegateVestingShares(active_key, account, item.delegatee, '0.000000 VESTS', function(err, result) {
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

var full_vesting = (sp - delegated_sp + received_sp).toFixed(6);
$("#full_vesting").html(full_vesting);

 $("#cancel_vesting_withdraw").click(function(){
steem.broadcast.withdrawVesting(active_key, account, '0.000000 VESTS', function(err, result) {
  if (!err) {
window.alert('Вывод отменён.');
$('#info_vesting_withdraw').css('display', 'none');
  } else {
window.alert(err);
  }
});
}); // end subform

var vesting_withdraw_rate = parseFloat(acc.vesting_withdraw_rate) / 1000000 * steem_per_vests;
vesting_withdraw_rate = vesting_withdraw_rate.toFixed(6);
vesting_withdraw_rate = parseFloat(vesting_withdraw_rate);
$("#vesting_withdraw_rate").html(vesting_withdraw_rate);
var nvwithdrawal = Date.parse(acc.next_vesting_withdrawal);
$("#nvwithdrawal").html(nvwithdrawal);
var next_vesting_withdrawal = date_str(nvwithdrawal-(new Date().getTimezoneOffset()*60000),true,false,true);
$("#next_vesting_withdrawal").html(next_vesting_withdrawal);
var full_vesting_withdraw = (vesting_withdraw_rate*13).toFixed(6) + ' SP';
$("#full_vesting_withdraw").html(full_vesting_withdraw);
if (full_vesting_withdraw !== '0.000000 SP') {
jQuery("#info_vesting_withdraw").css("display", "block");
}

var max_vesting_withdraw = (sp - delegated_sp - parseFloat(full_vesting_withdraw)).toFixed(6);
$("#max_vesting_withdraw_result").html(new Number(parseFloat(max_vesting_withdraw)).toFixed(6));

  $("#max_vesting_withdraw").click(function(){
 $('#action_vesting_withdraw_amount').val(new Number(parseFloat(max_vesting_withdraw)).toFixed(6));
  });
 $("#action_vesting_withdraw_start").click(function(){
var action_vesting_withdraw_amount = parseFloat($('#action_vesting_withdraw_amount').val());
let withdraw_vests = action_vesting_withdraw_amount * 1000000 / steem_per_vests;
withdraw_vests =  withdraw_vests.toFixed(6) + ' VESTS';
steem.broadcast.withdrawVesting(active_key, account, withdraw_vests, function(err, result) {
if (!err) {
window.alert('Вывод на ' + action_vesting_withdraw_amount + ' начат.');
location.reload();
} else {
window.alert('Ошибка: ' + err);
}
  });

}); // end subform

  $("#max_vesting_transfer").click(function(){
 $('#action_steem_transfer_amount').val(new Number(parseFloat(acc.balance)).toFixed(3));
  });
 $("#action_steem_transfer_start").click(function(){
 var action_steem_transfer_to = $('#action_steem_transfer_to').val();
 var action_steem_transfer_amount = $('#action_steem_transfer_amount').val();
 action_steem_transfer_amount = parseFloat(action_steem_transfer_amount);
 action_steem_transfer_amount = action_steem_transfer_amount.toFixed(3) + ' STEEM';
 var action_steem_transfer_memo = $('#action_steem_transfer_memo').val();
var transfer_to_vesting = document.getElementById('transfer_to_vesting');

if (transfer_to_vesting.checked) {
steem.broadcast.transferToVesting(active_key, account, action_steem_transfer_to, action_steem_transfer_amount, function(err, result) {
if (!err) {
window.alert('Вы перевели ' + action_steem_transfer_amount + ' пользователю ' + action_steem_transfer_to + ' в SP.');
location.reload();
} else {
window.alert('Ошибка: ' + err);
}
  });
} else {
	steem.broadcast.transfer(active_key, account, action_steem_transfer_to, action_steem_transfer_amount, action_steem_transfer_memo, function(err, result) {
if (!err) {
window.alert('Вы перевели ' + action_steem_transfer_amount + ' пользователю ' + action_steem_transfer_to + '.');
location.reload();
} else {
window.alert('Ошибка: ' + err);
}
  });
}
}); // end subform
  $("#max_to_shares_transfer").click(function(){
 $('#action_to_shares_transfer_amount').val(new Number(parseFloat(acc.balance)).toFixed(3));
  });
 $("#action_to_shares_transfer_start").click(function(){
 var action_to_shares_transfer_amount = parseFloat($('#action_to_shares_transfer_amount').val());
 action_to_shares_transfer_amount = action_to_shares_transfer_amount.toFixed(3) + ' STEEM';
 steem.broadcast.transferToVesting(active_key, account, account, action_to_shares_transfer_amount, function(err, result) {
if (!err) {
window.alert('Вы успешно перевели ' + action_to_shares_transfer_amount + ' steem в SP своего аккаунта.');
location.reload();
} else {
window.alert('Ошибка: ' + err);
}
  });
}); // end subform

var max_vesting_deligate = (sp - delegated_sp).toFixed(6);
$("#max_vesting_deligate").html(max_vesting_deligate);

  $("#max_vesting_delegate").click(function(){
 $('#action_vesting_delegate_amount').val(new Number(parseFloat(max_vesting_deligate)).toFixed(6));
  });
 $("#action_vesting_delegate_start").click(function(){
 var action_vesting_delegate_to = $('#action_vesting_delegate_to').val();
 var action_vesting_delegate_amount = parseFloat($('#action_vesting_delegate_amount').val());
 let delegate_vests = action_vesting_delegate_amount * 1000000 / steem_per_vests;
 delegate_vests = delegate_vests.toFixed(6) + ' VESTS';
 steem.broadcast.delegateVestingShares(active_key, account, action_vesting_delegate_to, delegate_vests, function(err, result) {
if (!err) {
window.alert('Вы делегировали ' + action_vesting_delegate_amount + '.');
location.reload();
} else {
window.alert('Ошибка: ' + err);
}
  });

}); // end subform

var to = getUrlVars()['to'];
var amount = getUrlVars()['amount'];
var memo = getUrlVars()['memo'];

if (to && amount && memo) {
$(document).ready(function(){
$("#steem_transfer_modal").modal('show');
$('#action_steem_transfer_to').val(to).prop('readonly', true);
$('#action_steem_transfer_amount').val(amount).prop('readonly', true);
$('#action_steem_transfer_memo').val(decodeURIComponent(memo)).prop('readonly', true);
});
} else if (to && memo) {
$(document).ready(function(){
$("#steem_transfer_modal").modal('show');
$('#action_steem_transfer_to').val(to).prop('readonly', true);
$('#action_steem_transfer_memo').val(decodeURIComponent(memo)).prop('readonly', true);
}); 
} else if (amount && memo) {
$(document).ready(function(){
$("#steem_transfer_modal").modal('show');
$('#action_steem_transfer_amount').val(amount).prop('readonly', true);
$('#action_steem_transfer_memo').val(decodeURIComponent(memo)).prop('readonly', true);
});
} else if (to && amount) {
$(document).ready(function(){
$("#steem_transfer_modal").modal('show');
$('#action_steem_transfer_to').val(to).prop('readonly', true);
$('#action_steem_transfer_amount').val(amount).prop('readonly', true);
});
} else if (to) {
$(document).ready(function(){
$("#steem_transfer_modal").modal('show');
$('#action_steem_transfer_to').val(to).prop('readonly', true);
});
} else if (amount) {
$(document).ready(function(){
$("#steem_transfer_modal").modal('show');
$('#action_steem_transfer_amount').val(amount).prop('readonly', true);
});
} else if (memo) {
$(document).ready(function(){
$("#steem_transfer_modal").modal('show');
$('#action_steem_transfer_memo').val(decodeURIComponent(memo)).prop('readonly', true);
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
  }).replace(/ (@[^< \.,]+)/gi, user => ` <a href="/dev/steem/profiles/${user.trim().slice(1)}">${user.trim()}</a>`)
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
  load_balance(steem_login, active_key);

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

    const data = await steem.api.getAccountHistoryAsync(steem_login, from, limitReal);

    data.sort(accountHistoryCompareDate);

    for (const operation of data) {
      const op = operation[1].op;
      isValidElement = (op[1].from && op[1].to && op[1].amount) ||
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

console.dir(result);

appendWalletData(result);
}
}

function appendWalletData(items) {
  steem.api.getDynamicGlobalProperties(function(error, res) {
    if (!error) {
    let tvfs = parseFloat(res.total_vesting_fund_steem);
    let tvsh = parseFloat(res.total_vesting_shares);
    let steem_per_vests = 1000000 * tvfs / tvsh;

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
      var memo = 'Перевод в SP.';
    } else {
      var memo = '';
    }
    jQuery("#transfer_history_tbody").append('<tr class="filtered ' + from + '"><td>' + transfer_datetime + '</td>\
<td><a href="/dev/steem/profiles/' + from + '" target="_blank">@' + from + '</a></td>\
<td><a href="/dev/steem/profiles/' + to + '" target="_blank">@' + to + '</a></td>\
<td>' + amount + '</td>\
<td>' + memo + '</td>\
</tr>');
  } else if (op[0] === 'curation_reward') {
    var author = op[1].comment_author;
    var permlink = op[1].comment_permlink;
    var curator = op[1].curator;
    var reward = parseFloat(op[1].reward) / 1000000 * steem_per_vests;
    reward = reward.toFixed(6) + ' SP';
    var memo = 'Кураторская награда за пост <a href="https://steemit.com/@' + author + '/' + permlink + '" target="_blank">https://steemit.com/@' + author + '/' + permlink + '</a>';
    jQuery("#transfer_history_tbody").append('<tr class="filtered_curation_reward"><td>' + transfer_datetime + '</td>\
<td><a href="/dev/steem/profiles/' + author + '" target="_blank">@' + author + '</a></td>\
<td><a href="/dev/steem/profiles/' + curator + '" target="_blank">@' + curator + '</a></td>\
<td>' + reward + '</td>\
<td>' + memo + '</td>\
</tr>');
  } else if (op[0] === 'author_reward') {
    var from = 'пул steem';
    var author = op[1].author;
    var permlink = op[1].permlink;
var sbd_payout = op[1].sbd_payout;
var steem_payout = op[1].steem_payout;
var vesting_payout = parseFloat(op[1].vesting_payout) / 1000000 * steem_per_vests;
vesting_payout = vesting_payout.toFixed(6) + ' SP';
    var memo = 'Авторская награда за пост <a href="https://steemit.com/@' + author + '/' + permlink + '" target="_blank">https://steemit.com/@' + author + '/' + permlink + '</a>';
    jQuery("#transfer_history_tbody").append('<tr class="filtered_author_reward"><td>' + transfer_datetime + '</td>\
<td>' + from + '</td>\
<td><a href="/dev/steem/profiles/' + author + '" target="_blank">@' + author + '</a></td>\
<td>' + sbd_payout + ', ' + steem_payout + ' и ' + vesting_payout + '</td>\
<td>' + memo + '</td>\
</tr>');
  } else if (op[0] === 'comment_benefactor_reward') {
    var author = op[1].author;
    var permlink = op[1].permlink;
    var benefactor = op[1].benefactor;
    var sbd_payout = op[1].sbd_payout;
    var steem_payout = op[1].steem_payout;
    var vesting_payout = parseFloat(op[1].vesting_payout) / 1000000 * steem_per_vests;
    vesting_payout = vesting_payout.toFixed(6) + ' SP';
    var memo = 'Бенефициарская награда за пост <a href="https://steemit.com/@' + author + '/' + permlink + '" target="_blank">https://steemit.com/@' + author + '/' + permlink + '</a>';
    jQuery("#transfer_history_tbody").append('<tr class="filtered_content_benefactor_reward"><td>' + transfer_datetime + '</td>\
<td><a href="/dev/steem/profiles/' + author + '" target="_blank">@' + author + '</a></td>\
<td><a href="/dev/steem/profiles/' + benefactor + '" target="_blank">@' + benefactor + '</a></td>\
<td>' + sbd_payout + ', ' + steem_payout + ' и ' + vesting_payout + '</td>\
<td>' + memo + '</td>\
</tr>');
  } else if (op[0] === 'producer_reward') {
    var from = 'пул steem';
    var witness = op[1].producer;
    var shares = parseFloat(op[1].vesting_shares) / 1000000 * steem_per_vests;
    shares = shares.toFixed(6) + ' SP';
    var memo = 'Награда делегата.';
    jQuery("#transfer_history_tbody").append('<tr class="filtered_witness_reward"><td>' + transfer_datetime + '</td>\
<td>' + from + '</td>\
<td><a href="/dev/steem/profiles/' + witness + '" target="_blank">@' + witness + '</a></td>\
<td>' + shares + '</td>\
<td>' + memo + '</td>\
</tr>');
  }

});
}
});
}

$( document ).ready(function() {
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
  
  $("#author_reward").click(function ()
  {
      $("#transfer_history_tbody tr").css("display", "none");
      $("#transfer_history_tbody .filtered_author_reward").css("display", "table-row");
  });
  
  
  $("#curator_reward").click(function ()
  {
      $("#transfer_history_tbody tr").css("display", "none");
      $("#transfer_history_tbody .filtered_curation_reward").css("display", "table-row");
  });
  
  $("#benefactor_reward").click(function ()
  {
      $("#transfer_history_tbody tr").css("display", "none");
      $("#transfer_history_tbody .filtered_content_benefactor_reward").css("display", "table-row");
  });
  
  $("#witness_reward").click(function ()
  {
      $("#transfer_history_tbody tr").css("display", "none");
      $("#transfer_history_tbody .filtered_witness_reward").css("display", "table-row");
  });
});