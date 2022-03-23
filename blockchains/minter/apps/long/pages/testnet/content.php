<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
  $html = file_get_contents('http://138.201.91.11:3258/smartfarm');
  $res = json_decode($html, true);
  $explorer = file_get_contents('https://node-api.testnet.minter.network/v2/swap_pool/0/1957');
  $pool = json_decode($explorer, true);
$current_price = ((float)$pool['amount0'] / (10 ** 18)) / ((float)$pool['amount1'] / (10 ** 18));
$all_bip = ((float)$pool['amount0'] / (10 ** 18));
  $all_smartfarm = ((float)$pool['amount1'] / (10 ** 18));
  $current_price = $all_bip / $all_smartfarm;
$price_changed = ($current_price - 1) / 1 * 100;
$change_k = (0.7 * ($price_changed / 100)) / 10;
$max_percent = 0.7 + $change_k;
if ($max_percent < 0.7) $max_percent = 0.7;
if ($max_percent > 1) $max_percent = 1;
$percent = $res['start_percent'];
$all_bip_liquidity = $all_bip * 2;

$l = (float)$pool['liquidity'] / (10 ** 18);

$min = $res['providers'][3];
$min_loto_bip = $all_bip * ($min['liquidity'] / $l);
$min_loto_bip = number_format($min_loto_bip, 2, ',', '&nbsp;');
$min_loto_smartfarm = $all_smartfarm * ($min['liquidity'] / $l);
$min_loto_smartfarm = number_format($min_loto_smartfarm, 2, ',', '&nbsp;');
function calcDays($get_amount, $add_amount, $invest_days, $get_counter) {
  $days = 1;
  $days += $invest_days;
  $min_days = $days;
  if ($add_amount && $get_amount && $get_amount > 0) {
    $reinvest_bonus = $add_amount / $get_amount;
if($reinvest_bonus > 1) $reinvest_bonus = 1;
$reinvest_counter = $get_counter * $reinvest_bonus;
$get_counter -= $reinvest_counter;
$days += $reinvest_counter;
          } // end if provider.get_ammount and provider.add_amount > 0.
return [$days, $min_days, $get_counter];
      }

      function getCalcData($key, $provider, $percent) {
  $power = 0;
  list($days, $min_days, $get_counter) = calcDays($provider['get_amount'], $provider['add_amount'], $provider['invest_days'], $provider['get_counter']);
$supers_counter = 0;
if ($key <= 100) {
  $winn_days = 0;
  for ($i = (int)$min_days; $i <= (int)$days; $i++) {
      if ($i % 150 == 0) {
$power += $provider['liquidity'] * 2;
$supers_counter = 2;
} else if ($i % 50 == 0) {
$power += $provider['liquidity'];
$supers_counter = 1;
} // end if i % 50 == 0.
                      } // end for min_days to days.
} // end if n <= 100.

  return [$days, $supers_counter, $power];
}

function allPowerSum($a, $b) {
  global $percent;
  [$b_days, $supers_counter, $power] = getCalcData(1, $b, $percent);
if ($supers_counter > 0) {
  $a += $power;
}
  return $a;
}

function getBestDay($acc, $curr) {
  $acc_days = $acc['invest_days'];
  $curr_days = (calcDays($curr['get_amount'], $curr['add_amount'], $curr['invest_days'], $curr['get_counter']))[0];
  $acc['now_days'] = $acc_days;
  $curr['now_days'] = $curr_days;
  return ($acc_days > $curr_days ? $acc : $curr);
}

$top_providers = array_slice($res['providers'], 0, 99);
$all_supers = array_reduce($top_providers, "allPowerSum");
$best_invest_day = array_reduce($res['providers'], "getBestDay");
$best_invest_day = $best_invest_day['now_days'];

