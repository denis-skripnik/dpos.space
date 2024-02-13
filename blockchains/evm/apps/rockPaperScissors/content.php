<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<div>
    <h2>2. Игра!</h2>
    <p>Адрес смарт-контракта для отправки тестовых токенов: <span id="smartContractAddress"></span></p>
<form>
    <p><label for="amountInEth">Добавьте сумму в <span id="nativeToken">MEGA2</span> для игры</label><br>
        <input type="number" min = "0" id = "amountInEth"></p>
        <p><label for="game_item">Выберите игровой предмет</label><br>
<select id="game_item">
<option value="0">Камень</option>
<option value="1">Ножницы</option>
<option value="2">Бумага</option>
</select></p>
        <p><button onclick="runGame()">Играть!</button><br>
        <button onclick="handleEvent()">Последнее событие</button></p>
</form>
        <p><b>Результат:</b> <span id="resultLog"><p>
    </div>';
    ?>