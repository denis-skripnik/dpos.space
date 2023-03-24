<?php
header("Access-Control-Allow-Origin: telegra.ph");

$url = $_GET['url'];
$response = file_get_contents($url);
echo $response;
?>