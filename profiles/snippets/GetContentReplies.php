<?php
$start = $_REQUEST['start'] ?? false;

@session_start();
require $_SERVER['DOCUMENT_ROOT'] . '/vendor/autoload.php';
require $_SERVER['DOCUMENT_ROOT'] . '/params.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/helpers.php';

use GrapheneNodeClient\Commands\CommandQueryData;
    use GrapheneNodeClient\Commands\Single\getDiscussionsByCommentsCommand;

    $chain = $chain;
$connector_class = CONNECTORS_MAP[$chain];

$commandQuery = new CommandQueryData();

$data = [
    [
        'limit' => 100, //'limit',
        'start_author' => $array_url[1]
        ]
];

if ($start !== false) {
    $data[0]['start_permlink'] = $start;
}

$commandQuery->setParams($data);

$connector = new $connector_class();

$command = new getDiscussionsByCommentsCommand($connector);
