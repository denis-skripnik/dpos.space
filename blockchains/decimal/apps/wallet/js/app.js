function compareCoins(a, b)
{
	if(parseFloat(a.reserve) > parseFloat(b.reserve))
	{
		return -1;
	}
	else{
		return 1;
	}
}

var del_balance = 0;

async function links(token) {
  $('#actions').html(`<li><a data-fancybox class="transfer_modal" data-src="#transfer_modal" href="javascript:;" data-token="${token}" onclick="getTransferTemplates('${token}');">Перевести ${token}</a></li>
<li><a data-fancybox class="convert_modal" data-src="#convert_modal" href="javascript:;" data-token="${token}">Конвертировать ${token}</a></li>
<li><a data-fancybox class="delegate_modal" data-src="#delegate_modal" href="javascript:;" data-token="${token}" onclick="getDelegateTemplates('${token}');">Делегировать ${token}</a></li>
`);
}

var link_state = {};
async function actionsSpoiler(t) {
    let token = $(t).attr('data-token');
    style = document.getElementById('actions').style;
    if (!link_state.display || link_state.token === token) {
      style.display = (style.display == 'block') ? 'none' : 'block';
      }
      await links(token);
    link_state.token = token;
    link_state.display = style.display;
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

// format base-unit amounts (1e18) into human-readable string
function formatDecimal18(raw) {
  try {
    if (raw === null || raw === undefined) return "0";
    const s = String(raw).trim();
    if (!s) return "0";
    // if already a decimal string, keep it
    if (s.includes(".")) return s;

    // BigInt-safe formatting for very large integers
    const bi = BigInt(s);
    const base = 10n ** 18n;
    const intPart = bi / base;
    const fracPart = bi % base;
    if (fracPart === 0n) return intPart.toString();

    // show up to 6 decimals (trim trailing zeros)
    const fracStrFull = fracPart.toString().padStart(18, "0");
    let fracStr = fracStrFull.slice(0, 6).replace(/0+$/, "");
    if (!fracStr) return intPart.toString();
    return intPart.toString() + "." + fracStr;
  } catch (e) {
    // fallback: best-effort number parsing
    const n = Number(raw);
    if (!isFinite(n)) return String(raw);
    return String(n / 1e18);
  }
}

function pickBalancesFromResponse(data) {
  const root = data || {};
  if (Array.isArray(root.balances)) return root.balances;
  if (root.result && Array.isArray(root.result.balances)) return root.result.balances;
  if (root.Result && Array.isArray(root.Result.balances)) return root.Result.balances;
  return [];
}

async function fetchBalancesForAddress(address) {
  const url = "https://api.decimalchain.com/api/v1/addresses/" + encodeURIComponent(address) + "/balances";
  const response = await axios.get(url);
  return pickBalancesFromResponse(response && response.data);
}

async function loadBalances() {
  try {
    if (typeof sender === "undefined" || !sender) {
      console.warn("sender is not set");
      return;
    }

   const addrEvm = sender.evmAddress ? String(sender.evmAddress) : "";

    let balances = [];
    if (addrEvm) {
      balances = await fetchBalancesForAddress(addrEvm);
    }

    let balances_list = "";

    for (const b of balances || []) {
      const denomRaw = b && (b.denom || b.denomRaw || b.symbol || b.ticker || b.coin);
      if (!denomRaw) continue;

      const token = String(denomRaw).trim();
      if (!token) continue;
      const tokenSymbol = token.toUpperCase();

      const rawAmount = (b && (b.amount ?? b.value)) ?? "0";
      const amountHumanStr = formatDecimal18(rawAmount);
      const amountHumanNum = Number(amountHumanStr);

      // hide dust and invalids
      if (!amountHumanStr || amountHumanStr === "0") continue;
      if (isFinite(amountHumanNum) && amountHumanNum <= 0) continue;

      if (tokenSymbol === "DEL") {
        // keep numeric form for fee previews etc
        del_balance = isFinite(amountHumanNum) ? amountHumanNum : 0;
      }

      // display formatting: 3 decimals when possible
      let displayAmount = amountHumanStr;
      if (isFinite(amountHumanNum)) {
        displayAmount = amountHumanNum < 0.001 ? amountHumanNum.toFixed(8) : amountHumanNum.toFixed(3);
      }

      balances_list += `<li>
        <div class="token">${tokenSymbol}</div>
        <div class="balance">${displayAmount}</div>
        <span id="max_${tokenSymbol}" style="display:none">${displayAmount}</span>
        <a class="actions_spoiler" href="javascript:;" data-token="${tokenSymbol}" onclick="actionsSpoiler(this);">Действия</a>
      </li>`;
    }

    if (!balances_list) balances_list = "<li>Нет балансов</li>";
    $("#balances").html(balances_list);

    // Optional: show EVM address if the template has a placeholder
    if (sender.evmAddress && document.getElementById("current_evm_address")) {
      jQuery("#current_evm_address").html(sender.evmAddress);
    }
  } catch (e) {
    console.log(e);
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
  
  let transfer_templates = JSON.parse(localStorage.getItem(token + '_decimal_transfer_templates'));
 if (transfer_templates && transfer_templates.length > 0) {
  let template_count = 1;
  for (let template of transfer_templates) {
$('#select_transfer_template').append(`<option value="${template_count}" data-to="${template.to}" data-memo="${template.memo}">${template.name}</option>
`);
template_count++;
}
 }
}

function getDelegateTemplates(token) {
  $('#select_delegate_template').html('<option value="">Выберите шаблон (данные будут установлены в поля при выборе)</option>');
  let delegate_templates = JSON.parse(localStorage.getItem(token + '_decimal_delegate_templates'));
 if (delegate_templates && delegate_templates.length > 0) {
  let template_count = 1;
  for (let template of delegate_templates) {
$('#select_delegate_template').append(`<option value="${template_count}" data-key="${template.key}">${template.name}</option>
`);
template_count++;
}
 }
}

function prepareContent(text) {
  try {
    return text.replace(/[^=][^""][^"=\/](https?:\/\/[^" <>\n]+)/gi, data => {
      const link = data.slice(3);
        if(/(jpe?g|png|svg|gif)$/.test(link)) return `${data.slice(0,3)} <img src="${link}" alt="" /> `
        if(/(vimeo)/.test(link)) return `${data.slice(0,3)} <iframe src="${link}" frameborder="0" allowfullscreen></iframe> `;
        if(/(youtu)/.test(link)) return `${data.slice(0,3)} <iframe src="${link.replace(/.*v=(.*)/, 'https://www.youtube.com/embed/$1')}" frameborder="0" allowfullscreen></iframe> `;
        return `${data.slice(0,3)} <a href="${link}">${link}</a> `
      }).replace(/ (@[^< \.,]+)/gi, user => ` <a href="/decimal/profiles/${user.trim().slice(1)}">${user.trim()}</a>`)
  } catch(e) {
    return text;
  }
 }

 async function getHistory(page) {
  jQuery("#wallet_transfer_history").css("display", "block");
  try {
    if (typeof sender === "undefined" || !sender || !sender.address) {
      console.warn("getHistory: sender is not set");
      return;
    }

    const limit = 10;
    let offset = (page * limit) - limit;

    let response = await axios.get('https://api.decimalchain.com/api/v1/txs/txs-by-address/' + sender.address + '?limit=' + limit + '&offset=' + offset);
    let results = '';
    let root = (response && response.data) ? response.data : {};
    // Transactions service can respond with {Ok, Result} or {ok, result} depending on gateway/proxy
    let r0 = root.result || root.Result || {};
    let res = r0.txs || r0.Txs || [];

    // Map known "type" values to UI labels.
    // Note: in OpenAPI TransactionShort.type looks like "/decimal.coin.v1.MsgSendCoin"
    let types = {
      buy_coin: 'Покупка монет',
      create_coin: 'Создание монеты',
      update_coin: 'Обновление монеты',
      sell_coin: 'Продажа монеты',
      send_coin: 'Отправка',
      multisend_coin: 'Мультисенд (мульти-отправка)',
      sell_all_coin: 'Продажа всех монет',
      redeem_check: 'Получение чека',
      issue_check: 'Создание чека',
      declare_candidate: 'Объявление кандидата в валидаторы',
      delegate: 'Делегирование',
      set_online: 'Установка кандидата в статусе онлайн',
      set_offline: 'Установка кандидата в статусе оффлайн',
      unbond: 'Анбонд',
      edit_candidate: 'Редактирование кандидата',
      create_wallet: 'Создание мультисига',
      create_transaction: 'Создание мультисиг транзакции',
      sign_transaction: 'Подпись мультисигом транзакции',
      MsgSubmitProposal: 'Отправленный пропозал',
      MsgVote: 'Голосование по пропозалу',
      msg_initialize: 'Инициализация свопа',
      msg_redeem_v2: 'Получение свопа',
      msg_mint: 'Создание NFT',
      msg_burn: 'Сжигание NFT',
      msg_edit_metadata: 'Редактирование мета-данных NFT',
      msg_transfer: 'Передача NFT',
      delegate_nft: 'Делегирование NFT',
      unbond_nft: 'Анбонд NFT',

      // OpenAPI-style Msg paths
      "/decimal.coin.v1.MsgSendCoin": "Отправка",
      "/decimal.coin.v1.MsgMultiSendCoin": "Мультисенд (мульти-отправка)",
      "/decimal.coin.v1.MsgSellCoin": "Конвертация",
      "/decimal.coin.v1.MsgSellAllCoin": "Конвертация",
      "/decimal.coin.v1.MsgBuyCoin": "Конвертация"
    };

    for (let tr of res) {
      let amount = '';
      let type = '';
      let memo = tr.message || tr.memo || '';
      let hash = tr.hash || tr.tx_hash || '';
      let blockId = tr.blockId || tr.block || '';
      let get_time = tr.timestamp ? Date.parse(tr.timestamp) : NaN;

      // New/OpenAPI TransactionShort branch (no "data" field)
      if (!tr.data) {
        const coin = tr.coin || tr.denom || '';
        const rawAmount = tr.amount || '0';
        const coinSym = String(coin || '').toUpperCase();
        const human = formatDecimal18(rawAmount);
        // display with 3 decimals when possible
        const humanNum = Number(human);
        const display = isFinite(humanNum) ? (humanNum < 0.001 ? humanNum.toFixed(8) : humanNum.toFixed(3)) : human;
        amount = `${display} ${coinSym}`.trim();

        const typeKey = tr.type || '';
        type = types[typeKey] || types[String(typeKey).toLowerCase()] || typeKey || '';

        // For send coin: detect incoming/outgoing relative to the wallet
        const s = tr.sender || tr.address_from || '';
        const r = tr.recipient || tr.address_to || '';
        if (typeKey === "/decimal.coin.v1.MsgSendCoin") {
          if (String(r) === String(sender.address)) type = "Получение";
          else type = "Отправка";
        }

        if (!get_time || isNaN(get_time)) get_time = Date.now();

        results += `
<tr><td>${date_str(get_time, true, false, true)}</td>
<td><a href="/decimal/explorer/block/${blockId}" target="_blank">${blockId}</a></td>
<td><a href="/decimal/explorer/tx/${hash}" target="_blank">${hash}</a></td>
<td>${type}</td>
<td>${amount}</td>
<td>${memo}</td>
</tr>`;
        continue;
      }

      // Old branch (kept for backward compatibility with older API shapes)
      let coin_str = 'coin';
      let value_str = 'amount';
      type = types[tr.type];

      if (tr.type === 'COIN_SEND' && tr.data.to === sender.address) {
        type = 'Получение';
      } else if (tr.type === 'COIN_SELL' || tr.type === 'COIN_SELL_ALL' || tr.type === 'COIN_BUY') {
        type = 'Конвертация';
        coin_str = 'sellCoin';
        value_str = 'amount';
      } else if (tr.type === 'transfer_nft') {
        type = 'Передача NFT';
        coin_str = 'transfer_nft';
        value_str = 'nft';
      } else if (tr.type === 'mint_nft') {
        type = 'Создание NFT';
        coin_str = 'mint_nft';
        value_str = 'nft';
      } else if (tr.type === 'delegate_nft') {
        type = 'Делегирование NFT';
        coin_str = 'delegate_nft';
        value_str = 'nft';
      } else if (tr.type === 'unbond_nft') {
        type = 'Анбонд NFT';
        coin_str = 'unbond_nft';
        value_str = 'nft';
      }

      if (!tr.data.list && tr.type !== 'COIN_CREATE') {
        if (value_str !== 'nft') {
          amount = parseFloat(tr.data[value_str]) / (10 ** 18);
          amount = amount.toFixed(2);
          amount += tr.data[coin_str].symbol;
        } else {
          amount = tr.data[value_str].id;
        }
      } else if (tr.data.list && tr.type !== 'COIN_CREATE') {
        let sum_amount = 0;
        let coin = '';
        for (let el of tr.data.list) {
          if (el.to === sender.address) {
            sum_amount += parseFloat(el[value_str]);
            coin = el[coin_str].symbol;
          }
        }
        amount = sum_amount;
        amount += coin;
      } else if (!tr.data.list && (tr.type === 'COIN_CREATE')) {
        amount = parseFloat(tr.data.initSupply) / (10 ** 18);
        amount += tr.data.symbol;
      }

      // fallback for old timestamp fields
      if (!tr.timestamp && tr.time) tr.timestamp = tr.time;
      get_time = Date.parse(tr.timestamp);

      results += `
<tr><td>${date_str(get_time, true, false, true)}</td>
<td><a href="/decimal/explorer/block/${blockId}" target="_blank">${blockId}</a></td>
<td><a href="/decimal/explorer/tx/${hash}" target="_blank">${hash}</a></td>
<td>${type}</td>
<td>${amount}</td>
<td>${memo}</td>
</tr>`;
    }

    let next_page = page + 1;
    let prev_page = page - 1;

    if (page === 1) {
      $('#history_pages').html(`<a onclick="getHistory(${next_page});">Следующая</a>`);
    } else if (page > 1 && res.length === limit) {
      $('#history_pages').html(`<a onclick="getHistory(${prev_page});">Предыдущая</a>
<a onclick="getHistory(${next_page});">Следующая</a>`);
    } else {
      $('#history_pages').html(`<a onclick="getHistory(${prev_page});">Предыдущая</a>`);
    }

    $('#history_tbody').css('display', 'block');
    $('#history_tbody').html(results);
  } catch(e) {
    console.log(e);
  }
}

function byteCount(s) {
  return encodeURI(s).split(/%..|./).length - 1;
}

async function resolveTokenAddressBySymbol(symbol) {
  symbol = String(symbol || "").trim();
  if (!symbol) return null;

  const key = `token_addr_${symbol.toUpperCase()}`;
  const cached = localStorage.getItem(key);
  if (cached && cached.startsWith("0x")) return cached;

  const evm = (window.decimalEVM ? window.decimalEVM : (typeof ensureDecimalEVM === "function" ? await ensureDecimalEVM() : null));
  if (!evm) throw new Error("DecimalEVM is not initialized");

  // DEL - нативная монета, у нее нет tokenAddress
  if (symbol.toUpperCase() === "DEL") return null;

  // SDK call
  const tokenAddress = await evm.getAddressTokenBySymbol(symbol); // 
  if (!tokenAddress || !String(tokenAddress).startsWith("0x")) return null;

  const exists = await evm.checkTokenExists(tokenAddress); // 
  if (!exists) return null;

  localStorage.setItem(key, tokenAddress);
  return tokenAddress;
}


// --- Convert token address helpers (UI keeps 0x addresses, user types symbols) ---
function ensureConvertHiddenFields() {
  const ids = [
    "action_convert_from_token_address",
    "action_convert_to_token_address",
    "action_convert_to_decimals",
    "action_convert_from_decimals"
  ];

  const parent = document.body || document.documentElement;
  if (!parent) return;

  for (const id of ids) {
    if (!document.getElementById(id)) {
      const el = document.createElement("input");
      el.type = "hidden";
      el.id = id;
      parent.appendChild(el);
    }
  }
}

// Initialize after DOM is ready (script may be loaded in <head>)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", ensureConvertHiddenFields);
} else {
  ensureConvertHiddenFields();
}


