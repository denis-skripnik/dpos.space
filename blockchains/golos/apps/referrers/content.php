<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
  global $conf;
    $html = file_get_contents('http://178.20.43.121:3000/golos-api?service=referrers&type=list');
    $table = json_decode($html, true);
    $content = '<table id="table"><thead><tr><th>Логин</th><th>Количество приглашённых</th></tr></thead><tbody id="target">';
    if ($table) {
    foreach ($table as $referrer) {
      $content .= '<tr align="right"><td><a href="'.$conf['siteUrl'].'golos/profiles/'.$referrer['login'].'" target="_blank">'.$referrer['login'].'</a></td>
    <td><a data-fancybox data-type="ajax" data-src="'.$conf['siteUrl'].'blockchains/golos/apps/referrers/ajax.php?referrer='.$referrer['login'].'&siteUrl='.$conf['siteUrl'].'" href="javascript:;">'.$referrer['count'].'</a></td>
</tr>';
    }
    }
    $content .= '</tbody></table>';
return $content;
?>