<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
$address = file_get_contents('https://api.minter.one/v2/addresses?addresses=Mx01029d73e128e2f53ff1fcc2d52a423283ad9439&addresses=Mx6b897dff137ba8e6847812ae09ad46d709da7ec4');
$addresses = json_decode($address, true)['addresses'];
  $html = file_get_contents('http://138.201.91.11:3852/smartfarm');
  $res = json_decode($html, true);
  $explorer = file_get_contents('https://api.minter.one/v2/swap_pool/0/2782');
  $pool = json_decode($explorer, true);
$all_bip = ((float)$pool['amount0'] / (10 ** 18));
  $all_long = ((float)$pool['amount1'] / (10 ** 18));
  $current_price = $all_bip / $all_long;
$price_changed = ($current_price - 1) / 1 * 100;
$change_k = (0.7 * ($price_changed / 100)) / 10;
$max_percent = 0.7 + $change_k;
if ($max_percent < 0.7) $max_percent = 0.7;
if ($max_percent > 1) $max_percent = 1;
$percent = $res['start_percent'];
$all_bip_liquidity = $all_bip * 2;

$l = (float)$pool['liquidity'] / (10 ** 18);

$bip_prices = file_get_contents('https://api.coingecko.com/api/v3/simple/price?ids=bip&vs_currencies=usd,rub');
$res_bip_prices = json_decode($bip_prices, true);
$usd_bip_price = $res_bip_prices['bip']['usd'];
$rub_bip_price = $res_bip_prices['bip']['rub'];
$usd_price = $current_price * $usd_bip_price;

$rub_price = $current_price * $rub_bip_price;

$min = $res['providers'][99];
$min_loto_bip = $all_bip * ($min['liquidity'] / $l);
$min_loto_bip = number_format($min_loto_bip, 2, ',', '&nbsp;');
$min_loto_long = $all_long * ($min['liquidity'] / $l);
$min_loto_long = number_format($min_loto_long, 2, ',', '&nbsp;');
$best_invest_day = max(array_column($res['providers'],'invest_days'));

