<?php
ini_set('session.gc_maxlifetime', 12000000960);
ini_set('session.cookie_lifetime', 12000000960);
@session_start();

if (!isset($array_url[1]) && !isset($chain)) {
    require_once $_SERVER['DOCUMENT_ROOT'] . '/urls.php';
    require_once $_SERVER['DOCUMENT_ROOT'] . '/params.php';
    require_once $_SERVER['DOCUMENT_ROOT'] . '/template/header.php';
    require_once $_SERVER['DOCUMENT_ROOT'] . '/template/menu.php';
    echo '<main class="content">
<h2>Введите логин и выберите блокчейн, чтобы узнать данные пользователя</h2>
<form method="post" action="">
<input type="hidden" name="service" value="' . $array_url[0] . '">
<label for="user">Введите логин на Steem, Golos или WLS без @:</label>
<input type="text" name="user" value="">
<label for="chain">Выберите блокчейн: </label>
<select name="chain">
<option value="steem">Steem</option>
<option value="golos">Golos</option>
<option value="WLS">WLS</option>
<option value="viz">Viz</option>
</select>
 <input type="submit" value="узнать инфу" />
</form>
</main>';
    require_once $_SERVER['DOCUMENT_ROOT'] . '/template/footer.php';
} else if (!isset($chain)) {
    echo '<form method="post" action="">
<input type="hidden" name="service" value="<?php echo $array_url[0]; ?>">
<label for="user">Введите логин на Steem, Golos или WLS без @:</label>
<input type="text" name="user" value="">
 <input type="submit" value="узнать инфу" />
</form>';
} else if (isset($array_url[1])) { // проверяем существование элемента
    $array_url[1] = str_replace('@', '', $array_url[1]);
    
	require_once 'user_view.php';
}