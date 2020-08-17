<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<h2>Выберите токен</h2>
<ol><li><a href="'.$conf['siteUrl'].'golos/top/gbg">GBG</a></li>
<li><a href="'.$conf['siteUrl'].'golos/top/golos">GOLOS</a></li>
<li><a href="'.$conf['siteUrl'].'golos/top/tip_balance">TIP-баланс</a></li>
<li><a href="'.$conf['siteUrl'].'golos/top/gp">СГ</a></li>
<li><a href="'.$conf['siteUrl'].'golos/top/delegated_gp">Делегированная СГ</a></li>
<li><a href="'.$conf['siteUrl'].'golos/top/received_gp">Полученная делегированием СГ</a></li>
<li><a href="'.$conf['siteUrl'].'golos/top/effective_gp">Эффективная СГ (личная - делегированная + полученна делегированием)</a></li>
<li><a href="'.$conf['siteUrl'].'golos/top/reputation">Репутация</a></li>
</ol>
'; ?>