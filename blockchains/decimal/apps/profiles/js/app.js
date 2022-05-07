let types = {
1: 'Отправка',
2: 'Продажа монеты',
3: 'Продажа всех монет',
4: 'Покупка монет',
5: 'Создание монеты',
6: 'Объявление кандидата в валидаторы',
7: 'Делегирование',
8: 'Анбонд',
9: 'Получение чека',
10: 'Установка кандидата в статусе онлайн',
11: 'Установка кандидата в статусе оффлайн',
12: 'Создание мультисига',
13: 'Мультисенд (мульти-отправка)',
14: 'Редактирование кандидата',
15: 'Установка блока остановки',
16: 'Пересоздание монеты',
17: 'Изменение владельца монеты',
18: 'Редактирование мультисига',
19: 'Голосование за цену',
20: 'Изменение публичного ключа кандидата',
21: 'Добавление ликвидности',
22: 'Удаление ликвидности',
23: 'Продажа через пул',
24: 'Покупка через пул',
25: 'Продажа всех монет через пул',
26: 'Изменение комиссии кандидата',
27: 'Перемещение стейка',
28: 'Эмиссия токена',
29: 'Сжигание токена',
30: 'Создание токена',
31: 'Пересоздание токена',
32: 'Голосование за комиссию',
33: 'Голосование за обновление',
34: 'Создание пула ликвидности'
};
var url = document.location.pathname;
var address = url.slice(-41)
if (url.endsWith("/") === true) {
  address = url.slice(-42, -1)
}

async function rewardsHistory(rewards_amounts, offset, end_date) {
  let isEndDate = false;
  let responce = await axios.get('https://mainnet-explorer-api.decimalchain.com/api/address/' + address + '/rewards?limit=200&offset=' + offset + '&order[date]=DESC');
  let rewards = responce.data.result.rewards;
  // window.alert(end_date);
  if (rewards && rewards.length > 0) {
  for (let reward of rewards) {
    let date = new Date(reward.date).getTime();
    if (date < end_date) {
      isEndDate = true;
      break;
    }
    let amount = parseFloat(reward.value) / (10 ** 18);
  if (!rewards_amounts[reward.currency]) rewards_amounts[reward.currency] = 0;
  rewards_amounts[reward.currency] += amount;
  }
// window.alert(isEndDate);
  if (isEndDate === false) {
  rewards_amounts = await rewardsHistory(rewards_amounts, offset + 200, end_date)
}
}
return rewards_amounts;
}

async function getRewards(days) {
  let end_date = new Date().getTime() - (86400000 * days);
  let rewards_amounts = {};
  rewards_amounts = await rewardsHistory(rewards_amounts, 0, end_date);
  return rewards_amounts;
}

