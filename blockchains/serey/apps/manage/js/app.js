function bind_range(){
	$('input[type=range]').each(function(i){
		if(typeof $(this).attr('data-fixed') !== 'undefined'){
			let fixed_name=$(this).attr('data-fixed');
			let fixed_min=parseInt($(this).attr('min'));
			let fixed_max=parseInt($(this).attr('max'));
			$(this).unbind('change');
			$(this).bind('change',function(){
				if($(this).is(':focus')){
					$('input[name='+fixed_name+']').val($(this).val());
				}
			});
			$('input[name='+fixed_name+']').unbind('change');
			$('input[name='+fixed_name+']').bind('change',function(){
				let fixed_name=$(this).attr('data-fixed');
				let val=parseInt($(this).val());
				if(val>fixed_max){
					val=fixed_max;
				}
				if(val<fixed_min){
					val=fixed_min;
				}
				$(this).val(val);
				$('input[name='+fixed_name+']').val($(this).val());
			});
		}
	});
}

function unique(arr) {
	var obj = {};
  
	for (var i = 0; i < arr.length; i++) {
	  var str = arr[i];
	  obj[str] = true; // запомнить строку в виде свойства объекта
	}
  
	return Object.keys(obj); // или собрать ключи перебором для IE8-
  }

  function fast_str_replace(search,replace,str){
	return str.split(search).join(replace);
}

function date_str(timestamp,add_time,add_seconds,remove_today=false){
	if(-1==timestamp){
		var d=new Date();
	}
	else{
		var d=new Date(timestamp);
	}
	var day=d.getDate();
	if(day<10){
		day='0'+day;
	}
	var month=d.getMonth()+1;
	if(month<10){
		month='0'+month;
	}
	var minutes=d.getMinutes();
	if(minutes<10){
		minutes='0'+minutes;
	}
	var hours=d.getHours();
	if(hours<10){
		hours='0'+hours;
	}
	var seconds=d.getSeconds();
	if(seconds<10){
		seconds='0'+seconds;
	}
	var datetime_str=day+'.'+month+'.'+d.getFullYear();
	if(add_time){
		datetime_str=datetime_str+' '+hours+':'+minutes;
		if(add_seconds){
			datetime_str=datetime_str+':'+seconds;
		}
	}
	if(remove_today){
		datetime_str=fast_str_replace(date_str(-1)+' ','',datetime_str);
	}
	return datetime_str;
}

function proxyVote(field_name) {
    let proxy_login = $('input[name=' + field_name + ']').val();
    steem.broadcast.accountWitnessProxy(active_key, serey_login, proxy_login, function(err, result) {
if (!err) {
    if (field_name === 'proxy_login') {
    window.alert('Прокси ' + proxy_login + ' успешно установлен.')
    } else {
        window.alert('Прокси ' + proxy_login + ' успешно удалён.')
    }
} else {
    window.alert('Ошибка: ' + JSON.stringify(err));
}
      });
}

function oneWitnessVote() {
    let witness_login = $('input[name=witness_login]').val();
    steem.broadcast.accountWitnessVote(active_key, serey_login, witness_login, true, function(err, result) {
if (!err) {
    window.alert('Вы успешно проголосовали за делегата ' + witness_login + '. Обновите страницу, чтоб увидеть, что он отмечен в списке.')
} else {
if (err.payload.error.message.indexOf('Vote currently exists, user must indicate a desire to reject witness') > -1) {
    window.alert('Вы уже проголосовали за этого делегата.');
} else if (err.payload.error.message.indexOf('unknown key (13)') > -1) {
        window.alert('Аккаунт не существует или не является делегатом.');
} else {
    window.alert('Ошибка: ' + JSON.stringify(err));
}
}
      });
}

  function witnessesVote() {
steem.api.getAccounts([serey_login], function(err, result) {
if (!err) {
if (result[0].proxy !== "") {
    var q = window.confirm('Вы ранее установили прокси голосования за делегатов. Вы действительно хотите проголосовать за делегатов, отменив его?')
    if (q === false) {
return false;
    }
}
let witness_votes = result[0]['witness_votes'];
var operations = [];
    var gr = document.getElementsByName('witnesses');
    for(var i=0; i<gr.length; i++) {
      if (!gr[i].checked && witness_votes.indexOf(gr[i].value) > -1) {
        let op = [];
        op[0] = 'account_witness_vote';
        op[1] = {};
        op[1].account = serey_login;
        op[1].witness = gr[i].value;
        op[1].approve = false;
        operations.push(op);
      } else if (gr[i].checked && witness_votes.indexOf(gr[i].value) === -1) {
            let op = [];
            op[0] = 'account_witness_vote';
            op[1] = {};
            op[1].account = serey_login;
            op[1].witness = gr[i].value;
            op[1].approve = true;
            operations.push(op);  
    }
    }
    steem.broadcast.send({extensions: [], operations}, [active_key], function(error, res) {
if (!error) {
    window.alert('Голоса успешно установлены.');
} else {
    window.alert('Ошибка: ' + JSON.stringify(error));
}
    });
              }
});
  }
  
  $( document ).ready(function() {
   if(0<$('input[type=range]').length){
    bind_range();
  }
});