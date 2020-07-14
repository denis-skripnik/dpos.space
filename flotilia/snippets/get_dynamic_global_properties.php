<?php
require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';


use GrapheneNodeClient\Commands\Single;
use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetDynamicGlobalPropertiesCommand;
use GrapheneNodeClient\Connectors\WebSocket\GolosWSConnector;

$commandQuery3 = new CommandQueryData();

$data3 = [];

$commandQuery3->setParams($data3);

$connector = new GolosWSConnector();

$command3 = new GetDynamicGlobalPropertiesCommand($connector);

