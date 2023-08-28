<?php

require_once $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/helpers.php';

use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetAccountHistoryCommand;

function getAccountHistoryChunk($author, $startWith = -1)
{

        static $limit = 100;
    
    $startWith = (int) $startWith;

    $query = [
        '0' => $author,
        '1' => $startWith,
        '2' => $limit,
    ];

    $commandQuery = new CommandQueryData();
    $commandQuery->setParams($query);

    $connectorClass = CONNECTORS_MAP['hive'];

    $connector = new $connectorClass();

    $command = new GetAccountHistoryCommand($connector);

    $result = $command->execute($commandQuery);

    return $result;
}
