<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
try {
function convert_operation_data($arr, $site_url) {
  $result = '{<br />';
    foreach ($arr as $key => $value) {
      if (strpos($key, 'address') !== false) {
        $result .= $key.': "<a href="'.$site_url.'cyber/profiles/'.$value.'" target="_blank">'.$value.'</a>",';
      } else {
        $result .= $key.': '.$value;
      }
    }
    $result = str_replace(array(","), ",<br />", $result);
$result = substr($result, 0, -7);
    $result .= '<br />}';
    return $result;
}
function node($params) {
  $ch = curl_init('https://lcd.cyber.posthuman.digital/cosmos/tx/v1beta1/txs/'.$params);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  $html = '';
  $html = curl_exec($ch);
  $data = json_decode($html, true);
  if (isset($data['error']) || !isset($data['tx'])) {
    $data = ['tx' => []];
    header("HTTP/1.0 404 Not Found");
  }

  // Close handle
  curl_close($ch);
return $data['tx'];
}
$tx = node($datas);
if (count($tx) == 0) {
return '<p>Такой транзакции нет или ошибка соединения с Нодой.</p>';
}

$content = '<h2>Транзакция '.$datas.'</h2>';
$tx_data = $tx['body']['messages'];
$content .= '<hr />
  <h3>Операции</h3>
  <table><tr><th>Тип события</th>
  <th>JSON</th></tr>';
  foreach ($tx_data as $op) {
    $op_type = $op['@type'];
      unset($op['@type']);
    $op_data = convert_operation_data($op, $conf['siteUrl']);
      $content .= '<tr><td>'.$op_type.'</td>
    <td>'.$op_data.'</td></tr>';
  }
  $content .= '</table>';
return $content;
} catch (Exception $e) {
  return '<p>Такой транзакции нет.</p>';
}
?>