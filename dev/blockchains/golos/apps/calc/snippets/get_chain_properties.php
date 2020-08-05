<?php
require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/helpers.php';

use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetChainPropertiesCommand;
$connector_class = CONNECTORS_MAP['golos'];

$chain_commandQuery = new CommandQueryData();

$chain_data = [];

$chain_commandQuery->setParams($chain_data);

$connector = new $connector_class();

$chain_command = new GetChainPropertiesCommand($connector);

