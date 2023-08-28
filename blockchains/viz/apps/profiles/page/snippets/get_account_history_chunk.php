<?php

require_once $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/helpers.php';

use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetAccountHistoryCommand;

function getAccountHistoryChunk($author, $startWith = -1)
{

        static $limit = 1000;
    
    $startWith = (int) $startWith;

try {
    $query = [
        '0' => $author,
        '1' => $startWith,
        '2' => $limit,
    ];

    $commandQuery = new CommandQueryData();
    $commandQuery->setParams($query);

    $connectorClass = CONNECTORS_MAP['viz'];

    $connector = new $connectorClass();

    $command = new GetAccountHistoryCommand($connector);

    $result = $command->execute($commandQuery);

    return $result;
} catch (Exception $e) {
    return ['result' => []];
}
}
