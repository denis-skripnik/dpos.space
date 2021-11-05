<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
    global $conf;
if (pageUrl()[4]) {
    function cmp_function_desc($a, $b){
        return ($a['liquidity'] < $b['liquidity']);
      }
    
    $page = [];
    $page['content'] = '<p><span align="left">Результаты</span> <span align="center"><a href="'.$conf['siteUrl'].'minter/long/surveys/voteing/'.pageUrl()[4].'">голосование</a></span> <span align="right"><a href="'.$conf['siteUrl'].'minter/long/surveys/list">Список опросов</a></span></p>';
    $html = file_get_contents('http://138.201.91.11:3852/smartfarm/surveys?type=survey&id='.pageUrl()[4]);
if (isset($html)) {
$table = json_decode($html, true);
$d = new DateTime();
$d->setTimestamp($table['end_date']);
// или createFromFormat с форматом U
$d = DateTime::createFromFormat('U', $table['end_date']);
$results = [];
$all_liquidity = 0;
$all_power = 0;
$variants = [];
$liquidity_variants = [];
$active_answers = [];
$voters = [];
foreach ($table['voters'] as $vote) {
$all_liquidity += $vote['liquidity'];
$all_power += $vote['liquidity'] * (1 + ($vote['invest_days'] / 100));
if (!isset($variants[$vote['answer_id']])) {
    $variants[$vote['answer_id']] = $vote['liquidity'] * (1 + ($vote['invest_days'] / 100));
} else {
$variants[$vote['answer_id']] += $vote['liquidity'] * (1 + ($vote['invest_days'] / 100));
}
if (!isset($liquidity_variants[$vote['answer_id']])) {
    $liquidity_variants[$vote['answer_id']] = $vote['liquidity'];
} else {
$liquidity_variants[$vote['answer_id']] += $vote['liquidity'];
}

if (!isset($voters[$vote['answer_id']])) {
    $voters[$vote['answer_id']] = [];
    array_push($voters[$vote['answer_id']], ['address' => $vote['address'], 'liquidity' => $vote['liquidity']]);
} else {
    array_push($voters[$vote['answer_id']], ['address' => $vote['address'], 'liquidity' => $vote['liquidity']]);
}
}
$percents = [];
$liquidity_percents = [];
foreach ($variants as $n => $variant) {
    $percents[$n] = ($variant / $all_power) * 100;
$percents[$n] = round($percents[$n], 2);
}

foreach ($liquidity_variants as $n => $variant) {
$liquidity_percents[$n] = ($variant / $all_liquidity) * 100;
$liquidity_percents[$n] = round($percents[$n], 2);
}

$results['question'] = $table['question'];
$results['end_date'] = $table['end_date'];
$results['all_liquidity'] = $all_liquidity;
$results['variants'] = [];
foreach ($percents as $num => $percent) {
            uasort($voters[$num], 'cmp_function_desc');
            $list_str = '';
            foreach ($voters[$num] as $voter) {
                $list_str .= '<a href="/minter/profiles/'.$voter['address'].'" target="_blank">'.$voter['address'].'</a>, ';
                }
                $list_str = str_replace("/,\s*$/", "", $list_str);
$add_vote = ['answer_id' => $num, 'answer' => $table['answers'][$num], 'percent' => $percents[$num], 'power' => $variants[$num], 'liquidity' => $liquidity_variants[$num], 'voters' => $list_str];
array_push($results['variants'], $add_vote);
    array_push($active_answers, $num);
}
foreach ($table['answers'] as $n =>  $answer) {
if (array_search($n, $active_answers) === false) {
    $add_vote = ['answer_id' => $n, 'answer' => $table['answers'][$n], 'percent' => 0, 'power' => 0, 'liquidity' => 0, 'voters' => ''];
array_push($results['variants'], $add_vote);
}
}
    $page['content'] .= '<hr>
<h2>Вопрос: '.$table['question'].' от <a href="/minter/profiles/'.$table['creator'].'" target="_blank">'.$table['creator'].'</a></h2>
<h3>Дата и время завершения: '.$d->format('d.m.Y H:i:s').' GMT</h3>
<p><br></p>
<p align="left"><strong>Всего проголосовало '.$all_liquidity.' LP-токенов.<br>
При подсчёте результатов вычисляется сила голоса, равная LP * (1 + (инвест. дни / 100))</strong></p>
<br>
<table align="center"><thead><tr><th>№ ответа (для ручной отправки)</th><th>Вариант ответа</th><th>Процент</th><th>Процент от общей ликвы по варианту</th></tr></thead><tbody>
';
$voters_str = '<h2>Топ 100 адресов по ликвидности (каждый вариант, за который есть голоса)</h2>';
foreach ($results['variants'] as $variant) {
    $answer_liquidity_percent = $variant['liquidity'] / $all_liquidity * 100;
    $answer_liquidity_percent = round($answer_liquidity_percent, 2);
    $page['content'] .= '<tr><td>'.$variant['answer_id'].'</td>
<td>'.$variant['answer'].'</td>
<td>'.$variant['percent'].'%</td>
<td>'.$answer_liquidity_percent.'%</td></tr>';
$voters_str .= '<h3>За вариант "'.$variant['answer'].'" проголосовали:</h2>
<p>'.$variant['voters'].'</p>
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