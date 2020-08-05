<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
global $conf;
return '<h2>Балансы</h2>
<ul id="balances"></ul>
<h2>Введите в поле ниже адрес любого пользователя блокчейна Minter:</h2>
<form method = "post" action = "">
  <input type = "hidden" name = "chain" value = "minter">
  <input type = "hidden" name = "service" value = "profiles">
  <label for = "user">Введите адрес кошелька (начинается с MX):</label>
  <input type = "text" name = "user" value="'.$user.'">
  <input type = "submit" value = "узнать инфу"/>
</form>
';
?>