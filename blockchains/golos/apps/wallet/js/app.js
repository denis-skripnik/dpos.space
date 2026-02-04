// Автоматически собранные параметры шлюзов из json_metadata ассетов
var gatesAuto = {};

// Возвращает конфиг шлюза для токена: сначала из json_metadata, затем ручной fallback
function getGate(token) {
  if (gatesAuto && gatesAuto[token]) return gatesAuto[token];
  return null;
}


function safeJsonParse(str) {
  try {
    if (!str) return null;
    if (typeof str === 'object') return str;
    return JSON.parse(str);
  } catch(e) {
    return null;
  }
}

function substituteAccount(template) {
  if (!template) return '';
  return String(template).split('<account>').join(golos_login);
}

// Достает symbol из строки max_supply вида "10000000.00 YMRUB"
function symbolFromMaxSupply(max_supply) {
  if (!max_supply) return '';
  let parts = String(max_supply).trim().split(' ');
  return parts.length > 1 ? parts[1] : '';
}

function buildGateFromAsset(asset) {
  if (!asset) return null;
  let symbol = symbolFromMaxSupply(asset.max_supply);
  if (!symbol) return null;

  let meta = safeJsonParse(asset.json_metadata);
  if (!meta) return null;

  let gate = {};
  // Deposit
  if (meta.deposit && meta.deposit.unavailable !== true) {
    let d = meta.deposit;
    gate.deposit = {
      source: 'metadata',
      details: d.details || '',
      to_type: d.to_type || '',
      min_amount: d.min_amount || '',
      fee: d.fee || '',
      // fixed
      to_fixed: d.to_fixed || d.to || '',
      memo_fixed: substituteAccount(d.memo_fixed || ''),
      // api
      to_api: substituteAccount(d.to_api || ''),
      to_transfer: d.to_transfer || '',
      memo_transfer: substituteAccount(d.memo_transfer || ''),
    };
  }

  // Withdrawal
  if (meta.withdrawal && meta.withdrawal.unavailable !== true) {
    let w = meta.withdrawal;
    let ways = Array.isArray(w.ways) ? w.ways : [];
    gate.withdraw = {
      source: 'metadata',
      details: w.details || '',
      min_amount: w.min_amount || '',
      fee: w.fee || '',
      account: w.to || '',
      ways: ways.map(x => ({
        name: x.name || '',
        prefix: x.prefix || '',
        memo: x.memo || '',
        postfix_title: x.postfix_title || '',
        postfix: x.postfix || ''
      }))
    };
  }

  // Если нет ни deposit ни withdrawal - не возвращаем gate
  if (!gate.deposit && !gate.withdraw) return null;
  return { symbol, gate };
}

async function hydrateGatesFromAssets(assets) {
  // assets: массив ассетов (объекты из getAssetsAsync)
  if (!Array.isArray(assets)) return;
  for (let a of assets) {
    let built = buildGateFromAsset(a);
    if (built && built.symbol && built.gate) {
      gatesAuto[built.symbol] = built.gate;
    }
  }
}

async function fetchAssetsBySymbols(symbols) {
  // getAssetsAsync умеет принимать массив symbols
  if (!Array.isArray(symbols) || symbols.length === 0) return [];
  try {
    // Некоторые ноды могут ограничивать размер массива, поэтому батчим
    let out = [];
    let batchSize = 20;
    for (let i = 0; i < symbols.length; i += batchSize) {
      let batch = symbols.slice(i, i + batchSize);
      let res = await golos.api.getAssetsAsync('', batch);
      if (Array.isArray(res)) out = out.concat(res);
    }
    return out;
  } catch(e) {
    console.error('fetchAssetsBySymbols error:', e);
    return [];
  }
}

function buildWithdrawMemoFromMetadata(token) {
  let gate = getGate(token);
  if (!gate || !gate.withdraw || gate.withdraw.source !== 'metadata') return '';
  let idx = parseInt($('select[name=withdraw_uia_method]').val() || '0');
  let ways = gate.withdraw.ways || [];
  let way = ways[idx] || {};
  let prefix = String(way.prefix || '');
  let main = String($('#uia_withdraw_main').val() || '').trim();
  let extra = String($('#uia_withdraw_postfix').val() || '').trim();

  let memo = prefix + main;
  if (extra) memo = memo + ' ' + extra;
  return memo.trim();
}


async function links(tipe, token) {
  $('#actions').html('');
  // actions side panel title
  $('#actions_panel_title').hide().text('');
  if (token === 'GOLOS' && tipe === 'main_balance') {
$('#actions').html(`<li><a data-fancybox class="transfer_modal" data-src="#transfer_modal" href="javascript:;" data-token="${token}" onclick="getTransferTemplates('${token}');">Перевести ${token}</a></li>
<li><a data-fancybox data-src="#to_shares_transfer_modal" href="javascript:;">golos в СГ этого аккаунта</a></li>
<li><a data-fancybox data-src="#golos_diposit_modal" href="javascript:;">Пополнить счёт</a></li>
<li><a data-fancybox data-src="#create_invite_form_modal" href="javascript:;">Создать инвайт-код</a></li>
<li><a href="https://dpos.space/golos/swap/GOLOS" target="_blank">Обменять GOLOS</a></li>
`);
} else if (token === 'GOLOS' && tipe === 'tip_balance') {
  $('#actions').html(`<li><a data-fancybox class="donate_modal" data-src="#donate_modal" href="javascript:;" data-token="${token}" onclick="getDonateTemplates('${token}');">Донат токенами ${token}</a></li>
  <li><a data-fancybox class="transfer_from_tip_modal" data-src="#transfer_from_tip_modal" href="javascript:;" data-token="${token}">Перевести в СГ ${token}</a></li>
`);
} else if (token === 'GOLOS' && tipe === 'claim_balance') {
  $('#actions').html(`<li><a data-fancybox data-src="#accumulative_balance_modal" href="javascript:;">Получить</a></li>
`);
} else if (tipe === 'main_balance' && token === 'GBG') {
  $('#actions').html(`<li><a data-fancybox class="transfer_modal" data-src="#transfer_modal" href="javascript:;" data-token="${token}" onclick="getTransferTemplates('${token}');">Перевести ${token}</a></li>
<li><a href="https://dpos.space/golos/swap/GBG" target="_blank">Обменять GBG</a></li>`);
} else if (tipe === 'main_balance' && token === 'GP') {
  $('#actions').html(`<li><a data-fancybox data-src="#vesting_withdraw_modal" href="javascript:;">Вывод СГ в golos</a></li>
  <li><a data-fancybox class="vesting_delegate_modal" data-src="#vesting_delegate_modal" href="javascript:;">Делегировать СГ</a></li>`);
} else if (token !== 'GOLOS' && token !== 'GP' && token !== 'GBG' && tipe === 'main_balance') {
  $('#actions').html(`<li><a data-fancybox class="transfer_modal" data-src="#transfer_modal" href="javascript:;" data-token="${token}" onclick="getTransferTemplates('${token}');">Перевести ${token}</a></li>
`);
let gate = getGate(token);
if (gate && gate.deposit) {
  $('#actions').append(`<li><a data-fancybox class="uia_deposit_modal" data-src="#uia_deposit_modal" href="javascript:;" data-token="${token}">Пополнить ${token}</a></li>
  `);
}

if (gate && gate.withdraw) {
  $('#actions').append(`<li><a data-fancybox class="uia_withdraw_modal" data-src="#uia_withdraw_modal" href="javascript:;" data-token="${token}">Вывести ${token}</a></li>
  `);
}
$('#actions').append(`<li><a href="https://dpos.space/golos/swap/${token}" target="_blank">Обменять ${token}</a></li>
`);
} else if (token !== 'GOLOS' && token !== 'GP' && token !== 'GBG' && tipe === 'tip_balance') {
  $('#actions').html(`<li><a data-fancybox class="donate_modal" data-src="#donate_modal" href="javascript:;" data-token="${token}" onclick="getDonateTemplates('${token}');">Донат токенами ${token}</a></li>
  <li><a data-fancybox class="transfer_from_tip_modal" data-src="#transfer_from_tip_modal" href="javascript:;" data-token="${token}">Перевести из TIP-баланса ${token}</a></li>
`);
}
  // show side panel title when actions exist
  try {
    const t = String(token || '').trim();
    if ($('#actions').children().length > 0 && t) {
      $('#actions_panel_title').text('Действия: ' + t).show();
    } else {
      $('#actions_panel_title').hide().text('');
    }
  } catch (_) {}

}

var link_state = {};
async function actionsSpoiler(t) {
    let token = $(t).attr('data-token');
    let tipe = $(t).attr('data-tipe');
    style = document.getElementById('actions').style;
    if (!link_state.display || link_state.tipe === tipe && link_state.token === token) {
      style.display = (style.display == 'block') ? 'none' : 'block';
      }
      await links(tipe, token);
      link_state.tipe = tipe;
    link_state.token = token;
    link_state.display = style.display;
  }

async function delegationGolosPower(golos_per_gests, type) {
  let res = false;
  try {
  let result = await golos.api.getVestingDelegationsAsync(golos_login, '', 100, type);
  let user = 'delegatee';
  if (type === 'received') {
    user = 'delegator';
  }
  let list = result.map( data => data[user]);
  res = {all: result, list};
} catch(err) {
    console.error(err);  
  }
return res;
}

async function createCryptMemo(to, memo) {
  let res = memo;
    if (memo[0] === '#') {
  let accounts = await golos.api.getAccountsAsync([to]);
  if (accounts && accounts.length > 0) {
    let acc = accounts[0];
    let to_public_memo_key = acc.memo_key;
    res = golos.memo.encode(active_key,to_public_memo_key,memo);
  }
  }
  return res;
  }

function bind_range(){
	$('input[type=range]').each(function(i){
		if(typeof $(this).attr('data-fixed') !== 'undefined'){
			let fixed_name=$(this).attr('data-fixed');
			let fixed_min=parseInt($(this).attr('min'));
			let fixed_max=parseInt($(this).attr('max'));
			$(this).unbind('change');
			$(this).bind('change',function(){
				if($(this).is(':focus')){
					$('input[name='+fixed_name+']').val($(this).val());
				}
			});
			$('input[name='+fixed_name+']').unbind('change');
			$('input[name='+fixed_name+']').bind('change',function(){
				let fixed_name=$(this).attr('data-fixed');
				let val=parseInt($(this).val());
				if(val>fixed_max){
					val=fixed_max;
				}
				if(val<fixed_min){
					val=fixed_min;
				}
				$(this).val(val);
				$('input[name='+fixed_name+']').val($(this).val());
			});
		}
	});
}

