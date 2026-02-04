// Decimal SDK globals (browser bundle)
if (!window.DecimalSDK) {
  throw new Error("DecimalSDK is not loaded. Make sure decimal-sdk-web.js is loaded before blockchain.js");
}

const { Wallet, DecimalEVM, DecimalNetworks, TX_TYPE } = window.DecimalSDK;

var sender = window.sender || {};
var decimalEVM = null; // instance of DecimalEVM
var decimalWallet = null; // instance of Wallet

window.sender = sender;


async function ensureDecimalEVM() {
  if (!decimalEVM) {
    throw new Error("decimalEVM is not initialized (no wallet). Select or create an account first.");
  }
  if (typeof decimalEVM.connect === "function" && !decimalEVM._connected) {
    try {
      await decimalEVM.connect();
      decimalEVM._connected = true;
    } catch (e) {
      // connect may be optional in browser build
      console.log("decimalEVM.connect failed:", e && (e.message || e));
    }
  }
  return decimalEVM;
}
let current_user = JSON.parse(localStorage.getItem("decimal_current_user"));
if (current_user && !current_user.type  || current_user && current_user.type !== 'bip.to') {
var decimal_login = current_user.login;
let chain = 'decimal';
if (current_user.importFrom) chain = current_user.importFrom;
var seed = sjcl.decrypt(`dpos.space_${chain}_` + decimal_login + '_seed', current_user.seed);
$( document ).ready(function() {
    if (!seed) {
        if (document.getElementById('auth_msg')) document.getElementById('auth_msg').style = 'display: block';
        if (document.getElementById('seed_page')) document.getElementById('seed_page').style = 'display: none';
       }
});    
} else if (current_user && current_user.type && current_user.type === 'bip.to') {
    var decimal_login = current_user.login;            
    $( document ).ready(function() {
            if (document.getElementById('seed_page')) document.getElementById('seed_page').style = 'display: block';
    });    
} else {
    $( document ).ready(function() {
      if (!seed) {
        if (document.getElementById('auth_msg')) document.getElementById('auth_msg').style = 'display: block';
        if (document.getElementById('seed_page')) document.getElementById('seed_page').style = 'display: none';
       }
        });
    }
        
