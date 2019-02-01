<?php

//название базы данных
$dbname = 'tags';
//имя пользователя
$username = 'root';
//пароль
$pass = '123';
//подключаемся к базе данных
$db = new PDO(
    "mysql:host=localhost;dbname={$dbname};charset=utf8",
    $username,
    $pass
);
?>