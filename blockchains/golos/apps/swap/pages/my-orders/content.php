<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
$service_url = [];
if (isset(pageUrl()[3])) array_push($service_url, '/'.pageUrl()[3]);
if (isset(pageUrl()[4])) array_push($service_url, pageUrl()[4]);
$add_to_url = implode('/', $service_url);
return '<div id="active_auth_msg" style="display: none;"><p>Для обмена необходим активный ключ. Укажите его <a href="'.$conf['siteUrl'].'golos/accounts" target="_blank">на странице аккаунтов</a>. Если вы авторизованы, удалите аккаунт и добавьте с активным ключом; Если нет, авторизуйтесь с указанием обоих ключей.</p></div>
<div id="active_page">
<p align="center"><a href="'.$conf['siteUrl'].'golos/swap'.$add_to_url.'">Моментальный обмен</a></p>
<h2>Создание и просмотр ордеров на обмен</h2>
<p>Отображаются только токены с ненулевым балансом, т.к. если у вас 0, нечего обменивать.</p>
<hr>
<form>
<select id="sell_token">
</select>
<p><label for="sell_amount">Сумма продажи (Максимум <span id="max_amount">0</span>): <br>
<input type="text" name="sell_amount" id="sell_amount" value="" placeholder="Сумма в виде числа без имени токена"></label></p>
<select id="buy_token">
<option value="">Выберите токен</option>
</select>
<p><label for="buy_amount">Сумма покупки: <br>
<input type="text" name="buy_amount" id="buy_amount" value="" placeholder="Суммак получению"></label></p>
<input type="hidden" id="pr1">
<input type="hidden" id="pr2">
<hr>
<p align="center" color="red"><strong>Комиссия <span id="market_fee"></span><br>
Курс: <span id="market_price"></span></strong></p>
<p><input type="button" id="action_create_order" value="Создать"></p>
</form>
<div><h2>Открытые ордера по паре <span id="open_orders_tokens"></span></h2>
<table><thead>
<th>Дата создания</th>
<th>Сумма продажи</th>
<th>Сумма покупки</th>
<th>Курс</th>
<th>Действие</th>
</thead>
<tbody id="my_orders_list"></tbody>
</table></div>
<p><strong><a id="orders_history" target="_blank">История обменов</a></strong></p>
</div>
</div>'; ?>