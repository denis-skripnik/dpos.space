<?php
declare(strict_types=1);

use Minter\SDK\MinterCoins\MinterBuyCoinTx;
use Minter\SDK\MinterTx;
use PHPUnit\Framework\TestCase;

/**
 * Class for testing MinterBuyCoinTx
 */
final class MinterBuyCoinTxTest extends TestCase
{
    /**
     * Predefined private key
     */
    const PRIVATE_KEY = '4daf02f92bf760b53d3c725d6bcc0da8e55d27ba5350c78d3a88f873e502bd6e';

    /**
     * Predefined minter address
     */
    const MINTER_ADDRESS = 'Mx67691076548b20234461ff6fd2bc9c64393eb8fc';

    /**
     * Predefined valid signature
     */
    const VALID_SIGNATURE = '0xf865020101800495d40187038d7ea4c680008089056bc75e2d63100000808001b845f8431ca0f64de1594ea6ea7717a2161771a429a2202e78ae4f1bf628a8c2e12a2df13e4aa04b8eb64ef9e7574983cc66960e98829fd93ab61fd2d7794c3e8810970e9e3693';

    /**
     * Test to decode data for MinterBuyCoinTx
     */
    public function testDecode(): void
    {
        $tx = MinterTx::decode(self::VALID_SIGNATURE);
        $validTx = $this->makeTransaction();

        $this->assertSame($validTx->getNonce(), $tx->getNonce());
        $this->assertSame($validTx->getGasCoin(), $tx->getGasCoin());
        $this->assertSame($validTx->getGasPrice(), $tx->getGasPrice());
        $this->assertSame($validTx->getChainID(), $tx->getChainID());
        $this->assertSame($validTx->getData()->coinToBuy, $tx->getData()->coinToBuy);
        $this->assertSame($validTx->getData()->coinToSell, $tx->getData()->coinToSell);
        $this->assertSame($validTx->getData()->maximumValueToSell, $tx->getData()->maximumValueToSell);
        $this->assertSame($validTx->getData()->valueToBuy, $tx->getData()->valueToBuy);
        $this->assertSame(self::MINTER_ADDRESS, $tx->getSenderAddress());
    }

    /**
     * Test signing MinterBuyCoinTx
     */
    public function testSign(): void
    {
        $signature = $this->makeTransaction()->sign(self::PRIVATE_KEY);
        $this->assertSame($signature, self::VALID_SIGNATURE);
    }

    /**
     * @return MinterTx
     */
    private function makeTransaction(): MinterTx
    {
        $data = new MinterBuyCoinTx(1, '0.001', 0, '100');
        return new MinterTx(2, $data);
    }
}
