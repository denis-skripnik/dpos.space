<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<div id="active_auth_msg" style="display: none;"><p>Для обмена необходим активный ключ. Укажите его <a href="'.$conf['siteUrl'].'viz/accounts" target="_blank">на странице аккаунтов</a>. Если вы авторизованы, удалите аккаунт и добавьте с активным ключом; Если нет, авторизуйтесь с указанием обоих ключей.</p></div>
<p><strong>Статус: <span id="status"></span></strong></p>
<div id="active_page">
<h2>Обменять</h2>
<p><strong>Баланс: <span id="balance"></span> (необходим для продажи и оплаты 1 VIZ для покупки)</strong></p>
<hr>
<div id="config" style="display: none;"></div>
<form class="form">
<p><label for="sell_token">Токен на продажу:<br>
<select name="sell_token" id="sell_token">
<option value="VIZ">VIZ</option>
<option value="USDT">USDT</option>
</select></label></p>
<p><label for="sell_amount">Сумма продажи (Максимум <span id="max_amount">0</span>): <br>
<input type="number" name="sell_amount" id="sell_amount" value="" placeholder="Сумма в виде числа без имени токена"></label></p>
<p><label for="buy_amount">Сумма покупки: <br>
<input type="number" name="buy_amount" id="buy_amount" value="" readonly placeholder="Суммак получению"> <span id="buy_token"></span></label></p>
<hr>
<p align="center" color="red"><strong>Комиссия <span id="market_fee"></span><br>
Курс: <span id="market_price"></span></strong></p>
<p><input type="button" id="action_buy_token" value="Обменять"></p>
</form>
<div class="exchange-buy-error"></div>
<div id="exchange_result" style="display: none;"><h2 class="exchange-buy-success"></h2>
<p>Срок действия адреса закончется в <span id="expired_address"></span> по времени вашего устройства.</p>
<p>
<p>
Адрес для перевода USDT:
<input type="text" name="exchange-income-eth-address" id="exchange_income_eth_address" placeholder="ETH адрес" disabled>
</p>
<p>
<input type="button" value="Копировать" onclick="copytext(`#exchange_income_eth_address`)"></p>
<p>Скорость сделки практически полностью зависит от скорости поступления ваших USDT на наш адрес. Выбирайте размер комиссии в блокчейне Ethereum, исходя из этого.</p>
</div>
<hr>
<h2>Информация обменника</h2>
<div id="info"></div>
</div>'; ?>