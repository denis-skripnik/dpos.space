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
  $ch = curl_init('https://rpc.cyber.posthuman.digital/tx?hash='.mb_strtolower($params).'/');
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  $html = '';
  $html = curl_exec($ch);
  $data = json_decode($html, true);
  var_dump($data);
  if (isset($data['error'])) {
    $data = ['result' => []];
    header("HTTP/1.0 404 Not Found");
  }

  // Close handle
  curl_close($ch);
return $data['result'];
}
$tx = node($datas);
if (count($tx) == 0) {
return '<p>Такой транзакции нет или ошибка соединения с Нодой.</p>';
}

date_default_timezone_set('UTC');
$month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
$timestamp1 = $tx['timestamp'];
$timestamp2 = strtotime($timestamp1);
$month1 = date('m', $timestamp2);
$timestamp = date('d', $timestamp2).' '.$month[$month1].' '.date('Y г. H:i:s', $timestamp2);
$content = '<h2>Транзакция '.$datas.'</h2>
<ul><li>Блок: <a href="'.$conf['siteUrl'].'cyber/explorer/block/'.$tx['height'].'" target="_blank">'.$tx['height'].'</a></li>
<li>Создана: '.$timestamp.'</li></ul>';
$tx_data = isJSON($tx['raw_log']);
if ($tx_data['approve'] !== false) {
  $content .= '<hr />
  <h3>Операции</h3>
  <table><tr><th>Тип события</th>
  <th>JSON</th></tr>';
  foreach ($tx_data['data'] as $op) {
    foreach ($op['events'] as $event) {
      $op_data = convert_operation_data($event['attributes'], $conf['siteUrl']);
      $content .= '<tr><td>'.$event['type'].'</td>
    <td>'.$op_data.'</td></tr>';
    }
  }
  $content .= '</table>';
} else {
  $content .= '<h2>Ошибка</h2>
<p>'.$tx_data['data'].'</p>';
}
return $content;
} catch (Exception $e) {
  return '<p>Такой транзакции нет.</p>';
}
?>