<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<div>
    <h2>2. Перевод</h2>
<form>
    <p><label for="eth_amount">Сумма в ETH</label><br>
        <input type="number" min = "0" id = "eth_amount"><br>
<input type="button" onclick="setMaxAmount()" value="Максимум"></p>
<p><button id="run_send" onclick="sendEth()">Перевести в <span id="chain_name"></span></button></p>
</form>
    </div>';
    ?>