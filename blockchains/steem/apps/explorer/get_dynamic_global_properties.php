<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/helpers.php';

use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetDynamicGlobalPropertiesCommand;

$connector_class = CONNECTORS_MAP['steem'];

$commandQuery3 = new CommandQueryData();

$data3 = [];

$commandQuery3->setParams($data3);

$connector = new $connector_class();

$command3 = new GetDynamicGlobalPropertiesCommand($connector);

