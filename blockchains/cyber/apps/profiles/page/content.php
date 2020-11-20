<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
global $conf;
return '<div id="other_data" style="display: none;">
<p><a data-fancybox class="ajax_modal" data-src="#ajax_modal_content" href="javascript:;" data-url="'.$conf['siteUrl'].'blockchains/cyber/apps/profiles/donate.php" data-params="to='.pageUrl()[2].'">Донат</a></p>
<h2>Пропускная способность</h2>
<p><strong><span id="bandwidth_remained"></span> из <span id="bandwidth_max_value"></span></strong></p>
<h2>Доступный к переводу балансы</h2>
<ul id="balances"></ul>
<h2>Другие данные</h2>
<ul><li>Публичный ключ: <span id="public_key"></span></li>
<li>Аккаунт №<span id="account_number"></span></li>
</ul>
</div>
<h2>Введите в поле ниже адрес любого пользователя блокчейна Cyber:</h2>
<form method = "post" action = "">
  <input type = "hidden" name = "chain" value = "cyber">
  <input type = "hidden" name = "service" value = "profiles">
  <label for = "user">Введите адрес кошелька (начинается с cyber):</label>
  <input type = "text" name = "user" value="'.$user.'">
  <input type = "submit" value = "узнать инфу"/>
</form>
';
?>