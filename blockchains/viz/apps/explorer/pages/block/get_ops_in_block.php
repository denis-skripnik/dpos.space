<?php
require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/helpers.php';

use GrapheneNodeClient\Commands\Single;
use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetOpsInBlock;

$connector_class = CONNECTORS_MAP['viz'];

$commandQuery = new CommandQueryData();

$command_data = [
'0' => (int)$datas, //block_num
'1' => false, //block_num
];

$commandQuery->setParams($command_data);

$connector = new $connector_class();
$command = new GetOpsInBlock($connector);

?>