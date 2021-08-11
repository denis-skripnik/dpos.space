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



$('#send_invites_data').click(function() {
let invites_count = $('#invites_count').val();
let invites_amount = parseFloat($('#invites_amount').val());
invites_amount = invites_amount.toFixed(3) + ' VIZ';
let invites = [];
let operations = [];
for (let c = 0; c < invites_count; c++) {
invites[c] = pass_gen();
let pub_wif = viz.auth.wifToPublic(invites[c]);
operations.push(['create_invite', {'creator':viz_login,'balance':invites_amount,'invite_key':pub_wif}]);
}
if(current_user.type && current_user.type === 'vizonator') {
    window.alert('Операция не поддерживается расширением Vizonator. Просьба выбрать аккаунт, авторизованный при помощи ключей на dpos.space.');
    return;
    }    
viz.broadcast.send({extensions: [], operations}, [active_key], function(err, res) {
if (!err) {
    window.alert('Чеки созданы.');
    $('#result_invites').append(invites.join('\r\n'));
    $('#result_invites').append(`
`);
} else {
    window.alert('Ошибка: ' + err);
}
});
});

$('#claim_invites_balance').click(function() {
let invites = $('#result_invites').val().split('\n');
let operations = [];
for (let invite of invites) {
if (invite !== '') {
    operations.push(['claim_invite_balance', {'initiator':viz_login,'receiver':viz_login,'invite_secret':invite}]);
}
}
if(current_user.type && current_user.type === 'vizonator') {
    window.alert('Операция не поддерживается расширением Vizonator. Просьба выбрать аккаунт, авторизованный при помощи ключей на dpos.space.');
    return;
    }    
viz.broadcast.send({extensions: [], operations}, [active_key], function(err, res) {
if (!err) {
window.alert('Чеки использованы на баланс.');
} else {
    window.alert('Ошибка: ' + err);
}
    });
});

$('#use_invites_balance').click(function() {
    let invites = $('#result_invites').val().split('\n');
    let operations = [];
    for (let invite of invites) {
    if (invite !== '') {
        operations.push(['use_invite_balance', {'initiator':viz_login,'receiver':viz_login,'invite_secret':invite}]);
    }
    }
    if(current_user.type && current_user.type === 'vizonator') {
        window.alert('Операция не поддерживается расширением Vizonator. Просьба выбрать аккаунт, авторизованный при помощи ключей на dpos.space.');
        return;
        }    
    viz.broadcast.send({extensions: [], operations}, [active_key], function(err, res) {
    if (!err) {
    window.alert('Чеки использованы в соц. капитал.');
    } else {
        window.alert('Ошибка: ' + err);
    }
        });
    });