<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
function cmp_function_desc($a, $b){
    return ($a['stake'] < $b['stake']);
  }

try {
    $html = file_get_contents('https://explorer-api.minter.network/api/v2/validators');
    $validators = json_decode($html, true)['data'];
    $list = $validators;
    $content = '<table><thead><tr><th>№</th>
<th>Публичный ключ</th>
<th>Название</th>
<th>Стек</th>
<th>Комиссия</th>
<th>Описание</th>
<th>сайт</th>
</tr></thead><tbody>';
uasort($list, 'cmp_function_desc');
$num = 0;
foreach ($list as $validator) {
$num++;
  if ($validator['status'] === 2 || $validator['status'] === 1) {
    $content .= '<tr><td>'.$num.'</td>
    <td><input type="text" readonly id="validator_'.$num.'_key" value="'.$validator['public_key'].'"> (<input type="button" onclick="copyText(`validator_'.$num.'_key`);" value="копировать"></td>
    <td>'.$validator['name'].'</td>
    <td>'.round($validator['stake'], 3).' BIP</td>
    <td>'.$validator['commission'].'%</td>
    <td>'.$validator['description'].'</td>';
if (isset($validator['site_url']) && $validator['site_url'] !== '') {
  $content .= '<td><a href="'.$validator['site_url'].'" target="_blank">'.$validator['site_url'].'</a></td>';
} else {
  $content .= '<td></td>';
}
    $content .= '</tr>';
  }
}
$content .= '</tbody></table>';
return $content;
} catch (Exception $e) {
  return '<p>Список валидаторов не найден или ошибка соединения с Нодой.</p>';
}
?>