<form method="post" action="">
    <input type="hidden" name="service" value="<?= $array_url[0] ?>">
    <label for="user">Введите логин на Steem, Golos или WLS без @:</label>
    <input type="text" name="user" value="">
    <label for="chain">Выберите блокчейн: </label>
    <select name="chain">
        <option value="steem">Steem</option>
        <option value="golos">Golos</option>
        <option value="WLS">WLS</option>
    </select>
    <input type="submit" value="Открыть" />
</form>
