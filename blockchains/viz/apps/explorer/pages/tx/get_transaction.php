<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/helpers.php';

use GrapheneNodeClient\Commands\Single;
use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetTransaction;

$connector_class = CONNECTORS_MAP['viz'];

$commandQuery = new CommandQueryData();

$command_data = [
'0' => $datas //tx_id
];

$commandQuery->setParams($command_data);

$connector = new $connector_class();
$command = new GetTransaction($connector);

?>