async function resolveTokenDecimalsBySymbol(symbol) {
  symbol = String(symbol || "").trim();
  if (!symbol) return 18;
  if (symbol.toUpperCase() === "DEL") return 18;

  const key = `token_dec_${symbol.toUpperCase()}`;
  const cached = localStorage.getItem(key);
  if (cached && !isNaN(Number(cached))) return Number(cached);

  // Try Coins API (exact, lower-case required)
  try {
    const s = symbol.toLowerCase();
    const r = await axios.get(`https://api.decimalchain.com/api/v1/coins/${s}`);
    const root = r && r.data ? r.data : {};
    const item0 = Array.isArray(root.Result) ? root.Result[0] : null;
    const dec = item0 && item0.decimals != null ? Number(item0.decimals) : 18;
    if (isFinite(dec) && dec > 0) {
      localStorage.setItem(key, String(dec));
      return dec;
    }
  } catch (_) {}

  return 18;
}





async function getConvertPrice() {
  let coin = $('.convert_modal_token').html();
  coin = String(coin || '').trim().toLowerCase();

  let to = $('#action_convert_to').val();
  to = String(to || '').trim().toLowerCase();

  let amount = parseFloat($('#action_convert_amount').val());
  let max_amount = parseFloat($('#max_convert_amount').html());

  if (!amount || amount <= 0 || !to) {
    $('#buy_amount').html('');
    $('#convert_fee').html('');
    $('#swap_route_block').css('display', 'none');
    $('#swap_route').html('');
    return;
  }

  // addresses from your UI (must exist for non-DEL tokens)
  const fromAddr = String($('#action_convert_from_token_address').val() || '').trim();
  const toAddr = String($('#action_convert_to_token_address').val() || '').trim();

  // 1) DEL -> token (buy)
  if (coin === 'del' && to !== 'del') {
    if (!toAddr.startsWith('0x')) {
      $('#buy_amount').html('');
      $('#convert_fee').html('');
      return;
    }

    // SDK estimate
    const evm = await ensureDecimalEVM();
    const amountDelWei = evm.parseEther(String(amount));
    const outWei = await evm.calculateBuyOutput(toAddr, amountDelWei); // :contentReference[oaicite:1]{index=1}
    const out = Number(evm.formatEther(outWei));

    // fee is unknown here unless you estimate gas (see below)
    $('#buy_amount').html(out.toFixed(3));
    $('#convert_fee').html('0 DEL'); // placeholder if you keep fee stub
    return;
  }

  // 2) token -> DEL (sell)
  if (coin !== 'del' && to === 'del') {
    if (!fromAddr.startsWith('0x')) {
      $('#buy_amount').html('');
      $('#convert_fee').html('');
      return;
    }

    const evm = await ensureDecimalEVM();
    const amountInWei = evm.parseEther(String(amount));
    const outWei = await evm.calculateSellOutput(fromAddr, amountInWei); // :contentReference[oaicite:2]{index=2}
    const out = Number(evm.formatEther(outWei));

    $('#buy_amount').html(out.toFixed(3));
    $('#convert_fee').html('0 DEL'); // placeholder if you keep fee stub
    return;
  }

  // 3) token -> token (your old logic below)
  try {
    let coin_response = await axios.get(`https://api.decimalchain.com/api/v1/coins/${coin}`);
    let to_response = await axios.get(`https://api.decimalchain.com/api/v1/coins/${to}`);
    let to_amount = sell(coin_response.data.Result[0], amount, to_response.data.Result[0]);

    let del_fee = await convert(fromAddr || coin, toAddr || to, amount, to_amount, 'fee');

    // ... дальше твой старый код ...
  } catch (e) {
    // ... твой catch ...
  }
}


