function main() {
    var chf = {};
chf.account_creation_fee = 'Передаваемая комиссия при создании аккаунта:';
chf.create_account_delegation_ratio = 'Коэффициент наценки делегирования при создании аккаунта:';
chf.create_account_delegation_time = 'Срок делегирования при создании аккаунта (в секундах):';
chf.maximum_block_size = 'Максимальный размер блока в сети (в байтах):';
chf.min_delegation = 'Минимальное количество токенов при делегировании:';
chf.min_curation_percent = 0; //deprecated
chf.max_curation_percent = 100; //deprecated
chf.bandwidth_reserve_percent = 'Доля сети, выделяемая для резервной пропускной способности:';
chf.bandwidth_reserve_below = 'Резервная пропускная способность действует для аккаунтов с долей сети до порога:';
chf.flag_energy_additional_cost = 0; //deprecated
chf.vote_accounting_min_rshares = 'Минимальный вес голоса для учёта при награждении (VIZ):';
chf.committee_request_approve_min_percent = 'Минимальная доля совокупного социального капитала для решения по заявке в Фонде ДАО:';
chf.inflation_witness_percent= 'Доля эмиссии, идущая на вознаграждение делегатов:';
      chf.inflation_ratio_committee_vs_reward_fund='Доля оставшейся эмиссии, идущая в Фонд ДАО (остальное - в Фонд наград):';
      chf.inflation_recalc_period= 'Количество блоков между пересчётом инфляционной модели:';
      chf.data_operations_cost_additional_bandwidth= 'Дополнительная наценка пропускной способности за каждую data операцию в транзакции:';
      chf.witness_miss_penalty_percent= 'Штраф делегату за пропуск блока в процентах от суммарного веса голосов:';
      chf.witness_miss_penalty_duration= 'Длительность штрафа делегату за пропуск блока в секундах:';
chf.create_invite_min_balance = 'Минимальный баланс для создания инвайт кода:';
chf.committee_create_request_fee = 'Комиссия за создание заявки в комитет:';
chf.create_paid_subscription_fee = 'Комиссия за создание платной подписки:';
chf.account_on_sale_fee = 'Комиссия за установку аккаунта на продажу:';
chf.subaccount_on_sale_fee = 'Комиссия за установку субаккаунтов на продажу:';
chf.witness_declaration_fee = 'Комиссия за декларирование аккаунта делегатом:';
chf.withdraw_intervals = 'Количество интервалов для уменьшения капитала:';

    viz.api.getWitnessByAccount(viz_login, function(err, res) {
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
if (prop === 'bandwidth_reserve_below') {
    end_fild = ' SHARES';
} else {
    end_fild = ' VIZ';
}
} else if (prop === 'vote_accounting_min_rshares') {
    prop_value = parseFloat(props[prop]);
    prop_value /= 1000000;
        end_fild = ' VIZ';
    } else if (prop.indexOf('percent') > -1 || prop === 'inflation_ratio_committee_vs_reward_fund') {
        prop_value = parseFloat(props[prop]);
        prop_value /= 100;
        end_fild = '%';
    }
    if (prop !== 'min_curation_percent' && prop !== 'max_curation_percent' && prop !== 'flag_energy_additional_cost') {
    form_filds += `<p><label for="${prop}">${chf[prop]} 
<input type="text" name="${prop}" value="${prop_value}" placeholder="${chf[prop]}">${end_fild}</label></p>`;
    } else {
        form_filds += `<input type="hidden" name="${prop}" value="${chf[prop]}">${end_fild}</label></p>`;
    }
}
$('#props_list').html(form_filds);
} else {
    document.getElementById('witness_props').style = 'display: none';
}
});
}
main();

$('#witness_options').click(function() {
   var q = window.confirm('Вы действительно хотите изменить статус делегата или объявить себя им? Объявление делегатом является платным. Цену можете узнать, зайдя в блок-эксплорер, раздел "основные параметры". Дальнейшее обновление статуса бесплатно.');
   if (q == true) {
   let url = $('input[name=witness_url]').val();
    let blockSigningKey = $('input[name=witness_key]').val();
    if (blockSigningKey === '') {
        blockSigningKey = 'VIZ1111111111111111111111111111111114T1Anm';
    }
    viz.broadcast.witnessUpdate(active_key, viz_login, url, blockSigningKey, function(err, result) {
if (!err) {
    window.alert('Настройки делегата сохранены.');
} else {
    window.alert(JSON.stringify(err));
}
      });
    }
    });

$('#save_props').click(function() {
    let elements = document.forms['props_form'].elements;
    let props = {};
    for (i=0; i<elements.length; i++){
        let prop = elements[i].name;
if (prop !== '') {
let prop_value = elements[i].value.replace(/,/, '.');
prop_value = parseFloat(prop_value);
if (prop.indexOf('percent') > -1 || prop === 'inflation_ratio_committee_vs_reward_fund') {
prop_value *= 100;
        prop_value = parseInt(prop_value);
} else if (prop.indexOf('_fee') > -1 || prop === 'min_delegation' || prop === 'create_invite_min_balance') {
    prop_value = prop_value.toFixed(3) + ' VIZ';
} else if (prop === 'bandwidth_reserve_below') {
    prop_value = prop_value.toFixed(6) + ' SHARES';
} else if (prop === 'vote_accounting_min_rshares') {
    prop_value *= 1000000;
    prop_value = parseInt(prop_value);
}
props[prop] = prop_value;
}
}

viz.broadcast.versionedChainPropertiesUpdate(active_key, viz_login, [3,props], function(err, result) {
if (!err) {
    window.alert('Параметры сохранены успешно.');
} else {
    window.alert('Ошибка: ' + JSON.stringify(err));
}
  });

});