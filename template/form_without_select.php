<form method="post" action="">
    <input type="hidden" name="service" value="<?= $service ?>">
    <label for="user">Введите логин на <?= $chain_name ?> без @:</label>
    <input type="text" name="user" value="<?= $user ?>">
    <input type="hidden" name="chain" value="<?= $chain ?>">
    <input type="submit" value="Открыть" />
</form>
