<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
      $url = pageUrl();
      $bids_coin = '';
      if (isset($url[3])) $bids_coin = $url[3];
   $res = file_get_contents('http://178.20.43.121:3852/smartfarm/bids?coin='.$bids_coin);
   $for_page = json_decode($res, true);
$allowedCoins = $for_page['allowedCoins'];
$minAmountsAllowedCoins = $for_page['minAmountsAllowedCoins'];
$allowed_coins = explode(',', $allowedCoins);

$allowedCoinsInfo = '';
$allowedCoinsLinks = '<ol>';
for ($n = 0; $n < count($allowed_coins); $n++) {
  $allowedCoinsInfo .= $allowed_coins[$n]." (мин. ".explode(',', $minAmountsAllowedCoins)[$n]."), ";
    $allowedCoinsLinks .= '<li><a href="/minter/long/bids/'.$allowed_coins[$n].'">'.$allowed_coins[$n].'</a></li>';
  }
  $allowedCoinsInfo = preg_replace('/,\s*$/', '', $allowedCoinsInfo);
$allowedCoinsLinks .= '</ol>';

$content = '<p align="center"><strong><a href="/minter/long">К фармингу</a></strong></p>
<p>О LONG вы сможете узнать на странице фарминга. Здесь же про сервис ставок на курс крипты и пулов Minter.</p>';

$projects = $for_page['projects'];
$active_projects = '<ol>';
$form_projects = '  <p><label for="bids_tokens">Токен или пул, за который хотите сделать ставку<br>
<select name="bids_tokens" id="bids_tokens">
<option value="">Выберите токен или пул</option>';
foreach ($projects as $name => $price) {
  $form_projects .= '<option value="'.$name.'">'.$name.' - '.rtrim(number_format($price, 8, ".", ""), 0).'</option>
';
$active_projects .= "<li>$name - ".round($price, 3)."</li>
";
}
$active_projects .= '</ol>';
$form_projects .= '</select></p>';

if (isset($url[3])) {
  $content .= '<h2>Сделать ставку</h2>
  <span id="allowedCoins" style="display: none;">'.$allowedCoins.'</span><span id="minAmountsAllowedCoins" style="display: none;">'.$minAmountsAllowedCoins.'</span>
  <div id="auth_msg" style="display: none;"><p>Для работы с кошельком необходимо авторизоваться seed фразой. Укажите её <a href="'.$conf['siteUrl'].'minter/accounts" target="_blank">на странице аккаунтов</a>.</p></div>                        
  <div id="seed_page"><form>
'.$form_projects.'
  <p style="display: none;"><input type="text" name="bid_send_coin" id="bid_send_coin" value="'.$url[3].'"></p>
  <p><label for="bid_amount">Сумма ставки (максимум <span id="max_bid"></span> <span id="selected_symbol"></span>) <br>
  <input type="number" min=1 name="bid_amount"></p>
  <p>Направление движения данного токена или пула:<br>
  <input type="radio" id="bids_direction1" name="bids_direction" value="+">
  <label for="bids_direction1">+</label><br>
  <input type="radio" id="bids_direction2" name="bids_direction" value="-">
  <label for="bids_direction2">-</label>
  <p><strong><input type="button" id="action_send_bid" value="Поехали!"></strong></p>
  </form></div>';
} else {
$content .= '<h2>Выберите токен отправки ставки</h2>
'.$allowedCoinsLinks;
}
$content .= '<hr>
<div><p>Чтобы участвовать в проекте, смотрите список актуальных токенов и пулов, после чего отправляйте транзакцию на адрес<br>
<code id="send_to_address">'.$for_page['address'].'</code><br>
С любой суммой в '.$allowedCoinsInfo.' и указанием в сообщении:<br>
lbid BTC + или lbid BTC -<br>
Где BTC - токен или пул.</p>
<p>Пример ввода пула:<br>
lbid BIP/HUB<br>
<b>Активы должны быть в списке разрешённых.<br>
Результаты получаем, когда минута делится на 5, а ставки можно делать до минуты вычисления результата -1, например, 4, 9, 14, 19... и самой минуты получения результата.</b>.</p>
<p>P. S. Для криптовалют данные берутся с coingecko.</p>
<h2>Активные токены и пулы</h2>
<p>Именно их вы можете указывать, делая ставки.</div>
'.$active_projects.'
<p>При наличии лишь одного отправившего ставку на токен, происходит возврат всей суммы вклада.</p>';
if (isset($url[3])) {
$content .= '<h2>Активные ставки в '.$url[3].' </h2>
<p><strong>Обновляется раз в 3 секунды.</strong></p>
<table id="bids_table"><thead><tr>
<th>Токен</th>
<th>Адрес</th>
<th>Сумма</th>
<th>Прогноз направления</th>
</tr></thead><tbody id="target"></tbody></table>
<div id="coefficient"></div>';
}
$content .= '<hr>

'.$for_page['file'].'
';
return $content;
?>