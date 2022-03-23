<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
$address = file_get_contents('https://api.minter.one/v2/addresses?addresses=Mx01029d73e128e2f53ff1fcc2d52a423283ad9439&addresses=Mx6b897dff137ba8e6847812ae09ad46d709da7ec4');
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

$min = $res['providers'][99];
$min_loto_bip = $all_bip * ((float)$min['liquidity'] / $l);
$min_loto_bip = number_format($min_loto_bip, 2, ',', '&nbsp;');
$min_loto_long = $all_long * ((float)$min['liquidity'] / $l);
$min_loto_long = number_format($min_loto_long, 2, ',', '&nbsp;');
      
function getCalcData($key, $provider, $percent) {
  $provider['invest_days'] += 1;
        $power = 0;
$supers_counter = 0;
if ($key <= 100) {
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
  global $percent;
  [$b_days, $supers_counter, $power] = getCalcData(1, $b, $percent);
if ($supers_counter > 0) {
  $a += (float)$power;
}
  return $a;
}

$top_providers = array_slice($res['providers'], 0, 99);
$all_supers = array_reduce($top_providers, "allPowerSum");

function allExperienceSum($a, $b) {
  global $percent;
  $a += (float)$b['liquidity'] * ((float)$b['invest_days'] / 100);
  return $a;
}
$all_experience = array_reduce($top_providers, "allExperienceSum");
$max_amount = 120000;

$content = '<h2>О LONG (<a href="/minter/long/phelosophy" target="_blank">Философия проекта</a>)</h2>
<p>Это токен с фармингом в LONG, процент которого зависит от долгосрочности удержания и реинвестирования получаемого.<br>
Сумма фарминга для конкретного провайдера ликвидности берётся от ликвидности в BIP.<br>
Инвест. дни начисляются за удержание в пуле (каждый день после расчётов фарминга) и за реинвест фарминга с бонусами моментально.<br>
<strong>Инвест. дни и отправка производится от суммы в 0.2 LONG (это сделано, чтоб сумма отправки не была меньше комиссии).</strong></p>
<p>При достижении количества инвест дней кратно 50, топ 100 провайдеры получают бонус в виде доли от 30000 long соответственно своему стейку.<br>
Чем больше накопили инвест. дней, тем больше множитель ликвидности, т. е., если вы накопили 100 инвест. дней, ликвидность при подсчёте доли от 30 000 LONG умножится на 2; При достижении 150 - на 3; 300 - на 6, 500 - на 10 и т. п.<br>
Сумма в 30 000 LONG выделяется каждый день, но начисления производятся 1 раз при достижении.<br>
Если сумма бонуса больше ликвидности в BIP, делённой на курс LONG, отправляется бонус, равный ликвидности в BIP / курс LONG.<br>
Если пользователь реинвестирует так, что он пропускает кратный 50 инвест. день, он все равно учитывается, т. к. проходит его при изменении.</p>
<p>Пул <a href="https://chainik.io/pool/BIP/LONG" target="_blank">BIP/LONG</a></p>
<p><a href="https://t.me/long_project" target="_blank">Новости проекта в Telegram</a>, <a href="https://t.me/long_project_chat" target="_blank">Обсуждения и ответы на вопросы в Telegram</a></p>
<div class="tt" onclick="spoiler(`formulas`); return false"><strong>Раскрыть формулы</strong></div>
<div id="formulas" class="terms" style="display: none;">
<h3>Формулы</h3>
<ol><li>Процент изменения курса LONG = (Текущий курс - стартовая в 1 BIP) / стартовая * 100;
<li>Инвест. дни прибавляются с каждым днём, но также прибавляются за реинвест:<br>
бонусный инвест. день = количество получений * (сумма реинвеста / сумма получения)</li>
<li>Реинвестируя бонусы за кратные 50 инвест. дни, вы можете получить очень много инвест. дней. Например, если вы получили бонус 30000 LONG, а фарминг у вас 6000, получите +5, но они будут начислены вам только в случае реинвеста всей суммы LONG + BIP;</li>
<li>Минимальный процент = '.$percent.'</li>
<li>Максимальный процент (СМ. список в следующем блоке) = (процент 0.7 + (0.7 * (процент изменения курса LONG в BIP / 100)) / 10))<br>
Но не более 1 и не менее 0.7%;</li>
<li>Процент провайдера = минимальный процент + ((максимальный процент - минимальный процент) * (инвест. день провайдера / максимальный инвест. день))</li>
<li>Сумма получения = ликвидность провайдера в BIP * (процент провайдера / 100) с последующим делением на курс 1 LONG;</li>
</ol>
</div>
<h2>Меню сервисов проекта</h2>
<ol><li><a href="/minter/long/bids" target="_blank">Ставки на курс крипты и пулов в Minter</a></li>
<li><a href="/minter/long/payd-loto" target="_blank">Лотереи с покупкой билетов за LONG</a></li>
<li><a href="/minter/long/rps" target="_blank">Игра "Камень, ножницы, бумага"</a></li>
<li><a href="/minter/long/surveys" target="_blank">Создать или участвовать в опросах LONG</a></li>
</ol>
<h3>Основные данные</h3>
<ul>
<li>Максимальная распределяемая сумма в день: <span id="min_percent">'.$max_amount.'</span> LONG</li>
<li>Общий опыт всех провайдеров ликвидности (опыт = общая ликвидность * (инвест. дни / 100): <span id="max_percent">'.$all_experience.'</span></li>
<li>Ликвидность ('.number_format($l, 2, ',', '&nbsp;').' LP-683, '.number_format($all_bip, 2, ',', '&nbsp;').' BIP и '.number_format($all_long, 2, ',', '&nbsp;').' LONG)</li>
<li>Для получения бонуса за кратные 50 инвест. дни необходимо добавить больше '.$min_loto_bip.' BIP и '.$min_loto_long.' LONG</li>
<li id="prices">Курс 1 LONG = <span id="current_price">'.round($current_price, 2).'</span> BIP<span id="usd_price</span><span id="rub_price"></span>.</li></ul>
<span id="bip_liquidity" style="display: none;">'.$all_bip_liquidity.'</span><span id="lp_liquidity" style="display: none;">'.$l.'</span>
<h3>Провайдеры</h3>
<h4>Добавить ликвидность</h4>
<div id="auth_msg" style="display: none;"><p>Для работы с кошельком необходимо авторизоваться seed фразой или через BIP wallet. Сделайте это <a href="'.$conf['siteUrl'].'minter/accounts" target="_blank">на странице аккаунтов</a>.</p></div>                        
<div id="seed_page"><form>
<p><label for="add_amount">Сумма LONG (максимум <span id="max_add"></span> LONG) <br>
<input type="number" min=1 name="add_amount"></p>
<p><label for="add_bip_amount">Сумма BIP (максимум <span id="max_add_bip"></span> BIP) <br>
<input type="number" min=1 name="add_bip_amount"></p>
<p><label for="add_tokens">Список токенов и пулов через запятую (например, BTC,BIP/LONG,ARCONA/USDTE) <br>
<input type="text" name="add_tokens"></p>
<p><strong><input type="button" id="action_add_liquidity" value="➕"></strong></p>
</form></div>
<h4>Список</h4>
<p><b>Чем больше инвест. дней, тем больше фарминг (если вы выводите из пула хоть сколько-то LONG, дни обнуляются. Тоже самое при переводе LP-токенов на другой адрес). Добавления в пул не обнуляют дни (это даже можно назвать реинвестом).</b></p>
<p><strong>
По мере получения фарминга и бонуса за инвест. дни повышаются параметры: "сумма получения" и "количество получений".<br>
Сумма получения: увеличивается на сумму последнего полученного фарминга, а так же сумму *полученного бонуса.<br>
Количество получений: увеличивается на 1 за фарминг + за *бонус (бонус / фарминг).<br>
 *При отсутствии бонуса будет лишь +1 за фарминг.<br>
При продаже LONG из суммы получений ничего не вычитается, также как и из количества получений: они дожидаются реинвестов, какой бы промежуток между реинвестами бы не был.<br>
При реинвесте считается доля от суммы получения и умножается на количество получений. Итоговое число прибавляется к инвест. дням, а также вычитается из количества получений.<br>
Например, если вы получали на протяжении 10 дней в среднем 500 LONG фармингом и вы не реинвестировали, у вас будет 5000 LONG в сумме получения и 10 в количестве получений;<br>
При реинвесте половины суммы прибавится +5 инвест. дней, а также в количестве получений будет 5, а после следующей рассылки фарминга станет 6.<br>
А если вы в один из десяти дней получили 10000 LONG бонуса за инвест. дни, в количестве получения будет не 10, а 30 (т. к. 10 000 больше фарминга в 20 раз), а в сумме получения будет 15000 LONG (это в случае отсутствия реинвестов в течение 10 дней).<br>
Соответственно реинвестируя половину этой суммы, вы получите +15 инвест. дней, а в кол-ве получений станет столько-же.<br>
Если же вы реинвестировали всё, у вас сразу же будет не 30 количество получений, а лишь 10. Соответственно при реинвесте половины вы получите лишь +5 инвест. дней, а при реинвесте всей суммы, включающей фарминг и бонус - +10.</strong></p>
<p><strong>При вкладе >= 1000 LP-токенов выдаются бонусные инвест. дни, равные проценту от ликвидности.<br>
Т. е., если вы добавляете 10% от общего кол-ва LP-токенов, получаете +10 инвест. дней; если 1% - 1, если 4% - 4, и т. д.</strong></p>
<p>И напоминаю, что от инвест. дней зависит ваш процент фарминга: пользователь с максимальным числом инвест. дней получает максимальный процент, но его все равно могут обогнать.</p>
<hr>
<p align="center">Кошелёк отправки фарминга и бонуса за инвест. дни, кратные 50: <a href="https://dpos.space/minter/profiles/Mx01029d73e128e2f53ff1fcc2d52a423283ad9439" target="_blank">Mx01029d73e128e2f53ff1fcc2d52a423283ad9439</a></p>
<div style="display: none" id="bids_tokens"><p id="bids_tokens_list" onclick="copyOnClick(this)"></p></div>
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
$provider_long = $all_long * $liquidity_share;

  $experience = (float)$provider['liquidity'] * ((float)$provider['invest_days'] / 100);
  $share = $experience / $all_experience;
$farming_share = $max_amount * $share;
$provider_percent = ($farming_share / $provider_long) * 100;
[$days, $supers_counter, $super] = getCalcData($key, $provider, $percent);

$get_counter = number_format($provider['get_counter'], 3, ',', '&nbsp;');

$bonus_value = 0;
if ($supers_counter > 0) {
  $max_amount = 30000;
$points = (float)$provider['liquidity'] * $supers_counter;
$share = $points / $all_supers;
$bonus_value = $max_amount * $share;
if ($bonus_value > ($provider_bip / $current_price)) $bonus_value = $provider_bip / $current_price;
}

$content .= '<tr>
<td>'.$key.'</td>
<td><a href="https://chainik.io/address/'.$provider['address'].'" target="_blank">'.$provider['address'].'</a></td>
<td>'.number_format($provider['liquidity'], 3, ',', '&nbsp;').' ('.number_format($provider_long, 3, ',', '&nbsp;').' LONG и '.number_format($provider_bip, 3, ',', '&nbsp;').' BIP)</td>
<td>'.round($provider['invest_days'], 3).'</td>
<td>'.number_format($provider['get_amount'], 3, ',', '&nbsp;').' LONG ('.$get_counter.' получений)</td>
<td>'.number_format($farming_share, 3, ',', '&nbsp;').' LONG ('.round($provider_percent, 3).'%)</td>
<td>'.$bonus_value.'</td>
<td><a href="/minter/long/calc/'.$provider['address'].'" target="_blank">Семейный калькулятор</a>, <a data-fancybox data-src="#bids_tokens" href="javascript:;" onclick="$(`#bids_tokens_list`).html(`'.$provider['for_bids'].'`)">Токены и пулы для ставок</a></td>
</tr>';
}
$content .= '</tbody></table>';
return $content;
?>