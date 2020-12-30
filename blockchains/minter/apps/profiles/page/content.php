<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
global $conf;
return '<h2>Балансы</h2>
<ul id="balances"></ul>
<h2>История транзакций</h2>
<table><thead><tr><th>Дата</th>
<th>Блок</th>
<th>Хеш транзакции</th>
<th>Тип</th>
<th>Сумма</th></tr>
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