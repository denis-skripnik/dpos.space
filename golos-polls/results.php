<?php
require $_SERVER['DOCUMENT_ROOT'].'/golos-polls/snippets/get_dynamic_global_properties.php';
require $_SERVER['DOCUMENT_ROOT'].'/golos-polls/snippets/get_config.php';
$res3 = $command3->execute($commandQuery3); 
$mass3 = $res3['result'];
$config_res = $config_command->execute($config_commandQuery); 
$config_mass = $config_res['result'];
  // Расчет steem_per_vests
    $tvfs = (float)$mass3['total_vesting_fund_steem'];
    $tvsh = (float)$mass3['total_vesting_shares'];
    $steem_per_vests = 1000000 * $tvfs / $tvsh;
echo '<main class="content">
<p><span align="left">Результаты</span> <span align="center"><a href="https://dpos.space/golos-polls/voteing/'.$array_url[2].'">голосование</a></span> <span align="right"><a href="https://dpos.space/golos-polls/list">Список опросов</a></span></p>';
$html = file_get_contents('http://138.201.91.11:3200/golos-votes?type=vote&permlink='.$array_url[2]);
if ($array_url[2] && $html) {
$table = json_decode($html, true);
$d = new DateTime();
$d->setTimestamp($table['end_date']);
// или createFromFormat с форматом U
$d = DateTime::createFromFormat('U', $table['end_date']);
$sp = $table['all_gests'] / 1000000 * $steem_per_vests;
$sp = round($sp, 3);
echo '<hr>
<h2>Вопрос: '.$table['question'].'</h2>
<h3>Дата и время завершения: '.$d->format('d.m.Y H:i:s').' GMT</h3>
<p><br></p>
<p align="left"><strong>'.$table['type'].'. Всего проголосовало '.$sp.' СГ ('.round(($table['all_gests']/$tvsh*100), 2).'% от всей СГ).</strong></p>
<br>
<table align="center"><thead><tr><th>Вариант ответа</th><th>Процент</th><th>Процент от общей СГ по варианту</th></tr></thead><tbody>
';
$voters_str = '<h2>Топ 100 пользователей по СГ (каждый вариант, за который есть голоса)</h2>';
foreach ($table['variants'] as $answer) {
    $answer_gests_percent = round(($answer['gests'] / $tvsh)*100, 2);
    echo '<tr><td>'.$answer['answer'].'</td>
<td>'.$answer['percent'].'%</td>
<td>'.$answer_gests_percent.'%</td></tr>';
$voters_str .= '<h3>За вариант "'.$answer['answer'].'" проголосовали:</h2>
<p>'.$answer['voters'].'</p>
';
}
echo '</tbody></table>
<br>'.$voters_str;
} else {
echo '<p>Такого опроса нет.</p>';
}
echo '</main>';
?>