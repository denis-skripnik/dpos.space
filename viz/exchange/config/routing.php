<?php
function rout($array_url) {
    $ini = parse_ini_file('config/site.ini', true); 
if ($array_url[0] == 'exchange' && !isset($array_url[1]) && !isset($array_url[2])) {
$config = $ini['home'];
} else if ($array_url[0] == 'exchange' && $array_url[1] == 'add') {
    $config = $ini['add'];
} else if ($array_url[0] == 'exchange' && $array_url[1] == 'submit') {
    $config = $ini['submit'];
} else if ($array_url[0] == 'exchange' && $array_url[1] == 'payment-gates') {
    $config = $ini['payment-gates'];
} else if ($array_url[0] == 'exchange' && $array_url[1] == 'control') {
    $config = $ini['control'];
}
return $config;
}
?>