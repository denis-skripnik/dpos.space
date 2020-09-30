var url = document.location.pathname;
var address = url.slice(-44)
if (url.endsWith("/") === true) {
  address = url.slice(-45, -1)
}

   axios.get('/account?address="' + address + '"')
  .then(function (response) {
    // handle success
let acc = response.data.result.account;
$('#other_data').css('display', 'block');
$('#public_key').html(acc.public_key);
$('#account_number').html(acc.account_number);
    let balances = '';
for (let token of acc.coins) {
  let balance = token.amount;
  balances += `<li class="balance">${balance} ${token.denom}</li>`
}
    $('#balances').html(balances);
  })
  .catch(function (error) {
    // handle error
    console.error(JSON.stringify(error));
  })
  .then(function () {
    // always executed
  });
  
  axios.get('/account_bandwidth?address="' + address + '"')
  .then(function (response) {
    $('#bandwidth_remained').html(response.data.result.remained);
    $('#bandwidth_max_value').html(response.data.result.max_value);
    })
  .catch(function (error) {
    // handle error
    console.error(error);
  })
  .then(function () {
    // always executed
  });