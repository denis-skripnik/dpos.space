<?php
if (!defined('NOTLOAD')) exit('No direct script access allowed');

require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/helpers.php';

use GrapheneNodeClient\Commands\Single;
use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetOpsInBlock;
use GrapheneNodeClient\Commands\Single\GetBlockHeaderCommand;

$connector_class = CONNECTORS_MAP['golos'];

$commandQuery = new CommandQueryData();

// первый запрос
$command_data1 = [
    '0' => (int)$datas, //block_num
    '1' => false, //block_num
];

$commandQuery->setParams($command_data1);

$connector = new $connector_class();
$command1 = new GetOpsInBlock($connector);
$res = $command1->execute($commandQuery); 

// второй запрос
$command_data2 = [
    '0' => (int)$datas //block_num
];

$commandQuery->setParams($command_data2);

$command2 = new GetBlockHeaderCommand($connector);
$res2 = $command2->execute($commandQuery); 
?>
