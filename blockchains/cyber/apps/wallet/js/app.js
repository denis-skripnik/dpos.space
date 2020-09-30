$(function() {
  $("form[name='transfer']").on('change input paste', 'input', function(e) {
    $("#submit_transfer").prop('disabled', !$("#to").val() || !$("#amount").val());
  });
});

async function sendTransfer(to, amount) {
var q = window.confirm('Вы действительно хотите сделать перевод на ' + amount + ' eul?');
if (q == true) {
amount = parseFloat(amount);
try {
let res = await transfer(to, amount);
if (res.result.code === 0) {
  $('#result').html(`<p>Перевод произведён.</p>
<p><a href="https://dpos.space/cyber/explorer/tx/${res.result.hash}" target="_blank">${res.result.hash}</a></p>`);
$('#to').val('');
$('#amount').val('');
} else {
  $('#result').html('Ошибка: ' + res.result.log)
}
} catch(e) {
  $('#result').html('Ошибка: ' + e);
}
} else {
  window.alert('Вы отменили операцию.');
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