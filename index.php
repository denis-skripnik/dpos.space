<?php
ini_set('session.gc_maxlifetime', 12000000960);
ini_set('session.cookie_lifetime', 12000000960);
@session_start();

require_once 'urls.php';
require_once 'params.php';
require_once 'helpers.php';

 $main_filename = $_SERVER['DOCUMENT_ROOT']."/users";
$main_fp = fopen($main_filename.".log", "a");

if (($array_url[0] ?? $array_url[0] ?? "") != 'favicon.ico') {
// записываем в файл текст
fwrite($main_fp, date("d.m.Y H:i:s").":"."\r\n"."Сервис: ".($array_url[0] ?? $array_url[0] ?? "главная")."; Логин: ".($_SESSION['user_name'] ?? $_SESSION['user_name'] ?? "Нет пользователя")."; Блокчейн: ".($_SESSION['chain_name'] ?? $_SESSION['chain_name'] ?? "нет блокчейна")."\r\n"."\r\n");
}

fclose($main_fp);

noCache();

 require_once 'template/header.php';
require_once 'template/menu.php';
 require_once 'template/content.php';
require_once 'template/footer.php';
