function saveAccount() {
    let login = $('#login').val();
    let seed = $('#seed').val();
let crypt_seed = sjcl.encrypt('dpos.space_minter_' + login + '_seed', seed);

if (!users) {
users = [];
}
if (!localStorage.getItem('minter_users')|| localStorage.getItem('minter_users').indexOf(login) === -1) {
if (seed) {
    let acc_data = {login, seed: crypt_seed};
    localStorage.setItem("minter_current_user", JSON.stringify(acc_data));
users.push(acc_data);
localStorage.setItem("minter_users", JSON.stringify(users));
$('form input[type="text"], form textarea').val('');
$('#auth_msg').html('Аккаунт добавлен.');
selectAccount();
} else {
    $('#auth_msg').html('Не введена SEED фраза');
}
} else {
    $('#auth_msg').html('Аккаунт '+ login + ' уже добавлен. Если вы хотите изменить ключ, просьба сначала удалить его, а потом добавить.');
}
}

function createAccount() {
    const wallet = minterWallet.generateWallet();
    const pk = wallet.getPrivateKeyString(wallet._privKey).slice(2);
    $('#account_create_result').css('display', 'block');
$('#new_seed').val(wallet._mnemonic);
$('#new_acc_data').html(`<h3>Другие данные</h3>
<ul>
<li>Приватный ключ: ${String(pk)}</li>
</ul>`);
}