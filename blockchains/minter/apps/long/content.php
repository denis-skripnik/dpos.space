<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
  $html = file_get_contents('http://138.201.91.11:3852/smartfarm');
  $res = json_decode($html, true);
  $explorer = file_get_contents('https://api.minter.one/v2/swap_pool/0/2782');
  $pool = json_decode($explorer, true);
$current_price = ((float)$pool['amount0'] / (10 ** 18)) / ((float)$pool['amount1'] / (10 ** 18));
$price_changed = ($current_price - 1) / 1 * 100;
$change_k = (0.2 * ($price_changed / 100)) / 10;
$percent = 0.2 + $change_k;

  $content = '<h2>О LONG</h2>
<p>Это токен с фармингом в LONG, процент которого зависит от курса токена. Растёт курс: растёт процент фарминга. Падает: падает процент.<br>
Сумма фарминга для конкретного провайдера ликвидности берётся от количества LP-токенов, умноженного на 2.</p>
<p>Пул <a href="https://chainik.io/pool/BIP/LONG" target="_blank">BIP/LONG</a></p>
<h3>Основные данные</h3>
<ul><li>Стартовая цена: '.$res['start_price'].' BIP</li>
<li>Начальный процент, от которого идёт изменение в зависимости от курса токена: '.$res['start_percent'].'%</li>
<li>Текущий процент на момент просмотра страницы: '.round($percent, 5).'%</li></ul>
<h3>Провайдеры</h3>
<p>Чем больше инвестиционных дней, тем больше фарминг (если вы выводите из пула хоть сколько-то LONG, дни обнуляются. Тоже само при переводе LP-токенов на другой адрес). Добавления в пул не обнуляют дни (это даже можно назвать реинвестом).</p>
<hr>
<table>
<thead><tr><th>Адрес</th>
<th>Ликвидность (кол-во LP-токенов)</th>
<th>Инвестиционных дней</th></tr></thead>
<tbody>';
foreach($res['providers'] as $provider) {
$content .= '<tr>
<td><a href="https://chainik.io/address/'.$provider['address'].'" target="_blank">'.$provider['address'].'</a></td>
<td>'.round($provider['liquidity'], 5).'</td>
<td>'.$provider['invest_days'].'</td>
</tr>';
}
$content .= '</tbody></table>';
return $content;
?>