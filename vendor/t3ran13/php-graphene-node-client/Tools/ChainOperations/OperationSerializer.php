<?php

namespace GrapheneNodeClient\Tools\ChainOperations;

use t3ran13\ByteBuffer\ByteBuffer;

class OperationSerializer
{
    const TYPE_SET_EXTENSIONS   = 'set_extensions';
    const TYPE_SET_BENEFICIARIES= 'set_beneficiaries';
    const TYPE_BENEFICIARY      = 'set_beneficiary';
    const TYPE_SET_STRING       = 'set_string';
    const TYPE_STRING           = 'string';
    const TYPE_INT16            = 'int16';
    const TYPE_ASSET            = 'asset';

    const OPERATIONS_FIELDS_TYPES = [
        ChainOperations::OPERATION_VOTE        => [
            'voter'    => self::TYPE_STRING,
            'author'   => self::TYPE_STRING,
            'permlink' => self::TYPE_STRING,
            'weight'   => self::TYPE_INT16
        ],
        ChainOperations::OPERATION_COMMENT     => [//STEEM/GOLOS
            'parent_author'    => self::TYPE_STRING,
            'parent_permlink'  => self::TYPE_STRING,
            'author'           => self::TYPE_STRING,
            'permlink'         => self::TYPE_STRING,
            'title'            => self::TYPE_STRING,
            'body'             => self::TYPE_STRING,
            'json_metadata'    => self::TYPE_STRING
        ],
        ChainOperations::OPERATION_CONTENT     => [//only for VIZ
            'parent_author'    => self::TYPE_STRING,
            'parent_permlink'  => self::TYPE_STRING,
            'author'           => self::TYPE_STRING,
            'permlink'         => self::TYPE_STRING,
            'title'            => self::TYPE_STRING,
            'body'             => self::TYPE_STRING,
            'curation_percent' => self::TYPE_INT16,
            'json_metadata'    => self::TYPE_STRING,
            'extensions'       => self::TYPE_SET_EXTENSIONS
        ],
        ChainOperations::OPERATION_TRANSFER    => [
            'from'   => self::TYPE_STRING,
            'to'     => self::TYPE_STRING,
            'amount' => self::TYPE_ASSET,
            'memo'   => self::TYPE_STRING
        ],
        ChainOperations::OPERATION_CUSTOM_JSON => [
            'required_auths'         => self::TYPE_SET_STRING,
            'required_posting_auths' => self::TYPE_SET_STRING,
            'id'                     => self::TYPE_STRING,
            'json'                   => self::TYPE_STRING
        ]
    ];

    /**
     * @param array       $trxParams
     * @param null|Buffer $byteBuffer
     *
     * @return null|string|Buffer
     */
    public static function serializeTransaction($trxParams, $byteBuffer = null)
    {
        $buffer = $byteBuffer === null ? (new ByteBuffer()) : $byteBuffer;

        $buffer->writeInt16LE($trxParams[0]['ref_block_num'], 0);
        $buffer->writeInt32LE($trxParams[0]['ref_block_prefix'], 2);
        $expirationSec = is_int($trxParams[0]['expiration']) ? $trxParams[0]['expiration'] : strtotime($trxParams[0]['expiration']);
        $buffer->writeInt32LE($expirationSec, 6);
        $buffer->writeInt8(count($trxParams[0]['operations']));


        //serialize only operations data
        foreach ($trxParams[0]['operations'] as $operation) {
            $opData = $operation[1];
            self::serializeOperation($operation[0], $opData, $buffer);
        }


        $buffer->writeInt8(count($trxParams[0]['extensions']));
        foreach ($trxParams[0]['extensions'] as $extansion) {
            //will be needed for benefeciars
        }

        return $byteBuffer === null ? $buffer->getBuffer('H', 0, $buffer->getCurrentOffset()) : $byteBuffer;
    }


    /**
     * @param string     $operationName
     * @param array      $data
     * @param ByteBuffer $byteBuffer
     *
     * @return ByteBuffer
     */
    public static function serializeOperation($operationName, $data, $byteBuffer)
    {
        //operation id
        $opId = ChainOperations::getOperationId($operationName);
        $byteBuffer->writeInt8($opId);

        foreach (self::OPERATIONS_FIELDS_TYPES[$operationName] as $field => $type) {
            self::serializeType($type, $data[$field], $byteBuffer);
        }

        return $byteBuffer;
    }


    /**
     * @param string     $type
     * @param mixed      $value
     * @param ByteBuffer $byteBuffer
     *
     * @return mixed
     */
    public static function serializeType($type, $value, $byteBuffer)
    {
        if ($type === self::TYPE_STRING) {
            //Writes a UTF8 encoded string prefixed 32bit base 128 variable-length integer.
            $strLength = strlen($value);

            if ($strLength <= 128) {
                $byteBuffer->writeInt8($strLength);
            }
            elseif ($strLength <= 16511) {
                $strLength = ceil($strLength / 128) * 256
                    + ($strLength - ceil($strLength / 128) * 128);
                $byteBuffer->writeInt16LE($strLength);
            } else {
                $n3 = ceil($strLength / (128 * 128));
                $n2 = ceil(($strLength - $n3*128*128) / 128);
                $strLength = $n3 * 256 * 256
                    + $n2 * 256
                    + ($strLength - $n3 * 128 * 128 - $n2 * 128);
                $byteBuffer->writeInt32LE($strLength);
                if ($strLength <= 16777215) {
                    $byteBuffer->setCurrentOffset($byteBuffer->getCurrentOffset() - 1);
                }
            }
            $byteBuffer->writeVStringLE($value);
        } elseif ($type === self::TYPE_SET_STRING) {
            $byteBuffer->writeInt8(count($value));
            foreach ($value as $string) {
                self::serializeType(self::TYPE_STRING, $string, $byteBuffer);
            }
        } elseif ($type === self::TYPE_INT16) {
            $byteBuffer->writeInt16LE($value);
        } elseif ($type === self::TYPE_ASSET) {
            list($amount, $symbol) = explode(' ', $value);

            //TODO FIXME have to be writeInt64
            $byteBuffer->writeInt32LE(str_replace('.', '', $amount));
            $byteBuffer->writeInt32LE(0);

            $dot = strpos($amount, '.');
            $precision = $dot === false ? 0 : strlen($amount) - $dot - 1;
            $byteBuffer->writeInt8($precision);

            $byteBuffer->writeVStringLE(strtoupper($symbol));
            for ($i = 0; $i < 7 - strlen($symbol); $i++) {
                $byteBuffer->writeInt8(0);
            }
        } elseif ($type === self::TYPE_SET_EXTENSIONS) {
            $byteBuffer->writeInt8(count($value));
            foreach ($value as $extension) {
                $byteBuffer->writeInt8($extension[0]);
                if ($extension[0] === 0) {
                    self::serializeType(self::TYPE_SET_BENEFICIARIES, $extension[1], $byteBuffer);
                }
            }
        } elseif ($type === self::TYPE_SET_BENEFICIARIES) {
            $byteBuffer->writeInt8(count($value));
            foreach ($value['beneficiaries'] as $beneficiary) {
                self::serializeType(self::TYPE_BENEFICIARY, $beneficiary, $byteBuffer);
            }
        } elseif ($type === self::TYPE_BENEFICIARY) {
            self::serializeType(self::TYPE_STRING, $value['account'], $byteBuffer);
            self::serializeType(self::TYPE_INT16, $value['weight'], $byteBuffer);
        }

        return $byteBuffer;
    }


}