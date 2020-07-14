<?php
@session_start();
require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';
require $_SERVER['DOCUMENT_ROOT'].'/params.php';

use GrapheneNodeClient\Commands\Single;
use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetAccountsCommand;
if ($chain == 'vox' or $chain == 'steem') {
$connector_class = '\GrapheneNodeClient\Connectors\Http\\'.$chain_connector.'HttpJsonRpcConnector';
} else if ($chain == 'golos' or $chain == 'steem') {
$connector_class = '\GrapheneNodeClient\Connectors\WebSocket\\'.$chain_connector.'WSConnector';
}

$commandQuery = new CommandQueryData();

$data = [
'0' => [$array_url[1]], //authors
];

$commandQuery->setParams($data);

$connector = new $connector_class();

$command = new GetAccountsCommand($connector);

?>