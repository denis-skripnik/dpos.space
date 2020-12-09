<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<h2>Страницы сервиса</h2>
<table><tr><th>Управление делегатом</th>
<th><a href="'.$conf['siteUrl'].'hive/manage/witnesses">Делегаты</a></th>
<th><a href="'.$conf['siteUrl'].'hive/manage/profile">Профиль</a></th>
</tr></table>
<div id="auth_msg" style="display: none;"><p>Вы не авторизовались. Просьба сделать это <a href="'.$conf['siteUrl'].'hive/accounts" target="_blank">здесь</a></p></div>
<div id="active_auth_msg" style="display: none;"><p>Вы не ввели активный ключ. Пожалуйста удалите текущий аккаунт и авторизуйтесь с указанием и регулярного, и активного ключа, здесь: <a href="'.$conf['siteUrl'].'hive/accounts" target="_blank">здесь</a></p></div>
<div id="active_page">
<h2 class="tt" onclick="spoiler(`witness_activation`); return false">Активация/деактивация и указание url</h2>
<div id="witness_activation" class="terms" style="display: none;">
<p>В поле "публичный ключ делегата" впишите ваш ключ делегата, который генерировали при запуске Ноды. Он должен начинаться с HIVE. Если хотите отключить делегата, оставьте поле пустым.</p>
<form class="form">
<p><label for="witness_url">Url делегата (Страница с подробной информацией о делегате и его деятельности): 
<input type="text" name="witness_url" value="" placeholder="Url делегата"></label></p>
<p><label for="witness_key">Публичный ключ делегата: 
    <input type="text" name="witness_key" value="" placeholder="STM..."></label></p>
<p><input type="button" id="witness_options" value="Сохранить"></p>
</form>
</div>
<h2 class="tt" onclick="spoiler(`witness_props`); return false">Параметры делегата</h2>
<div id="witness_props" class="terms" style="display: none;">
<form class="form" name="props_form">
<div id="props_list"></div>
<p><input type="button" id="save_props" value="Сохранить"></p>
</form>
</div>
</div>
<script src="'.$conf['siteUrl'].'/blockchains/hive/apps/manage/pages/witness/footer.js"></script>
'; ?>