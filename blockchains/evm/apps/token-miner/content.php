<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<div>
<h2>2. Создание майнера</h2>
<p>Название</p>
        <input type="text" id = "name">
        <p>Тикер</p>
        <input type="text" id = "symbol">
        <p> Адрес токена, в котором будут начисляться вознаграждения</p>
        <input type="text" id = "rewardTokenAddress">
        <p> Начальная цена (цена покупки первого майнера)</p>
        <input type="number" min = "1" id = "firstPrice">
        <p> На сколько процентов увеличится стоимость следующего майнера?</p>
        <input type="number" min = "1" id = "increment">
        <p> Сколько дней будут начлсляться награды?</p>
        <input type="number" min = "1" id = "totalDays">
        <p> Размер вознаграждения за 1 майнера за 1 день</p>
        <input type="number" min = "0.000000000000000001" id = "rewardPerDay">
        <p> Количество майнеров (всего)</p>
        <input type="number" min = "1" id = "totalMiners">
		<button onclick="createMiner()">Создать майнер</button>
        <p><b>Результат:</b> <span id="resultLog"></p>
        </div>
<div id="mintMiner" style="display: none;">
<h2>Минт майнера</h2>
        <button onclick="mintMiner()">Минт!</button>
    </div>
    <div id="getRewards" style="display: none;">
    <h2>Получайте награды</h2>
        <button onclick="getRewards()">Получить мои награды!</button>
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