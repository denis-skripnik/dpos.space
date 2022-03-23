function unixTime(datetime) {
  return parseInt(new Date(datetime).getTime())
  }
let end_time = new Date(new Date().setUTCHours(17, 22, 0, 0)).setUTCDate(new Date().getDate() - 1);
if (unixTime() >= end_time + 86400000) {
  end_time = new Date(new Date().setUTCHours(17, 22, 0, 0)).setUTCDate(new Date().getDate());
}
console.log(end_time)
var list = '';
async function getTransactions(page) {
  try {
    let txs_responce = await axios.get(`/transactions?query=tags.tx.to='0000000000000000000000000000000000000000' and tags.tx.coin_id='0' and tags.tx.type='01'&page=${page}&per_page=100`);
    let res = txs_responce.data.transactions;
  
    if (res && res.length > 0) {
      for (let transaction of res) {
  let block = (await axios.get('https://api.minter.one/v2/block/' + transaction.height)).data;
      let block_time = unixTime(block.time);
      if (block_time < end_time) break;
      let amount = parseFloat(transaction.data.value) / (10 ** 18);
      if (amount === 2022) {
        if (list.indexOf(transaction.from) === -1) {
          list += `
          <li>${transaction.from}</li>`;
        }
      } // end amount.
    } // end for.
  } // end if length > 0.
    if (res && res.length === 50) {
    await getTransactions(page + 1);
  }
  } catch(error) {
  window.alert('Вероятно, ошибка соединения с Нодой.');
  }
}

$(document).ready(async function() {
  await getTransactions(1);
  $('#active_txs').html(list);
});