<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<h2>Введите в поле ниже адрес любого пользователя блокчейна Decimal:</h2>
<form class="form" method = "post" action = "">
  <input type = "hidden" name = "chain" value = "decimal">
  <input type = "hidden" name = "service" value = "profiles">
  <label for = "user">Введите адрес (начинается с Dx):</label>
  <input type = "text" name = "user" value="">
  <input type = "submit" value = "узнать инфу"/>
</form>
'; ?>'