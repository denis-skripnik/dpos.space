<?php

namespace GrapheneNodeClient\Tools\ChainOperations;


class ChainOperations
{
    const OPERATION_VOTE        = 'vote';
    const OPERATION_COMMENT     = 'comment'; //STEEM/GOLOS/whaleshares
    const OPERATION_CONTENT     = 'content'; //only for VIZ
    const OPERATION_TRANSFER    = 'transfer';
    const OPERATION_CUSTOM_JSON = 'custom_json';

    const OPERATIONS_IDS = [
        self::OPERATION_VOTE        => 0,
        self::OPERATION_COMMENT     => 1,//STEEM/GOLOS/whaleshares
        self::OPERATION_CONTENT     => 1,//only for VIZ
        self::OPERATION_TRANSFER    => 2,
        self::OPERATION_CUSTOM_JSON => 18
    ];

    /**
     * @param string $operationName
     *
     * @return integer
     */
    public static function getOperationId($operationName)
    {
        return self::OPERATIONS_IDS[$operationName];
    }
}