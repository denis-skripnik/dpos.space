<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<h2>Введите в поле ниже адрес любого пользователя блокчейна Cyber:</h2>
<form method = "post" action = "">
  <input type = "hidden" name = "chain" value = "cyber">
  <input type = "hidden" name = "service" value = "profiles">
  <label for = "user">Введите адрес (начинается с cyber):</label>
  <input type = "text" name = "user" value="">
  <input type = "submit" value = "узнать инфу"/>
</form>
'; ?>'