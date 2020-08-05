<?php
// количество подписчиков за раз
define('FOLLOWERS_LIMIT', 10);
// подписчик, начиная с которого ищем. Если нет - пустая строка.
$startFollower = $_REQUEST['start'] ?? '';
// сколько подписчиков ищем. Берём на одного больше, чтобы знать, есть ли ещё
$followersLimit = FOLLOWERS_LIMIT + 1;

require $_SERVER['DOCUMENT_ROOT'] . '/vendor/autoload.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/helpers.php';

use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetFollowingCommand;
$connector_class = CONNECTORS_MAP['golos'];

$commandQuery4 = new CommandQueryData();
$data4 = [
    '0' => $user, //authors
    '1' => $startFollower,
    '2' => 'blog',
    '3' => $followersLimit,
];

$commandQuery4->setParams($data4);

$connector4 = new $connector_class();

$command4 = new GetFollowingCommand($connector4);
