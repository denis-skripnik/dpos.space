<?php
@session_start();
require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';



use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetAccountHistoryCommand;
if ('serey' == 'WLS' or 'serey' == 'serey') {
$connector_class = '\GrapheneNodeClient\Connectors\Http\\'.'serey'_connector.'HttpJsonRpcConnector';
} else if ('serey' == 'serey' or 'serey' == 'serey') {
$connector_class = '\GrapheneNodeClient\Connectors\WebSocket\\'.'serey'_connector.'WSConnector';
}

$commandQuery = new CommandQueryData();

$from = (int) ($_REQUEST['start'] ?? 3000000000);
// если начинаем с транзакции с номером, меньшим чем 2000 нужно и лимит брать меньше чем 2000
$limit = $from < 10000 ? $from : 10000;

$command_data = [
'0' => $user, //authors
        '1' => $from, //from
        '2' => $limit //limit max 1000
];

$commandQuery->setParams($command_data);

$connector = new $connector_class();

$command = new GetAccountHistoryCommand($connector);
