async function getProviders(pair, page, liquidity, address) {
  let pool_providers = await axios.get(`https://explorer-api.minter.network/api/v2/pools/coins/${pair}/providers?page=${page}`);
let providers = pool_providers.data.data;
for (let provider of providers) {
    let to = provider.address;
if (to !== address) continue;
liquidity += parseFloat(provider.amount1) * 2;
}
let next = pool_providers.data.links.next;
await new Promise(r => setTimeout(r, 1000));
if (next && typeof next !== 'null' && liquidity === 0) {
    await getProviders(pair, page+1, liquidity, address);
} else {
    return liquidity;
}
}

async function selectProvider(address) {
  $('#farm_result').html('Ожидайте... Вычисляем ликвидность пользователя...');  
  let pairs = ['BIP/VIZCHAIN', 'USDTE/VIZCHAIN', 'USDTBSC/VIZCHAIN', 'USDCE/VIZCHAIN', 'USDCBSC/VIZCHAIN', 'DAIE/VIZCHAIN', 'DAIBSC/VIZCHAIN', 'BTC/VIZCHAIN', 'BTCBSC/VIZCHAIN', 'ETH/VIZCHAIN', 'MUSD/VIZCHAIN', 'HUB/VIZCHAIN']
         let liquidity = 0;
         for (let pair of pairs) {
let pool = await getProviders(pair, 1, 0, address);
liquidity += pool;
         }
        return liquidity;
        }

async function calcAwards(login) {
    let shares_counter = 0;
    let awards_counter = 0;
    let history = [];
    
    try {
      // Получаем историю аккаунта
      history = await viz.api.getAccountHistoryAsync(login, -1, 1000);
    } catch (error) {
      console.error(error);
      return 0;
    }

    let memo = '';
    $('#farm_result').html('Ожидайте... Сканируем историю...');  

    // Проходимся по каждой операции
    for (let i = 0; i < history.length && awards_counter < 7; i++) {
      const op = history[i][1].op;
      const opType = op[0];
      const opData = op[1];
  
      if (opType === 'receive_award' && opData.initiator === 'viz-projects') {
        shares_counter += parseFloat(opData.shares);
        awards_counter++;
        memo = opData.memo;
    }
    }
  let data = {};
if (awards_counter === 0) return undefined;
  data.shares = Math.round(shares_counter / awards_counter * 365);
  if (memo !== '') {
    data.address = memo.split('for ')[1].split(':')[0];  
  }
    return data;
  }

  $(document).ready(function() {
$('#farm_calc').click(async function() {
    $('#farm_result').html('Начинаем процесс...');
    let farmer = $('#farmer').val();
let {shares, address} = await calcAwards(farmer);
let l = await selectProvider(address);
let profit_percent = (shares / l) * 100;
$('#farm_result').html(`Доходность для <A href="/viz/profiles/${farmer}" target="_blank">${farmer}</a> (<a href="/minter/profiles/${address}" target="_blank">${address}</a>) примерно ${profit_percent.toFixed(2)}%.`)
});
  });