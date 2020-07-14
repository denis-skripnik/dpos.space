golos.api.getAccounts([golos_login], function(err, res) {
    if (!err) {
        golos.api.getDynamicGlobalProperties(function(error, result) {
if (!error) {
    let tvfs = parseFloat(result.total_vesting_fund_steem);
let tvsh = parseFloat(result.total_vesting_shares);
let golos_per_gests = 1000000 * tvfs / tvsh;

    $('#golos_balance').html(`Баланс GOLOS: ${res[0].balance}`);
    let free_shares = (parseFloat(res[0].vesting_shares) - parseFloat(res[0].delegated_vesting_shares)) / 1000000 * golos_per_gests;
    free_shares = free_shares.toFixed(6);
    $('#free_shares').html(`Доступная для делегирования СГ: ${free_shares}`);
}
        });
    }
});

function download(filename,text) {
        var link = document.createElement('a');
        link.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
        link.setAttribute('download', filename);
        if (document.createEvent) {
            var event = document.createEvent('MouseEvents');
            event.initEvent('click', true, true);
            link.dispatchEvent(event);
        }
        else {
            link.click();
        }
    }

function create_account(account_login,token_amount,shares_amount){
    golos.api.getDynamicGlobalProperties(function(e, r) {
        if (!e) {
            let tvfs = parseFloat(r.total_vesting_fund_steem);
        let tvsh = parseFloat(r.total_vesting_shares);
        let golos_per_gests = 1000000 * tvfs / tvsh;
let gests = 1000000/ golos_per_gests * shares_amount;

        let fixed_token_amount=''+parseFloat(token_amount).toFixed(3)+' GOLOS';
        let fixed_shares_amount=''+parseFloat(gests).toFixed(6)+' GESTS';
        if(''==token_amount){
            fixed_token_amount='1.000 GOLOS';
        }
        if(''==shares_amount){
            fixed_shares_amount='0.000000 GESTS';
        }
        let auth_types=['posting','active','owner','memo'];
        var keys=golos.auth.getPrivateKeys(account_login,pass_gen(100),auth_types);
        let owner = {
            'weight_threshold': 1,
            'account_auths': [],
            'key_auths': [
                [keys.ownerPubkey, 1]
            ]
        };
        let active = {
            'weight_threshold': 1,
            'account_auths': [],
            'key_auths': [
                [keys.activePubkey, 1]
            ]
        };
        let posting = {
            "weight_threshold": 1,
            "account_auths": [],
            "key_auths": [
                [keys.postingPubkey, 1]
            ]
        };
        let memo_key=keys.memoPubkey;
        let json_metadata='';
        let referrer=golos_login;
        golos.api.getAccounts([account_login],function(err,response){
                            if(!err && response.length !== 0){
                                $('#account_create_error').css('display', 'block');
                                $('#account_create_error').html(`<p><strong><span style="color: red;">Аккаунт уже существует, попробуйте другой.</span></strong></p>`);
                            } else {
$('#account_create_error').css('display', 'none');
golos.broadcast.accountCreateWithDelegation(active_key,fixed_token_amount,fixed_shares_amount,golos_login,account_login,owner,active,posting,memo_key,json_metadata,[],function(oshibka,ok){
                    if(!oshibka){
                        $('.btn btn-primary').css('display', 'none');
                        $('#account_created').html(`<h2>Аккаунт успешно создан</h2>
<p><strong><span style="color: red;">Сохраните ключи, указанные ниже: они не восстанавливаются.</span></strong></p>
<ul><li>${account_login} - логин</li>
<li>${keys['owner']} - Owner ключ</li>
<li>${keys['active']} - активный ключ</li>
<li>${keys['posting']} - Постинг ключ</li>
<li>${keys['memo']} - Memo ключ</li></ul>`);
                        download('golos-account.txt','dpos.space\r\n\r\nAccount login: '+account_login+'\r\nOwner key: '+keys['owner']+'\r\nActive key: '+keys['active']+'\r\nPosting key: '+keys['posting']+'\r\nMemo key: '+keys['memo']+'');
                    }
                    else{
                        $('#account_create_error').css('display', 'block');
                        $('#account_create_error').html(`<h2>Ошибка создания аккаунта</h2>
<p>${JSON.stringify(oshibka)}</p>`);
                    }
                });
            }
        });
    }
});
    }

	function send_reg_data() {
        let account_login=$('input[name=newAccountName]').val().toLowerCase().trim();
        let amount=$('input[name=amount]').val().trim();
        let type_send =$('select[name=type_send]').val().trim();
        let token_amount = '';
let shares_amount = '';
if (type_send === 'fee') {
    token_amount = amount;
} else {
    shares_amount = amount;
}
                    create_account(account_login,token_amount,shares_amount,$('.page-create-account input[name=newAccountName]'));
}