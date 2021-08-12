function saveAccount() {
    let login = $('#login').val();
    let seed = $('#seed').val();
    const isValid = minterWallet.isValidMnemonic(seed);
if (isValid === false) {
    window.alert('Seed фраза невалидна. Проверьте её, пожалуйста');
return;
}
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


$(document).ready(function() {
    var url = document.location.pathname;
    var allowed_chains = {};
    for (let el in localStorage) {
        let chain = el.split('_')[0];
        if (el.indexOf('users') > -1 && localStorage[el].indexOf('seed') > -1 && url.indexOf(chain) === -1) {
$('#chains_list').append(`<option value="${chain}">${chain.toUpperCase()}</option>`);
allowed_chains[chain] = localStorage[el];
}
}

// Выбор аккаунта для импорта:
$('#chains_list').change(function() {
    let chain = $('#chains_list').val();
if (chain !== '') {
let users = JSON.parse(allowed_chains[chain]);
let users_text = '';
let id = 0;
for (let user of users) {
    users_text += `<option value="${id}">${user.login}</option>
`;
id++;
}
$('[name="select_chain_accounts"]').html(`<option value="">Выберите аккаунт</option>
${users_text}`);
}
});

// Импорт:
$('#import_chain_account').click(function() {
    let chain = $('#chains_list').val();
let account = parseInt($('[name="select_chain_accounts"]').val());
if (chain !== '' && account !== '') {
    let user = JSON.parse(allowed_chains[chain])[account];
    user.importFrom = chain;
        localStorage.setItem("minter_current_user", JSON.stringify(user));
    let existing_accounts = 0;
    for (let acc of users) {
    if (acc.login === user.login  || acc.login === user.login && acc.seed === user.seed || acc.login !== user.login && acc.seed === user.seed) {
        existing_accounts += 1;
    }
}
if (existing_accounts === 0) {
    users.push(user);
    localStorage.setItem("minter_users", JSON.stringify(users));
window.alert('Аккаунт добавлен.');
} else {
    window.alert('Имя или SEED фраза есть в списке существующих.');
}
}
});
});