function checkWorkingNode() {
	const NODES = [
	 "wss://viz.lexa.host/ws",
	 "wss://viz-node.dpos.space/ws",
	 "wss://solox.world/ws"
	];
	let node = localStorage.getItem("node") || NODES[0];
	const idx = Math.max(NODES.indexOf(node), 0);
	let checked = 0;
	const find = (idx) => {
	 if(idx >= NODES.length) {
	  idx = 0;
	 }
	 if(checked >= NODES.length) {
	  alert("no working nodes found");
	  return;
	 }
	 node = NODES[idx];
	 viz.config.set("websocket", node);
	 viz.api.getDynamicGlobalPropertiesAsync()
	  .then(props => {
	   console.log("found working node", node);
	   localStorage.setItem("node", node);
	  })
	  .catch(e => {
	   console.log("connection error", node, e);
	   find(idx+1);
	  });
	}
	find(idx);
   }
checkWorkingNode();

var __ = function(id){
	return document.getElementById(id);
};
document.addEventListener('DOMContentLoaded', function() {
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
			alert("The value cannot exceed 100%")
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
			alert("The value cannot exceed "+this.dataset.max+"%")
		}
	});

	__('temp_energy') && (__('temp_energy').onkeyup = function() {
		if (+this.value.replace(/[^0-9]/g, '') > 100) {
			this.value = "100%";
			alert("The value cannot exceed 100%");
		}
	})


	if (localStorage.getItem('login') && localStorage.getItem('PostingKey')) {
		viz_login = localStorage.getItem('login');
		posting_key = sjcl.decrypt(viz_login + '_postingKey', localStorage.getItem('PostingKey'));
		if (__('temp_beneficiaries')) {
			__("temp_beneficiaries").value = __("temp_beneficiaries").value.replace('user_login', viz_login);
		}
		if (__("beneficiaries")) {
			__("beneficiaries").value = (__("beneficiaries").value.replace('user_login', viz_login));
		}
	} else if (sessionStorage.getItem('login') && sessionStorage.getItem('PostingKey')) {
		viz_login = sessionStorage.getItem('login');
		posting_key = sjcl.decrypt(viz_login + '_postingKey', sessionStorage.getItem('PostingKey'));send_award(viz_login, posting_key);
		if (__("temp_beneficiaries")) {
			__("temp_beneficiaries").value = (__("temp_beneficiaries").value.replace('user_login', viz_login));
		}
		if (__("beneficiaries")) {
			__("beneficiaries").value = (__("beneficiaries").value.replace('user_login', viz_login));
		}
	} else {
		__("send_awards_form").style.display = "none";
		if (__("sortable")) {
		} else {
			__("awards_send_form").innerHTML = ("<form id=\"auth_form\" action=\"index.html\" method=\"GET\"><p class=\"auth_title\"><strong>Please log in</strong></p><input type=\"text\" id=\"this_login\" name=\"viz_login\" placeholder=\"Your login\"><br><input type=\"password\" name=\"posting\" id=\"this_posting\" placeholder=\"Private posting key\"><br><input type=\"submit\" value=\"Login\"></form>");
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
		let posting = __('this_posting').value;

		if (localStorage.getItem('PostingKey')) {
			var isPostingKey = sjcl.decrypt(login + '_postingKey', localStorage.getItem('PostingKey'));
		} else if (sessionStorage.getItem('PostingKey')) {
			var isPostingKey = sjcl.decrypt(login + '_postingKey', sessionStorage.getItem('PostingKey'));
		} else {
			var isPostingKey = posting;
		}

		var resultIsPostingWif = viz.auth.isWif(isPostingKey);
		if (resultIsPostingWif === true) {
			const account_approve = await viz.api.getAccountsAsync([login]);
			const public_wif = viz.auth.wifToPublic(isPostingKey);
			let posting_public_keys = [];
			if (account_approve.length > 0) {
			for (key of account_approve[0].posting.key_auths) {
			posting_public_keys.push(key[0]);
			}
			} else {
			window.alert('The account probably doesn not exist. Please check the entered login.');
			}
			if (posting_public_keys.includes(public_wif)) {
			localStorage.setItem('login', login);
				localStorage.setItem('PostingKey', sjcl.encrypt(login + '_postingKey', posting));
					sessionStorage.setItem('login', login);
					sessionStorage.setItem('PostingKey', sjcl.encrypt(login + '_postingKey', posting));

				viz_login = login;
						posting_key = isPostingKey;
			} else if (account_approve.length === 0) {
			window.alert('The account probably doesn not exist. Please check the entered login.');
			} else {
				window.alert('Posting key does not match the account.');
			}
					} else {
			window.alert('Posting key is not in the correct format. Please try again.');
			}


		if (!viz_login && !posting_key) {
			alert("Failed to login with current login/key pair");
		} else {
__("send_awards_form") && (__("send_awards_form").style.display = "block");
			__("auth_form").remove();
		}
	}
	// Award sending function
	async function send_award(viz_login, posting_key) {
		if (localStorage.getItem('login') && localStorage.getItem('PostingKey')) {
			viz_login = localStorage.getItem('login');
			posting_key = sjcl.decrypt(viz_login + '_postingKey', localStorage.getItem('PostingKey'));
		} else if (sessionStorage.getItem('login') && sessionStorage.getItem('PostingKey')) {
			viz_login = sessionStorage.getItem('login');
			posting_key = sjcl.decrypt(viz_login + '_postingKey', sessionStorage.getItem('PostingKey'));send_award(viz_login, posting_key);
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
			award_energy *= 100;
			award_energy *= 100;
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
		var custom_sequence = form.custom_sequence.value;
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

// Calculation value of reward:
var viz_price = (total_vesting_shares * 1000000) / (total_vesting_fund * 1000000);
var rshares = parseInt(effective_vesting_shares * 1000000 * award_energy / 10000);
var all_award_payout = parseInt(rshares / (total_reward_shares + rshares) *( total_reward_fund * 1000000) * viz_price);
		var beneficiaries_payout = (all_award_payout/100)*beneficiaries_whait;
		var award_payout = all_award_payout - beneficiaries_payout;
all_award_payout = all_award_payout / 1000000;
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
				__('main_award_info').innerHTML = (`<h1>Result:</h1>
<p><strong>You have successfully sent the award.</strong></p>
<ul><li>Target: ${award_target}</li>
<li>Energy Spending Percentage: ${award_energy/100}%</li>
<li>Approximate award in SHARES:
general: ${all_award_payout},
Beneficiaries: ${beneficiaries_payout},
to the recipient of the award: ${award_payout}</li>
<li>Custom operation number (With each operation it is incremented in get_accounts): ${custom_sequence}</li>
<li>Note (Memo, description; destination can be any): ${memo}</li>
<li>Beneficiaries: ${JSON.stringify(beneficiaries)}</li>
<li>Energy left at the time of the last award: <span id="account_energy"></span></li>
</ul>`);
			}
		} else {
				document.getElementById("main_award_info").style.display = 'block';
document.getElementById('main_award_info').innerHTML = `<p>${err}</p>`;
		}
		});
	}

	//Getting login
	function get_login() {
		if (localStorage.getItem('login') && localStorage.getItem('PostingKey')) {
			viz_login = localStorage.getItem('login');
			return viz_login;
		} else if (sessionStorage.getItem('login') && sessionStorage.getItem('PostingKey')) {
			viz_login = sessionStorage.getItem('login');
			return viz_login;
		} else {
			return false;
		}
	}

	//Login verification
	async function check_login(login) {
		try {
			const user = await viz.api.getAccountsAsync([login]);
			if (user.length > 0) {
				__("target").value = (login);
			} else {
				window.alert('The award recipient is not found. Please contact the application administrators.');
			}
		} catch(e) {
			window.alert('Error: ' + e);
		}
	}
});