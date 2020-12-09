<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
$service_url = [];
if (isset(pageUrl()[2])) array_push($service_url, '/'.pageUrl()[2]);
if (isset(pageUrl()[3])) array_push($service_url, pageUrl()[3]);
$add_to_url = implode('/', $service_url);
return '<div id="active_auth_msg" style="display: none;"><p>Для обмена необходим активный ключ. Укажите его <a href="'.$conf['siteUrl'].'golos/accounts" target="_blank">на странице аккаунтов</a>. Если вы авторизованы, удалите аккаунт и добавьте с активным ключом; Если нет, авторизуйтесь с указанием обоих ключей.</p></div>
<div id="active_page">
<p align="center"><a href="'.$conf['siteUrl'].'golos/swap/my-orders'.$add_to_url.'">Ордера на обмен</a></p>
<h2>Обменять</h2>
<p>Отображаются только токены с ненулевым балансом, т.к. если у вас 0, нечего обменивать.</p>
<hr>
<form class="form">
<select id="sell_token">
</select>
<p><label for="sell_amount">Сумма продажи (Максимум <span id="max_amount">0</span>): <br>
<input type="text" name="sell_amount" id="sell_amount" value="" placeholder="Сумма в виде числа без имени токена"></label></p>
<select id="buy_token">
<option value="">Выберите токен</option>
</select>
<p><label for="buy_amount">Сумма покупки: <br>
<input type="text" readonly name="buy_amount" id="buy_amount" value="" placeholder="Суммак получению"></label></p>
<input type="hidden" id="pr1">
<input type="hidden" id="pr2">
<hr>
<p align="center" color="red"><strong>Комиссия <span id="market_fee"></span><br>
Курс: <span id="market_price"></span></strong></p>
<p><input type="button" id="action_buy_token" value="Обменять"></p>
</form>
<p><strong><a id="orders_history" target="_blank">История обменов</a></strong></p>
</div>'; ?>