$content = '<h2>О smartfarm (<a href="/minter/long/phelosophy" target="_blank">Философия проекта</a>)</h2>
<p>Это токен с фармингом в smartfarm, процент которого зависит от долгосрочности удержания и реинвестирования получаемого.<br>
Сумма фарминга для конкретного провайдера ликвидности берётся от ликвидности в BIP.<br>
Инвест. дни начисляются за удержание в пуле (каждый день) и за реинвест фарминга с бонусами.<br>
<strong>Инвест. дни и отправка производится от суммы в 0.2 smartfarm (это сделано, чтоб сумма отправки не была меньше комиссии).</strong></p>
<p>При достижении количества инвест дней кратно 50, топ 100 провайдеры получают бонус в виде доли от 30000 smartfarm соответственно своему стейку. При достижении инвест дней кратно 150 провайдер получает удвоение доли при распределении бонуса.<br>
Сумма в 30 000 smartfarm выделяется каждый день, но начисления производятся 1 раз при достижении.<br>
Если сумма бонуса больше ликвидности в BIP, делённой на курс smartfarm, отправляется бонус, равный ликвидности в BIP / курс smartfarm.<br>
Если пользователь реинвестирует так, что он пропускает кратный 50 инвест. день, он все равно учитывается, т. к. проходит его при изменении.</p>
<p>Пул <a href="https://chainik.io/pool/BIP/smartfarm" target="_blank">BIP/smartfarm</a></p>
<p><a href="https://t.me/smartfarm_project" target="_blank">Новости проекта в Telegram</a>, <a href="https://t.me/smartfarm_project_chat" target="_blank">Обсуждения и ответы на вопросы в Telegram</a></p>
<div class="tt" onclick="spoiler(`formulas`); return false"><strong>Раскрыть формулы</strong></div>
<div id="formulas" class="terms" style="display: none;">
<h3>Формулы</h3>
<ol><li>Процент изменения курса smartfarm = (Текущий курс - стартовая в 1 BIP) / стартовая * 100;
<li>Инвест. дни прибавляются с каждым днём, но также прибавляются за реинвест:<br>
бонусный инвест. день = количество получений * (сумма добавления / сумма получения)</li>
<li>Реинвестируя бонусы за кратные 50 инвест. дни, вы можете получить очень много инвест. дней. Например, если вы получили бонус 30000 smartfarm, а фарминг у вас 6000, получите +5;</li>
<li>Минимальный процент = '.$percent.'</li>
<li>Максимальный процент (СМ. список в следующем блоке) = (процент 0.7 + (0.7 * (процент изменения курса smartfarm в BIP / 100)) / 10))<br>
Но не более 1 и не менее 0.7%;</li>
<li>Процент провайдера = минимальный процент + ((максимальный процент - минимальный процент) * (инвест. день провайдера / максимальный инвест. день))</li>
<li>Сумма получения = ликвидность провайдера в BIP * (процент провайдера / 100) с последующим делением на курс 1 smartfarm;</li>
</ol>
</div>
<h2>Меню сервисов проекта</h2>
<ol><li><a href="/minter/long/bids" target="_blank">Ставки на курс крипты и пулов в Minter</a></li>
<li><a href="/minter/long/payd-loto" target="_blank">Лотереи с покупкой билетов за smartfarm</a></li>
<li><a href="/minter/long/rps" target="_blank">Игра "Камень, ножницы, бумага"</a></li>
<li><a href="/minter/long/surveys" target="_blank">Создать или участвовать в опросах smartfarm</a></li>
</ol>
<h3>Основные данные</h3>
<ul><li>Стартовая цена 1 smartfarm = '.$res['start_price'].' BIP</li>
<li>Минимальный процент: <span id="min_percent">'.$res['start_percent'].'</span>%</li>
<li>Максимальный процент на момент просмотра страницы: <span id="max_percent">'.round($max_percent, 3).'</span>%</li>
<li>Максимальный инвест. день: <span id="best_invest_day">'.$best_invest_day.'</span></li>
<li>Ликвидность ('.number_format($l, 2, ',', '&nbsp;').' LP-683, '.number_format($all_bip, 2, ',', '&nbsp;').' BIP и '.number_format($all_smartfarm, 2, ',', '&nbsp;').' smartfarm)</li>
<li>Для получения бонуса за кратные 50 инвест. дни необходимо добавить больше '.$min_loto_bip.' BIP и '.$min_loto_smartfarm.' smartfarm</li>
<li id="prices">Курс 1 smartfarm = <span id="current_price">'.round($current_price, 2).'</span> BIP<span id="usd_price</span><span id="rub_price"></span>.</li></ul>
<span id="bip_liquidity" style="display: none;">'.$all_bip_liquidity.'</span><span id="lp_liquidity" style="display: none;">'.$l.'</span>
<h3>Провайдеры</h3>
<h4>Калькулятор заработка</h4>
<form class="form">
<p><label for="smartfarm_amount">Количество smartfarm:<br>
<input type="number" name="smartfarm_amount" min="0" placeholder="Введите сумму smartfarm">
</label></p>
<p>Вам надо будет добавить также <span id="bip_add_amount">0</span> BIP<br>
Примерная сумма LP-токенов: <span id="adding_liquidity"></span></p>
<p><label for="invest_days_calc">Кол-во инвест. дней:<br>
<input type="number" name="invest_days_calc" min=0 max=365 value="0" placeholder="Выберите инвест. день">
</label></p>
<p>Ежедневная прибыль: <span id="result_profit">0</span> smartfarm *Курс действителен на <span id="page_date"></span></p>
</form>
<h4>Добавить ликвидность</h4>
<div id="auth_msg" style="display: none;"><p>Для работы с кошельком необходимо авторизоваться seed фразой или через BIP wallet. Сделайте это <a href="'.$conf['siteUrl'].'minter/accounts" target="_blank">на странице аккаунтов</a>.</p></div>                        
<div id="seed_page"><form>
<p><label for="add_amount">Сумма smartfarm (максимум <span id="max_add"></span> smartfarm) <br>
<input type="number" min=1 name="add_amount"></p>
<p><label for="add_bip_amount">Сумма BIP (максимум <span id="max_add_bip"></span> BIP) <br>
<input type="number" min=1 name="add_bip_amount"></p>
<p><label for="add_tokens">Список токенов и пулов через запятую (например, BTC,BIP/smartfarm,ARCONA/USDTE) <br>
<input type="text" name="add_tokens"></p>
<p><strong><input type="button" id="action_add_liquidity" value="➕"></strong></p>
</form></div>
<h4>Список</h4>
<p><b>Чем больше инвест. дней, тем больше фарминг (если вы выводите из пула хоть сколько-то smartfarm, дни обнуляются. Тоже самое при переводе LP-токенов на другой адрес). Добавления в пул не обнуляют дни (это даже можно назвать реинвестом).</b></p>
<p><strong>
По мере получения фарминга и бонуса за инвест. дни повышаются параметры "сумма получения" и "количество получений"<br>
Второй - на 1 + (фарминг / бонус) за бонус и фарминг (при отсутствии бонуса будет лишь +1 за фарминг).<br>
При реинвесте считается доля от суммы получения и умножается на количество получений. Итоговое число прибавляется к инвест. дням, а также вычитается из количества получений.<br>
Например, если вы получали на протяжении 10 дней в среднем 500 smartfarm фармингом и вы не реинвестировали, у вас будет 5000 smartfarm в сумме получения и 10 в количестве получений;<br>
При реинвесте половины суммы прибавится +5 инвест. дней, а также в количестве получений будет 6 (5 прежних +1 за текущий фарминг, т. к. фиксация производится только во время рассылки).<br>
А если вы в один из десяти дней получили 10000 smartfarm бонуса за инвест. дни, в количестве получения будет не 10, а 30 (т. к. 10 000 больше фарминга в 20 раз), а в сумме получения будет 15000 smartfarm.<br>
Соответственно реинвестируя половину этой суммы, вы получите +15 инвест. дней, а в кол-ве получений станет 16.</strong></p>
<p><strong>При вкладе >= 1000 LP-токенов выдаются бонусные инвест. дни, равные проценту от ликвидности.<br>
Т. е., если вы добавляете 10% от общего кол-ва LP-токенов, получаете +10 инвест. дней; если 1% - 1, если 4% - 4, и т. д.</strong></p>
<p>И напоминаю, что от инвест. дней зависит ваш процент фарминга: пользователь с максимальным числом инвест. дней получает максимальный процент, но его все равно могут обогнать.</p>
<hr>
<p align="center">Кошелёк отправки фарминга и бонуса за инвест. дни, кратные 50: <a href="https://dpos.space/minter/profiles/Mx01029d73e128e2f53ff1fcc2d52a423283ad9439" target="_blank">Mx01029d73e128e2f53ff1fcc2d52a423283ad9439</a></p>
<table id="table">
<thead><tr><th>№</th>
<th>Адрес</th>
<th>Ликвидность (кол-во LP-токенов)</th>
<th>Инвестиционных дней</th>
<th>Полученная в последний раз сумма</th>
<th>Добавленная сумма (бонус за реинвест)</th>
<th>Будущий фарминг, сумма (процент)</th>
<th>Вероятная сумма бонуса за кратные 50 инвест. дни</th>
<th>Токены и пулы для сервиса ставок</th>
</tr></thead>
<tbody id="target">';
foreach($res['providers'] as $key => $provider) {
  $key++;
$share = $provider['liquidity'] / $l;
$bip_liquidity = $all_bip_liquidity * $share;
[$days, $supers_counter, $super] = getCalcData($key, $provider, $percent);
$bonus_value = 0;
if ($supers_counter > 0) {
  $max_amount = 30000;
$points = $provider['liquidity'] * $supers_counter;
$share = $points / $all_supers;
$bonus_value = $max_amount * $share;
if ($bonus_value > ($bip_liquidity / $current_price)) $bonus_value = $bip_liquidity / $current_price;
}

$provider_percent = $percent + (($max_percent - $percent) * ($days / $best_invest_day));

$farming_share = ($bip_liquidity / 100 * $provider_percent) / $current_price;

$liquidity_share = $provider['liquidity'] / $l;
$provider_bip = $all_bip * $liquidity_share;
$provider_smartfarm = $all_smartfarm * $liquidity_share;
$get_counter = number_format($provider['get_counter'], 3, ',', '&nbsp;');

$content .= '<tr>
<td>'.$key.'</td>
<td><a href="https://chainik.io/address/'.$provider['address'].'" target="_blank">'.$provider['address'].'</a></td>
<td>'.number_format($provider['liquidity'], 3, ',', '&nbsp;').' ('.number_format($provider_smartfarm, 3, ',', '&nbsp;').' smartfarm и '.number_format($provider_bip, 3, ',', '&nbsp;').' BIP)</td>
<td>'.round($provider['invest_days'], 3).'</td>
<td>'.number_format($provider['get_amount'], 3, ',', '&nbsp;').' smartfarm ('.$get_counter.' получений)</td>
<td>'.number_format($provider['add_amount'], 3, ',', '&nbsp;').' smartfarm</td>
<td>'.number_format($farming_share, 3, ',', '&nbsp;').' smartfarm ('.round($provider_percent, 3).'%)</td>
<td>'.$bonus_value.'</td>
<td onClick="copyOnClick(this)">'.$provider['for_bids'].'</td>
</tr>';
}
$content .= '</tbody></table>';
return $content;
?>