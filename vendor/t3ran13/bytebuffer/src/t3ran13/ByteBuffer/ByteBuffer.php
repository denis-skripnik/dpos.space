<?php

namespace t3ran13\ByteBuffer;

/**
 * ByteBuffer
 */
class ByteBuffer extends AbstractBuffer {

		const DEFAULT_CAPACITY = null;
	const DEFAULT_FORMAT = 'x';

	/**
	 * @var \SplFixedArray|array
	 */
	protected $buffer;
	/**
	 * @var \SplFixedArray|array
	 */
	protected $currentOffset = 0;

	/**
	 * @var LengthMap
	 */
	protected $lengthMap;

	public function __construct($capacity = self::DEFAULT_CAPACITY) {
		$this->lengthMap = new LengthMap();
        $this->initializeStructs($capacity);
	}

	protected function initializeStructs($length) {
        if ($length === self::DEFAULT_CAPACITY) {
            $this->buffer = [];
        } else {
            $this->buffer = new \SplFixedArray($length);
        }
	}

	protected function insert($format, $value, $offset, $length) {
        if ($offset === null) {
            $offset = $this->currentOffset;
        }
		$bytes = pack($format, $value);
		for ($i = 0; $i < strlen($bytes); $i++) {
			$this->buffer[$offset++] = $bytes[$i];
		}
        $this->currentOffset = $offset;
	}

	protected function extract($format, $offset, $length) {
		$encoded = '';
		for ($i = 0; $i < $length; $i++) {
			$encoded .= $this->buffer[$offset + $i];
		}
		if ($format == 'N'&& PHP_INT_SIZE <= 4) {
			list(, $h, $l) = unpack('n*', $encoded);
			$result = ($l + ($h * 0x010000));
		} else if ($format == 'V' && PHP_INT_SIZE <= 4) {
			list(, $h, $l) = unpack('v*', $encoded);
			$result = ($h + ($l * 0x010000));
		} else {
			list(, $result) = unpack($format, $encoded);
		}
		return $result;
	}

	protected function checkForOverSize($excpected_max, $actual) {
		if ($actual > $excpected_max) {
			throw new \InvalidArgumentException(sprintf('%d exceeded limit of %d', $actual, $excpected_max));
		}
	}

	public function __toString() {
		$buf = '';
		foreach ($this->buffer as $bytes) {
			$buf .= $bytes;
		}
		return $buf;
	}

    public function setByteRaw($value, $offset = null) {
        if ($offset === null) {
            $offset = $this->currentOffset;
        }
        $this->buffer[$offset++] = $value;
        $this->currentOffset = $offset;
    }

    public function getBufferArray() {
        return $this->buffer;
    }

	public function getBuffer($format, $offset, $length) {
		$buf = '';
		foreach ($this->buffer as $index => $bytes) {
            if ($offset <= $index && $index < ($offset + $length)) {
                $buf .= unpack($format . '*', $bytes)[1];
            }
		}
//        return $this->extract($format, $offset, $length);
		return $buf;
	}

	public function length() {
		return count($this->buffer);
	}

    public function setCurrentOffset($offset) {
        $this->currentOffset = $offset;
    }

    public function getCurrentOffset() {
        return $this->currentOffset;
    }

	public function write($string, $offset = null) {
		$length = strlen($string);
		$this->insert('a' . $length, $string, $offset, $length);
	}

    public function writeByte($byte, $offset = null) {
        if ($offset === null) {
            $offset = $this->currentOffset;
        }
        $this->buffer[$offset++] = $byte;
        $this->currentOffset = $offset;
    }

	public function writeVStringLE($value, $offset = null) {
        if ($offset === null) {
            $offset = $this->currentOffset;
        }
        $bytes = unpack('C*', $value); //string to bytes in int
        $total = count($bytes);
        for ($i = 0; $i < $total; $i++) {
            if (in_array($value[$i], ["\n","\r"])) {
                $this->buffer[$offset++] = pack('h*', base_convert($bytes[$i+1], 10, 16));
            } else {
                $this->buffer[$offset++] = pack('H*', base_convert($bytes[$i+1], 10, 16));
            }
        }
        $this->currentOffset = $offset;
	}

	public function writeVHexStringBE($value, $offset = null) {
        if ($offset === null) {
            $offset = $this->currentOffset;
        }
        $symbols = str_split($value, 2); //string to bytes in int
        $total = count($symbols);
        for ($i = 0; $i < $total; $i++) {
            $this->buffer[$offset++] = hex2bin($symbols[$i]);
        }
        $this->currentOffset = $offset;
	}


	public function writeVStringBE($value, $offset = null) {
        if ($offset === null) {
            $offset = $this->currentOffset;
        }
        $bytes = unpack('C*', $value); //string to bytes in int
        $total = count($bytes);
        for ($i = 0; $i < $total; $i++) {
            $this->buffer[$offset++] = pack('h*', base_convert($bytes[$i+1], 10, 16));
        }
        $this->currentOffset = $offset;
	}

	public function writeInt8($value, $offset = null) {
		$format = 'C';
		$this->checkForOverSize(0xff, $value);
		$this->insert($format, $value, $offset, $this->lengthMap->getLengthFor($format));
	}

	public function writeInt16BE($value, $offset = null) {
		$format = 'n';
		$this->checkForOverSize(0xffff, $value);
		$this->insert($format, $value, $offset, $this->lengthMap->getLengthFor($format));
	}

	public function writeInt16BE2($value, $offset = null) {
		$format = 's';
		$this->insert($format, $value, $offset, $this->lengthMap->getLengthFor($format));
	}

	public function writeInt16LE($value, $offset = null) {
		$format = 'v';
		$this->checkForOverSize(0xffff, $value);
		$this->insert($format, $value, $offset, $this->lengthMap->getLengthFor($format));
	}

	public function writeInt32BE($value, $offset = null) {
		$format = 'N';
		$this->checkForOverSize(0xffffffff, $value);
		$this->insert($format, $value, $offset, $this->lengthMap->getLengthFor($format));
	}

	public function writeInt32LE($value, $offset = null) {
		$format = 'V';
		$this->checkForOverSize(0xffffffff, $value);
		$this->insert($format, $value, $offset, $this->lengthMap->getLengthFor($format));
	}

	public function read($offset, $length) {
		$format = 'a' . $length;
		return $this->extract($format, $offset, $length);
	}

	public function readInt8($offset) {
		$format = 'C';
		return $this->extract($format, $offset, $this->lengthMap->getLengthFor($format));
	}

	public function readInt16BE($offset) {
		$format = 'n';
		return $this->extract($format, $offset, $this->lengthMap->getLengthFor($format));
	}

	public function readInt16LE($offset) {
		$format = 'v';
		return $this->extract($format, $offset, $this->lengthMap->getLengthFor($format));
	}

	public function readInt32BE($offset) {
		$format = 'N';
		return $this->extract($format, $offset, $this->lengthMap->getLengthFor($format));
	}

	public function readInt32LE($offset) {
		$format = 'V';
		return $this->extract($format, $offset, $this->lengthMap->getLengthFor($format));
	}

}