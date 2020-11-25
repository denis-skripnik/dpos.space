<?php
    $url = $_SERVER['REQUEST_URI'];
    $url = explode('/', $url);
    $html = file_get_contents('http://86.57.254.202:36657/'.$url[4]);
echo $html;
?>
