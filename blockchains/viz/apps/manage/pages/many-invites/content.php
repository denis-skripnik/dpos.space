<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<h2>Страницы сервиса</h2>
<table><tr><th>Создание множества чеков</th>
<th><a href="'.$conf['siteUrl'].'viz/manage/profile">Профиль</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/witnesses">Делегаты</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/workers">Заявки воркеров</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/create-account">Создать аккаунт/субаккаунт</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/access">Доступы аккаунта</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/reset-keys">Сброс ключей</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/witness">Управление делегатом</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/multisig">Мультисиг</a></th>
</tr></table>
<div id="auth_msg" style="display: none;"><p>Вы не авторизовались. Просьба сделать это <a href="'.$conf['siteUrl'].'viz/accounts" target="_blank">здесь</a></p></div>
<div id="active_auth_msg" style="display: none;"><p>Вы не ввели активный ключ. Пожалуйста удалите текущий аккаунт и авторизуйтесь с указанием и регулярного, и активного ключа, здесь: <a href="'.$conf['siteUrl'].'viz/accounts" target="_blank">здесь</a></p></div>
<div id="active_page">
<p>Введите количество генерируемых чеков и сумму каждого чека, нажмите на кнопку "Создать ключи". Сервис их создаст для вас и поместит в многострочное текстовое поле.</p>
<form class="form">
<p><input type="text" id="invites_count" value="" placeholder="Введите количество инвайт-кодов (чеков)"></p>
<p><input type="text" id="invites_amount" value="" placeholder="Введите сумму каждого инвайт-кода (чека)"></p>
<p><input type="button" value="создать" id="send_invites_data"></p>
</form>
<h2>Результат</h2>
<form class="form">
<p><textarea id="result_invites"></textarea></p>
<p><input type="button" value="Использовать чек в соц. капитал" id="use_invites_balance"></p>
<hr>
<p><input type="button" value="Использовать чек в баланс VIZ" id="claim_invites_balance"></p>
</form>
</div>
<script src="'.$conf['siteUrl'].'blockchains/viz/apps/manage/pages/many-invites/footer.js"></script>
'; ?>