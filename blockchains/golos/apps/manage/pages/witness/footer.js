function main() {
    var chf = {};
chf.account_creation_fee = "Размер комиссии за создание аккаунта без делегирования (GOLOS):";
chf.maximum_block_size = 'Максимальный размер блока в сети (в байтах):';
chf.sbd_interest_rate = "% начисляемый на GBG:";
chf.create_account_min_golos_fee = "Мин. комиссия на создание аккаунта с делегированием (GOLOS):";
chf.create_account_min_delegation = "Мин. СГ при создании аккаунта с делегированием (GOLOS):";
chf.create_account_delegation_time = "Время заморозки делегированной СГ при создании аккаунта с делегированием (дней):";
chf.min_delegation = "Размер мин. делегирования СГ (GOLOS):";
chf.max_referral_interest_rate = "Макс. % от реферала:";
chf.max_referral_term_sec = "Макс. срок получения % от реферала (дней):";
chf.min_referral_break_fee = "Мин. сумма выкупа реферала (GOLOS):";
chf.max_referral_break_fee = "Макс. сумма выкупа реферала (GOLOS):";
chf.posts_window = "Длительность интервала/окна для постов (минуты):";
chf.posts_per_window = "Кол-во постов за интервал:";
chf.comments_window = "Длительность интервала/окна для комментариев (минуты):";
chf.comments_per_window = "Кол-во комментариев за интервал:";
chf.votes_window = "Длительность интервала/окна для голосования (минуты):";
chf.votes_per_window = "Кол-во голосов за интервал:";
chf.auction_window_size = "Длительность штрафного окна при голосовании (секунды):";
chf.max_delegated_vesting_interest_rate = "Макс. % дохода при делегировании СГ:";
chf.custom_ops_bandwidth_multiplier = "Мультипликатор пропускной способности для операций custom_json:";
chf.min_curation_percent = "Мин. кураторский %:";
chf.max_curation_percent = "Макс. кураторский %:";
chf.curation_reward_curve = "Кривая кураторского вознаграждения:";
chf.allow_distribute_auction_reward = "Распределение штрафа из штрафного окна в пользу других кураторов:";
chf.allow_return_auction_reward_to_fund = "Распределение штрафа из штрафного окна в фонд вознаграждений:";
chf.worker_reward_percent = "% от эмиссии в пул воркеров:";
chf.witness_reward_percent = "% от эмиссии в пул делегатов:";
chf.vesting_reward_percent = "% от эмиссии в пул вестинга/на СГ:";
chf.worker_emission_percent = "процент эмиссии, поступающий на наполнение фонда воркеров";
chf.vesting_of_remain_percent = "процент распределения оставшегося на пул вестинга и общий пул";
chf.worker_request_creation_fee = "Размер платы за подачу заявки воркером:";
chf.worker_request_approve_min_percent = "% от общей СГ, необ. для одобрения заявки воркера:";
chf.sbd_debt_convert_rate = "% от общего кол-ва GBG для ежедневной конвертации в GOLOS при долге более 20%:";
chf.vote_regeneration_per_day = "Степень регенерации батарейки, кол-во полных апвоутов в день:";
chf.witness_skipping_reset_time = "Срок пропуска блоков, после которого ключ делегата сбрасывается и нода не участвует в подписании (минуты):";
chf.witness_idleness_time = "Срок с подписи последнего блока делегатом, после которого все голоса с него обнуляются (дни):";
chf.account_idleness_time = "Срок неактивности аккаунта, после которого отменяется делегирование и запускается понижение СГ (дни)";
chf.claim_idleness_time = 'Длительность окна/временного цикла для востребования пользователем своей доли от эмиссии (секунд): ';
chf['min_invite_balance'] = 'Минимальный баланс инвайта/чека для создания: ';
chf['asset_creation_fee'] = 'Стоимость создания UIA актива:';
chf['invite_transfer_interval_sec'] = 'Минимальный интервал для переводов с инвайт-кодов (секунды):';
chf.convert_fee_percent = "Процент комиссии по конвертации";
chf.min_golos_power_to_curate = "Мин. СГ для получения кураторских";
chf.negrep_posting_window = "Время постинга аккаунтом с отрицательной репутацией (минут)";
chf.negrep_posting_per_window = "Кол-во постов для публикации аккаунтами с отриц. репутацией";
chf.unwanted_operation_cost = "Стоимость нежелательных операций.";
chf.nlimit_operation_cost = "Цена 1 операции при отрицательной репутации.";
    
golos.api.getWitnessByAccount(golos_login, function(err, res) {
    if (!err && !$.isEmptyObject(res)) {
    let props = res.props;
$('input[name=witness_url]').val(res.url);
$('input[name=witness_key]').val(res.signing_key);
var form_filds = '';
for (let prop in chf) {
    let prop_value = props[prop];
    let end_fild = '';
    if (typeof props[prop] == 'string' && prop !== 'curation_reward_curve' && props[prop].indexOf('GBG') === -1) {
prop_value = parseFloat(props[prop]);
    end_fild = ' GOLOS';
} else if (typeof props[prop] == 'string' && prop_value.indexOf('GBG') > -1) {
    prop_value = parseFloat(props[prop]);
    end_fild = ' GBG';
} else if (prop.indexOf('percent') > -1 || prop.indexOf('min_golos_power_to_curate') === -1 && prop.indexOf('rate') > -1) {
        prop_value = parseFloat(props[prop]);
        prop_value /= 100;
        end_fild = '%';
    } else if (prop === 'allow_distribute_auction_reward' || prop === 'allow_return_auction_reward_to_fund') {
if (prop_value === true) {
    end_fild = "checked ";
} else {
end_fild = "";
}
    } else if (prop === 'create_account_delegation_time' || prop === 'witness_idleness_time' || prop === 'account_idleness_time' || prop === 'max_referral_term_sec') {
        prop_value /= 86400;
            prop_value = parseInt(prop_value);
    } else if (prop === 'witness_skipping_reset_time') {
        prop_value /= 60;
    prop_value = prop_value.toFixed(2);
    prop_value = parseFloat(prop_value);
}

    if (prop === 'curation_reward_curve') {
let selected = [];
        if (prop_value === "square_root") {
    selected = ["", "", "selected"];
} else if (prop_value === "linear") {
    selected = ["", "selected", ""];
} else if (prop_value === "bounded") {
    selected = ["selected", "", ""];
}

        form_filds += `<p><label for="${prop}">${chf[prop]} 
<select name="${prop}">
    <option ${selected[2]} value="2">Квадратный корень</option>
    <option ${selected[1]} value="1">Линейный</option>
    <option ${selected[0]} value="0">Доля кураторского вознаграждения определяется в зависимости от времени голосования и используемой СГ</option>
    </select></label></p>`;
} else if (prop === 'allow_distribute_auction_reward' || prop === 'allow_return_auction_reward_to_fund') {
form_filds += `<p><label for="${prop}">${chf[prop]} 
<input type="checkbox" name="${prop}" ${end_fild}placeholder="${chf[prop]}"></label></p>`;
    } else {
        form_filds += `<p><label for="${prop}">${chf[prop]} 
        <input type="text" name="${prop}" value="${prop_value}" placeholder="${chf[prop]}">${end_fild}</label></p>`;
    }
$('#props_list').html(form_filds);
}
} else {
    document.getElementById('witness_props').style = 'display: none';
}
});
}
main();

