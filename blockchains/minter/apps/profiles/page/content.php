<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
global $conf;
return '<h2>Балансы</h2>
<ul id="balances"></ul>
<h2>HUB в других блокчейнах</h2>
<ul><li>В Ethereum: <span id="ethereum_hub"></span></li>
<li>В BSC: <span id="bsc_hub"></span></li>
</ul>
<h2>Доп. информация</h2>
<ul><li>Реворды с делегирования за вчера: <span id="last_reward">Неизвестно...</span></li>
<li>NONCE (для создания транзакций): <span id="nonce"></span><br>
<input type="button" name="copy_nonce" value="Копировать"></li>
</ul>

<h2>История транзакций</h2>
<table><thead><tr><th>Дата</th>
<th>Блок</th>
<th>Хеш транзакции</th>
<th>Тип</th>
<th>Сумма</th>
<th>Сообщение</th></tr>
</thead>
<tbody id="history_tbody"></tbody></table>
<div id="history_pages"></div>
<h2>Введите в поле ниже адрес любого пользователя блокчейна Minter:</h2>
<form class="form" method = "post" action = "">
  <input type = "hidden" name = "chain" value = "minter">
  <input type = "hidden" name = "service" value = "profiles">
  <label for = "user">Введите адрес кошелька (начинается с MX):</label>
  <input type = "text" name = "user" value="'.$user.'">
  <input type = "submit" value = "узнать инфу"/>
</form>
'; ?>