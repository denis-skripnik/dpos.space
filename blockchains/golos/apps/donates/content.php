<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
  global $conf;
return '<h2>Выберите раздел сервиса</h2>
<p>В связи с появлением большого количества токенов в будущем, сервис обновлён: теперь требуется выбрать раздел и токен.</p>
<ul><li><a href="'.$conf['siteUrl'].'golos/donates/donators" target="_blank">Топ донатящих</a></li>
<li><a href="'.$conf['siteUrl'].'golos/donates/posts" target="_blank">Топ постов, получивших донаты</a></li>
<li><a href="'.$conf['siteUrl'].'golos/donates/comments" target="_blank">Топ комментариев, получивших донаты</a></li>
</ul>';
?>