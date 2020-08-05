<?php
require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/helpers.php';

use GrapheneNodeClient\Commands\Single;
use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetFollowCountCommand;
$connector_class = CONNECTORS_MAP['steem'];

$followcount_commandQuery = new CommandQueryData();

$followcount_data = [
'0' => $user, //author
];

$followcount_commandQuery->setParams($followcount_data);

$followcount_command = new GetFollowCountCommand($connector);

?>