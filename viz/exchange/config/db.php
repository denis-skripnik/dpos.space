<?php

//название базы данных
$dbname = 'scadens_vizexch';
//имя пользователя
$username = 'scadens_vizexch';
//пароль
$pass = 'bzkxiuvytT*gkf6KU^f';
//подключаемся к базе данных
$db = new PDO(
    "mysql:host=localhost;dbname={$dbname};charset=utf8",
    $username,
    $pass
);
?>