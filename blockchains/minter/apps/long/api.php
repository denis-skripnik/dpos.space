<?php
    $url = $_SERVER['REQUEST_URI'];
    $url = explode('/', $url);
    $html = file_get_contents('http://178.20.43.121:3852/smartfarm/'.$url[6]);
echo $html;
?>