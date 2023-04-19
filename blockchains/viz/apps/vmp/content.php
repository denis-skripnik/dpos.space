<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
$tokens_array = ['USDTE', 'USDCE', 'USDTBSC', 'USDCBSC', 'DAIE', 'DAIBSC', 'BTC', 'BTCBSC', 'ETH', 'MUSD', 'HUB', 'METAGARDEN ', 'BIP'];
$pools = '';
foreach ($tokens_array as $token) {
$pools .= '<a href="https://chainik.io/pool/'.$token.'/VIZCHAIN" target="_blank">'.$token.'/VIZCHAIN</a> ';
}
return '<h2>Поддерживаемые токены Minter, в пулах с которыми идёт фарминг</h2>
<p><strong>'.$pools.'</strong></p>
<h2>Подробности про работу со шлюзом</h2>
<p><strong><a href="https://viz.media/zapusk-shlyuza-viz-v-minter/" target="_blank">Читать</a></strong></p>
<h2>Ваша доходность с фарминга</h2>
<form>
<p><label for="farmer">Логин в Viz без @</label><br>
<input type="text" name="farmer" id="farmer"></p>
<p><input type="button" id="farm_calc" value="Рассчитать"></p>
</form>
<div id="farm_result"></div>'; ?>