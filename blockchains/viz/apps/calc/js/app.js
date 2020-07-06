$(document).ready(function(){
    $("#result_power").click(function(){
var steem_power = document.getElementById('sp').value;
var vote_power = document.getElementById('vp').value;
	  $("#let1").load("/blockchains/viz/apps/calc/ajax.php","type=result_power&sp=" + steem_power + "&charge=" + vote_power, function(result, status) {
          if (status === 'error') {
              console.log(result);
          }
      });
   });

   $("#result_vests").click(function(){
var sp_tec = document.getElementById('sp_tec').value
	  $("#let2").load("/blockchains/viz/apps/calc/ajax.php","type=result_vests&sp-tec=" + sp_tec, function(result, status) {
          if (status === 'error') {
              console.log(result);
          }
      });
   });

});