async function getDelegations() {
  try {
    // NOTE: Stakes endpoint split into coins and NFTs (requires TWO calls)
    let stakes_coins = await axios.get('https://api.decimalchain.com/api/v1/validators/wallet/' + sender.evmAddress + '/stakes/coins');
    let stakes_nfts = await axios.get('https://api.decimalchain.com/api/v1/validators/wallet/' + sender.evmAddress + '/stakes/nfts');
    
// Process coin stakes (new API shape)
let coin_res = (stakes_coins.data && stakes_coins.data.Result && stakes_coins.data.Result.items) ? stakes_coins.data.Result.items : [];

if (coin_res && coin_res.length > 0) {
  $('#delegation_tbody').css('display', 'block');

  const fmt18 = (v, digits = 3) => {
    const n = Number(v || 0) / 1e18;
    if (!isFinite(n)) return "0.000";
    return n.toFixed(digits);
  };

  let table = "";

  for (let el of coin_res) {
    const v = el.validator || {};
    const validator_key = String(v.address || "").trim(); // 0x...
    const validator_name = String(v.name || "").trim();
    const validator_status = ""; // в этом ответе статуса нет

    const items = Array.isArray(el.items) ? el.items : [];
    for (let stake of items) {
      // stake fields differ for DEL vs token, but delegatedCoins exists in both examples
      const symbol = String(stake.symbol || stake.coin_symbol || "").trim();
      if (!symbol) continue;

      const tokenAddress = String(stake.address || "").trim(); // may be empty for DEL
      const delegatedCoinsWei = String(stake.delegatedCoins || "0").trim();

      const amountStr = fmt18(delegatedCoinsWei, 3) + " " + symbol;

      // В старом коде ты показывал еще "в DEL". Здесь есть поля delegationPrice/currentPrice,
      // но их смысл без точной формулы лучше не выдумывать.
      // Поэтому оставим вторую строку пустой, чтобы не было неверных цифр.
      const del_amount = "";

      const rowId = `validator_${symbol}_${validator_key}`;

      table += `<tr>
        <td>
          ${validator_status ? `<strong>${validator_status}</strong><br>` : ``}
          <input type="text" readonly id="${rowId}" value="${validator_key}">
          (<input type="button" value="копировать" onclick="copyText('${rowId}');">)
          <br>${validator_name}
        </td>
        <td>
          ${amountStr}${del_amount ? `<br>${del_amount}` : ``}
        </td>
        <td>
          <a data-fancybox
             class="delegate_modal"
             data-src="#delegate_modal"
             href="javascript:;"
             data-token="${symbol}"
             data-token-address="${tokenAddress}"
             data-pubkey="${validator_key}"
             onclick="getDelegateTemplates('${symbol}');">
             Делегировать ${symbol}
          </a>,
          <a data-fancybox
             class="anbond_modal"
             data-src="#anbond_modal"
             href="javascript:;"
             data-token="${symbol}"
             data-token-address="${tokenAddress}"
             data-pubkey="${validator_key}"
             data-amount="${fmt18(delegatedCoinsWei, 3)}">
             Анбонд ${symbol}
          </a>
        </td>
      </tr>`;
    }
  }

  $('#delegation_tbody').html(table);
} else {
  $('#delegation_tbody').html('');
}
    
    // Process NFT stakes
    let nft_res = stakes_nfts.data.result || [];
    if (nft_res && nft_res.length > 0) {
      $('#delegation_nft_tbody').css('display', 'block');
      let nft_table = '';
      for (let nft_stake of nft_res) {
        let validator_key = nft_stake.validatorId;
        let validator_name = nft_stake.validator.details;
        let validator_status = nft_stake.validator.status;
        let nftId = nft_stake.nftId;
        let nftCollection = nft_stake.nftCollection;
        
        nft_table += `<tr>
        <td>${nftCollection}/${nftId}</td>
        <td><strong>${validator_status}</strong>
        <input type="text" readonly id="validator_nft_${nftId}_${validator_key}" value="${validator_key}"> (<input type="button" value="копировать" onclick="copyText('validator_nft_${nftId}_${validator_key}');">)<br>
        ${validator_name}</td>
        <td><a data-fancybox class="delegate_nft_modal" data-src="#delegate_nft_modal" href="javascript:;" data-nftid="${nftId}" data-nftcollection="${nftCollection}" data-pubkey="${validator_key}">Делегировать</a>, <a data-fancybox class="anbond_nft_modal" data-src="#anbond_nft_modal" href="javascript:;" data-nftid="${nftId}" data-nftcollection="${nftCollection}" data-pubkey="${validator_key}">Анбонд</a></td>
        </tr>`;
      }
      $('#delegation_nft_tbody').html(nft_table);
    }

  } catch(e) {
      console.log('Ошибка с делегированием: ' + e);
  }
}

