<?php

namespace Web3p\RLP;

use InvalidArgumentException;
use ArrayAccess;

class Buffer implements ArrayAccess
{
    /**
     * data
     *
     * @var array
     */
    protected $data = [];

    /**
     * encoding
     *
     * @var string
     */
    protected $encoding = '';

    /**
     * construct
     *
     * @param mixed  $data
     * @param string $encoding the data encoding
     * @return void
     */
    public function __construct($data = [], string $encoding = 'utf8')
    {
        $this->encoding = strtolower($encoding);

        if ($data) {
            $this->data = $this->decodeToData($data);
        }
    }

    /**
     * offsetSet
     *
     * @param mixed $offset
     * @param mixed $value
     * @return void
     */
    public function offsetSet($offset, $value)
    {
        if (is_null($offset)) {
            $this->data[] = $value;
        } else {
            $this->data[$offset] = $value;
        }
    }

    /**
     * offsetExists
     *
     * @param mixed $offset
     * @return bool
     */
    public function offsetExists($offset)
    {
        return isset($this->data[$offset]);
    }

    /**
     * offsetUnset
     *
     * @param mixed $offset
     * @return void
     */
    public function offsetUnset($offset)
    {
        unset($this->data[$offset]);
    }

    /**
     * offsetGet
     *
     * @param mixed $offset
     * @return mixed
     */
    public function offsetGet($offset)
    {
        return isset($this->data[$offset]) ? $this->data[$offset] : null;
    }

    /**
     * length
     *
     * @return int
     */
    public function length()
    {
        return count($this->data);
    }

    /**
     * concat
     *
     * @return Buffer
     */
    public function concat()
    {
        $inputs = func_get_args();

        foreach ($inputs as $input) {
            if (is_array($input)) {
                $input = new Buffer($input);
            }
            if ($input instanceof Buffer) {
                $length = $input->length();

                for ($i = 0; $i < $length; $i++) {
                    $this->data[] = $input[$i];
                }
            } else {
                throw new InvalidArgumentException('Input must be array or Buffer when call concat.');
            }
        }
        return $this;
    }

    /**
     * slice
     *
     * @param int   $start
     * @param mixed $end
     * @return Buffer
     */
    public function slice(int $start = 0, $end = null)
    {
        if ($end === null) {
            $end = $this->length();
        }

        if ($end > 0) {
            $end -= $start;
        } else if ($end === 0) {
            return new Buffer([]);
        }

        $sliced = array_slice($this->data, $start, $end);

        return new Buffer($sliced);
    }

    /**
     * decodeToData
     *
     * @param mixed $input
     * @return array
     */
    protected function decodeToData($input)
    {
        $output = [];

        if (is_array($input)) {
            $output = $this->arrayToData($input);
        } else if (is_int($input)) {
            $output = $this->intToData($input);
        } else if (is_numeric($input)) {
            $output = $this->numericToData($input);
        } else if (is_string($input)) {
            $output = $this->stringToData($input, $this->encoding);
        }
        return $output;
    }

    /**
     * arrayToData
     *
     * @param array $inputs
     * @return array
     */
    protected function arrayToData(array $inputs)
    {
        $output = [];

        foreach ($inputs as $input) {
            if (is_array($input)) {
                throw new InvalidArgumentException('Do not use multidimensional array.');
            } else if (is_string($input)) {
                $output = array_merge($output, $this->stringToData($input, $this->encoding));
            } else if (is_numeric($input)) {
                $output = array_merge($output, $this->numericToData($input));
            }
        }

        return $output;
    }

    /**
     * stringToData
     *
     * @param string $input
     * @param string $encoding
     * @return array
     */
    protected function stringToData(string $input, string $encoding)
    {
        switch ($encoding) {
            case 'hex':
                if (strpos($input, '0x') === 0) {
                    $input = str_replace('0x', '', $input);
                }

                $input = strlen($input) % 2 !== 0 ? '0' . $input : $input;
                return array_map('hexdec', str_split($input, 2));
                break;
            case 'utf8':
                return unpack('C*', $input);
                break;
        }

        throw new InvalidArgumentException('StringToData encoding must be valid.');
    }

    /**
     * numericToData
     *
     * @param mixed $input
     * @return array
     */
    protected function numericToData($input)
    {
        $output = (int)$input;

        return [$output];
    }

    /**
     * intToData
     *
     * @param $input
     * @return array
     */
    protected function intToData($input)
    {
        return array_fill(0, $input, 0);
    }

    /**
     * @return string
     */
    public function __toString()
    {
        $output = '';
        $input  = $this->data;
        foreach ($input as $data) {
            $hex = dechex($data);
            $hex = strlen($hex) % 2 !== 0 ? '0' . $hex : $hex;
            $output .= $hex;
        }

        return $output;
    }
}