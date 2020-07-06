<?php
$start = $_REQUEST['start'] ?? false;

require $_SERVER['DOCUMENT_ROOT'] . '/vendor/autoload.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/helpers.php';

use GrapheneNodeClient\Commands\CommandQueryData;
    use GrapheneNodeClient\Commands\Single\getDiscussionsByCommentsCommand;

$connector_class = CONNECTORS_MAP['golos'];

$commandQuery = new CommandQueryData();

$comment_data = [
    [
        'limit' => 100, //'limit',
        'start_author' => $user
        ]
];

if ($start !== false) {
    $data[0]['start_permlink'] = $start;
}

$commandQuery->setParams($comment_data);

$connector = new $connector_class();

$command = new getDiscussionsByCommentsCommand($connector);
