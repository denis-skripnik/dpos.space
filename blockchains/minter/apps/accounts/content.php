<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<div id="select_account"></div>
<h2>Добавить аккаунт</h2>
<h3>Вручную</h3>
<div id="auth_msg"></div>
<p class="p-main">Фраза никуда не передаётся: сохраняется в зашифрованном виде в вашем браузере.</p>
<form class="form">
<p><label for="login">Имя аккаунта: </label>
<input type="text" name="login" id="login" value="" required placeholder="Введите произвольное имя аккаунта"></p>
<p><label for="seed">SEED фраза: </label></p>
<p><textarea name="seed" id="seed" required></textarea></p>
<p><input type="button" onclick="saveAccount()" value="Войти"></p>
</form>
<h3>wallet.bip.to</h3>
<form class="form">
<p><label for="bip_to_login">Имя аккаунта: </label>
<input type="text" name="bip_to_login" id="bip_to_login" value="" required placeholder="Введите произвольное имя аккаунта"></p>
<p><label for="bip_to_address">Адрес аккаунта: </label>
<input type="text" name="bip_to_address" id="bip_to_address" value="" required placeholder="Введите адрес Minter кошелька"></p>
<p><strong><input type="button" value="Вход" onclick="bipToAuth(this.form.bip_to_login.value, this.form.bip_to_address.value)"></strong></p>
</form>
<h3>Импорт из другого блокчейна на dpos.space</h3>
<form>
<p><label for="select_chain">Выберите блокчейн:<br>
<select name="select_chain" id="chains_list">
<option value="">Выберите блокчейн</option>
</select></label></p>
<p><label for="select_chain_account">Выберите аккаунт:<br>
<select name="select_chain_accounts">
<option value="">Выберите аккаунт</option>
</select></label></p>
<p align="center"><input type="button" id="import_chain_account" value="Импорт"></p>
</form>
<h2>Создать аккаунт</h2>
<p><strong><a onclick="createAccount()">Получить данные</a></strong></p>
<div id="account_create_result" style="display: none;">
<p><strong>ВНИМАНИЕ: сохраните SEED фразу - от неё зависит сохранность ваших средств.</strong></p>
<p><textarea id="new_seed"></textarea><br>
<input type="button" onclick="copyText(`new_seed`)" value="Копировать в буфер обмена"></p>
<div id="new_acc_data"></div>
</div>
'; ?>