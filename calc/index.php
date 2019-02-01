<?php
require $_SERVER['DOCUMENT_ROOT'].'/urls.php';
require $_SERVER['DOCUMENT_ROOT'].'/params.php';
if(!isset($array_url[1] ) ) {
  require_once $_SERVER['DOCUMENT_ROOT'].'/template/header.php';
require_once $_SERVER['DOCUMENT_ROOT'].'/template/menu.php';
 echo '<main class="content">
<h2>Выберите вверху блокчейн и приступайте к рассчётам</h2>
</main>';
require_once $_SERVER['DOCUMENT_ROOT'].'/template/footer.php';
} else if( isset($array_url[1] ) ) {
?>
  <script>
  $(document).ready(function(){
<?php require $_SERVER['DOCUMENT_ROOT'].'/calc/upvotes/js.php';
require $_SERVER['DOCUMENT_ROOT'].'/calc/vests-gests/js.php';
?>
  });             
</script>                                                      
<?php

require $_SERVER['DOCUMENT_ROOT'].'/calc/upvotes/block.php';
require $_SERVER['DOCUMENT_ROOT'].'/calc/vests-gests/block.php';
}