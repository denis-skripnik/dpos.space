function saveAccount() {
    let login = $('#login').val();
    let posting_key = $('#posting_key').val();
    let active_key = $('#active_key').val();
    golos.api.getAccounts([login], function(err, res) {
    if (!err && res.length > 0) {
        let acc = res[0];
let posting = '';
        if (posting_key) {
    const public_wif = golos.auth.wifToPublic(posting_key);
let posting_public_keys = [];
for (key of acc.posting.key_auths) {
posting_public_keys.push(key[0]);
}
if (posting_public_keys.includes(public_wif)) {
posting = sjcl.encrypt('dpos.space_golos_' + login + '_postingKey', posting_key);
}
}
let active = '';
if (active_key) {
    const public_wif = golos.auth.wifToPublic(active_key);
let active_public_keys = [];
for (key of acc.active.key_auths) {
active_public_keys.push(key[0]);
}
if (active_public_keys.includes(public_wif)) {
	active = sjcl.encrypt('dpos.space_golos_' + login + '_activeKey', active_key);
}
}

if (!users) {
users = [];
}
if (!localStorage.getItem('golos_users')|| localStorage.getItem('golos_users').indexOf(login) === -1) {
if (posting && active) {
    let acc_data = {login, posting, active};
    localStorage.setItem("golos_current_user", JSON.stringify(acc_data));
users.push(acc_data);
localStorage.setItem("golos_users", JSON.stringify(users));
$('form input[type="text"], form input[type="password"]').val('');
$('#auth_msg').html('Аккаунт добавлен.');
selectAccount();
} else if (posting && !active) {
let acc_data = {login, posting};
    localStorage.setItem("golos_current_user", JSON.stringify(acc_data));
    users.push(acc_data);
    localStorage.setItem("golos_users", JSON.stringify(users));
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

function pass_gen(){
	let length=100;
	let charset='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+-=_:;.,@!^&*$';
	let ret='';
	for (var i=0,n=charset.length;i<length;++i){
		ret+=charset.charAt(Math.floor(Math.random()*n));
	}
	let wif=golos.auth.toWif('',ret,'')
	return wif;
}

async function OAuthInit() {
    const oauth_res = await golos.oauth.checkReliable();
if (oauth_res.authorized) {
    $('.oauth_login-form').hide();
    $('.oauth_actions').show();
    $('.oauth_username').text(golos_login);
} else {
    $('.oauth_login-form').show();
    $('.oauth_actions').hide();
}
$('.loading').hide();
}

$(document).ready(async function() {
    $('.oauth_login').click(e => {
    golos.oauth.login(['transfer', 'account_metadata', 'claim', 'donate', 'comment', 'comment_options', 'worker_request_vote', 'transfer_to_tip', 'transfer_to_vesting', 'account_update', 'transfer_from_tip', 'custom_json', 'limit_order_create', 'delete_comment', 'withdraw_vesting', '', 'account_witness_vote', 'worker_request', 'limit_order_cancel', 'witness_update', 'asset_issue', 'delegate_vesting_shares', 'escrow_release', 'chain_properties_update', 'escrow_transfer', 'escrow_dispute', 'escrow_approve', 'account_create_with_delegation', '', 'delegate_vesting_shares_with_interest', 'account_witness_proxy', 'proposal_create', 'proposal_update', 'proposal_delete', 'invite_claim', 'invite', 'account_create', 'convert', 'transfer_to_savings', 'transfer_from_savings', 'limit_order_cancel_ex', 'cancel_transfer_from_savings', 'asset_update', 'asset_create', 'change_recovery_account']);
    golos.oauth.waitForLogin(async (res) => {
        if (localStorage.getItem('golos_users') && JSON.stringify(localStorage.getItem('golos_users')).indexOf(res.account) > -1) {
            await golos.oauth.logout();            
        window.alert('Аккаунт с таким-же логином уже добавлен. Просьба удалить его, если хотите использовать OAuth авторизацию.');
            return;
        }
        let acc_data = {login: res.account, posting: '', active: '', type: 'golos.app'};
        localStorage.setItem("golos_current_user", JSON.stringify(acc_data));
        if (!users) users = [];
        users.push(acc_data);
        localStorage.setItem("golos_users", JSON.stringify(users));
        window.location.reload();
    }, () => {
        alert('Waiting for login is timeouted. Try again please.');
    });
});

$('.oauth_logout').click(async (e) => {
    await golos.oauth.logout();
    let new_list = [];
    if (users.length > 1) {
    for (let user of users) {
    if (user.type !== 'golos.app') {
        new_list.push(user);
    }
    }
    localStorage.setItem("golos_users", JSON.stringify(new_list));
    selectAccount()
    $('#delete_msg').html('OAuth авторизация удалена из списка.');
    } else if (users.length === 1) {
        selectAccount()
        $('#delete_msg').html('OAuth авторизация удалена из списка.');
            localStorage.removeItem('golos_users');
            localStorage.removeItem('golos_current_user');
        }
    window.location.reload();
});
OAuthInit()
});