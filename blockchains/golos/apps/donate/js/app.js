var url = document.location.pathname.split('/');
var gates = {};
gates.PRIZM = {};
gates.YMRUB = {};
gates.YMPZM = {};
gates.YMDASH = {};
gates.YMTRX = {};
gates.YMUSDT = {};
gates.YMHIVE = {};
gates.YMSTEEM = {};
gates.YMBTC = {};
gates.YMXMR = {};
gates.YMZEC = {};
gates.VIZUIA = {};

gates.PRIZM.withdraw = {
  account: "exprizm",
  
  get_max: {
    allow: false,
  login: "prizm",
    separator: " / ",
  },
  vars: [
    {
      address: "Адрес в сети PRIZM",
      key: "Публичный ключ"
        }
  ],
  separator: " "
};

gates.YMRUB.withdraw = {
  account: "ecurrex-ymrub",
get_max: {
  allow: true,
login: "ecurrex-ru",
  separator: " / ",
},
  vars: [
    {
      name: "advcash",
      address: "Адрес кошелька Advcash",
    },
    {
      name: "payeer",
      address: "Адрес кошелька Payeer",
    }
  ],
  separator: ":"
};

gates.YMRUB.deposit = {
vars: [
  { // Qiwi
    address: {
      name: "Никнейм в Qiwi",
      value: `RICHE387`,
    },
    memo: {
      name: "Примечание",
      value: "golos:" + golos_login
    }
    }, // end Qiwi method
  { // Advcash
  address: {
    name: "Адрес кошелька в Advcash",
    value: `R 9085 0398 0645`,
  },
  memo: {
    name: "Примечание к платежу",
    value: "golos:" + golos_login
  }
  }, // end Advcash method
  { // Payeer
    address: {
      name: "Адрес кошелька в Payeer",
      value: `P9741574`,
    },
    memo: {
      name: "Примечание к платежу",
      value: "golos:" + golos_login
    }
    }
]
};

