<?php
@session_start();
require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';
require $_SERVER['DOCUMENT_ROOT'].'/params.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/helpers.php';

use GrapheneNodeClient\Commands\Single;
use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetDiscussionsByBlogCommand;
$chain = $chain;
$connector_class = CONNECTORS_MAP[$chain];

$commandQuery = new CommandQueryData();

if ($chain == 'golos' or $chain == 'viz') {
$data = [
    [
		'limit' => 28,
'select_authors' => [$array_url[1]]
    ]
];
} else if ($chain == 'WLS' or $chain == 'steem') {
$data = [
    [
                'tag' => $array_url[1], //'author',
                'limit'          => 70, //'limit'
    ]
];
}

$commandQuery->setParams($data);

$connector = new $connector_class();

$command = new GetDiscussionsByBlogCommand($connector);

?>