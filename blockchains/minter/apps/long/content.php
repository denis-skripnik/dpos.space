<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
$address = file_get_contents('https://api.minter.one/v2/addresses?addresses=Mx01029d73e128e2f53ff1fcc2d52a423283ad9439&addresses=Mx6b897dff137ba8e6847812ae09ad46d709da7ec4');
$addresses = json_decode($address, true)['addresses'];
  $html = file_get_contents('http://178.20.43.121:3852/smartfarm');
  $res = json_decode($html, true);
  $explorer = file_get_contents('https://api.minter.one/v2/swap_pool/0/2782');
  $pool = json_decode($explorer, true);
$all_bip = ((float)$pool['amount0'] / (10 ** 18));
  $all_long = ((float)$pool['amount1'] / (10 ** 18));
  $current_price = $all_bip / $all_long;
  $max_amount = $res['max_amount'];
  $max_prize = $res['max_prize'];
  $locks = $res['locks'];
  $farming_amount = $res['max_amount'] - ($max_prize * 2);
  $all_bip_liquidity = $all_bip * 2;

$l = (float)$pool['liquidity'] / (10 ** 18);

$min = $res['providers'][99];
$min_loto_bip = $all_bip * ((float)$min['liquidity'] / $l);
$min_loto_bip = number_format($min_loto_bip, 2, ',', '&nbsp;');
$min_loto_long = $all_long * ((float)$min['liquidity'] / $l);
$min_loto_long = number_format($min_loto_long, 2, ',', '&nbsp;');
      
function getCalcData($key, $provider) {
  $provider['invest_days'] += 1;
  $power = 0;
$supers_counter = 0;
if ($key <= 100 && (float)$provider['get_counter'] <= 50) {
  $winn_days = 0;
  $bonus_days = (int)$provider['bonus_invest_days'] + 1;
  for ($i = $bonus_days; $i <= (int)$provider['invest_days']; $i++) {
if ($i % 50 == 0) {
  $supers_counter = $i / 50;
  $power += (float)$provider['liquidity'] * $supers_counter;
} // end if i % 50 == 0.
                      } // end for min_days to days.
} // end if n <= 100.

  return [(float)$provider['invest_days'], $supers_counter, $power];
}

function allPowerSum($a, $b) {
  [$b_days, $supers_counter, $power] = getCalcData(1, $b);
if ($supers_counter > 0) {
  $a += (float)$power;
}
  return $a;
}

$top_providers = array_slice($res['providers'], 0, 99);
$all_supers = array_reduce($top_providers, "allPowerSum");

function allExperienceSum($a, $b) {
  $b_days = (float)$b['invest_days'];
  $lock_days = 0;
  if (isset($locks[$b['address']])) {
$lock = $locks[$b['address']];
$lock_days = ($lock['days'] / $lock['count']);
$lock_share = (float)$lock['amount'] / (float)$b['liquidity'];
$lock_days *= $lock_share;
  }
$b_days += $lock_days;

  $a += (float)$b['liquidity'] * ((1 + $b_days / 100));
  return $a;
}
$all_experience = array_reduce($top_providers, "allExperienceSum");

