<?php
@session_start();
require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';
require $_SERVER['DOCUMENT_ROOT'].'/params.php';


use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetAccountHistoryCommand;
if ($chain == 'WLS' or $chain == 'steem') {
$connector_class = '\GrapheneNodeClient\Connectors\Http\\'.$chain_connector.'HttpJsonRpcConnector';
} else if ($chain == 'golos' or $chain == 'viz') {
$connector_class = '\GrapheneNodeClient\Connectors\WebSocket\\'.$chain_connector.'WSConnector';
}

$commandQuery = new CommandQueryData();

$from = (int) ($_REQUEST['start'] ?? 3000000000);
// если начинаем с транзакции с номером, меньшим чем 2000 нужно и лимит брать меньше чем 2000
$limit = $from < 10000 ? $from : 10000;

$data = [
'0' => $array_url[1], //authors
        '1' => $from, //from
        '2' => $limit //limit max 2000
];

$commandQuery->setParams($data);

$connector = new $connector_class();

$command = new GetAccountHistoryCommand($connector);
