const user = document.location.pathname.split('/')[3];
const limit = 1000;
var from = -1;
const ops = {
    vote: 'Голосование по контенту',
    comment: 'Публикация контента',
    transfer: 'Перевод средств',
    transfer_to_vesting: 'Перевод в СГ',
    withdraw_vesting: 'Вывод из СГ',
    limit_order_create: 'Создание лимитного ордера',
    limit_order_cancel: 'Отмена лимитного ордера',
    feed_publish: 'Публикация фидов',
    convert: 'Конвертация GOLOS в GBG или обратно',
    account_create: 'Создание аккаунта',
    account_update: 'Обновление акккаунта',
    witness_update: 'Обновление делегата',
    account_witness_vote: 'Голосование за делегата',
    account_witness_proxy: 'Прокси голосования за делегатов',
    custom: 'Custom транзакция',
    delete_comment: 'Удаление контента',
    custom_json: 'Транзакция с JSON данными',
    comment_options: 'Опции контента',
    set_withdraw_vesting_route: 'Направление вывода в СГ',
    limit_order_create2: 'Создание лимитного ордера 2',
    request_account_recovery: 'запрос восстановления аккаунта',
    recover_account: 'Восстановление аккаунта',
    change_recovery_account: 'Смена аккаунта восстановления',
    escrow_transfer: 'Сделка через посредника',
    escrow_dispute: 'Спорная ситуация в escrow',
    escrow_release: 'отпустить токены из escrow сделки',
    escrow_approve: 'Подтверждение escrow сделки',
    transfer_to_savings: 'Перевод в сейф',
    transfer_from_savings: 'Перевод из сейфа',
    cancel_transfer_from_savings: 'Отмена перевода из сейфа',
    custom_binary: 'custom транзакция с бинарными данными',
    decline_voting_rights: 'Отказ от прав на голосование',
    reset_account: 'Восстановление аккаунта',
    set_reset_account: 'Учетная запись имеет право выполнить операцию reset_account по истечении 60 дней',
    delegate_vesting_shares: 'Делегирование СГ',
    account_create_with_delegation: 'Создание аккаунта с делегированием СГ',
    account_metadata: 'Обновление мета данных аккаунта',
    proposal_create: 'Создание пропозала на подпись',
    proposal_update: 'Обновление пропозала на подпись',
    proposal_delete: 'Удаление пропозала на подпись',
    chain_properties_update: 'Обновление параметров сети',
    break_free_referral: 'Отмена реферальских комиссии',
    delegate_vesting_shares_with_interest: 'Делегирование СГ с возвратом кураторских',
    reject_vesting_shares_delegation: 'Отклонение делегирования СГ',
    transit_to_cyberway: 'Переход на Cyberway',
    worker_request: 'Создание заявки воркера',
    worker_request_delete: 'Удаление заявки воркера',
    worker_request_vote: 'Голосование за заявку воркера',
    fill_convert_request: 'Завершение заявки на конвертацию',
    author_reward: 'Авторская награда',
    curation_reward: 'Кураторская награда',
    comment_reward: 'Общая награда за контент',
    interest: 'Выплата процента прибыли по GBG',
    fill_vesting_withdraw: 'Завершение вывода из СГ',
    fill_order: 'Исполнение ордера',
    shutdown_witness: 'Отключение делегата',
    fill_transfer_from_savings: 'Завершение вывода из сейфа',
    hardfork: 'Хардфорк',
    comment_payout_update: 'Вычисленные окончательные выплаты по контенту',
    comment_benefactor_reward: 'Бенефициарская награда',
    'return_vesting_delegation': 'Возврат делегированной доли',
    producer_reward: 'Награда делегата',
    delegation_reward: 'Награда с делегирования',
    auction_window_reward: 'Возврат токенов в пул вознаграждений'
  };
  var searchOps = [];
 var query = '';
