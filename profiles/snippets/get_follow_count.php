<?php
@session_start();
require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';
require $_SERVER['DOCUMENT_ROOT'].'/params.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/helpers.php';

use GrapheneNodeClient\Commands\Single;
use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetFollowCountCommand;
$chain = $chain;
$connector_class = CONNECTORS_MAP[$chain];

$followcount_commandQuery = new CommandQueryData();

$followcount_data = [
'0' => $array_url[1], //author
];

$followcount_commandQuery->setParams($followcount_data);

$followcount_command = new GetFollowCountCommand($connector);

?>