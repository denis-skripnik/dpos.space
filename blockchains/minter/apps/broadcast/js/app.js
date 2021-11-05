const decodeTx = minterSDK.decodeTx;

        function getKeyByValue(object, value) {
              for (var prop in object) {
                  if (object.hasOwnProperty(prop)) {
                      if (object[prop] === value)
                      return prop;
                  }
              }
          }

  async function generateList(res) {
  var put = '<ul>';
      for (var el in res) {
    if (typeof res[el] == 'object') {
              put +=`<li>${el}: ${await generateList(res[el])}</li>`;
    } else if (typeof res[el] == 'Array') {
              put +=`<li>${el}: ${res[el].join(', ')}</li>`;
        } else {
      if (el === 'coin' || el === 'gasCoin') res[el] = (await minter.getCoinInfo(res[el])).symbol;
      if (el === 'type') res[el] = getKeyByValue(TX_TYPE, res[el]);
              put +=`<li>${el}: ${res[el]}</li>`;
    }
  }
        put += '</ul>'
return put;
  }

  var signatures = [];
  function updateText() {
let result = '';
for (let signature of signatures) {
result += `<li>${signature}</li>`;
}
      if (document.getElementById('out')) document.getElementById('out').innerHTML = '<p>Итоговый список:</p><ol>' + result + '</ol>';
   }
  
  function add() {
   var a = document.getElementById('answer').value;
   if (!a) {
           return alert('Не ввели вариант ответа');
   }
if (signatures.indexOf(a) > -1) {
   return alert('Такой вариант ответа уже есть.');
}
signatures.push(a);

          updateText()
         }
  
  updateText();
  
async function submitMultisigTX(multisigAddress) {
let tx_data = $('[name=tx_data]').val();
let txForMultisig = JSON.parse(tx_data);
  var q = window.confirm('Вы действительно хотите отправить эту транзакцию?');
if (q == true && Object.keys(txForMultisig).length > 0) {
txForMultisig.nonce = await minter.getNonce(multisigAddress);
txForMultisig.signatureType = 2;
txForMultisig.signatureData = {
  multisig: multisigAddress,
  signatures
};
minter.postTx(txForMultisig)
.then(async (txHash) => {
  $.fancybox.open(`<p id="message"><strong>Пожалуйста, подождите. Идёт отправка и проверка доставки транзакции.</strong></p>`);
  await new Promise(r => setTimeout(r, 5500));
  let res = await getTransaction(txHash.hash);
  if (res === true) {
      document.getElementById('message').innerHTML = (`<strong>Ok. Транзакция создана и отправлена: <a href="/minter/explorer/tx/${txHash.hash}" target="_blank">${txHash.hash}</a></strong>`);
    } else {
document.getElementById('message').innerHTML = ('Ошибка. Транзакция отправлена, но не принята.');
}
}).catch(async (error) => {
      const errorMessage = (error.response.data.error.message ? error.response.data.error.message : error.response.error.message)
      throw `Ошибка: ${errorMessage}`;
});
}
}

$(document).ready(async function() {
  $('[name=submit_broadcast]').attr('disabled', true);
  $('[name=tx]').change(async function() {
let tx = $('[name=tx]').val();
if (tx === '') {
      $('#results').css('display', 'none');
      $('#results').html('');
      $('[name=submit_broadcast]').attr('disabled', true);
    } else {
      let res = decodeTx(tx);
$('#results').css('display', 'block');
    var put = await generateList(res);
$('#results').html(`<h2>Содержимое транзакции:</h2>
<code>${put}</code>`);
$('[name=submit_broadcast]').attr('disabled', false);
}
  });

  $('[name=submit_broadcast]').click(function() {
    let tx = $('[name=tx]').val();
    let q = window.confirm('Вы действительно хотите отправить эту транзакцию в блокчейн?');
    if (q == true && tx !== '') {
      minter.postSignedTx(tx)
      .then((res_tx) => {
$('#results').html(`<h2>Результат:</h2>
<p><strong>Транзакция отправлена: <a href="/minter/explorer/tx/${res_tx.hash}">${res_tx.hash}</a></strong></p>`);
      $('[name=tx]').val('');
      $('[name=submit_broadcast]').attr('disabled', true);
    });
    }
  });
});