<?php
@session_start();
require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';



use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetAccountHistoryCommand;
if ('steem' == 'WLS' or 'steem' == 'steem') {
$connector_class = '\GrapheneNodeClient\Connectors\Http\\'.'steem'_connector.'HttpJsonRpcConnector';
} else if ('steem' == 'steem' or 'steem' == 'steem') {
$connector_class = '\GrapheneNodeClient\Connectors\WebSocket\\'.'steem'_connector.'WSConnector';
}

$commandQuery = new CommandQueryData();

$from = (int) ($_REQUEST['start'] ?? 3000000000);
// если начинаем с транзакции с номером, меньшим чем 2000 нужно и лимит брать меньше чем 2000
$limit = $from < 20 ? $from : 20;

$command_data = [
'0' => $user, //authors
        '1' => $from, //from
        '2' => $limit //limit max 2000
];

$commandQuery->setParams($command_data);

$connector = new $connector_class();

$command = new GetAccountHistoryCommand($connector);
