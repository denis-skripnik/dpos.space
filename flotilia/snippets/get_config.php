<?php
@session_start();
require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';

use GrapheneNodeClient\Commands\Single;
use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetConfigCommand;
use GrapheneNodeClient\Connectors\WebSocket\GolosWSConnector;

$config_commandQuery = new CommandQueryData();

$config_data = [];

$config_commandQuery->setParams($config_data);

$config_command = new GetConfigCommand($connector);

?>