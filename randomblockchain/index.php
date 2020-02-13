<?php
$chain = $_GET['chain'];
$start_block = $_GET['block1'];
$end_block = $_GET['block2'];
$participants = $_GET['participants'];
if ($chain == 'golos') {
$start_link = '<a href="https://ropox.app/steemjs/api/database_api/get_block?blockchain=Lex&ws=wss%3A%2F%2Fgolos.lexa.host%2Fws&blockNum='.$start_block.'" target="_blank">'.$start_block.'</a>';
$end_link = '<a href="https://ropox.app/steemjs/api/database_api/get_block?blockchain=Lex&ws=wss%3A%2F%2Fgolos.lexa.host%2Fws&blockNum='.$end_block.'" target="_blank">'.$end_block.'</a>';
} else if ($chain == 'steem') {
    $start_link = $start_block;
    $end_link = $end_block;
} else if ($chain == 'viz') {
    $start_link = '<a href="https://ropox.app/viz/api/database_api/get_block?blockchain=Lex&ws=wss%3A%2F%2Fviz.lexa.host%2Fws&blockNum='.$start_block.'" target="_blank">'.$start_block.'</a>';
    $end_link = '<a href="https://ropox.app/viz/api/database_api/get_block?blockchain=Lex&ws=wss%3A%2F%2Fviz.lexa.host%2Fws&blockNum='.$end_block.'" target="_blank">'.$end_block.'</a>';
}
?>
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Генератор случайных чисел randomblockchain для <?= $chain ?></title>
<?php
if ($chain == 'golos') {
    echo '<script src="https://unpkg.com/golos-js@latest/dist/golos.min.js"></script>
<script>
var gate = golos;
gate.config.set("websocket","wss://golos.lexa.host/ws");
</script>';
} else if ($chain == 'steem') {
echo '<script src="https://dpos.space/post/static/steem.min.js"></script>
<script>
var gate = steem;
gate.api.setOptions({ url: "https://steemd.minnowsupportproject.org"});
</script>';
} else if ($chain == 'viz') {
echo '<script src="https://cdn.jsdelivr.net/npm/viz-js-lib@latest/dist/viz.min.js"></script>
<script>
var gate = viz;
gate.config.set("websocket","wss://viz.lexa.host/ws");
</script>';
}
?>
</head>
<body>
<div >
    <h1>Стартовый блок раунда <?= $start_link ?>, блок последнего участника раунда <?= $end_link ?></h1>
<h2><a href="https://golos.id/ru/@denis-skripnik/ru-generator-sluchaijnykh-chisel-na-baze-dannykh-iz-bch" target="_blank">Принцип генерации случайных чисел в этом посте</a></h2>
<h3> Участников: <?= $participants ?></h3>
<p><strong>Репозиторий: <a href="https://github.com/gropox/randomblockchain" target="_blank">https://github.com/gropox/randomblockchain</a></strong></p>
    <script>
function blocksData() {
gate.api.getBlock(<?= $start_block ?>, function (err, res) {
if (!err) {
    document.getElementById('sig1').innerHTML = res.witness_signature;
} else {
    blocksData();
}
    });
    gate.api.getBlock(<?= $end_block ?>, function (error, result) {
if (!error) {
    document.getElementById('sig2').innerHTML = result.witness_signature;
} else {
    blocksData();
}
    });
}
    </script>
        <div>
    <label>Сигнатура первого указанного блока</label><br/>
    <textarea id="sig1" cols="100" rows="5"></textarea>
    </div>
    <div>
    <label>Сигнатура второго указанного блока</label><br/>
    <textarea id="sig2" cols="100" rows="5"></textarea>
	</div>
    
    <div>
        <br/><input type="button" onclick="calculate()" id="calculate" value="Вычислить счастливое число" /><br/><br/>
    </div>
    
    <div>
    <label>Хэш</label><br>
    <input type="text" id="hash" size="100" /><br>
    <label>Счастливое число</label><br>
    <input type="text" id="luckyNumber" size="10" />

	</div>
    

<script  type="text/javascript" >
blocksData();
    function calculate() {
        var sig1 = document.getElementById("sig1").value,
        sig2 = document.getElementById("sig2").value,
        participants = 3;
    
        if(sig1) sig1 = sig1.trim();
        if(sig2) sig2 = sig2.trim();
        
	// собственно вычисления    
	let h = keccak_256.update(sig1 + sig2).toString();
        //alert(bigInt(h, 16).mod(participants));
        let d = bigInt(h, 16).mod(participants);
        console.log(d);

	document.getElementById("hash").value = h;
        document.getElementById("luckyNumber").value = (d.value+1);
        
    }
    
    function updateValues()
    {
	//console.log("updateValues = " + JSON.stringify(site));     
        var vars = [], hash;
        var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
        for(var i = 0; i < hashes.length; i++)
        {
            hash = hashes[i].split('=');
            vars.push(hash[0]);
            vars[hash[0]] = hash[1];
        }
        
        if(vars["sig1"]) {
            document.getElementById("sig1").value = vars["sig1"];
        }
        if(vars["sig2"]) {
            document.getElementById("sig2").value = vars["sig2"];
        }
        if(vars["p"]) {
            document.getElementById("participants").value = vars["p"];
        }
    }    

</script>
<script src="BigInteger.min.js"></script>
<script src="sha3.min.js" onLoad="updateValues()"></script>

</div>
</body>
</html>