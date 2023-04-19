<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/helpers.php';

use GrapheneNodeClient\Commands\Single;
use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\getBlockHeader;

$connector_class = CONNECTORS_MAP['golos'];

$commandQuery = new CommandQueryData();

$command_data = [
'0' => (int)$datas //block_num
];

$commandQuery->setParams($command_data);

$connector = new $connector_class();
$command = new GetOpsInBlock($connector);

?>