var users = JSON.parse(localStorage.getItem('decimal_users'));
$( document ).ready(function() {
        if (users && users.length > 0) {
            document.getElementById('show_accounts_list').style = 'display: block';
}
        });
        var decimalEVM = null;  // Will be initialized with wallet
        
        if (seed) {
            let chain = 'decimal';
            if (current_user && current_user.importFrom) chain = current_user.importFrom;
            const secret = sjcl.decrypt(`dpos.space_${chain}_` + current_user.login + '_seed', current_user.seed);
            
            // Create wallet from seed (mnemonic)
            decimalWallet = new Wallet(secret);
            sender = {
                address: decimalWallet.address,
                evmAddress: decimalWallet.evmAddress,
                privateKey: (typeof decimalWallet.getPrivateKeyString === "function")
                  ? decimalWallet.getPrivateKeyString()
                  : (decimalWallet.privateKey || "")
            };
            window.sender = sender;
// Initialize DecimalEVM with wallet
            decimalEVM = new DecimalEVM(decimalWallet, DecimalNetworks.mainnet);
            window.decimalEVM = decimalEVM;

        }

        function isValidMnemonic(mnemonic) {
          if (!mnemonic) return false;
          try {
            new Wallet(mnemonic);
            return true;
          } catch (e) {
            return false;
          }
        }

        async function checkTxStatus(txHash) {
            try {
                // Poll OpenAPI for TX status (check every 2 seconds, max 60 attempts = 120 seconds)
                let attempts = 0;
                const maxAttempts = 60;
                
                while (attempts < maxAttempts) {
                    let response = await axios.get(`https://api.decimalchain.com/api/v1/txs/${txHash}`);
                    let root = (response && response.data) ? response.data : {};
                    let tx = root.result || root.Result || {};
                    if (tx.status === 'Success' || tx.status === 'success') {
                        return { status: 'Success', tx: tx };
                    } else if (tx.status === 'Failed' || tx.status === 'failed') {
                        return { status: 'Failed', tx: tx };
                    }
                    
                    // Wait 2 seconds before retrying
                    await new Promise(r => setTimeout(r, 2000));
                    attempts++;
                }
                
                return { status: 'Unknown', message: 'TX status check timeout' };
            } catch(e) {
                console.error('Error checking TX status:', e);
                return { status: 'Error', error: e };
            }
        }
        
        async function broadcastTx(txPayload) {
            try {
                // txPayload is the prepared transaction object from SDK
                // Send it to blockchain and wait for status
                const result = await decimalEVM.broadcast(txPayload);
                
                if (result && result.hash) {
                    $.fancybox.open(`<p id="message"><strong>Пожалуйста, подождите. Идёт отправка и проверка доставки транзакции.</strong></p>`);
                    
                    let txStatus = await checkTxStatus(result.hash);
                    
                    if (txStatus.status === 'Success') {
                        document.getElementById('message').innerHTML = (`<strong>Ok. Транзакция создана и отправлена: <a href="/decimal/explorer/tx/${result.hash}" target="_blank">${result.hash}</a></strong>`);
                    } else {
                        document.getElementById('message').innerHTML = ('Ошибка. Транзакция отправлена, но не принята.');
                    }
                    return result;
                } else {
                    throw 'TX broadcast failed: No hash returned';
                }
            } catch(e) {
                console.error('TX broadcast error:', e);
                throw `Ошибка при отправке транзакции: ${e}`;
            }
        }
        
        async function getTransaction(txHash) {
                try {
                    let response = await axios.get(`https://api.decimalchain.com/api/v1/txs/${txHash}`);
                    let root = (response && response.data) ? response.data : {};
                    return root.result || root.Result || false;
                } catch(e) {
                    console.log(e);
                    return false;
                }
        }


        async function send(to, amount, coin, memo, mode) {
            if (mode === 'fee') {
                // Estimate fee for coin send
                try {
                    let amountInSmallestUnit = (BigInt(Math.floor(amount * 1e18))).toString();
                    if (coin.toUpperCase() === 'DEL') {
                        return await decimalEVM.estimateFeeSendDEL({
                            to: to,
                            amount: amountInSmallestUnit
                        });
                    } else {
                        return await decimalEVM.estimateFeeTransferToken({
                            to: to,
                            coin: coin,
                            amount: amountInSmallestUnit
                        });
                    }
                } catch(e) {
                    console.error('Fee estimation error:', e);
                    return 0;
                }
            } else {
                // Execute send transaction
                try {
                    let amountInSmallestUnit = (BigInt(Math.floor(amount * 1e18))).toString();
                    let txPayload;
                    
                    if (coin.toUpperCase() === 'DEL') {
                        txPayload = await decimalEVM.sendDEL({
                            to: to,
                            amount: amountInSmallestUnit
                        });
                    } else {
                        txPayload = await decimalEVM.transferToken({
                            to: to,
                            coin: coin,
                            amount: amountInSmallestUnit
                        });
                    }
                    
                    return await broadcastTx(txPayload);
                } catch(e) {
                    console.error('Send transaction error:', e);
                    throw `Ошибка при отправке: ${e}`;
                }
            }
        }
        
        
