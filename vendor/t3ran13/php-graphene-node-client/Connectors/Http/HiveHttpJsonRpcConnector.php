<?php

namespace GrapheneNodeClient\Connectors\Http;


class HiveHttpJsonRpcConnector extends HttpJsonRpcConnectorAbstract
{
    /**
     * @var string
     */
    protected $platform = self::PLATFORM_HIVE;

    /**
     * https or http server
     *
     * if you set several nodes urls, if with first node will be trouble
     * it will connect after $maxNumberOfTriesToCallApi tries to next node
     *
     * @var string
     */
    protected static $nodeURL = [
        'https://rpc.ecency.com',
        'https://hive.roelandp.nl',
        'https://api.openhive.network'
//        'https://steemd.pevo.science' //too often 503
//        'https://steemd.minnowsupportproject.org' //not full answers, some fields are empty
    ];
}