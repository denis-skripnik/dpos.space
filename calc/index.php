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
    $("#result_power").click(function(){
var steem_power = document.getElementById('sp').value;
var vote_power = document.getElementById('vp').value;
<?php if ($chain != 'viz') { ?>
    var vote_weight = document.getElementById('vote_weight').value
	  $("#let1").load("/calc/upvotes/ajax.php","sp=" + steem_power + "&charge=" + vote_power + "&vote_weight=" + vote_weight + "&chain=<?php echo $array_url[1]; ?>&array_url[0]=<?php echo $array_url[0]; ?>&array_url[1]=<?php echo $array_url[1]; ?>", function(result, status) {
          if (status === 'error') {
              console.log(result);
          }
      });
   });
   <?php } else { ?>
    $("#let1").load("/calc/upvotes/ajax.php","sp=" + steem_power + "&charge=" + vote_power + "&chain=<?php echo $array_url[1]; ?>&array_url[0]=<?php echo $array_url[0]; ?>&array_url[1]=<?php echo $array_url[1]; ?>", function(result, status) {
          if (status === 'error') {
              console.log(result);
          }
      });
   });
<?php } ?>
$("#result_vests").click(function(){
var sp_tec = document.getElementById('sp_tec').value
	  $("#let2").load("/calc/vests-gests/ajax.php","sp-tec=" + sp_tec + "&chain=<?php echo $array_url[1]; ?>&array_url[0]=<?php echo $array_url[0]; ?>&array_url[1]=<?php echo $array_url[1]; ?>", function(result, status) {
          if (status === 'error') {
              console.log(result);
          }
      });
   });
  });             
</script>                                                      
<?php

require $_SERVER['DOCUMENT_ROOT'].'/calc/upvotes/block.php';
require $_SERVER['DOCUMENT_ROOT'].'/calc/vests-gests/block.php';
}