var userFields = ['from', 'to', 'initiator', 'receiver', 'witness', 'subscriber', 'delegator', 'delegatee', 'account', 'worker', 'seller', 'buyer', 'current_owner', 'open_owner', 'open_trade_fee_receiver', '', 'owner'];
 var fieldNames = {
    'from': 'от',
    'to': 'кому',
    'amount': 'сумма',
    "initiator": "Инициатор",
    "receiver": "Плучатель",
    "delegator": "Делегирующий",
    "delegatee": "Получатель",
    "beneficiaries": "Бенефициары",
    "account": "аккаунт",
    "worker": "воркер",
    "witness": "делегат",
"subscriber": "Подписчик",
"custom_sequence": "номер custom операции",
"vests": "Vests",
"memo": "заметка",
"seller": "продавец",
"buyer": "покупатель",
"current_owner": "Текущий владелец",
"current_orderid": "Id текущего ордера",
"current_pays": "Платёж текущего ордера",
"current_trade_fee": "комиссия текущего ордера",
"current_trade_fee_receiver": "Получатель комиссии текущего ордера",
"open_owner": "владелец открытого ордера",
"open_orderid": "Id открытого ордера",
"open_pays": "Платёж открытого ордера",
"open_trade_fee": "комиссия открытого ордера",
"open_trade_fee_receiver": "Получатель комиссии открытого ордера",
"open_price": "Цена открытого ордера",
"vesting_shares": "СГ",
"owner": "Создатель",
"orderid": "id ордера",
"amount_to_sell": "сумма продажи",
"min_to_receive": "Минимум получить",
"fill_or_kill": "Заполнять или отменять",
"expiration": "Истекает",
};

async function getHistory() {
    if (from === -1) $('#items').html('');
    let history_level = $('#history_level').html();
    if (!isNaN(history_level) && parseInt(history_level) === 0) history_level = 1000;
   else history_level = parseInt(history_level) + 1000;
    $('#history_level').html(history_level);
   var selectedOps = $('#ops').val();
let props = await golos.api.getDynamicGlobalPropertiesAsync();
let tvfs = parseFloat(props['total_vesting_fund_steem']);
let tvsh = parseFloat(props['total_vesting_shares']);

let steem_per_vests = 1000000 * tvfs / tvsh;

   let oldHistory = await golos.api.getAccountHistoryAsync(user, from, limit, {select_ops: selectedOps});
let history = oldHistory.reverse();
let trs = '';
for (let el of history) {
    const op = el[1].op;
    const opType = op[0];
    const opData = op[1];
if (selectedOps.length > 0 && selectedOps.indexOf(opType) === -1) continue;
const originalDateTimeString = el[1].timestamp + '.000Z';
const originalDateTime = new Date(originalDateTimeString);

// Преобразование в русский формат с локальным временем
const options = {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  timeZoneName: 'long'
};

const russianFormattedDateTime = originalDateTime.toLocaleDateString('ru-RU', options);
let tr = `<tr>
<td><a href="/golos/explorer/tx/${el[1].trx_id}" target="_blank">${russianFormattedDateTime}</a></td>
<td>${ops[opType]}</td>
<td>`;
for (let field in opData) {
    let fieldValue = opData[field];
    if (typeof fieldValue === 'object') fieldValue = JSON.stringify(fieldValue);
    if (typeof fieldValue === 'string' && fieldValue !== '' && userFields.indexOf(field) > -1) fieldValue = `<a href="/golos/profiles/${fieldValue}" target="_blank">@${fieldValue}</a>`;
    if (typeof fieldValue === 'string' && fieldValue.indexOf('VESTS') > -1 || typeof fieldValue === 'string' && fieldValue.indexOf('GESTS') > -1)    fieldValue = Math.round(parseFloat(fieldValue) / 1000000 * steem_per_vests, 3);
    if (field === 'expiration') fieldValue = new Date(fieldValue).toLocaleDateString('ru-RU', options);
    tr += `${(fieldNames[field] ? fieldNames[field] : field)} ${fieldValue}; `;
}
tr += '</td></tr>';
if (query !== '' && tr.indexOf(query) === -1) continue;
trs += tr;
from = el[0];
} // end for.
$('#items').append(trs);
} // end function.

$(document).ready(async function() {
    let opsParam = getParameterByName('ops');
    let queryParam = getParameterByName('query');
    if (opsParam && opsParam !== '') searchOps = opsParam.split(',');
    if (queryParam && queryParam !== '') query = queryParam;
    
    var opsSelect = '';
for (let name in ops) {
    let value = ops[name];
    let selected = '';
if (searchOps.indexOf(name) > -1) selected = 'selected ';
opsSelect += `
<option ${selected}value="${name}">${value}</option>`;
}
$('#ops').html(opsSelect);
if (opsParam && opsParam !== '') {
    await getHistory();
    }

$('#get_results').click(async function() {
    var selectedOps = $('#ops').val();
var queryField = $('#query').val();
var params = '#';
if (selectedOps.length > 0) params += `ops=${selectedOps.join(',')}`;
if (queryField !== '') params += `&query=${queryField}`;
if (params !== '#') window.location.hash = params;
searchOps = selectedOps;
query = queryField;
from = -1;
await getHistory();
});
});