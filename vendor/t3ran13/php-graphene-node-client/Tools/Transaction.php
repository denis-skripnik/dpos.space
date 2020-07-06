<?php


namespace GrapheneNodeClient\Tools;


use Elliptic\EC;
use Elliptic\EC\Signature;
use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\CommandQueryDataInterface;
use GrapheneNodeClient\Commands\Single\GetBlockCommand;
use GrapheneNodeClient\Commands\Single\GetDynamicGlobalPropertiesCommand;
use GrapheneNodeClient\Connectors\ConnectorInterface;
use GrapheneNodeClient\Tools\ChainOperations\OperationSerializer;
use t3ran13\ByteBuffer\ByteBuffer;

class Transaction
{
    const CHAIN_STEEM       = ConnectorInterface::PLATFORM_STEEMIT;
    const CHAIN_GOLOS       = ConnectorInterface::PLATFORM_GOLOS;
    const CHAIN_VIZ         = ConnectorInterface::PLATFORM_VIZ;
    const CHAIN_WHALESHARES = ConnectorInterface::PLATFORM_WHALESHARES;
    const CHAIN_ID          = [
        self::CHAIN_GOLOS       => '782a3039b478c839e4cb0c941ff4eaeb7df40bdd68bd441afd444b9da763de12',
        self::CHAIN_STEEM       => '0000000000000000000000000000000000000000000000000000000000000000',
        self::CHAIN_VIZ         => '2040effda178d4fffff5eab7a915d4019879f5205cc5392e4bcced2b6edda0cd',
        self::CHAIN_WHALESHARES => 'de999ada2ff7ed3d3d580381f229b40b5a0261aec48eb830e540080817b72866'
    ];

    public static function getChainId($chainName)
    {
        if (!isset(self::CHAIN_ID[$chainName])) {
            throw new TransactionSignException('Can\'t find chain_id');
        }

        return self::CHAIN_ID[$chainName];
    }

    /**
     * @param ConnectorInterface $connector
     * @param string             $expirationTime is string in DateInterval format, example 'PT2M'
     *
     * @return CommandQueryData
     * @throws \Exception
     */
    public static function init(ConnectorInterface $connector, $expirationTime = 'PT2M')
    {
        $tx = null;

        $command = new GetDynamicGlobalPropertiesCommand($connector);
        $commandQueryData = new CommandQueryData();
        $properties = $command->execute(
            $commandQueryData
        );

        $blockId = $properties['result']['head_block_number'] - 2;
        $command = new GetBlockCommand($connector);
        $commandQueryData = new CommandQueryData();
        $commandQueryData->setParamByKey('0', $blockId);
        $block = $command->execute(
            $commandQueryData
        );

        if (isset($properties['result']['head_block_number']) && isset($block['result']['previous'])) {
            $refBlockNum = ($properties['result']['head_block_number'] - 3) & 0xFFFF;

            $tx = new CommandQueryData();
            $buf = new ByteBuffer();
            $buf->write(hex2bin($block['result']['previous']));

            $tx->setParams(
                [[
                    'ref_block_num'    => $refBlockNum,
                    'ref_block_prefix' => $buf->readInt32lE(4),
                    'expiration'       => (new \DateTime($properties['result']['time']))->add(new \DateInterval($expirationTime))->format('Y-m-d\TH:i:s\.000'),
                    'operations'       => [],
                    'extensions'       => [],
                    'signatures'       => []
                ]]
            );
        }

        if (!($tx instanceof CommandQueryDataInterface)) {
            throw new \Exception('cant init Tx');
        }

        return $tx;
    }

    /**
     * @param string                    $chainName
     * @param CommandQueryDataInterface $trxData
     *
     * @return string
     */
    public static function getTxMsg($chainName, CommandQueryDataInterface $trxData)
    {

        //serialize transaction
        $trxParams = $trxData->getParams();
        $serBuffer = OperationSerializer::serializeTransaction($chainName, $trxParams, new ByteBuffer());
        $serializedTx = self::getChainId($chainName) . bin2hex($serBuffer->read(0, $serBuffer->length()));

        return $serializedTx;
    }


