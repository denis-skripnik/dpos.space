   $("#result_vesting").click(function(){
var all_sp = document.getElementById('all_sp').value
	  $("#let3").load("/calc/vesting-reward/ajax.php","sp-tec=" + all_sp + "&chain=<?php echo $array_url[1]; ?>&array_url[0]=<?php echo $array_url[0]; ?>&array_url[1]=<?php echo $array_url[1]; ?>", function(result, status) {
          if (status === 'error') {
              console.log(result);
          }
      });
   });

