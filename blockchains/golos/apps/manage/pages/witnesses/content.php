<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<h2>Страницы сервиса</h2>
<table><tr><th>Делегаты</th>
<th><a href="'.$conf['siteUrl'].'golos/manage/witness">Управление делегатом</a></th>
<th><a href="'.$conf['siteUrl'].'golos/manage/profile">Профиль</a></th>
<th><a href="'.$conf['siteUrl'].'golos/manage/workers">Заявки воркеров</a></th><th><a href="'.$conf['siteUrl'].'golos/manage/subscribes">Подписки</a></th>
<th><a href="'.$conf['siteUrl'].'golos/manage/create-account">Создать аккаунт</a></th>
<th><a href="'.$conf['siteUrl'].'golos/manage/access">Доступы аккаунта</a></th>
<th><a href="'.$conf['siteUrl'].'golos/manage/reset-keys">Сброс ключей</a></th>
<th><a href="'.$conf['siteUrl'].'golos/manage/multisig">Мультисиг</a></th>
</tr></table>
<div id="auth_msg" style="display: none;"><p>Вы не авторизовались. Просьба сделать это <a href="'.$conf['siteUrl'].'golos/accounts" target="_blank">здесь</a></p></div>
<div id="active_auth_msg" style="display: none;"><p>Вы не ввели активный ключ. Пожалуйста удалите текущий аккаунт и авторизуйтесь с указанием и регулярного, и активного ключа, здесь: <a href="'.$conf['siteUrl'].'golos/accounts" target="_blank">здесь</a></p></div>
<div id="active_page">
<h2 class="tt" onclick="spoiler(`proxy_vote`); return false">Прокси</h2>
<div id="proxy_vote" class="terms" style="display: none;">
<p>Установка прокси голосования за делегатов позволяет вам передать голосование за делегатами тем, кому вы доверяете.</p>
<form class="form">
<label for="proxy_login">Логин прокси: 
<input type="text" name="proxy_login" value="" placeholder="Логин прокси аккаунта"></label></p>
<p><input type="button" onclick="proxyVote(`proxy_login`)" value="Установить"></p>
</form>
</div>
<div id="proxy"></div>
<div id="delete_proxy">
<form class="form">
<input type="hidden" name="delete_proxy_login" value="">
<p><input type="button" onclick="proxyVote(`delete_proxy_login`)" value="Удалить прокси"></p>
</form>
</div>
<h2 class="tt" onclick="spoiler(`witness_form_vote`); return false">Голосование за делегата путём ввода его логина (не рекомендуется)</h2>
<div id="witness_form_vote" class="terms" style="display: none;">
<p>Мы не рекомендуем использовать данный метод, т.к. выше вероятность неправильно ввести имя пользователя.</p>
<form class="form">
<label for="witness_login">Логин делегата (без @): 
<input type="text" name="witness_login" value="" placeholder="Логин делегата"></label></p>
<p><input type="button" onclick="oneWitnessVote()" value="Проголосовать"></p>
</form>
</div>
<h2>Список делегатов</h2>
<form class="form">
<ol id="witnesses_list"></ol>
<p><input type="button" onclick="witnessesVote()" value="Проголосовать за выбранных"></p>
</form>
</div>
<script src="'.$conf['siteUrl'].'blockchains/golos/apps/manage/pages/witnesses/footer.js"></script>
'; ?>