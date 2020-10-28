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
    
    function shares1Energy(new_energy, effective_vesting_shares) {
	viz.api.getDynamicGlobalProperties(function(err, props) {
		const total_vesting_fund = parseFloat(props.total_vesting_fund);
		const total_vesting_shares = parseFloat(props.total_vesting_shares);
			const total_reward_fund = parseFloat(props.total_reward_fund);
		const total_reward_shares = parseInt(props.total_reward_shares);

		var shares1energy = 1*(total_vesting_fund/total_vesting_shares) / total_reward_fund*(total_reward_shares / 1000000)/effective_vesting_shares;
	shares1energy *= 100;
	shares1energy *= 100;
	shares1energy = parseInt(shares1energy);
	shares1energy /= 100;

	$("#now_energy").html('Актуальная энергия пользователя ' + viz_login + ': ' + new_energy/100 + '%. 1 SHARES ≈ ' + shares1energy + '% энергии.');

	var viz_price = (total_vesting_shares * 1000000) / (total_vesting_fund * 1000000); //цена одного viz int
	var rshares = parseInt(effective_vesting_shares * 1000000 * new_energy / 10000); // будущие конкурирующии акции Shares пользователя(смотри словарь) int
	var max_payout = parseInt(rshares / (total_reward_shares + rshares) *( total_reward_fund * 1000000) * viz_price); //количество shares за авард int
	max_payout = max_payout / 1000000; // количество shares в десятичном виде float
$("#max_payout").html(' (Максимум: ' + max_payout + ')');

$("#max_payout").click(function () {
	$('input[name=payout]').val(max_payout);

	var payout_energy = max_payout*(total_vesting_fund/total_vesting_shares) / total_reward_fund*(total_reward_shares / 1000000)/effective_vesting_shares;
	payout_energy *= 100;
	payout_energy *= 100;
	payout_energy = parseInt(payout_energy);
	payout_energy /= 100;

	$("#awarding_energy").val(payout_energy);
});

$("input[name='energy']").change(function() {
var input_energy = $("input[name='energy']").val();
input_energy *= 100;
input_energy = parseInt(input_energy);

var viz_price = (total_vesting_shares * 1000000) / (total_vesting_fund * 1000000); //цена одного viz int
var rshares = parseInt(effective_vesting_shares * 1000000 * input_energy / 10000); // будущие конкурирующии акции Shares пользователя(смотри словарь) int
var change_payout = parseInt(rshares / (total_reward_shares + rshares) *( total_reward_fund * 1000000) * viz_price); //количество shares за авард int
change_payout = change_payout / 1000000; // количество shares в десятичном виде float
	$("input[name='payout']").val(change_payout);
});
$("input[name='payout']").change(function() {
	var payout = $('input[name=payout]').val();
	var payout_energy = payout*(total_vesting_fund/total_vesting_shares) / total_reward_fund*(total_reward_shares / 1000000)/effective_vesting_shares;
	payout_energy *= 100;
	payout_energy *= 100;
	payout_energy = parseInt(payout_energy);
	payout_energy /= 100;

	$("#awarding_energy").val(payout_energy);
});
});
}

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
shares1Energy(new_energy, effective_vesting_shares);
});
}

async function send_award(target, energy, custom_sequence, keyword, link, inlink) {
	let q = window.confirm('Вы действительно хотите создать ссылку, отправив награду?');
if (q === true) {
if (energy) {
energy = parseInt(energy);
} else {
			energy = 1;
		}

		if (!custom_sequence) {
custom_sequence = 0;
		}

			var benef_list = [];
			if (link.indexOf('://') > -1) link = link.split('://')[1];
			if (inlink.indexOf('://') > -1) inlink = inlink.split('://')[1];
		var memo = `${keyword},${link}${inlink}`;

		viz.broadcast.awardAsync(posting_key,viz_login,target,energy,custom_sequence,memo,benef_list, (err,result) => {
if (!err) {
	jQuery("#main_award_info").css("display", "block");
	$('#main_award_info').html(`<h1>Результат:</h1>
<p><strong>Вы успешно отправили награду.</strong></p>`);
} else {
	if (/used_energy <= current_energy/.test(err)) {
		jQuery("#main_award_info").css("display", "block");
		$('#main_award_info').html(`<h1>Указанный вами процент энергии > имеющейся у авторизованного аккаунта</h1>
<p align="center">Просьба проверить значение energy в адресной строке или ввести новое в <a href="form.html" target="_blank">форме</a>.</p>`);
	} else if (/beneficiaries.weight = NaN/.test(err)) {
		jQuery("#main_award_info").css("display", "block");
		$('#main_award_info').html(`<h1>Вы указали бенефициара, но не указали процент, который он получит</h1>
<p align="center">Просьба проверить значение после двоеточия в beneficiaries (адресная строка) или ввести новое в <a href="form.html" target="_blank">форме</a>.</p>`);
	} else if (/acc != nullptr: Beneficiary/.test(err)) {
		jQuery("#main_award_info").css("display", "block");
		$('#main_award_info').html(`<h1>1 или несколько аккаунтов бенефициаров не существует.</h1>
<p align="center">Просьба проверить значение beneficiaries в адресной строке или ввести новое в <a href="form.html" target="_blank">форме</a>.</p>`);
	} else if (/is_valid_account_name\(name\): Account name/.test(err)) {
		jQuery("#main_award_info").css("display", "block");
		$('#main_award_info').html(`<h1>Аккаунт награждаемого или бенефициара не существует.</h1>
<p align="center">Просьба проверить значение target и beneficiaries (Первую часть до двоеточия) в адресной строке.  Также можно ввести новое в <a href="form.html" target="_blank">форме</a>.</p>`);
} else {
window.alert(err);
}
}
});
} else {
window.alert('Вы отказались отправлять награду.');
}
}