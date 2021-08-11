var buttonSignTx = document.querySelector("a.signtx");
buttonSignTx.addEventListener("click", function( event ) {
    buttonSignTx.classList.add('wait');
viz.api.getAccounts([viz_login], function(err, result) {
  if(err)return alert(err)
  var maccs = result[0].regular_authority.account_auths,
   amaccs = result[0].active_authority.account_auths,
   wt = result[0].regular_authority.weight_threshold,
   awt =  result[0].active_authority.weight_threshold,
  log = "Минимальный суммарный вес threshold для записи транзакции в блокчейн:  постинг - "+wt+", активный:"+awt+" </br>Аккаунты которые могут подписать транзакцию от @"+viz_login+" (логин,вес):</br>Постинги: "+maccs+"</br>Активные: "+amaccs;
  return document.getElementById('out').insertAdjacentHTML("afterbegin","<div class='log'>"+log+"</br></br>");
});
var newTx = "";
try {
    newTx = JSON.parse(document.getElementById("unsigned").value);
}
catch (error) {
    if (error instanceof SyntaxError) {
        alert("Вы ввели неправильный формат данных в поле операций: " + error.message);
    }
    else {
        throw error;
    }
}
var wif = '';
var wif_list = document.getElementById("wif").value;
if (wif_list === 'active_key') {
    wif = active_key;
} else {
    wif = posting_key;
}
var now = new Date().getTime()+18e5,
expire = new Date(now).toISOString().split('.')[0];
viz.api.getDynamicGlobalProperties(function(e, current) {
//viz.api.getBlockHeader(blockNum, function(err, result) {
    var blockid =current.head_block_id;
    n = [];
    for (var i = 0; i < blockid.length; i += 2) {
        n.push(blockid.substr(i, 2));
    }
    var hex = n[7]+n[6]+n[5]+n[4];
    var refBlockNum = current.head_block_number & 0xffff;
    var refBlockPrefix = parseInt(hex, 16) 
var trx = {
 'expiration': expire,    
 'extensions': [],
 'operations': newTx,
 'ref_block_num': refBlockNum,
'ref_block_prefix': refBlockPrefix             
};
var trxs = "";
try {
    trxs = viz.auth.signTransaction(trx,{"regular_authority":wif});
}
catch (error) {
    alert("Не удалось подписать транзакцию: " + error.message);
    return buttonSignTx.classList.remove("wait");
}
var json = JSON.stringify(trxs, null, 4);
 buttonSignTx.classList.remove("wait");
  return document.getElementById('out').insertAdjacentHTML("afterbegin","📜 Скопируйте код транзакции и передайте на подпись следующему участнику мультисиг-аккаунта</br><pre>"+json+"</pre></br>Обратите внимание на переменную expiration - в ней указана дата в GMT 0 после которой транзакция станет не действительной. Если участники мультисига не успеют подписать и отправить транзакцию до этой даты - сформируйте новую!")
//});
});
var buttonSignTxStep2 = document.querySelector("a.signtx-step2");
buttonSignTxStep2.addEventListener("click", function( event ) {
    buttonSignTxStep2.classList.add('wait');
viz.api.getAccounts([viz_login], function(err, result) {
  if(err)return console.log(err)
  var maccs = result[0].regular_authority.account_auths,
   amaccs = result[0].active_authority.account_auths,
   wt = result[0].regular_authority.weight_threshold,
   awt =  result[0].active_authority.weight_threshold,
  log = "Минимальный суммарный вес threshold для записи транзакции в блокчейн:  постинг - "+wt+", активный:"+awt+" </br>Аккаунты которые могут подписать транзакцию от @"+viz_login+" (логин,вес):</br>Постинги: "+maccs+"</br>Активные: "+amaccs;
  return document.getElementById('out-step2').insertAdjacentHTML("afterbegin","<div class='log'>"+log+"</br></br>");
});
var newTx = "";
try {
    newTx = JSON.parse(document.getElementById("unsigned-step2").value);
}
catch (error) {
    if (error instanceof SyntaxError) {
        alert("Вы ввели неправильный формат данных в поле операций: " + error.message);
    }
    else {
        throw error;
    }
}
var wif = '';
var wif_list = document.getElementById("wif-step2").value;
if (wif_list === 'active_key') {
    wif = active_key;
} else {
    wif = posting_key;
}
trx = newTx;
var trxs = "";
try {
    trxs = viz.auth.signTransaction(trx,{"regular_authority":wif});
}
catch (error) {
    alert("Не удалось подписать транзакцию: " + error.message);
    return  buttonSignTxStep2.classList.remove("wait");
}
var json = JSON.stringify(trxs, null, 4);
document.getElementById('out-step2').insertAdjacentHTML("afterbegin","📜<pre>"+json+"</pre>")
viz.api.broadcastTransactionSynchronous(trxs, function(err, result) {
    buttonSignTxStep2.classList.remove("wait");
        if(err)return alert(err)
        var trxid = result.id
       if(!trxid)alert('Ошибка',result)
        document.getElementById('out-step2').insertAdjacentHTML("afterbegin","📜<pre>"+JSON.stringify(result)+"</pre><h3>Транзакция успешно отправлена в блокчейн. ID транзакции: <a href='http://vizd.com/tx/"+trxid+"'>"+trxid+"</a></h3></br></br></br></br>")
 });
});
});
var buttonSignTxStep3 = document.querySelector("a.signtx-step3");
buttonSignTxStep3.addEventListener("click", function( event ) {
    buttonSignTxStep3.classList.add('wait');
var newTx = "";
try {
    newTx = JSON.parse(document.getElementById("unsigned-step3").value);
}
catch (error) {
    buttonSignTxStep3.classList.remove("wait");
    if (error instanceof SyntaxError) {
        alert("Вы ввели неправильный формат данных в поле операций: " + error.message);
    }
    else {
        throw error;
    }
}
viz.api.broadcastTransactionSynchronous(newTx, function(err, result) {
    buttonSignTxStep3.classList.remove("wait");
        if(err)return alert(err)
       var trxid = result.id
       if(!trxid)alert('Ошибка',result)
        document.getElementById('out-step3').insertAdjacentHTML("afterbegin","Транзакция отправлена, проверить в блокчейн: </br><h3><a href='http://vizd.com/tx/"+trxid+"'>📜 "+trxid+"</a></h3>")
});
});
var AddMultiAuth = document.querySelector("a.addMultisig");
AddMultiAuth.addEventListener("click", function( event ) {
    AddMultiAuth.classList.add("wait");
weightThreshold= Number(document.getElementById("weight-threshold").value),
auths = document.getElementById("auths").value,
splitAuths = auths.split("/"),
authsArray =[];
for (var i = 0; i < splitAuths.length; i++) {
var z = splitAuths[i].split("=")
authsArray.push([z[0],Number(z[1])])
}
console.log(authsArray)
viz.api.getAccounts([viz_login], function(e, data){
    if (e) return alert(e)
       var account = data[0],
     regular_authority,
      active_authority;
      var maccs = account.regular_authority.account_auths,
amaccs = account.active_authority.account_auths,
select = document.getElementById('selectAuth');
valueSelect = select.options[select.selectedIndex].value; 
     if(valueSelect === 'regular_authority'){
for (regular_account of maccs) {
    authsArray.push([regular_account[0], regular_account[1]]);
}
                regular_authority =  {
        "weight_threshold":weightThreshold,
        "account_auths": authsArray,
        "key_auths": [
          [
          account.regular_authority.key_auths[0][0],
            weightThreshold
          ]
        ]
      }
     }else if(valueSelect === 'active_authority'){
        for (active_account of amaccs) {
    authsArray.push([active_account[0], active_account[1]]);
}
      active_authority =  {
        "weight_threshold":weightThreshold,
        "account_auths": authsArray,
        "key_auths": [
          [
          account.active_authority.key_auths[0][0],
            weightThreshold
          ]
        ]
      }
    }
console.log(active_authority,regular_authority)
         var memo = account.memo_key;
console.log(regular_authority)
if(current_user.type && current_user.type === 'vizonator') {
    window.alert('Операция не поддерживается расширением Vizonator. Просьба выбрать аккаунт, авторизованный при помощи ключей на dpos.space.');
    return;
    }
viz.broadcast.accountUpdate(active_key, 
viz_login, undefined, active_authority, 
regular_authority, memo
               , account.json_metadata, function(err, result) {
         console.log(err,result)
         AddMultiAuth.classList.remove("wait");
             if(err){  var jsone = JSON.stringify(err, null, 4);
         alert(jsone)
 return document.getElementById('out-step4').insertAdjacentHTML("afterbegin","<div class='err'>Ошибка!</div>")
  }else{
    var json = JSON.stringify(result, null, 4);
  document.getElementById('out-step4').insertAdjacentHTML("afterbegin","<h2>Готово!</h2>Лог транзакции в блокчейн: </br><code>"+json+"</code>")
  }
       });
});
})
var deleteBUTT = document.querySelector("a.delete-multi");
deleteBUTT.addEventListener("click", function( event ) {
    deleteBUTT.classList.add("wait");
viz.api.getAccounts([viz_login], function(e, data){
     if (e) return alert(e)
       var account = data[0];
       var pAuth = {"weight_threshold": 1,"account_auths": [],"key_auths":account.regular_authority.key_auths};
       var active_authority = {"weight_threshold": 1,"account_auths": [],"key_auths":account.active_authority.key_auths};
         var memo = account.memo_key;
         if(current_user.type && current_user.type === 'vizonator') {
            window.alert('Операция не поддерживается расширением Vizonator. Просьба выбрать аккаунт, авторизованный при помощи ключей на dpos.space.');
            return;
            }
         viz.broadcast.accountUpdate(active_key, 
viz_login, undefined, active_authority, 
           pAuth, memo
               , account.json_metadata, function(err, result) {
         console.log(err,result);
         deleteBUTT.classList.remove("wait");
             if(err){  var jsone = JSON.stringify(err, null, 4);
         alert(jsone)
 return document.getElementById('out-step5').insertAdjacentHTML("afterbegin","<div class='err'><h2>Ошибка!</h2>Подробности ошибки смотрите в консоли браузера. "+jsone+"</div>")
  }else{
    var json = JSON.stringify(result, null, 4);
  document.getElementById('out-step5').insertAdjacentHTML("afterbegin","<h2>Успешно</h2>Лог транзакции в блокчейн: </br><code>"+json+"</code>")
  }
       });
});
})