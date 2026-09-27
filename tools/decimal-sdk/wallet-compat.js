const { ethers } = require('ethers');
const { bech32 } = require('bech32');

const ADDRESS_PREFIX = 'd0';
const DERIVATION_PATH = "m/44'/60'/0'/0/0";
const ENTROPY_BYTES = 32;

function decodeAddress(address, prefix = ADDRESS_PREFIX) {
  if (typeof address !== 'string') throw new Error('Invalid Decimal address checksum');
  let decoded;
  try {
    decoded = bech32.decode(address);
  } catch (_) {
    throw new Error('Invalid Decimal address checksum');
  }
  const bytes = Uint8Array.from(bech32.fromWords(decoded.words));
  if (decoded.prefix !== prefix || bytes.length !== 20) {
    throw new Error('Invalid Decimal account address payload');
  }
  return bytes;
}

function verifyAddress(address, prefix = ADDRESS_PREFIX) {
  try {
    decodeAddress(address, prefix);
    return true;
  } catch (_) {
    return false;
  }
}

class Wallet {
  constructor(mnemonic) {
    const phrase = mnemonic || ethers.utils.entropyToMnemonic(ethers.utils.randomBytes(ENTROPY_BYTES));
    if (!ethers.utils.isValidMnemonic(phrase)) throw new Error('Invalid mnemonic');

    const account = ethers.Wallet.fromMnemonic(phrase, DERIVATION_PATH);
    const addressBytes = ethers.utils.arrayify(account.address);
    this.mnemonic = phrase;
    this.evmAddress = account.address.toLowerCase();
    this.address = bech32.encode(ADDRESS_PREFIX, bech32.toWords(addressBytes));
    this.wallet = Object.freeze({ id: 0 });
  }

  static decodeCosmosAccountAddress(address) {
    return ethers.utils.hexlify(decodeAddress(address)).toLowerCase();
  }
}

module.exports = { Wallet, verifyAddress };
