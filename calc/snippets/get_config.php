<?php
@session_start();
require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';
require $_SERVER['DOCUMENT_ROOT'].'/params.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/helpers.php';

use GrapheneNodeClient\Commands\Single;
use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetConfigCommand;

$chain = $chain;
$connector_class = CONNECTORS_MAP[$chain];

$config_commandQuery = new CommandQueryData();

$config_data = [];

$config_commandQuery->setParams($config_data);

$config_command = new GetConfigCommand($connector);

?>