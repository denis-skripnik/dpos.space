<?php
$chain = $_REQUEST['chain'];
$sp = (float)$_REQUEST['sp-tec'];
$array_url = $_REQUEST['array_url'];
require $_SERVER['DOCUMENT_ROOT'].'/params.php';
$sp_result = round(($sp / 10000) * 7, 3);
echo "<p>Результат конвертации: $sp_result $amount2</p>";
?>