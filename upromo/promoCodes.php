<?php
echo '<main class="content">
<p><strong><a href="https://dpos.space/upromo/">Очередь UPRomo</a></strong></p>
<p>UPromo голосует за посты, продвигаемые в промо путём сжигания GBG. <br />
Здесь вы найдёте список промокодов, действующих для пользователей UPRomo. Они имеют свой баланс и процент прибавки к сумме сжигания. Промокод существует, пока баланс не обнулится.</p>
<p><strong><a href="#" class="popup-open" action="emission">Эмиссия промокода</a></strong></p>';
$html = file_get_contents('http://138.201.91.11:3000/upromo?type=promo_codes');
$table = json_decode($html, true);
echo '<table><thead><tr><th>Код</th><th>Логин</th><th>За что</th><th>Баланс</th><th>Процент прибавки к сумме сжигания</th><th>Действия</th></tr>
<tr><td></td>
<td>            <input id="login_text" placeholder="Введите логин" /></td>
<td><select id="type_select" placeholder="Выберите, за что промокод">
<option value="">---</option>
<option value="За делегирование СГ">За делегирование СГ</option>
<option value="За сжигание максимального количества GBG (в топ 3)">За сжигание максимального количества GBG (в топ 3)</option>
<option value="Эмиссия промокода путём сжигания GBG">Эмиссия промокода путём сжигания GBG</option>
</select></td>
<td></td>
<td><select id="percent_select" placeholder="Выберите процент">
<option value="">---</option>
<option value="5">5%</option>
<option value="10">10</option>
<option value="15">15</option>
<option value="20">20</option>
</select></td>
<td></td>
</tr></thead><tbody id="target">';
if ($table) {
foreach ($table as $promocode) {
$type = '';
if ($promocode['type'] == 'for_delegators') {
$type = 'За делегирование СГ';
} else if ($promocode['type'] == 'for_burn_leaders') {
$type = 'За сжигание максимального количества GBG (в топ 3)';
} else if ($promocode['type'] == 'for_null_transfer') {
    $type = 'Эмиссия промокода путём сжигания GBG';
}    
$isSell = '';
if ($promocode['isSell']['approve'] === false) {
$isSell = '<a href="#" class="popup-open" login="'.$promocode['login'].'" code="'.$promocode['code'].'" action="transfer">перевести</a> или <a href="#" class="popup-open" login="'.$promocode['login'].'" code="'.$promocode['code'].'" action="sell">Продать</a>';
} else if ($promocode['isSell']['approve'] === true) {
$isSell = '<a href="#" class="popup-open" login="'.$promocode['login'].'" code="'.$promocode['code'].'" amount="'.$promocode['isSell']['price'].'" token="'.$promocode['isSell']['symbol'].'" action="buy">Купить</a> или <a href="#" class="popup-open" login="'.$promocode['login'].'" code="'.$promocode['code'].'" action="cancelSale">Отменить продажу</a>';
} else {
$isSell = 'Неизвестно.';
}
echo '<tr><td>'.$promocode['code'].'</td>
<td><a href="https://golos.id/@'.$promocode['login'].'" target="_blank">'.$promocode['login'].'</a></td>
<td>'.$type.'</td>
<td>'.$promocode['balance'].'</td>
<td>'.$promocode['percent'].'</td>
<td>'.$isSell.'</td></tr>';
}
}
echo '</tbody></table>
<div class="popup-fade">
<div class="popup"><a class="popup-close" href="#">Закрыть</a>
<div class="popup-body"></div>
</div>        
</div>

<style>
.popup-fade {
display: none;
}
.popup-fade:before {
content: "";
background: #000;
position: fixed; 
left: 0;
top: 0;
width: 100%; 
height: 100%;
opacity: 0.7;
z-index: 9999;
}
.popup {
position: fixed;
top: 20%;
left: 50%;
padding: 20px;
width: 360px;
margin-left: -200px;    
background: #fff;
border: 1px solid orange;
border-radius: 4px; 
z-index: 99999;
opacity: 1;    
}
.popup-close {
position: absolute;
top: 10px;
right: 10px;
}
</style>
<script src="filterTable.v1.0.min.js"></script>
<script>
filterTable(
document.getElementById("target"),
{
1: document.getElementById("login_text"),
2: document.getElementById("type_select"),
4: document.getElementById("percent_select"),
});

function transferSubmit(sender, receiver, clients, code) {
    let memo_array = {};
memo_array.contractName = "upromo";
memo_array.contractAction = "transfer";
memo_array.contractPayload = {};
memo_array.contractPayload.from = sender;
memo_array.contractPayload.to = receiver;
memo_array.contractPayload.code = code;
let memo = JSON.stringify(memo_array);
let data_url = [];
    data_url.push(["transfer",{"from":sender,"to":"null","amount":"0.001 GBG","memo":memo}]);
    let str_data_url = JSON.stringify(data_url);
    if (clients === "sign") {
        window.open("https://gropox.github.io/sign/?user=" + sender + "&tr=" + str_data_url);
    } else if (clients === "golos_id") {
        window.open("https://golos.id/@" + sender + "/transfers?to=null&amount=0.001&token=gbg&memo=" + memo);
    }
}

