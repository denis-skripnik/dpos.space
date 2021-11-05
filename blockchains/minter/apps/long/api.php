<?php
    $url = $_SERVER['REQUEST_URI'];
    $url = explode('/', $url);
    $html = file_get_contents('http://138.201.91.11:3852/smartfarm/'.$url[6]);
echo $html;
?>