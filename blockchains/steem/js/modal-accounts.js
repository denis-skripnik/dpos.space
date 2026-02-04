function saveAccount() {
    let login = $('#login').val();
    let posting_key = $('#posting_key').val();
    let active_key = $('#active_key').val();
    steem.api.getAccounts([login], function(err, res) {
    if (!err && res.length > 0) {
        let acc = res[0];
let posting = '';
        if (posting_key) {
    const public_wif = steem.auth.wifToPublic(posting_key);
let posting_public_keys = [];
for (key of acc.posting.key_auths) {
posting_public_keys.push(key[0]);
}
if (posting_public_keys.includes(public_wif)) {
posting = sjcl.encrypt('dpos.space_steem_' + login + '_postingKey', posting_key);
}
}
let active = '';
if (active_key) {
    const public_wif = steem.auth.wifToPublic(active_key);
let active_public_keys = [];
for (key of acc.active.key_auths) {
active_public_keys.push(key[0]);
}
if (active_public_keys.includes(public_wif)) {
	active = sjcl.encrypt('dpos.space_steem_' + login + '_activeKey', active_key);
}
}

if (!users) {
users = [];
}
if (!localStorage.getItem('steem_users')|| localStorage.getItem('steem_users').indexOf(login) === -1) {
if (posting && active) {
    let acc_data = {login, posting, active};
    localStorage.setItem("steem_current_user", JSON.stringify(acc_data));
users.push(acc_data);
localStorage.setItem("steem_users", JSON.stringify(users));
$('form input[type="text"], form input[type="password"]').val('');
$('#auth_msg').html('Аккаунт добавлен.');
selectAccount();
} else if (posting && !active) {
let acc_data = {login, posting};
    localStorage.setItem("steem_current_user", JSON.stringify(acc_data));
    users.push(acc_data);
    localStorage.setItem("steem_users", JSON.stringify(users));
    $('form input[type="text"], form input[type="password"]').val('');
    $('#auth_msg').html('Аккаунт добавлен.');
    selectAccount();
} else if (!posting) {
    $('#auth_msg').html('Не введён posting ключ');
}
} else {
    $('#auth_msg').html('Аккаунт '+ login + ' уже добавлен. Если вы хотите изменить ключ, просьба сначала удалить его, а потом добавить.');
}
} else {
$('#auth_msg').html('Вероятно, аккаунт не существует. Просьба проверить введённый логин.');
}
});
}