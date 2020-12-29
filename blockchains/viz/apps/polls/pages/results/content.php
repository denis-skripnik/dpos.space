<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
if (isset(pageUrl()[3])) {
    require __DIR__.'/get_dynamic_global_properties.php';
$res3 = $command3->execute($commandQuery3); 
$mass3 = $res3['result'];
    $tvsh = (float)$mass3['total_vesting_shares'];
    global $conf;
    $page = [];
    $page['content'] = '<p><span align="left">Результаты</span> <span align="center"><a href="'.$conf['siteUrl'].'viz/polls/voteing/'.pageUrl()[3].'">голосование</a></span> <span align="right"><a href="'.$conf['siteUrl'].'viz/polls/list">Список опросов</a></span></p>';
$html = file_get_contents('http://138.201.91.11:3100/viz-api?service=votes&type=vote&permlink='.pageUrl()[3]);
if (pageUrl()[3] && $html) {
$table = json_decode($html, true);
$d = new DateTime();
$d->setTimestamp($table['end_date']);
// или createFromFormat с форматом U
$d = DateTime::createFromFormat('U', $table['end_date']);
$sp = $table['all_shares'];
$sp = round($sp, 3);
$page['content'] .= '<hr>
<h2>Вопрос: '.$table['question'].'</h2>
<h3>Дата и время завершения: '.$d->format('d.m.Y H:i:s').' GMT</h3>
<p><br></p>
<p align="left"><strong>'.$table['type'].'. Всего проголосовало '.$sp.' соц. капитала ('.round(($table['all_shares']/$tvsh*100), 2).'% от всех SHARES).</strong></p>
<br>
<table align="center"><thead><tr><th>Вариант ответа</th><th>Процент</th><th>Процент от общего соц. капитала по варианту</th></tr></thead><tbody>
';
$voters_str = '<h2>Топ 100 пользователей по соц. капиталу (каждый вариант, за который есть голоса)</h2>';
foreach ($table['variants'] as $answer) {
    $answer_gests_percent = round(($answer['shares'] / $tvsh)*100, 2);
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