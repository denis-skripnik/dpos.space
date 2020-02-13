<p>Выберите блокчейн, токены которого хотите обменять. Если уже выбрали, смотрите список шлюзов ниже.</p>
<table><thead><tr><td><a href="https://viz.dpos.space/exchange/payment-gates/viz">Viz</a></td><td><a href="https://viz.dpos.space/exchange/payment-gates/golos">Golos</a></td><td><a href="https://viz.dpos.space/exchange/payment-gates/steem">Steem</a></td><td><a href="https://viz.dpos.space/exchange/payment-gates/whaleshares">Whaleshares</a></td><tr></thead></table>
<?php
if (($array_url[2] ?? $array_url[2] ?? "")) {
	if ($array_url[2] == 'steem') {
echo '<script src="https://cdn.steemjs.com/lib/latest/steem.min.js"></script>
<script>
var gate = steem;
</script>';
		} else if ($array_url[2] == 'viz') {
echo '<script src="https://cdn.jsdelivr.net/npm/viz-js-lib@latest/dist/viz.min.js"></script>
<script>
var gate = viz;
gate.config.set("websocket","wss://solox.world/ws");
</script>';
		} else if ($array_url[2] == 'whaleshares') {
echo '<script src="https://cdn.jsdelivr.net/npm/wlsjs-staging@latest/dist/wlsjs.min.js"></script>
<script>
var gate = wlsjs;
gate.api.setOptions({url: "https://wls.kennybll.com"});
gate.config.set("address_prefix","WLS");
gate.config.set("chain_id","de999ada2ff7ed3d3d580381f229b40b5a0261aec48eb830e540080817b72866");
</script>';
		} else if ($array_url[2] == 'golos') {
echo '<script src="https://cdn.steemjs.com/lib/latest/steem.min.js"></script>
<script>
var gate = golos;
</script>';
		}
	echo '<h2>'.$array_url[2].'</h2>';
require_once 'config/db.php';
$query = "SELECT * FROM ".$array_url[2]." WHERE id > 0";
$db_result = $db->query($query);
$list = $db_result->fetchAll(PDO::FETCH_ASSOC);
if ($list) {
echo '<ol>';
	foreach($list as $gate) {
echo '<li><input type="radio" name="gates" value="'.$gate['login'].'"> '.$gate['login'].'</li>';
}
echo '</ol>';
echo '<div id="account_info"></div>
<h3>Инструкция</h3>
<ol><li>Смотрите информацию о шлюзе выше списка. Она показывает максимальный баланс на момент последнего изменения, но не гарантирует, что шлюз сейчас работает;</li>
<li>Заходите в аккаунт пользователя <span class="gate_link"></span> в блокчейне '.$array_url[2].';</li>
<li>Переводите нужную сумму. Memo (заметка) имеет формат: <strong>blockchain:login</strong>, например, <strong>golos:ya</strong>;</li>
<li>Ждёте некоторое время и получаете токены в другом блокчейне.</li></ol>';
} else {
echo '<p>Неизвестный блокчейн или нет ни одной записи..</p>';
}
}
?>

<script>
  var radio = document.querySelector('input[name=gates]');
  radio.onclick = function() {
var login = this.value;
	document.querySelector('.gate_link').innerHTML = `<a href="https://viz.world/@${login}/" target="_blank">@${login}</a>`;
gate.api.getAccounts([login], function(err, response) {
if (!err) {
	let json_metadata=response[0].json_metadata;
				let metadata;
				if(''==json_metadata){
					metadata={};
				}
				else{
					metadata=JSON.parse(json_metadata);
				}

				if(typeof metadata.profile == 'undefined'){
					metadata.profile={};
}
				if(typeof metadata.profile.about !== 'undefined'){
					document.getElementById('account_info').innerHTML = metadata.profile.about;
	}
}
});
}
</script>