<?php
require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/helpers.php';


use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetAccountsCommand;

$connector_class = CONNECTORS_MAP['steem'];

$commandQuery = new CommandQueryData();

$command_data = [
'0' => [$user], //authors
];

$commandQuery->setParams($command_data);

$connector = new $connector_class();

$command = new GetAccountsCommand($connector);
