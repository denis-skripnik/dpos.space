<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
$amount_account = 'golos-backup';
$content = '<h2>Список действий</h2>
<ol><li>Перейдите на страницу своего аккаунта в <a href="https://golos.id" target="_blank">golos.id</a>;</li>
<li>Отправьте 5 GOLOS или 3 GBG на аккаунт @'.$amount_account.'. Заметка (memo):<br />
posts;<br></li>
<li>Введите логин в форме ниже</li>
<li>Выберите вариант получения репостов в списке материалов.</li></ol>
<h2><strong>Важно:</strong></h2>
<ol><li><strong>Сумма действительна, пока ваша транзакция с платежом не опустится на 2000 позиций.</strong></li>
<li><strong>Вы можете скачать только записи не старше 11 месяцев - ограничение взаимодействия с Нодами блокчейна</strong></li>
<li><strong>Если вы оплатили услуги сервиса, но отображается по-прежнему сообщение о требующейся оплате, просьба пробовать несколько раз: возможно проблемы с публичной Нодой, к которой производится подключение. Если же сообщение очень долго, просьба написать в Telegram чат <a href="https://t.me/dpos_space" target="_blank">@dpos_space</a></strong></li></ol>

<form action="" method="post">
<input type="hidden" name="chain" value="golos">
<input type="hidden" name="service" value="backup">
<p><label for="WLS_login">Имя пользователя (логин) на Golos (Без "@"):</label>
<input type="text" name="user" value="'.pageUrl()[2].'"></p>
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

require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/helpers.php';
require_once __DIR__.'/functions.php';

use GrapheneNodeClient\Commands\Single;
use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetAccountHistoryCommand;

$connector_class = CONNECTORS_MAP['golos'];
$commandQuery = new CommandQueryData();
        
$query = ['select_ops' => ['transfer']];
$method_data = [
        '0' => ($amount_account ?? $amount_account ?? ""), //authors
                '1' => -1, //from
                '2' => 10000, //limit max 2000
                '3' => $query,
        ];

        $commandQuery->setParams($method_data);

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
$tokens3 = "5.000 GOLOS";
if ($op['1']['from'] === pageUrl()[2] && $op['1']['to'] === $amount_account && (($op['1']['amount'] ?? $op['1']['amount'] ?? "") === $tokens3 or ($op['1']['amount'] ?? $op['1']['amount'] ?? "") === "3.000 GBG") && $op['1']['memo'] === "posts") {
        if (isset($op) ){
$contentformat = pageUrl()[4];
if ($contentformat == 'Markdown') {
        $content .= generator($app_dir);
fullRemove_ff($app_dir."/users/".pageUrl()[2]."/",1);
}elseif ($contentformat == 'HTML') {
        $content .= html_generator($app_dir);
fullRemove_ff($app_dir."/users/".pageUrl()[2]."/",1);
}
$op_trx = ($op ?? $op ?? null);
}
}
 } 

if (!isset($op_trx) ){
$content .= '<p>Пользователь <a href="https://golos.id/@'.pageUrl()[2].'/transfers" target="_blank">@'.pageUrl()[2].'</a> не произвёл платёж<br />
Перейдите в кошелёк, нажав на свой логин в строке выше.</p>
<p>Либо оплатите <a href="https://golos.id/@'.pageUrl()[2].'/transfers?to='.$amount_account.'&amount=3.000&token=GBG&memo=posts" target="_blank">3 GBG через golos.id</a> или <a href="https://golos.id/@'.pageUrl()[2].'/transfers?to='.$amount_account.'&amount=5.000&token=GOLOS&memo=posts" target="_blank">5 GOLOS через golos.id</a></p>';
}

return $content;
?>