<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
if (isset(pageUrl()[3])) {
require __DIR__.'/snippets/get_dynamic_global_properties.php';
require __DIR__.'/snippets/get_config.php';
$res3 = $command3->execute($commandQuery3); 
$mass3 = $res3['result'];
$config_res = $config_command->execute($config_commandQuery); 
$config_mass = $config_res['result'];
  // Расчет steem_per_vests
    $tvfs = (float)$mass3['total_vesting_fund_steem'];
    $tvsh = (float)$mass3['total_vesting_shares'];
    $steem_per_vests = 1000000 * $tvfs / $tvsh;
    global $conf;
    $page = [];
    $page['content'] = '<p><span align="left">Результаты</span> <span align="center"><a href="'.$conf['siteUrl'].'golos/polls/voteing/'.pageUrl()[3].'">голосование</a></span> <span align="right"><a href="'.$conf['siteUrl'].'golos/polls/list">Список опросов</a></span></p>';
$html = file_get_contents('http://178.20.43.121:3000/golos-api?service=votes&type=vote&permlink='.pageUrl()[3]);
if (pageUrl()[3] && $html) {
$table = json_decode($html, true);
$d = new DateTime();
$d->setTimestamp($table['end_date']);
// или createFromFormat с форматом U
$d = DateTime::createFromFormat('U', $table['end_date']);
$sp = $table['all_gests'] / 1000000 * $steem_per_vests;
$sp = round($sp, 3);
$page['content'] .= '<hr>
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
    $page['content'] .= '<tr><td>'.$answer['answer'].'</td>
<td>'.$answer['percent'].'%</td>
<td>'.$answer_gests_percent.'%</td></tr>';
$voters_str .= '<h3>За вариант "'.$answer['answer'].'" проголосовали:</h2>
<p>'.$answer['voters'].'</p>
';
}
$page['content'] .= '</tbody></table>
<br>'.$voters_str;
} else {
    $page['content'] .= '<p>Такого опроса нет.</p>';
}
$page['title'] = $table['question'];
$page['description'] = $table['question'];
return $page;
}
?>