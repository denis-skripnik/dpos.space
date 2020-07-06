<?php return '
<h2>Введите в поле ниже логин любого пользователя блокчейна Golos:</h2>
<form method = "post" action = "">
  <input type = "hidden" name = "chain" value = "golos">
  <input type = "hidden" name = "service" value = "profiles">
  <label for = "user">Введите логин без @:</label>
  <input type = "text" name = "user" value="'.$user.'">
  <input type = "submit" value = "узнать инфу"/>
</form>
';
?>