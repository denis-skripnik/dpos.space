$(document).ready(function(){
    $("#result_power").click(function(){
var steem_power = document.getElementById('sp').value;
steem_power = steem_power.replace(/\s/g, '');
var vote_power = document.getElementById('vp').value;
	  $("#let1").load("https://dpos.space/blockchains/viz/apps/calc/ajax.php","type=result_power&sp=" + steem_power + "&charge=" + vote_power, function(result, status) {
          if (status === 'error') {
              console.log(result);
          }
      });
   });

   $("#result_fund").click(function(){
    var steem_power = document.getElementById('fund_sp').value;
    steem_power = steem_power.replace(/\s/g, '');
    $("#let3").load("https://dpos.space/blockchains/viz/apps/calc/ajax.php","type=result_fund&sp=" + steem_power, function(result, status) {
    if (status === 'error') {
                  console.log(result);
              }
          });
       });
    
   $("#result_vests").click(function(){
var sp_tec = document.getElementById('sp_tec').value
sp_tec = sp_tec.replace(/\s/g, '');
$("#let2").load("https://dpos.space/blockchains/viz/apps/calc/ajax.php","type=result_vests&sp-tec=" + sp_tec, function(result, status) {
          if (status === 'error') {
              console.log(result);
          }
      });
   });

});