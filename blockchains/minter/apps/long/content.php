<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
$address = file_get_contents('https://api.minter.one/v2/addresses?addresses=Mx01029d73e128e2f53ff1fcc2d52a423283ad9439&addresses=Mx6b897dff137ba8e6847812ae09ad46d709da7ec4');
$addresses = json_decode($address, true)['addresses'];
$halving_k = 1;
  $html = file_get_contents('http://138.201.91.11:3852/smartfarm');
  $res = json_decode($html, true);
  $explorer = file_get_contents('https://api.minter.one/v2/swap_pool/0/2782');
  $pool = json_decode($explorer, true);
$all_bip = ((float)$pool['amount0'] / (10 ** 18));
  $all_long = ((float)$pool['amount1'] / (10 ** 18));
  $current_price = $all_bip / $all_long;
$price_changed = ($current_price - 1) / 1 * 100;
$change_k = (0.2 * ($price_changed / 100)) / 10;
$percent = $halving_k * (0.2 + $change_k);
$l = (float)$pool['liquidity'] / (10 ** 18);

$bip_prices = file_get_contents('https://api.coingecko.com/api/v3/simple/price?ids=bip&vs_currencies=usd,rub');
$res_bip_prices = json_decode($bip_prices, true);
$usd_bip_price = $res_bip_prices['bip']['usd'];
$rub_bip_price = $res_bip_prices['bip']['rub'];
$usd_price = $current_price * $usd_bip_price;

$rub_price = $current_price * $rub_bip_price;

$min = $res['providers'][49];
$min_loto_bip = $all_bip * ($min['liquidity'] / $l);
$min_loto_bip = number_format($min_loto_bip, 2, ',', '&nbsp;');
$min_loto_long = $all_long * ($min['liquidity'] / $l);
$min_loto_long = number_format($min_loto_long, 2, ',', '&nbsp;');

$content = '<h2>О LONG (<a href="/minter/long/phelosophy" target="_blank">Философия проекта</a>)</h2>
<p>Это токен с фармингом в LONG, процент которого зависит от курса токена. Растёт курс: растёт процент фарминга. Падает: падает процент.<br>
Сумма фарминга для конкретного провайдера ликвидности берётся от количества LP-токенов.<br>
<strong>Инвест. дни и отправка производится от суммы в 0.2 LONG (это сделано, чтоб сумма отправки не была меньше комиссии).</strong></p>
<p>Пул <a href="https://chainik.io/pool/BIP/LONG" target="_blank">BIP/LONG</a></p>
<span style="display: none;" id="bip_usd_price">'.$usd_bip_price.'</span><span style="display: none;" id="bip_rub_price">'.$rub_bip_price.'</span>
<p><a href="https://t.me/long_project" target="_blank">Новости проекта в Telegram</a>, <a href="https://t.me/long_project_chat" target="_blank">Обсуждения и ответы на вопросы в Telegram</a></p>
<div class="tt" onclick="spoiler(`formulas`); return false"><strong>Раскрыть формулы</strong></div>
<div id="formulas" class="terms" style="display: none;">
<h3>Формулы</h3>
<ol><li>Процент изменения курса LONG = (Текущий курс - стартовая в 1 BIP) / стартовая * 100;
<li>Текущий процент (СМ. список в следующем блоке) = (Стартовый процент 0.2 + (0.2 * (процент изменения курса LONG в BIP / 100)) / 10));</li>
<li>Коэффициент халвинга - это число, изменяемое в зависимости от кол-ва токенов LONG на ревордном кошельке.
<ul><li>7 МЛН и больше - 2</li>
<li>6 МЛН - 1.8</li>
<li>5 МЛН - 1.6</li>
<li>4 МЛН - 1.4</li>
<li>3 МЛН - 1.2</li>
<li>2 МЛН - 1</li>
<li>1 МЛН - 0.8</li>
<li>Меньше 1 МЛН - 0.6</li>
</ul></li>
<li>Сумма получения = LP провайдера * (текущий процент / 100);<br>
Далее это умножается на коэффициент инвест. дней.<br>
коэффициент инвест. дней = 1 + (инвест_дни / 100);<br>
Если сумма добавления в пул / сумма получения = 1 и более, прибавляется +0.01;<br>
Если от 0.5 до 1 - +0.005 - +0.01.</li>
</ol>
</div>
<h2>Меню сервисов проекта</h2>
<ol><li><a href="/minter/long/loto">Лотерея для участников топ 50 в пуле</a></li>
<li><a href="/minter/long/payd-loto" target="_blank">Лотереи с покупкой билетов за LONG</a></li>
<li><a href="/minter/long/rps" target="_blank">Игра "Камень, ножницы, бумага"</a></li></ol>
<h3>Основные данные</h3>
<ul><li>Стартовая цена 1 LONG = '.$res['start_price'].' BIP</li>
<li>Начальный процент, от которого идёт изменение в зависимости от курса токена: '.$res['start_percent'].'%</li>
<li>Текущий процент на момент просмотра страницы: <span id="now_percent">'.round($percent, 2).'</span>%</li>
<li>Ликвидность ('.number_format($l, 2, ',', '&nbsp;').' LP-683, '.number_format($all_bip, 2, ',', '&nbsp;').' BIP и '.number_format($all_long, 2, ',', '&nbsp;').' LONG)</li>
<li>Для участия в лотерею необходимо добавить больше '.$min_loto_bip.' BIP и '.$min_loto_long.' LONG</li>
<li id="prices">Курс 1 LONG = <span id="current_price">'.round($current_price, 2).'</span> BIP, $ '.round($usd_price, 2).', '.round($rub_price, 2).' Руб.</li></ul>
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
<th>Вероятность выигрыша в лотерее</th>
<th>Действия</th>
</tr></thead>
<tbody id="target">';
function ticketsSum($a, $b) {
  $provider_tickets = (int)(($b['liquidity'] / 100) * (1 + ($b['invest_days'] / 100)));
  if ($b['add_amount'] / $b['get_amount'] >= 0.98 || $b['get_loto'] > 0 && $b['add_amount'] / $b['get_loto'] >= 0.49) {
  $a += $provider_tickets;
}
return $a;
}
$top_providers = array_slice($res['providers'], 0, 49);
$tickets = array_reduce($top_providers, "ticketsSum");

