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

	/* Index */
	index_account_caption:'Аккаунт',
	index_social_capital_caption:'Капитал (viz)',
	index_balance_caption:'Баланс (viz)',

	/* Access */
	access_remove_caption:'удалить',
	access_weight_caption:'вес %weight%',
	access_need_regular_weight:'Суммарный вес для обычного типа доступа меньше необходимого',
	access_need_active_weight:'Суммарный вес для активного типа доступа меньше необходимого',
	access_need_master_weight:'Суммарный вес для главного типа доступа меньше необходимого',
	access_saved_successfully:'Схема доступа успешно сохранена',
	access_save_keys:', обязательно скопируйте новые ключи',
	access_error:'Ошибка в запросе, проверьте главный ключ и попробуйте позже (возможно вы меняете доступы или сбрасываете ключи чаще, чем раз в час)',
	access_invalid_master_weight_threshold:'Необходимый вес для главного типа доступа недействительный',
	access_invalid_active_weight_threshold:'Необходимый вес для активного типа доступа недействительный',
	access_invalid_regular_weight_threshold:'Необходимый вес для обычного типа доступа недействительный',
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
	default_invalid_master_key:'Главный пароль недействительный',
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
	let wif=viz.auth.toWif('',ret,'');
	return wif;
}

var keys=[];
keys=viz.auth.getPrivateKeys('',pass_gen(100),['master','active','regular','memo']);
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
function manage_access_save(account,master_key,el){
	el.find('.manage-access-preload-error').html('');
	el.find('.manage-access-preload-success').html('');
	if(!viz.auth.isWif(master_key)){
		el.find('.manage-access-save-error').html(ltmp_arr.default_invalid_master_key);
		return;
	}
	let master_weight_threshold=parseInt(el.find('input[name=master-weight-threshold]').val());
	let active_weight_threshold=parseInt(el.find('input[name=active-weight-threshold]').val());
	let regular_weight_threshold=parseInt(el.find('input[name=regular-weight-threshold]').val());
	if((parseInt(master_weight_threshold)<=0)||(isNaN(parseInt(master_weight_threshold)))){
		el.find('.manage-access-save-error').html(ltmp_arr.access_invalid_master_weight_threshold);
		return;
	}
	if((parseInt(active_weight_threshold)<=0)||(isNaN(parseInt(active_weight_threshold)))){
		el.find('.manage-access-save-error').html(ltmp_arr.access_invalid_active_weight_threshold);
		return;
	}
	if((parseInt(regular_weight_threshold)<=0)||(isNaN(parseInt(regular_weight_threshold)))){
		el.find('.manage-access-save-error').html(ltmp_arr.access_invalid_regular_weight_threshold);
		return;
	}

	let master_weight_sum=0;
	let active_weight_sum=0;
	let regular_weight_sum=0;

	let master_account_auths=[];
	let active_account_auths=[];
	let regular_account_auths=[];

	let master_key_auths=[];
	let active_key_auths=[];
	let regular_key_auths=[];

	let to_save=[];

	el.find('.account-keys .master-accounts .account-auths').each(function(i,auth_el){
		master_account_auths.push([$(auth_el).attr('data-account1'),parseInt($(auth_el).attr('data-weight'))]);
		master_weight_sum+=parseInt($(auth_el).attr('data-weight'));
	});
	el.find('.account-keys .active-accounts .account-auths').each(function(i,auth_el){
		active_account_auths.push([$(auth_el).attr('data-account2'),parseInt($(auth_el).attr('data-weight'))]);
		active_weight_sum+=parseInt($(auth_el).attr('data-weight'));
	});
	el.find('.account-keys .regular-accounts .account-auths').each(function(i,auth_el){
		regular_account_auths.push([$(auth_el).attr('data-account3'),parseInt($(auth_el).attr('data-weight'))]);
		regular_weight_sum+=parseInt($(auth_el).attr('data-weight'));
	});

	el.find('.account-keys .master-keys .key-auths').each(function(i,auth_el){
		master_key_auths.push([$(auth_el).attr('data-key'),parseInt($(auth_el).attr('data-weight'))]);
		if(typeof $(auth_el).attr('data-private-key') !== 'undefined'){
			to_save.push(['master',$(auth_el).attr('data-private-key')]);
		}
		master_weight_sum+=parseInt($(auth_el).attr('data-weight'));
	});
	el.find('.account-keys .active-keys .key-auths').each(function(i,auth_el){
		active_key_auths.push([$(auth_el).attr('data-key'),parseInt($(auth_el).attr('data-weight'))]);
		if(typeof $(auth_el).attr('data-private-key') !== 'undefined'){
			to_save.push(['active',$(auth_el).attr('data-private-key')]);
		}
		active_weight_sum+=parseInt($(auth_el).attr('data-weight'));
	});
	el.find('.account-keys .regular-keys .key-auths').each(function(i,auth_el){
		regular_key_auths.push([$(auth_el).attr('data-key'),parseInt($(auth_el).attr('data-weight'))]);
		if(typeof $(auth_el).attr('data-private-key') !== 'undefined'){
			to_save.push(['regular',$(auth_el).attr('data-private-key')]);
		}
		regular_weight_sum+=parseInt($(auth_el).attr('data-weight'));
	});

	if(master_weight_sum<master_weight_threshold){
		el.find('.manage-access-save-error').html(ltmp_arr.access_need_master_weight);
		return;
	}
	if(active_weight_sum<active_weight_threshold){
		el.find('.manage-access-save-error').html(ltmp_arr.access_need_active_weight);
		return;
	}
	if(regular_weight_sum<regular_weight_threshold){
		el.find('.manage-access-save-error').html(ltmp_arr.access_need_regular_weight);
		return;
	}

	let master = {
		'weight_threshold': master_weight_threshold,
		'account_auths': master_account_auths,
		'key_auths': master_key_auths
	};
	let active = {
		'weight_threshold': active_weight_threshold,
		'account_auths': active_account_auths,
		'key_auths': active_key_auths
	};
	let regular = {
		'weight_threshold': regular_weight_threshold,
		'account_auths': regular_account_auths,
		'key_auths': regular_key_auths
	};
	let json_metadata=el.find('input[name=manage-access-json-metadata]').val();
	let memo_key=el.find('input[name=manage-access-memo-key]').val();
	if(typeof el.find('input[name=manage-access-memo-key]').attr('data-private-key')){
		if(''!=el.find('input[name=manage-access-memo-key]').attr('data-private-key')){
			to_save.push(['memo',el.find('input[name=manage-access-memo-key]').attr('data-private-key')]);
		}
	}

	let txt_to_save='';
	if(0<to_save.length){
		txt_to_save='dpos.space/viz\r\n\r\n';
		txt_to_save+='Account: '+account+'\r\n\r\n';
		txt_to_save+='New authorites\r\n';
		html_to_show='<p class="captions">Account: <strong>'+account+'</strong></p>';
		for(i in to_save){
			txt_to_save+=to_save[i][0]+': '+to_save[i][1]+'\r\n';
			html_to_show+='<p class="captions">'+to_save[i][0]+': <strong>'+to_save[i][1]+'</strong></p>';
		}
		txt_to_save=txt_to_save.trim();
	}

	el.find('.manage-access-save-action').attr('disabled','disabled');
	el.find('.icon-check[rel=save]').css('display','none');
	el.find('.submit-button-ring[rel=save]').css('display','inline-block');

	viz.broadcast.accountUpdate(master_key,account,master,active,regular,memo_key,json_metadata,function(err,result){
		if(result){
			el.find('.manage-access-save-success').html(ltmp_arr.access_saved_successfully+(0<to_save.length?ltmp_arr.access_save_keys:''));
			el.find('.manage-access-save-error').html('');

			el.find('.submit-button-ring[rel=save]').css('display','none');
			el.find('.icon-check[rel=save]').css('display','inline-block');
			el.find('input[name=manage-access-master-key]').val('');
			el.find('.manage-access-save-action').removeAttr('disabled');

			if(0<to_save.length){
				el.find('.manage-access-new-keys').html(html_to_show);
				download('viz-access.txt',txt_to_save);
			}
		}
		else{
			el.find('.manage-access-save-error').html(ltmp_arr.access_error);
			el.find('.submit-button-ring[rel=save]').css('display','none');
			el.find('.manage-access-save-action').removeAttr('disabled');

			console.log(JSON.stringify(err));
		}
	});

	return;
}
function manage_access_preload(account,el){
	el.find('.manage-access-preload-error').html('');
	el.find('.manage-access-preload-success').html('');

	el.find('.manage-access-preload-action').attr('disabled','disabled');
	el.find('.icon-check[rel=preload]').css('display','none');
	el.find('.submit-button-ring[rel=preload]').css('display','inline-block');

	el.find('.account-keys .master-accounts .account-auths').remove();
	el.find('.account-keys .master-keys .key-auths').remove();
	el.find('.account-keys .active-accounts .account-auths').remove();
	el.find('.account-keys .active-keys .key-auths').remove();
	el.find('.account-keys .regular-accounts .account-auths').remove();
	el.find('.account-keys .regular-keys .key-auths').remove();
	el.find('.account-keys input[name=manage-access-memo-key]').val('');
	el.find('.account-keys input[name=manage-access-memo-key]').attr('data-private-key','');
	el.find('.account-keys input[name=manage-access-master-key]').val('');
	el.find('.account-keys input[name=manage-access-master-key]').attr('data-account','');

	viz.api.getAccounts([account],function(err,response){
		if(typeof response[0] !== 'undefined'){
			let counter=0;
			el.find('.manage-access-preload-success').html(ltmp_arr.access_loaded);
			el.find('.submit-button-ring[rel=preload]').css('display','none');
			el.find('.icon-check[rel=preload]').css('display','inline-block');
			el.find('.manage-access-preload-action').removeAttr('disabled');

			el.find('.account-keys .master-accounts .none-auths').css('display','none');
			el.find('.account-keys .master-keys .none-auths').css('display','none');
			el.find('.account-keys .active-accounts .none-auths').css('display','none');
			el.find('.account-keys .active-keys .none-auths').css('display','none');
			el.find('.account-keys .regular-accounts .none-auths').css('display','none');
			el.find('.account-keys .regular-keys .none-auths').css('display','none');

			el.find('.submit-button-ring[rel=save]').css('display','none');
			el.find('.icon-check[rel=save]').css('display','none');
			el.find('.manage-access-save-success').html('');
			el.find('.manage-access-save-error').html('');
			el.find('.manage-access-new-keys').html('');

			el.find('.account-keys').css('display','block');
			el.find('.account-keys .account-login').html(account);
			el.find('.account-keys input[name=manage-access-master-key]').attr('data-account',account);

			el.find('.account-keys input[name=master-weight-threshold]').val(response[0].master_authority.weight_threshold);
			el.find('.account-keys input[name=active-weight-threshold]').val(response[0].active_authority.weight_threshold);
			el.find('.account-keys input[name=regular-weight-threshold]').val(response[0].regular_authority.weight_threshold);
			el.find('.account-keys input[name=manage-access-memo-key]').val(response[0].memo_key);
			el.find('.account-keys input[name=manage-access-json-metadata]').val(response[0].json_metadata);

			counter=0;
			for(i in response[0].master_authority.account_auths){
				let new_el='<div class="account-auths" data-account1="'+response[0].master_authority.account_auths[i][0]+'" data-weight="'+response[0].master_authority.account_auths[i][1]+'">';
				new_el+=response[0].master_authority.account_auths[i][0];
				new_el+='<div class="adaptive-show-block"></div>';
				new_el+=' <span class="weight-inline">'+ltmp(ltmp_arr.access_weight_caption,{weight:response[0].master_authority.account_auths[i][1]})+'</span>';
				new_el+='<a class="red-button-inline delete-auth-action" onclick="el = $(`div[data-account1='+response[0].master_authority.account_auths[i][0]+']`); deleteauthaction(el);">'+ltmp_arr.access_remove_caption+'</a>';
				new_el+='</div>';
				el.find('.account-keys .master-accounts').append(new_el);
				++counter;
			}
			if(0==counter){
				el.find('.account-keys .master-accounts .none-auths').css('display','block');
			}
			counter=0;
			for(i in response[0].master_authority.key_auths){
				let new_el='<div class="key-auths" data-key="'+response[0].master_authority.key_auths[i][0]+'" data-weight="'+response[0].master_authority.key_auths[i][1]+'">';
				new_el+=response[0].master_authority.key_auths[i][0];
				new_el+='<div class="adaptive-show-block"></div>';
				new_el+=' <span class="weight-inline">'+ltmp(ltmp_arr.access_weight_caption,{weight:response[0].master_authority.key_auths[i][1]})+'</span>';
				new_el+='<a class="red-button-inline delete-auth-action" onclick="el = $(`div[data-key='+response[0].master_authority.key_auths[i][0]+']`); deleteauthaction(el);">'+ltmp_arr.access_remove_caption+'</a>';
				new_el+='</div>';
				el.find('.account-keys .master-keys').append(new_el);
				++counter;
			}
			if(0==counter){
				el.find('.account-keys .master-keys .none-auths').css('display','block');
			}

			counter=0;
			for(i in response[0].active_authority.account_auths){
				let new_el='<div class="account-auths" data-account2="'+response[0].active_authority.account_auths[i][0]+'" data-weight="'+response[0].active_authority.account_auths[i][1]+'">';
				new_el+=response[0].active_authority.account_auths[i][0];
				new_el+='<div class="adaptive-show-block"></div>';
				new_el+= '<span class="weight-inline">'+ltmp(ltmp_arr.access_weight_caption,{weight:response[0].active_authority.account_auths[i][1]})+'</span>';
				new_el+='<a class="red-button-inline delete-auth-action" onclick=" el = $(`div[data-account2='+response[0].active_authority.account_auths[i][0]+']`); deleteauthaction(el);">'+ltmp_arr.access_remove_caption+'</a>';
				new_el+='</div>';
				el.find('.account-keys .active-accounts').append(new_el);
				++counter;
			}
			if(0==counter){
				el.find('.account-keys .active-accounts .none-auths').css('display','block');
			}
			counter=0;
			for(i in response[0].active_authority.key_auths){
				let new_el='<div class="key-auths" data-key="'+response[0].active_authority.key_auths[i][0]+'" data-weight="'+response[0].active_authority.key_auths[i][1]+'">';
				new_el+=response[0].active_authority.key_auths[i][0];
				new_el+='<div class="adaptive-show-block"></div>';
				new_el+=' <span class="weight-inline">'+ltmp(ltmp_arr.access_weight_caption,{weight:response[0].active_authority.key_auths[i][1]})+'</span>';
				new_el+='<a class="red-button-inline delete-auth-action" onclick="el = $(`div[data-key='+response[0].active_authority.key_auths[i][0]+']`); deleteauthaction(el);">'+ltmp_arr.access_remove_caption+'</a>';
				new_el+='</div>';
				el.find('.account-keys .active-keys').append(new_el);
				++counter;
			}
			if(0==counter){
				el.find('.account-keys .active-keys .none-auths').css('display','block');
			}

			counter=0;
			for(i in response[0].regular_authority.account_auths){
				let new_el='<div class="account-auths" data-account3="'+response[0].regular_authority.account_auths[i][0]+'" data-weight="'+response[0].regular_authority.account_auths[i][1]+'">';
				new_el+=response[0].regular_authority.account_auths[i][0];
				new_el+='<div class="adaptive-show-block"></div>';
				new_el+=' <span class="weight-inline">'+ltmp(ltmp_arr.access_weight_caption,{weight:response[0].regular_authority.account_auths[i][1]})+'</span>';
				new_el+='<a class="red-button-inline delete-auth-action" onclick=" el = $(`div[data-account3='+response[0].regular_authority.account_auths[i][0]+']`); deleteauthaction(el);">'+ltmp_arr.access_remove_caption+'</a>';
				new_el+='</div>';
				el.find('.account-keys .regular-accounts').append(new_el);
				++counter;
			}
			if(0==counter){
				el.find('.account-keys .regular-accounts .none-auths').css('display','block');
			}
			counter=0;
			for(i in response[0].regular_authority.key_auths){
				let new_el='<div class="key-auths" data-key="'+response[0].regular_authority.key_auths[i][0]+'" data-weight="'+response[0].regular_authority.key_auths[i][1]+'">';
				new_el+=response[0].regular_authority.key_auths[i][0];
				new_el+='<div class="adaptive-show-block"></div>';
				new_el+=' <span class="weight-inline">'+ltmp(ltmp_arr.access_weight_caption,{weight:response[0].regular_authority.key_auths[i][1]})+'</span>';
				new_el+='<a class="red-button-inline delete-auth-action" onclick=" el = $(`div[data-key='+response[0].regular_authority.key_auths[i][0]+']`); deleteauthaction(el);">'+ltmp_arr.access_remove_caption+'</a>';
				new_el+='</div>';
				el.find('.account-keys .regular-keys').append(new_el);
				++counter;
			}
			if(0==counter){
				el.find('.account-keys .regular-keys .none-auths').css('display','block');
			}
		}
		else{
			el.find('.manage-access-preload-error').html(ltmp_arr.default_account_not_found_or_incorrect_response);
			el.find('.submit-button-ring[rel=preload]').css('display','none');
			el.find('.manage-access-preload-action').removeAttr('disabled');
		}
	});
}

