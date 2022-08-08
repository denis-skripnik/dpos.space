<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
global $conf;
$pagenum = 1;
if (isset($_GET['page'])) {
    $pagenum = $_GET['page'];
}
if (isset($_GET['token'])) {
    $html = getPage('http://178.20.43.121:3000/golos-api?service=top&type='.mb_strtolower($_GET['token']).'&page='.$pagenum);
echo $html;
} else {
    echo '{}';
}
?>