$('#witness_options').click(function() {
    golos.api.getWitnessByAccount(golos_login, function(error, res) {
        if (!error && !$.isEmptyObject(res)) {
    let props = {};
props.account_creation_fee = res.props.account_creation_fee;
props.maximum_block_size = res.props.maximum_block_size;
props.sbd_interest_rate = res.props.sbd_interest_rate;
    let url = $('input[name=witness_url]').val();
    let blockSigningKey = $('input[name=witness_key]').val();
    if (blockSigningKey === '') {
        blockSigningKey = 'GLS1111111111111111111111111111111114T1Anm';
    }

    let fee = "0.000 GOLOS";
    golos.broadcast.witnessUpdate(active_key, golos_login, url, blockSigningKey, props, fee, function(err, result) {
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
    golos.api.getWitnessByAccount(golos_login, function(error, res) {
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
if (prop.indexOf('percent') > -1 || prop.indexOf('min_golos_power_to_curate') === -1 && prop.indexOf('rate') > -1) {
    prop_value *= 100;
        prop_value = parseInt(prop_value);
        } else if (prop === 'allow_distribute_auction_reward' || prop === 'allow_return_auction_reward_to_fund') {
            prop_value = elements[i].checked;
    } else if (prop === 'account_creation_fee' || prop === 'create_account_min_golos_fee' || prop === 'create_account_min_delegation' || prop === 'min_delegation' || prop === 'min_referral_break_fee' || prop === 'max_referral_break_fee' || prop === 'min_invite_balance' || prop === 'min_golos_power_to_curate') {
        prop_value = prop_value.toFixed(3) + ' GOLOS';
} else if (prop === 'worker_request_creation_fee' || prop === 'asset_creation_fee') {
    prop_value = prop_value.toFixed(3) + ' GBG';
} else if (prop === 'create_account_delegation_time' || prop === 'witness_idleness_time' || prop === 'account_idleness_time' || prop === 'max_referral_term_sec') {
    prop_value *= 86400;
        prop_value = parseInt(prop_value);
    } else if (prop === 'witness_skipping_reset_time') {
    prop_value *= 60;
        prop_value = parseInt(prop_value);
    }
props[prop] = prop_value;
}
}

let fee = "0.000 GOLOS";
let operations = [];
let op = [];
op[0] = 'chain_properties_update';
op[1] = {};
op[1].owner = golos_login;
op[1].props = [7, props];
operations.push(op);  
console.log(JSON.stringify(operations));
golos.broadcast.send({extensions: [], operations}, [active_key], function(err, result) {
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