function sendTransfer(name, data) {
	var q = window.confirm('Вы действительно хотите отправить транзакцию перевода 100 VIZ для добавления проекта или задачи?');
	if (q == true) {
		let arr = [];
		arr[0] = name;
		arr[1] = data;
		let json = JSON.stringify(arr);
	viz.broadcast.transfer(active_key, viz_login, 'viz-projects', '100.000 VIZ', json, function(err, result) {
	  if (!err) {
	window.alert('Операция произведена успешно.');
	  }
	  else window.alert(err);
	});
	
	}
}

function sendCustom(name, data) {
	var q = window.confirm('Вы действительно хотите отправить эту транзакцию?');
	if (q == true) {
		let arr = [];
		arr[0] = name;
		arr[1] = data;
		let json = JSON.stringify(arr);
		viz.broadcast.custom(posting_key,[],[viz_login],'viz-projects', json, function(err, result) {
			console.log(err, result);
		  });
	
	}
}

function spoiler(elem)
{
    style = document.getElementById(elem).style;
    style.display = (style.display == 'block') ? 'none' : 'block';
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
