<?php
@session_start();
require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';
require $_SERVER['DOCUMENT_ROOT'].'/params.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/helpers.php';

use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetDynamicGlobalPropertiesCommand;
$chain = $chain;
$connector_class = CONNECTORS_MAP[$chain];

$commandQuery3 = new CommandQueryData();

$data3 = [];

$commandQuery3->setParams($data3);

$connector = new $connector_class();

$command3 = new GetDynamicGlobalPropertiesCommand($connector);

