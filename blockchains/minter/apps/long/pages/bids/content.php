<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
      $url = pageUrl();
      $bids_date = gmdate("Y-m-d");
      if (isset($url[3])) $bids_date = $url[3];
   $res = file_get_contents('http://178.20.43.121:3852/smartfarm/bids?date='.$bids_date);
   $for_page = json_decode($res, true);
$allowedCoins = $for_page['allowedCoins'];
$minAmountsAllowedCoins = $for_page['minAmountsAllowedCoins'];

$content = '<p align="center"><strong><a href="/minter/long">К фармингу</a></strong></p>
<p>О LONG вы сможете узнать на странице фарминга. Здесь же про сервис ставок на курс крипты и пулов Minter.</p>
<h2>Сделать ставку</h2>
<span id="allowedCoins" style="display: none;">'.$allowedCoins.'</span><span id="minAmountsAllowedCoins" style="display: none;">'.$minAmountsAllowedCoins.'</span>
<div id="auth_msg" style="display: none;"><p>Для работы с кошельком необходимо авторизоваться seed фразой. Укажите её <a href="'.$conf['siteUrl'].'minter/accounts" target="_blank">на странице аккаунтов</a>.</p></div>                        
<div id="seed_page"><form>
<p><label for="bids_tokens">Токен или пул, за который хотите сделать ставку<br>
<select name="bids_tokens">
<option value="">Выберите токен или пул</option>';
$projects = $for_page['projects'];
foreach ($projects as $name => $price) {
  $content .= '<option value="'.$name.'">'.$name.' - '.rtrim(number_format($price, 8, ".", ""), 0).'</option>
';
}
$content .= '</select></p>
<p><label for="bid_send_coin">Токен сети Minter для отправки ставки:</label></p>
<p><input type="text" name="bid_send_coin" id="bid_send_coin" placeholder="BIP"></p>
<p><label for="bid_amount">Сумма ставки (максимум <span id="max_bid"></span> <span id="selected_symbol"></span>) <br>
<input type="number" min=1 name="bid_amount"></p>
<p>Направление движения данного токена или пула:<br>
<input type="radio" id="bids_direction1" name="bids_direction" value="+">
<label for="bids_direction1">+</label><br>
<input type="radio" id="bids_direction2" name="bids_direction" value="-">
<label for="bids_direction2">-</label>
<p><strong><input type="button" id="action_send_bid" value="Поехали!"></strong></p>
</form></div>
<hr>
<div>'.$for_page['file'].'</div>
<p>При наличии лишь одного отправившего ставку на токен, происходит возврат всей суммы вклада.</p>
<h2><a name="history">Предыдущие ставки</a></h2>';
$start = strtotime('2021-11-2 GMT');
$finish = time();
$date_line = $finish - $start;
if ($date_line >= 86400) {
  $content .= '<ul>';
  for($i=$finish; $i >= $start; $i-=86400){
    $now_date = gmdate("Y-m-d", $i);
    if ($now_date === gmdate("Y-m-d")) continue;
    $content .= '<li><a href="/minter/long/bids/'.$now_date.'" target="_blank">'.$now_date.'</a></li>
';
}
$content .= '</ul>';
}
if (!isset($url[3])) {
  $get_active_bids = file_get_contents('http://178.20.43.121:3852/smartfarm/bids/active');
$active_bids = json_decode($get_active_bids, true);
$content .= '<h2>Активные ставки</h2>
<table id="bids_table"><thead><tr>
<th>Токен</th>
<th>Адрес</th>
<th>Сумма</th>
<th>Прогноз направления</th>
</tr></thead><tbody id="target">';
foreach ($active_bids as $bid) {
  $content .= '<tr>
  <td>'.$bid['token'].'</td>
  <td><a href="https://dpos.space/minter/profiles/'.$bid['address'].'" target="_blank">'.$bid['address'].'</a></td>
<td>'.round($bid['amount'], 8).' '.$bid['send_coin'].'</td>
  <td>'.$bid['direction'].'</td>
</tr>';
}
$content .= '</tbody></table>';

}
return $content;
?>