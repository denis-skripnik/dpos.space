function main() {
    var chf = {};
chf.account_creation_fee = "Размер комиссии за создание аккаунта без делегирования (STEEM):";
chf.maximum_block_size = 'Максимальный размер блока в сети (в байтах):';
chf.sbd_interest_rate = "% начисляемый на SBD:";
chf.account_subsidy_budget = "Субсидии аккаунта, которые будут добавлены к субсидии аккаунта за блок. Это максимальная ставка, которую можно создать с помощью субсидий:";
chf.account_subsidy_decay = "сокращение субсидий по счету:";

    steem.api.getWitnessByAccount(steem_login, function(err, res) {
        if (!err && !$.isEmptyObject(res)) {
        let props = res.props;
$('input[name=witness_url]').val(res.url);
$('input[name=witness_key]').val(res.signing_key);
var form_filds = '';
for (let prop in chf) {
    let prop_value = props[prop];
    let end_fild = '';
if (typeof props[prop] == 'string') {
prop_value = parseFloat(props[prop]);
    end_fild = ' STEEM';
    } else if (prop.indexOf('rate') > -1) {
        prop_value = parseFloat(props[prop]);
        prop_value /= 100;
        end_fild = '%';
}

        form_filds += `<p><label for="${prop}">${chf[prop]} 
        <input type="text" name="${prop}" value="${prop_value}" placeholder="${chf[prop]}">${end_fild}</label></p>`;
    $('#props_list').html(form_filds);
}
} else {
    document.getElementById('witness_props').style = 'display: none';
}
});
}
main();

$('#witness_options').click(function() {
    steem.api.getWitnessByAccount(steem_login, function(error, res) {
        if (!error && !$.isEmptyObject(res)) {
    let props = {};
props.account_creation_fee = res.props.account_creation_fee;
props.maximum_block_size = res.props.maximum_block_size;
props.sbd_interest_rate = res.props.sbd_interest_rate;
    let url = $('input[name=witness_url]').val();
    let blockSigningKey = $('input[name=witness_key]').val();
    if (blockSigningKey === '') {
        blockSigningKey = 'STM1111111111111111111111111111111114T1Anm';
    }

    let fee = "0.000 STEEM";
    steem.broadcast.witnessUpdate(active_key, steem_login, url, blockSigningKey, props, fee, function(err, result) {
if (!err) {
    window.alert('Настройки делегата сохранены.');
} else {
    window.alert(JSON.stringify(err));
}
      });
    } else {
        window.alert('Ошибка подключения к Ноде, аккаунт не существует или не являлся когда-либо делегатом.');
    }
    });    
});

$('#save_props').click(function() {
    steem.api.getWitnessByAccount(steem_login, function(error, res) {
        if (!error && !$.isEmptyObject(res)) {
    let url = res.url;
    let blockSigningKey = res.signing_key;
    let elements = document.forms['props_form'].elements;
    let props = {};
    for (i=0; i<elements.length; i++){
        let prop = elements[i].name;
if (prop !== '') {
let prop_value = elements[i].value;
prop_value = parseFloat(prop_value);
if (prop.indexOf('rate') > -1) {
    prop_value *= 100;
        prop_value = parseInt(prop_value);
    } else if (prop === 'account_creation_fee') {
        prop_value = prop_value.toFixed(3) + ' STEEM';
    }
props[prop] = prop_value;
}
}

let fee = "0.000 STEEM";
let operations = [];
let op = [];
op[0] = 'chain_properties_update';
op[1] = {};
op[1].owner = steem_login;
op[1].props = [3, props];
operations.push(op);  
console.log(JSON.stringify(operations));
steem.broadcast.send({extensions: [], operations}, [active_key], function(err, result) {
if (!err) {
    window.alert('Параметры сохранены успешно.');
} else {
if (err.payload.error.message.indexOf('max_referral_term_sec must be <=(60*60*24*30*12)') > -1) {
    window.alert('Вы указали слишком большое значение Макс. срок получения % от реферала. Оно должно быть <= 360')
} else if (err.payload.error.message.indexOf("max_curation_percent must be between min_curation_percent and 10000") > -1) {
window.alert('Максимальный процент кураторских должен быть не более 100 и не менее мин. процента кураторских.');
} else if (err.payload.error.message.indexOf('min_curation_percent must be between 0 and max_curation_percent') > -1) {
    window.alert('Минимальныйй процент кураторских должен быть между 0 и максимальным процентом кураторских.');
} else if (err.payload.error.message.indexOf('percent + witness_reward_percent + vesting_reward_percent must be <=10000') > -1) {
window.alert('Сумма процентов (в фонд воркеров, в фонд контента, владельцам СГ и делегатам) должна быть <= 100')
} else if (err.payload.error.message.indexOf('rate must be between 0 and 10000') > -1 || err.payload.error.message.indexOf('rate must be <=10000') > -1 || err.payload.error.message.indexOf('percent must be <=10000') > -1) {
    window.alert('Один из параметров с процентом указан с ошибкой: % не может быть > 100.')
    } else {
    window.alert('Ошибка: ' + err.payload.error.message);
}
    console.log(JSON.stringify(err));
}
  });
        } else {
            window.alert('Ошибка подключения к Ноде, аккаунт не существует или не являлся когда-либо делегатом.');
        }
    });
    });