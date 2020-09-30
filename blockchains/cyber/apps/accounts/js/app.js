function saveAccount() {
    let login = $('#login').val();
    let seed = $('#seed').val();
let crypt_seed = sjcl.encrypt('dpos.space_cyber_' + login + '_seed', seed);

if (!users) {
users = [];
}
if (!localStorage.getItem('cyber_users')|| localStorage.getItem('cyber_users').indexOf(login) === -1) {
if (seed) {
    let acc_data = {login, seed: crypt_seed};
    localStorage.setItem("cyber_current_user", JSON.stringify(acc_data));
users.push(acc_data);
localStorage.setItem("cyber_users", JSON.stringify(users));
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
const create = keypair.create();
$('#account_create_result').css('display', 'block');
$('#new_seed').val(create.secret);
$('#new_acc_data').html(`<h3>Другие данные</h3>
<ul><li>Адрес: cyber${create.address}</li>
<li>Приватный ключ: ${create.privateKey}</li>
<li>Публичный ключ: cyberpub${create.publicKey}</li>
</ul>`);
}