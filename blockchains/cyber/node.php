<?php
    $url = $_SERVER['REQUEST_URI'];
    $url = explode('/', $url);
    $html = file_get_contents('https://rpc.bostrom.cybernode.ai/'.$url[4]);
echo $html;
?>