function getUrlVars() {
  var vars = {};
  var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
      vars[key] = value;
  });
  return vars;
}

function pass_gen(){
	let length=100;
	let charset='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+-=_:;.,@!^&*$';
	let ret='';
	for (var i=0,n=charset.length;i<length;++i){
		ret+=charset.charAt(Math.floor(Math.random()*n));
	}
	let wif=golos.auth.toWif('',ret,'')
	return wif;
}

async function mainData() {
let res = false;
try {
  let accounts = await golos.api.getAccountsAsync([golos_login]);
  if (accounts && accounts.length > 0) {
    let acc = accounts[0];
    let props = await golos.api.getDynamicGlobalPropertiesAsync();
    let tvfs = parseFloat(props.total_vesting_fund_steem);
    let tvsh = parseFloat(props.total_vesting_shares);
    let golos_per_gests = 1000000 * tvfs / tvsh;
    
    // Конвертация GESTS в GOLOS POWER
    let gp = parseFloat(acc.vesting_shares) / 1000000 * golos_per_gests;
    gp = gp.toFixed(6);
    gp = parseFloat(gp);
    let received_gp = parseFloat(acc.received_vesting_shares) / 1000000 * golos_per_gests;
    received_gp = received_gp.toFixed(6);
    received_gp = parseFloat(received_gp);
    let delegated_gp = parseFloat(acc.delegated_vesting_shares) / 1000000 * golos_per_gests;
    delegated_gp = delegated_gp.toFixed(6);
    delegated_gp = parseFloat(delegated_gp);
  res = {acc, props, gp, delegated_gp, received_gp, golos_per_gests};
  }
} catch(e) {
  console.log('Ошибка с  балансами или параметрами: ' + e);
}
  return res;
  }

// Настройка фильтра балансов UIA: показывать только токены с ненулевым балансом.
function getBalancesOnlySetting() {
  const raw = localStorage.getItem('wallet_balances_only');
  // По умолчанию - true.
  if (raw === null || raw === undefined) return true;
  return raw === '1' || raw === 'true';
}

function setBalancesOnlySetting(val) {
  localStorage.setItem('wallet_balances_only', val ? '1' : '0');
}

// Получить symbol из строки "1000.000 TOKEN".
function symbolFromAssetField(str) {
  const s = String(str || '').trim();
  const parts = s.split(' ');
  return parts.length >= 2 ? parts[parts.length - 1].trim() : '';
}

// Загрузить список всех UIA ассетов (постранично). Может быть тяжело, поэтому вызывается только
// когда пользователь отключил фильтр "только с балансом".
async function fetchAllAssets(limit = 200) {
  const assetsAll = [];
  let from = '';
  // Защита от зависания UI, если ассетов слишком много.
  const hardCap = 5000;
  for (let page = 0; page < 1000; page++) {
    const chunk = await golos.api.getAssetsAsync('', [], from, String(limit), 'by_symbol_name');
    if (!chunk || chunk.length === 0) break;
    for (const a of chunk) {
      assetsAll.push(a);
      if (assetsAll.length >= hardCap) return assetsAll;
    }
    // Переходим к следующей странице.
    const last = chunk[chunk.length - 1];
    const lastSymbol = symbolFromAssetField(last && last.max_supply);
    if (!lastSymbol) break;
    // "from" в большинстве реализаций понимается как "начиная с", поэтому сдвигаем на следующий символ.
    // Чтобы избежать дублей, будем фильтровать по symbol на стороне клиента.
    from = lastSymbol;
    if (chunk.length < limit) break;
  }
  return assetsAll;
}

  async function loadBalances() {
// Инициализируем чекбокс один раз.
try {
  const $cb = $('#balances_only');
  if ($cb && $cb.length && !$cb.data('inited')) {
    $cb.data('inited', true);
    $cb.prop('checked', getBalancesOnlySetting());
    $cb.on('change', async function() {
      setBalancesOnlySetting($(this).prop('checked'));
      await loadBalances();
    });
  }
} catch(e) {
  // ignore
}

let main_data =await mainData();
    if (main_data !== false) {
let {acc, props, gp, delegated_gp, received_gp, golos_per_gests} = main_data;
      let tokens = [];
  tokens.push({name: 'GOLOS', main_balance: parseFloat(acc.balance), tip_balance: parseFloat(acc.tip_balance), claim_balance: parseFloat(acc.accumulative_balance)});
  tokens.push({name: 'GBG', main_balance: parseFloat(acc.sbd_balance)});
  tokens.push({name: 'GP', main_balance: parseFloat(gp)});
  tokens.push({name: 'DELEGATED_GP', main_balance: parseFloat(delegated_gp)});
  tokens.push({name: 'RECEIVED_GP', main_balance: parseFloat(received_gp)});
  // UIA балансы пользователя
  const accounts_balances = await golos.api.getAccountsBalancesAsync([golos_login]);
  const balancesOnly = getBalancesOnlySetting();
  let assetsAll = null; // used in 'all tokens' mode for json_metadata hydration

  // Карта балансов UIA по symbol
  const uiaBySymbol = {};
  if (accounts_balances && accounts_balances.length > 0) {
    const uias = accounts_balances[0] || {};
    for (const symbol in uias) {
      const b = uias[symbol] || {};
      const main = parseFloat(b.balance || 0) || 0;
      const tip = parseFloat(b.tip_balance || 0) || 0;
      uiaBySymbol[symbol] = { main, tip };
    }
  }

  if (balancesOnly) {
    // В режиме "только с балансом" показываем UIA только если есть ненулевой main или tip.
    for (const symbol in uiaBySymbol) {
      const b = uiaBySymbol[symbol];
      if ((b.main || 0) !== 0 || (b.tip || 0) !== 0) {
        tokens.push({ name: symbol, main_balance: b.main, tip_balance: b.tip });
      }
    }
  } else {
    // В режиме "все токены" показываем все UIA ассеты в системе, подставляя баланс пользователя.
    // Это может быть долго и дать большую таблицу.
    assetsAll = await fetchAllAssets(200);
    const seen = new Set();
    for (const a of (assetsAll || [])) {
      const symbol = symbolFromAssetField(a && a.max_supply);
      if (!symbol) continue;
      if (seen.has(symbol)) continue;
      seen.add(symbol);
      const b = uiaBySymbol[symbol] || { main: 0, tip: 0 };
      tokens.push({ name: symbol, main_balance: b.main, tip_balance: b.tip });
    }
  }


  // Обновляем конфиги шлюзов из json_metadata (deposit/withdrawal)
  try {
    gatesAuto = {};
    // UIA символы, которые сейчас выводятся в таблице
    const skip = new Set(['GOLOS','GBG','GP','DELEGATED_GP','RECEIVED_GP']);
    const uiaSymbolsInTable = tokens.map(t => t.name).filter(s => !skip.has(s));
    if (balancesOnly) {
      const assetsForTable = await fetchAssetsBySymbols(uiaSymbolsInTable);
      await hydrateGatesFromAssets(assetsForTable);
    } else {
      // В режиме "все токены" metadata уже получены в fetchAllAssets
      // Важно: hydrateGatesFromAssets ждёт именно массив ассетов
      // assets переменная есть выше в этой ветке, но может отсутствовать при ошибке
      if (assetsAll && assetsAll.length) {
        await hydrateGatesFromAssets(assetsAll);
      }
    }
  } catch(e) {
    console.error('hydrate gates error:', e);
  }

let balances_table = '';
    for (let token of tokens) {
      let name = token.name;
      if (token.name === 'DELEGATED_GP') {
        name = 'делегированной другим СГ';
        balances_table += `<tr>
<td><a data-fancybox class="modal_delegated_vesting_shares" data-src="#modal_delegated_vesting_shares" href="javascript:;" title="Клик для открытия списка"><span id="max_main_${token.name}">${token.main_balance}</span> ${name}</a></td>
<td></td>
</tr>`;
      } else if (token.name === 'RECEIVED_GP') {
        name = 'полученной делегированием СГ';
        balances_table += `<tr>
<td><a data-fancybox class="modal_received_vesting_shares" data-src="#modal_received_vesting_shares" href="javascript:;" title="клик для открытия списка"><span id="max_main_${token.name}">${token.main_balance}</span> ${name}</a></td>
<td></td>
</tr>`;
      } else {
        if (token.name === 'GP') name = 'СГ';
        balances_table += `<tr>
<td><a class="spoiler" data-tipe="main_balance" data-token="${token.name}" onclick="actionsSpoiler(this);" title="Клик для выбора действия"><span id="max_main_${token.name}">${token.main_balance}</span> ${name}</a></td>`;
        if (token.tip_balance !== undefined && token.tip_balance !== null && token.tip_balance !== 0 && token.claim_balance) {
          balances_table += `<td><a class="spoiler" data-tipe="tip_balance" data-token="${token.name}" onclick="actionsSpoiler(this);" title="Клик для выбора действия"><span id="max_tip_${token.name}">${token.tip_balance}</span> ${token.name}</a> (<a class="spoiler"data-tipe="claim_balance" data-token="${token.name}" onclick="actionsSpoiler(this);" title="Клик для выбора действия"><span id="max_claim_${token.name}">${token.claim_balance}</span> ${name} в CLAIM</a>)</td>
        `;
        } else if (token.tip_balance !== undefined && token.tip_balance !== null && token.tip_balance !== 0 && !token.claim_balance) {
          balances_table += `<td><a class="spoiler"data-tipe="tip_balance" data-token="${token.name}" onclick="actionsSpoiler(this);" title="Клик для выбора действия"><span id="max_tip_${token.name}">${token.tip_balance}</span> ${name}</a></td>
        `;
        } else {
          balances_table += `<td></td>
        `;
        }
        balances_table += `</tr>`;
      }
}
$('#balances').html(balances_table);

    }
}

