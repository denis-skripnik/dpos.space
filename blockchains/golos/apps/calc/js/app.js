$(document).ready(function(){
    $("#result_power").click(function(){
var steem_power = document.getElementById('sp').value;
steem_power = steem_power.replace(/\s/g, '');
var vote_power = document.getElementById('vp').value;
    var vote_weight = document.getElementById('vote_weight').value
	  $("#let1").load("/blockchains/golos/apps/calc/ajax.php","type=result_power&sp=" + steem_power + "&charge=" + vote_power + "&vote_weight=" + vote_weight, function(result, status) {
          if (status === 'error') {
              console.log(result);
          }
      });
   });

   $("#result_vesting").click(function(){
var all_sp = document.getElementById('all_sp').value
all_sp = all_sp.replace(/\s/g, '');      
$("#let3").load("/blockchains/golos/apps/calc/ajax.php","type=result_vesting&sp-tec=" + all_sp, function(result, status) {
          if (status === 'error') {
              console.log(result);
          }
      });
   });

   $("#result_vests").click(function(){
var sp_tec = document.getElementById('sp_tec').value
sp_tec = sp_tec.replace(/\s/g, '');      
$("#let2").load("/blockchains/golos/apps/calc/ajax.php","type=result_vests&sp-tec=" + sp_tec, function(result, status) {
          if (status === 'error') {
              console.log(result);
          }
      });
   });

});