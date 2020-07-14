<?php
require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';

use GrapheneNodeClient\Commands\Single;
use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetAccountsCommand;
use GrapheneNodeClient\Connectors\WebSocket\GolosWSConnector;

$commandQuery = new CommandQueryData();

$commandQuery->setParams($data);

$connector = new GolosWSConnector();

$command = new GetAccountsCommand($connector);

?>