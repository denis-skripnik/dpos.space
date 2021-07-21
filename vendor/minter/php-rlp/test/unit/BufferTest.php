<?php

namespace Test\Unit;

use Test\TestCase;
use Web3p\RLP\Buffer;
use InvalidArgumentException;

class BufferTest extends TestCase
{
    /**
     * testCreateStringBuffer
     * 
     * @return void
     */
    public function testCreateStringBuffer()
    {
        $buffer = new Buffer('Hello World');
        $this->assertEquals(11, $buffer->length());

        $buffer = new Buffer('abcdabcdabcdabcd', 'hex');
        $this->assertEquals('abcdabcdabcdabcd', $buffer);
        $this->assertEquals(8, $buffer->length());

        $buffer = new Buffer('bcdabcdabcdabcd', 'hex');
        $this->assertEquals('0bcdabcdabcdabcd', $buffer);
        $this->assertEquals(8, $buffer->length());

        $buffer = new Buffer('我是測試');
        $this->assertEquals('e68891e698afe6b8ace8a9a6', $buffer);
        $this->assertEquals(12, $buffer->length());
    }

    /**
     * testCreateArrayBuffer
     * 
     * @return void
     */
    public function testCreateArrayBuffer()
    {
        $buffer = new Buffer(['Hello World', 'abcdabcdabcdabcd']);
        $this->assertEquals(27, $buffer->length());

        $buffer = new Buffer(['Hello World', 'abcdabcdabcdabcd']);
        $this->assertEquals('48656c6c6f20576f726c6461626364616263646162636461626364', $buffer);
    }

    /**
     * testCreateIntegerBuffer
     * 
     * @return void
     */
    public function testCreateIntegerBuffer()
    {
        $buffer = new Buffer(10);
        $this->assertEquals('00000000000000000000', $buffer);
        $this->assertEquals(10, $buffer->length());

        $buffer = new Buffer(15);
        $this->assertEquals('000000000000000000000000000000', $buffer);
        $this->assertEquals(15, $buffer->length());

        $buffer = new Buffer(20);
        $this->assertEquals('0000000000000000000000000000000000000000', $buffer);
        $this->assertEquals(20, $buffer->length());
    }

    /**
     * testCreateMultidimentionalArrayBuffer
     * 
     * @return void
     */
    public function testCreateMultidimentionalArrayBuffer()
    {
        $this->expectException(InvalidArgumentException::class);

        $buffer = new Buffer(['Hello World', 'abcdabcdabcdabcd', ['Hello World', 'abcdabcdabcdabcd']]);
    }

    /**
     * testCreateNumberBuffer
     * 
     * @return void
     */
    public function testCreateNumberBuffer()
    {
        $buffer = new Buffer('1');
        $this->assertEquals(1, $buffer->length());

        $buffer = new Buffer(1.56);
        $this->assertEquals(1, $buffer->length());
    }

    /**
     * testConcate
     * 
     * @return void
     */
    public function testConcat()
    {
        $buffer = new Buffer(['Hello World', 'abcdabcdabcdabcd']);
        $this->assertEquals(27, $buffer->length());

        $buffer->concat(['Test', 'Yo', 1]);
        $this->assertEquals('48656c6c6f20576f726c646162636461626364616263646162636454657374596f01', $buffer);
        $this->assertEquals(34, $buffer->length());

        $bufferB = new Buffer(['A lo ha']);
        $buffer->concat($bufferB);
        $this->assertEquals('48656c6c6f20576f726c646162636461626364616263646162636454657374596f0141206c6f206861', $buffer);
        $this->assertEquals(41, $buffer->length());

        $bufferC = new Buffer(['Goog']);
        $buffer->concat($bufferC, ['yo']);
        $this->assertEquals('48656c6c6f20576f726c646162636461626364616263646162636454657374596f0141206c6f206861476f6f67796f', $buffer);
        $this->assertEquals(47, $buffer->length());
    }
}