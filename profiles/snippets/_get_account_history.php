<?php
@session_start();
require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';
require $_SERVER['DOCUMENT_ROOT'].'/params.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/helpers.php';

use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetAccountHistoryCommand;

$chain = $chain;
$connector_class = CONNECTORS_MAP[$chain];

$commandQuery = new CommandQueryData();

$from = (int) ($_REQUEST['start'] ?? -1);
// если начинаем с транзакции с номером, меньшим чем 2000 нужно и лимит брать меньше чем 2000
if ($chain == 'golos' or $chain == 'viz') {
        $limit = $from < 10000 ? $from : 10000;
} else {
        $limit = $from < 2000 ? $from : 2000;
}

$data = [
'0' => $array_url[1], //authors
        '1' => $from, //from
        '2' => $limit //limit max 2000
];

$commandQuery->setParams($data);

$connector = new $connector_class();

$command = new GetAccountHistoryCommand($connector);
