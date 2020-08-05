var url = document.location.pathname;
var address = url.slice(-42)
if (url.endsWith("/") === true) {
  address = url.slice(-43, -1)
}

   axios.get('/address?address=' + address)
  .then(function (response) {
    // handle success
let balances = '';
for (let token in response.data.result.balance) {
  let balance = response.data.result.balance[token] / (10**18);
  balances += `<li>${balance} ${token}</li>`
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
  
