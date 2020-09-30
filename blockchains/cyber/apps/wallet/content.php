<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
global $conf;
return '<div id="auth_msg" style="display: none;"><p>Вы не авторизовались. Просьба сделать это <a href="'.$conf['siteUrl'].'cyber/accounts" target="_blank">здесь</a></p></div>                        
                        <div id="seed_page">
<h2>Пропускная способность</h2>
<p><strong><span id="bandwidth_remained"></span> из <span id="bandwidth_max_value"></span></strong></p>
<h2>Баланс</h2>
<p id="balances"></p>
<h2>Перевод средств</h2>
<div id="result"></div>
<form name="transfer">
<p><input type="text" name="to" id="to" value="" placeholder="Введите адрес получателя" required></p>
<p><input type="text" name="amount" id="amount" value="" placeholder="Введите сумму (число)" required></p>
<p><input type="button" id="submit_transfer" value="Отправить" onclick="sendTransfer(this.form.to.value, this.form.amount.value)" disabled></p>
</form>
</div>';
?>