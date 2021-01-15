var url = document.location.pathname;
var address = url.slice(-42)
if (url.endsWith("/") === true) {
  address = url.slice(-43, -1)
}

async function main() {
  let acc = await getBalance(address);
  let balances = '';
  for (let token of acc) {
    let balance = token.amount / (10**18);
    balance = balance.toFixed(2)
    balances += `<li>${balance} ${token.coin}</li>`
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
  
  async function getHistory(page) {
    try {
      let response = await axios.get('https://explorer-api.minter.network/api/v2/addresses/' + address + '/transactions?page=' + page);
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
  14: 'Редактирование кандидата'
};
const timezoneOffset = (new Date()).getTimezoneOffset() * 60000;
for (let tr of res) {
  let amount;
  let coin_str = 'coin';
  let value_str = 'value';
  let type = types[tr.type];
  if (tr.type === 1 && tr.data.to === address) {
type = 'Получение';
  } else if (tr.type === 2 || tr.type === 3 || tr.type === 4) {
coin_str = 'coin_to_sell'
value_str = 'value_to_sell';
}
  
  if (!tr.data.list) {
    amount = parseFloat(tr.data[value_str]);
    amount += ' ' + tr.data[coin_str].symbol;
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
  
results += `
<tr><td>${date_str(get_time - timezoneOffset, true, false, true)}</td>
<td><a href="https://explorer.minter.network/blocks/${tr.height}" target="_blank">${tr.height}</a></td>
<td><a href="https://explorer.minter.network/transactions/${tr.hash}" target="_blank">${tr.hash}</a></td>
<td>${type}</td>
<td>${amount}</td>
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
         console.log(JSON.stringify(e));
       }
}

$(document).ready(async function() {
  await main();
  await getHistory(1);
});