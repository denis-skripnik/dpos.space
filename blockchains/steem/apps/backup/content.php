<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
$amount_account = 'denis-skripnik';
return '<h2>Список действий</h2>
<ol><li>Перейдите на страницу своего аккаунта в <a href="https://steemit.com" target="_blank">steemit.com</a>;</li>
<li>Отправьте 0.5 SBD или 1 STEEM на аккаунт @'.$amount_account.'. Заметка (memo):<br />
posts;<br></li>
<li>Введите логин в форме ниже</li>
<li>Выберите вариант получения репостов в списке материалов.</li></ol>
<h2><strong>Важно:</strong></h2>
<ol><li><strong>Сумма действительна, пока ваша транзакция с платежом не опустится на 2000 позиций.</strong></li>
<li><strong>Вы можете скачать только записи не старше 11 месяцев - ограничение взаимодействия с Нодами блокчейна</strong></li>
<li><strong>Если вы оплатили услуги сервиса, но отображается по-прежнему сообщение о требующейся оплате, просьба пробовать несколько раз: возможно проблемы с публичной Нодой, к которой производится подключение. Если же сообщение очень долго, просьба написать в Telegram чат <a href="https://t.me/dpos_space" target="_blank">@dpos_space</a></strong></li></ol>

<form class="form" action="" method="post">
<input type="hidden" name="chain" value="steem">
<input type="hidden" name="service" value="backup">
<p><label for="user">Имя пользователя (логин) на Steem (Без "@"):</label>
<input type="text" name="user" value=""></p>
<p><label for="reblogs">Скачивать ли репосты?</label></p>
<ul>
<li><input type="radio" name="reblogs" value="yes2" checked>Нет: только посты моего аккаунта</li>
<li><input type="radio" name="reblogs" value="yes3">Да: все репосты</li></ul>
<p><label name="contentformat">Выберите формат сохранения материалов:</label>
<select name="contentformat">
<option value="Markdown">Markdown (Используется по умолчанию в '.($chain_name ?? $chain_name ?? "").': сервис не производит конвертаций текста постов)</option>
<option value="HTML">HTML (Скорее всего, понадобится только если у вас есть свой сайт, не поддерживающий MD, куда надо закинуть посты)</option>
</select></p>
<p align="center"><input type="submit" value="Запуск"></p>
</form>';
?>