<?php
  global $conf;
    $html = file_get_contents('http://138.201.91.11:3900/donates?type=referrers');
    $table = json_decode($html, true);
    $content = '<table id="table"><thead><tr><th>Логин</th><th>Количество приглашённых</th></tr></thead><tbody id="target">';
    if ($table) {
    foreach ($table as $referrer) {
      $content .= '<tr><td><a href="'.$conf['siteUrl'].'golos/profiles/'.$referrer['login'].'" target="_blank">'.$referrer['login'].'</a></td>
    <td><a data-fancybox data-type="ajax" data-src="'.$conf['siteUrl'].'blockchains/golos/apps/referrers/ajax.php?referrer='.$referrer['login'].'&siteUrl='.$conf['siteUrl'].'" href="javascript:;">'.$referrer['count'].'</a></td>
</tr>';
    }
    }
    $content .= '</tbody></table>';
return $content;
?>