<p><button data-fancybox-close class="btn">Закрыть</button></p>
<script>
   axios.get('/account?address="' + sender.address + '"')
  .then(function (response) {
    // handle success
let acc = response.data.result.account;
    let balances = '';
for (let token of acc.coins) {
  let balance = token.amount;
  balances = `${balance} ${token.denom}`;
}
    $('#my_balances').html(balances);
  })
  .catch(function (error) {
    // handle error
    console.error(JSON.stringify(error));
  })
  .then(function () {
    // always executed
  });

  axios.get('/account_bandwidth?address="' + sender.address + '"')
  .then(function (response) {
    $('#my_bandwidth_remained').html(response.data.result.remained);
    $('#my_bandwidth_max_value').html(response.data.result.max_value);
    })
  .catch(function (error) {
    // handle error
    console.error(error);
  })
  .then(function () {
    // always executed
  });
</script>

<?php $to = $_GET['to']; ?>
<div id="auth_msg" style="display: none;"><p>Вы не авторизовались. Просьба сделать это <a href="'.$conf['siteUrl'].'cyber/accounts" target="_blank">здесь</a></p></div>                        
                        <div id="seed_page">
<h2>Пропускная способность</h2>
<p><strong><span id="my_bandwidth_remained"></span> из <span id="my_bandwidth_max_value"></span></strong></p>
<h2>Баланс</h2>
<p id="my_balances"></p>
<h2>Перевод средств</h2>
<form class="form">
<p><input type="text" name="to" id="to" value="<?= $to; ?>" placeholder="Адрес получателя" readonly></p>
<p><input type="text" name="amount" id="amount" value="" placeholder="Введите сумму (число)"></p>
<p><input type="button" value="Отправить" onclick="sendTransfer(this.form.to.value, this.form.amount.value)"></p>
</form>
</div>

<script>
    $('#balances').click(function() {
let amount = $('#balances').html();
amount = parseInt(amount);
$("input[name='amount']").val(amount);
    });
</script>