var genkeyauthsaction = function(el){
		let type=el;
		let private_key=pass_gen(100,true);
		let public_key=viz.auth.wifToPublic(private_key);
		$('.page-manage-access .account-keys-'+type+' .add-key-auths input[name=private-key]').val(private_key);
		$('.page-manage-access .account-keys-'+type+' .add-key-auths input[name=public-key]').val(public_key);
};
var addkeyauthsaction = function(el){
		let type=el;
		$('.page-manage-access .account-keys-'+type+' .add-key-auths input[name=private-key]').removeClass('red');
		$('.page-manage-access .account-keys-'+type+' .add-key-auths input[name=public-key]').removeClass('red');
		$('.page-manage-access .account-keys-'+type+' .add-key-auths input[name=weight]').removeClass('red');
		let private_key=$('.page-manage-access .account-keys-'+type+' .add-key-auths input[name=private-key]').val();
		let public_key=$('.page-manage-access .account-keys-'+type+' .add-key-auths input[name=public-key]').val();
		let weight=$('.page-manage-access .account-keys-'+type+' .add-key-auths input[name=weight]').val();
		if(!viz.auth.isPubkey(public_key)){
			$('.page-manage-access .account-keys-'+type+' .add-key-auths input[name=public-key]').addClass('red');
			$('.page-manage-access .account-keys-'+type+' .add-key-auths input[name=public-key]').focus();
			return;
		}
		if(''!=private_key){
			if(!viz.auth.isWif(private_key)){
				$('.page-manage-access .account-keys-'+type+' .add-key-auths input[name=private-key]').addClass('red');
				$('.page-manage-access .account-keys-'+type+' .add-key-auths input[name=private-key]').focus();
				return;
			}
			if(viz.auth.wifToPublic(private_key)!=public_key){
				$('.page-manage-access .account-keys-'+type+' .add-key-auths input[name=private-key]').addClass('red');
				$('.page-manage-access .account-keys-'+type+' .add-key-auths input[name=public-key]').addClass('red');
				$('.page-manage-access .account-keys-'+type+' .add-key-auths input[name=private-key]').focus();
				return;
			}
		}
		if(''==weight){
			$('.page-manage-access .account-keys-'+type+' .add-key-auths input[name=weight]').addClass('red');
			$('.page-manage-access .account-keys-'+type+' .add-key-auths input[name=weight]').focus();
			return;
		}
		if((parseInt(weight)<=0)||(isNaN(parseInt(weight)))){
			$('.page-manage-access .account-keys-'+type+' .add-key-auths input[name=weight]').addClass('red');
			$('.page-manage-access .account-keys-'+type+' .add-key-auths input[name=weight]').focus();
			return;
		}
		let new_el=`<div class='key-auths' data-key='${public_key}' data-weight='${weight}' data-private-key='${private_key}'>`;
		new_el+=public_key;
		new_el+=`<span class='weight-inline'>`+ltmp(ltmp_arr.access_weight_caption,{weight:weight})+'</span>';
		new_el+=`<a class='red-button-inline delete-auth-action' onclick="el = $('div[data-key=${public_key}]'); deleteauthaction(el);">`+ltmp_arr.access_remove_caption+'</a>';
		new_el+='</div>';
		$('.page-manage-access .account-keys .'+type+'-keys').append(new_el);

		$('.page-manage-access .account-keys .'+type+'-keys .none-auths').css('display','none');
};

