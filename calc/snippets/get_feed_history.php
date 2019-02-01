<?php
@session_start();
require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';
require $_SERVER['DOCUMENT_ROOT'].'/params.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/helpers.php';

use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetFeedHistoryCommand;

$chain = $chain;
$connector_class = CONNECTORS_MAP[$chain];

$feed_commandQuery = new CommandQueryData();

$feed_data = [];

$feed_commandQuery->setParams($feed_data);

$feed_command = new GetFeedHistoryCommand($connector);
