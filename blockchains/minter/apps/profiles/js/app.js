var url = document.location.pathname;
var address = url.slice(-42)
if (url.endsWith("/") === true) {
  address = url.slice(-43, -1)
}

async function main() {
  let acc = await getBalance(address);
  let balances = '';
  for (let token of acc) {
    let balance = token.amount;
    balances += `<li>${balance} ${token.coin}</li>`
  }
      $('#balances').html(balances);

// HUB в других БЧ.
      let eth_address = 0 + address.slice(1);
let ethereumHubBalanceRes = await axios.get(`https://api.etherscan.io/api?module=account&action=tokenbalance&contractaddress=0x8e9a29e7ed21db7c5b2e1cd75e676da0236dfb45&address=${eth_address}&tag=latest`);
let ethereumHub = parseFloat(ethereumHubBalanceRes.data.result) / (10 ** 18);
    $('#ethereum_hub').html(ethereumHub);
  
    let bscHubBalanceRes = await axios.get(`https://api.bscscan.com/api?module=account&action=tokenbalance&contractaddress=0x8e9a29e7ed21db7c5b2e1cd75e676da0236dfb45&address=${eth_address}&tag=latest`);
    let bscHub = parseFloat(bscHubBalanceRes.data.result) / (10 ** 18);
        $('#bsc_hub').html(bscHub);
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
    let response = await axios.get('https://explorer-api.minter.network/api/v2/addresses/' + sender.address + '/transactions?page=' + page);
    let results = '';
    let res = response.data.data;
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
26: 'Покупка всех монет через пул',
27: 'Изменение комиссии кандидата',
28: 'Перемещение стейка',
29: 'Эмиссия токена',
30: 'Сжигание токена',
31: 'Создание токена',
32: 'Пересоздание токена',
33: 'Голосование за комиссию',
34: 'Голосование за обновление',
35: 'Создание пула ликвидности'
};
for (let tr of res) {
let amount;
let coin_str = 'coin';
let value_str = 'value';
let type = types[tr.type];
if (tr.type === 1 && tr.data.to === sender.address) {
type = 'Получение';
} else if (tr.type === 2 || tr.type === 3 || tr.type === 4 || tr.type === 23 || tr.type === 24 || tr.type === 25 || tr.type === 26) {
coin_str = 'coin_to_sell'
value_str = 'value_to_sell';
} else if (tr.type === 21 || tr.type === 22 || tr.type === 35) {
  coin_str = 'coin0'
  value_str = 'volume0';
}

if (!tr.data.list) {
  amount = parseFloat(tr.data[value_str]);
  amount += ' ' + tr.data[coin_str].symbol;
  } else {
let sum_amount = 0;
    let coin = '';
for (let el of tr.data.list) {
  if (tr.from === sender.address || el.to === sender.address) {
  sum_amount += parseFloat(el[value_str]);
  coin = el[coin_str].symbol;
}
}
amount = sum_amount;
amount += coin;
}
let get_time = Date.parse(tr.timestamp);
let memo = decodeURIComponent(escape(window.atob(tr.payload)));
memo = prepareContent(memo);
results += `
<tr><td>${date_str(get_time, true, false, true)}</td>
<td><a href="/minter/explorer/block/${tr.height}" target="_blank">${tr.height}</a></td>
<td><a href="/minter/explorer/tx/${tr.hash}" target="_blank">${tr.hash}</a></td>
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
  await getHistory(1);
});