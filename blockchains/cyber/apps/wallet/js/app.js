async function sendTransfer(to, amount) {
amount = parseFloat(amount);
try {
let res = await DataTransfer(to, amount);

} catch(e) {
  window.alert('Ошибка: ' + e);
}
}

   axios.get('/account?address="' + sender.address + '"')
  .then(function (response) {
    // handle success
let acc = response.data.result.account;
    let balances = '';
for (let token of acc.coins) {
  let balance = token.amount;
  balances = `${balance} ${token.denom}`;
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

  axios.get('/account_bandwidth?address="' + sender.address + '"')
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

  $(document).ready(function() {
    $('#balances').click(function() {
let amount = $('#balances').html();
amount = parseInt(amount);
$("input[name='amount']").val(amount);
    });
  });