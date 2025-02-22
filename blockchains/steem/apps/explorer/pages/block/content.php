<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
require 'block.php';
try {
  $mass = $res2['result'];
  $ops = $res['result'];
function convert_operation_data($arr, $site_url) {
  $result = '{<br />';
  foreach ($arr as $key => $value) {
    if ($key === 'from' || $key === 'initiator' || $key === 'receiver' || $key === 'to' || $key === 'account' || $key === 'account_seller' || $key === 'subaccount_seller' || $key === 'seller' || $key === 'benefactor' || $key === 'new_account_name' || $key === 'producer' || $key === 'publisher' || $key === 'author' || $key === 'curator' || $key === 'comment_author' || $key === 'witness' || $key === 'voter') {
      $result .= $key.': "<a href="'.$site_url.'steem/profiles/'.$value.'" target="_blank">'.$value.'</a>",';
    } else if ($key === 'beneficiaries') {
$benif = $key.': [';
      foreach ($value as $benefactor) {
  $benif .= '{
account: "<a href="'.$site_url.'steem/profiles/'.$benefactor['account'].'" target="_blank">'.$benefactor['account'].'</a>,
Weight: '.$benefactor['Weight'].'
},';
}
$benif = str_replace(array(","), ",<br />", $benif);
$benif .= '],';
$result .= $benif;
  } else {
    if (is_array($value)) {
      $value = json_encode($value);
    }  
    $result .= $key.': "'.$value.'",';
    }
    }
    $result = str_replace(array(","), ",<br />", $result);
$result = substr($result, 0, -7);
    $result .= '<br />}';
    return $result;
}
if (!isset($mass)) {
  header("HTTP/1.0 404 Not Found");
  return '<p>Такого блока нет или ошибка соединения с Нодой.</p>';
}
date_default_timezone_set('UTC');
$month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
$timestamp1 = $mass['timestamp'];
$timestamp2 = strtotime($timestamp1);
$month1 = date('m', $timestamp2);
$timestamp = date('d', $timestamp2).' '.$month[$month1].' '.date('Y г. H:i:s', $timestamp2);
$prev_block = $datas-1;
$next_block = $datas+1;
$witness = $mass['witness'];
for ($i = 0; $i < count($ops); $i++) {
if (isset($ops[$i]['op'][1]['producer'])) {
  $witness = $ops[$i]['op'][1]['producer'];
}
}

$content = '<h2>Блок №'.$datas.' (<a href="'.$conf['siteUrl'].'steem/explorer/block/'.$prev_block.'" target="_blank">← предыдущий</a>, <a href="'.$conf['siteUrl'].'steem/explorer/block/'.$next_block.'" target="_blank">→ следующий</a>)</h2>
<ul><li>Сформирован '.$timestamp.' GMT</li>
<li>Подписал делегат <a href="'.$conf['siteUrl'].'steem/profiles/'.$witness.'/witness" target="_blank">'.$witness.'</a></li></ul>
<hr />
<h3>Транзакции</h3>
<ol>';
$prev_id = '';
foreach ($ops as $num => $tr) {
    $timestamp1 = $tr['timestamp'];
$timestamp2 = strtotime($timestamp1);
$month1 = date('m', $timestamp2);
$timestamp = date('d', $timestamp2).' '.$month[$month1].' '.date('Y г. H:i:s', $timestamp2);
if ($tr['trx_id'] !== $prev_id) {
if ($num !== 0) {
  $content .= '</table></li>';
}
  $content .= '<li><h4>id: <a href="'.$conf['siteUrl'].'steem/explorer/tx/'.$tr['trx_id'].'" target="_blank">'.$tr['trx_id'].'</a></h4>
<p>Создана: '.$timestamp.'</p>
<h5>Операции</h5>
<table><tr><th>Название</th><th>Данные</th></tr>';
}
$op = $tr['op'];
$op_data = convert_operation_data($op[1], $conf['siteUrl']);
    $content .= '<tr><td>'.$op[0].'</td>
  <td>'.$op_data.'</td></tr>';
if (count($ops) === $num+1) {
  $content .= '</table></li>';
}
$prev_id = $tr['trx_id'];
  }
$content .= '</ol>';
return $content;
} catch (Exception $e) {
  return '<p>Такого блока нет или ошибка соединения с Нодой.</p>';
}
?>