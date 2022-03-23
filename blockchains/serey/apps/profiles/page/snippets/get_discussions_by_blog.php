<?php
require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/helpers.php';

use GrapheneNodeClient\Commands\Single;
use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetDiscussionsByBlogCommand;
$connector_class = CONNECTORS_MAP['serey'];

$commandQuery = new CommandQueryData();

$posts_data = [
    [
		'limit' => 28,
'tag' => $user
    ]
];


$commandQuery->setParams($posts_data);

$connector = new $connector_class();

$command = new GetDiscussionsByBlogCommand($connector);

?>