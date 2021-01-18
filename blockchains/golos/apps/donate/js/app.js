var url = document.location.pathname.slice(1).split('/');
var gates = {};
gates.YMRUB = {};
gates.YMPZM = {};
gates.YMRUB.deposit = {
vars: [
  { // Qiwi
    address: {
      name: "Никнейм в Qiwi",
      value: `RICHE387`,
    },
    memo: {
      name: "Примечание",
      value: "golos:" + url[2]
    }
    }, // end Qiwi method
  { // Advcash
  address: {
    name: "Адрес кошелька в Advcash",
    value: `R 9085 0398 0645`,
  },
  memo: {
    name: "Примечание к платежу",
    value: "golos:" + url[2]
  }
  }, // end Advcash method
  { // Payeer
    address: {
      name: "Адрес кошелька в Payeer",
      value: `P9741574`,
    },
    memo: {
      name: "Примечание к платежу",
      value: "golos:" + url[2]
    }
    }
]
};

gates.YMPZM.deposit = {
  vars: [
    {
      address: {
        name: "Адрес кошелька в Prizm",
        value: `PRIZM-5UER-N986-BU24-AXJRL`,
      },
      memo: {
        name: "Примечание к платежу",
        value: "golos:" + url[2]
      }
      }
  ]
  };

async function donateAction(to, amount, token, precision) {
    var q = window.confirm('Вы действительно хотите отправить донат?');
    if (q == true) {
        try {
            let result = await golos.broadcast.donateAsync(posting_key, golos_login, to, `${parseFloat(amount).toFixed(precision)} ${token}`, {app: 'dpos-space', version: 1, comment: `Донат со страницы https://dpos.space${window.location.pathname}`, target: {type: 'personal_donate'}}, []);
            window.alert('Вы отблагодарили пользователя ' + to + ' на ' + amount + ' ' + token + '.');
            await main();
            } catch(e) {
                   window.alert('Ошибка: ' + e);
                 }
            
    }
}

async function getTipBalance(token) {
    let balances = (await golos.api.getAccountsBalancesAsync([golos_login]))[0];
    if (balances && balances[token]) {
        return parseFloat(balances[token].tip_balance);
    } else if (balances && !balances[token] || !balances) {
let tip_balance = parseFloat((await golos.api.getAccountsAsync([golos_login]))[0].tip_balance);
if (tip_balance) {
        return tip_balance;
    }
}
  }

async function main() {
    let assets = await golos.api.getAssetsAsync('');
    let precision = 3;
    if (assets && assets.length > 0) {
        let tokens = '<option value="GOLOS">GOLOS (только при помощи блокчейна Golos)</option>';
        for (let asset of assets) {
            let name = asset.max_supply.split(' ')[1];
if (name === url[3]) precision = asset.precision;
            if (parseFloat(asset.supply) > 0) {
let add_str = '';
    if (!gates[name]) {
add_str = ' (только при помощи блокчейна Golos)';
}
    if (name.indexOf('YM') > -1) {
        view_name = name.slice(2);
    } else {
        view_name = name;
    }
tokens += `<option value="${name}">${view_name}${add_str}</option>`;
}
        }
    $('[name=token]').html(tokens);
    }

    if (url[3]) {
        let view_token = ` ${url[3]}`;
if (url[3].indexOf('YM') > -1) view_token = url[3].slice(2);
    $('.token').html(` ${view_token}`);
    }
    
    if (url[3] && gates[url[3]] && url[4]) {
    $('#deposit_without_golos').css('display', 'block');
        let deposit = gates[url[3]].deposit;
    let res = `<p>Для доната следуйте инструкции ниже.</p>
    `;
    let vars = deposit.vars;
    for (let method of vars) {
      res += '<ul>';
    for (let el in method) {
    res += `<li>${method[el].name}: ${method[el].value} (<input type="button" value="копировать" onclick="navigator.clipboard.writeText('${method[el].value.replace(/<[^>]*>/g, "")}').then(() => {console.log('Successfully copied to clipboard');}).catch(() => {console.log('Copy error');});">)</li>`;
    }
      res += `</ul>`;
    }
    $('#uia_diposit_data').html(res);
}

if (url[4]) {
let tip = await getTipBalance(url[3]);
if (!tip) tip = 0;
$('#tip_balance').html(`${tip} ${url[3]}`);
if (tip < parseFloat(url[4])) {
    $('#donate_action').attr('disabled', true);
    $('#donate_action').html('TIP баланс < суммы доната. <a href="/golos/wallet" target="_blank">В кошелёк</a>');
} else {
    $('#donate_action').attr('disabled', false);
}
}
return {precision}
}

$(document).ready(async function() {
let data = await main();

$('#donate_action').click(async function() {
    await donateAction(url[2], url[4], url[3], data.precision);
});
});