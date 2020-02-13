<?php
echo '<main class="content">
<p><strong><a href="https://dpos.space/upromo/promo-codes">Список промокодов</a></strong></p>
<p>UPromo голосует за посты, продвигаемые в промо путём сжигания GBG. <br />
 Для этого нажимайте "продвинуть" под постом на golos.id или отправляйте сумму от 1 GBG к null с memo вида @author/permlink.</p>
 <p>Ниже вы найдёте таблицу со списком постов. Чем выше пост, тем быстрее он будет поддержан.</p>
 <p>Минималка добавления для повышения/понижения в очереди - 1 GBG.</p>
<h2>Новый пост:</h2>
<p><strong><a href="#" class="popup-open" action="create">Продвинуть</a></strong></p>
<h2>Или повлияйте на находящиеся в очереди</h2>';
 $html = file_get_contents('http://138.201.91.11:3000/upromo?type=list');
 $table = json_decode($html, true);
 echo '<table><thead><tr><th>Место в очереди и url</th><th>Кураторам</th><th>Количество сожженных GBG</th><th>Дата выплаты (сгорания поста)</th><th>Действие</th></tr></thead><tbody>';
if ($table) {
 foreach ($table as $post_count => $post) {
$post_count += 1;
    echo '<tr><td>'.$post_count.'. <a href="https://golos.id/'.$post['url'].'" target="_blank">'.$post['url'].'</a></td>
<td>'.$post['curation_rewards_percent'].'%</td>
    <td>'.$post['amount'].'</td>
<td>'.$post['end'].'</td>
<td><a href="#" class="popup-open" action="join" memo="'.$post['url'].'">Продвинуть</a> или <a href="#" class="popup-open" action="join" memo="-'.$post['url'].'">задвинуть</a></td>';
}
}
echo '</tbody></table>';
echo '<div class="popup-fade">
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
function submitBurn(sender, clients, amount, memo) {
if (amount >= 1) {
    amount *= 1000;
    amount = parseInt(amount);
    amount /= 1000;
    amount = amount.toFixed(3);
    let data_url = [];
    data_url.push(["transfer",{"from":sender,"to":"null","amount":amount + " GBG","memo":memo}]);
    let str_data_url = JSON.stringify(data_url);
    if (clients === "sign") {
        window.location.href = "https://gropox.github.io/sign/?user=" + sender + "&tr=" + str_data_url;
    } else if (clients === "golos_id") {
        window.open("https://golos.id/@" + sender + "/transfers?to=null&amount=" + amount + "&token=gbg&memo=" + memo);
    } else if (clients === "golos_io") {
        window.open("https://golos.id/@" + sender + "/transfers?to=null&amount=" + amount + "&token=gbg&memo=" + memo);
    }
} else {
window.alert("Ошибка: сумма < 1 GBG.");
}
}
$(document).ready(function($) {
$(".popup-open").click(function (e) {
let memo = $(this).attr("memo");
let action = $(this).attr("action");
if (action === "join" && memo) {
    $(".popup-body").html(`<h2>Продвигаем или задвигаем пост, сжигая GBG</h2>
<form>
<p><label for="memo">Автор и пермлинк поста:
    <input type="text" name="memo" id="post_data" readonly value="` + memo + `"></label></p>
<p><label for="login">Логин:
<input type="text" name="login" id="sender" value=""></label></p>
<p><label for="amount">Сумма (в GBG):
<input type="text" name="amount" id="burn_amount" value=""></label></p>
<p><label for="service">При помощи чего сжигать GBG: 
<select name="service" id="clients">
    <option value="golos_id">golos.id</option>
    <option value="sign">Писарь</option>
</select>
</label></p>
<p><button type="button" onclick="submitBurn(this.form.login.value, this.form.service.value, this.form.amount.value, this.form.memo.value)">Сжечь</button></p>
</form>`);
} else if (action === "create") {
    $(".popup-body").html(`<h2>Продвигаем или задвигаем пост, сжигая GBG</h2>
<form>
<p><label for="memo">Url поста или @автор/пермлинк (если хотите продвигать в промо):
    <input type="text" name="memo" id="post_url" value=""></label></p>
<p><label for="login">Логин:
<input type="text" name="login" id="sender" value=""></label></p>
<p><label for="amount">Сумма (в GBG):
<input type="text" name="amount" id="burn_amount" value=""></label></p>
<p><label for="service">При помощи чего сжигать GBG: 
<select name="service" id="clients">
    <option value="golos_id">golos.id</option>
    <option value="sign">Писарь</option>
</select>
</label></p>
<p><button type="button" onclick="submitBurn(this.form.login.value, this.form.service.value, this.form.amount.value, this.form.memo.value)">Сжечь</button></p>
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
</script>
</main>';
?>