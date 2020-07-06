var hash = location.hash.substring(1);

function allworkerVotes(author, permlink, start_voter) {
    golos.api.getWorkerRequestVotes(author, permlink, start_voter, 50, function(err, result) {
        if (!err) {
                        let end_voter = '';
            for (let vote in result) {
      if (start_voter !== '' && vote > 0) {
                $('#request_votes').append(`<li><a href="https://dpos.space/golos/profiles/${result[vote].voter}" target="_blank">@${result[vote].voter}</a> проголосовал на ${result[vote].vote_percent / 100}%</li>`);
                end_voter = result[vote].voter;
                } else if (start_voter === '') {
                $('#request_votes').append(`<li><a href="https://dpos.space/golos/profiles/${result[vote].voter}" target="_blank">@${result[vote].voter}</a> проголосовал на ${result[vote].vote_percent / 100}%</li>`);
                end_voter = result[vote].voter;
            }
        }
        if (result.length < 50 && start_voter !== '') {
            return false;;
        } else {
        allworkerVotes(author, permlink, end_voter);
        }
    } else {
            console.log(JSON.stringify(err));
        }
        });
}

function committeeRequestModal(start_author, start_permlink) {
    const timezoneOffset = (new Date()).getTimezoneOffset() * 60000;
    let query = {limit:1,start_author,start_permlink};
    golos.api.getWorkerRequests(query, "by_created", !0, function(err, res) {
    if (!err) {
        let result = res[0];
        let title = result.post.title;
if (title === "") {
    title = `от ${result.post.author}`;
}
        $('#committee_request_title').html(title);
        let status = result.state;
        let states = [];
        states["created"] = "Голосование";
        states['payment'] = "Выплачивается";
        states['payment_complete'] = "Выплачено";
        states['closed_by_author'] = "Отменено автором";
        states['closed_by_expiration'] = "Отменена по времени (не набрала % для прохода)";
        states['closed_by_voters'] = "Отменена по голосам (заминусовали)";
$('#request_status').html(states[status]);
$('#request_creator').html(`<a href="https://dpos.space/golos/profiles/${result.post.author}" target="_blank">${result.post.author}</a>`);
$('#request_worker').html(`<a href="https://dpos.space/golos/profiles/${result.worker}" target="_blank">${result.worker}</a>`);
let url = `https://golos.id/@${result.post.author}/${result.post.permlink}`;
$('#request_link').html(`<a href="${url}" target="_blank">${url}</a>`);
let required_amount_min = parseFloat(result.required_amount_min) + ' GOLOS';
$('#request_min').html(required_amount_min);
let required_amount_max = parseFloat(result.required_amount_max) + ' GOLOS';
$('#request_max').html(required_amount_max);
let start_unixtime = Date.parse(result.created);
let start_time = date_str(start_unixtime - timezoneOffset, true, false, true);
$('#request_start_time').html(start_time);
let end_unixtime = (start_unixtime / 1000) + result.duration;
let end_time = date_str(end_unixtime*1000 - timezoneOffset, true, false, true);
$('#request_end_time').html(end_time);
$('#request_duration').html(result.duration / 86400);
let vest_reward = '';
if (result.vest_reward == true) {
    vest_reward = 'да';
} else {
    vest_reward = 'нет';
}
$('#request_vest_reward').html(vest_reward);
if (status === 'payment_complete') {
    let rshares_amount_pct = parseInt(result.stake_rshares * 100 / result.stake_total);
    rshares_amount_pct = !isNaN(rshares_amount_pct) ? rshares_amount_pct : 0;
    let max_amount = parseFloat(result.required_amount_max.split(" ")[0]);
    let payed_amount = max_amount * rshares_amount_pct / 100;
    $('#request_payout_amount').html(payed_amount + ' GOLOS');
$('#if_status45').css('display', 'list-item');
} else {
    $('#if_status45').css('display', 'none');
}
if (status === 'payment') {
$('#request_remain_payout_amount').html(parseFloat(result.remain_payout) + ' GOLOS');
$('#if_status4').css('display', 'list-item');
} else {
    $('#if_status4').css('display', 'none');
}

if (status === 'created') {
    $('input[name=vote_request_author]').val(result.post.author);
    $('input[name=vote_request_permlink]').val(result.post.permlink);
    $('#if_request_status_created').css('display', 'block');
} else {
    $('#if_request_status_created').css('display', 'none');
}

$('#request_votes').html('');
allworkerVotes(result.post.author, result.post.permlink, '');
}
    });
}

if (hash !== '') {
$.fancybox.open({
	src  : '#committee_request',
	opts : {
		afterShow : function( instance, current ) {
            
            let request_data = hash.split('/');
            let request_author = request_data[0];
            let request_permlink = request_data[1];
            committeeRequestModal(request_author, request_permlink);
        }
	}
});
}

