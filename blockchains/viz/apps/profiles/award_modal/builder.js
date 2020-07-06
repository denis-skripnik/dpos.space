function accountData() {
	viz.api.getAccounts([viz_login], function(err,res) {
let acc = res[0];
const vesting_shares = parseFloat(acc.vesting_shares);
const delegated_vesting_shares = parseFloat(acc.delegated_vesting_shares);
const received_vesting_shares = parseFloat(acc.received_vesting_shares);
const effective_vesting_shares = vesting_shares + received_vesting_shares - delegated_vesting_shares;
let last_vote_time=Date.parse(acc.last_vote_time);
let delta_time=parseInt((new Date().getTime() - last_vote_time+(new Date().getTimezoneOffset()*60000))/1000);
let energy=acc.energy;
let new_energy=parseInt(energy+(delta_time*10000/432000));//CHAIN_ENERGY_REGENERATION_SECONDS 5 days
if(new_energy>10000){
new_energy=10000;
}
let slider_energy1 = document.getElementById('slider_energy_1');
slider_energy1.setAttribute('max', parseInt(new_energy/100));
viz.api.getDynamicGlobalProperties(function(err, props) {
		const total_vesting_fund = parseFloat(props.total_vesting_fund);
		const total_vesting_shares = parseFloat(props.total_vesting_shares);
			const total_reward_fund = parseFloat(props.total_reward_fund);
		const total_reward_shares = parseInt(props.total_reward_shares);

	var viz_price = (total_vesting_shares * 1000000) / (total_vesting_fund * 1000000); //цена одного viz int
	var rshares = parseInt(effective_vesting_shares * 1000000 * new_energy / 10000); // будущие конкурирующии акции Shares пользователя(смотри словарь) int
	var max_payout = parseInt(rshares / (total_reward_shares + rshares) *( total_reward_fund * 1000000) * viz_price); //количество shares за авард int
	max_payout = max_payout / 1000000; // количество shares в десятичном виде float
__("max_payout").innerHTML = ' (Максимум: ' + max_payout + ')';
__('max_payout') && (__('max_payout').onclick = function() {
	document.getElementById('send_awards_form').payout.value = max_payout;
});
});

});
}
var __ = function(id){
	return document.getElementById(id);
};
$( document ).ready(function() {
	if (target_user) {
		__("target").value = target_user;
	}

	__('target') && (__('target').onchange = function() {
		check_login(this.value);
	});

	__('energy_slider_value') && (__('energy_slider_value').onkeyup = function(){
		if (+this.value.replace(/[^0-9]/g, '') <= 100) {
			__('slider_energy_1').value = this.value.replace(/[^0-9]/g, '');
		} else {
			this.value = '100%';
			alert("Значение не может превышать 100%")
		}
	});

	__('enegry_back') && (__('enegry_back').onkeyup = function(){
		if (this.value.replace(/[^0-9]/g, '') <= +this.dataset.max) {
			if (__('enegry_back_slider')) {
				__('enegry_back_slider_1') && (__('enegry_back_slider_1').value = this.value.replace(/[^0-9]/g, ''));
				__('beneficiaries').value = __('temp_beneficiaries').value + __('enegry_back').value.replace(/[^0-9]/g, '')
			} else {
				__("beneficiaries").value = (+__("temp_beneficiaries").value + +__("enegry_back").value.replace(/[^0-9]/g, ''));
			}
		} else {
			this.value = this.dataset.max+"%";
			__('enegry_back_slider_1') && (__('enegry_back_slider_1').value = this.value.replace(/[^0-9]/g, ''));
			alert("Значение не может превышать "+this.dataset.max+"%")
		}
	});

	__('temp_energy') && (__('temp_energy').onkeyup = function() {
		if (+this.value.replace(/[^0-9]/g, '') > 100) {
			this.value = "100%";
			alert("Значение не может превышать 100%");
		}
	});
	if (viz_login && posting_key) {
		if (__('temp_beneficiaries')) {
			__("temp_beneficiaries").value = __("temp_beneficiaries").value.replace('user_login', viz_login);
		}
		if (__("beneficiaries")) {
			__("beneficiaries").value = (__("beneficiaries").value.replace('user_login', viz_login));
		}
		__("awards_auth_form").style.display = "none";
		__("awards_send_form").style.display = "block";
	} else {
		__("send_awards_form").style.display = "none";
		if (__("sortable")) {
		} else {
			__("awards_auth_form").style.display = "block";
		}
	}

	__("auth_form") && (__("auth_form").onsubmit = function(e){
		e.preventDefault();
		AuthForm();
	});

	__("send_awards_form") && (__("send_awards_form").onsubmit = function(e){
		e.preventDefault();
		send_award();
	});

	async function AuthForm() {
		let login = __('this_login').value;
		let regular_key = __('this_posting').value;

		viz.api.getAccounts([login], function(err, res) {
		if (!err && res.length > 0) {
			let acc = res[0];
	let regular = '';
			if (regular_key) {
		const public_wif = viz.auth.wifToPublic(regular_key);
	let regular_public_keys = [];
	for (key of acc.regular_authority.key_auths) {
		regular_public_keys.push(key[0]);
	}
	if (regular_public_keys.includes(public_wif)) {
	regular = sjcl.encrypt('dpos.space_viz_' + login + '_regularKey', regular_key);
	}
	}
	if (!users) {
	users = [];
	}
	if (!localStorage.getItem('viz_users')|| localStorage.getItem('viz_users').indexOf(login) === -1) {
	if (regular) {
		let acc_data = {login, regular};
		localStorage.setItem("viz_current_user", JSON.stringify(acc_data));
	users.push(acc_data);
	localStorage.setItem("viz_users", JSON.stringify(users));
	window.alert('Аккаунт добавлен.');
	} else if (!regular) {
		window.alert('Не введён regular ключ');
	}
	} else {
		window.alert('Аккаунт '+ login + ' уже добавлен. Если вы хотите изменить ключ, просьба сначала удалить его, а потом добавить.');
	}
	} else {
	window.alert('Вероятно, аккаунт не существует. Просьба проверить введённый логин.');
	}
});

if (!viz_login && !posting_key) {
	alert("Не удалось авторизироваться с текущей парой логин/ключ");
} else {
	__("awards_auth_form").style.display = "none";
	__("send_awards_form") && (__("send_awards_form").style.display = "block");
}
}

	// Функция отправки награды
	async function send_award(viz_login, posting_key) {
		let current_user = JSON.parse(localStorage.getItem("viz_current_user"));
		if (current_user) {
		var viz_login = current_user.login;
		var posting_key = sjcl.decrypt('dpos.space_viz_' + viz_login + '_regularKey', current_user.regular);
		}
		var form = __("send_awards_form");

		const [acc] = await viz.api.getAccountsAsync([viz_login]);
		const props = await viz.api.getDynamicGlobalPropertiesAsync();

		const vesting_shares = parseFloat(acc.vesting_shares);
		const delegated_vesting_shares = parseFloat(acc.delegated_vesting_shares);
		const received_vesting_shares = parseFloat(acc.received_vesting_shares);
		const effective_vesting_shares = vesting_shares + received_vesting_shares - delegated_vesting_shares;
		const total_vesting_fund = parseFloat(props.total_vesting_fund);
		const total_vesting_shares = parseFloat(props.total_vesting_shares);
		const total_reward_fund = parseFloat(props.total_reward_fund);
		const total_reward_shares = parseInt(props.total_reward_shares);

		if (form && form.target) {
			var award_target = form.target.value;
			award_target = award_target.toLowerCase();
		} else {
			var award_target = viz_login;
		}

if (form && form.payout) {
			var payout = form.payout.value;

			var award_energy = payout*(total_vesting_fund/total_vesting_shares) / total_reward_fund*(total_reward_shares / 1000000)/effective_vesting_shares;
			award_energy *= 10000;
			award_energy = parseInt(award_energy);
		} else {
			if (form.energy.value) {
				var award_energy = form.energy.value;
				award_energy *= 100;
				award_energy = parseInt(award_energy);
			} else {
				var award_energy = 1;
			}
		}
		if (form && form.custom_sequence) {
		var custom_sequence = parseInt(form.custom_sequence.value);
		} else {
			var custom_sequence = 0;
		}

		if (form && form.memo) {
			var memo = decodeURIComponent(form.memo.value);
		} else {
			var memo = '';
		}
		if (form && form.beneficiaries) {
			var beneficiaries = form.beneficiaries.value;
			var benef = beneficiaries.split(',');
			var benef_list = [];
			var beneficiaries_whait = 0;
			benef.forEach(function (el) {
				var b = el.split(':');
				var benef_login = b[0];
				benef_login = benef_login.toLowerCase();
				var benef_percent = +b[1]*100;
				beneficiaries_whait += benef_percent/100;
				benef_list.push({account:benef_login,weight:benef_percent});
			});
		} else {
			var beneficiaries_whait = 0;
			var benef_list = [];
		}

		// Рассчёт стоимости награды:
var viz_price = (total_vesting_shares * 1000000) / (total_vesting_fund * 1000000); //цена одного viz int
var rshares = parseInt(effective_vesting_shares * 1000000 * award_energy / 10000); // будущие конкурирующии акции Shares пользователя(смотри словарь) int
var all_award_payout = parseInt(rshares / (total_reward_shares + rshares) *( total_reward_fund * 1000000) * viz_price); //количество shares за авард int
		var beneficiaries_payout = (all_award_payout/100)*beneficiaries_whait;
		var award_payout = all_award_payout - beneficiaries_payout;
all_award_payout = all_award_payout / 1000000; // количество shares в десятичном виде float
		beneficiaries_payout = parseInt(beneficiaries_payout) / 1000000;
		award_payout = parseInt(award_payout) / 1000000;

		viz.broadcast.awardAsync(posting_key,viz_login,award_target,award_energy,custom_sequence,memo,benef_list, (err,result) => {
		if (!err) {
			viz.api.getAccountsAsync([viz_login], (err, res) => {
				__('account_energy').innerHTML = (res[0].energy/100 + '%');
			});

			if (form && form.redirect) {
				var redirect = form.redirect.value;
				window.location.href = redirect;
			} else {
				__("main_award_info").style.display = "block";
				__('viz_result_short_msg').innerHTML = ('<strong>Вы успешно отправили награду.</strong>');
				__("long_viz_result").style.display = "block";
				__('viz_award_target').innerHTML = award_target;
				__('viz_award_target').innerHTML = award_target;
				__('viz_award_energy').innerHTML = award_energy/100;
				__('viz_award_payout').innerHTML = award_payout;
			}
		} else {
			if (/used_energy <= current_energy/.test(err)) {
				__("main_award_info").style.display = "block";
				__('viz_result_short_msg').innerHTML = ('<strong>Просьба проверить значение energy.</strong>');
			} else if (/beneficiaries.weight = NaN/.test(err)) {
				__("main_award_info").style.display = "block";
				__('viz_result_short_msg').innerHTML = ('<strong>Бенефициар есть, а процента, который он получит - нет. Просьба сообщить создателям приложения об этой ошибке.</strong>');
			} else if (/acc != nullptr: Beneficiary/.test(err)) {
				__("main_award_info").style.display = "block";
				__('viz_result_short_msg').innerHTML = ('<strong>1 или несколько аккаунтов бенефициаров не существует. Просьба сообщить создателям приложения об этой ошибке.</strong>');
			} else if (/is_valid_account_name\(name\): Account name/.test(err)) {
				__("main_award_info").style.display = "block";
				__('viz_result_short_msg').innerHTML = ('<strong>Аккаунт награждаемого или бенефициара не существует. Просьба сообщить создателям приложения об этой ошибке.</strong>');
			} else {
				window.alert(err);
			}
		}
		});
	}

	//Получение логина
	function get_login() {
		let current_user = JSON.parse(localStorage.getItem("viz_current_user"));
		if (current_user) {
		var viz_login = current_user.login;
			return viz_login;
		} else {
			return false;
		}
	}
	accountData();
	//Проверка логина
	async function check_login(login) {
		try {
			const user = await viz.api.getAccountsAsync([login]);
			if (user.length > 0) {
				__("target").value = (login);
			} else {
				window.alert('Получатель награды не найден. Просьба обратиться к администраторам приложения.');
			}
		} catch(e) {
			window.alert('Ошибка: ' + e);
		}
	}
});