<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<div>
        <h2>2. Создание токена</h2>
<form>
<p><label for="name">Название</label><br>
        <input type="text" id = "name"></p>
<p><label for="symbol">Тикер</label><br>
<input type="text" id = "symbol"></p>
<p><label for="start_supply">Начальная эмиссия</label><br>
        <input type="number" min = "1" id = "start_supply"></p>
        <p><label for="max_supply">Total supply</label><br>
        <input type="number" min = "1" id = "max_supply"></p>
        <p><button onclick="createAsset()">Создать токен</button></p>
</form>
        <div><b>Результат:</b> <span id="resultLog"></div>
        </div>
	<div id="mintToken" style="display: none;">
        <h2>Минт токена, если вы - создатель смартконтракта</h2>
    <p>Сумма будет переведена на ваш кошелёк.</p>
<form>
<p><label for="mint_amount">Сумма минта</label>
        <input type="number" min = "1" id = "mint_amount"></p>
        <p><button onclick="mintToken()">Минт</button></p>
</form>
        </div>
    <h2>Донат</h2>
<p>0xaeac266a4533CB0B4255eA2922f997353a18B2E8</p>
<h2>Автор</h2>
<p>Незрячий разработчик Денис Скрипник. Канал: <a href="https://t.me/blind_dev" target="_blank">@blind_dev</a><br>
<a href="https://github.com/denis-skripnik/tokens-panel" target="_blank">Github</a></p>
    <script>
          	const tokenAddressFromURL = getParameterByName("address");
            if (tokenAddressFromURL !== "") {
	document.getElementById("mintToken").style.display = "block";
}
    </script>';
?>