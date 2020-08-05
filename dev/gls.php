<?php
@session_start();
require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';
require_once __DIR__ . '/helpers.php';

use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetDynamicGlobalPropertiesCommand;
$connector_class = CONNECTORS_MAP['golos'];

$commandQuery3 = new CommandQueryData();

$data3 = [];

$commandQuery3->setParams($data3);

$connector = new $connector_class();

$command3 = new GetDynamicGlobalPropertiesCommand($connector);

$res3 = $command3->execute($commandQuery3); 
$dynamic_props = $res3['result'];

if ($_GET['token'] == 'GOLOS') {
echo (float)$dynamic_props['current_supply'];
} else if ($_GET['token'] == 'GBG') {
echo (float)$dynamic_props['current_sbd_supply'];
}