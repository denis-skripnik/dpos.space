<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<h2>Страницы сервиса</h2>
<table><tr><th>Подписки</th>
<th><a href="'.$conf['siteUrl'].'golos/manage/profile">Профиль</a></th>
<th><a href="'.$conf['siteUrl'].'golos/manage/witnesses">Делегаты</a></th>
<th><a href="'.$conf['siteUrl'].'golos/manage/witness">Управление делегатом</a></th>
<th><a href="'.$conf['siteUrl'].'golos/manage/workers">Заявки воркеров</a></th>
<th><a href="'.$conf['siteUrl'].'golos/manage/create-account">Создать аккаунт</a></th>
<th><a href="'.$conf['siteUrl'].'golos/manage/access">Доступы аккаунта</a></th>
<th><a href="'.$conf['siteUrl'].'golos/manage/reset-keys">Сброс ключей</a></th>
<th><a href="'.$conf['siteUrl'].'golos/manage/multisig">Мультисиг</a></th>
</tr></table>
<div id="auth_msg" style="display: none;"><p>Вы не авторизовались. Просьба сделать это <a href="'.$conf['siteUrl'].'golos/accounts" target="_blank">здесь</a></p></div>
<div id="posting_page">
<script src="'.$conf['siteUrl'].'blockchains/golos/apps/manage/pages/subscribes/helper.js"></script>
<h1>Список подписок с возможностью отписаться</h1>
<table id="following_table">
<tr><th>Логин</th>
<th>Действие</th>
</tr>
</table>
</div>
<script>getFollowingMe();</script>
'; ?>