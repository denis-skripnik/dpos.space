var url = document.location.pathname;
var address = url.slice(-42)
if (url.endsWith("/") === true) {
  address = url.slice(-43, -1)
}

   axios.get('/address?address=' + address)
  .then(function (response) {
    // handle success
let balances = '';
for (let token of response.data.result.balances) {
  let balance = token.value / (10**18);
  balance = balance.toFixed(2)
  balances += `<li>${balance} ${token.symbol}</li>`
}
    $('#balances').html(balances);
  })
  .catch(function (error) {
    // handle error
    console.log(error);
  })
  .then(function () {
    // always executed
  });
  
