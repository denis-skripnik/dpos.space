<?php

use GrapheneNodeClient\Connectors\Http\WhalesharesHttpJsonRpcConnector as WLS;
use GrapheneNodeClient\Connectors\WebSocket\{
    GolosWSConnector as Golos,
    VizWSConnector as Viz
};

define('CONNECTORS_MAP', [
    'WLS' => WLS::class,
    'golos' => Golos::class,
    'viz' => Viz::class,
    'steem' => Steemit::class,
]);

define('MONTHS', [
    '01' => 'января',
    '02' => 'февраля',
    '03' => 'марта',
    '04' => 'апреля',
    '05' => 'мая',
    '06' => 'июня',
    '07' => 'июля',
    '08' => 'августа',
    '09' => 'сентября',
    '10' => 'октября',
    '11' => 'ноября',
    '12' => 'декабря',
]);

function getWord($number, $suffix)
{
    $keys = array(2, 0, 1, 1, 1, 2);
    $mod = $number % 100;
    $suffix_key = ($mod > 7 && $mod < 20) ? 2 : $keys[min($mod % 10, 5)];
    return $suffix[$suffix_key];
}


function noCache()
{
    header('Expires: Thu, 19 Feb 1998 13:24:18 GMT');
    header('Last-Modified: '.gmdate("D, d M Y H:i:s")." GMT");
    header('Cache-Control: no-cache, must-revalidate');
    header('Cache-Control: post-check=0,pre-check=0');
    header('Cache-Control: max-age=0');
    header('Pragma: no-cache');
}