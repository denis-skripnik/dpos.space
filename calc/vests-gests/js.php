   $("#result_vests").click(function(){
var sp_tec = document.getElementById('sp_tec').value
	  $("#let2").load("/calc/vests-gests/ajax.php","sp-tec=" + sp_tec + "&chain=<?php echo $array_url[1]; ?>&array_url[0]=<?php echo $array_url[0]; ?>&array_url[1]=<?php echo $array_url[1]; ?>", function(result, status) {
          if (status === 'error') {
              console.log(result);
          }
      });
   });

