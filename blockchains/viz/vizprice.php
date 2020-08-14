<?php
$html = file_get_contents('http://138.201.91.11:3100/viz-api?service=prices');
$data = json_decode($html, true);

echo '<hr>
<p>Цена покупки: <font color="green">'.$data['average_ask_price'].'</font> $, цена продажи: <font color="red">'.$data['average_bid_price'].'</font> $, <a href="https://wallet.bitshares.org/#/market/XCHNG.VIZ_RUDEX.USDT" target="_blank">Перейти к торговле</a> (стоимость рассчитана при купле продаже на 100 USD).<br>
Последнее обновление: '.explode('.', $data['datetime'])[0].' GMT</p>';