$content = '<h2>О LONG (<a href="/minter/long/phelosophy" target="_blank">Философия проекта</a>)</h2>
<p>Это токен с фармингом в LONG, процент которого зависит от долгосрочности удержания и реинвестирования получаемого.<br>
Сумма фарминга для конкретного провайдера ликвидности берётся от количества LP-токенов, умноженного на 1 + (число инвест. дней / 100). Участники конкурируют друг с другом за обладание как можно большим числом инвест. дней.<br>
Инвест. дни начисляются за удержание в пуле (каждый день после расчётов фарминга) и за реинвест фарминга с бонусами моментально.<br>
Если вы сжигаете LP-токены пула (LP-683), получаете бонус к инвест. дням. Он зависит от того, какой процент от общего числа LP вы сожгли. Далее этот процент умножается на 10, т. е. при сжигании 10% LP вы получите +100 инвест. дней.<br>
<strong>Инвест. дни и отправка производится от суммы в 0.2 LONG (это сделано, чтоб сумма отправки не была меньше комиссии), а также только если количество получений <= 500.</strong>
</p>
<p>При достижении количества инвест дней кратно 50, топ 100 провайдеры получают бонус в виде доли от '.$max_prize.' LONG соответственно своему стейку, но не более суммы фарминга * 10, если количество получений у них не больше 50.<br>
Чем больше накопили инвест. дней, тем больше множитель ликвидности, т. е., если вы накопили 100 инвест. дней, ликвидность при подсчёте доли от '.$max_prize.' LONG умножится на 2; При достижении 150 - на 3; 300 - на 6, 500 - на 10 и т. п.<br>
Сумма в '.$max_prize.' LONG выделяется каждый день, но начисления производятся 1 раз при достижении.<br>
Если сумма бонуса больше чем сумма фарминга, умноженная на 10, отправляется бонус, равный сумме фарминга * 10.<br>
Если пользователь реинвестирует так, что он пропускает кратный 50 инвест. день, он все равно учитывается, т. к. проходит его при изменении.</p>
<p>Также топ 100 провайдеров ликвидности участвуют в лотерее, если у них количество получений не более 50. Максимум - '.$max_prize.' LONG.</p>
<p>Пул <a href="https://chainik.io/pool/BIP/LONG" target="_blank">BIP/LONG</a></p>
<p><a href="https://t.me/long_project" target="_blank">Новости проекта в Telegram</a>, <a href="https://t.me/long_project_chat" target="_blank">Обсуждения и ответы на вопросы в Telegram</a></p>
<h2>Про фарминг и реинвесты</h2>
<p>Когда вы хотите реинвестировать, смотрите на количество получений и сумму получений.<br>
Если вложите всю сумму в LONG + BIP, получите прибавку на соответствующее количество инвест. дней, если половину - делите количество получений на 2.<br>
И т. д.</p>
<h2>Меню сервисов проекта</h2>
<ol><li><a href="/minter/long/bids" target="_blank">Ставки на курс крипты и пулов в Minter</a></li>
<li><a href="/minter/long/loto" target="_blank">Лотерея среди топ 100 провайдеров пула</a></li>
<li><a href="/minter/long/payd-loto" target="_blank">Лотереи с покупкой билетов за LONG</a></li>
<li><a href="/minter/long/rps" target="_blank">Игра "Камень, ножницы, бумага"</a></li>
<li><a href="/minter/long/surveys" target="_blank">Создать или участвовать в опросах LONG</a></li>
</ol>
<h3>Основные данные</h3>
<ul>
<li>Максимальная распределяемая сумма в день: <span id="min_percent">'.$max_amount.'</span> LONG</li>
<li>Максимальная сумма в лото и бонусах за инвест. дни (за день): '.($max_prize * 2).' LONG</li>
<li>На фарминг выделяется <span id="farming_amount">'.$farming_amount.'</span> LONG</li>
<li>Общий опыт всех провайдеров ликвидности (опыт = общая ликвидность * (инвест. дни / 100): <span id="all_power">'.$all_experience.'</span></li>
<li>Ликвидность ('.number_format($l, 2, ',', '&nbsp;').' LP-683, '.number_format($all_bip, 2, ',', '&nbsp;').' BIP и '.number_format($all_long, 2, ',', '&nbsp;').' LONG)</li>
<li>Для получения бонуса за кратные 50 инвест. дни и участия в лотерее необходимо добавить больше '.$min_loto_bip.' BIP и '.$min_loto_long.' LONG</li>
<li id="prices">Курс 1 LONG = <span id="current_price">'.round($current_price, 2).'</span> BIP<span id="usd_price</span><span id="rub_price"></span>.</li></ul>
<span id="lp_liquidity" style="display: none;">'.$l.'</span>
<h3>Провайдеры</h3>
<h4>Калькулятор фарминга</h4>
<form class="form">
<p><label for="long_amount">Количество LONG:<br>
<input type="number" name="long_amount" min="0" placeholder="Введите сумму LONG">
</label></p>
<p>Вам надо будет добавить также <span id="bip_add_amount">0</span> BIP<br>
Примерная сумма LP-токенов: <span id="adding_liquidity"></span></p>
<p><label for="invest_days_calc">Кол-во инвест. дней:<br>
<input type="number" name="invest_days_calc" min=0 max=3650 value="0" placeholder="Выберите инвест. день">
</label></p>
<p>Сумма фарминга: <span id="result_profit">0</span> LONG *Курс действителен на <span id="page_date"></span></p>
</form>
<h4>Добавить ликвидность</h4>
<div id="auth_msg" style="display: none;"><p>Для работы с кошельком необходимо авторизоваться seed фразой или через BIP wallet. Сделайте это <a href="'.$conf['siteUrl'].'minter/accounts" target="_blank">на странице аккаунтов</a>.</p></div>                        
<div id="seed_page"><form>
<p><label for="add_amount">Сумма LONG (максимум <span id="max_add"></span> LONG) <br>
<input type="number" min=1 name="add_amount"></p>
<p><label for="add_bip_amount">Сумма BIP (максимум <span id="max_add_bip"></span> BIP) <br>
<input type="number" min=1 name="add_bip_amount"></p>
<p><strong><input type="button" id="action_add_liquidity" value="➕"></strong></p>
</form></div>
<h4>Список</h4>
<p><b>Чем больше инвест. дней, тем больше фарминг (если вы выводите из пула хоть сколько-то LONG, дни обнуляются. Тоже самое при переводе LP-токенов на другой адрес). Добавления в пул не обнуляют дни (это даже можно назвать реинвестом).</b></p>
<p><strong>
По мере получения фарминга и бонуса за инвест. дни повышаются параметры: "сумма получения" и "количество получений".<br>
Количество получений показывает, сколько инвест. дней вы получите, если реинвестируете всю сумму из суммы получений.<br>
При продаже LONG из суммы получений ничего не вычитается, также как и из количества получений: они дожидаются реинвестов, какой бы промежуток между реинвестами бы не был.<br>
При реинвесте считается доля от суммы получения и умножается на количество получений. Итоговое число прибавляется к инвест. дням, а также вычитается из количества получений.<br>
Например, если вы получали на протяжении 10 дней в среднем 500 LONG фармингом и вы не реинвестировали, у вас будет 5000 LONG в сумме получения и 10 в количестве получений;<br>
При реинвесте половины суммы прибавится +5 инвест. дней, а также в количестве получений будет 5, а после следующей рассылки фарминга станет 6. В сумме же останется 2500 (+ 500 следующий день)<br>
А если вы в один из десяти дней получили 5000 LONG бонуса за инвест. дни, в количестве получения будет не 10, а 20 (т. к. 5 000 больше фарминга в 10 раз), а в сумме получения будет 10000 LONG (это в случае отсутствия реинвестов в течение 10 дней).<br>
Соответственно реинвестируя половину этой суммы, вы получите +10 инвест. дней, а в кол-ве получений станет столько-же.<br>
Если же вы реинвестировали всё, у вас сразу же будет 0 количество получений, 0 сумма получений и +20 инвест. дней.</strong></p>
<p><strong>При вкладе >= 1000 LP-токенов выдаются бонусные инвест. дни, равные проценту от ликвидности.<br>
Т. е., если вы добавляете 10% от общего кол-ва LP-токенов, получаете +10 инвест. дней; если 1% - 1, если 4% - 4, и т. д.</strong></p>
<p>И напоминаю, что от инвест. дней зависит ваш процент фарминга: вы конкурируете друг с другом за долю от максимальной суммы фарминга.</p>
<hr>
<p align="center">Кошелёк отправки фарминга и бонуса за инвест. дни, кратные 50: <a href="https://dpos.space/minter/profiles/Mx01029d73e128e2f53ff1fcc2d52a423283ad9439" target="_blank">Mx01029d73e128e2f53ff1fcc2d52a423283ad9439</a><br>
<strong>Из-за больших комиссий в BIP и LONG мы вынуждены сделать отложенную отправку накопленных сумм каждый седьмой день месяца. <a href="https://dpos.space/minter/long/deferred-txs" target="_blank">Список</a></strong></p>
<div style="display: none" id="referer_info"></div>
<table id="table">
<thead><tr><th>№</th>
<th>Адрес</th>
<th>Ликвидность</th>
<th>Инвест. дней</th>
<th>Сумма получений (кол-во получений)</th>
<th>Будущий фарминг, сумма (процент)</th>
<th>Вероятная сумма бонуса за кратные 50 инвест. дни</th>
<th>Действия</th>
</tr></thead>
<tbody id="target">';
foreach($res['providers'] as $key => $provider) {
  $key++;
  $liquidity_share = (float)$provider['liquidity'] / $l;
  $provider_bip = $all_bip * $liquidity_share;
  $provider_long = ($all_long) * $liquidity_share;
  $provider_days = (float)$provider['invest_days'];

  $lock_days = 0;
  if (isset($locks[$provider['address']])) {
$lock = $locks[$provider['address']];
$lock_days = ($lock['days'] / $lock['count']);
$lock_share = (float)$lock['amount'] / (float)$provider['liquidity'];
$lock_days *= $lock_share;
  }
$provider_days += $lock_days;

  $experience = (float)$provider['liquidity'] * (1 + ($provider_days / 100));
  $share = $experience / $all_experience;
  $farming_share = $farming_amount * $share;
  $provider_percent = ($farming_share / ($provider_long * 2)) * 100;
[$days, $supers_counter, $super] = getCalcData($key, $provider);

$get_counter = number_format($provider['get_counter'], 3, ',', '&nbsp;');

$bonus_value = 0;
if ($supers_counter > 0) {
$points = (float)$provider['liquidity'] * $supers_counter;
$share = $points / $all_supers;
$bonus_value = $max_prize * $share;
if ($bonus_value > ($farming_share * 10)) $bonus_value = $farming_share * 10;
}
$content .= '<tr>
<td>'.$key.'</td>
<td><a href="https://chainik.io/address/'.$provider['address'].'" target="_blank">'.$provider['address'].'</a></td>
<td>'.number_format($provider['liquidity'], 3, ',', '&nbsp;').' ('.number_format($provider_long, 3, ',', '&nbsp;').' LONG и '.number_format($provider_bip, 3, ',', '&nbsp;').' BIP)</td>
<td>'.round($provider_days, 3).'</td>
<td>'.number_format($provider['get_amount'], 3, ',', '&nbsp;').' LONG ('.$get_counter.' получений)</td>
<td>'.number_format($farming_share, 3, ',', '&nbsp;').' LONG ('.round($provider_percent, 3).'%)</td>
<td>'.$bonus_value.'</td>
<td><a href="/minter/long/calc/'.$provider['address'].'" target="_blank">Семейный калькулятор</a>, <a data-fancybox data-src="#referer_info" href="javascript:;" onclick="$(`#referer_info`).html(`'.$provider['referer'].'`)">Пригласитель</a></td>
</tr>';
}
$content .= '</tbody></table>';
return $content;
?>