function getBandwidth() {
axios.get('/account_bandwidth?address="' + sender.address + '"')
  .then(function (response) {
    $('#now_address').html(`<a href="https://dpos.space/cyber/profiles/${sender.address}" target="_blank">${sender.address}</a>`);
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
}

async function sendIpfsHashes(hash1, hash2) {
if (hash1.indexOf('/ipfs/') > -1) {
    hash1 = hash1.split('/ipfs/')[1];
}

if (hash2.indexOf('/ipfs/') > -1) {
    hash2 = hash2.split('/ipfs/')[1];
}
try {
    let create_link = await link(hash1, hash2);
console.log(JSON.stringify(create_link));
    window.alert('Ссылка создана успешно.');
    getBandwidth();
} catch(e) {
    window.alert('Ошибка: ' + JSON.stringify(e));
}
}