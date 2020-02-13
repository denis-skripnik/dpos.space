<?php
require $_SERVER['DOCUMENT_ROOT'].'/urls.php';
require $_SERVER['DOCUMENT_ROOT'].'/params.php';
if(!isset($array_url[1] ) ) {
  require_once $_SERVER['DOCUMENT_ROOT'].'/template/header.php';
require_once $_SERVER['DOCUMENT_ROOT'].'/template/menu.php';
 echo '<main class="content">
<h2>Выберите вверху блокчейн и приступайте к игре</h2>
</main>';
require_once $_SERVER['DOCUMENT_ROOT'].'/template/footer.php';
} else if( isset($array_url[1] ) ) {
  echo '<main class="content">';
  require $_SERVER['DOCUMENT_ROOT'].'/loser-game/view.php';
echo '</main>';
}