<?php
ini_set('session.gc_maxlifetime', 12000000960);
ini_set('session.cookie_lifetime', 12000000960);
@session_start();

$siteurl = 'https://dpos.space/';
$title_domain = "| DPOS.space";
if (isset($_POST['user'])) {
    $array_url[0] = $_POST['service'];
    $array_url[1] = $_POST['user'];
    $array_url[2] = $_POST['chain'];
$_SESSION['user_name'] = $_POST['user'];
$_SESSION['chain_name'] = $_POST['chain'];
 header("Location: " .$siteurl . $_POST['service'] . '/' . $_POST['user'] . '/' . $_POST['chain']);
}

if (isset($_GET['array_url'])) {
    $array_url = $_GET['array_url'];
}
if (isset($_GET['service'])) {
    $array_url[0] = $_GET['service'];
    $array_url[1] = $_GET['user'];
    $array_url[2] = $_GET['chain'];
}

if (in_array(($array_url[0] ?? $array_url[0] ?? ""), ['profiles', 'feed'])) {
    if (!empty($array_url[2])) {
        $chain = $array_url[2];
$_SESSION['user_name'] = $array_url[1];
$_SESSION['chain_name'] = $array_url[2];
    }
} else if (($array_url[0] ?? $array_url[0] ?? "") == 'backup' or ($array_url[0] ?? $array_url[0] ?? "") == 'calc' or ($array_url[0] ?? $array_url[0] ?? "") == 'post') {
    if (!empty($array_url[1])) {
        $chain = $array_url[1];
    }
} else if (in_array(($array_url[0] ?? $array_url[0] ?? ""), ['tags'])) {

} else if (!isset($array_url[0]) ){
$chain = 'Golos, Steem, Viz или WLS';
} else {
    header("HTTP/1.0 404 Not Found");
    $title = "Страница не существует";
    $meta_keywords = "404, ошибка, страница, не существует, ошибка";
    $meta_description = "404 ошибка";
    $h1 = "Ошибка 404: страница не существует";
    $description = "<p>Страница, на которой вы находитесь, не существует. Проверьте написание адреса: возможно вы что-то пропустили.</p>";
$footer_text = "... Ничего не позволяет: только выбрать любой сервис в меню";
require_once 'template/header.php';
require_once 'template/menu.php';
       echo '<main class="content">
       <p>Перейдите на любую страницу, воспользовавшись верхним меню.</p>
       </main>';
       require_once 'template/footer.php';
       exit;
}


// Устанавливаем параметры для чейнов:
if ( isset($chain)) {
    if ($chain == 'golos') {
        $chain_name = "Golos";
        $chain_connector = "Golos";
        $chain_user = "Голосян";
        $client = "golos.io";
        		$amount1 = "GOLOS";
        $amount2 = "СГ";
        $amount3 = "GBG";
        $summa3 = "5.000";
        $summa1 = "3.000";
        $amount_account = 'golos-backup';
$sp_tec = 'GESTS';
    } else     if ($chain == 'viz') {
        $chain_name = "Viz";
        $chain_connector = "Viz";
        $chain_user = "Визян";
        $client = "viz.world";
        		$amount1 = "VIZ";
        $amount2 = "SHARES";
        $summa1 = "3.000";
        $amount_account = 'liveblogs';
$sp_tec = 'VIZ';
} else if ($chain == 'WLS') {
        $chain_name = "WhaleShares";
        $chain_connector = "Whaleshares";
        $chain_user = "Whaleshares";
        $client = "whaleshares.io";
        $amount1 = "WLS";
        $amount2 = "WHALESTAKE";
        $summa = "0.500";
        $amount_account = 'denis-skripnik';
    $sp_tec = 'vests';
	} else if ($chain == 'steem') {
        $chain_name = "Steem";
        $chain_connector = "Steemit";
        $chain_user = "Стим";
        $client = "steemit.com";
        $amount1 = "STEEM";
        $amount2 = "SP";
        $amount3 = "SBD";
        $summa3 = "0.010";
        $summa1 = "0.003";
        $amount_account = 'denis-skripnik';
    $sp_tec = 'vests';
	}
}

require_once 'home.php';
require_once 'profiles/params.php';
require_once 'backup/params.php';
require_once 'feed/params.php';
require_once 'tags/params.php';
require_once 'calc/params.php';
require_once 'post/params.php';

if (isset($array_url[0])) {
    $service = $array_url[0];
}