function accountHistoryCompareDate(a, b)
{
	if(a[1].timestamp > b[1].timestamp)
	{
		return -1;
	}
	else{
		return 1;
	}
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

function getTransferTemplates(token) {
  $('#select_transfer_template').html('<option value="">Выберите шаблон (данные будут установлены в поля при выборе)</option>');
  $('#select_transfer_template').append(`<option value="me" data-to="${golos_login}" data-memo="" data-in="to_tip">На свой аккаунт в TIP-баланс</option>
`);
  
if (token === 'GOLOS') {
  $('#select_transfer_template').append(`<option value="rudex" data-to="rudex" data-memo="" data-in="to_balance">На Rudex (memo берите на бирже)</option>
  `);
}

  let transfer_templates = JSON.parse(localStorage.getItem(token + '_transfer_templates'));
 if (transfer_templates && transfer_templates.length > 0) {
  let template_count = 1;
  for (let template of transfer_templates) {
$('#select_transfer_template').append(`<option value="${template_count}" data-to="${template.to}" data-memo="${template.memo}" data-in="${template.in}">${template.name}</option>
`);
template_count++;
}
 }
}

function getDonateTemplates(token) {
  $('#select_donate_template').html('<option value="">Выберите шаблон (данные будут установлены в поля при выборе)</option>');
  if (token === 'GOLOS') {
    $('#select_donate_template').append(`<option value="tiptok" data-to="tiptok" data-memo="">Перевод с TIP-баланса в ликвид через tiptok (не относится к создателю dpos.space)</option>
    <option value="ecurrex-t2g" data-to="ecurrex-t2g" data-memo="">Перевод с TIP-баланса в ликвид через ecurrex-t2g (не относится к создателю dpos.space)</option>
    `);
  }
  
  let donate_templates = JSON.parse(localStorage.getItem(token + '_donate_templates'));
 if (donate_templates && donate_templates.length > 0) {
  let template_count = 1;
  for (let template of donate_templates) {
$('#select_donate_template').append(`<option value="${template_count}" data-to="${template.to}" data-memo="${template.memo}">${template.name}</option>
`);
template_count++;
}
 }
}

var memo_key = current_user.memo;
var memo_window = true;
function prepareContent(text) {
  try {
    if (text && text.length > 0 && text[0] === '#') {
try {
  text = golos.memo.decode(active_key,text);
  text = text.slice(1);
} catch(e) {
  if (!memo_key && memo_window === true) memo_key = window.prompt('Введите Memo ключ. Он будет сохранён.');
  if (!memo_key) {
  memo_window = false;
} else if (memo_key && memo_key !== '') {
current_user.memo = memo_key;
localStorage.setItem('golos_current_user', JSON.stringify(current_user));
  for (let user of users) {
    if (user.login === golos_login) {
      user.memo_key = memo_key;
          }
  }
localStorage.setItem('golos_users', JSON.stringify(users));
  text = golos.memo.decode(memo_key,text);
text = text.slice(1)
}

}
      }
    return text.replace(/[^=][^""][^"=\/](https?:\/\/[^" <>\n]+)/gi, data => {
      const link = data.slice(3);
        if(/(jpe?g|png|svg|gif)$/.test(link)) return `${data.slice(0,3)} <img src="${link}" alt="" /> `
        if(/(vimeo)/.test(link)) return `${data.slice(0,3)} <iframe src="${link}" frameborder="0" allowfullscreen></iframe> `;
        if(/(youtu)/.test(link)) return `${data.slice(0,3)} <iframe src="${link.replace(/.*v=(.*)/, 'https://www.youtube.com/embed/$1')}" frameborder="0" allowfullscreen></iframe> `;
        return `${data.slice(0,3)} <a href="${link}">${link}</a> `
      }).replace(/ (@[^< \.,]+)/gi, user => ` <a href="/golos/profiles/${user.trim().slice(1)}">${user.trim()}</a>`)
  } catch(e) {
    return text;
  }
 }

const walletDataSettings = {
	limit: 100,
	limit_max: 10000,
	from: -1,
  get isFirstRequest() {
		return this.from === -1;
	},
  buttonId: 'wallet-data-button',
};

async function thisAccountHistory(type) {
    // История переводов:
    jQuery("#wallet_transfer_history").css("display", "block");

    const result = [];
    let isCompleted = false;
    let isEnd = false;
    let isValidElement;
  
    const {limit, limit_max, buttonId} = walletDataSettings;

    while (! isCompleted && ! isEnd) {
      let {from, isFirstRequest} = walletDataSettings;
      let limitReal = (isFirstRequest || limit_max <= from) ? limit_max : from;
 if (type === 'filtr') {
   from = -1;
   limitReal = 10000;
  }

 const data = await golos.api.getAccountHistoryAsync(golos_login, from, limitReal, JSON.parse(localStorage.getItem('wallet_history_filtr')));
  data.sort(accountHistoryCompareDate);
      for (const operation of data) {
        const op = operation[1].op;
        isValidElement = (op[1].from && op[1].to && op[1].amount) ||
        op[0] === 'transfer' ||
        op[0] === 'transfer_to_vesting' ||
        op[0] === 'transfer_from_tip' ||
        op[0] === 'transfer_to_tip' ||
        op[0] === 'donate' ||
        op[0] === 'claim' ||
        op[0] === 'delegate_vesting_shares' ||
        op[0] === 'delegate_vesting_shares_with_interest' ||
        op[0] === 'delegation_reward' ||
        op[0] === 'curation_reward' ||
        op[0] === 'author_reward' ||
        op[0] === 'comment_benefactor_reward' ||
        op[0] === 'producer_reward' ||
        op[0] === 'fill_order';
  
      if (isValidElement) {
        result.push(operation);
  
        if (result.length === limit + 1) {
          isCompleted = true;
          break;
        }
      }
    }
  
    if (! isCompleted) {
      if (data.length < limitReal + 1) {
        isEnd = true;
      } else {
        const lastElement = data[data.length - 1];
  
        walletDataSettings.from = lastElement[0];
  
        if (isValidElement) {
          result.pop();
        }
      }
    }
  }
  
  if (isEnd) {
    const button = document.getElementById(buttonId);
    if (button) {
      button.remove();
    }
  } else {
    const lastElement = result.pop();
  
    walletDataSettings.from = lastElement[0];
  }
  
  appendWalletData(result);
}