const COINS_INDEX_KEY = "coins_index_v1";
const COINS_INDEX_TS_KEY = "coins_index_ts_v1";
const COINS_INDEX_TTL_MS = 24 * 60 * 60 * 1000; // 24h

async function loadCoinsIndex() {
  const now = Date.now();
  const cached = localStorage.getItem(COINS_INDEX_KEY);
  const cachedTs = Number(localStorage.getItem(COINS_INDEX_TS_KEY) || "0");

  if (cached && cachedTs && (now - cachedTs) < COINS_INDEX_TTL_MS) {
    try {
      return JSON.parse(cached);
    } catch (_) {}
  }

  // грузим все страницы, чтобы не зависеть от "ровно 1000"
  const limit = 1000;
  let offset = 0;

  const map = {};   // symbol(lower) -> { address, decimals, title }
  const symbols = [];

  while (true) {
    const url = `https://api.decimalchain.com/api/v1/coins/coins?limit=${limit}&offset=${offset}`;
    const r = await axios.get(url);

    // по твоему примеру структура: { Ok: true, Result: [ { count, coins: [...] } ] }
    const root = r && r.data ? r.data : {};
    const result0 = Array.isArray(root.Result) ? root.Result[0] : null;
    const coins = result0 && Array.isArray(result0.coins) ? result0.coins : [];

    for (const c of coins) {
      const symbol = String(c.symbol || "").toLowerCase().trim();
      const address = String(c.address || "").trim();
      const decimals = Number(c.decimals);
      const title = String(c.title || "");

      if (!symbol) continue;
      if (!address.startsWith("0x")) continue;

      if (!map[symbol]) {
        map[symbol] = { address, decimals, title };
        symbols.push(symbol);
      }
    }

    if (coins.length < limit) break;
    offset += limit;
  }

  symbols.sort();

  const index = { map, symbols, ts: now };
  localStorage.setItem(COINS_INDEX_KEY, JSON.stringify(index));
  localStorage.setItem(COINS_INDEX_TS_KEY, String(now));
  return index;
}

async function resolveTokenByPartial(input) {
  const q = String(input || "").toLowerCase().trim();
  if (!q) return [];

  const idx = await loadCoinsIndex();
  // простая фильтрация по префиксу, можно заменить на includes
  return idx.symbols.filter(s => s.startsWith(q)).slice(0, 50);
}

