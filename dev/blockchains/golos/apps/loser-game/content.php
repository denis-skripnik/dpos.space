<?php
$html = file_get_contents('http://94.130.180.46:3000/loser-game?chain='.pageUrl()[0].'&type=active');
    $table = json_decode($html, true);
 $r = '<h2>Создайте свой раунд</h2>
 <p><strong><a href="#" class="popup-open" action="create">Играть</a></strong></p>
<h2>или присоединитесь к существующему</h2>
 <table><thead><tr><th>Сумма раунда</th><th>Участники</th><th>Стартовый блок раунда</th><th>Действия</th></tr></thead><tbody>';
if ($table) {
 foreach ($table as $round) {
    $r .= '<tr><td>'.$round['amount'].' '.$round['token'].'</td>';
$transfers = '';
    foreach($round['transfers'] as $transfer) {
$transfers .= '<a href="https://golos.id/@'.$transfer.'" target="_blank">@'.$transfer.'</a>, ';
}
$transfers = substr($transfers,0,-2);
$r .= '<td>'.$transfers.'</td>
<td>'.$round['start_round_block'].'</td>
<td><a href="#" class="popup-open" action="join" amount="'.$round['amount'].'" token="'.$round['token'].'">Играть</a></td>';
}
}
$r .= '</tbody></table>
<div class="popup-fade">
<div class="popup">
    <a class="popup-close" href="#">Закрыть</a>
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
<script>
function submitJoin(sender, clients, amount, token) {
    let data_url = [];
    data_url.push(["transfer",{"from":sender,"to":"loser","amount":amount + " " + token,"memo":"Играю при помощи https://dpos.space/'.pageUrl()[0].'/loser-game!"}]);
    let str_data_url = JSON.stringify(data_url);
    ;    if (clients === "sign") {
        window.open("https://gropox.github.io/sign/?user=" + sender + "&tr=" + str_data_url);
        location.reload();
    } else if (clients === "golos_id") {
        window.open("https://golos.id/@" + sender + "/transfers?to=loser&amount=" + amount + "&token=" + token + "&memo=Играю при помощи https://dpos.space/'.pageUrl()[0].'/loser-game!");
        location.reload();
    }
}

function submitCreate(sender, clients, amount, token) {
    let data_url = [];
    data_url.push(["transfer",{"from":sender,"to":"loser","amount":amount + " " + token,"memo":"Играю при помощи https://dpos.space/'.pageUrl()[0].'/loser-game!"}]);
    let str_data_url = JSON.stringify(data_url);
    ;    if (clients === "sign") {
        window.open("https://gropox.github.io/sign/?user=" + sender + "&tr=" + str_data_url);
        location.reload();
    } else if (clients === "golos_id") {
        window.open("https://golos.id/@" + sender + "/transfers?to=loser&amount=" + amount + "&token=" + token + "&memo=Играю при помощи https://dpos.space/'.pageUrl()[0].'/loser-game/!");
        location.reload();
    }
}

$(document).ready(function($) {
$(".popup-open").click(function (e) {
    let amount = $(this).attr("amount");
    amount *= 1000;
amount = parseInt(amount);
amount /= 1000;
amount = amount.toFixed(3);
let token = $(this).attr("token");
let action = $(this).attr("action");
if (action === "join" && amount && token) {
    $(".popup-body").html(`<h2>Присоединиться к существующему раунду</h2>
<form>
<p><label for="amount">Сумма раунда:
<input type="text" name="amount" readonly value="` + amount + `"></label></p>
<p><label for="token">Токен раунда:
<input type="text" name="token" readonly value="` + token + `">
<p><label for="login">Логин:
<input type="text" name="login" id="sender" value=""></label></p>
<p><label for="service">При помощи чего переводить: 
<select name="service" id="clients">
    <option value="golos_id">golos.id</option>
    <option value="sign">Писарь</option>
</select>
</label></p>
<p><button type="button" onclick="submitJoin(this.form.login.value, this.form.service.value, this.form.amount.value, this.form.token.value)">Поехали!</button></p>
</form>`);
} else if (action === "create") {
    $(".popup-body").html(`<h2>Создание нового раунда</h2>
<form>
<p><label for="login">Логин:
<input type="text" name="login" id="sender" value=""></label></p>
<p><label for="amount">Сумма:
<input type="text" name="amount" id="round_amount" value=""></label></p>
<p><label for="token">Токен: 
<select name="token" id="round_token">
    <option value="GOLOS">GOLOS</option>
    <option value="GBG">GBG</option>
</select>
</label></p>
<p><label for="service">При помощи чего перевести: 
<select name="service" id="clients">
    <option value="golos_id">golos.id</option>
    <option value="sign">Писарь</option>
</select>
</label></p>
<p><button type="button" onclick="submitCreate(this.form.login.value, this.form.service.value, this.form.amount.value, this.form.token.value)">Поехали!</button></p>
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
</script>';
return $r;
?>