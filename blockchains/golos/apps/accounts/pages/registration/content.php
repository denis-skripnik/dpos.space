<?php return '
<p>Авторизовать и выбрать аккаунты можете <a href="'.$conf['siteUrl'].'golos/accounts" target="_blank">на странице аккаунтов</a>.</p>
<h2>Создаём новый аккаунт</h2>
<form method="post" name="postForm" id="postForm">
<div class="form-group1">
	<label for="newAccountName">Логин нового аккаунта<span style="color: red;">*</span> </label>
	<input type="text" class="form-control required" id="new_account_name" name="newAccountName" required="required" onChange="check_it();"> 
<p id="check_login"></p>
	</div>
<div class="form-group1">
	<label for="inviteSecret">Инвайт-код:<span style="color: red;">*</span> </label>
	<input type="text" class="form-control required" id="invite_secret" name="inviteSecret" required="required" value=""> 
</div>
<div class="form-group1">
<hr>
<p><strong>Обязательно сохраните полученные ключи. Их нельзя будет восстановить, если потеряете!</strong></p>
<hr>
</div>
<div class="form-group1">
	<br>
	<input type="button" class="btn btn-primary" value="Регистрировать" 
		onclick="send_reg_data();">
</div>										
</form>
<div id="account_created"></div>
<div id="account_create_error"></div>
<script src="'.$conf['siteUrl'].'blockchains/golos/apps/accounts/pages/registration/footer.js"></script>
'; ?>