async function resolveTokenAddressExact(symbol) {
  const s = String(symbol || "").toLowerCase().trim();
  if (!s) return null;

  // allow user paste 0x directly
  if (s.startsWith("0x")) return { address: s, decimals: 18, title: "" };

  const idx = await loadCoinsIndex();
  const hit = idx.map[s];
  if (hit) return hit;

  // fallback: точный запрос /coins/{symbol}
  const r = await axios.get(`https://api.decimalchain.com/api/v1/coins/${s}`);
  const root = r && r.data ? r.data : {};
  const item0 = Array.isArray(root.Result) ? root.Result[0] : null;

  if (item0 && String(item0.address || "").startsWith("0x")) {
    const out = {
      address: String(item0.address),
      decimals: Number(item0.decimals) || 18,
      title: String(item0.title || "")
    };
    // обновим кэш точечно
    idx.map[s] = out;
    if (!idx.symbols.includes(s)) idx.symbols.push(s);
    idx.symbols.sort();
    localStorage.setItem(COINS_INDEX_KEY, JSON.stringify(idx));
    return out;
  }

  return null;
}


// Convert fee amount in DEL into token amount for UI display (DEL is native; no /coins/del curve data).
// If symbol is DEL, returns the same fee.
async function delFeeToTokenAmount(symbol, delFeeDel) {
  const sym = String(symbol || "").trim();
  if (!sym) return Number(delFeeDel) || 0;

  if (sym.toLowerCase() === "del") return Number(delFeeDel) || 0;

  const tokenData = await resolveTokenAddressExact(sym);
  const tokenAddress = tokenData && tokenData.address ? String(tokenData.address).trim() : "";
  if (!tokenAddress.startsWith("0x")) throw new Error("tokenAddress not resolved for fee conversion");

  const evm = await ensureDecimalEVM();
  const feeWei = evm.parseEther(String(delFeeDel || 0));
  const outWei = await evm.calculateBuyOutput(tokenAddress, feeWei);
  return Number(evm.formatEther(outWei));
}

function formatDelFromWei(wei) {
  if (wei === null || wei === undefined) return "0";

  try {
    // если BigInt
    if (typeof wei === "bigint") {
      return (Number(wei) / 1e18).toFixed(6);
    }

    // если строка
    if (typeof wei === "string") {
      return (Number(wei) / 1e18).toFixed(6);
    }

    // если число
    if (typeof wei === "number") {
      return (wei / 1e18).toFixed(6);
    }
  } catch (_) {}

  return "0";
}

