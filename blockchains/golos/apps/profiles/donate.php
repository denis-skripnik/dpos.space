<div style="display: none;" id="donate_modal_content">
<div>Ваш TIP-баланс: <span class="tip_balance_for_donate"></span></div>
<form>
<p><label for="tip_donate_amount">Сумма доната (<span id="action_donate_tip">Перевести все <span class="tip_balance_for_donate"></span></span>):<br>
<input type="text" name="tip_donate_amount" value="" placeholder="Сумма доната"></label></p>
<p><strong><input type="button" value="Наградить" name="send_donate_button"></strong></p>
</form>

<script>
golos.api.getAccounts([golos_login], function(err, res) {
if (!err) {
    $('.tip_balance_for_donate').html(res[0].tip_balance);
$('#action_donate_tip').click(function() {
let tip_balance = parseFloat(res[0].tip_balance);
$('input[name=tip_donate_amount]').val(tip_balance);
});
} else {
    console.log(JSON.stringify(err));
}
});

var url = document.location.pathname;
var donate_to = url.split('/')[3];
$('input[name=send_donate_button]').click(function() {
let tip_balance = $('input[name=tip_donate_amount]').val();
tip_balance = parseFloat(tip_balance);
let donate_amount = tip_balance.toFixed(3) + ' GOLOS';
let donate_memo = 'Донат со страницы просмотра профилей https://dpos.space' + url + '.';
golos.broadcast.donate(posting_key, golos_login, donate_to, donate_amount, {app: 'dpos-space', version: 1, comment: donate_memo, target: {type: 'personal_donate'}}, [], function(err, result) {
if (!err) {
    window.alert('Донат пользователю ' + donate_to + ' отправлен.');
    location.reload();
} else {
    window.alert('Ошибка: ' + err);
}
});
});

</script>
</div>