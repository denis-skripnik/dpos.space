<?php

//название базы данных
$dbname = 'golosdata';
//имя пользователя
$username = 'golosidentier';
//пароль
$pass = 'NtI6V87Jf6Htc-OhPhUUtdfYT6UH78jCHY67&';
//подключаемся к базе данных
$db = new PDO(
    "mysql:host=localhost;dbname={$dbname};charset=utf8",
    $username,
    $pass
);
?>