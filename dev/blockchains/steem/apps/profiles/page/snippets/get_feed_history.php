<?php
require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';
require_once $_SERVER['DOCUMENT_ROOT'].'/helpers.php';

use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetFeedHistoryCommand;

$feed_commandQuery = new CommandQueryData();
$feed_data = [];
$feed_commandQuery->setParams($feed_data);

$connector_class = CONNECTORS_MAP['steem'];
$connector = new $connector_class();
$feed_command = new GetFeedHistoryCommand($connector);