    /**
     * @param string                    $chainName
     * @param CommandQueryDataInterface $trxData
     * @param string[]                  $privateWIFs
     *
     * @return mixed
     * @throws \Exception
     */
    public static function sign($chainName, CommandQueryDataInterface $trxData, $privateWIFs)
    {
        //becouse spec256k1-php canonical sign trouble will use php hack.
        //If sign is not canonical, we have to chang msg (we will add 1 sec to tx expiration time) and try to sign again
        $nTries = 0;
        while (true) {
            $nTries++;
            $msg = self::getTxMsg($chainName, $trxData);

            try {
                foreach ($privateWIFs as $keyName => $privateWif) {
                    $index = count($trxData->getParams()[0]['signatures']);

                    /** @var CommandQueryData $trxData */
                    $trxData->setParamByKey('0:signatures:' . $index, self::signOperation($msg, $privateWif));
                }
                break;
            } catch (TransactionSignException $e) {
                if ($nTries > 200) {
                    //stop tries to find canonical sign
                    throw $e;
                    break;
                } else {
                    /** @var CommandQueryData $trxData */
                    $params = $trxData->getParams();
                    foreach ($params as $key => $tx) {
                        $tx['expiration'] = (new \DateTime($tx['expiration']))
                            ->add(new \DateInterval('PT0M1S'))
                            ->format('Y-m-d\TH:i:s\.000');
                        $params[$key] = $tx;
                    }
                    $trxData->setParams($params);
                }
            }
        }

        return $trxData;
    }


//    /**
//     * @param string $msg serialized Tx with prefix chain id
//     * @param string $privateWif
//     *
//     * @return string hex
//     * @throws \Exception
//     */
//    protected static function signOperation($msg, $privateWif)
//    {
//        $context = secp256k1_context_create(SECP256K1_CONTEXT_SIGN | SECP256K1_CONTEXT_VERIFY);
//
//        $msg32 = hash('sha256', hex2bin($msg), true);
//        $privateKey = Auth::PrivateKeyFromWif($privateWif);
//
//        /** @var resource $signature */
//        $signatureRec = null;
//        $i = 0;
//        while (true) {
//            if ($i === 1) {
//                //sing always the same
//                throw new TransactionSignException("Can't to find canonical signature, {$i} ties");
//            }
//            $i++;
////            echo "\n i=" . print_r($i, true) . '<pre>'; //FIXME delete it
//            if (secp256k1_ecdsa_sign_recoverable($context, $signatureRec, $msg32, $privateKey) !== 1) {
//                throw new TransactionSignException("Failed to create recoverable signature");
//            }
//
//            $signature = null;
//            if (secp256k1_ecdsa_recoverable_signature_convert($context, $signature, $signatureRec) !== 1) {
//                throw new TransactionSignException("Failed to create signature");
//            }
//            $der = null;
//            if (secp256k1_ecdsa_signature_serialize_der($context, $der, $signature) !== 1) {
//                throw new TransactionSignException("Failed to create DER");
//            }
////            echo "\n" . print_r(bin2hex($der), true) . '<pre>'; //FIXME delete it
//
//            echo PHP_EOL . 'der 1: ' . print_r(bin2hex($der), true) . ''; //FIXME delete it
//            if (self::isSignatureCanonical($der)) {
//                break;
//            }
//        }
//
//        $serializedSig = null;
//        $recid = 0;
//        secp256k1_ecdsa_recoverable_signature_serialize_compact($context, $serializedSig, $recid, $signatureRec);
//        echo PHP_EOL . 'serializedSig 1: ' . print_r(bin2hex($serializedSig), true) . ''; //FIXME delete it
//        $serializedSig = hex2bin(base_convert($recid + 4 + 27, 10, 16)) . $serializedSig;
//        $length = strlen($serializedSig);
//        if ($length !== 65) {
//            throw new \Exception('Expecting 65 bytes for Tx signature, instead got ' . $length);
//        }
//
//        return bin2hex($serializedSig);
//    }


    /**
     * @param string $msg serialized Tx with prefix chain id
     * @param string $privateWif
     *
     * @return string hex
     * @throws \Exception
     */
    protected static function signOperation($msg, $privateWif)
    {
        $ec = new EC('secp256k1');

        $msg32Hex = hash('sha256', hex2bin($msg), false);
        $privateKeyHex = bin2hex(Auth::PrivateKeyFromWif($privateWif));
        $key = $ec->keyFromPrivate($privateKeyHex, 'hex');

        $i = 0;
        while (true) {
            if ($i === 1) {
                //sing always the same
                throw new TransactionSignException("Can't to find canonical signature, {$i} ties");
            }
            $i++;

            $signature = $key->sign($msg32Hex, 'hex', ['canonical' => true]);
            /** @var Signature $signature*/


            $der = $signature->toDER('hex');
            if (self::isSignatureCanonical(hex2bin($der))) {
                break;
            }
        }

        $recid = $ec->getKeyRecoveryParam($msg32Hex, $signature, $key->getPublic());

        $compactSign = $signature->r->toString(16) . $signature->s->toString(16);
        $serializedSig = base_convert($recid + 4 + 27, 10, 16) . $compactSign;

        $length = strlen($serializedSig);
        if ($length !== 130) { //65 symbols
            throw new \Exception('Expecting 65 bytes for Tx signature, instead got ' . $length);
        }

        return $serializedSig;
    }


    /**
     * @param string $der string of binary
     *
     * @return bool
     */
    public static function isSignatureCanonical($der)
    {
        $buffer = new ByteBuffer();
        $buffer->write($der);
        $lenR = $buffer->readInt8(3);
        $lenS = $buffer->readInt8(5 + $lenR);

        return $lenR === 32 && $lenS === 32;
    }




//    /**
//     * @param string $serializedSig binary string serialized signature
//     * @param string $skip skip the first byte with sing technical data (4 - compressed | 27 - compact)
//     *
//     * @return bool
//     */
//    public static function isSignatureCanonical($serializedSig, $skip)
//    {
//        //             test after secp256k1_ecdsa_recoverable_signature_serialize_compact
//        //        public static bool IsCanonical(byte[] sig, int skip)
//        //        {
//        //        return !((sig[skip + 0] & 0x80) > 0)
//        //        && !(sig[skip + 0] == 0 && !((sig[skip + 1] & 0x80) > 0))
//        //        && !((sig[skip + 32] & 0x80) > 0)
//        //        && !(sig[skip + 32] == 0 && !((sig[skip + 33] & 0x80) > 0));
//        //        }
//
//        $buffer = new ByteBuffer();
//        $buffer->write($serializedSig);
//
//        return !(($buffer->readInt8($skip + 0, 1) & 0x80) > 0)
//            && !($buffer->readInt8($skip + 0, 1) === 0 && !(($buffer->readInt8($skip + 1, 1) & 0x80) > 0))
//            && !(($buffer->readInt8($skip + 32, 1) & 0x80) > 0)
//            && !($buffer->readInt8($skip + 32, 1) === 0 && !(($buffer->readInt8($skip + 33, 1) & 0x80) > 0));
//    }
}