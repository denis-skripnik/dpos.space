<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
if (!isset(pageUrl()[3])) {
  return 'Выберите адрес в таблице <a href="/minter/long" target="_blank">на странице фарминга</a> и нажмите на "Дракон".';
}
$html = file_get_contents('http://178.20.43.121:3852/smartfarm/provider?address='.pageUrl()[3]);
$provider = json_decode($html, true);
$explorer = file_get_contents('https://api.minter.one/v2/swap_pool/0/2782');
$pool = json_decode($explorer, true);
$all_bip = ((float)$pool['amount0'] / (10 ** 18));
$all_long = ((float)$pool['amount1'] / (10 ** 18));
$current_price = $all_bip / $all_long;

  $content = '<span style="display: none;" id="current_price">'.round($current_price, 2).'</span>
<p align="center"><strong><a href="/minter/long">Фарминг</a> <a href="/minter/long/loto">Лотерея</a></strong></p>
<h2>Ваш дракон</h2>
';
if (!isset($provider['liquidity'])) {
$content .= '
<p>К сожалению, его у вас ещё нет. Но не расстраивайтесь: завести можете ниже!</p>
<ul><li>Адрес: <a href="https://dpos.space/minter/profiles/'.pageUrl()[3].'" target="_blank"><span id="dragon_address">'.pageUrl()[3].'</span></a></li></ul>
';
    } else {
      $content .= '<p align="center"><img src="/blockchains/minter/apps/long/dragons/'.$provider['invest_days_share'].'.png" alt="'.$provider['invest_days_share'].'%" style="width:100%; max-width:600px; height:auto;"></p>
<ul><li>Адрес: <a href="https://dpos.space/minter/profiles/'.pageUrl()[3].'" target="_blank"><span id="dragon_address">'.pageUrl()[3].'</span></a></li>
      <li>Рост дракона относительно роста самого древнего собрата с округлением к ближайшему целому равен '.$provider['invest_days_share'].'%</li></ul>';
          }
$content .= '<h2>Кормите дракона, чтоб он развивался</h2>
<p>Чем больше доля от максимального инвест. дня, чем старше ваш дракон.<br>
Инвест. дни - это рост вашего дракона в метрах.<br>
Приблизить его к древним собратам вы можете, позволяя ему съедать всё, что он получил у себя дома.</p>
<h3>Стол дракона</h3>
<div id="dragon_table">
<div id="auth_msg" style="display: none;"><p>Для работы с кошельком необходимо авторизоваться seed фразой или через BIP wallet. Сделайте это <a href="'.$conf['siteUrl'].'minter/accounts" target="_blank">на странице аккаунтов</a>.</p></div>                        
<div id="seed_page"><form>
<p><label for="add_amount">Количество литров элексира жизни LONG (максимум <span id="max_add"></span>) <br>
<input type="number" min=1 name="add_amount"></p>
<p><label for="add_bip_amount">Число кристаллов мудрости (максимум <span id="max_add_bip"></span> BIP) <br>
<input type="number" min=1 name="add_bip_amount"></p>
<p><strong><input type="button" id="action_add_liquidity" value="Накормить!"></strong></p>
</form></div>
</div>';
return $content;
?>