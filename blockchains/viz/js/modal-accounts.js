function saveAccount() {
    let login = $('#login').val();
    let regular_key = $('#regular_key').val();
    let active_key = $('#active_key').val();
    viz.api.getAccounts([login], function(err, res) {
    if (!err && res.length > 0) {
        let acc = res[0];
let regular = '';
        if (regular_key) {
    const public_wif = viz.auth.wifToPublic(regular_key);
let regular_public_keys = [];
for (key of acc.regular_authority.key_auths) {
    regular_public_keys.push(key[0]);
}
if (regular_public_keys.includes(public_wif)) {
regular = sjcl.encrypt('dpos.space_viz_' + login + '_regularKey', regular_key);
}
}
let active = '';
if (active_key) {
    const public_wif = viz.auth.wifToPublic(active_key);
let active_public_keys = [];
for (key of acc.active_authority.key_auths) {
active_public_keys.push(key[0]);
}
if (active_public_keys.includes(public_wif)) {
	active = sjcl.encrypt('dpos.space_viz_' + login + '_activeKey', active_key);
}
}

if (!users) {
users = [];
}
if (!localStorage.getItem('viz_users')|| localStorage.getItem('viz_users').indexOf(login) === -1) {
if (regular && active) {
    let acc_data = {login, regular, active};
    localStorage.setItem("viz_current_user", JSON.stringify(acc_data));
users.push(acc_data);
localStorage.setItem("viz_users", JSON.stringify(users));
$('form input[type="text"], form input[type="password"]').val('');
$('#auth_msg').html('Аккаунт добавлен.');
selectAccount();
} else if (regular && !active) {
let acc_data = {login, regular};
    localStorage.setItem("viz_current_user", JSON.stringify(acc_data));
    users.push(acc_data);
    localStorage.setItem("viz_users", JSON.stringify(users));
    $('form input[type="text"], form input[type="password"]').val('');
    $('#auth_msg').html('Аккаунт добавлен.');
    selectAccount();
} else if (!regular) {
    $('#auth_msg').html('Не введён regular ключ');
}
} else {
    $('form input[type="text"], form input[type="password"]').val('');
    $('#auth_msg').html('Аккаунт '+ login + ' уже добавлен. Если вы хотите изменить ключ, просьба сначала удалить его, а потом добавить.');
}
} else {
$('#auth_msg').html('Вероятно, аккаунт не существует. Просьба проверить введённый логин.');
}
});
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
