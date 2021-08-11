<?php
    $url = $_SERVER['REQUEST_URI'];
    $url = explode('/', $url);
    $html = file_get_contents('https://deimos.cybernode.ai/'.$url[4]);
echo $html;
?>
