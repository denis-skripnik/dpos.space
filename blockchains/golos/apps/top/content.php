<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<h2>Выберите вариант сортировки рейтинга</h2>
<ol><li><a href="'.$conf['siteUrl'].'golos/top/gbg">GBG</a></li>
<li><a href="'.$conf['siteUrl'].'golos/top/golos">GOLOS</a></li>
<li><a href="'.$conf['siteUrl'].'golos/top/tip_balance">TIP-баланс</a></li>
<li><a href="'.$conf['siteUrl'].'golos/top/gp">СГ</a></li>
<li><a href="'.$conf['siteUrl'].'golos/top/delegated_gp">Делегированная СГ</a></li>
<li><a href="'.$conf['siteUrl'].'golos/top/received_gp">Полученная делегированием СГ</a></li>
<li><a href="'.$conf['siteUrl'].'golos/top/effective_gp">Эффективная СГ (личная - делегированная + полученна делегированием)</a></li>
<li><a href="'.$conf['siteUrl'].'golos/top/emission_received_gp">Полученная с эмиссией СГ</a></li>
<li><a href="'.$conf['siteUrl'].'golos/top/emission_delegated_gp">Делегированная с эмиссией СГ</a></li>
<li><a href="'.$conf['siteUrl'].'golos/top/reputation">Репутация</a></li>
</ol>
<h2>UIA активы</h2>
<ul id="uia_assets_users"></ul>
'; ?>