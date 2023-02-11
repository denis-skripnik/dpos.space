<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
  global $conf;
return '<h2>Выберите раздел сервиса</h2>
<p>В связи с появлением большого количества токенов в будущем, сервис обновлён: теперь требуется выбрать раздел и токен.</p>
<ul><li><a href="'.$conf['siteUrl'].'golos/donates/donators" target="_blank">Топ донатящих</a></li>
<li><a href="'.$conf['siteUrl'].'golos/donates/posts" target="_blank">Топ постов, получивших донаты</a></li>
<li><a href="'.$conf['siteUrl'].'golos/donates/comments" target="_blank">Топ комментариев, получивших донаты</a></li>
</ul>
<h2>Расчёт суммы донатов</h2>
<form>
<p><label for="select_donates_login">Логин на Голосе без @<br>
<input type="text" name="select_donates_login" value=""></label></p>
<p><label for="select_donates_time">За сколько дней получать донаты<br>
<input type="number" min="1" step="1" name="select_donates_time" value="1"></label></p>
<p><label for="select_donates_token">Выберите токен<br>
<select name="select_donates_token" id="tokens_select">
<option value="GOLOS">GOLOS</option>
</select></label></p>
<p><input type="button" name="calc_donates" id="calc_donates" value="Рассчитать"></p>
</form>
<div id="sun_donates"></div>
<div id="gp_for_donates"></div>';
?>