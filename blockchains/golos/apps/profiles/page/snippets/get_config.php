<?php
require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';

require_once $_SERVER['DOCUMENT_ROOT'] . '/helpers.php';

use GrapheneNodeClient\Commands\Single;
use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetConfigCommand;


$connector_class = CONNECTORS_MAP['golos'];

$config_commandQuery = new CommandQueryData();

$config_data = [];

$config_commandQuery->setParams($config_data);

$config_command = new GetConfigCommand($connector);

?>