<?php
@session_start();
require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';

require_once $_SERVER['DOCUMENT_ROOT'] . '/helpers.php';

use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetChainPropertiesCommand;

$connector_class = CONNECTORS_MAP['viz'];

'viz'_commandQuery = new CommandQueryData();

'viz'_data = [];

'viz'_commandQuery->setParams('viz'_data);

$connector = new $connector_class();

'viz'_command = new GetChainPropertiesCommand($connector);