async function convert(fromLeg, toLeg, value, minimum_buy_amount, mode) {
  // EVM routes:
  // - Token -> DEL: sellExactTokensForDEL(tokenAddress, amountIn, amountOutMin, recipient)
  // - DEL -> Token: buyTokenForExactDEL(tokenAddress, amountDel, amountOutMin, recipient)
  // - Token -> Token: convertToken(tokenAddress1, tokenAddress2, amountIn, amountOutMin, recipient, sign)
  if (mode === "fee") {
    // UI expects a number. Real gas estimation is EVM-dependent.
    return 0;
  }

  try {
    const evm = await ensureDecimalEVM();

    if (!sender || !sender.evmAddress) {
      throw new Error("sender.evmAddress is not set");
    }

    const from = String(fromLeg || "").trim();
    const to = String(toLeg || "").trim();

    const isFromDEL = from.toUpperCase() === "DEL";
    const isToDEL = to.toUpperCase() === "DEL";

    if (isFromDEL && isToDEL) {
      throw new Error("Invalid route: DEL -> DEL");
    }

    const owner = sender.evmAddress;
    const recipient = owner;

    const getDecFromUI = (id, fallback) => {
      try {
        const el = document.getElementById(id);
        const v = el ? Number(el.value) : NaN;
        return isFinite(v) && v > 0 ? v : fallback;
      } catch (_) {
        return fallback;
      }
    };

    const parseAmount = (val, decimals) => {
      // Prefer parseUnits if SDK exposes it (ethers v5/v6 style)
      if (typeof evm.parseUnits === "function") return evm.parseUnits(String(val), decimals);
      // Fallback: parseEther for 18 decimals
      if (decimals !== 18) {
        throw new Error("Token decimals != 18 are not supported in this build. Need evm.parseUnits().");
      }
      return evm.parseEther(String(val));
    };

    // Decimals are optional but help avoid wrong scaling
    const fromDecimals = getDecFromUI("action_convert_from_decimals", 18);
    const toDecimals = getDecFromUI("action_convert_to_decimals", 18);

    // Token -> DEL
    if (!isFromDEL && isToDEL) {
      const tokenAddress = from;
      if (!tokenAddress.startsWith("0x")) {
        throw new Error("tokenAddress is required for EVM convert (0x...).");
      }

      const amountIn = parseAmount(value, fromDecimals);
      const amountOutMin = parseAmount(minimum_buy_amount, 18); // DEL has 18

      if (typeof evm.sellExactTokensForDEL !== "function") {
        throw new Error("SDK method sellExactTokensForDEL is not available.");
      }

      return await evm.sellExactTokensForDEL(tokenAddress, amountIn, amountOutMin, recipient);
    }

    // DEL -> Token
    if (isFromDEL && !isToDEL) {
      const tokenAddress = to;
      if (!tokenAddress.startsWith("0x")) {
        throw new Error("tokenAddress is required for EVM convert (0x...).");
      }

      const amountDel = parseAmount(value, 18); // DEL has 18
      const amountOutMin = parseAmount(minimum_buy_amount, toDecimals);

      if (typeof evm.buyTokenForExactDEL !== "function") {
        throw new Error("SDK method buyTokenForExactDEL is not available.");
      }

      return await evm.buyTokenForExactDEL(tokenAddress, amountDel, amountOutMin, recipient);
    }

    // Token -> Token
    if (!isFromDEL && !isToDEL) {
      const tokenAddress1 = from;
      const tokenAddress2 = to;

      if (!tokenAddress1.startsWith("0x") || !tokenAddress2.startsWith("0x")) {
        throw new Error("tokenAddress is required for EVM convert (0x...).");
      }

      const amountIn = parseAmount(value, fromDecimals);
      const amountOutMin = parseAmount(minimum_buy_amount, toDecimals);

      if (typeof evm.convertToken !== "function") {
        throw new Error("SDK method convertToken is not available.");
      }

      // Prefer permit flow (no approve tx)
      let tokenCenterAddress = null;
      if (typeof evm.getDecimalContractAddress === "function") {
        try {
          tokenCenterAddress = await evm.getDecimalContractAddress("token-center");
        } catch (_) {}
      }
      tokenCenterAddress = tokenCenterAddress || evm.tokenCenterAddress;

      if (!tokenCenterAddress) {
        throw new Error("tokenCenterAddress is not set.");
      }

      let sign = null;
      if (typeof evm.getSignPermitToken === "function") {
        sign = await evm.getSignPermitToken(tokenAddress1, tokenCenterAddress, amountIn);
      }

      return await evm.convertToken(tokenAddress1, tokenAddress2, amountIn, amountOutMin, recipient, sign || undefined);
    }

    throw new Error("Convert route is not supported yet.");
  } catch (e) {
    console.error("Convert transaction error:", e);
    throw `Ошибка при конвертации: ${e && (e.message || e)}`;
  }
}

