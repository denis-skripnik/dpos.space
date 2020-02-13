<form action="./pages/add_form.php" method="post">
<p>Логин</p>
<p><input type="text" name="login" value=""></p>
<p>Пароль</p>
<p><input type="password" name="password" value=""></p>
<p>Блокчейн</p>
<p><select name="blockchain" required>
<option disabled selected value> -- Выберите вариант -- </option>
<option value="viz">Viz</option>
<option value="golos">Golos</option>
<option value="steem">Steem</option>
<option value="whaleshares">Whaleshares</option>
</select></p>
<p>Логин шлюза</p>
<p><input type="text" name="gate-login" value=""></p>
<p>Действие:</p>
<select name="action" required>
<option disabled selected value> -- Выберите вариант -- </option>
<option value="add">Добавить</option>
<option value="delete">Удалить</option>
</select>
<p><input type="submit" value="Отправить"></p>
</form>