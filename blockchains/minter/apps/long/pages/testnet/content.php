<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
  $html = file_get_contents('http://138.201.91.11:3258/smartfarm');
  $res = json_decode($html, true);
  $explorer = file_get_contents('https://node-api.testnet.minter.network/v2/swap_pool/0/1957');
  $pool = json_decode($explorer, true);
$current_price = ((float)$pool['amount0'] / (10 ** 18)) / ((float)$pool['amount1'] / (10 ** 18));
$price_changed = ($current_price - 1) / 1 * 100;
$change_k = (0.2 * ($price_changed / 100)) / 10;
$percent = 2 * (0.2 + $change_k);

$content = '<p align="center"><strong><a href="/minter/long/testnet-loto">К лотерее</a></strong></p>
<h2>О SMARTFARM (<a href="/minter/long/phelosophy" target="_blank">Философия проекта</a>)</h2>
<p align="center"><strong>ВНИМАНИЕ! Это Testnet версия токена LONG SMARTFARM<br>
Фарминг в тестовой сети Minter каждый час. За обнаружение багов награда реальными токенами.</strong></p>
<p>Это токен с фармингом в SMARTFARM, процент которого зависит от курса токена. Растёт курс: растёт процент фарминга. Падает: падает процент.<br>
Сумма фарминга для конкретного провайдера ликвидности берётся от количества LP-токенов, умноженного на 2.</p>
<p>Пул <a href="https://explorer.testnet.minter.network/pools/MNT/SMARTFARM" target="_blank">MNT/SMARTFARM</a></p>
<p><a href="https://t.me/long_project" target="_blank">Новости проекта в Telegram</a>, <a href="https://t.me/long_project_chat" target="_blank">Обсуждения и ответы на вопросы в Telegram</a></p>
<div class="tt" onclick="spoiler(`formulas`); return false"><strong>Раскрыть формулы</strong></div>
<div id="formulas" class="terms" style="display: none;">
<h3>Формулы</h3>
<ol><li>Процент изменения курса SMARTFARM = (Текущий курс - стартовая в 1 MNT) / стартовая * 100;
<li>Текущий процент (СМ. список в следующем блоке) = Стартовый процент 0.2 + (0.2 * (процент изменения курса SMARTFARM в MNT / 100)) / 10);</li>
<li>Сумма получения = LP провайдера * 2 * (текущий процент / 100);<br>
Далее это умножается на коэффицент.<br>
коэффициент = 1 + (инвест_дни / 100);<br>
Если сумма добавления в пул / сумма получения = 1 и более, прибавляется +0.01 к коэффициенту;<br>
Если от 0.5 до 1 - +0.005 - +0.01.</li>
</ol>
</div>
<h3>Основные данные</h3>
<ul><li>Стартовая цена: '.$res['start_price'].' MNT</li>
<li>Начальный процент, от которого идёт изменение в зависимости от курса токена: '.$res['start_percent'].'%</li>
<li>Текущий процент на момент просмотра страницы: '.round($percent, 5).'%</li></ul>
<h3>Провайдеры</h3>
<p>Чем больше инвестиционных дней, тем больше фарминг (если вы выводите из пула хоть сколько-то SMARTFARM, дни обнуляются. Тоже самое при переводе LP-токенов на другой адрес). Добавления в пул не обнуляют дни (это даже можно назвать реинвестом).</p>
<p><strong>
Если вы вкладываете всю полученную при последней рассылке или даже больше, получаете +1 доп. инвестиционный день. Если от половины до максимума - 0.5-1 инвест. день.<br>
Например, если вы получили 1000 SMARTFARM и вложили в пул 500, получите +0.5 инвест. дней, а при вкладе 800 SMARTFARM - +0.8 инвест. дней.</strong></p>
<hr>
<table>
<thead><tr><th>№</th>
<th>Адрес</th>
<th>Ликвидность (кол-во LP-токенов)</th>
<th>Инвестиционных дней</th>
<th>Полученная в последний раз сумма</th>
<th>Сумма выигрыша в лотерее</th>
<th>Добавленная сумма (для бонуса к инвест. дням)</th>
<th>Процент будущего фарминга</th>
<th>Вероятность выигрыша в лотерее</th>
</tr></thead>
<tbody>';
function ticketsSum($a, $b) {
  $provider_tickets = (int)(($b['liquidity'] / 100) * (1 + ($b['invest_days'] / 300)));
$a += $provider_tickets;
return $a;
}
$top_providers = array_slice($res['providers'], 0, 49);
$tickets = array_reduce($top_providers, "ticketsSum");

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

if ($key <= 50) {
  $provider_tickets = (int)(($provider['liquidity'] / 100) * (1 + ($provider['invest_days'] / 300)));
} else {
  $provider_tickets = 0;
}
$tickets_probability = $provider_tickets / $tickets * 100;

$content .= '<tr>
<td>'.$key.'</td>
<td><a href="https://explorer.testnet.minter.network/address/'.$provider['address'].'" target="_blank">'.$provider['address'].'</a></td>
<td>'.round($provider['liquidity'], 5).'</td>
<td>'.$provider['invest_days'].'</td>
<td>'.round($provider['get_amount'], 5).' SMARTFARM</td>
<td>'.round($get_loto, 5).' SMARTFARM</td>
<td>'.round($provider['add_amount'], 5).' SMARTFARM</td>
<td>'.round($provider_percent, 5).'%</td>
<td>'.round($tickets_probability, 5).'%</td>
</tr>';
}
$content .= '</tbody></table>';
return $content;
?>