foreach($res['providers'] as $key => $provider) {
  $tickets_probability = '0%';

  $key++;
$get_loto = (isset($provider['get_loto']) && $provider['get_loto'] && $provider['get_loto'] >= 0 ? ($provider['get_loto'] + $provider['get_amount']) : 0);
$k = 1 + ($provider['invest_days'] / 100);
if ($provider['add_amount'] && $provider['get_amount'] && $provider['get_amount'] > 0) {
  $reinvest_bonus = $provider['add_amount'] / $provider['get_amount'];

  if ($provider['add_amount'] / $provider['get_amount'] >= 0.98 || $provider['get_loto'] > 0 && $provider['add_amount'] / $provider['get_loto'] >= 0.49) {
  if ($key <= 50) {
    $provider_tickets = (int)(($provider['liquidity'] / 100) * (1 + ($provider['invest_days'] / 100)));
  } else {
    $provider_tickets = 0;
  }
  $tickets_probability = $provider_tickets / $tickets * 100;
  $tickets_probability = round($tickets_probability, 3).'%';
  
}

  if ($reinvest_bonus >= 1) {
    $k += 0.01;
  } else if ($reinvest_bonus >= 0.5 && $reinvest_bonus < 1) {
    $k += $reinvest_bonus / 100;
  }

if ($get_loto > 0 && $get_loto / 2 > $provider['add_amount']) {
    $loto_bonus = $provider['add_amount'] / $get_loto;
        $add_loto_bonus = 2;
        if ($loto_bonus < 1) {
            $add_loto_bonus = $loto_bonus * 2;
        }
        $k += 0.01 + ($add_loto_bonus / 100);
  }
}
$provider_percent = $percent * $k;
$farming_share = (float)$provider['liquidity'] * ($percent / 100);
$farming_share *= $k;

$loto_amount = '';
if ($key <= 50) {
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
<td>'.$tickets_probability.'</td>
<td><a href="/minter/long/calc/'.$provider['address'].'" target="_blank">Семейный калькулятор</a></td>
</tr>';
}
$content .= '</tbody></table>';
return $content;
?>