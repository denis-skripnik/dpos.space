<?php

namespace Web3p\RLP;

use InvalidArgumentException;
use RuntimeException;

class RLP
{
    /**
     * encode
     *
     * @param mixed $inputs array of string
     * @return Buffer
     */
    public function encode($inputs)
    {
        if (is_array($inputs)) {
            $output = new Buffer();
            foreach ($inputs as $input) {
                $output->concat($this->encode($input));
            }

            $encoded = $this->encodeLength($output->length(), 192);
            return (new Buffer)->concat($encoded, $output);
        }

        $input  = $this->toBuffer($inputs);
        $length = $input->length();
        if ($length === 1 && $input[0] < 128) {
            return $input;
        } else {
            $encoded = $this->encodeLength($length, 128);
            return (new Buffer)->concat($encoded, $input);
        }
    }

    /**
     * decode
     *
     * @param string $input
     * @return array
     */
    public function decode(string $input)
    {
        $input   = $this->toBuffer($input);
        $decoded = $this->decodeData($input);
        return $decoded['data'];
    }

    /**
     * decodeData
     *
     * @param Buffer $input
     * @return array
     */
    protected function decodeData(Buffer $input)
    {
        $firstByte = $input[0];

        if ($firstByte <= 0x7f) {
            return [
                'data'      => $input->slice(0, 1),
                'remainder' => $input->slice(1)
            ];
        } else if ($firstByte <= 0xb7) {
            $length = $firstByte - 0x7f;
            $data   = new Buffer([]);
            if ($firstByte !== 0x80) {
                $data = $input->slice(1, $length);
            }

            if ($length === 2 && $data[0] < 0x80) {
                throw new RuntimeException('Byte must be less than 0x80.');
            }

            return [
                'data'      => $data,
                'remainder' => $input->slice($length)
            ];
        } else if ($firstByte <= 0xbf) {
            $llength   = $firstByte - 0xb6;
            $hexLength = $input->slice(1, $llength);

            if ($hexLength === '00') {
                throw new RuntimeException('Invalid RLP.');
            }

            $length = hexdec($hexLength);
            $data   = $input->slice($llength, $length + $llength);

            if ($data->length() < $length) {
                throw new RuntimeException('Invalid RLP.');
            }
            return [
                'data'      => $data,
                'remainder' => $input->slice($length + $llength)
            ];
        } else if ($firstByte <= 0xf7) {
            $length         = $firstByte - 0xbf;
            $innerRemainder = $input->slice(1, $length);
            $decoded        = [];

            while ($innerRemainder->length()) {
                $data           = $this->decodeData($innerRemainder);
                $decoded[]      = $data['data'];
                $innerRemainder = $data['remainder'];
            }
            return [
                'data'      => $decoded,
                'remainder' => $input->slice($length)
            ];
        } else {
            $llength   = $firstByte - 0xf6;
            $hexLength = $input->slice(1, $llength);
            $decoded   = [];

            if ($hexLength === '00') {
                throw new RuntimeException('Invalid RLP.');
            }
            $length      = hexdec($hexLength);
            $totalLength = $llength + $length;

            if ($totalLength > $input->length()) {
                throw new RuntimeException('Invalid RLP: total length is bigger than data length.');
            }
            $innerRemainder = $input->slice($llength, $totalLength);

            if ($innerRemainder->length() === 0) {
                throw new RuntimeException('Invalid RLP: list has invalid length.');
            }

            while ($innerRemainder->length()) {
                $data           = $this->decodeData($innerRemainder);
                $decoded[]      = $data['data'];
                $innerRemainder = $data['remainder'];
            }

            return [
                'data'      => $decoded,
                'remainder' => $input->slice($totalLength)
            ];
        }
    }

    /**
     * encodeLength
     *
     * @param int $length
     * @param int $offset
     * @return Buffer
     */
    protected function encodeLength(int $length, int $offset)
    {
        if ($length < 56) {
            return new Buffer(strval($length + $offset));
        }

        $hexLength = $this->intToHex($length);
        $firstByte = $this->intToHex($offset + 55 + (strlen($hexLength) / 2));

        return new Buffer(strval($firstByte . $hexLength), 'hex');
    }

    /**
     * intToHex
     *
     * @param int $value
     * @return string
     */
    protected function intToHex(int $value)
    {
        $hex = dechex($value);
        return $this->padToEven($hex);
    }

    /**
     * padToEven
     *
     * @param string $value
     * @return string
     */
    protected function padToEven(string $value)
    {
        return strlen($value) % 2 !== 0 ? '0' . $value : $value;
    }

    /**
     * toBuffer
     * Format input to buffer.
     *
     * @param mixed $input
     * @return Buffer
     */
    protected function toBuffer($input)
    {
        if ($input === '0') {
            return new Buffer(0, 'hex');
        } else if (is_string($input) && !is_numeric($input)) {
            if (strpos($input, '0x') === 0) {
                return new Buffer($input, 'hex');
            }

            return new Buffer(str_split($input, 1));
        } else if (is_numeric($input)) {
            if (!$input || $input < 0) {
                return new Buffer([]);
            }

            if (is_float($input)) {
                $input = number_format($input, 0, '', '');
            }

            $gmpInput = gmp_init($input, 10);
            $gmpInput = gmp_strval($gmpInput, 16);

            return new Buffer('0x' . $gmpInput, 'hex');
        } else if ($input === null) {
            return new Buffer([]);
        } else if (is_array($input)) {
            return new Buffer($input);
        } else if ($input instanceof Buffer) {
            return $input;
        }

        throw new InvalidArgumentException('The input type not supported.');
    }
}