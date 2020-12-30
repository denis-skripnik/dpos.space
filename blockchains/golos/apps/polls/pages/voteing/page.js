$(document).ready(function() {
    if (golos_login) {
    $('input[name=sender]').val(golos_login);
    }
});

function sendData(operations, variant) {
    variant = parseInt(variant) + 1;
    var q = window.confirm('Вы действительно хотите проголосовать за вариант №' + variant + '?');
    if (q === true) {
    golos.broadcast.send({extensions: [], operations}, [active_key], function(err, res) {
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
memo_array.contractName = "golos-votes";
memo_array.contractAction = "voteing";
memo_array.contractPayload = {};
memo_array.contractPayload.votePermlink = permlink;
memo_array.contractPayload.answerId = answer;
let memo = JSON.stringify(memo_array);
    let data_url = [];
    data_url.push(["custom_json",{"required_auths":[],          "required_posting_auths": [sender],"id":"golos-votes","json":memo}]);
    let str_data_url = JSON.stringify(data_url);
        if (sender && answer) {
        if (golos_login && posting_key) {
            sendData(data_url, answer);
        } else {
            window.open("https://gropox.github.io/sign/?user=" + sender + "&tr=" + str_data_url);
        }
        } else if (!sender) {
window.alert('Вы не ввели логин');
} else if (!answer) {
    window.alert('Вы не добавили ответы');
}
}
