<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<div>
<h2>2. Создание майнера</h2>
<form>
<p><label for="name">Название</label><br>
        <input type="text" id = "name"></p>
        <p><label for="symbol">Тикер</label><br>
        <input type="text" id = "symbol"></p>
        <p><label for="rewardTokenAddress">Адрес токена, в котором будут начисляться вознаграждения</label><br>
        <input type="text" id = "rewardTokenAddress"></p>
        <p><label for="firstPrice">Начальная цена (цена покупки первого майнера)</label><br>
        <input type="number" min = "0.0000000000001" step="0.0000000000001" id = "firstPrice"></p>
        <p><label for="increment">На сколько процентов увеличится стоимость следующего майнера?</label><br>
        <input type="number" min = "1" id ="increment"></p>
        <p><label for="totalDays">Сколько дней будут начлсляться награды?</label><br>
        <input type="number" min = "1" id = "totalDays"></p>
        <p><label for="rewardPerDay">Размер вознаграждения за 1 майнера за 1 день</label><br>
        <input type="number" min = "0.000000000000000001" id = "rewardPerDay"></p>
        <p><label for="totalMiners">Количество майнеров (всего)</label><br>
        <input type="number" min = "1" id = "totalMiners"></p>
		<p><button type="button" onclick="createMiner()">Создать майнер</button></p>
</form>
        <p><b>Результат:</b> <span id="resultLog"></p>
        </div>
<div id="mintMiner" style="display: none;">
<h2>Минт майнера</h2>
<form>
<p><button type="button" onclick="mintMiner()">Минт!</button></p>
</form>
</div>
    <div id="getRewards" style="display: none;">
    <h2>Получайте награды</h2>
<form>
    <p><button type="button" onclick="getRewards()">Получить мои награды!</button></p>
</form>
    </div>
    <h2>Автор</h2>
<p>Незрячий разработчик Денис Скрипник. Канал: <a href="https://t.me/blind_dev" target="_blank">@blind_dev</a><br>
<a href="https://github.com/denis-skripnik/tokens-panel" target="_blank">Github</a></p>
    <script>
          	const tokenAddressFromURL = getParameterByName("address");
            if (tokenAddressFromURL !== "") {
	document.getElementById("mintMiner").style.display = "block";
	document.getElementById("getRewards").style.display = "block";
}
    </script>';
    ?>