$(document).ready(async function() {
  if (seed) {
    jQuery("#main_wallet_info").css("display", "block");
    await loadBalances();
    setInterval(async function() {await loadBalances();}, 5000);
  $('#current_address').html(sender.address);
  $('#address_link').attr('href', `https://dpos.space/decimal/profiles/${sender.address}`)
     $('#copy_address').click(async function() {
       try {
         await navigator.clipboard.writeText(sender.address);
       } catch(e) {
         console.log(e);
       }
     });    
     await getHistory(1);
    }
  
  $(document).on('click', '.transfer_modal', async function(e) {
    let token = $(this).attr('data-token');
$('.transfer_modal_token').html(token);
    $('#max_transfer_amount').html($('#max_' + token).html());
  });

  $(document).on('click', '.convert_modal', async function(e) {
  const symbol = String($(this).attr('data-token') || '').trim();
  $('.convert_modal_token').html(symbol);
  $('#max_convert_amount').html($('#max_' + symbol).html());

  // Save "from" token address for EVM convert
  try {
    const addr = await resolveTokenAddressBySymbol(symbol);
    $('#action_convert_from_token_address').val(addr || '');
  } catch (err) {
    console.warn('resolveTokenAddressBySymbol failed for from token:', symbol, err);
    $('#action_convert_from_token_address').val('');
  }

  // Save "from" decimals if we can get them (optional)
  try {
    const dec = await resolveTokenDecimalsBySymbol(symbol);
    $('#action_convert_from_decimals').val(String(dec || 18));
  } catch (_) {
    $('#action_convert_from_decimals').val('18');
  }
});

$(document).on('click', '.delegate_modal', async function(e) {
    let token = $(this).attr('data-token');
    let coin = token;
let tokenData = await resolveTokenAddressExact(token);
    let tokenAddress = 'del';
    if (token.toLowerCase() !== 'del') tokenAddress = tokenData.address;

    let key = $(this).attr('data-pubkey');
    if (key) {
      $('#action_delegate_key').val(key);
      let stake = $('#action_delegate_stake').val();
      if (stake === '') stake = 1;
        let max_amount = $('#max_delegate_amount').html();
        max_amount = parseFloat(max_amount);
        if (key !== '') {
          let del_fee = await delegate(tokenAddress, key, stake, 'fee');
          let fee = del_fee;
      let fee_coin = 'DEL';
      if (String(coin || '').trim().toLowerCase() !== 'del') {
        try {
          fee = await delFeeToTokenAmount(coin, del_fee);
          fee_coin = String(coin || '').trim().toUpperCase();
        } catch (e) {
          console.warn('fee conversion failed:', e);
          fee = del_fee;
          fee_coin = 'DEL';
        }
      }
$('#delegate_fee').html(formatDelFromWei(fee).toFixed(5) + ` ${fee_coin}`)
          if (stake !== '' && stake + fee > max_amount && (fee !== del_fee || token === 'DEL')) {
            stake = parseFloat(stake);
                  stake = stake - (stake + fee - max_amount);
                  $('#action_delegate_stake').val(new Number(stake).toFixed(3));  
                }
        }
    }
    $('.delegate_modal_token').html(token);
    $('#max_delegate_amount').html($('#max_' + token).html());
  });

  $(document).on('click', '.anbond_modal', async function(e) {
    let token = $(this).attr('data-token');
      let tokenData = await resolveTokenAddressExact(token);
    let tokenAddress = 'del';
    if (token.toLowerCase() !== 'del') tokenAddress = tokenData.address;
    let key = $(this).attr('data-pubkey');
      $('#action_anbond_key').val(key);
      if (key !== '') {
        let stake = $('#action_anbond_stake').val();
        if (stake === '') stake = 1;
          let max_amount = $('#max_anbond_amount').html();
          max_amount = parseFloat(max_amount);
          let fee = await anbond(tokenAddress, key, stake, 'fee');
          $('#anbond_fee').html(formatDelFromWei(fee) + ` DEL`)
          }
      let amount = $(this).attr('data-amount');
      $('.anbond_modal_token').html(token);
    $('#max_anbond_amount').html(amount);
  });

  $("#max_token_anbond").click(async function(){
    let coin = $('.anbond_modal_token').html();
    let max_amount = $('#max_anbond_amount').html();
    max_amount = parseFloat(max_amount);
    let fee = parseFloat($('#anbond_fee').html());
      $('#action_anbond_stake').val(new Number(max_amount).toFixed(3));
      });

  $("#action_transfer_start").click(async function(){
let q = window.confirm('Вы действительно хотите сделать перевод средств?');
if (q == true) {
  let coin = $('.transfer_modal_token').html();
 let to = $('#action_transfer_to').val();
  let amount = $('#action_transfer_amount').val();
  amount = parseFloat(amount);
let memo = $('#action_transfer_memo').val();
 let gasCoin = $('#transfer_fee').html().split(' ')[1];

 try {
  $.fancybox.close(); 
  await send(to, amount, coin, memo, '')
 await loadBalances();
} catch(e) {
window.alert('Ошибка: ' + e);
 }
}
  }); // end subform

  $('#action_transfer_to').change(async function() {
    let memo = $('#action_transfer_memo').val();
    let coin = $('.transfer_modal_token').html();
    let to = $('#action_transfer_to').val();
    let max_amount = $('#max_transfer_amount').html();
    max_amount = parseFloat(max_amount);
    let amount = $('#action_transfer_amount').val();
    if (amount === '') {
      amount = 1;
    } else {
      amount = parseFloat(amount);
    }
    if (to !== '') {
      let del_fee = await send(to, amount, coin, memo, 'fee');
      let fee = del_fee;
      let fee_coin = 'DEL';
      if (String(coin || '').trim().toLowerCase() !== 'del') {
        try {
          fee = await delFeeToTokenAmount(coin, del_fee);
          fee_coin = String(coin || '').trim().toUpperCase();
        } catch (e) {
          console.warn('fee conversion failed:', e);
          fee = del_fee;
          fee_coin = 'DEL';
        }
      }
if (String(coin || '').trim().toLowerCase() === 'del' && amount === max_amount) {
      amount -= del_fee;
    }
      $('#transfer_fee').html(formatDelFromWei(fee).toFixed(5) + ` ${fee_coin}`);
    $('#action_transfer_amount').val(amount.toFixed(3));
    }
  });

  $('#action_transfer_memo').change(async function() {
let memo = $('#action_transfer_memo').val();
let coin = $('.transfer_modal_token').html();
let to = $('#action_transfer_to').val();
let amount = $('#action_transfer_amount').val();
amount = parseFloat(amount);
let max_amount = $('#max_transfer_amount').html();
max_amount = parseFloat(max_amount);
if (to !== '') {
  let del_fee = await send(to, amount, coin, memo, 'fee');
  let fee = del_fee;
      let fee_coin = 'DEL';
      if (String(coin || '').trim().toLowerCase() !== 'del') {
        try {
          fee = await delFeeToTokenAmount(coin, del_fee);
          fee_coin = String(coin || '').trim().toUpperCase();
        } catch (e) {
          console.warn('fee conversion failed:', e);
          fee = del_fee;
          fee_coin = 'DEL';
        }
      }
if (String(coin || '').trim().toLowerCase() === 'del' && amount === max_amount) {
      amount -= del_fee;
    }
  $('#transfer_fee').html(formatDelFromWei(fee).toFixed(5) + ` ${fee_coin}`);
$('#action_transfer_amount').val(amount.toFixed(3));
}
});

$("#action_convert_start").click(async function(){
  let q = window.confirm('Вы действительно хотите сделать обмен средств?');
  if (q == true) {
    let coin = $('.convert_modal_token').html();
   let to = $('#action_convert_to').val().toUpperCase();
    let amount = $('#action_convert_amount').val();
    amount = parseFloat(amount);
    let buy_amount = $('#buy_amount').html();
    buy_amount = (buy_amount !== '' ? parseFloat(buy_amount) : 0) * 0.9;
    let swap_route = $('#swap_route').html();
    let gasCoin = $('#convert_fee').html().split(' ')[1];
   
    try {
    $.fancybox.close(); 
    // Convert expects EVM token addresses for token legs.
// from: token address or "DEL"
// to: token address or "DEL"
const fromSymbol = String(coin || '').trim();
let fromLeg = '';
if (fromSymbol.toUpperCase() === 'DEL') {
  fromLeg = 'DEL';
} else {
  const fromAddr = String($('#action_convert_from_token_address').val() || '').trim();
  if (!fromAddr || !fromAddr.startsWith('0x')) {
    throw new Error('Не найден address токена для обмена. Проверь резолв symbol -> 0x.');
  }
  fromLeg = fromAddr;
}

const toSymbolInput = String($('#action_convert_to').val() || '').trim();
let toLeg = '';
if (toSymbolInput.toUpperCase() === 'DEL') {
  toLeg = 'DEL';
} else {
  const toAddr = String($('#action_convert_to_token_address').val() || '').trim();
  if (!toAddr || !toAddr.startsWith('0x')) {
    throw new Error('Не найден address токена получателя. Выбери токен из списка или введи полный тикер.');
  }
  toLeg = toAddr;
}

await convert(fromLeg, toLeg, amount, buy_amount, '');
   await loadBalances();
  } catch(e) {
  window.alert('Ошибка: ' + e);
   }
  }
    }); // end subform
  
    $('#action_convert_to').change(async function() {
  const symbol = String($('#action_convert_to').val() || '').trim();

  // Update resolved "to" token address when user types manually (exact match)
  try {
    const addr = await resolveTokenAddressBySymbol(symbol);
    $('#action_convert_to_token_address').val(addr || '');
    const dec = await resolveTokenDecimalsBySymbol(symbol);
    $('#action_convert_to_decimals').val(String(dec || 18));
  } catch (_) {
    $('#action_convert_to_token_address').val('');
    $('#action_convert_to_decimals').val('18');
  }

  await getConvertPrice();
});
$('#action_convert_amount').change(async function() {
  await getConvertPrice();
});

$("#action_delegate_start").click(async function(){
  let q = window.confirm('Вы действительно хотите делегировать?');
  if (q == true) {
    let coin = $('.delegate_modal_token').html();
      let tokenData = await resolveTokenAddressExact(coin);
    let tokenAddress = 'del';
    if (coin.toLowerCase() !== 'del') tokenAddress = tokenData.address;
    let publicKey = $('#action_delegate_key').val();
    let stake = $('#action_delegate_stake').val();
    stake = parseFloat(stake);
    let gasCoin = $('#delegate_fee').html().split(' ')[1];

   try {
    $.fancybox.close(); 
    await delegate(tokenAddress, publicKey, stake)
   await loadBalances();
  } catch(e) {
  window.alert('Ошибка: ' + e);
   }
  }
    }); // end subform

    $("#action_anbond_start").click(async function(){
      let q = window.confirm('Вы действительно хотите сделать анбонд?');
      if (q == true) {
        let coin = $('.anbond_modal_token').html();
       let publicKey = $('#action_anbond_key').val();
        let stake = $('#action_anbond_stake').val();
        stake = parseFloat(stake);
       
       try {
        $.fancybox.close(); 
        await anbond(coin, publicKey, stake)
       await loadBalances();
      } catch(e) {
      window.alert('Ошибка: ' + e);
       }
      }
        }); // end subform
    

        $('#action_anbond_key').change(async function() {
          let publicKey = $('#action_anbond_key').val();
          let coin = $('.anbond_modal_token').html();
          let stake = $('#action_anbond_stake').val();
        if (stake === '') stake = 1;
          let max_amount = $('#max_anbond_amount').html();
          max_amount = parseFloat(max_amount);
          if (publicKey !== '') {
            let fee = await anbond(coin, publicKey, stake, 'fee');
if (del_balance > fee) {
  $('#anbond_fee').html(formatDelFromWei(fee) + ` DEL`)
  stake = parseFloat(stake);
  $('#action_anbond_stake').val(new Number(stake).toFixed(3));  
} else {
  window.alert('Баланс DEL < комиссии.');
}
          }
        });        

        // NFT Delegation handlers
        $(document).on('click', '.delegate_nft_modal', async function(e) {
          let nftId = $(this).attr('data-nftid');
          let nftCollection = $(this).attr('data-nftcollection');
          let key = $(this).attr('data-pubkey');
          $('#action_delegate_nft_info').val(nftCollection + '/' + nftId);
          
          if (key && nftId) {
            try {
              let fee = await delegateNFT(nftId, key, 'fee');
              $('#delegate_nft_fee').html((formatDelFromWei(fee) / 1e18).toFixed(5) + ' DEL');
            } catch(e) {
              console.error('Fee calculation error:', e);
              $('#delegate_nft_fee').html('Error');
            }
          }
        });
        
        $("#action_delegate_nft_start").click(async function(){
          let q = window.confirm('Вы действительно хотите делегировать NFT?');
          if (q == true) {
            let nftInfo = $('#action_delegate_nft_info').val();
            let nftId = nftInfo.split('/')[1];
            // Get the public key from the modal context
            let publicKey = $(document.activeElement).closest('.delegate_nft_modal').attr('data-pubkey');
            
            try {
              $.fancybox.close();
              await delegateNFT(nftId, publicKey);
              await getDelegations();
            } catch(e) {
              window.alert('Ошибка: ' + e);
            }
          }
        });
        
        $(document).on('click', '.anbond_nft_modal', async function(e) {
          let nftId = $(this).attr('data-nftid');
          let nftCollection = $(this).attr('data-nftcollection');
          let key = $(this).attr('data-pubkey');
          $('#action_anbond_nft_info').val(nftCollection + '/' + nftId);
          
          if (key && nftId) {
            try {
              let fee = await withdrawStakeNFT(nftId, key, 'fee');
              $('#anbond_nft_fee').html((fee / 1e18).toFixed(5) + ' DEL');
            } catch(e) {
              console.error('Fee calculation error:', e);
              $('#anbond_nft_fee').html('Error');
            }
          }
        });
        
        $("#action_anbond_nft_start").click(async function(){
          let q = window.confirm('Вы действительно хотите сделать анбонд NFT?');
          if (q == true) {
            let nftInfo = $('#action_anbond_nft_info').val();
            let nftId = nftInfo.split('/')[1];
            // Get the public key from the modal context
            let publicKey = $(document.activeElement).closest('.anbond_nft_modal').attr('data-pubkey');
            
            try {
              $.fancybox.close();
              await withdrawStakeNFT(nftId, publicKey);
              await getDelegations();
            } catch(e) {
              window.alert('Ошибка: ' + e);
            }
          }
        });

        $("#action_save_transfer_template").click(function(){
       let name = window.prompt('Введите название шаблона');
       if (name && name !== '') {
         try {
          let  token = $('.transfer_modal_token').html();
          let action_transfer_to = $('#action_transfer_to').val();
         let action_transfer_memo = $('#action_transfer_memo').val();
       
       let transfer_templates = JSON.parse(localStorage.getItem(token + '_decimal_transfer_templates'));
        if (transfer_templates && transfer_templates.length > 0) {
         let counter = 0; 
         for (let template of transfer_templates) {
            if (name === template.name) {
             counter = 1;
             template.to = action_transfer_to;
             template.memo = action_transfer_memo;
            } // end if to.
          } // end for.
        if (counter === 0) {
         transfer_templates.push({name, to: action_transfer_to, memo: action_transfer_memo});
        }
         } // end if templates.
        else {
          transfer_templates = [];
          transfer_templates.push({name, to: action_transfer_to, memo: action_transfer_memo});
        }
             localStorage.setItem(token + '_decimal_transfer_templates', JSON.stringify(transfer_templates));
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
    } else {
      $('#remove_transfer_template').css('display', 'inline');
      $('#action_transfer_to').val(String($(':selected', this).data('to')));
      $('#action_transfer_memo').val($(':selected', this).data('memo'));
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
  let transfer_templates = JSON.parse(localStorage.getItem(token + '_decimal_transfer_templates'));
  let templates = [];
  if (transfer_templates && transfer_templates.length > 0) {
    let counter = 1;
    for (let template of transfer_templates) {
      if (counter !== parseInt(value)) {
        templates.push(template);
      }
    counter++;
    }
    localStorage.setItem(token + '_decimal_transfer_templates', JSON.stringify(templates));
  window.alert('Шаблон удалён.');
  $('#remove_transfer_template').css('display', 'none');
  $('#action_transfer_to').val('');
  $('#action_transfer_memo').val('');
}
} catch(e) {
  window.alert('Ошибка: ' + e);
}
  }
}); // end action_remove_transfer_template
    
      $('#select_delegate_template').change(async function() {
        if ($('#select_delegate_template').val() === '') {
          $('#remove_delegate_template').css('display', 'none');
          $('#action_delegate_key').val('');
        } else {
          $('#remove_delegate_template').css('display', 'inline');
          $('#action_delegate_key').val(String($(':selected', this).data('key')));
          let publicKey = $('#action_delegate_key').val();
          let coin = $('.delegate_modal_token').html();
      let tokenData = await resolveTokenAddressExact(coin);
    let tokenAddress = 'del';
    if (coin.toLowerCase() !== 'del') tokenAddress = tokenData.address;
          let stake = $('#action_delegate_stake').val();
        if (stake === '') stake = 1;
          let max_amount = $('#max_delegate_amount').html();
          max_amount = parseFloat(max_amount);
          if (publicKey !== '') {
            let del_fee = await delegate(tokenAddress, publicKey, stake, 'fee');
            let fee = del_fee;
      let fee_coin = 'DEL';
      if (String(coin || '').trim().toLowerCase() !== 'del') {
        try {
          fee = await delFeeToTokenAmount(coin, del_fee);
          fee_coin = String(coin || '').trim().toUpperCase();
        } catch (e) {
          console.warn('fee conversion failed:', e);
          fee = del_fee;
          fee_coin = 'DEL';
        }
      }
$('#delegate_fee').html(formatDelFromWei(fee).toFixed(5) + ` ${fee_coin}`)
            if (stake !== '' && stake + fee > max_amount && (fee !== del_fee || coin === 'DEL')) {  
              stake = parseFloat(stake);
                    stake = stake - (stake + fee - max_amount);
                    $('#action_delegate_stake').val(new Number(stake).toFixed(3));  
                  }
          }
        }
        });

        $('#action_remove_delegate_template').click(function() {
        let q = window.confirm('Вы действительно хотите удалить выбранный шаблон?');
        if (q == true) {
          let value = $('#select_delegate_template').val();
          let token = $('.delegate_modal_token').html();
          let option = document.querySelector("#select_delegate_template option[value='" + value + "']");
          if (option) {
              option.remove();
          }
      try {
        let delegate_templates = JSON.parse(localStorage.getItem(token + '_decimal_delegate_templates'));
        let templates = [];
        if (delegate_templates && delegate_templates.length > 0) {
          let counter = 1;
          for (let template of delegate_templates) {
            if (counter !== parseInt(value)) {
              templates.push(template);
            }
          counter++;
          }
          localStorage.setItem(token + '_decimal_delegate_templates', JSON.stringify(templates));
        window.alert('Шаблон удалён.');
        $('#remove_delegate_template').css('display', 'none');
        $('#action_delegate_key').val('');
      }
      } catch(e) {
        window.alert('Ошибка: ' + e);
      }
        } else {
          window.alert('Вы отменили удаление шаблона.');
        }
    }); // end action_remove_delegate_template
   
      $("#max_token_transfer").click(async function(){
        let coin = $('.transfer_modal_token').html();
        let to = $('#action_transfer_to').val();
        let max_amount = parseFloat($('#max_transfer_amount').html());
        let memo = $('#action_transfer_memo').val();

        if (to !== '') {
          let del_fee = await send(to, max_amount, coin, memo, 'fee');
          let fee = del_fee;
      let fee_coin = 'DEL';
      if (String(coin || '').trim().toLowerCase() !== 'del') {
        try {
          fee = await delFeeToTokenAmount(coin, del_fee);
          fee_coin = String(coin || '').trim().toUpperCase();
        } catch (e) {
          console.warn('fee conversion failed:', e);
          fee = del_fee;
          fee_coin = 'DEL';
        }
      }
$('#transfer_fee').html(formatDelFromWei(fee).toFixed(5) + ` ${fee_coin}`);
          if (String(coin || '').trim().toLowerCase() === 'del') {
            max_amount -= del_fee;
          }
        $('#action_transfer_amount').val(max_amount.toFixed(3));
        }
      });
    
         $("#max_token_convert").click(async function(){
          let token = $('.convert_modal_token').html();
          $('#action_convert_amount').val(new Number(parseFloat($('#max_' + token).html())).toFixed(3));
          await getConvertPrice();   
        });

$('#action_delegate_key').change(async function() {
  let publicKey = $('#action_delegate_key').val();
  let coin = $('.delegate_modal_token').html();
      let tokenData = await resolveTokenAddressExact(coin);
    let tokenAddress = 'del';
    if (coin.toLowerCase() !== 'del') tokenAddress = tokenData.address;
  let stake = $('#action_delegate_stake').val();
if (stake === '') stake = 1;
  let max_amount = $('#max_delegate_amount').html();
  max_amount = parseFloat(max_amount);
  if (publicKey !== '') {
    let del_fee = await delegate(tokenAddress, publicKey, stake, 'fee');
    let fee = del_fee;
      let fee_coin = 'DEL';
      if (String(coin || '').trim().toLowerCase() !== 'del') {
        try {
          fee = await delFeeToTokenAmount(coin, del_fee);
          fee_coin = String(coin || '').trim().toUpperCase();
        } catch (e) {
          console.warn('fee conversion failed:', e);
          fee = del_fee;
          fee_coin = 'DEL';
        }
      }
$('#delegate_fee').html(formatDelFromWei(fee) + ` ${fee_coin}`)
    if (stake !== '' && stake + fee > max_amount && (fee !== del_fee || coin === 'DEL')) {
      stake = parseFloat(stake);
            stake = stake - (stake + fee - max_amount);
            $('#action_delegate_stake').val(new Number(stake).toFixed(3));  
          }
  }
});

        $("#max_token_delegate").click(async function(){
          let coin = $('.delegate_modal_token').html();
          let max_amount = $('#max_delegate_amount').html();
          max_amount = parseFloat(max_amount);
          let fee = parseFloat($('#delegate_fee').html());
            max_amount -= fee + 0.001;
            $('#action_delegate_stake').val(new Number(max_amount).toFixed(3));
            });

         $("#action_save_delegate_template").click(async function(){
           let name = window.prompt('Введите название шаблона');
           if (name && name !== '') {
            let  token = $('.delegate_modal_token').html();
            try {
             let delegate_key = $('#action_delegate_key').val();
           
           let delegate_templates = JSON.parse(localStorage.getItem( token + '_decimal_delegate_templates'));
            if (delegate_templates && delegate_templates.length > 0) {
             let counter = 0; 
             for (let template of delegate_templates) {
                if (name === template.name) {
                 counter = 1;
                 template.key = delegate_key;
                } // end if to.
              } // end for.
            if (counter === 0) {
             delegate_templates.push({name, key: delegate_key});
            }
             } // end if templates.
            else {
              delegate_templates = [];
              delegate_templates.push({name, key: delegate_key});
            }
                 localStorage.setItem(token + '_decimal_delegate_templates', JSON.stringify(delegate_templates));
           window.alert('Шаблон добавлен.');
    await getDelegateTemplates(token);
           } catch(e) {
             window.alert('Ошибка: '  + JSON.stringify(e))
           }
           } else {
             window.alert('Вы отменили создание шаблона.');
           }
         }); // end subform
       
      $('#username').html(decimal_login);
      if (localStorage.getItem('wallet_history_filtr')) {
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
  }

try {
  $("#action_convert_to").change(async function() {
let q = $("#action_convert_to").val();
  $("#action_convert_to").autocomplete({
  source: async function(request, response) {
    const results = await resolveTokenByPartial(request.term);
    response(results);
  },
  select: async function(event, ui) {
    const symbol = String(ui.item && ui.item.value ? ui.item.value : "").trim();
    $("#action_convert_to").val(symbol);

    try {
      const addr = await resolveTokenAddressBySymbol(symbol);
      $("#action_convert_to_token_address").val(addr || "");
      const dec = await resolveTokenDecimalsBySymbol(symbol);
      $("#action_convert_to_decimals").val(String(dec || 18));
    } catch (err) {
      console.warn("resolveTokenAddressBySymbol failed for to token:", symbol, err);
      $("#action_convert_to_token_address").val("");
      $("#action_convert_to_decimals").val("18");
    }

    await getConvertPrice();
    return false;
  }
});

  });
} catch(e) {
  console.log(e);
}
});