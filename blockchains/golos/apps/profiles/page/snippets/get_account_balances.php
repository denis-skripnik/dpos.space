<?php
require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/helpers.php';

use GrapheneNodeClient\Commands\Single;
use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetAccountsBalancesCommand;

function balances($user) {
    $connector_class = CONNECTORS_MAP['golos'];

    $commandQuery = new CommandQueryData();
    
    $command_data = [
    '0' => [$user], //authors
    ];
    
    $commandQuery->setParams($command_data);
    
    $connector = new $connector_class();
    $command = new GetAccountsBalancesCommand($connector);
    $res = $command->execute($commandQuery); 
    $mass = $res['result'][0];
    if (isset($mass)) {
        return $mass;
    } else {
        return false;
    }
}
?>