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
