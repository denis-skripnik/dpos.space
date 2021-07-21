<?php

namespace Test\Unit;

use Test\TestCase;

class RLPTest extends TestCase
{
    /**
     * testEncode
     * 
     * @return void
     */
    public function testEncode()
    {
        $rlp = $this->rlp;

        $encoded = $rlp->encode(['dog', 'god', 'cat']);
        $this->assertEquals('cc83646f6783676f6483636174', $encoded);
        $this->assertEquals(13, $encoded->length());

        $encoded = $rlp->encode(['0xabcd', '0xdeff', '0xaaaa']);
        $this->assertEquals('c982abcd82deff82aaaa', $encoded);
        $this->assertEquals(10, $encoded->length());
    }

    /**
     * testDecode
     * 
     * @return void
     */
    public function testDecode()
    {
        $rlp = $this->rlp;
        $encoded = '0x' . $rlp->encode(['dog', 'god', 'cat']);
        $decoded = $rlp->decode($encoded);
        $this->assertEquals(3, count($decoded));

        $encoded = '0x' . $rlp->encode(['0xabcd', '0xdeff', '0xaaaa']);
        $decoded = $rlp->decode($encoded);
        $this->assertEquals(3, count($decoded));
        $this->assertEquals('abcd', $decoded[0]);
        $this->assertEquals('deff', $decoded[1]);
        $this->assertEquals('aaaa', $decoded[2]);
    }

    /**
     * testValidRlp
     * 
     * @return void
     */
    public function testValidRlp()
    {
        $rlp = $this->rlp;
        $rlptestJson = file_get_contents(sprintf("%s%srlptest.json", __DIR__, DIRECTORY_SEPARATOR));

        $this->assertTrue($rlptestJson !== false);
        $rlptest = json_decode($rlptestJson, true);
        
        foreach ($rlptest as $test) {
            $encoded = $rlp->encode($test['in']);

            $this->assertEquals($test['out'], $encoded);
        }
    }

    /**
     * testIssue14
     * See: https://github.com/web3p/rlp/issues/14
     * You can find test in: https://github.com/ethereum/wiki/wiki/RLP#examples
     * 
     * @return void
     */
    public function testIssue14()
    {
        $rlp = $this->rlp;
        $this->assertEquals('c0', $rlp->encode([]));
        $this->assertEquals('80', $rlp->encode(0));
        $this->assertEquals('80', $rlp->encode(0x0));
        $this->assertEquals('80', $rlp->encode(-1));
        $this->assertEquals('80', $rlp->encode(-2));
        $this->assertEquals('80', $rlp->encode('0'));
        $this->assertEquals('00', $rlp->encode('0x0'));
        $this->assertEquals('80', $rlp->encode(null));
    }
}