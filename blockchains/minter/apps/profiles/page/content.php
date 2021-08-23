<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
global $conf;
$api_price = file_get_contents('http://138.201.91.11:3852/smartfarm');
$res = json_decode($api_price, true);
$explorer = file_get_contents('https://api.minter.one/v2/swap_pool/0/2782');
$pool = json_decode($explorer, true);
$current_price = ((float)$pool['amount0'] / (10 ** 18)) / ((float)$pool['amount1'] / (10 ** 18));
$price_changed = ($current_price - 1) / 1 * 100;
$change_k = (0.2 * ($price_changed / 100)) / 10;
$percent = 2 * (0.2 + $change_k);

$html = file_get_contents('http://138.201.91.11:3852/smartfarm/provider?address='.pageUrl()[2]);
$provider = json_decode($html, true);
$long_stats = '';
if (isset($provider) && count($provider) > 0) {
  $get_loto = (isset($provider['get_loto']) && $provider['get_loto'] && $provider['get_loto'] >= 0 ? $provider['get_loto'] : 0);
$k = 1 + ($provider['invest_days'] / 100);
if ($provider['add_amount'] && $provider['get_amount'] && $provider['get_amount'] > 0) {
  $reinvest_bonus = $provider['add_amount'] / $provider['get_amount'];
  if ($reinvest_bonus >= 1 && $get_loto / 2 <= $provider['add_amount']) {
    $k += 0.01;
  } else if ($reinvest_bonus >= 1 && $get_loto / 2 > $provider['add_amount']) {
    $loto_bonus = $provider['add_amount'] / $get_loto;
        $add_loto_bonus = 1;
        if ($loto_bonus < 1) {
            $add_loto_bonus = $loto_bonus;
        }
        $k += 0.01 + ($add_loto_bonus / 100);
    } else if ($reinvest_bonus >= 0.5 && $reinvest_bonus < 1) {
      $k += $reinvest_bonus / 100;
  }
}
$provider_percent = $percent * $k;

$get_loto_text = '';
if ($provider['get_loto'] > 0) $get_loto_text = ', лотереи: '.$provider['get_loto'];
$long_stats = '<h2>Статистика в <a href="/minter/long" target="_blank">LONG</a></h2>
<ul><li>Инвест. дней: '.$provider['invest_days'].'</li>
<li>Сумма получения фарминга: '.round($provider['get_amount'], 5).round($get_loto_text, 5).' LONG</li>
<li>Процент будущего фарминга: '.round($provider_percent, 5).'%</li>
</ul>';
}

return '<h2>Балансы</h2>
<ul id="balances"></ul>
<h2>HUB в других блокчейнах</h2>
<ul><li>В Ethereum: <span id="ethereum_hub"></span></li>
<li>В BSC: <span id="bsc_hub"></span></li>
</ul>
'.$long_stats.'
<h2>История транзакций</h2>
<table><thead><tr><th>Дата</th>
<th>Блок</th>
<th>Хеш транзакции</th>
<th>Тип</th>
<th>Сумма</th>
<th>Сообщение</th></tr>
</thead>
<tbody id="history_tbody"></tbody></table>
<div id="history_pages"></div>
<h2>Введите в поле ниже адрес любого пользователя блокчейна Minter:</h2>
<form class="form" method = "post" action = "">
  <input type = "hidden" name = "chain" value = "minter">
  <input type = "hidden" name = "service" value = "profiles">
  <label for = "user">Введите адрес кошелька (начинается с MX):</label>
  <input type = "text" name = "user" value="'.$user.'">
  <input type = "submit" value = "узнать инфу"/>
</form>
'; ?>