<?php return '
<h2>Введите в поле ниже логин любого пользователя блокчейна Steem:</h2>
<form method = "post" action = "">
  <input type = "hidden" name = "chain" value = "steem">
  <input type = "hidden" name = "service" value = "profiles">
  <label for = "user">Введите логин без @:</label>
  <input type = "text" name = "user" value="">
  <input type = "submit" value = "узнать инфу"/>
</form>
'; ?>'