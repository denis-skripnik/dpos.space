<?php
require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/helpers.php';

use GrapheneNodeClient\Commands\Single;
use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetVestingDelegationsCommand;

function vestingDelegations($user, $from, $type) {
    $connector_class = CONNECTORS_MAP['steem'];

$commandQuery = new CommandQueryData();

$delegations_data = [
'0' => $user, //account
'1' => $from, //from
'2' => 100, //limit
'3' => $type, //type
];

$commandQuery->setParams($delegations_data);

$connector = new $connector_class();
$command = new GetVestingDelegationsCommand($connector);
$res = $command->execute($commandQuery); 
$result = $res['result'];
return $result;
}
?>