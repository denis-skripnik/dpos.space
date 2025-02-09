function unicodeToChar(text) {
    return text.replace(/\\u[\dA-F]{4}/gi,
           function (match) {
                return String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16));
           });
 }

const user_url = document.location.pathname.split('/')[3];
const limit = 1000;
var from = -1;
const ops = {
    'transfer': 'Перевод',
    'transfer_to_vesting': 'Перевод в соц. капитал',
    'withdraw_vesting': 'конвертация соц. капитала в VIZ',
    'account_update': 'Обновление аккаунта',
    'witness_update': 'Обновление делегата',
    'account_witness_vote': 'Голосование за делегата',
    'account_witness_proxy': 'Передача голосования за делегатов',
    'custom': 'Публичная строка с содержимым в формате JSON',
    'set_withdraw_vesting_route': 'Установка направления вывода',
    'request_account_recovery': 'Запрос восстановления',
    'recover_account': 'Восстановление аккаунта',
    'change_recovery_account': 'Смена доверенного аккаунта',
    'escrow_transfer': 'Сделка через посредника',
    'escrow_dispute': 'Спорная ситуация в escrow',
    'escrow_release': 'отпустить токены из escrow сделки',
    'escrow_approve': 'Подтверждение escrow сделки',
    'delegate_vesting_shares': 'Делегирование доли',
    'account_create': 'Создание аккаунта',
    'account_metadata': 'Обновление мета-данных аккаунта',
    'proposal_create': 'Создание предложения на подпись',
    'proposal_update': 'Обновление предложения на подпись',
    'proposal_delete': 'Удаление предложения на подпись',
    'fill_vesting_withdraw': 'Конвертация в VIZ (Shares)',
    'shutdown_witness': 'Отключение делегата',
    'hardfork': 'Хардфорк',
    'return_vesting_delegation': 'Возврат делегированной доли',
    'committee_worker_create_request': 'Создание заявки комитета',
    'committee_worker_cancel_request': 'отмена заявки в комитете',
    'committee_vote_request': 'Голосование за заявку',
    'committee_cancel_request': 'заявка отклонена комитетом',
    'committee_approve_request': 'Одобрение заявки',
    'committee_payout_request': 'заявка полностью получила выплату из комитета',
    'committee_pay_request': 'заявка получила выплату из комитета',
    'witness_reward': 'Награда делегата',
    'create_invite': 'Создание инвайт-кода',
    'claim_invite_balance': 'Погашение инвайт-кода',
    'invite_registration': 'Регистрация по инвайту',
    'versioned_chain_properties_update': 'установка делегатом голосуемых параметров сети',
    'award': 'Награда',
    'fixed_award': "Фиксированная награда",
    'receive_award': 'Получение награды',
    'benefactor_award': 'Бенефициарская награда',
    'set_paid_subscription': 'Установка подписки',
    'paid_subscribe': 'Подписка',
    'paid_subscription_action': 'оплата периодических платежей',
    'cancel_paid_subscription': 'Отмена подписки',
    'set_account_price': 'Установка цены аккаунта',
    'set_subaccount_price': 'Установка цены сабаккаунта',
    'buy_account': 'Покупка аккаунта',
    'account_sale': 'Продажа аккаунта',
    'use_invite_balance': 'Использование инвайта на баланс',
    'expire_escrow_ratification': 'Истечение срока ратификации escrow',
    'target_account_sale': 'Установка покупателя аккаунта',
    'bid': 'Ставка на покупку аккаунта',
    'outbid': 'Ставка на покупку аккаунта перебита',
    'custom': 'Кастомный JSON'
  };
  var searchOps = [];
 var query = '';
var userFields = ['from', 'to', 'initiator', 'receiver', 'witness', 'subscriber', 'delegator', 'delegatee', 'account', 'worker', 'seller', 'buyer'];
 var fieldNames = {
    'from': 'от',
    'to': 'кому',
    'amount': 'сумма',
    "max_energy": "макс. энергия",
    "initiator": "Инициатор",
    "reward_amount": "Сумма награды",
    "receiver": "Плучатель",
    "delegator": "Делегирующий",
    "delegatee": "Получатель",
    "beneficiaries": "Бенефициары",
    "account": "аккаунт",
    "worker": "воркер",
    "witness": "делегат",
"subscriber": "Подписчик",
"energy": "энергия",
"custom_sequence": "номер custom операции",
"shares": "соц. капитал",
"memo": "заметка",
"seller": "продавец",
"buyer": "покупатель"
};

async function getHistory() {
    if (from === -1) $('#items').html('');
    let history_level = $('#history_level').html();
    if (!isNaN(history_level) && parseInt(history_level) === 0) history_level = 1000;
   else history_level = parseInt(history_level) + 1000;
    $('#history_level').html(history_level);
   var selectedOps = $('#ops').val();
let oldHistory = await viz.api.getAccountHistoryAsync(user_url, from, limit);
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
<td><a href="/viz/explorer/tx/${el[1].trx_id}" target="_blank">${russianFormattedDateTime}</a></td>
<td>${ops[opType]}</td>
<td class="longtext">`;
for (let field in opData) {
    let fieldValue = opData[field];
    if (typeof fieldValue === 'object') fieldValue = JSON.stringify(fieldValue);
    if (typeof fieldValue === 'string' && userFields.indexOf(field) > -1) fieldValue = `<a href="/viz/profiles/${fieldValue}" target="_blank">@${fieldValue}</a>`;
    fieldValue = unicodeToChar(fieldValue);
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