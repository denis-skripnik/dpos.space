var hash = location.hash.substring(1);
function committeeRequestModal(request_id) {
    var votes_limit=-1; //-1 all, 0 none, >0 limit
    const timezoneOffset = (new Date()).getTimezoneOffset() * 60000;
    $('#committee_request_id').html(request_id);
    viz.api.getCommitteeRequest(request_id, votes_limit, function(err, result) {
if (!err) {
    let status = result.status;
let all_status = ["ожидает голосования", "отменена заявителем", "не набрала доли голосов для принятия решения", "не набрала минимально необходимую сумму указанную в заявке", "заявка одобрена и производятся выплаты", "выплаты по заявке завершены"];
$('#request_status').html(all_status[status]);
$('#request_creator').html(`<a href="https://dpos.space/viz/profiles/${result.creator}" target="_blank">${result.creator}</a>`);
$('#request_worker').html(`<a href="https://dpos.space/viz/profiles/${result.worker}" target="_blank">${result.worker}</a>`);
let url = result.url.split('https://');
$('#request_link').html(`${url[0]}<a href="https://${url[1]}" target="_blank">${url[1]}</a>`);
let required_amount_min = parseFloat(result.required_amount_min) + ' VIZ';
$('#request_min').html(required_amount_min);
let required_amount_max = parseFloat(result.required_amount_max) + ' VIZ';
$('#request_max').html(required_amount_max);
let start_time = date_str(Date.parse(result.start_time) - timezoneOffset, true, false, true);
$('#request_start_time').html(start_time);
let end_time = date_str(Date.parse(result.end_time) - timezoneOffset, true, false, true);
$('#request_end_time').html(end_time);
$('#request_duration').html(result.duration / 86400);
let votes_count = result.votes_count;
if (status > 0) {
let conclusion_time = date_str(Date.parse(result.conclusion_time) - timezoneOffset, true, false, true);
$('#request_conclusion_time').html(conclusion_time);
$('#if_status_12345').css('display', 'list-item');
} else {
    $('#if_status_12345').css('display', 'none');
}
if (status > 2) {
$('#request_conclusion_payout_amount').html(parseFloat(result.conclusion_payout_amount) + ' VIZ');
$('#if_status345').css('display', 'list-item');
} else {
    $('#if_status345').css('display', 'none');
}
if (status > 3) {
$('#request_payout_amount').html(parseFloat(result.payout_amount) + ' VIZ');
$('#if_status45').css('display', 'list-item');
} else {
    $('#if_status45').css('display', 'none');
}
if (status === 4) {
$('#request_remain_payout_amount').html(parseFloat(result.remain_payout_amount) + ' VIZ');
let last_payout_time = date_str(Date.parse(result.last_payout_time) - timezoneOffset, true, false, true);
$('#request_last_payout_time').html(last_payout_time);
$('#if_status4').css('display', 'list-item');
} else {
    $('#if_status4').css('display', 'none');
}
let payout_time = date_str(Date.parse(result.payout_time) - timezoneOffset, true, false, true);
$('#request_payout_time').html(payout_time);

if (status === 0) {
    $('input[name=vote_request_id]').val(result.request_id);
    $('#if_request_status_0').css('display', 'block');
} else {
    $('#if_request_status_0').css('display', 'none');
}

let votes = result.votes;
$('#request_votes').html('');
for (let vote of votes) {
    let vote_datetime = date_str(Date.parse(vote.last_update) - timezoneOffset, true, false, true);
    $('#request_votes').append(`<li>${vote_datetime} <a href="https://dpos.space/viz/profiles/${vote.voter}" target="_blank">@${vote.voter}</a> проголосовал на ${vote.vote_percent / 100}%</li>`);
}
}
    });
}

if (hash !== '') {
$.fancybox.open({
	src  : '#committee_request',
	opts : {
		afterShow : function( instance, current ) {
            
            let request_id = hash;
        committeeRequestModal(request_id);
        }
	}
});
}

function getCommittteeRequests(status) {
viz.api.getCommitteeRequestsList(status, function(err, result) {
for (let id of result) {
    $('#committee_requests_' + status).append(`<li>№<a data-fancybox class="committee_request" data-src="#committee_request" href="javascript:;" data-id="${id}">${id}</a></li>`);
}
  });
}

  function main() {
    viz.api.getDynamicGlobalProperties(function(err, result) {
    $('#committee_fund').html(result.committee_fund);
});

let all_status = [0, 1, 2, 3, 4, 5];
for (let status of all_status) {
    getCommittteeRequests(status);
}
}
main();

$('#create_request_now').click(function() {
    var q = window.confirm('Вы действительно хотите создать новую заявку? Эта операция является платной. Цену можете узнать, зайдя в блок-эксплорер, раздел "основные параметры".')
    if (q == true) {
    var url= $('input[name=request_url]').val();
    var worker= $('input[name=request_account]').val();
    var reward_amount_min= $('input[name=request_min_amount]').val().replace(/,/, '.');
    reward_amount_min = parseFloat(reward_amount_min);
    reward_amount_min = reward_amount_min.toFixed(3) + ' VIZ';
    var reward_amount_max= $('input[name=request_max_amount]').val().replace(/,/, '.');
    reward_amount_max = parseFloat(reward_amount_max);
    reward_amount_max = reward_amount_max.toFixed(3) + ' VIZ';    
    var duration= 60*60*24*parseFloat($('input[name=request_days]').val());
    if(current_user.type && current_user.type === 'vizonator') {
		window.alert('Vizonator не поддерживает данный тип операций. Пожалуйста, выберите другой аккаунт, авторизованный на dpos.space при помощи ключей.');
	return;
	}
    viz.broadcast.committeeWorkerCreateRequest(posting_key, viz_login, url, worker, reward_amount_min, reward_amount_max, duration, function(err, result) {
if (!err) {
    window.alert('Заявка создана.');
} else {
    window.alert('Ошибка: ' + JSON.stringify(err));
}
    });
    }
});


$(document).on('click', '.committee_request', function(e) {
        let request_id = $(this).attr('data-id');
        history.pushState('', '', document.location.pathname + '#' + request_id);
committeeRequestModal(request_id);
});

$('#submit_request_vote').click(function() {
    let request_id = parseInt($('input[name=vote_request_id]').val());
    let vote_percent = $('input[name=request_percent]').val();
vote_percent = parseFloat(vote_percent) * 100;
vote_percent = parseInt(vote_percent);
if(current_user.type && current_user.type === 'vizonator') {
    sendToVizonator('committee_vote_request', {request_id, vote_percent})
return;
}
viz.broadcast.committeeVoteRequest(posting_key, viz_login, request_id, vote_percent, function(err, result) {
    if (!err) {
        window.alert('Вы успешно проголосовали за заявку.');
    } else {
        window.alert('Ошибка: ' + JSON.stringify(err));
    }
});
});

$('input[name=request_max_amount]').on('change',function(){
    if($(this).val()> 500000){
window.alert('Сумма заявки не может быть больше 500000 VIZ. Просим ввести иное значение.');
    }
    });