function appendWalletData(items) {
  golos.api.getDynamicGlobalProperties(function(error, res) {
    if (!error) {
    let tvfs = parseFloat(res.total_vesting_fund_steem);
    let tvsh = parseFloat(res.total_vesting_shares);
    let golos_per_gests = 1000000 * tvfs / tvsh;

  const timezoneOffset = (new Date()).getTimezoneOffset() * 60000;

items.forEach(item => {

  var get_time = Date.parse(item[1].timestamp);
  var transfer_datetime = `<a href="https://dpos.space/golos/explorer/tx/${item[1].trx_id}" target="_blank">${date_str(get_time - timezoneOffset, true, false, true)}</a>`

  var op = item[1].op;
  if (op[0] === 'transfer' || op[0] === 'claim' || op[0] === 'transfer_to_tip' || op[0] === 'donate') {
    var from = op[1].from;
    var to = op[1].to;
    var amount = op[1].amount;
      var memo = '';
      if (op[0] === 'transfer') memo = prepareContent(op[1].memo);
      if (op[0] === 'claim' && op[1]['to_vesting'] === true) memo = 'Получение своих начислений на СГ.';
      if (op[0] === 'claim' && op[1]['to_vesting'] === false) memo = 'Получение своих начислений в TIP-баланс.';
      if (op[0] === 'transfer_to_tip') memo = 'Перевод в TIP баланс. ' + op[1]['memo'];
      if (op[0] === 'donate') {
let metadata = JSON.parse(item[1].json_metadata);
        if (metadata['referrer'] === golos_login && golos_login !== from) {
          from = op[1].to;
          to = golos_login;
          amount = metadata.referrer_interest;
          memo = 'Процент от доната в адрес вашего реферала';
        } else {
          memo = 'Донат';
        }
        if (op[1]['memo']['comment']) {
          memo += ', заметка: ' + prepareContent(op[1]['memo']['comment']);
        }
        if (op[1]['memo']['target'] && op[1]['memo']['target']['author'] && op[1]['memo']['target']['permlink']) {
  memo += `, <a href="https://golos.id/@${op[1]['memo']['target']['author']}/${op[1]['memo']['target']['permlink']}" target="_blank">@${op[1]['memo']['target']['author']}/${op[1]['memo']['target']['permlink']}</a>`;
}
      }
      jQuery("#transfer_history_tbody").append('<tr class="filtered ' + from + '"><td>' + transfer_datetime + '</td>\
<td><a href="/golos/profiles/' + from + '" target="_blank">@' + from + '</a></td>\
<td><a href="/golos/profiles/' + to + '" target="_blank">@' + to + '</a></td>\
<td>' + amount + '</td>\
<td>' + memo + '</td>\
</tr>');
  } else if (op[0] === 'transfer_to_vesting' || op[0] === 'transfer_from_tip') {
  var from = op[1].from;
  var to = op[1].to;
  var amount = op[1].amount;
    var memo = 'Перевод в СГ';
  jQuery("#transfer_history_tbody").append('<tr class="filtered ' + from + '"><td>' + transfer_datetime + '</td>\
<td><a href="/golos/profiles/' + from + '" target="_blank">@' + from + '</a></td>\
<td><a href="/golos/profiles/' + to + '" target="_blank">@' + to + '</a></td>\
<td>' + amount + '</td>\
<td>' + memo + '</td>\
</tr>');
} else if (op[0] === 'delegate_vesting_shares') {
  var from = op[1].delegator;
  var to = op[1].delegatee;
  var amount = parseFloat(op[1].vesting_shares) / 1000000 * golos_per_gests;
    amount = amount.toFixed(6) + ' СГ';
  var memo = 'Делегирование Силы Голоса.';
  jQuery("#transfer_history_tbody").append('<tr class="filtered ' + from + '"><td>' + transfer_datetime + '</td>\
<td><a href="/golos/profiles/' + from + '" target="_blank">@' + from + '</a></td>\
<td><a href="/golos/profiles/' + to + '" target="_blank">@' + to + '</a></td>\
<td>' + amount + '</td>\
<td>' + memo + '</td>\
</tr>');
} else if (op[0] === 'delegate_vesting_shares_with_interest') {
  var from = op[1].delegator;
  var to = op[1].delegatee;
  var amount = parseFloat(op[1].vesting_shares) / 1000000 * golos_per_gests;
    amount = amount.toFixed(6) + ' СГ';
  var interest_rate = op[1].interest_rate;
    var memo = 'Делегирование Силы Голоса с возвратом ' + interest_rate/100 + '% от кураторских.';
  jQuery("#transfer_history_tbody").append('<tr class="filtered ' + from + '"><td>' + transfer_datetime + '</td>\
<td><a href="/golos/profiles/' + from + '" target="_blank">@' + from + '</a></td>\
<td><a href="/golos/profiles/' + to + '" target="_blank">@' + to + '</a></td>\
<td>' + amount + '</td>\
<td>' + memo + '</td>\
</tr>');
} else if (op[0] === 'delegation_reward') {
  var from = op[1].delegator;
  var to = op[1].delegatee;
  var amount = parseFloat(op[1].vesting_shares) / 1000000 * golos_per_gests;
    amount = amount.toFixed(6) + ' СГ';
  var payout_strategy = op[1].payout_strategy;
  var payout_strategy_str = '';
  if (payout_strategy === 'to_delegator') {
    payout_strategy_str = 'делегатору';
  } else {
    payout_strategy_str = 'делегируемому';
  }
  var memo = 'Награда с делегирования Силы Голоса. Направление: ' + payout_strategy_str + '.';
  jQuery("#transfer_history_tbody").append('<tr class="filtered ' + from + '"><td>' + transfer_datetime + '</td>\
<td><a href="/golos/profiles/' + from + '" target="_blank">@' + from + '</a></td>\
<td><a href="/golos/profiles/' + to + '" target="_blank">@' + to + '</a></td>\
<td>' + amount + '</td>\
<td>' + memo + '</td>\
</tr>');
} else if (op[0] === 'curation_reward') {
    var author = op[1].comment_author;
    var permlink = op[1].comment_permlink;
    var curator = op[1].curator;
    var reward = parseFloat(op[1].reward) / 1000000 * golos_per_gests;
    reward = reward.toFixed(6) + ' СГ';
    var memo = 'Кураторская награда за пост или комментарий <a href="https://golos.id/@' + author + '/' + permlink + '" target="_blank">https://golos.id/@' + author + '/' + permlink + '</a>';
    jQuery("#transfer_history_tbody").append('<tr class="filtered_curation_reward"><td>' + transfer_datetime + '</td>\
<td><a href="/golos/profiles/' + author + '" target="_blank">@' + author + '</a></td>\
<td><a href="/golos/profiles/' + curator + '" target="_blank">@' + curator + '</a></td>\
<td>' + reward + '</td>\
<td>' + memo + '</td>\
</tr>');
  } else if (op[0] === 'author_reward') {
    var from = 'пул golos';
    var author = op[1].author;
    var permlink = op[1].permlink;
var gbg_payout = op[1].sbd_payout;
var golos_payout = op[1].steem_payout;
var vesting_payout = parseFloat(op[1].vesting_payout) / 1000000 * golos_per_gests;
vesting_payout = vesting_payout.toFixed(6) + ' СГ';
    var memo = 'Авторская награда за пост или комментарий <a href="https://golos.id/@' + author + '/' + permlink + '" target="_blank">https://golos.id/@' + author + '/' + permlink + '</a>';
    jQuery("#transfer_history_tbody").append('<tr class="filtered_author_reward"><td>' + transfer_datetime + '</td>\
<td>' + from + '</td>\
<td><a href="/golos/profiles/' + author + '" target="_blank">@' + author + '</a></td>\
<td>' + gbg_payout + ', ' + golos_payout + ' и ' + vesting_payout + '</td>\
<td>' + memo + '</td>\
</tr>');
  } else if (op[0] === 'comment_benefactor_reward') {
    var author = op[1].author;
    var permlink = op[1].permlink;
    var benefactor = op[1].benefactor;
    var vesting_payout = parseFloat(op[1].reward) / 1000000 * golos_per_gests;
    vesting_payout = vesting_payout.toFixed(6) + ' СГ';
    var memo = 'Бенефициарская награда за пост или комментарий <a href="https://golos.id/@' + author + '/' + permlink + '" target="_blank">https://golos.id/@' + author + '/' + permlink + '</a>';
    jQuery("#transfer_history_tbody").append('<tr class="filtered_content_benefactor_reward"><td>' + transfer_datetime + '</td>\
<td><a href="/golos/profiles/' + author + '" target="_blank">@' + author + '</a></td>\
<td><a href="/golos/profiles/' + benefactor + '" target="_blank">@' + benefactor + '</a></td>\
<td>' + vesting_payout + '</td>\
<td>' + memo + '</td>\
</tr>');
  } else if (op[0] === 'producer_reward') {
    var from = 'пул golos';
    var witness = op[1].producer;
    var shares = parseFloat(op[1].vesting_shares) / 1000000 * golos_per_gests;
    shares = shares.toFixed(6) + ' СГ';
    var memo = 'Награда делегата.';
    jQuery("#transfer_history_tbody").append('<tr class="filtered_witness_reward"><td>' + transfer_datetime + '</td>\
<td>' + from + '</td>\
<td><a href="/golos/profiles/' + witness + '" target="_blank">@' + witness + '</a></td>\
<td>' + shares + '</td>\
<td>' + memo + '</td>\
</tr>');
} else if (op[0] === 'fill_order') {
  var from = op[1].current_owner;
  var to = op[1].open_owner;
var current_pays = op[1].current_pays.split(' ');
var open_pays = op[1].open_pays.split(' ');
  var fee_amount = op[1].current_trade_fee;
var price = parseFloat(current_pays[0]) / parseFloat(open_pays[0]) + `${current_pays[1]} / ${open_pays[1]}`;
var memo = `Комиссия ${fee_amount}`;
  jQuery("#transfer_history_tbody").append(`<tr class="filtered_witness_reward"><td>${transfer_datetime}</td>
<td><a href="/golos/profiles/${from}" target="_blank">@${from}</a></td>
<td><a href="/golos/profiles/${to}" target="_blank">@${to}</a></td>
<td>Отдано ${current_pays}, получено ${open_pays}</td>
<td>${memo}</td>
</tr>`);
}

});
}
});
}

function createFiltr() {
  $('#transfer_history_tbody').html('');
  let direction = $('#direction').val();
  var gr = document.getElementsByName('ops');
  var select_ops = [];
  for(var i=0; i<gr.length; i++)
    if (gr[i].checked) {
      select_ops.push(gr[i].value);
    }
        if (direction !== '' && select_ops.length > 0) {
    let query = {direction, select_ops};
    localStorage.setItem('wallet_history_filtr', JSON.stringify(query));
  } else if (direction !== '' && select_ops.length === 0) {
          let query = {direction};
          localStorage.setItem('wallet_history_filtr', JSON.stringify(query));
        } else if (direction === '' && select_ops.length > 0) {
          let query = {select_ops};
          localStorage.setItem('wallet_history_filtr', JSON.stringify(query));
        } else if (direction === '' && select_ops.length === 0) {
          localStorage.removeItem('wallet_history_filtr')
        }
        thisAccountHistory('filtr');
}

async function changeWithdrawUIASelect(value) {
  let token = $('.uia_withdraw_modal_token').html();
  let gate = getGate(token);
  if (!gate || !gate.withdraw) return;

  // Очищаем только динамические поля, оставляя сверху описание/минимумы/комиссию
  if (!$('#uia_withdraw_fields_dynamic').length) {
    $('#fields_uia_withdraw').append('<div id="uia_withdraw_fields_dynamic"></div>');
  }
  $('#uia_withdraw_fields_dynamic').html('');
  $('#max_uia_withdraw_amount').html($('#max_main_' + token).html());

  // Метаданные из json_metadata
  if (gate.withdraw.source === 'metadata') {
    let ways = gate.withdraw.ways || [];
    if (ways.length === 0) {
      $('#fields_uia_withdraw').append('<p>Нет доступных способов вывода.</p>');
      return;
    }

    // Рендер селекта
    if (ways.length > 1) {
      $('#uia_withdraw_fields_dynamic').append('<select name="withdraw_uia_method"></select>');
      ways.forEach((w, i) => {
        $('select[name=withdraw_uia_method]').append(`<option value="${i}">${w.name || ('Способ ' + (i + 1))}</option>`);
      });
      $('select[name=withdraw_uia_method]').val(String(parseInt(value || '0')));
      $('select[name=withdraw_uia_method]').off('change').on('change', function() {
        changeWithdrawUIASelect(this.value);
      });
    } else {
      // один способ - селект не нужен, но чтобы buildWithdrawMemoFromMetadata работал, создаем скрытый селект
      $('#uia_withdraw_fields_dynamic').append('<select name="withdraw_uia_method" style="display:none"></select>');
      $('select[name=withdraw_uia_method]').append('<option value="0">0</option>');
      $('select[name=withdraw_uia_method]').val('0');
    }

    let idx = parseInt($('select[name=withdraw_uia_method]').val() || '0');
    let way = ways[idx] || {};

    // Поля ввода
    $('#uia_withdraw_fields_dynamic').append(`
      <p><label for="uia_withdraw_main">${way.memo || 'Данные для вывода'}:</label></p>
      <p><input type="text" id="uia_withdraw_main" placeholder="${way.memo || ''}" class="action_uia_withdraw_memo" value=""></p>
    `);

    if (way.postfix || way.postfix_title) {
      let ph = way.postfix || way.postfix_title || '';
      let title = way.postfix_title || 'Дополнительно';
      $('#uia_withdraw_fields_dynamic').append(`
        <p><label for="uia_withdraw_postfix">${title}:</label></p>
        <p><input type="text" id="uia_withdraw_postfix" placeholder="${ph}" class="action_uia_withdraw_memo" value=""></p>
      `);
    }

    // Служебно: заполняем to
    $('#action_uia_withdraw_to').val(gate.withdraw.account || '');
    return;
  }
}

