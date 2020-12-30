$(document).ready(function() {
    if (viz_login) {
    $('input[name=sender]').val(viz_login);
    }
});

function sendData(operations, variant) {
    variant = parseInt(variant) + 1;
    var q = window.confirm('Вы действительно хотите проголосовать за вариант №' + variant + '?');
    if (q === true) {
    viz.broadcast.send({extensions: [], operations}, [active_key], function(err, res) {
if (!err) {
    window.alert('Вы успешно проголосовали.');
} else {
    window.alert('Ошибка: ' + JSON.stringify(err));
}
    });
    }
}

function submitVoteing(permlink, sender, answer) {
    sender = sender.toLowerCase();
    let memo_array = {};
memo_array.contractName = "viz-votes";
memo_array.contractAction = "voteing";
memo_array.contractPayload = {};
memo_array.contractPayload.votePermlink = permlink;
memo_array.contractPayload.answerId = answer;
let memo = JSON.stringify(memo_array);
    let data_url = [];
    data_url.push(["custom",{"required_auths":[],          "required_regular_auths": [sender],"id":"viz-votes","json":memo}]);
    let str_data_url = JSON.stringify(data_url);
        if (sender && answer) {
        if (viz_login && posting_key) {
            sendData(data_url, answer);
        } else {
            window.open("https://viz.dpos.space/viz-sign/?user=" + sender + "&tr=" + str_data_url);
        }
        } else if (!sender) {
window.alert('Вы не ввели логин');
} else if (!answer) {
    window.alert('Вы не добавили ответы');
}
}