$content = '<h2>О LONG (<a href="/minter/long/phelosophy" target="_blank">Философия проекта</a>)</h2>
<p>Это токен с фармингом в LONG, процент которого зависит от долгосрочности удержания и реинвестирования получаемого.<br>
Сумма фарминга для конкретного провайдера ликвидности берётся от ликвидности в BIP.<br>
<strong>Инвест. дни и отправка производится от суммы в 0.2 LONG (это сделано, чтоб сумма отправки не была меньше комиссии).</strong></p>
<p>Пул <a href="https://chainik.io/pool/BIP/LONG" target="_blank">BIP/LONG</a></p>
<span style="display: none;" id="bip_usd_price">'.$usd_bip_price.'</span><span style="display: none;" id="bip_rub_price">'.$rub_bip_price.'</span>
<p><a href="https://t.me/long_project" target="_blank">Новости проекта в Telegram</a>, <a href="https://t.me/long_project_chat" target="_blank">Обсуждения и ответы на вопросы в Telegram</a></p>
<div class="tt" onclick="spoiler(`formulas`); return false"><strong>Раскрыть формулы</strong></div>
<div id="formulas" class="terms" style="display: none;">
<h3>Формулы</h3>
<ol><li>Процент изменения курса LONG = (Текущий курс - стартовая в 1 BIP) / стартовая * 100;
<li>Инвест. дни прибавляются с каждым днём, но также даются бонусы:<br>
Если сумма добавления в пул / сумма получения = 1 и более, прибавляется +1;<br>
Если от 0.5 до 1 - +0.5 - +1.<br>
Лотерея прибавляет ещё от 2 до 3 инвест. дней в зависимости от процента реинвеста (от 50% до 100%);</li>
<li>Минимальный процент = '.$percent.'</li>
<li>Максимальный процент (СМ. список в следующем блоке) = (процент 0.7 + (Стартовый процент '.$percent.' * (процент изменения курса LONG в BIP / 100)) / 10))<br>
Но не более 1 и не менее 0.7%;</li>
<li>Процент провайдера = минимальный процент + ((максимальный процент - минимальный процент) * (инвест. день провайдера / максимальный инвест. день))</li>
<li>Сумма получения = ликвидность провайдера в BIP * (процент провайдера / 100) с последующим делением на курс 1 LONG;</li>
</ol>
</div>
<h2>Меню сервисов проекта</h2>
<ol><li><a href="/minter/long/loto">Лотерея для участников топ 100 в пуле</a></li>
<li><a href="/minter/long/payd-loto" target="_blank">Лотереи с покупкой билетов за LONG</a></li>
<li><a href="/minter/long/rps" target="_blank">Игра "Камень, ножницы, бумага"</a></li>
<li><a href="/minter/long/bids" target="_blank">Ставки на курс крипты и пулов в Minter</a></li>
<li><a href="/minter/long/surveys" target="_blank">Создать или участвовать в опросах LONG</a></li>
</ol>
<h3>Основные данные</h3>
<ul><li>Стартовая цена 1 LONG = '.$res['start_price'].' BIP</li>
<li>Минимальный процент: <span id="min_percent">'.$res['start_percent'].'</span>%</li>
<li>Максимальный процент на момент просмотра страницы: <span id="max_percent">'.round($max_percent, 3).'</span>%</li>
<li>Максимальный инвест. день: <span id="best_invest_day">'.$best_invest_day.'</span></li>
<li>Ликвидность ('.number_format($l, 2, ',', '&nbsp;').' LP-683, '.number_format($all_bip, 2, ',', '&nbsp;').' BIP и '.number_format($all_long, 2, ',', '&nbsp;').' LONG)</li>
<li>Для участия в лотерею необходимо добавить больше '.$min_loto_bip.' BIP и '.$min_loto_long.' LONG</li>
<li id="prices">Курс 1 LONG = <span id="current_price">'.round($current_price, 2).'</span> BIP, $ '.round($usd_price, 2).', '.round($rub_price, 2).' Руб.</li></ul>
<span id="bip_liquidity" style="display: none;">'.$all_bip_liquidity.'</span><span id="lp_liquidity" style="display: none;">'.$l.'</span>
<h3>Провайдеры</h3>
<h4>Калькулятор заработка</h4>
<form class="form">
<p><label for="long_amount">Количество LONG:<br>
<input type="number" name="long_amount" min="0" placeholder="Введите сумму LONG">
</label></p>
<p>Вам надо будет добавить также <span id="bip_add_amount">0</span> BIP<br>
Примерная сумма LP-токенов: <span id="adding_liquidity"></span></p>
<p><label for="invest_days_calc">Кол-во инвест. дней:<br>
<input type="number" name="invest_days_calc" min=0 max=365 value="0" placeholder="Выберите инвест. день">
</label></p>
<p>Ежедневная прибыль: <span id="result_profit">0</span> LONG *Курс действителен на <span id="page_date"></span></p>
</form>
<h4>Список</h4>
<p>Чем больше инвест. дней, тем больше фарминг (если вы выводите из пула хоть сколько-то LONG, дни обнуляются. Тоже самое при переводе LP-токенов на другой адрес). Добавления в пул не обнуляют дни (это даже можно назвать реинвестом).</p>
<p><strong>
Если вы вкладываете всю полученную при последней рассылке или даже больше, получаете +1 доп. инвестиционный день. Если от половины до максимума - 0.5-1 инвест. день.<br>
Например, если вы получили 1000 LONG и вложили в пул 500, получите +0.5 инвест. дней, а при вкладе 800 LONG - +0.8 инвест. дней.<br>
При реинвесте половины выигрыша лотереи получите +4 инвест. дня, при реинвесте всего выигрыша лотереи - +5 инвест. дней.</strong></p>
<p><strong>При вкладе >= 1000 LP-токенов выдаются бонусные инвест. дни, равные проценту от ликвидности.<br>
Т. е., если вы добавляете 10% от общего кол-ва LP-токенов, получаете +10 инвест. дней; если 1% - 1, если 4% - 4, и т. д.</strong></p>
<p>И напоминаю, что от инвест. дней зависит ваш процент фарминга: пользователь с максимальным числом инвест. дней получает максимальный процент, но его все равно могут обогнать.</p>
<hr>
<p align="center">Кошелёк отправки фарминга и лотереи LONG: <a href="https://dpos.space/minter/profiles/Mx01029d73e128e2f53ff1fcc2d52a423283ad9439" target="_blank">Mx01029d73e128e2f53ff1fcc2d52a423283ad9439</a></p>
<table id="table">
<thead><tr><th>№</th>
<th>Адрес</th>
<th>Ликвидность (кол-во LP-токенов)</th>
<th>Инвестиционных дней</th>
<th>Полученная в последний раз сумма</th>
<th>Добавленная сумма (бонус за реинвест)</th>
<th>Будущий фарминг, сумма (процент)</th>
<th>Вероятность выигрыша в лотерее (вероятная сумма)</th>
<th>Токены и пулы для сервиса ставок</th>
<th>Действия</th>
</tr></thead>
<tbody id="target">';
function getCalcData($key, $provider, $percent) {
  $power = 0;
  $loto_winn_amount = '';
$get_loto = (isset($provider['get_loto']) && $provider['get_loto'] && $provider['get_loto'] >= 0 ? ($provider['get_loto'] + $provider['get_amount']) : 0);
$days = 1 + $provider['invest_days'];

if ($provider['add_amount'] && $provider['get_amount'] && $provider['get_amount'] > 0) {
  $reinvest_bonus = $provider['add_amount'] / $provider['get_amount'];

  if ($reinvest_bonus >= 1) {
    $days += 1;
  } else if ($reinvest_bonus >= 0.5 && $reinvest_bonus < 1) {
    $days += $reinvest_bonus;
  }

if ($get_loto > 0 && $get_loto / 2 > $provider['add_amount']) {
    $loto_bonus = $provider['add_amount'] / $get_loto;
        $add_loto_bonus = 2;
        if ($loto_bonus < 1) {
            $add_loto_bonus = $loto_bonus * 2;
        }
        $days += 1 + $add_loto_bonus;
  }
  if ($provider['add_amount'] / $provider['get_amount'] >= 0.49 || $provider['get_loto'] > 0 && $provider['add_amount'] / $provider['get_loto'] >= 0.49) {
    if ($key <= 100) {
      $power = (int)$provider['liquidity'] * ($days / 100);
        $loto_winner_amount = ($provider['liquidity'] / 2) * ($percent * (1 + ($provider['invest_days'] / 100)));
    if ($loto_winner_amount > 50000) $loto_winner_amount = 50000;
        $loto_winn_amount = ' ('.round($loto_winner_amount, 3).' LONG)';
    }  
  }
  
}
return [$get_loto, $days, $loto_winn_amount, $power];
}

