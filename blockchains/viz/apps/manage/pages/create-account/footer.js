$('#subaccount').append(`( .${viz_login})`);
viz.api.getAccounts([viz_login], function(err, res) {
    if (!err) {
        $('#viz_balance').html(`Баланс VIZ: ${res[0].balance}`);
        let free_shares = parseFloat(res[0].vesting_shares) - parseFloat(res[0].delegated_vesting_shares);
        $('#free_shares').html(`Доступный для делегирования соц. капитал: ${free_shares.toFixed(3)} VIZ`);
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
    let fixed_token_amount=''+parseFloat(token_amount).toFixed(3)+' VIZ';
        let fixed_shares_amount=''+parseFloat(shares_amount).toFixed(6)+' SHARES';
        if(''==token_amount){
            fixed_token_amount='0.000 VIZ';
        }
        if(''==shares_amount){
            fixed_shares_amount='0.000000 SHARES';
        }
        let auth_types=['regular','active','master','memo'];
        let keys=viz.auth.getPrivateKeys(account_login,pass_gen(100),auth_types);
        let master = {
            'weight_threshold': 1,
            'account_auths': [],
            'key_auths': [
                [keys.masterPubkey, 1]
            ]
        };
        let active = {
            'weight_threshold': 1,
            'account_auths': [],
            'key_auths': [
                [keys.activePubkey, 1]
            ]
        };
        let regular = {
            "weight_threshold": 1,
            "account_auths": [],
            "key_auths": [
                [keys.regularPubkey, 1]
            ]
        };
        let memo_key=keys.memoPubkey;
        let json_metadata='';
        let referrer=viz_login;
        viz.api.getAccounts([account_login],function(err,response){
                            if(!err && response.length !== 0){
                                $('#account_create_error').css('display', 'block');
                                $('#account_create_error').html(`<p><strong><span style="color: red;">Аккаунт уже существует, попробуйте другой.</span></strong></p>`);
                            } else {
                                $('#account_create_error').css('display', 'none');
                                viz.broadcast.accountCreate(active_key,fixed_token_amount,fixed_shares_amount,viz_login,account_login,master,active,regular,memo_key,json_metadata,referrer,[],function(err,result){
                    if(!err){
                        $('.btn btn-primary').css('display', 'none');
                        $('#account_created').html(`<h2>Аккаунт успешно создан</h2>
<p><strong><span style="color: red;">Сохраните ключи, указанные ниже: они не восстанавливаются.</span></strong></p>
<ul><li>${account_login} - логин</li>
<li>${keys['master']} - Master ключ</li>
<li>${keys['active']} - активный ключ</li>
<li>${keys['regular']} - Regular ключ</li>
<li>${keys['memo']} - Memo ключ</li></ul>`);
                        download('viz-account.txt','dpos.space\r\n\r\nAccount login: '+account_login+'\r\nMaster key: '+keys['master']+'\r\nActive key: '+keys['active']+'\r\nRegular key: '+keys['regular']+'\r\nMemo key: '+keys['memo']+'');
                    }
                    else{
                        $('#account_create_error').css('display', 'block');
                        $('#account_create_error').html(`<h2>Ошибка создания аккаунта</h2>
<p>${JSON.stringify(err)}</p>`);
                    }
                });
            }
        });
            }

	function send_reg_data() {
        let account_login=$('input[name=newAccountName]').val().toLowerCase().trim();
        if ($('select[name=type_registration]').val() === 'subaccount') {
            account_login += `.${viz_login}`;
        }
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