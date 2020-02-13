<?php

$_SERVER['DOCUMENT_ROOT'] = '/home/s/scadens/dpos.space/public_html/viz/exchange';

    require_once 'config/urls.php';
    $array_url = url();
    require_once 'config/routing.php';
$config = rout($array_url);
require_once 'template/header.php';
require_once 'template/menu.php';
 require_once 'template/content.php';
require_once 'template/footer.php';