async function delegate(coin, address, stake, mode) {
  const validator = String(address || "").trim();
  if (!validator.startsWith("0x")) {
    throw new Error("Invalid validator address");
  }

  const stakeWei = BigInt(Math.floor(Number(stake) * 1e18));
if (mode === "fee") {
  const amount = decimalEVM.parseEther(String(stake)); // если stake в DEL-единицах
  const feeData = await decimalEVM.getFeeData();

  let gas;
  if (coin === "del") {
    gas = await decimalEVM.delegateDEL(address, amount, true);
  } else {
    gas = await decimalEVM.delegateToken({ address, coin, amount }, true);
  }

  const feeWei = BigInt(gas.toString()) * BigInt(feeData.gasPrice.toString());
  return feeWei; // дальше сам решаешь: показать в DEL или как "gas coin"
}

  try {
    let txPayload;

    if (coin === "del") {
      txPayload = await decimalEVM.delegateDEL(
        validator,
        stakeWei
      );
    } else {
      txPayload = await decimalEVM.delegateToken(
        validator,
        coin,
        stakeWei
      );
    }

    return await broadcastTx(txPayload);
  } catch (e) {
    console.error("Delegate transaction error:", e);
    throw `Ошибка при делегировании: ${e.message || e}`;
  }
}

        async function anbond(coin, address, stake, mode) {
            if (mode === 'fee') {
                // Estimate fee for unbonding
                try {
                    let stakeInSmallestUnit = (BigInt(Math.floor(stake * 1e18))).toString();
                    
                    if (coin.toUpperCase() === 'DEL') {
                        return await decimalEVM.estimateFeeWithdrawStakeDEL({
                            address: address,
                            amount: stakeInSmallestUnit
                        });
                    } else {
                        return await decimalEVM.estimateFeeWithdrawStakeToken({
                            address: address,
                            coin: coin,
                            amount: stakeInSmallestUnit
                        });
                    }
                } catch(e) {
                    console.error('Fee estimation error:', e);
                    return 0;
                }
            } else {
                // Execute unbond transaction
                try {
                    let stakeInSmallestUnit = (BigInt(Math.floor(stake * 1e18))).toString();
                    let txPayload;
const coinNorm = String(coin || "").trim().toLowerCase();
                   
if (coinNorm === "del") {
                        txPayload = await decimalEVM.withdrawStakeToken(address, '0x0000000000000000000000000000000000000000', stakeInSmallestUnit)
                    } else {
                                                txPayload = await decimalEVM.withdrawStakeToken(address, coin, stakeInSmallestUnit)
                    }
                    
                    return await broadcastTx(txPayload);
                } catch(e) {
                    console.error('Unbond transaction error:', e);
                    throw `Ошибка при анбонде: ${e}`;
                }
            }
        }

        async function createCoin(title, ticker, initSupply, maxSupply, options, mode) {
            if (mode === 'fee') {
                // Estimate fee for coin creation
                try {
                    let initSupplyInSmallestUnit = (BigInt(Math.floor(initSupply * 1e18))).toString();
                    let maxSupplyInSmallestUnit = (BigInt(Math.floor(maxSupply * 1e18))).toString();
                    
                    return await decimalEVM.estimateFeeCreateToken({
                        title: title,
                        symbol: ticker,
                        initSupply: initSupplyInSmallestUnit,
                        maxSupply: maxSupplyInSmallestUnit,
                        reserve: options.initialReserve,
                        crr: options.constantReserveRatio
                    });
                } catch(e) {
                    console.error('Fee estimation error:', e);
                    return 0;
                }
            } else {
                // Execute coin creation transaction
                try {
                    let initSupplyInSmallestUnit = (BigInt(Math.floor(initSupply * 1e18))).toString();
                    let maxSupplyInSmallestUnit = (BigInt(Math.floor(maxSupply * 1e18))).toString();
                    
                    let txPayload = await decimalEVM.createToken({
                        title: title,
                        symbol: ticker,
                        initSupply: initSupplyInSmallestUnit,
                        maxSupply: maxSupplyInSmallestUnit,
                        reserve: options.initialReserve,
                        crr: options.constantReserveRatio
                    });
                    
                    return await broadcastTx(txPayload);
                } catch(e) {
                    console.error('Create coin transaction error:', e);
                    throw `Ошибка при создании монеты: ${e}`;
                }
            }
        }
        
        // NFT delegation functions
        async function delegateNFT(nftId, address, mode) {
            if (mode === 'fee') {
                // Estimate fee for NFT delegation
                try {
                    return await decimalEVM.estimateFeeDelegateNFT({
                        nftId: nftId,
                        address: address
                    });
                } catch(e) {
                    console.error('Fee estimation error:', e);
                    return 0;
                }
            } else {
                // Execute NFT delegation transaction
                try {
                    let txPayload = await decimalEVM.delegateNFT({
                        nftId: nftId,
                        address: address
                    });
                    
                    return await broadcastTx(txPayload);
                } catch(e) {
                    console.error('NFT delegate transaction error:', e);
                    throw `Ошибка при делегировании NFT: ${e}`;
                }
            }
        }
        
        async function withdrawStakeNFT(nftId, address, mode) {
            if (mode === 'fee') {
                // Estimate fee for NFT unbonding
                try {
                    return await decimalEVM.estimateFeeWithdrawStakeNFT({
                        nftId: nftId,
                        address: address
                    });
                } catch(e) {
                    console.error('Fee estimation error:', e);
                    return 0;
                }
            } else {
                // Execute NFT unbond transaction
                try {
                    let txPayload = await decimalEVM.withdrawStakeNFT({
                        nftId: nftId,
                        address: address
                    });
                    
                    return await broadcastTx(txPayload);
                } catch(e) {
                    console.error('NFT unbond transaction error:', e);
                    throw `Ошибка при анбонде NFT: ${e}`;
                }
            }
        }
        
        async function getBalance(address) {
            try {
            let response = await axios.get('https://api.decimalchain.com/api/v1/addresses/' + address + '/balances');
            let root = (response && response.data) ? response.data : {};
            // Addresses service OpenAPI: balances are in root.balances (RespAddressBalances).
            // Some gateways may wrap it as {ok,result:{balances}} - keep backward compatibility.
            let balancesArr = root.balances || (root.result && root.result.balances) || (root.Result && root.Result.balances) || [];

            let balances = [];
            for (let token of balancesArr) {
              let denom = token.denom || (token.coin && token.coin.symbol) || token.symbol || token.coin || token.ticker;
              if (!denom) continue;

              let balance = parseFloat(token.amount);
              if (!isFinite(balance)) continue;

              if (balance < 0.001) {
                  balance = balance.toFixed(8);
              } else {
                  balance = balance.toFixed(3);
              }

              balances.push({coin: denom, amount: balance, type: (token.type || (token.coin && token.coin.type) || 'coin')});
            }
            return balances;
            } catch(e) {
                console.log(JSON.stringify(e));
            return false;
            }
        }

        function spoiler(elem, group){
    style = document.getElementById(elem).style;
    if(document.querySelector("#" + elem).classList.contains(group) && style.display === 'none') {
        $('.' + group).hide();
    }

    style.display = (style.display == 'block') ? 'none' : 'block';
}

