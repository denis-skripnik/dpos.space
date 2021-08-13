<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
  $html = file_get_contents('http://138.201.91.11:3852/smartfarm');
  $res = json_decode($html, true);
  $explorer = file_get_contents('https://api.minter.one/v2/swap_pool/0/2782');
  $pool = json_decode($explorer, true);
$current_price = ((float)$pool['amount0'] / (10 ** 18)) / ((float)$pool['amount1'] / (10 ** 18));
$price_changed = ($current_price - 1) / 1 * 100;
$change_k = (0.2 * ($price_changed / 100)) / 10;
$percent = 2 * (0.2 + $change_k);

$content = '<p align="center"><strong><a href="/minter/long/loto">К лотерее</a></strong></p>
<h2>О LONG (<a href="/minter/long/phelosophy" target="_blank">Философия проекта</a>)</h2>
<p>Это токен с фармингом в LONG, процент которого зависит от курса токена. Растёт курс: растёт процент фарминга. Падает: падает процент.<br>
Сумма фарминга для конкретного провайдера ликвидности берётся от количества LP-токенов, умноженного на 2.</p>
<p>Пул <a href="https://chainik.io/pool/BIP/LONG" target="_blank">BIP/LONG</a></p>
<div class="tt" onclick="spoiler(`formulas`); return false"><strong>Раскрыть формулы</strong></div>
<div id="formulas" class="terms" style="display: none;">
<h3>Формулы</h3>
<ol><li>Процент изменения курса LONG = (Текущий курс - стартовая в 1 BIP) / стартовая * 100;
<li>Текущий процент (СМ. список в следующем блоке) = Стартовый процент 0.2 + (0.2 * (процент изменения курса LONG в BIP / 100)) / 10);</li>
<li>Сумма получения = LP провайдера * 2 * (текущий процент / 100);<br>
Далее это умножается на коэффицент.<br>
коэффициент = 1 + (инвест_дни / 100);<br>
Если сумма добавления в пул / сумма получения = 1 и более, прибавляется +0.01 к коэффициенту;<br>
Если от 0.5 до 1 - +0.005 - +0.01.</li>
</ol>
</div>
<h3>Основные данные</h3>
<ul><li>Стартовая цена: '.$res['start_price'].' BIP</li>
<li>Начальный процент, от которого идёт изменение в зависимости от курса токена: '.$res['start_percent'].'%</li>
<li>Текущий процент на момент просмотра страницы: '.round($percent, 5).'%</li></ul>
<h3>Провайдеры</h3>
<p>Чем больше инвестиционных дней, тем больше фарминг (если вы выводите из пула хоть сколько-то LONG, дни обнуляются. Тоже самое при переводе LP-токенов на другой адрес). Добавления в пул не обнуляют дни (это даже можно назвать реинвестом).</p>
<p><strong>
Если вы вкладываете всю полученную при последней рассылке или даже больше, получаете +1 доп. инвестиционный день. Если от половины до максимума - 0.5-1 инвест. день.<br>
Например, если вы получили 1000 LONG и вложили в пул 500, получите +0.5 инвест. дней, а при вкладе 800 LONG - +0.8 инвест. дней.</strong></p>
<hr>
<p align="center">Кошелёк отправки фарминга и лотереи LONG: <a href="https://dpos.space/minter/profiles/Mx01029d73e128e2f53ff1fcc2d52a423283ad9439" target="_blank">Mx01029d73e128e2f53ff1fcc2d52a423283ad9439</a></p>
<table>
<thead><tr><th>№</th>
<th>Адрес</th>
<th>Ликвидность (кол-во LP-токенов)</th>
<th>Инвестиционных дней</th>
<th>Полученная в последний раз сумма</th>
<th>Сумма выигрыша в лотерее</th>
<th>Добавленная сумма (для бонуса к инвест. дням)</th>
<th>Процент будущего фарминга</th>
</tr></thead>
<tbody>';
foreach($res['providers'] as $key => $provider) {
$key++;
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

$content .= '<tr>
<td>'.$key.'</td>
<td><a href="https://chainik.io/address/'.$provider['address'].'" target="_blank">'.$provider['address'].'</a></td>
<td>'.round($provider['liquidity'], 5).'</td>
<td>'.$provider['invest_days'].'</td>
<td>'.round($provider['get_amount'], 5).' LONG</td>
<td>'.round($get_loto, 5).' LONG</td>
<td>'.round($provider['add_amount'], 5).' LONG</td>
<td>'.round($provider_percent, 5).'%</td>
</tr>';
}
$content .= '</tbody></table>';
return $content;
?>