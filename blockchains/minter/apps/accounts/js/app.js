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
function bipToAuth(login, address) {
    if (localStorage.getItem('minter_users')&& localStorage.getItem('minter_users').indexOf(login) > -1) {
window.alert('Такой логин уже есть. Введите иной.');
return;
    }
let auth_key = parseInt(new Date().getTime()/1000) + address + '_dpos.space_minter';
const txParams = {
    type: TX_TYPE.SEND,
    data: {
        to: 'Mx0000000000000000000000000000000000000000',
        value: 0,
        coin: 0, // coin id
    },
    gasCoin: 0, // coin id
    payload: auth_key
    ,
};
let link = prepareLink(txParams);
$.fancybox.open(`<p id="message"><strong>Пожалуйста, перейдите по этой ссылке для авторизации и подтвердите транзакцию: <a href="${link}" target="_blank">${link}</a>.</strong></p>`);
var intervalID = setInterval(async function() {
    let from = address.slice(2);
    let users = [];
    let response = await axios.get(`/transactions?query=tags.tx.coin_id%3D%270%27%20and%20tags.tx.from%3D%27${from}%27%20and%20tags.tx.to%3D%270000000000000000000000000000000000000000%27%20and%20tags.tx.type%3D%2701%27&page=1&per_page=30`);
    let res = response.data.transactions;
    for (let tr of res) {
    let memo = decodeURIComponent(escape(window.atob(tr.payload)));
    if (memo === auth_key) {
let user = {login, type: 'bip.to', address};
localStorage.setItem("minter_current_user", JSON.stringify(user));
users.push(user);
localStorage.setItem("minter_users", JSON.stringify(users));
document.getElementById('message').innerHTML = (`<strong>Ok. Вы авторизованы.</strong>`);
        clearInterval(intervalID);
return;
}
    }
}, 5000)

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