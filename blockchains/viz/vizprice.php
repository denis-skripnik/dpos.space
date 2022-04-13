<?php
$html = file_get_contents('http://178.20.43.121:3100/viz-api?service=prices');
$data = json_decode($html, true)['result'];

echo '<hr>
<p>Цена покупки: <font color="green">'.$data['average_ask_price'].'</font> $, цена продажи: <font color="red">'.$data['average_bid_price'].'</font> $, <a href="/viz/buy" target="_blank">Способы торговли</a> (стоимость рассчитана при купле продаже на 100 USD).<br>
Последнее обновление: '.explode('.', $data['datetime'])[0].' GMT</p>';