function getCommittteeRequests(status) {
    let query = {limit:100,select_states:[status]};
    golos.api.getWorkerRequests(query, "by_created", !0, function(err, result) {
if (result) {
    const timezoneOffset = (new Date()).getTimezoneOffset() * 60000;
    for (let request of result) {
let title = request.post.title;
if (title === '') {
    title = `Заявка от ${request.post.author}`;
}
let states = [];
states["created"] = "Голосование";
states['payment'] = "Выплачивается";
states['payment_complete'] = "Выплачено";
states['closed_by_author'] = "Отменено автором";
states['closed_by_expiration'] = "Отменена по времени (не набрала % для прохода)";
states['closed_by_voters'] = "Отменена по голосам (заминусовали)";
let end_unixtime = (Date.parse(request.created) / 1000) + request.duration;
let end_time = date_str(end_unixtime*1000 - timezoneOffset, true, false, true);
$('#committee_requests_' + status).append(`<tr><td><a data-fancybox class="committee_request" data-src="#committee_request" href="javascript:;" data-author="${request.post.author}" data-permlink="${request.post.permlink}">${title}</a></td>
<td><a href="https://dpos.space/golos/profiles/${request.post.author}" target="_blank">${request.post.author}</a></td>
<td><a href="https://dpos.space/viz/profiles/${request.worker}" target="_blank">${request.worker}</a></td>
<td>${states[request.state]}</td>
<td>${end_time}</td>`);
}
}
});
}

  function main() {
    golos.api.getAccounts(['workers'], function(err, result) {
        $('#committee_fund').html(`${result[0].balance} и ${result[0].sbd_balance}`);
        $('input[name=request_max_amount]').on('change',function(){
let token = $('select[name=create_request_token]').val();
let balance = '';
if (token === 'GBG') {
    balance = parseFloat(result[0].sbd_balance);
} else {
    balance = parseFloat(result[0].balance);
}
if($(this).val() > balance){
        window.alert('Сумма заявки не может быть больше 500000 GOLOS. Просим ввести иное значение.');
            }
            });
    });

let all_status = ['created', 'payment', 'payment_complete', 'closed_by_author', 'closed_by_expiration', 'closed_by_voters'];
for (let status of all_status) {
    getCommittteeRequests(status);
}
}
main();

$('#create_request_now').click(function() {
    var q = window.confirm('Вы действительно хотите создать заявку? Эта операция является оплачиваемой. Стоимость смотрите в меню, пункт "блок-эксплорер", раздел "Основные параметры".');
    if (q === true) {
    var post = $('input[name=request_url]').val();
    var post_array = post.split('@')[1];
    var post_data = post_array.split('/');
    golos.api.getContent(post_data[0], post_data[1], 0, function(err, res) {
if (!err && res.author !== '') {
    var worker= $('input[name=request_account]').val();
    var token = $('select[name=create_request_token]').val();
    var reward_amount_min= $('input[name=request_min_amount]').val();
    reward_amount_min = parseFloat(reward_amount_min);
    reward_amount_min = reward_amount_min.toFixed(3) + ' ' + token;
    var reward_amount_max= $('input[name=request_max_amount]').val();
    reward_amount_max = parseFloat(reward_amount_max);
    reward_amount_max = reward_amount_max.toFixed(3) + ' ' + token;
    var duration= 60*60*24*parseFloat($('input[name=request_days]').val());
var vest_reward = $('input[name=create_request_vest_reward]').prop("checked");

    const operations = [
        "worker_request",
        {
            "author": post_data[0],
            "permlink": post_data[1],
            "worker": worker,
            "required_amount_min": reward_amount_min,
            "required_amount_max": reward_amount_max,
            "vest_reward": vest_reward,
            "duration": duration,
            "extensions": []
        }
    ];

   golos.broadcast.send({extensions: [], operations}, [posting_key], function(err, result) {
if (!err) {
    window.alert('Заявка создана.');
} else {
    window.alert('Ошибка: ' + JSON.stringify(err));
}
    });
} else {
    window.alert('Пост не существует, или ошибка соединения с Нодой. Проверьте введённый url.');
}
    });
    }
});

$(document).on('click', '.committee_request', function(e) {
        let request_author = $(this).attr('data-author');
        let request_permlink = $(this).attr('data-permlink');
        history.pushState('', '', document.location.pathname + '#' + request_author + '/' + request_permlink);
committeeRequestModal(request_author, request_permlink);
});

$('#submit_request_vote').click(function() {
    let request_author = $('input[name=vote_request_author]').val();
    let request_permlink = $('input[name=vote_request_permlink]').val();
    let vote_percent = $('input[name=request_percent]').val();
vote_percent = parseFloat(vote_percent) * 100;
vote_percent = parseInt(vote_percent);

const operations = [
    "worker_request_vote",
    {
        "voter": golos_login,
        "author": request_author,
        "permlink": request_permlink,
        "vote_percent": vote_percent,
        "extensions": []
    }
];

golos.broadcast.send({extensions: [], operations}, [posting_key], function(err, result) {
    if (!err) {
        window.alert('Вы успешно проголосовали за заявку.');
    } else {
        window.alert('Ошибка: ' + JSON.stringify(err));
    }
});
});