<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<h2>Страницы сервиса</h2>
<table><tr><th>Профиль</th>
<th><a href="'.$conf['siteUrl'].'viz/manage/witnesses">Делегаты</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/witness">Управление делегатом</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/workers">Заявки воркеров</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/create-account">Создать аккаунт/субаккаунт</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/access">Доступы аккаунта</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/reset-keys">Сброс ключей</a></th>
</tr></table>
<div id="auth_msg" style="display: none;"><p>Вы не авторизовались. Просьба сделать это <a href="'.$conf['siteUrl'].'viz/accounts" target="_blank">здесь</a></p></div>
<div id="posting_page">
<h2>Заполните профиль</h2>
<form class="profile-update" action="" name="postForm" method="POST" id="postForm" onsubmit="return false">
<h3>Основное:</h3>
										<div class="form-group1">
											<p><label for="nickname">Отображаемое имя (публичное): 
<input type="text" class="form-control required" placeholder="Псевдоним или Имя Фамилия" name="nickname"></label></p>
										</div>
										<div class="form-group1">
<p><label for="about">Об аккаунте:
	<input type="text" class="form-control required" placeholder="Об аккаунте" name="about"></label></p>
</div>
<div class="form-group1">
	<p><label for="avatar">Аватарка (соотношение сторон 1:1, квадратная): 
	<input type="text" class="form-control required" placeholder="URL-изображения" name="avatar"></label></p>
<div class="drdrop"><input type="button" id="addimg" data-storage="false" value="Загрузить аватарку" onclick="document.querySelector(&#39;#loadinp&#39;).click()" ></div><input id="loadinp" style="visibility: collapse; width: 0px;" type="file" onchange="upload(this.files[0])"><p></p>
</div>	
<div class="form-group1">
    <p><label for="gender">Пол: 
										<select class="form-control required" name="gender"><option value="">Не указан</option><option value="male">Мужской</option><option value="female">Женский</option></select></label></p>
										</div>
										<div class="form-group1">
											<p><label for="location">Город, страна
											<input type="text" class="form-control required" placeholder="Страна, Область, Город" name="location"></label></p>
</div>	
<div class="form-group1">
    <p><label for="Interests">Интересы (через запятую): 
<input type="text" class="form-control required" placeholder="" name="Interests"></label></p>
</div>
<div class="form-group1">
	<p>Дата рождения:<br />
	<label for="birthday_day">День: 
		<input type="text" class="form-control required" placeholder="День" name="birthday_day"></label> 
		<label for="birthday_month">Месяц: 
		<select class="form-control required" name="birthday_month"><option value="1">января</option><option value="2">февраля</option><option value="3">марта</option><option value="4">апреля</option><option value="5">мая</option><option value="6">июня</option><option value="7">июля</option><option value="8">августа</option><option value="9">сентября</option><option value="10">октября</option><option value="11">ноября</option><option value="12">декабря</option></select></label>
		<label for="birthday_year">Год: 
			<input type="text" class="form-control required" placeholder="Год" name="birthday_year"></label></p>
			</div>
<h2 class="tt" onclick="spoiler(`account_links`); return false">Ссылки (Соцсети, сайт и пр.) (Заполнять не обязательно)</h2>
<div id="account_links" class="terms" style="display: none;">
<div class="form-group1">
	<p><label for="site">Веб-сайт (Если есть): 
	<input type="text" class="form-control required" placeholder="http://" name="site"></label></p>
</div>	
<div class="form-group1">
	<p><label for="mail">E-mail: 
<input type="text" class="form-control required" placeholder="Адрес эл. почты" name="mail"></label></p>
</div>	
<div class="form-group1">
	<p><label for="telegram">Телеграм: 
	<input type="text" class="form-control required" placeholder="Логин в Telegram" name="telegram"></label></p>
</div>	
<div class="form-group1">
	<p><label for="instagram">Instagram: 
<input type="text" class="form-control required" placeholder="Логин в Instagram" name="instagram"></label></p>
</div>	
<div class="form-group1">
	<p><label for="vk">Вконтакте: 
<input type="text" class="form-control required" placeholder="Логин VK.com" name="vk"></label></p>
</div>	
<div class="form-group1">
	<p><label for="facebook">Facebook: 
<input type="text" class="form-control required" placeholder="Логин в Facebook" name="facebook"></label></p>
</div>	
<div class="form-group1">
	<p><label for="twitter">Твиттер: 
<input type="text" class="form-control required" placeholder="Логин в Twitter" name="twitter"></label></p>
</div>	
<div class="form-group1">
	<p><label for="skype">Скайп: 
<input type="text" class="form-control required" placeholder="Логин в Скайпе" name="skype"></label></p>
</div>	
<div class="form-group1">
	<p><label for="whatsapp">Whatsapp: 
<input type="text" class="form-control required" name="whatsapp"></label></p>
</div>	
<div class="form-group1">
	<p><label for="viber">Viber: 
<input type="text" class="form-control required" name="viber"></label></p>
</div>	
</div>
										<div class="form-group1">
											<br>
											<input type="button" onclick="	profile_save();" value="Сохранить профиль">
										</div>										
</form>
</div>
<script src="'.$conf['siteUrl'].'blockchains/viz/apps/manage/pages/profile/footer.js"></script>
'; ?>