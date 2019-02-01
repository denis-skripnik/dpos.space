<?php
require $_SERVER['DOCUMENT_ROOT'].'/urls.php';
require $_SERVER['DOCUMENT_ROOT'].'/params.php';

require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/helpers.php';

use GrapheneNodeClient\Commands\Single;
use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetAccountHistoryCommand;

$chain = $chain;
$connector_class = CONNECTORS_MAP[$chain];

if(!isset($chain ) ) {
 require_once $_SERVER['DOCUMENT_ROOT'].'/template/header.php';
require_once $_SERVER['DOCUMENT_ROOT'].'/template/menu.php';
 echo '<main class="content">
<h2>Выберите вверху блокчейн и введите логин, чтобы сделать бекап</h2>
</main>';
require_once $_SERVER['DOCUMENT_ROOT'].'/template/footer.php';
} else if(!isset($array_url[1] ) ) {
 require_once $_SERVER['DOCUMENT_ROOT'].'/template/header.php';
require_once $_SERVER['DOCUMENT_ROOT'].'/template/menu.php';
 echo '<main class="content">
<h2>Выберите вверху блокчейн и введите логин, чтобы сделать бекап</h2>
</main>';
require_once $_SERVER['DOCUMENT_ROOT'].'/template/footer.php';
} else if ( isset($array_url[1] ) ){
	
echo '<h2>Список действий</h2>
<ol><li>Перейдите на страницу своего аккаунта в <a href="https://'.($client ?? $client ?? "").'" target="_blank">'.($client ?? $client ?? "").'</a>;</li>';

if ($chain == 'WLS') {
echo '<li>Отправьте 0.5 GOLD на аккаунт @denis-skripnik<br>
Заметка (memo):<br>
posts';
} else if ($chain == 'steem' or $chain == 'golos') {
echo '<li>Отправьте '.$summa3.' '.$amount3.' или '.$summa1.' '.$amount1.' на аккаунт @'.$amount_account.'. Заметка (memo):<br />
posts;<br></li>';
} else if ($chain == 'viz') {
        echo '<li>Отправьте '.$summa1.' '.$amount1.' на аккаунт @'.$amount_account.'. Заметка (memo):<br />
        posts;<br></li>';
       }
echo '<li>Введите логин в форме ниже</li>
<li>Выберите вариант получения репостов в списке материалов.</li></ol>
<h2><strong>Важно:</strong></h2>
<ol><li><strong>Сумма действительна, пока ваша транзакция с платежом не опустится на 2000 позиций.</strong></li>
<li><strong>Вы можете скачать только записи не старше 11 месяцев - ограничение взаимодействия с Нодами блокчейна</strong></li>
<li><strong>При выборе бекапа в html формате не обращайте вниимание на предупреждение Google Chrome о редком скачивании файла и возможной опасности для вашего компьютера: это связано с тем, что html может содержать что угодно, но я гарантирую, что в тех файлах всё ок.</strong></li></ol>

<form action="" method="post">
<input type="hidden" name="service" value="'.$array_url[0].'">
<input type="hidden" name="chain" value="'.$chain.'">
<p><label for="WLS_login">Имя пользователя (логин) на '.($chain_name ?? $chain_name ?? "").' (Без "@"):</label>
<input type="text" name="WLS_login" value=""></p>
<p><label for="reblogs">Скачивать ли репосты?</label></p>
<ul>
<li><input type="radio" name="reblogs" value="yes2" checked>Нет: только посты моего аккаунта</li>
<li><input type="radio" name="reblogs" value="yes3">Да: все репосты</li></ul>
<p><label name="contentformat">Выберите формат сохранения материалов:</label>
<select name="contentformat">
<option value="Markdown">Markdown (Используется по умолчанию в '.($chain_name ?? $chain_name ?? "").': сервис не производит конвертаций текста постов)</option>
<option value="HTML">HTML (Скорее всего, понадобится только если у вас есть свой сайт, не поддерживающий MD, куда надо закинуть посты)</option>
</select></p>
<p align="center"><input type="submit" value="Запуск"></p>
</form>';

if( isset($_POST['WLS_login']) ){ // проверяем существование элемента

$commandQuery = new CommandQueryData();

$data = [
'0' => ($amount_account ?? $amount_account ?? ""), //authors
        '1' => 3000000000, //from
        '2' => 2000, //limit max 2000
];

$commandQuery->setParams($data);

if(!empty($connector_class)){
$connector = new $connector_class();
}

if(!empty($connector)){
$command = new GetAccountHistoryCommand($connector);
}

$res = $command->execute($commandQuery); 

 $mass = $res['result'];
 
 foreach ($mass as $datas) {
$op = $datas[1]['op'];
if ($chain != 'viz') {
$tokens3 = "$summa3 $amount3";
} else {
        $tokens3 = "";
}
if ($op['0'] === 'transfer' && $op['1']['from'] === $_POST['WLS_login'] && $op['1']['to'] === $amount_account && (($op['1']['amount'] ?? $op['1']['amount'] ?? "") === $tokens3 or ($op['1']['amount'] ?? $op['1']['amount'] ?? "") === ($summa1 ?? $summa1 ?? "").' '.($amount1 ?? $amount1 ?? "")) && $op['1']['memo'] === "posts") {
if (isset($op) ){
$contentformat = $_POST['contentformat'];
if ($contentformat == 'Markdown') {
require_once('generation/generator.php');
}elseif ($contentformat == 'HTML') {
require_once('generation/html_generator.php');
} else { }
require_once('generation/delete-dir.php');
}
$op_trx = ($op ?? $op ?? null);
}
}

if (!isset($op_trx) ){
echo '<p>Пользователь <a href="https://'.$client.'/@'.$_POST['WLS_login'].'/" target="_blank">@'.$_POST['WLS_login'].'</a> не произвёл платёж<br />
Перейдите в кошелёк, нажав на свой логин в строке выше.</p>';
if ($chain == 'golos') {
echo '<p>Либо оплатите <a href="https://golos.io/@'.$_POST['WLS_login'].'/transfers?to='.$amount_account.'&amount=3.000&token=golos&memo=posts" target="_blank">3 GOLOS через golos.io</a> или <a href="https://golos.io/@'.$_POST['WLS_login'].'/transfers?to='.$amount_account.'&amount=5.000&token=gbg&memo=posts" target="_blank">5 GBG через golos.io</a>, <a href="https://goldvoice.club/sign/transfer/?to='.$amount_account.'&amount=3.000%20GOLOS&memo=posts" target="_blank">3 GOLOS через goldvoice.club</a> или <a href="https://goldvoice.club/sign/transfer/?to='.$amount_account.'&amount=5.000%20GBG&memo=posts" target="_blank">5 GBG через goldvoice.club</a></p>';
}

}

}
} // end of if array_url[1].
?>