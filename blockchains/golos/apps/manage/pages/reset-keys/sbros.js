/* Localisation Template*/
function ltmp(ltmp_str,ltmp_args){
	for(ltmp_i in ltmp_args){
		ltmp_str=ltmp_str.split('%'+ltmp_i+'%').join(ltmp_args[ltmp_i]);
	}
	return ltmp_str;
}
var ltmp_arr={
	/* Node addon */
	node_request:'Отправляем запрос ноде&hellip;',
	node_not_respond:'Нода не отвечает',
	node_wrong_response:'Ответ от ноды не соответствует формату',
	node_protocol_error:'Адрес ноды должен содержать протокол (http/https/ws/wss)',
	node_empty_error:'Адрес ноды не может быть пустым',

	/* Access */
	access_remove_caption:'удалить',
	access_weight_caption:'вес %weight%',
	access_need_posting_weight:'Суммарный вес для обычного типа доступа меньше необходимого',
	access_need_active_weight:'Суммарный вес для активного типа доступа меньше необходимого',
	access_need_owner_weight:'Суммарный вес для главного типа доступа меньше необходимого',
	access_saved_successfully:'Схема доступа успешно сохранена',
	access_save_keys:', обязательно скопируйте новые ключи',
	access_error:'Ошибка в запросе, проверьте главный ключ и попробуйте позже (возможно вы меняете доступы или сбрасываете ключи чаще, чем раз в час)',
	access_invalid_owner_weight_threshold:'Необходимый вес для главного типа доступа недействительный',
	access_invalid_active_weight_threshold:'Необходимый вес для активного типа доступа недействительный',
	access_invalid_posting_weight_threshold:'Необходимый вес для обычного типа доступа недействительный',
	access_reset_success:'Ключи успешно сброшены, обязательно сохраните их',
	access_loaded:'Схема доступов аккаунта успешно загружена',

	login_wif_invalid:'Приватный ключ невалидный',
	login_account_not_found:'Аккаунт с таким логином не найден',
	login_key_weight_not_enough:'Веса активного ключа недостаточно для выполнения операций этим аккаунтом',

	plural_days_1:' день',
	plural_days_2:' дня',
	plural_days_5:' дней',

	/* Default captions */
	default_operation_error:'Ошибка при подтверждении операции',
	default_no_items:'Записей не найдено.',
	default_no_items_try_other_page:' Попробуйте перейти на другую страницу',
	default_no_items_try_other_search:' или задать другие условия поиска',
	default_no_items_try_other_end:'.',
	default_incorrect_response:'Ошибка в запросе, попробуйте позже',
	default_account_not_found_or_incorrect_response:'Аккаунт не найден или ошибка в запросе',
	default_loading:'Загрузка&hellip;',
	default_node_not_respond:'Ошибка! Публичная нода не отвечает, попробуйте позже обновив страницу.',
	default_node_error:'Ошибка в получении данных от публичной ноды, попробуйте позже.',
	default_prev_page:'&larr; Предыдущая страница',
	default_next_page:'Следующая страница &rarr;',
	default_list_items_counter:'Показано',
	default_select_action:'Выберите действие',
	default_invalid_owner_key:'Главный пароль недействительный',
	default_date_utc:' UTC',
	default_return_link:'&larr; Вернуться',
};
function plural_str(number,one,two,five){
	let n=Math.abs(number);
	n%=100;
	if(n>=5&&n<=20){
		return five;
	}
	n%=10;
	if(n===1) {
		return one;
	}
	if(n>=2&&n<=4){
		return two;
	}
	return five;
}
function pass_gen(length,to_wif){
	length=typeof length==='undefined'?100:length;
	to_wif=typeof to_wif==='undefined'?true:to_wif;
	let charset='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+-=_:;.,@!^&*$';
	let ret='';
	for (var i=0,n=charset.length;i<length;++i){
		ret+=charset.charAt(Math.floor(Math.random()*n));
	}
	if(!to_wif){
		return ret;
	}
	let wif=golos.auth.toWif('',ret,'');
	return wif;
}