function sellSubmit(sender, symbol, price, clients, code) {
    let memo_array = {};
memo_array.contractName = "upromo";
memo_array.contractAction = "sell";
memo_array.contractPayload = {};
memo_array.contractPayload.from = sender;
memo_array.contractPayload.code = code;
memo_array.contractPayload.symbol = symbol;
memo_array.contractPayload.price = parseFloat(price);
let memo = JSON.stringify(memo_array);
let data_url = [];
    data_url.push(["transfer",{"from":sender,"to":"null","amount":"0.001 GBG","memo":memo}]);
    let str_data_url = JSON.stringify(data_url);
    if (clients === "sign") {
        window.open("https://gropox.github.io/sign/?user=" + sender + "&tr=" + str_data_url);
    } else if (clients === "golos_id") {
        window.open("https://golos.id/@" + sender + "/transfers?to=null&amount=0.001&token=gbg&memo=" + memo);
    }
}

function buySubmit(from, to, amount, clients, code) {
    let memo_array = {};
        memo_array.contractName = "upromo";
        memo_array.contractAction = "buy";
        memo_array.contractPayload = {};
        memo_array.contractPayload.to = to;
        memo_array.contractPayload.code = code;
        let memo = JSON.stringify(memo_array);
        let data_url = [];
            data_url.push(["transfer",{"from":to,"to":from,"amount":amount,"memo":memo}]);
            let str_data_url = JSON.stringify(data_url);
            if (clients === "sign") {
                window.open("https://gropox.github.io/sign/?user=" + sender + "&tr=" + str_data_url);
            } else if (clients === "golos_id") {
                let token = amount.split(" ")[1];
                window.open("https://golos.id/@" + to + "/transfers?to=" + from + "&amount=" + parseFloat(amount).toFixed(3) + "&token=" + token + "&memo=" + memo);
            }
}

function cancelSaleSubmit(sender, clients, code) {
    let memo_array = {};
        memo_array.contractName = "upromo";
        memo_array.contractAction = "cancelSale";
        memo_array.contractPayload = {};
        memo_array.contractPayload.from = sender;
        memo_array.contractPayload.code = code;
        let memo = JSON.stringify(memo_array);
        let data_url = [];
            data_url.push(["transfer",{"from":sender,"to":"null","amount":"0.001 GBG","memo":memo}]);
            let str_data_url = JSON.stringify(data_url);
            if (clients === "sign") {
                window.open("https://gropox.github.io/sign/?user=" + sender + "&tr=" + str_data_url);
            } else if (clients === "golos_id") {
                window.open("https://golos.id/@" + sender + "/transfers?to=null&amount=0.001&token=gbg&memo=" + memo);
            }
}

function emissionSubmit(sender, receiver, amount, clients) {
    let memo_array = {};
memo_array.contractName = "upromo";
memo_array.contractAction = "emission";
memo_array.contractPayload = {};
memo_array.contractPayload.to = receiver;
let memo = JSON.stringify(memo_array);
let data_url = [];
    data_url.push(["transfer",{"from":sender,"to":"null","amount":parseFloat(amount).toFixed(3) + " GBG","memo":memo}]);
    let str_data_url = JSON.stringify(data_url);
    if (clients === "sign") {
        window.open("https://gropox.github.io/sign/?user=" + sender + "&tr=" + str_data_url);
    } else if (clients === "golos_id") {
        window.open("https://golos.id/@" + sender + "/transfers?to=null&amount=" + parseFloat(amount).toFixed(3) + "&token=gbg&memo=" + memo);
    }
}

