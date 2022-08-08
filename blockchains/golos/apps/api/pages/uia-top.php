<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
global $conf;
$pagenum = 1;
if (isset($_GET['page'])) {
    $pagenum = $_GET['page'];
}
if (isset($_GET['token'])) {
$html = file_get_contents('http://178.20.43.121:3000/golos-api?service=uia-top&token='.mb_strtolower($_GET['token']).'&page='.$pagenum);
echo $html;
} else {
    echo '{}';
}
?>