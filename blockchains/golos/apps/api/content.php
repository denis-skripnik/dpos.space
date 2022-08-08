<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
  global $conf;
return '<p>Кэш для фида 12 часов, для остального одна минута.</p>
<ol>
<li>Получения фида для делегата: https://dpos.space/golos/api/get_feed</li>
<li>Топ пользователей в виде API: https://dpos.space/golos/api/top?token=GOLOS&page=2<br>
Либо без page (тогда будет страница 1): https://dpos.space/golos/api/top?token=GOLOS<br>
Вместо GOLOS можно указать GBG, GP, delegate_gp, received_gp и пр. за исключением uia.</li>
<li>Топ по UIA: https://dpos.space/golos/api/uia-top?token=WHALER&page=2<br>
&page=2 можно не указывать - будет первая страница;<br>
WHALER можно заменить на иной токен, например, PRIZM или VIZUIA.</li>
</ol>';
?>