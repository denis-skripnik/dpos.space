<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<div id="posting_auth_msg" style="display: none;"><p>Для импорта необходим регулярный ключ. Укажите его <a href="'.$conf['siteUrl'].'viz/accounts" target="_blank">на странице аккаунтов</a>.</p></div>
<div id="posting_page">
<form>
<label for="url-input">Url статьи в telegra.ph:</label>
<input type="text" id="url-input" name="url">
<br>
<button type="button" id="import-button">Импортировать</button>
</form>
</div>'; ?>