async function main() {
  let acc = (await decimal.getAddress(address)).address;
  $('#nonce').html(acc.nonce);
  let balances = '';
  for (let token in acc.balance) {
    let balance = parseFloat(acc.balance[token]) / (10 ** 18);
    balance = balance.toFixed(3);
    balances += `<li>${balance} ${token}</li>`
  }
      $('#balances').html(balances);
    }

 function fast_str_replace(search,replace,str){
    return str.split(search).join(replace);
  }
  
  function date_str(timestamp,add_time,add_seconds,remove_today=false){
    if(-1==timestamp){
      var d=new Date();
    }
    else{
      var d=new Date(timestamp);
    }
    var day=d.getDate();
    if(day<10){
      day='0'+day;
    }
    var month=d.getMonth()+1;
    if(month<10){
      month='0'+month;
    }
    var minutes=d.getMinutes();
    if(minutes<10){
      minutes='0'+minutes;
    }
    var hours=d.getHours();
    if(hours<10){
      hours='0'+hours;
    }
    var seconds=d.getSeconds();
    if(seconds<10){
      seconds='0'+seconds;
    }
    var datetime_str=day+'.'+month+'.'+d.getFullYear();
    if(add_time){
      datetime_str=datetime_str+' '+hours+':'+minutes;
      if(add_seconds){
        datetime_str=datetime_str+':'+seconds;
      }
    }
    if(remove_today){
      datetime_str=fast_str_replace(date_str(-1)+' ','',datetime_str);
    }
    return datetime_str;
  }
  
  function prepareContent(text) {
    try {
      return text.replace(/[^=][^""][^"=\/](https?:\/\/[^" <>\n]+)/gi, data => {
        const link = data.slice(3);
          if(/(jpe?g|png|svg|gif)$/.test(link)) return `${data.slice(0,3)} <img src="${link}" alt="" /> `
          if(/(vimeo)/.test(link)) return `${data.slice(0,3)} <iframe src="${link}" frameborder="0" allowfullscreen></iframe> `;
          if(/(youtu)/.test(link)) return `${data.slice(0,3)} <iframe src="${link.replace(/.*v=(.*)/, 'https://www.youtube.com/embed/$1')}" frameborder="0" allowfullscreen></iframe> `;
          return `${data.slice(0,3)} <a href="${link}">${link}</a> `
        }).replace(/ (@[^< \.,]+)/gi, user => ` <a href="/minter/profiles/${user.trim().slice(1)}">${user.trim()}</a>`)
    } catch(e) {
      return text;
    }
   }

   async function getHistory(page) {
    jQuery("#wallet_transfer_history").css("display", "block");try {
    let offset = (page * 10) - 10;
     
    let response = await axios.get('https://mainnet-gate.decimalchain.com/api/address/' + address + '/txs?limit=10&offset=' + offset);
    let results = '';
    let res = response.data.result.txs;
    
      let types = {
        buy_coin: 'Покупка монет',
        create_coin: 'Создание монеты',
        update_coin: 'Обновление монеты',
        sell_coin: 'Продажа монеты',
       send_coin: 'Отправка',
       multisend_coin: 'Мультисенд (мульти-отправка)',
       sell_all_coin: 'Продажа всех монет',
       redeem_check: 'Получение чека',
       issue_check: 'Создание чека',
       declare_candidate: 'Объявление кандидата в валидаторы',
       delegate: 'Делегирование',
       set_online: 'Установка кандидата в статусе онлайн',
       set_offline: 'Установка кандидата в статусе оффлайн',
       unbond: 'Анбонд',
       edit_candidate: 'Редактирование кандидата',
       create_wallet: 'Создание мультисига',
       create_transaction: 'Создание мультисиг транзакции',
       sign_transaction: 'Подпись мультисигом транзакции',
       MsgSubmitProposal: 'Отправленный пропозал',
       MsgVote: 'Голосование по пропозалу',
       msg_initialize: 'Инициализация свопа',
       msg_redeem_v2: 'Получение свопа',
       msg_mint: 'Создание NFT',
       msg_burn: 'Сжигание NFT',
       msg_edit_metadata: 'Редактирование мета-данных NFT',
       msg_transfer: 'Передача NFT',
       delegate_nft: 'Делегирование NFT',
       unbond_nft: 'Анбонд NFT'
      };
       for (let tr of res) {
let amount;
let coin_str = 'coin';
let value_str = 'amount';
let type = types[tr.type];
if (tr.type === 'COIN_SEND' && tr.data.to === address) {
type = 'Получение';
} else if (tr.type === 'COIN_SELL' || tr.type === 'COIN_SELL_ALL' || tr.type === 'COIN_BUY') {
  type = 'Конвертация';
  coin_str = 'sellCoin'
  value_str = 'amount';
} else if (tr.type === 'transfer_nft') {
  type = 'Передача NFT';
  coin_str = 'transfer_nft'
  value_str = 'nft';
} else if (tr.type === 'mint_nft') {
  type = 'Создание NFT';
  coin_str = 'mint_nft';
  value_str = 'nft';
} else if (tr.type === 'delegate_nft') {
  type = 'Делегирование NFT';
  coin_str = 'delegate_nft'
  value_str = 'nft';
} else if (tr.type === 'unbond_nft') {
  type = 'Анбонд NFT';
  coin_str = 'unbond_nft'
  value_str = 'nft';
}

if (!tr.data.list && tr.type !== 'COIN_CREATE') {
  if (value_str !== 'nft') {
    amount = parseFloat(tr.data[value_str]) / (10 ** 18);
    amount = amount.toFixed(3);
    amount += ' ' + tr.data[coin_str];
  } else {
    amount = parseFloat(tr.data[value_str]['quantity']) + tr.data[value_str].nftCollection;
  }
} else if (!tr.data.list && (tr.type === 'COIN_CREATE')) {
  amount = parseFloat(tr.data.initSupply) / (10 ** 18);
  amount = amount.toFixed(3);
  amount += ' ' + tr.data.ticker;
} else {
let sum_amount = 0;
    let coin = '';
for (let el of tr.data.list) {
  if (tr.from === address || el.to === address) {
  sum_amount += parseFloat(el[value_str]);
  coin = el[coin_str].symbol;
}
}
amount = sum_amount;
amount += coin;
}
let get_time = Date.parse(tr.timestamp);
let memo = tr.message;
results += `
<tr><td>${date_str(get_time, true, false, true)}</td>
<td><a href="/decimal/explorer/block/${tr.blockId}" target="_blank">${tr.blockId}</a></td>
<td><a href="/decimal/explorer/tx/${tr.hash}" target="_blank">${tr.hash}</a></td>
<td>${type}</td>
<td>${amount}</td>
<td>${memo}</td>
</tr>`;
}
let next_page = page + 1;
let prev_page = page - 1;
if (page === 1) {
$('#history_pages').html(`<a onclick="getHistory(${next_page});">Следующая</a>`);
} else if (page > 1 && res.length === 50) {
$('#history_pages').html(`<a onclick="getHistory(${prev_page});">Предыдущая</a>
<a onclick="getHistory(${next_page});">Следующая</a>`);
} else {
$('#history_pages').html(`<a onclick="getHistory(${prev_page});">Предыдущая</a>`);
}
$('#history_tbody').css('display', 'block');
$('#history_tbody').html(results);
} catch(e) {
       console.log(e);
     }
}

$(document).ready(async function() {
  await main();
  
$('[name=calc_rewards]').click(async function() {
let days = parseInt($('[name=days_counter]').val());
let rewards_text = ``;
let rewards_amounts = await getRewards(days);
if (Object.keys(rewards_amounts).length > 0) {
for (let coin in rewards_amounts) {
rewards_text += `<li>${rewards_amounts[coin].toFixed(5)} ${coin}</li>
`;
}
}
$('#calculated_rewards').html(rewards_text);
});

  $('[name=copy_nonce]').click(function() {
    let nonce = parseInt($('#nonce').html());
    navigator.clipboard.writeText(nonce)
  .then(() => {
    // Получилось!
  })
  .catch(err => {
    console.log('Something went wrong', err);
  });
  })
  await getHistory(1);
});