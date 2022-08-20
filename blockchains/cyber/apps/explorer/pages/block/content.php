<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
try {
  function convert_operation_data($arr, $site_url) {
    $result = '{<br />';
    foreach ($arr as $key => $value) {
      if ($value['key'] === 'sender' || $value['key'] === 'receiver' || $value['key'] === 'recipient' || $value['key'] === 'to' || $value['key'] === 'account' || $value['key'] === 'voter' || $value['key'] === 'delegator' || $value['key'] === 'delegatee' || $value['key'] === 'creator' || $value['key'] === 'subscriber' || $value['key'] === 'subject' && strpos ($value['value'], 'cyber') > -1) {
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
    $html = file_get_contents('https://rpc.cyber.posthuman.digital/'.$params);
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
if (isset($txs) && count($txs) > 0) {
  foreach ($txs as $num => $tr) {
    $tx_data = isJSON($tr['log']);
    if ($tx_data['approve'] !== false) {
    $content .= '<li><table><tr><th>Тип события</th>
    <th>JSON</th></tr>';
    foreach ($tx_data['data'] as $op) {
      foreach ($op['events'] as $event) {
        $op_data = convert_operation_data($event['attributes'], $conf['siteUrl']);
        $content .= '<tr><td>'.$event['type'].'</td>
      <td>'.$op_data.'</td></tr>';
      }
    }
    $content .= '</table></li>';
  } else {
    $content .= '<h3>Ошибка</h3>
    <p>'.$tx_data['data'].'</p>';
  }
}
 
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