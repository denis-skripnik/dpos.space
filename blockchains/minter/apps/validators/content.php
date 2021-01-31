<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
function cmp_function_desc($a, $b){
    return ($a['stake'] < $b['stake']);
  }

try {
    $html = file_get_contents('https://explorer-api.minter.network/api/v2/validators');
    $validators = json_decode($html, true)['data'];
    $list = $validators;
    $content = '<table><thead><tr><th>№ и статус</th>
<th>Публичный ключ</th>
<th>Название</th>
<th>Стек</th>
<th>Комиссия</th>
</tr></thead><tbody>';
uasort($list, 'cmp_function_desc');
$num = 0;
foreach ($list as $validator) {
$num++;
  if ($validator['status'] === 2 || $validator['status'] === 1) {
    $status = '<span style="color: green;">Валидатор</span>';
    if ($validator['status'] === 1) $status = '<span style="color: red;">Кандидат</span>';
    $content .= '<tr><td>'.$num.' '.$status.'</td>
    <td><input type="text" readonly id="validator_'.$num.'_key" value="'.$validator['public_key'].'"> (<input type="button" onclick="copyText(`validator_'.$num.'_key`);" value="копировать">)</td>';
    if (isset($validator['site_url']) && $validator['site_url'] !== '' && $validator['name'] !== $validator['public_key']) {
      $content .= '<td><a href="'.$validator['site_url'].'" target="_blank">'.$validator['name'].'</a></td>';
    } else if ($validator['name'] === $validator['public_key']) {
    $content .= '<td></td>';
  } else {
      $content .= '<td>'.$validator['name'].'</td>';
    }
$content .= '<td>'.round($validator['stake'], 3).' BIP</td>
    <td>'.$validator['commission'].'%</td>
</tr>';
  }
}
$content .= '</tbody></table>';
return $content;
} catch (Exception $e) {
  return '<p>Список валидаторов не найден или ошибка соединения с Нодой.</p>';
}
?>