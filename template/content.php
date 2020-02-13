<?php 
if ( isset($array_url[0]) ){
require_once $service.'/index.php';
} else {
echo '<main class="content">
<p>Выберите сервис:</p>
<ol><li><a href="https://dpos.space/profiles" target="_blank">Просмотрщик профилей</a></li>
<li><a href="https://dpos.space/feed" target="_blank">Просмотрщик ленты подписок</a></li>
<li><a href="https://dpos.space/backup/steem" target="_blank">Резервное копирование постов в Steem (На той странице вы сможете поменять блокчейн на другой)</a></li>
<li><a href="https://dpos.space/post" target="_blank">Постинг в Steem, Golos и WLS, в том числе кросспостинг</a></li></ol>
</main>';
}
?>