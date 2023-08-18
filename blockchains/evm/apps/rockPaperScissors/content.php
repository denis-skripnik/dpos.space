<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<div>
    <h2>2. Игра!</h2>
    <p>Адрес смарт-контракта для отправки тестовых токенов: <span id="smartContractAddress"></span></p>
    <p> Добавьте сумму в <span id="nativeToken">MEGA2</span> для игры</p>
        <input type="number" min = "0" id = "amountInEth">
        <p>Выберите игровой предмет</p>
<select id="game_item">
<option value="0">Камень</option>
<option value="1">Ножницы</option>
<option value="2">Бумага</option>
</select>
        <button onclick="runGame()">Играть!</button>
        <button onclick="handleEvent()">Последнее событие</button>
        <p><b>Результат:</b> <span id="resultLog"></p>
    </div>';
    ?>