const DecimalNumber = Decimal;

DecimalNumber.set({ precision: 100 })

function getAmountFromSatoshi(amount) {
  return new DecimalNumber(amount)
    .times(new DecimalNumber(10).pow(-18))
    .toFixed()
}

function getCoinFormatted(coinData) {
  return {
    supply: getAmountFromSatoshi(coinData.volume),
    reserve: getAmountFromSatoshi(coinData.reserve),
    crr: new DecimalNumber(coinData.crr).div(100).toFixed(),
    maxSupply: getAmountFromSatoshi(coinData.limitVolume),
    ticker: coinData.symbol
  }
}

/**
 * Sell:
 * Продажа монеты, подсчет получаемых del
 */
const sellCoin = (coin, coinAmount) => {
  const crr = new DecimalNumber(coin.crr).times(100).toNumber()

  if (new DecimalNumber(coinAmount).eq(new DecimalNumber(0))) {
    return "0"
  }
  if (new DecimalNumber(coinAmount).eq(new DecimalNumber(coin.supply))) {
    return coin.reserve
  }
  if (new DecimalNumber(crr).eq(new DecimalNumber(100))) {
    const ret = new DecimalNumber(coin.reserve).times(
      new DecimalNumber(coinAmount)
    )
    return ret
      .div(new DecimalNumber(coin.supply))
      .toFixed()
      .toString()
  }

  const e1 = new DecimalNumber(coinAmount).div(coin.supply)
  const e2 = new DecimalNumber(1).minus(e1)
  if (e2 < new DecimalNumber(0)) {
    return false
  }
  const e3 = e2.pow(new DecimalNumber(100).div(crr))
  const e4 = new DecimalNumber(1).minus(e3)
  return e4.times(coin.reserve).toFixed()
}

/**
 * Sell:
 * Продажа монеты, подсчет необходимых монет
 */
function sellCoinByDel(coin, delAmount) {
  // eslint-disable-next-line no-param-reassign
  delAmount = Math.min(parseFloat(coin.reserve), +delAmount)
  const e1 = new DecimalNumber(delAmount).div(coin.reserve)
  const e2 = new DecimalNumber(1).minus(e1).pow(coin.crr)
  const result = new DecimalNumber(1).minus(e2).times(coin.supply) // => coin

  return result.toFixed()
}

/**
 * Buy:
 * Покупка монеты, подсчет получаемых монет
 */
 function buyCoin(coin, delAmount) {
  const e1 = new DecimalNumber(delAmount).div(coin.reserve).plus(1).pow(coin.crr)
  const result = new DecimalNumber(e1).minus(1).times(coin.supply) // => coin

  return result.toFixed()
}

/**
 * Buy:
 * Покупка монеты, подсчет необходимых del
 */
 function buyCoinByCoin(coin, coinAmount) {
  const e1 = new DecimalNumber(coinAmount).div(coin.supply).plus(1)
  const e2 = new DecimalNumber(1).div(coin.crr)
  const result = new DecimalNumber(e1)
    .pow(e2)
    .minus(1)
    .times(coin.reserve) // => del

  return result.toFixed()
}

function isLessReserve(spendCoin, amount) {
  // console.log('spend-coin', spendCoin);
  // console.log('amount', amount);
  const maxDelSpend = new DecimalNumber(spendCoin.reserve).minus(1000).toFixed()

  if (!amount || new DecimalNumber(amount).gt(maxDelSpend)) {
    return {
      key: "reserve-limit",
      coin: spendCoin.ticker.toUpperCase()
    }
  }
  return false
}
function isMoreMaxSupply(getCoin, amount) {
  const available = new DecimalNumber(getCoin.maxSupply)
    .minus(getCoin.supply)
    .toFixed() // => coin

  if (new DecimalNumber(amount).gt(available)) {
    return {
      key: "more-limit-volume",
      coin: getCoin.ticker.toUpperCase()
    }
  }
  return false
}
// Todo
function buy(getCoinn, amount, spendCoinn) {
  const spendCoin = getCoinFormatted(spendCoinn)
  const getCoin = getCoinFormatted(getCoinn)
  // console.log('buy');
  let estimated = ""
  let error = false

  if (
    // @ts-ignore
    getCoin.ticker.toLowerCase() === process.env.baseCoin.toLowerCase()
  ) {
    estimated = sellCoinByDel(spendCoin, amount) // => coin
    error = isLessReserve(spendCoin, amount)
  } else if (
    // @ts-ignore
    spendCoin.ticker.toLowerCase() === process.env.baseCoin.toLowerCase()
  ) {
    estimated = buyCoinByCoin(getCoin, amount) // => tdel
    error = isMoreMaxSupply(getCoin, amount)
  } else {
    const needDel = buyCoinByCoin(getCoin, amount) // => tdel
    estimated = sellCoinByDel(spendCoin, needDel) // => coin
    error = isMoreMaxSupply(getCoin, amount)
    error = error || isLessReserve(spendCoin, needDel)
  }

  // error = error || isInfluentFunds(estimated, spendCoin);

  if (error) {
    return {
      success: false,
      ...error
    }
  }

  return {
    success: true,
    value: estimated
  }
}

function sell(spendCoinn, amount, getCoinn) {
  const spendCoin = getCoinFormatted(spendCoinn)
  const getCoin = getCoinFormatted(getCoinn)
  // console.log('sell');
  let estimated = ""
  let error = false

  if (
    // @ts-ignore
    spendCoin.ticker.toLowerCase() === 'del'.toLowerCase()
  ) {
    estimated = buyCoin(getCoin, amount) // => coin
    error = isMoreMaxSupply(getCoin, estimated)
  } else if (
    // @ts-ignore
    getCoin.ticker.toLowerCase() === 'del'.toLowerCase()
  ) {
    estimated = sellCoin(spendCoin, amount)
    error = isLessReserve(spendCoin, estimated)
  } else {
    const needDel = String(sellCoin(spendCoin, amount)) // => tdel
    estimated = buyCoin(getCoin, needDel) // => coin
    error = isMoreMaxSupply(getCoin, amount)
    error = error || isLessReserve(spendCoin, needDel)
  }

  // error = error || isInfluentFunds(amount, spendCoin);

  if (error) {
    return {
      success: false,
      ...error
    }
  }

  return {
    success: true,
    value: estimated
  }
}
