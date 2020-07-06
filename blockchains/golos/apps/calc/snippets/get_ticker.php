<?php
require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';
require_once $_SERVER['DOCUMENT_ROOT'].'/helpers.php';

use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\getTickerCommand;

$ticker_commandQuery = new CommandQueryData();
$ticker_data = [];
$ticker_commandQuery->setParams($ticker_data);

$connector_class = CONNECTORS_MAP['golos'];
$connector = new $connector_class();
$ticker_command = new getTickerCommand($connector);
