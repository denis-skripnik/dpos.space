<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<div id="select_account"></div>
<h2>Добавить аккаунт</h2>
<div id="auth_msg"></div>
<p>Ключи никуда не передаются: сохраняются в зашифрованном виде в вашем браузере.</p>
<form class="form">
<p><label for="login">Ваш логин: </label>
<input type="text" name="login" id="login" value="" required placeholder="Введите логин в "></p>
<p><label for="posting_key">Приватный  posting (постинг) ключ: </label>
<input type="password" name="posting_key" id="posting_key" value="" required placeholder="Введите постинг ключ"></p>
<p><label for="active_key">Приватный active (активный) ключ: </label>
<input type="password" name="active_key" id="active_key" value="" placeholder="Введите активный ключ"></p>
<p><input type="button" onclick="saveAccount()" value="Войти"></p>
</form>
'; ?>