function copyText(id) {
    let text = document.getElementById(id);
    text.select();    
  document.execCommand("copy");
    }

    function selectAccount() {
        let current_user = JSON.parse(localStorage.getItem("decimal_current_user"));
        users = JSON.parse(localStorage.getItem('decimal_users'));
        if (users) {
        let radioButtons = '';
        if (users.length === 1) {
            radioButtons += '<input type="radio" name="users" value="' + users[0].login + '" placeholder="' + users[0].login + '" checked> ' + users[0].login + '<a onclick="deleteAccount(`' + users[0].login + '`);">Удалить</a><br />';
        } else if (users.length > 1) {
        for (user of users) {
            if (current_user.login === user.login) {
            radioButtons += '<input type="radio" name="users" value="' + user.login + '" placeholder="' + user.login + '" checked> ' + user.login + ' <a onclick="deleteAccount(`' + user.login + '`);">Удалить</a><br />';
            }     else {
                radioButtons += '<input type="radio" name="users" value="' + user.login + '" placeholder="' + user.login + '"> ' + user.login + '<a onclick="deleteAccount(`' + user.login + '`);">Удалить</a><br />';
            }
        }
        }
        $('#accounts').html(radioButtons);
    }
    }
    
    function deleteAccount(login) {
        let new_list = [];
        if (users.length > 1) {
        for (let user of users) {
        if (user.login !== login) {
            new_list.push(user);
        }
        }
            localStorage.setItem("decimal_users", JSON.stringify(new_list));
            selectAccount()
        $('#delete_msg').html('Аккаунт ' + login + ' удалён из списка.');
        } else if (users.length === 1) {
            selectAccount()
                $('#delete_msg').html('Аккаунт ' + login + ' удалён из списка.');
                localStorage.removeItem('decimal_users');
                localStorage.removeItem('decimal_current_user');
            }
    }
    
    function getRadioValue(radioboxGroupName)
    {
        group=document.getElementsByName(radioboxGroupName);
        for (x=0;x<group.length;x++)
        {
            if (group[x].checked)
            {
    if (users) {
    for (let user of users) {
    if (user.login === group[x].value) {
        localStorage.setItem("decimal_current_user", JSON.stringify(user));
    $('#select_msg').html('Аккаунт ' + user.login + ' выбран. <font color="red"><a onclick="location.reload();">Обновить страницу</a></font>');
    }
    }
    }
                    return (group[x].value);
            }
        }
        return (false);
    }
    
    function sendAjax(url, id) {
        const request = new XMLHttpRequest();
    
    request.open('GET', url);
    request.setRequestHeader('Content-Type', 'application/x-www-form-url');
    request.addEventListener("readystatechange", () => {
        if (request.readyState === 4 && request.status === 200) {
    document.getElementById(id).innerHTML = request.responseText;
        }
    });
     
    // Выполняем запрос 
    request.send();
    }
    
    $(document).on('click', '.ajax_modal', function(e) {
        let url = $(this).attr('data-url');
        let params_str = $(this).attr('data-params');
        sendAjax(url + '?' + params_str, 'ajax_modal_content');
    });