var addaccountauthsaction = function(el){
		let type=el;
			let num;
		if(type=='master'){
			num = 1;
		} else if(type=='active'){
			num = 2;
		} else if(type=='regular'){
			num = 3;
		}
		$('.page-manage-access .account-keys-'+type+' .add-account-auths input[name=account]').removeClass('red');
		$('.page-manage-access .account-keys-'+type+' .add-account-auths input[name=weight]').removeClass('red');
		let account=$('.page-manage-access .account-keys-'+type+' .add-account-auths input[name=account]').val().toLowerCase().trim();
		let weight=$('.page-manage-access .account-keys-'+type+' .add-account-auths input[name=weight]').val();
		$('.page-manage-access .account-keys-'+type+' .add-account-auths input[name=account]').val(account);
		if(''==account){
			$('.page-manage-access .account-keys-'+type+' .add-account-auths input[name=account]').addClass('red');
			$('.page-manage-access .account-keys-'+type+' .add-account-auths input[name=account]').focus();
			return;
		}
		if(!(/^([a-z0-9\-\.]*)$/).test(account)){
			$('.page-manage-access .account-keys-'+type+' .add-account-auths input[name=account]').addClass('red');
			$('.page-manage-access .account-keys-'+type+' .add-account-auths input[name=account]').focus();
			return;
		}
		if(''==weight){
			$('.page-manage-access .account-keys-'+type+' .add-account-auths input[name=weight]').addClass('red');
			$('.page-manage-access .account-keys-'+type+' .add-account-auths input[name=weight]').focus();
			return;
		}
		if((parseInt(weight)<=0)||(isNaN(parseInt(weight)))){
			$('.page-manage-access .account-keys-'+type+' .add-account-auths input[name=weight]').addClass('red');
			$('.page-manage-access .account-keys-'+type+' .add-account-auths input[name=weight]').focus();
			return;
		}
		let new_el='<div class="account-auths" data-account'+num+'="'+account+'" data-weight="'+weight+'">';
		new_el+=account;
		new_el+='<span class="weight-inline">'+ltmp(ltmp_arr.access_weight_caption,{weight:weight})+'</span>';
		new_el+='<a class="red-button-inline delete-auth-action" onclick="el = $(`div[data-account'+num+'='+account+']`); deleteauthaction(el);">'+ltmp_arr.access_remove_caption+'</a>';
		new_el+='</div>';
		$('.page-manage-access .account-keys .'+type+'-accounts').append(new_el);

		$('.page-manage-access .account-keys .'+type+'-accounts .none-auths').css('display','none');
};

var deleteauthaction = function(el){
		let parent=el;
		let type_el=parent.parent();
		if(parent.hasClass('key-auths')){
			parent.remove();
			if(0<type_el.find('.key-auths').length){
				type_el.find('.none-auths').css('display','none');
			}
			else{
				type_el.find('.none-auths').css('display','block');
			}
		}
		if(parent.hasClass('account-auths')){
			parent.remove();
			if(0<type_el.find('.account-auths').length){
				type_el.find('.none-auths').css('display','none');
			}
			else{
				type_el.find('.none-auths').css('display','block');
			}
		}
}