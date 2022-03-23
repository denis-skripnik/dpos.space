$(document).ready(function(){
    $("#result_power").click(function(){
var hive_power = document.getElementById('sp').value;
var vote_power = document.getElementById('vp').value;
    var vote_weight = document.getElementById('vote_weight').value
	  $("#let1").load("/blockchains/serey/apps/calc/ajax.php","type=result_power&sp=" + hive_power + "&charge=" + vote_power + "&vote_weight=" + vote_weight, function(result, status) {
          if (status === 'error') {
              console.log(result);
          }
      });
   });

   $("#result_SEREY").click(function(){
var sp_tec = document.getElementById('sp_tec').value
	  $("#let2").load("/blockchains/serey/apps/calc/ajax.php","type=result_SEREY&sp-tec=" + sp_tec, function(result, status) {
          if (status === 'error') {
              console.log(result);
          }
      });
   });

});