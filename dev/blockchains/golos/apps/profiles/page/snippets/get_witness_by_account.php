<?php
require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/helpers.php';

use GrapheneNodeClient\Commands\Single;
use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetWitnessByAccountCommand;


$connector_class = CONNECTORS_MAP['golos'];

$commandQuery = new CommandQueryData();

$command_data = [
'0' => $user, //authors
];

$commandQuery->setParams($command_data);

$connector = new $connector_class();
$command = new GetWitnessByAccountCommand($connector);

?>