gates.YMPZM.withdraw = {
  account: "ecurrex-prizm",
get_max: {
  allow: false,
login: "ecurrex-ru",
  separator: " / ",
},
  vars: [
    {
      name: "",
      address: "Адрес кошелька Prizm",
    }
    ],
  separator: ""
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
        value: "golos:" + golos_login
      }
      }
  ]
  };

  gates.YMDASH.withdraw = {
    account: "ecurrex-dash",
  get_max: {
    allow: false,
  login: "ecurrex-ru",
    separator: " / ",
  },
    vars: [
      {
        name: "",
        address: "Адрес кошелька DASH",
      }
      ],
    separator: ""
  };

  gates.YMDASH.deposit = {
    type: "get_address",
    account: "ecurrex-dash",
    memo: "deposit"
      };

      gates.YMTRX.withdraw = {
        account: "ecurrex-tron",
      get_max: {
        allow: false,
      login: "ecurrex-ru",
        separator: " / ",
      },
        vars: [
          {
            name: "",
            address: "Адрес кошелька Tron",
          }
          ],
        separator: ""
      };
    
      gates.YMTRX.deposit = {
        type: "get_address",
        account: "ecurrex-tron",
        memo: "deposit",
        "text": "От 10 TRX",
          };

          gates.YMUSDT.withdraw = {
            account: "ecurrex-tether",
          get_max: {
            allow: false,
          login: "ecurrex-ru",
            separator: " / ",
          },
            vars: [
              {
                name: "",
                address: "Адрес кошелька Tron",
              }
              ],
            separator: ""
          };
        
          gates.YMUSDT.deposit = {
            type: "get_address",
            account: "ecurrex-tether",
            memo: "deposit",
            "text": "От 10 USDT",
              };

      gates.YMHIVE.withdraw = {
        account: "ecurrex-hive",
      get_max: {
        allow: false
      },
        vars: [
          {
            name: "hive",
            address: "Аккаунт в Hive",
          }
        ],
        separator: ":"
      };
      
      gates.YMHIVE.deposit = {
      vars: [
        {
          address: {
            name: "Аккаунт в Hive",
            value: `ecurrex-ru`,
          },
          memo: {
            name: "Примечание к платежу",
            value: "golos:" + golos_login
          }
          }
      ]
      };

      gates.YMSTEEM.withdraw = {
        account: "ecurrex-steem",
      get_max: {
        allow: false
      },
        vars: [
          {
            name: "steem",
            address: "Аккаунт в Steem",
          }
        ],
        separator: ":"
      };
      
      gates.YMSTEEM.deposit = {
      vars: [
        {
          address: {
            name: "Аккаунт в Steem",
            value: `ecurrex-ru`,
          },
          memo: {
            name: "Примечание к платежу",
            value: "golos:" + golos_login
          }
          }
      ]
      };

      gates.YMBTC.withdraw = {
        account: "ecurrex-bitcoin",
      get_max: {
        allow: false
      },
        vars: [
          {
            name: "bitcoin",
            address: "Bitcoin адрес",
          }
        ],
        separator: ":"
      };
      
      gates.YMBTC.deposit = {
        type: "get_address",
        account: "ecurrex-bitcoin",
        memo: "deposit",
        "text": "От 0.0001 BTC",
      };

      gates.YMXMR.withdraw = {
        account: "ecurrex-monero",
      get_max: {
        allow: false
      },
        vars: [
          {
            name: "monero",
            address: "XMR адрес",
          }
        ],
        separator: ":"
      };
      
      gates.YMXMR.deposit = {
        type: "get_address",
        account: "ecurrex-monero",
        memo: "deposit",
        "text": "От 0.0001 XMR",
      };


      
      gates.YMZEC.deposit = {
        type: "get_address",
        account: "ecurrex-zcash",
        memo: "deposit",
        "text": "От 0.0001 ZEC",
      };

      gates.VIZUIA.deposit = {
  vars: [
    {
      address: {
        name: "Аккаунт в Viz",
        value: `gls.xchng`,
      },
      memo: {
        name: "Примечание к платежу",
        value: "log:" + golos_login
      }
      }
  ]
  };

  async function getDepositAddress(token) {
    let deposit = gates[token].deposit;
    try {
    let accounts = await golos.api.getAccountsAsync([golos_login]);
    let acc = accounts[0];
    if (parseFloat(acc.balance) >= 0.001) {
      let send = await golos.broadcast.transferAsync(active_key, golos_login, deposit.account, "0.001 GOLOS", deposit.memo);
      setInterval(async function() {
        let history = await golos.api.getAccountHistoryAsync(golos_login, -1, 1, {"select_ops":["transfer"]});
        for (let el of history) {
          let data = el[1].op[1];
          if (data.from === deposit.account) {
    $('#uia_deposit_address').html(prepareContent(data.memo));
            return;
          } else {
            $('#uia_deposit_address').html('Ждём получения адреса ' + token + '.');
          }
        }
      }, 5000);
    } else {
      window.alert('Ваш баланс < 0.001 GOLOS');
    }
    } catch(e) {
      await getDepositAddress(token);
      console.error(e);
    }
    }
    
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
    } else if (token === 'GOLOS') {
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
if (deposit.type === 'get_address') {
let notify_text = '';
if (deposit.text) notify_text = `<p><strong>${deposit.text}</strong></p>`;
  res = `<p>Нажмите на кнопку ниже, чтобы получить адрес пополнения.</p>
<div id="uia_deposit_address"><button onclick="getDepositAddress('${token}')">Получить адрес</button></div>
${notify_text}`;

} else {
  res = `<p>Для пополнения баланса следуйте инструкции ниже.</p>
`;
let vars = deposit.vars;
for (let method of vars) {
  res += '<ul>';
for (let el in method) {
res += `<li>${method[el].name}: ${method[el].value} (<input type="button" value="копировать" onclick="navigator.clipboard.writeText('${method[el].value.replace(/<[^>]*>/g, "")}').then(() => {console.log('Successfully copied to clipboard');}).catch(() => {console.log('Copy error');});">)</li>`;
}
  res += `</ul>`;
}
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