<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
try {
  function convert_operation_data($arr, $site_url) {
    $result = '{<br />';
        if (isset($arr['list'])) {
          foreach ($arr['list'] as $multy) {
foreach ($multy as $key => $val) {
  if ($key === 'from' || $key === 'initiator' || $key === 'receiver' || $key === 'to' || $key === 'account' || $key === 'owner' || $key === 'publisher' || $key === 'author') {
    $result .= $key.': "<a href="'.$site_url.'decimal/profiles/'.$val.'" target="_blank">'.$val.'</a>";';
  } else if ($key === 'value') {
    $val = $val / (10 ** 18);
    $result .= 'Количество: '.round($val, 3).';';
    } else if ($key === 'coin') {
    $result .= 'Монета: '.$val['symbol'].';';
  } else {
  if (is_array($val)) {
    $val = json_encode($val);
  }  
  $result .= $key.': "'.$val.'";';
}
            }
            }
          } else {
          foreach ($arr as $key => $val) {
              if ($key === 'from' || $key === 'initiator' || $key === 'receiver' || $key === 'to' || $key === 'account' || $key === 'owner' || $key === 'publisher' || $key === 'author') {
                $result .= $key.': "<a href="'.$site_url.'decimal/profiles/'.$val.'" target="_blank">'.$val.'</a>";';
              } else if ($key === 'value') {
                $val = $val / (10 ** 18);
                $result .= 'Количество: '.round($val, 3).';';
                } else if ($key === 'coin') {
                $result .= 'Монета: '.$val.';';
              } else {
              if (is_array($val)) {
                $val = json_encode($val);
              }  
              $result .= $key.': "'.$val.'";';
            }
                                                }
                      }
      $result = str_replace(array(";"), ",<br />", $result);
  $result = substr($result, 0, -7);
      $result .= '<br />}';
      return $result;
  }
  
  function node($params) {
    $ch = curl_init('https://mainnet-explorer-api.decimalchain.ru/api/'.$params);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $html = '';
    $html = curl_exec($ch);
    $data = json_decode($html, true);
    if (isset($data['statusCode']) && $data['statusCode'] !== 200) {
      $data = ['result' => []];
      header("HTTP/1.0 404 Not Found");
    }

    // Close handle
    curl_close($ch);
  return $data;
  }
$block = node('block/'.$datas)['result'];
if (count($block) == 0) {
  return '<p>Такого блока нет или ошибка соединения с Нодой.</p>';
}

  date_default_timezone_set('UTC');
$month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
$timestamp1 = $block['date'];
$timestamp2 = strtotime($timestamp1);
$month1 = date('m', $timestamp2);
$timestamp = date('d', $timestamp2).' '.$month[$month1].' '.date('Y г. H:i:s', $timestamp2);
$prev_block = $datas-1;
$next_block = $datas+1;

  $content = '<h2>Блок №'.$datas.' (<a href="'.$conf['siteUrl'].'decimal/explorer/block/'.$prev_block.'" target="_blank">← предыдущий</a>, <a href="'.$conf['siteUrl'].'decimal/explorer/block/'.$next_block.'" target="_blank">→ следующий</a>)</h2>
<h3>Транзакции</h3>
<ol>';
$txs = node('block/'.$datas.'/txs')['result']['txs'];
foreach ($txs as $num => $tr) {
  $content .= '<li><h3>Хеш: <a href="'.$conf['siteUrl'].'decimal/explorer/tx/'.$tr['hash'].'" target="_blank">'.$tr['hash'].'</a></h3>
<table><tr><th>Тип транзакции</th>
  <th>JSON</th></tr>';
  if (isset($tr[0])) {
    foreach ($tr['data'] as $op) {
      $op_data = convert_operation_data($op, $conf['siteUrl']);
        $content .= '<tr><td>'.$types[$tr['type']].'</td>
      <td>'.$op_data.'</td></tr>';
        }
  } else {
    $op_data = convert_operation_data($tr['data'], $conf['siteUrl']);
    $content .= '<tr><td>'.$tr['type'].'</td>
  <td>'.$op_data.'</td></tr>';
  }
  $content .= '</table></li>';
}
$content .= '</ol>

<hr>
<h2>Информация о блоке</h2>
<ul><li>Сформирован '.$timestamp.' GMT</li>
<li>Валидаторов: '.$block['validatorsCount'].'</li></ul>';
return $content;
} catch (Exception $e) {
  return '<p>Такого блока нет или ошибка соединения с Нодой.</p>';
}
?>