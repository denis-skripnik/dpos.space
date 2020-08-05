<?php return '
<div id="select_account"></div>
<p>Нет аккаунта в Viz, но есть инвайт-код? <a href="'.$conf['siteUrl'].'viz/accounts/registration" target="_blank">Зарегистрироваться</a></p>
<h2>Добавить аккаунт</h2>
<div id="auth_msg"></div>
<p>Ключи никуда не передаются: сохраняются в зашифрованном виде в вашем браузере.</p>
<form id="add_account">
<p><label for="login">Ваш логин: </label>
<input type="text" name="login" id="login" value="" required placeholder="Введите логин в Viz"></p>
<p><label for="regular_key">regular (регулярный) ключ: </label>
<input type="password" name="regular_key" id="regular_key" value="" required placeholder="Введите регулярный ключ"></p>
<p><label for="active_key">active (активный) ключ: </label>
<input type="password" name="active_key" id="active_key" value="" placeholder="Введите активный ключ"></p>
<p><input type="button" onclick="saveAccount()" value="Войти"></p>
</form>
'; ?>