<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<h2>Страницы сервиса</h2>
<table><tr><th>Создание аккаунта/субаккаунта</th>
<th><a href="'.$conf['siteUrl'].'viz/manage/witness">Управление делегатом</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/witnesses">Делегаты</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/profile">Профиль</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/workers">Заявки воркеров</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/access">Доступы аккаунта</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/reset-keys">Сброс ключей</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/many-invites">Множество инвайтов (чеков)</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/multisig">Мультисиг</a></th>
</tr></table>
<div id="auth_msg" style="display: none;"><p>Вы не авторизовались. Просьба сделать это <a href="'.$conf['siteUrl'].'viz/accounts" target="_blank">здесь</a></p></div>
<div id="active_auth_msg" style="display: none;"><p>Вы не ввели активный ключ. Пожалуйста удалите текущий аккаунт и авторизуйтесь с указанием и регулярного, и активного ключа, здесь: <a href="'.$conf['siteUrl'].'viz/accounts" target="_blank">здесь</a></p></div>
<div id="active_page">
<div id="viz_balance"></div>
<div id="free_shares"></div>
<form class="form">
<div class="form-group1">
	<label for="newAccountName">Логин нового аккаунта<span style="color: red;">*</span> </label>
	<input type="text" class="form-control required" id="new_account_name" name="newAccountName" required="required"> 
</div>
<div class="form-group1">
	<label for="type_registration">:Регистрируем<span style="color: red;">*</span> </label>
<select name="type_registration">
<option value="account">Аккаунт</option>
<option id="subaccount" value="subaccount">Субаккаунт</option>
</select>
</div>
<div class="form-group1">
	<label for="amount">Сумма:</label>
	<input type="text" class="form-control required" id="amount" name="amount" value="10">
	<label for="type_send">Способ регистрации:</label>
	<select name="type_send">
	<option value="delegation">Делегированием (не менее 10)</option>
	<option value="fee">С баланса (не менее 1)</option>
	</select>
    </div>	
<div class="form-group1">
	<br>
	<input type="button" class="btn btn-primary" value="Регистрировать" 
		onclick="send_reg_data();">
</form>
<div id="account_created"></div>
<div id="account_create_error"></div>
</div>
<script src="'.$conf['siteUrl'].'blockchains/viz/apps/manage/pages/create-account/footer.js"></script>
'; ?>