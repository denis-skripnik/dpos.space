<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<div id="active_auth_msg" style="display: none;"><p>Для обмена необходим активный ключ. Укажите его <a href="'.$conf['siteUrl'].'golos/accounts" target="_blank">на странице аккаунтов</a>. Если вы авторизованы, удалите аккаунт и добавьте с активным ключом; Если нет, авторизуйтесь с указанием обоих ключей.</p></div>
<div id="active_page">
<h2>Обменять</h2>
<hr>
<form class="form">
<select id="sell_token">
<option value="STEEM">STEEM</option>
<option value="SBD">SBD</option>
</select>
<p><label for="sell_amount">Сумма продажи (Максимум <span id="max_amount">0</span>): <br>
<input type="text" name="sell_amount" id="sell_amount" value="" placeholder="Сумма в виде числа без имени токена"></label></p>
<p><strong>Покупаем <span id="buy_token"></span></strong></p>
<p><label for="buy_amount">Сумма покупки (<a id="change_mode" data-mode="true">Создать произвольный ордер</a>): <br>
<input type="text" readonly name="buy_amount" id="buy_amount" value="" placeholder="Суммак получению"></label></p>
<hr>
<p align="center" color="red"><strong>Курс: <span id="market_price"></span></strong></p>
<p><input type="button" id="action_buy_token" value="Обменять"></p>
</form>
<div><h2>Открытые ордера</h2>
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
</div>'; ?>