async function fetchDepositAddressByAsset(asset, login) {
  const url = `/golos/api/uia-deposit?asset=${encodeURIComponent(asset)}&login=${encodeURIComponent(login)}&ts=${Date.now()}`;

  let r;
  try {
    r = await fetch(url, { credentials: "same-origin", cache: "no-store" });
  } catch (e) {
    return {
      ok: false,
      address: "",
      memo: "",
      error: { code: "network_error", message: "network error", status: 0 }
    };
  }

  const data = await r.json().catch(() => ({}));

  // Если PHP всегда отдает JSON вида {ok:true|false,...}, то r.ok можно не использовать.
  // Но оставим как fallback.
  if (!r.ok && !data) {
    return {
      ok: false,
      address: "",
      memo: "",
      error: { code: "http_error", message: "request failed", status: r.status || 0 }
    };
  }

  // Новый формат: {ok:true,address,memo?}
  if (data && data.ok === true) {
    const address = (typeof data.address === "string") ? data.address.trim() : "";
    const memo = (typeof data.memo === "string") ? data.memo.trim() : "";
    return { ok: !!address, address, memo, error: address ? null : { code: "empty_address", message: "empty address", status: 200 } };
  }

  // Новый формат: {ok:false,error:{...}}
  if (data && data.ok === false && data.error) {
    const e = data.error || {};
    return {
      ok: false,
      address: "",
      memo: "",
      error: {
        code: String(e.code || "unknown"),
        message: String(e.message || "unknown error"),
        status: Number(e.status || 0),
        curl_errno: e.curl_errno ? Number(e.curl_errno) : undefined
      }
    };
  }

  // Старый формат (на случай если PHP где-то еще старый)
  if (data && typeof data.address === "string" && data.address.trim()) {
    return { ok: true, address: data.address.trim(), memo: (typeof data.memo === "string" ? data.memo.trim() : ""), error: null };
  }

  return { ok: false, address: "", memo: "", error: { code: "no_data", message: "no data", status: r.status || 0 } };
}

async function getDepositAddress(token) {
  let gate = getGate(token);
  let deposit = gate && gate.deposit ? gate.deposit : null;
  if (!deposit) { window.alert('Нет данных для пополнения ' + token + '.'); return; }

  // API-адрес (to_type: api)
if (deposit.to_type === 'api') {
  const renderError = (info) => {
    const code = info?.error?.code || "";
    const status = info?.error?.status || 0;

    let msg = 'Адрес пополнения недоступен: API не ответил или шлюз временно закрыт. Повторите попытку. Если несколько попыток подряд не дадут результата, скорее всего, пополнение для этого токена сейчас недоступно.';

    // Более точные сообщения
    if (code === "deposit_unavailable") {
      msg = "Пополнение для этого токена отключено (шлюз закрыт).";
    } else if (code === "no_deposit_meta") {
      msg = "Для этого токена нет данных о пополнении (deposit metadata отсутствует).";
    } else if (code === "unsupported_to_type") {
      msg = "Пополнение для этого токена не через API (не поддерживается автоматически).";
    } else if (code === "blocked_self_domain" || code === "scheme_not_allowed" || code === "port_not_allowed" || code === "dns_failed") {
      msg = "Запрос адреса заблокирован правилами безопасности сервера.";
    } else if (code === "upstream_http" && (status === 502 || status === 503)) {
      msg = `Шлюз временно недоступен (ошибка ${status}).`;
    } else if (code === "upstream_no_address" || code === "empty_address") {
      msg = "Адрес пополнения недоступен: API не вернул адрес или шлюз временно закрыт.";
    } else if (code === "rpc_failed") {
      msg = "Не удалось получить метаданные токена: RPC временно недоступен.";
    } else if (code === "network_error") {
      msg = "Сетевой сбой при запросе адреса. Повторите попытку.";
    }

    let html = '';
    html += `<p>${msg}</p>`;
    html += `<p><input type="button" value="Повторить" onclick="getDepositAddress('${token}');"></p>`;
    $('#uia_deposit_address').html(html);
  };

  const run = async () => {
    $('#uia_deposit_address').html('Запрашиваем адрес...');

    const info = await fetchDepositAddressByAsset(token, golos_login);

    if (!info.ok || !info.address) {
      renderError(info);
      return;
    }

    const addr = String(info.address || '').trim();
    const mm = String(info.memo || '').trim();

    let html = '';
    html += '<ul>';

    // JSON.stringify безопасно экранирует строку для вставки в onclick
    html += `<li>Адрес для пополнения: ${addr} (<input type="button" value="копировать" onclick="navigator.clipboard.writeText('${addr}').catch(()=>{});">)</li>`;

    if (mm) {
      html += `<li>Memo: ${mm} (<input type="button" value="копировать" onclick="navigator.clipboard.writeText('${mm}').catch(()=>{});">)</li>`;
    }

        html += '</ul>';
    $('#uia_deposit_address').html(html);
  };

  try {
    await run();
  } catch (e) {
    console.error('deposit api error', e);
    renderError({ ok: false, error: { code: "js_exception", message: String(e?.message || e), status: 0 } });
  }

  return;
}


  // Альтернативный способ через перевод (если указан to_transfer + memo_transfer) (если указан to_transfer + memo_transfer)
  if (deposit.to_transfer && deposit.memo_transfer) {
    let q = window.confirm('Шлюз требует запрос адреса через перевод 0.001 GOLOS. Отправить?');
    if (!q) return;
    try {
      let accounts = await golos.api.getAccountsAsync([golos_login]);
      let acc = accounts[0];
      if (parseFloat(acc.balance) < 0.001) {
        window.alert('Ваш баланс < 0.001 GOLOS');
        return;
      }
      await golos.broadcast.transferAsync(active_key, golos_login, deposit.to_transfer, '0.001 GOLOS', deposit.memo_transfer);
      $('#uia_deposit_address').html('Ждём получения адреса...');
      let timer = setInterval(async function() {
        try {
          let history = await golos.api.getAccountHistoryAsync(golos_login, -1, 10, { select_ops: ['transfer'] });
          for (let el of history) {
            let data = el[1].op[1];
            if (data.from === deposit.to_transfer) {
              clearInterval(timer);
              $('#uia_deposit_address').html(prepareContent(data.memo));
              return;
            }
          }
        } catch(_) {}
      }, 5000);
    } catch (e) {
      console.error(e);
      window.alert('Ошибка запроса адреса.');
    }
    return;
  }

  window.alert('Для этого токена адрес пополнения не поддерживается автоматически.');
}

