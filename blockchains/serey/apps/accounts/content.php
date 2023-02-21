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
<h2>Получаем ключи из пароля</h2>
<p>Если у вас нет активного и постинг ключа, и вам лень ставить десктопный кошелёк, можете ввести логин и пароль (начинается с P) в этой форме, нажать "Получить", и скопировать их. Кроме того, ключи сразу будут вставлены в поля входа. Вам достаточно будет добавить логин, и нажать "Войти".</p>
<p>Пароль остаётся только у вас локально (передачи нет), но вводите данные все равно на свой страх и риск.</p>
<form>
<p><label for="login_for_keys">Логин без @:<br>
<input type="text" name="login_for_keys" id="login_for_keys" value=""></label></p>
<p><label for="owner_password">Пароль:<br>
<input type="password" name="owner_password" id="owner_password" value=""></label></p>
<p align="center"><input type="button" id="get_keys" value="Получить"></p>
</form>
<div id="result_keys"></div>
'; ?>