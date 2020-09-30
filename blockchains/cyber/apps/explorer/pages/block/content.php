<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
try {
  function convert_operation_data($arr, $site_url) {
    $result = '{<br />';
    foreach ($arr as $key => $value) {
      if ($value['key'] === 'sender' || $value['key'] === 'receiver' || $value['key'] === 'recipient' || $value['key'] === 'to' || $value['key'] === 'account' || $value['key'] === 'voter' || $value['key'] === 'delegator' || $value['key'] === 'delegatee' || $value['key'] === 'creator' || $value['key'] === 'subscriber') {
        if ($value !== $value['key']) {
          $result .= $value['key'].': "<a href="'.$site_url.'cyber/profiles/'.$value['value'].'" target="_blank">'.$value['value'].'</a>",';
        } else {
          if (is_array($value['value'])) {
            $value = json_encode($value['value']);
          }    
          $result .= $value['key'].': "'.$value['value'].'",';        
        }
      } else {
        if (is_array($value['value'])) {
          $value = json_encode($value['value']);
        }
          $result .= $value['key'].': "'.$value['value'].'",';        
      }
      }
      $result = str_replace(array(","), ",<br />", $result);
  $result = substr($result, 0, -7);
      $result .= '<br />}';
      return $result;
  }
  
  function node($params) {
    $html = file_get_contents('https://api.cyber.cybernode.ai/'.$params);
    $data = json_decode($html, true);
  return $data['result'];
  }
$block = node('block?height='.$datas);

  date_default_timezone_set('UTC');
$month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
$timestamp1 = $block['block']['header']['time'];
$timestamp2 = strtotime($timestamp1);
$month1 = date('m', $timestamp2);
$timestamp = date('d', $timestamp2).' '.$month[$month1].' '.date('Y г. H:i:s', $timestamp2);
$prev_block = $datas-1;
$next_block = $datas+1;

  $content = '<h2>Блок №'.$datas.' (<a href="'.$conf['siteUrl'].'cyber/explorer/block/'.$prev_block.'" target="_blank">← предыдущий</a>, <a href="'.$conf['siteUrl'].'cyber/explorer/block/'.$next_block.'" target="_blank">→ следующий</a>)</h2>
<h3>Транзакции</h3>
<ol>';
$txs = node('block_results?height='.$datas)['txs_results'];
foreach ($txs as $num => $tr) {
  $content .= '<li><table><tr><th>Тип операции</th>
  <th>JSON</th></tr>';
  foreach (json_decode($tr['log'], true) as $op) {
  $op_data = convert_operation_data($op['events'][0]['attributes'], $conf['siteUrl']);
    $content .= '<tr><td>'.$op['events'][0]['type'].'</td>
  <td>'.$op_data.'</td></tr>';
  }
  $content .= '</table></li>';
}
$content .= '</ol>

<hr>
<h2>Информация о блоке</h2>
<ul><li>Сформирован '.$timestamp.' GMT</li>
<li>Подписи валидаторов:
<ol>';
$signatures = $block['block']['last_commit']['signatures'];
foreach ($signatures as $signature) {
  if ($signature['validator_address'] !== '') {
    $content .= '<li>Адрес: '.$signature['validator_address'].', подпись: '.$signature['signature'].'</li>';
  }
}
$content .= '</ol></li></ul>';
return $content;
} catch (Exception $e) {
  return '<p>Такого блока нет или ошибка соединения с Нодой.</p>';
}
?>