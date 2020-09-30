<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<div id="select_account"></div>
<h2>Добавить аккаунт</h2>
<div id="auth_msg"></div>
<p>Фраза никуда не передаётся: сохраняется в зашифрованном виде в вашем браузере.</p>
<form>
<p><label for="login">Имя аккаунта: </label>
<input type="text" name="login" id="login" value="" required placeholder="Введите произвольное имя аккаунта"></p>
<p><label for="seed">SEED фраза: </label></p>
<p><textarea name="seed" id="seed" required></textarea></p>
<p><input type="button" onclick="saveAccount()" value="Войти"></p>
</form>
<h2>Создать аккаунт</h2>
<p><strong><a onclick="createAccount()">Получить данные</a></strong></p>
<div id="account_create_result" style="display: none;">
<p><strong>ВНИМАНИЕ: сохраните SEED фразу - от неё зависит сохранность ваших средств.</strong></p>
<p><textarea id="new_seed"></textarea><br>
<input type="button" onclick="copyText(`new_seed`)" value="Копировать в буффер обмена"></p>
<div id="new_acc_data"></div>
</div>
'; ?>