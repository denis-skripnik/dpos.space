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

$html = file_get_contents('https://lcd.cyber.cybernode.ai/txs/'.$datas);
$tx = json_decode($html, true);

date_default_timezone_set('UTC');
$month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
$timestamp1 = $tx['timestamp'];
$timestamp2 = strtotime($timestamp1);
$month1 = date('m', $timestamp2);
$timestamp = date('d', $timestamp2).' '.$month[$month1].' '.date('Y г. H:i:s', $timestamp2);

$content = '<h2>Транзакция '.$datas.'</h2>
<ul><li>Блок: <a href="'.$conf['siteUrl'].'cyber/explorer/block/'.$tx['height'].'" target="_blank">'.$tx['height'].'</a></li>
<li>Создана: '.$timestamp.'</li></ul>
<hr />
<h3>Операции</h3>
<table><tr><th>Тип операции</th>
<th>JSON</th></tr>';
foreach (json_decode($tx['raw_log'], true) as $op) {
$op_data = convert_operation_data($op['events'][0]['attributes'], $conf['siteUrl']);
  $content .= '<tr><td>'.$op['events'][0]['type'].'</td>
<td>'.$op_data.'</td></tr>';
}
$content .= '</table>';
return $content;
} catch (Exception $e) {
  return '<p>Такой транзакции нет.</p>';
}
?>