var keys=[];
keys=golos.auth.getPrivateKeys('',pass_gen(100),['owner','active','posting','memo']);
function escape_html(text) {
	var map = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#039;'
	};
	return text.replace(/[&<>"']/g,function(m){return map[m];});
}
$(window).on('hashchange',function(e){
	e.preventDefault();
	if(''!=window.location.hash){
		if($(window.location.hash).length>0){
			$('body,html').animate({scrollTop:parseInt($('.index[data-index='+window.location.hash+']').offset().top) - 64 - 10},1000);
		}
	}
	else{
		$(window).scrollTop(0);
	}
});
function app_keyboard(e){
	if(!e)e=window.event;
	var key=(e.charCode)?e.charCode:((e.keyCode)?e.keyCode:((e.which)?e.which:0));
	let char=String.fromCharCode(key);
	//console.log(key,char);
	/*
	if(key==27){
		e.preventDefault();
	}
	*/
}

function number_thousands(n){
	str=''+n;
	str_arr=str.split('.');
	let minus=false;
	if(n<0){
		str_arr[0]=str_arr[0].substr(1);
		minus=true;
	}
	lstr_len=str_arr[0].length;

	for(i=lstr_len;i>0;--i){
		if(0==(-lstr_len+i)%3){
			str_arr[0]=str_arr[0].substr(0,i)+' '+str_arr[0].substr(i);
		}
	}

	str_arr[0]=str_arr[0].trim();
	return (minus?'&minus;':'')+str_arr[0]+(str_arr[1]?'.'+str_arr[1]:'');
}

function download(filename,text) {
	var link = document.createElement('a');
	link.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
	link.setAttribute('download', filename);

	if (document.createEvent) {
		var event = document.createEvent('MouseEvents');
		event.initEvent('click', true, true);
		link.dispatchEvent(event);
	}
	else {
		link.click();
	}
}

function fast_str_replace(search,replace,str){
	return str.split(search).join(replace);
}
function reset_access(account,owner_key,el){
	if(!golos.auth.isWif(owner_key)){
		el.find('.reset-access-error').html(ltmp_arr.default_invalid_owner_key);
		return;
	}
	el.find('.reset-access-error').html('');
	el.find('.reset-access-success').html('');
	el.find('.reset-access-action').attr('disabled','disabled');
	el.find('.icon-check').css('display','none');
	el.find('.submit-button-ring').css('display','inline-block');

	let auth_types=['posting','active','owner','memo'];
	let keys=golos.auth.getPrivateKeys(account,pass_gen(100),auth_types);
	let owner = {
		'weight_threshold': 1,
		'account_auths': [],
		'key_auths': [
			[keys.ownerPubkey, 1]
		]
	};
	let active = {
		'weight_threshold': 1,
		'account_auths': [],
		'key_auths': [
			[keys.activePubkey, 1]
		]
	};
	let posting = {
		"weight_threshold": 1,
		"account_auths": [],
		"key_auths": [
			[keys.postingPubkey, 1]
		]
	};
	let memo_key=keys.memoPubkey;

	golos.api.getAccounts([account],function(err,response){
		if(typeof response[0] !== 'undefined'){
			let json_metadata=response[0].json_metadata;
			golos.broadcast.accountUpdate(owner_key,account,owner,active,posting,memo_key,json_metadata,function(err,result){
				if(result){
					el.find('.reset-access-success').html(ltmp_arr.access_reset_success);
					el.find('.reset-access-error').html('');

					el.find('.submit-button-ring').css('display','none');
					el.find('.icon-check').css('display','inline-block');
					el.find('input[name=reset-access-owner-key]').val('');
					el.find('.reset-access-action').removeAttr('disabled');

					el.find('.account-keys .account-login').html(account);
					el.find('.account-keys .owner-key').html(keys['owner']);
					el.find('.account-keys .active-key').html(keys['active']);
					el.find('.account-keys .posting-key').html(keys['posting']);
					el.find('.account-keys .memo-key').html(keys['memo']);
					el.find('.account-keys').css('display','block');

					download('golos-account.txt','dpos.space/golos\r\n\r\nAccount login: '+account+'\r\nowner key: '+keys['owner']+'\r\nActive key: '+keys['active']+'\r\nposting key: '+keys['posting']+'\r\nMemo key: '+keys['memo']+'');
				}
				else{
					el.find('.reset-access-error').html(ltmp_arr.access_error);
					el.find('.submit-button-ring').css('display','none');
					el.find('.reset-access-action').removeAttr('disabled');

					console.log(JSON.stringify(err));
				}
			});
		}
		else{
			el.find('.reset-access-error').html(ltmp_arr.default_account_not_found_or_incorrect_response);
			el.find('.submit-button-ring').css('display','none');
			el.find('.reset-access-action').removeAttr('disabled');
		}
	});
}
