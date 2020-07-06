<?php
require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/helpers.php';

use GrapheneNodeClient\Commands\Single;
use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\getRewardFundCommand;
$connector_class = CONNECTORS_MAP['steem'];

$RewardFund_commandQuery = new CommandQueryData();

$RewardFund_data = [
'0' => 'post', //string
];

$RewardFund_commandQuery->setParams($RewardFund_data);

$RewardFund_command = new getRewardFundCommand($connector);

?>