function allPowerSum($a, $b) {
  global $percent;
  [$get_loto, $b_days, $loto_winn_amount, $power] = getCalcData(1, $b, $percent);
  if ($b['get_amount'] > 0 && $b['add_amount'] / $b['get_amount'] >= 0.49 || $b['get_amount'] > 0 && $b['get_loto'] > 0 && $b['add_amount'] / $b['get_loto'] >= 0.49) {
  $a += $power;
}
return $a;
}

$top_providers = array_slice($res['providers'], 0, 99);
$all_power = array_reduce($top_providers, "allPowerSum");

foreach($res['providers'] as $key => $provider) {
  $key++;
$share = $provider['liquidity'] / $l;
$bip_liquidity = $all_bip_liquidity * $share;
[$get_loto, $days, $loto_winn_amount, $power] = getCalcData($key, $provider, $percent);
  
$loto_probability = '0%';
if ($power > 0) {
  $loto_probability = $power / $all_power * 100;
$loto_probability = round($loto_probability, 3).'%';
}

$provider_percent = $percent + (($max_percent - $percent) * ($days / $best_invest_day));
$farming_share = ($bip_liquidity / 100 * $provider_percent) / $current_price;

$loto_amount = '';
if ($key <= 100) {
  if ($get_loto > 0) $loto_amount = ' + '.number_format($provider['get_loto'], 2, ',', '&nbsp;');
}

$liquidity_share = $provider['liquidity'] / $l;
$provider_bip = $all_bip * $liquidity_share;
$provider_long = $all_long * $liquidity_share;

$content .= '<tr>
<td>'.$key.'</td>
<td><a href="https://chainik.io/address/'.$provider['address'].'" target="_blank">'.$provider['address'].'</a></td>
<td>'.number_format($provider['liquidity'], 3, ',', '&nbsp;').' ('.number_format($provider_long, 3, ',', '&nbsp;').' LONG и '.number_format($provider_bip, 3, ',', '&nbsp;').' BIP)</td>
<td>'.round($provider['invest_days'], 3).'</td>
<td>'.number_format($provider['get_amount'], 2, ',', '&nbsp;').$loto_amount.' LONG</td>
<td>'.number_format($provider['add_amount'], 2, ',', '&nbsp;').' LONG</td>
<td>'.number_format($farming_share, 2, ',', '&nbsp;').' LONG ('.round($provider_percent, 2).'%)</td>
<td>'.$loto_probability.$loto_winn_amount.'</td>
<td>'.$provider['for_bids'].'</td>
<td><a href="/minter/long/calc/'.$provider['address'].'" target="_blank">Семейный калькулятор</a></td>
</tr>';
}
$content .= '</tbody></table>';
return $content;
?>