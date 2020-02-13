<?php
require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';
require $_SERVER['DOCUMENT_ROOT'].'/params.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/helpers.php';

use GrapheneNodeClient\Commands\Single;
use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetAccountsCommand;

$chain = $chain;
$connector_class = CONNECTORS_MAP[$chain];

$commandQuery = new CommandQueryData();

$data = [
'0' => [$array_url[1]], //authors
];

$commandQuery->setParams($data);

$connector = new $connector_class();
$command = new GetAccountsCommand($connector);

?>