$(document).ready(async function() {
  let main_data =await mainData();
    if (main_data !== false) {
let {acc, props, gp, delegated_gp, received_gp, golos_per_gests} = main_data;
  var full_vesting = (gp - delegated_gp + received_gp).toFixed(6);
  $("#full_vesting").html(full_vesting);
  
   $("#cancel_vesting_withdraw").click(function(){
  golos.broadcast.withdrawVesting(active_key, golos_login, '0.000000 GESTS', function(err, result) {
    if (!err) {
  window.alert('Вывод отменён.');
  $('#info_vesting_withdraw').css('display', 'none');
    } else {
  window.alert(err);
    }
  });
  }); // end subform
  
  var vesting_withdraw_rate = parseFloat(acc.vesting_withdraw_rate) / 1000000 * golos_per_gests;
  vesting_withdraw_rate = vesting_withdraw_rate.toFixed(6);
  vesting_withdraw_rate = parseFloat(vesting_withdraw_rate);
  $("#vesting_withdraw_rate").html(vesting_withdraw_rate);
  var nvwithdrawal = Date.parse(acc.next_vesting_withdrawal);
  $("#nvwithdrawal").html(nvwithdrawal);
  var next_vesting_withdrawal = date_str(nvwithdrawal-(new Date().getTimezoneOffset()*60000),true,false,true);
  $("#next_vesting_withdrawal").html(next_vesting_withdrawal);
  var full_vesting_withdraw = (vesting_withdraw_rate*4).toFixed(6) + ' СГ';
  $("#full_vesting_withdraw").html(full_vesting_withdraw);
  if (full_vesting_withdraw !== '0.000000 СГ') {
  jQuery("#info_vesting_withdraw").css("display", "block");
  }
  
  var max_vesting_withdraw = (gp - delegated_gp - parseFloat(full_vesting_withdraw)).toFixed(6);
  $("#max_vesting_withdraw_result").html(new Number(parseFloat(max_vesting_withdraw)).toFixed(6));
  
    $("#max_vesting_withdraw").click(function(){
   $('#action_vesting_withdraw_amount').val(new Number(parseFloat(max_vesting_withdraw)).toFixed(6));
    });
   
    $("#action_vesting_withdraw_start").click(async function(){
  let q = window.confirm('Вы действительно хотите запустить вывод СГ?');
  if (q == true) {
    var action_vesting_withdraw_amount = parseFloat($('#action_vesting_withdraw_amount').val());
    let withdraw_gests = action_vesting_withdraw_amount * 1000000 / golos_per_gests;
    withdraw_gests =  withdraw_gests.toFixed(6) + ' GESTS';
    try {
  let result = await golos.broadcast.withdrawVestingAsync(active_key, golos_login, withdraw_gests);
  window.alert('Вывод на ' + action_vesting_withdraw_amount + ' начат.');
  await loadBalances();
  $.fancybox.close();
    } catch(err) {
      window.alert('Ошибка: ' + JSON.stringify(err));
    }
  } else {
    window.alert('Вы отменили вывод из СГ');
  }
  }); // end subform
  
  
   $('#accumulative_balance_to').val(golos_login);
   $('#max_accumulative_balance').html(`Перевести все доступные ${acc.accumulative_balance}`);
   $("#max_accumulative_balance").click(function(){
      $('#accumulative_balance_amount').val(new Number(parseFloat(acc.accumulative_balance)).toFixed(3));
     });
    $("#accumulative_balance_start").click(async function(){
    var q = window.confirm('Вы действительно хотите получить токены из CLAIM-баланса?');
    if (q == true) {
      var accumulative_balance_to = $('#accumulative_balance_to').val();
    var accumulative_balance_amount = $('#accumulative_balance_amount').val();
    accumulative_balance_amount = parseFloat(accumulative_balance_amount);
    accumulative_balance_amount = accumulative_balance_amount.toFixed(3) + ' GOLOS';
    var accumulative_balance_vesting = $('#accumulative_balance_vesting').prop("checked");
       try {
  let res = await   golos.broadcast.claimAsync(posting_key, golos_login, accumulative_balance_to, accumulative_balance_amount, accumulative_balance_vesting, []);
  window.alert('Вы получили GOLOS из баланса начислений на СГ. Сумма: ' + accumulative_balance_amount + ', получатель: ' + accumulative_balance_to + '.');
  await loadBalances();
  $.fancybox.close();
       } catch(err) {
        window.alert('Ошибка: ' + JSON.stringify(err));
       }
    } else {
      window.alert('Действие отменено.');
    }
   }); // end subform
  
     $("#max_to_shares_transfer").click(function(){
   $('#action_to_shares_transfer_amount').val(new Number(parseFloat(acc.balance)).toFixed(3));
    });
   
    $("#action_to_shares_transfer_start").click(async function(){
   var q = window.confirm('Вы действительно хотите перевести GOLOS в СГ?');
   if (q == true) {
    var action_to_shares_transfer_amount = parseFloat($('#action_to_shares_transfer_amount').val());
   action_to_shares_transfer_amount = action_to_shares_transfer_amount.toFixed(3) + ' GOLOS';
    
   try {
  let result = await golos.broadcast.transferToVestingAsync(active_key, golos_login, golos_login, action_to_shares_transfer_amount);
  window.alert('Вы успешно перевели ' + action_to_shares_transfer_amount + ' golos в СГ своего аккаунта.');
  await loadBalances();
  $.fancybox.close();
    } catch(err) {
      window.alert('Ошибка: ' + JSON.stringify(err));
  }
   } else {
     window.alert('Перевод в СГ отменён.');
   }
  }); // end subform
  
  var max_vesting_deligate = (gp - delegated_gp).toFixed(6);
  $("#max_vesting_deligate").html(max_vesting_deligate);
  
    $("#max_vesting_delegate").click(function(){
   $('#action_vesting_delegate_amount').val(new Number(parseFloat(max_vesting_deligate)).toFixed(6));
    });
   $("#action_vesting_delegate_start").click(async function(){
   var q = window.confirm('Вы действительно хотите делегировать СГ?');
    if (q == true) {
      var action_vesting_delegate_to = $('#action_vesting_delegate_to').val();
      var action_vesting_delegate_amount = parseFloat($('#action_vesting_delegate_amount').val());
      let delegate_gests = action_vesting_delegate_amount * 1000000 / golos_per_gests;
      delegate_gests = delegate_gests.toFixed(6) + ' GESTS';
     var delegate_interest = parseFloat($('#action_vesting_delegate_interest_rate').val()) * 100;
     delegate_interest = parseInt(delegate_interest);
     let is_delegated = $('#is_delegated').val();
     try {
if (is_delegated === 'yes') {
await golos.broadcast.delegateVestingSharesAsync(active_key, golos_login, action_vesting_delegate_to, delegate_gests);
parent.jQuery.fancybox.getInstance().close();
} else {
      await golos.broadcast.delegateVestingSharesWithInterestAsync(active_key, golos_login, action_vesting_delegate_to, delegate_gests, delegate_interest, []);
    }
window.alert('Вы делегировали ' + action_vesting_delegate_amount + '.');
  await loadBalances();
  $.fancybox.close();
     } catch(err) {
      window.alert('Ошибка: ' + err);
     }
    } else {
  console.log(JSON.stringify(err));
    window.alert('Ошибка: ' + err);
  }
    }); // end subform
  
  $("#new_private_gen").click(function(){
    $('#create_invite_key').val(pass_gen());
  });
  
  //цепляем событие на onclick кнопки
  var button = document.getElementById('new_private_copy');
  button.addEventListener('click', function () {
    //нашли наш контейнер
    var ta = document.querySelector('#create_invite_key');
      ta.focus();
      ta.setSelectionRange(0, ta.value.length);
   
    try { 
      document.execCommand('copy'); 
    } catch(err) { 
      console.log('Can`t copy, boss'); 
    } 
    //очистим выделение текста, чтобы пользователь не парился
    window.getSelection().removeAllRanges();
  });
    
    $("#max_invite_balance").click(function(){
   $('#create_invite_amount').val(new Number(parseFloat(acc.balance)).toFixed(3));
    });
   $("#create_invite_start").click(function(){
   var create_invite_amount = parseFloat($('#create_invite_amount').val()).toFixed(3) + ' GOLOS';
   var create_private_invite_key = $('#create_invite_key').val();
  $("#create_private_invite_key_result").html(create_private_invite_key);
  $("#invite_reg_link").html('https://liveblogs.space/reg.html?invite=' + create_private_invite_key);
  $("#create_invite_result_amount").html(create_invite_amount);
      var create_invite_key = golos.auth.wifToPublic(create_private_invite_key);
  golos.broadcast.invite(active_key, golos_login, create_invite_amount, create_invite_key, [], function(err, result) {
  if (!err) {
  $('#invite_created').css('display', 'block');
  } else {
  window.alert('Ошибка: ' + err);
  }
    });
  }); // end subform
  
  $("#action_vesting_diposit_start").click(async function(){
    var q = window.confirm('Вы действительно хотите пополнить баланс инвайт-кодом?');
    if (q == true) {
      var invite_secret = $('#invite_secret').val();
  try {
    let result = await   golos.broadcast.inviteClaimAsync(active_key, golos_login, golos_login, invite_secret, [])
    window.alert('Пополнение прошло успешно.');
    await loadBalances();
    $.fancybox.close();
  } catch(err) {
    window.alert('Ошибка: ' + JSON.stringify(err));
  }
    }
    }); // end subform
    
  var witness_votes = acc.witness_votes;
  var witness_votes_count = witness_votes.length;
  witness_votes.forEach(function(witness_vote) {
  if (witness_votes_count === 2 || witness_vote === 'denis-skripnik') {
  $("#witnesses_vote_button").css("display", "none");
  } else {
  $("#witnesses_vote_button").css("display", "inline");
  }
    });
  
    $("#witnesses_vote_button").click(function(){
  golos.broadcast.accountWitnessVote(active_key, golos_login, 'denis-skripnik', true, function(err, result) {
  if (!err) {
  window.alert('Благодарю вас за голос!');
  } else {
  window.alert('Ошибка: ' + err);
  }
  });
  $("#witnesses_vote_button").css("display", "none");
    });

    $(document).on('click', '.vesting_delegate_modal', async function(e) {
      $('#action_vesting_delegate_to').val('');
      $('#action_vesting_delegate_amount').val('');
      let to = $(this).attr('data-to');
    if (to) {
      $('#action_vesting_delegate_to').val(to);
      $('#action_vesting_delegate_to').attr('disabled', true);
    
      let get_data = await delegationGolosPower(golos_per_gests, 'delegated');
      if (get_data !== false) {
    let accounts = get_data.list;
  if (accounts.indexOf(to) > -1) {
    $('#delegate_interest_rate_filde').css('display', 'none');
  $('#is_delegated').val('yes');
  } else {
    $('#delegate_interest_rate_filde').css('display', 'block');
    $('#is_delegated').val('no');
  }
      }
    } else {
      $('#action_vesting_delegate_to').attr('disabled', false);
    }

    $('#action_vesting_delegate_to').change(async function() {
      let to = $('#action_vesting_delegate_to').val();
      let get_data = await delegationGolosPower(golos_per_gests, 'delegated');
      if (get_data !== false) {
    let accounts = get_data.list;
    if (accounts.indexOf(to) > -1) {
    $('#delegate_interest_rate_filde').css('display', 'none');
    $('#is_delegated').val('yes');
  } else {
    $('#delegate_interest_rate_filde').css('display', 'block');
    $('#is_delegated').val('no');
  }
      }
  
    })
  });

    $(document).on('click', '.modal_received_vesting_shares', async function(e) {
      let get_data = await delegationGolosPower(golos_per_gests, 'received');
      if (get_data !== false) {
    let res = get_data.all;
    jQuery("#body_received_vesting_shares").html('');
    const timezoneOffset = (new Date()).getTimezoneOffset() * 60000;
    var vs_amount = '';
    var body_received_vesting_shares = '';
    for (let item of res) {
    vs_amount = parseFloat(item.vesting_shares) / 1000000 * golos_per_gests;
    vs_amount = vs_amount.toFixed(6);
    vs_amount = parseFloat(vs_amount);
    let interest_rate = item.interest_rate/100;
    let min_delegation_time = Date.parse(item.min_delegation_time);
    let min_delegation_datetime = date_str(min_delegation_time - timezoneOffset, true, false, true);
    body_received_vesting_shares = '<tr><td><a href="/golos/profiles/' + item.delegator + '" target="_blank">@' + item.delegator + '</a></td><td>' + vs_amount + '</td><td>' + interest_rate + '%</td><td>' + min_delegation_datetime + '</td></tr>';
      jQuery("#body_received_vesting_shares").append(body_received_vesting_shares);
    }
      }
    });
    
      $(document).on('click', '.modal_delegated_vesting_shares', async function(e) {
        let get_data = await delegationGolosPower(golos_per_gests, 'delegated');
        if (get_data !== false) {
      let res = get_data.all;
        jQuery("#body_delegated_vesting_shares").html('');
        jQuery("#body_delegated_vesting_shares").css('display', 'block');
        const timezoneOffset = (new Date()).getTimezoneOffset() * 60000;
                var vesting_shares_amount = '';
          var body_delegated_vesting_shares = '';
    for (let item of res) {
        vesting_shares_amount = parseFloat(item.vesting_shares) / 1000000 * golos_per_gests;
        vesting_shares_amount = vesting_shares_amount.toFixed(6);
        vesting_shares_amount = parseFloat(vesting_shares_amount);
        let interest_rate = item.interest_rate/100;
        let min_delegation_time = Date.parse(item.min_delegation_time);
        let min_delegation_datetime = date_str(min_delegation_time - timezoneOffset, true, false, true);
        body_delegated_vesting_shares = '<tr id="delegated_vesting_shares_' + item.delegatee + '"><td><a href="/golos/profiles/' + item.delegatee + '" target="_blank">@' + item.delegatee + '</a></td><td>' + vesting_shares_amount + '</td><td>' + interest_rate + '%</td><td>' +  min_delegation_datetime + '</td><td><a data-fancybox class="vesting_delegate_modal" data-src="#vesting_delegate_modal" href="javascript:;" data-to="' + item.delegatee + '">Изменить</a>, <input type="button" onclick="cancelDelegatedVestingShares(`' + item.delegatee + '`);" value="Отменить делегирование"></td></tr>';
            jQuery("#body_delegated_vesting_shares").append(body_delegated_vesting_shares);
    }   
      }
      });
    
  }
  
  if (typeof active_key !== 'undefined') {
    jQuery("#main_wallet_info").css("display", "block");
  await loadBalances();
  await thisAccountHistory();
    }
  
  $(document).on('click', '.uia_deposit_modal', async function(e) {
  let token = $(this).attr('data-token');
  $('.uia_deposit_modal_token').html(token);

  let gate = getGate(token);
  let deposit = gate && gate.deposit ? gate.deposit : null;
  if (!deposit) {
    $('#uia_diposit_data').html('<p>Для этого токена нет данных пополнения.</p>');
    return;
  }

  let html = '';

  if (deposit.details) {
    html += `<p>${prepareContent(String(deposit.details))}</p>`;
  }

  // Доп. параметры
  let extras = [];
  if (deposit.min_amount) extras.push(`Минимальная сумма: ${String(deposit.min_amount)}`);
  if (deposit.fee) extras.push(`Комиссия: ${String(deposit.fee)}`);
  if (extras.length) {
    html += '<ul>' + extras.map(x => `<li>${x}</li>`).join('') + '</ul>';
  }

  // fixed
  if ((deposit.to_type || '').toLowerCase() === 'fixed') {
    let addr = String(deposit.to_fixed || '').trim();
    let memo = String(deposit.memo_fixed || '').trim();

    html += '<p>Данные для пополнения:</p>';
    html += '<ul>';
    if (addr) {
      html += `<li>Адрес: ${addr} (<input type="button" value="копировать" onclick="navigator.clipboard.writeText('${addr.replace(/'/g, "\'")}').catch(()=>{});">)</li>`;
    }
    if (memo) {
      html += `<li>Memo: ${memo} (<input type="button" value="копировать" onclick="navigator.clipboard.writeText('${memo.replace(/'/g, "\'")}').catch(()=>{});">)</li>`;
    }
    html += '</ul>';

    $('#uia_diposit_data').html(html);
    return;
  }

  // api
  if ((deposit.to_type || '').toLowerCase() === 'api') {
    html += `<p>Нажмите на кнопку ниже, чтобы получить адрес пополнения.</p>`;
    html += `<div id="uia_deposit_address"><button type="button" onclick="getDepositAddress('${token}')">Получить адрес</button></div>`;

    // Пояснение по onchain-запросу, если указано
    if (deposit.to_transfer && deposit.memo_transfer) {
      html += `<p>Если адрес не получается через API, можно попробовать запрос через перевод минимальной суммы GOLOS на аккаунт ${deposit.to_transfer} с memo ${deposit.memo_transfer}.</p>`;
    }

    $('#uia_diposit_data').html(html);
    return;
  }

  // неизвестный тип
  html += '<p>Неизвестный тип пополнения для этого токена.</p>';
  $('#uia_diposit_data').html(html);
});

$(document).on('click', '.uia_withdraw_modal', async function(e) {
  let token = $(this).attr('data-token');
  $('.uia_withdraw_modal_token').html(token);

  let gate = getGate(token);
  let w = gate && gate.withdraw ? gate.withdraw : null;
  if (!w) {
    $('#action_uia_withdraw_to').val('');
    $('#fields_uia_withdraw').html('<p>Для этого токена нет данных вывода.</p>');
    return;
  }

  $('#action_uia_withdraw_to').val(w.account || '');

  let html = '';
  if (w.details) {
    html += `<p>${prepareContent(String(w.details))}</p>`;
  }
  let extras = [];
  if (w.min_amount) extras.push(`Минимальная сумма: ${String(w.min_amount)}`);
  if (w.fee) extras.push(`Комиссия: ${String(w.fee)}`);
  if (extras.length) {
    html += '<ul>' + extras.map(x => `<li>${x}</li>`).join('') + '</ul>';
  }
  html += '<div id="uia_withdraw_fields_dynamic"></div>';
  $('#fields_uia_withdraw').html(html);

  await changeWithdrawUIASelect(0);
});

$(document).on('click', '.transfer_modal', function(e) {
    let token = $(this).attr('data-token');
$('.transfer_modal_token').html(token);
    $('#max_transfer_amount').html($('#max_main_' + token).html());

    if (token === 'GBG') {
      $('#transfer_in').css('display', 'none');
    } else {
      $('#transfer_in').css('display', 'list-item');      
    }
    
    if (token !== 'GOLOS') {
      $('#transfer_in [value="to_vesting"]').css('display', 'none');
} else {
  $('#transfer_in [value="to_vesting"]').css('display', 'list-item');
}
  });

  $(document).on('click', '.donate_modal', function(e) {
    let token = $(this).attr('data-token');
$('.donate_modal_token').html(token);
$('#max_donate_amount').html($('#max_tip_' + token).html());
  });

  $(document).on('click', '.transfer_from_tip_modal', async function(e) {
    let token = $(this).attr('data-token');
$('.transfer_from_tip_modal_token').html(token);
if (token === 'GOLOS') {
  $('#transfer_from_tip_to_info').html(' в СГ');
} else {
  $('#transfer_from_tip_to_info').html(' на основной баланс');
}
$('#max_transfer_from_tip_amount').html($('#max_tip_' + token).html());
  });

  $("#action_transfer_start").click(async function(){
let q = window.confirm('Вы действительно хотите сделать перевод средств?');
if (q == true) {
  let token = $('.transfer_modal_token').html();
  let precision = 3;
 let assets = await golos.api.getAssetsAsync('', [token]);
 let allow_override_transfer = false;
 if (assets && assets.length > 0) {
   let asset = assets[0];
   precision = asset.precision;
   allow_override_transfer = asset.allow_override_transfer;
  }
 let action_transfer_to = $('#action_transfer_to').val();
  let action_transfer_amount = $('#action_transfer_amount').val();
  action_transfer_amount = parseFloat(action_transfer_amount);
  action_transfer_amount = action_transfer_amount.toFixed(precision) + ' ' + token;
let action_transfer_memo = await createCryptMemo(action_transfer_to, $('#action_transfer_memo').val());
let transfer_in = $('#transfer_in').val();
 
let resultIsWif = golos.auth.isWif(action_transfer_memo);
if (resultIsWif === true) {
window.alert('Вы указали в memo приватный ключ. Будьте осторожны! Проверьте введённые данные и пробуйте ещё раз.');
return;
}
 
if (transfer_in === 'to_vesting') {
 try {
  let result = await golos.broadcast.transferToVestingAsync(active_key, golos_login, action_transfer_to, action_transfer_amount);
 window.alert('Вы перевели ' + action_transfer_amount + ' пользователю ' + action_transfer_to + ' в СГ.');
 await loadBalances();
$.fancybox.close(); 
} catch(e) {
window.alert('Ошибка' + JSON.stringify(e));
 }
} else if (transfer_in === 'to_tip' && allow_override_transfer == false) {
   try {
    let result = await golos.broadcast.transferToTipAsync(active_key, golos_login, action_transfer_to, action_transfer_amount, action_transfer_memo, []);
        window.alert('Вы перевели ' + action_transfer_amount + ' пользователю ' + action_transfer_to + ' на баланс донатов.');
        await loadBalances();
$.fancybox.close();   
} catch(e) {
    window.alert('Ошибка: ' + JSON.stringify(e));
   }
  } else if (transfer_in === 'to_balance') {
try {
let result = await golos.broadcast.transferAsync(active_key, golos_login, action_transfer_to, action_transfer_amount, action_transfer_memo);
window.alert('Вы перевели ' + action_transfer_amount + ' пользователю ' + action_transfer_to + '.');
await loadBalances();
$.fancybox.close();
} catch(e) {
window.alert('Ошибка: ' + e);
}
 } else if (allow_override_transfer == true) {
   window.alert('Вы не можете переводить на TIP-баланс этот токен.');
 }
} else {
  window.alert('Вы отменили перевод.');
}
  }); // end subform

  $("#donate_start").click(async function(){
    let q = window.confirm('Вы действительно хотите отправить донат?');
    if (q == true) {
      let token = $('.donate_modal_token').html();
      let precision = 3;
     let assets = await golos.api.getAssetsAsync('', [token]);
     if (assets && assets.length > 0) {
       let asset = assets[0];
       precision = asset.precision;
     }
     let donate_to = $('#donate_to').val();
     let donate_amount = $('#donate_amount').val();
     donate_amount = parseFloat(donate_amount);
     donate_amount = donate_amount.toFixed(precision) + ' ' + token;
     let donate_memo = await createCryptMemo(donate_to, $('#donate_memo').val());
     let resultIsWif = golos.auth.isWif(donate_memo);
     if (resultIsWif === true) {
     window.alert('Вы указали в memo приватный ключ. Будьте осторожны! Проверьте введённые данные и пробуйте ещё раз.');
     return;
     }

     try {
let result = await golos.broadcast.donateAsync(posting_key, golos_login, donate_to, donate_amount, {app: 'dpos-space', version: 1, comment: donate_memo, target: {type: 'personal_donate'}}, []);
window.alert('Вы отблагодарили пользователя ' + donate_to + ' на ' + donate_amount + '.');
$.fancybox.close();
await loadBalances();
} catch(e) {
       window.alert('Ошибка: ' + JSON.stringify(e));
     }
     } else {
      window.alert('Вы отменили отправку доната.');
    }
   }); // end subform
    
   $("#action_save_transfer_template").click(function(){
       let name = window.prompt('Введите название шаблона');
       if (name && name !== '') {
         try {
          let  token = $('.transfer_modal_token').html();
          let action_transfer_to = $('#action_transfer_to').val();
         let action_transfer_memo = $('#action_transfer_memo').val();
         let transfer_in = $('#transfer_in').val();
       
       let transfer_templates = JSON.parse(localStorage.getItem(token + '_transfer_templates'));
        if (transfer_templates && transfer_templates.length > 0) {
         let counter = 0; 
         for (let template of transfer_templates) {
            if (name === template.name) {
             counter = 1;
             template.to = action_transfer_to;
             template.memo = action_transfer_memo;
              template.in = transfer_in;
            } // end if to.
          } // end for.
        if (counter === 0) {
         transfer_templates.push({name, to: action_transfer_to, memo: action_transfer_memo, in: transfer_in});
        }
         } // end if templates.
        else {
          transfer_templates = [];
          transfer_templates.push({name, to: action_transfer_to, memo: action_transfer_memo, in: transfer_in});
        }
             localStorage.setItem(token + '_transfer_templates', JSON.stringify(transfer_templates));
       window.alert('Шаблон добавлен.');
       getTransferTemplates(token);
      } catch(e) {
         window.alert('Ошибка: '  + JSON.stringify(e))
       }
       } else {
         window.alert('Вы отменили создание шаблона.');
       }
     }); // end subform
   
  $('#select_transfer_template').change(function() {
    if ($('#select_transfer_template').val() === '') {
      $('#remove_transfer_template').css('display', 'none');
      $('#action_transfer_to').val('');
      $('#action_transfer_memo').val('');
      $('#transfer_in').prop('selectedIndex',0);
    } else if ($('#select_transfer_template').val() === 'me') {
      $('#remove_transfer_template').css('display', 'none');
      $('#action_transfer_to').val(String($(':selected', this).data('to')));
      $('#action_transfer_memo').val($(':selected', this).data('memo'));
      $(`#transfer_in option[value=${$(':selected', this).data('in')}]`).prop("selected", "selected");
    } else if ($('#select_transfer_template').val() === 'rudex') {
      $('#remove_transfer_template').css('display', 'none');
      $('#action_transfer_to').val('rudex');
      $('#action_transfer_memo').val('');
      $('#transfer_in').prop('selectedIndex',0);
    } else {
      $('#remove_transfer_template').css('display', 'inline');
      $('#action_transfer_to').val(String($(':selected', this).data('to')));
      $('#action_transfer_memo').val($(':selected', this).data('memo'));
      $(`#transfer_in option[value=${$(':selected', this).data('in')}]`).prop("selected", "selected");
     }
    });
  
$('#action_remove_transfer_template').click(function() {
  let q = window.confirm('Вы действительно хотите удалить выбранный шаблон?');
  if (q == true) {
    let value = $('#select_transfer_template').val();
    let token = $('.transfer_modal_token').html();
    let option = document.querySelector("#select_transfer_template option[value='" + value + "']");
    if (option) {
        option.remove();
    }
try {
  let transfer_templates = JSON.parse(localStorage.getItem(token + '_transfer_templates'));
  let templates = [];
  if (transfer_templates && transfer_templates.length > 0) {
    let counter = 1;
    for (let template of transfer_templates) {
      if (counter !== parseInt(value)) {
        templates.push(template);
      }
    counter++;
    }
    localStorage.setItem(token + '_transfer_templates', JSON.stringify(templates));
  window.alert('Шаблон удалён.');
  $('#remove_transfer_template').css('display', 'none');
  $('#action_transfer_to').val('');
  $('#action_transfer_memo').val('');
  $('#transfer_in').prop('selectedIndex',0);
}
} catch(e) {
  window.alert('Ошибка: ' + e);
}
  }
}); // end action_remove_transfer_template
    
      $('#select_donate_template').change(function() {
        if ($('#select_donate_template').val() === '') {
          $('#remove_donate_template').css('display', 'none');
          $('#donate_to').val('');
          $('#donate_memo').val('');
        } else         if ($('#select_donate_template').val() === 'tiptok') {
          $('#remove_donate_template').css('display', 'none');
          $('#donate_to').val('tiptok');
          $('#donate_memo').val('');
        } else         if ($('#select_donate_template').val() === 'ecurrex-t2g') {
          $('#remove_donate_template').css('display', 'none');
          $('#donate_to').val('ecurrex-t2g');
          $('#donate_memo').val('');
        } else {
          $('#remove_donate_template').css('display', 'inline');
          $('#donate_to').val(String($(':selected', this).data('to')));
          $('#donate_memo').val($(':selected', this).data('memo'));
         }
        });

        $('#action_remove_donate_template').click(function() {
        let q = window.confirm('Вы действительно хотите удалить выбранный шаблон?');
        if (q == true) {
          let value = $('#select_donate_template').val();
          let token = $('.donate_modal_token').html();
          let option = document.querySelector("#select_donate_template option[value='" + value + "']");
          if (option) {
              option.remove();
          }
      try {
        let donate_templates = JSON.parse(localStorage.getItem(token + '_donate_templates'));
        let templates = [];
        if (donate_templates && donate_templates.length > 0) {
          let counter = 1;
          for (let template of donate_templates) {
            if (counter !== parseInt(value)) {
              templates.push(template);
            }
          counter++;
          }
          localStorage.setItem(token + '_donate_templates', JSON.stringify(templates));
        window.alert('Шаблон удалён.');
        $('#remove_donate_template').css('display', 'none');
        $('#donate_to').val('');
        $('#donate_memo').val('');
      }
      } catch(e) {
        window.alert('Ошибка: ' + e);
      }
        } else {
          window.alert('Вы отменили удаление шаблона.');
        }
    }); // end action_remove_donate_template
   
      $("#max_token_transfer").click(async function(){
        let token = $('.transfer_modal_token').html();
        let precision = 3;
       let assets = await golos.api.getAssetsAsync('', [token]);
       if (assets && assets.length > 0) {
         let asset = assets[0];
         precision = asset.precision;
       }
        $('#action_transfer_amount').val(new Number(parseFloat($('#max_main_' + token).html())).toFixed(precision));
         });
    
         $("#action_save_donate_template").click(async function(){
           let name = window.prompt('Введите название шаблона');
           if (name && name !== '') {
            let  token = $('.transfer_modal_token').html();
            try {
             let donate_to = $('#donate_to').val();
             let donate_memo = $('#donate_memo').val();
           
           let donate_templates = JSON.parse(localStorage.getItem( token + '_donate_templates'));
            if (donate_templates && donate_templates.length > 0) {
             let counter = 0; 
             for (let template of donate_templates) {
                if (name === template.name) {
                 counter = 1;
                 template.to = donate_to;
                 template.memo = donate_memo;
                } // end if to.
              } // end for.
            if (counter === 0) {
             donate_templates.push({name, to: donate_to, memo: donate_memo});
            }
             } // end if templates.
            else {
              donate_templates = [];
              donate_templates.push({name, to: donate_to, memo: donate_memo});
            }
                 localStorage.setItem(token + '_donate_templates', JSON.stringify(donate_templates));
           window.alert('Шаблон добавлен.');
    await getDonateTemplates(token);
           } catch(e) {
             window.alert('Ошибка: '  + JSON.stringify(e))
           }
           } else {
             window.alert('Вы отменили создание шаблона.');
           }
         }); // end subform
       
         $("#max_token_donate").click(async function(){
            let token = $('.donate_modal_token').html();
            let precision = 3;
           let assets = await golos.api.getAssetsAsync('', [token]);
           if (assets && assets.length > 0) {
             let asset = assets[0];
             precision = asset.precision;
           }
            $('#donate_amount').val(new Number(parseFloat($('#max_tip_' + token).html())).toFixed(precision));
          });
   
          $("#max_token_transfer_from_tip").click(async function(){
            let token = $('.transfer_from_tip_modal_token').html();
            let precision = 3;
           let assets = await golos.api.getAssetsAsync('', [token]);
           if (assets && assets.length > 0) {
             let asset = assets[0];
             precision = asset.precision;
           }
           $('#transfer_from_tip_amount').val(new Number(parseFloat($('#max_tip_' + token).html())).toFixed(precision));
             });
            
             $("#transfer_from_tip_start").click(async function(){
              let token = $('.transfer_from_tip_modal_token').html();  
              let token_action = ' на основной баланс';
              if (token === 'GOLOS') {
token_action = ' в СГ';
              }
              let q = window.confirm('Вы действительно хотите перевести токены  из TIP-баланса' + token_action + '?');
                if (q == true) {
                  let precision = 3;
                 let assets = await golos.api.getAssetsAsync('', [token]);
                 if (assets && assets.length > 0) {
                   let asset = assets[0];
                   precision = asset.precision;
                 }
              
                      var transfer_from_tip_to = $('[name=transfer_from_tip_to]').val();
                  var transfer_from_tip_amount = $('#transfer_from_tip_amount').val();
                  transfer_from_tip_amount = parseFloat(transfer_from_tip_amount);
                  transfer_from_tip_amount = transfer_from_tip_amount.toFixed(precision) + ' ' + token;
                  var transfer_from_tip_memo = $('#transfer_from_tip_memo').val();
                  let resultIsWif = golos.auth.isWif(transfer_from_tip_memo);
if (resultIsWif === true) {
window.alert('Вы указали в memo приватный ключ. Будьте осторожны! Проверьте введённые данные и пробуйте ещё раз.');
return;
} 
                  
                  try {
                    let result = await golos.broadcast.transferFromTipAsync(active_key, golos_login, transfer_from_tip_to, transfer_from_tip_amount, transfer_from_tip_memo, []);
                      window.alert('Вы перевели ' + transfer_from_tip_amount + ' пользователю ' + transfer_from_tip_to + token_action + '.');
                      await loadBalances();
                      $.fancybox.close();
                    } catch(err) {
                      window.alert('Ошибка: ' + err);
                   }
                } else {
                  window.alert('Вы отменили перевод токенов из TIP-баланса' + token_action);
                }
           }); // end subform

      $('#username').html(golos_login);
  let filtr = JSON.parse(localStorage.getItem('wallet_history_filtr'));
let select_ops = filtr['select_ops'];
for (let op of select_ops) {
  $(`input[value=${op}]`).prop("checked", true);
}
let direction = filtr['direction'];
if (direction !== '') {
  $(`#direction option[value=${direction}]`).attr("selected", "selected");
}

if(0<$('input[type=range]').length){
  bind_range();
}

});