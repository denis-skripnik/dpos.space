<?php
    function url() {
    $chpu = $_SERVER['REQUEST_URI'];

    /*
 проверяем, что бы в URL не было ничего, кроме символов
 алфавита (a-zA-Z), цифр (0-9), а также . / - _ #
 в противном случае - выдать ошибку 404
*/

 if (preg_match ("/([^a-zA-Z0-9\.\/\-\_\?\=\&\#])/", $chpu)) {

   header("HTTP/1.0 404 Not Found");
   echo "Недопустимые символы в URL";
   exit;
 }
$array_url = preg_split ("/(\/|\.*$)/", $chpu,-1, PREG_SPLIT_NO_EMPTY);
return $array_url;
    }
?>