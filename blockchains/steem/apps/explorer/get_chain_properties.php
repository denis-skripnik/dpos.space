<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/helpers.php';

use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetChainPropertiesCommand;

$chain_connector_class = CONNECTORS_MAP['steem'];

$chain_commandQuery = new CommandQueryData();

$chain_data = [];

$chain_commandQuery->setParams($chain_data);

$chain_connector = new $chain_connector_class();

$chain_command = new GetChainPropertiesCommand($chain_connector);

