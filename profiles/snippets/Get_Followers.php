<?php
// количество подписчиков за раз
define('FOLLOWERS_LIMIT', 50);
// подписчик, начиная с которого ищем. Если нет - пустая строка.
$startFollower = $_REQUEST['start'] ?? '';
// сколько подписчиков ищем. Берём на одного больше, чтобы знать, есть ли ещё
$followersLimit = FOLLOWERS_LIMIT + 1;

@session_start();
require $_SERVER['DOCUMENT_ROOT'] . '/vendor/autoload.php';
require $_SERVER['DOCUMENT_ROOT'] . '/params.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/helpers.php';

use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetFollowersCommand;
$chain = $chain;
$connector_class = CONNECTORS_MAP[$chain];

$commandQuery4 = new CommandQueryData();

$data4 = [
    '0' => $array_url[1], //authors
    '1' => $startFollower,
    '2' => 'blog',
    '3' => $followersLimit,
];

$commandQuery4->setParams($data4);

$connector4 = new $connector_class();

$command4 = new GetFollowersCommand($connector4);