$(document).ready(function($) {
    $(".popup-open").click(function (e) {
        let login = $(this).attr("login");
        let code = $(this).attr("code");
    let action = $(this).attr("action");
    let buy_amount = $(this).attr("amount");
    let buy_token = $(this).attr("token");
    if (action === "transfer" && code && login) {
    $(".popup-body").html(`<h2>Перевод промокода ${code}</h2>
<form>
<p><label for="login">Отправитель:
<input type="text" readonly name="login" id="sender" value="` + login + `"></label></p>
<p><label for="to">Получатель:
<input type="text" name="to" id="receiver" value=""></label></p>
<p style="display:none;"><label for="service">
<select name="service" id="clients">
<option selected value="sign">Писарь</option>
<option value="golos_id">golos.id</option>
</select>
</label></p>
<input type="hidden" name="code" id="promocode-code" value="` + code + `">
<p><button type="button" onclick="transferSubmit(this.form.login.value, this.form.to.value, this.form.service.value, this.form.code.value)">Перевести</button></p>
</form>`);
} else if (action === "sell" && code && login) {
    $(".popup-body").html(`<h2>Продажа промокода ${code}</h2>
<form>
<p><label for="login">Продавец (должен быть владельцем промокода):
<input type="text" readonly name="login" id="sender" value="` + login + `"></label></p>
<p><label for="symbol">Токен:
    <select name="symbol">
    <option value="GBG">GBG</option>
    <option value="GOLOS">GOLOS</option>
</select>
<p><label for="price">Цена:
<input type="text" name="price" id="sell_price" value=""></label></p>
<p style="display: none;"><label for="service">
<select name="service" id="clients">
<option selected value="sign">Писарь</option>
<option value="golos_id">golos.id</option>
</select>
</label></p>
<input type="hidden" name="code" id="promocode-code" value="` + code + `">
<p><button type="button" onclick="sellSubmit(this.form.login.value, this.form.symbol.value, this.form.price.value, this.form.service.value, this.form.code.value)">Продать</button></p>
</form>`);
} else if (action === "buy" && code && login && buy_amount && buy_token) {
    $(".popup-body").html(`<h2>Купить промокод ${code}</h2>
<form>
<p><label for="login">Продавец (должен быть владельцем промокода):
<input type="text" readonly name="login" id="from" value="` + login + `"></label></p>
<p><label for="buyer">Логин покупателя на Голосе:
    <input type="text" name="buyer" id="to" value=""></label></p>
    <p><label for="amount">Цена промокода:
            <input type="text" readonly name="amount" id="promocode-amount" value="` + parseFloat(buy_amount).toFixed(3) + ` ` + buy_token + `"></label></p>
    <p><label for="service">
<select name="service" id="clients">
<option value="golos_id">golos.id</option>
<option value="sign">Писарь</option>
</select>
</label></p>
<input type="hidden" name="code" id="promocode-code" value="` + code + `">
<p><button type="button" onclick="buySubmit(this.form.login.value, this.form.buyer.value, this.form.amount.value, this.form.service.value, this.form.code.value)">Купить</button></p>
</form>`);
} else if (action === "cancelSale" && code && login) {
    $(".popup-body").html(`<h2>Отмена продажи промокода ${code}</h2>
<form>
<p><label for="login">Продавец (должен быть владельцем промокода):
<input type="text" readonly name="login" id="sender" value="` + login + `"></label></p>
<p><label for="service">
<select name="service" id="clients">
<option value="golos_id">golos.id</option>
<option value="sign">Писарь</option>
</select>
</label></p>
<input type="hidden" name="code" id="promocode-code" value="` + code + `">
<p><button type="button" onclick="cancelSaleSubmit(this.form.login.value, this.form.service.value, this.form.code.value)">Отменить продажу</button></p>
</form>`);
} else if (action === "emission") {
    $(".popup-body").html(`<h2>Эмиссия промокода. Будет создан промокод с суммой сожженных GBG и 20% прибавкой к сжигаемому</h2>
<form>
<p><label for="login">Отправитель:
<input type="text" name="login" id="sender" value=""></label></p>
<p><label for="to">Получатель:
<input type="text" name="to" id="receiver" value=""></label></p>
<p><label for="amount">Сумма:
<input type="text" name="amount" id="promocode_amount" value=""></label></p>
<p><label for="service">
<select name="service" id="clients">
<option value="golos_id">golos.id</option>
<option value="sign">Писарь</option>
</select>
</label></p>
<p><button type="button" onclick="emissionSubmit(this.form.login.value, this.form.to.value, this.form.amount.value, this.form.service.value)">Создать</button></p>
</form>`);
}     else {
    $(".popup-body").html(`<h2>Перевод промокода ${code}</h2>
<form>
<p><label for="login">Логин:
<input type="text" name="login" id="sender" value=""></label></p>
<p><label for="amount">Сумма (в GBG):
<input type="text" name="amount" id="burn_amount" value=""></label></p>
<p><label for="service">
<select name="service" id="clients">
<option value="golos_id">golos.id</option>
<option value="sign">Писарь</option>
</select>
</label></p>
<p><button type="button" class="transfer_submit">Перевести</button></p>
</form>`);
}    
    $(".popup-fade").fadeIn();
    return false;
    });
    
    $(".popup-close").click(function() {
    $(this).parents(".popup-fade").fadeOut();
    return false;
    });        
    
    $(document).keydown(function(e) {
    if (e.keyCode === 27) {
    e.stopPropagation();
    $(".popup-fade").fadeOut();
    }
    });
    
    $(".popup-fade").click(function(e) {
    if ($(e.target).closest(".popup").length == 0) {
    $(this).fadeOut();                    
    }
    });
    });
</script></main>';
?>