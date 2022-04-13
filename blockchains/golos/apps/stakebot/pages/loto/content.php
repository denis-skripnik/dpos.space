<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
  global $conf;
    $result = file_get_contents('http://178.20.43.121:3000/golos-api?service=stakebot&type=loto');
    $text = nl2br($result, false);
    $content = '<p align="center"><a href="'.$conf['siteUrl'].'golos/stakebot">К списку текущих ставок</a></p>
<h2>Лотерея среди получающих CLAIM</h2>
<ul><li>2 раза в сутки в полночь и полдень по МСК</li>
<li>От 50000 GESTS (18000 СГ)</li>
<li>Для участия запускаете <a href="https://t.me/golos_stake_bot" target="_blank">@golos_stake_bot</a> и авторизуете Golos аккаунт.</li>
</ul>
<h2>Список билетов</h2>
<p>'.$text.'</p>';
return $content;
?>