<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
require 'get_transaction.php';
try {
$res = $command->execute($commandQuery); 
$mass = $res['result'];
function convert_operation_data($arr, $site_url) {
  $result = '{<br />';
  foreach ($arr as $key => $value) {
    if ($key === 'from' || $key === 'initiator' || $key === 'receiver' || $key === 'to' || $key === 'account' || $key === 'account_seller' || $key === 'subaccount_seller' || $key === 'seller' || $key === 'benefactor' || $key === 'new_account_name' || $key === 'witness' || $key === 'owner') {
      $result .= $key.': "<a href="'.$site_url.'viz/profiles/'.$value.'" target="_blank">'.$value.'</a>",';
    } else if ($key === 'beneficiaries') {
$benif = $key.': [';
      foreach ($value as $benefactor) {
  $benif .= '{
account: "<a href="'.$site_url.'viz/profiles/'.$benefactor['account'].'" target="_blank">'.$benefactor['account'].'</a>,
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

$content = '<h2>Транзакция '.$datas.'</h2>
<p>Блок: <a href="'.$conf['siteUrl'].'viz/explorer/block/'.$mass['block_num'].'" target="_blank">'.$mass['block_num'].'</a></p>
<hr />
<h3>Операции</h3>
<table><tr><th>Тип операции</th>
<th>JSON</th></tr>';
foreach ($mass['operations'] as $op) {
$op_data = convert_operation_data($op[1], $conf['siteUrl']);
  $content .= '<tr><td>'.$op[0].'</td>
<td>'.$op_data.'</td></tr>';
}
$content .= '</table>';
return $content;
} catch (Exception $e) {
  return '<p>Такой транзакции нет.</p>';
}
?>