<?php
require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/helpers.php';

use GrapheneNodeClient\Commands\Single;
use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetDiscussionsByBlogCommand;
$connector_class = CONNECTORS_MAP['golos'];

$commandQuery = new CommandQueryData();

$posts_data = [
    [
		'limit' => 28,
'select_authors' => [$user]
    ]
];


$commandQuery->setParams($posts_data);

$connector = new $connector_class();

$command = new GetDiscussionsByBlogCommand($connector);

?>