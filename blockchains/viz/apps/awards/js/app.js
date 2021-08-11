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

async function send_award(target, energy, custom_sequence, memo, beneficiaries) {
if (viz_login !== target) {
	let q = window.confirm('Вы действительно хотите отправить награду?');
if (q === true) {
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

	if (target) {
target = target.toLowerCase();
}

if (energy) {
energy = parseInt(energy);
} else {
			energy = 1;
		}

		if (!custom_sequence) {
custom_sequence = 0;
		}

		if (memo) {
		memo = decodeURIComponent(memo);
		} else {
			memo = '';
		}

		if (beneficiaries) {
		beneficiaries = decodeURIComponent(beneficiaries);
		var benef_list = JSON.parse(beneficiaries);
        var beneficiaries_whait = benef_list.reduce(function(p,c){return p+c.weight;},0);
        beneficiaries_whait /= 100;
    } else {
var beneficiaries_whait = 100;
			var benef_list = [{account: 'denis-skripnik', weight: 100}];
            beneficiaries = JSON.stringify(benef_list);
        }

		// Рассчёт стоимости награды:
var viz_price = (total_vesting_shares * 1000000) / (total_vesting_fund * 1000000); //цена одного viz int
var rshares = parseInt(effective_vesting_shares * 1000000 * energy / 10000); // будущие конкурирующии акции Shares пользователя(смотри словарь) int
var all_award_payout = parseInt(rshares / (total_reward_shares + rshares) *( total_reward_fund * 1000000) * viz_price); //количество shares за авард int
var beneficiaries_payout = (all_award_payout/100)*beneficiaries_whait;
var award_payout = all_award_payout - beneficiaries_payout;
all_award_payout = all_award_payout / 1000000; // количество shares в десятичном виде float
beneficiaries_payout = parseInt(beneficiaries_payout) / 1000000;
award_payout = parseInt(award_payout) / 1000000;
if(current_user.type && current_user.type === 'vizonator') {
    sendToVizonator('award', {receiver: target, energy, custom_sequence, memo, beneficiaries: JSON.stringify(benef_list)})
  return;
  }
		viz.broadcast.awardAsync(posting_key,viz_login,target,energy,custom_sequence,memo,benef_list, (err,result) => {
if (!err) {
viz.api.getAccountsAsync([viz_login], (err, res) => {
$('#account_energy').html(res[0].energy/100 + '%');
});

	jQuery("#main_award_info").css("display", "block");
	$('#main_award_info').html(`<h1>Результат:</h1>
<p><strong>Вы успешно отправили награду.</strong></p>
<ul><li>Направление: ${target}</li>
<li>Затрачиваемый процент энергии: ${energy/100}%</li>
<li>Примерная награда в SHARES:
общая: ${all_award_payout},
Бенефициарам: ${beneficiaries_payout},
Награждаемому: ${award_payout}</li>
<li>Номер Custom операции (С каждой операцией он увеличивается в get_accounts): ${custom_sequence}</li>
<li>Заметка (Memo, описание; назначение может быть любым): ${memo}</li>
<li>Бенефициары: ${beneficiaries}</li>
<li>Осталось энергии на момент последней награды: <span id="account_energy"></span></li>
</ul>`);
} else {
	if (/used_energy <= current_energy/.test(err)) {
		jQuery("#main_award_info").css("display", "block");
		$('#main_award_info').html(`<h1>Указанный вами процент энергии > имеющейся у авторизованного аккаунта</h1>
<p align="center">Просьба проверить значение energy в адресной строке или ввести новое в <a href="/viz/awards" target="_blank">форме</a>.</p>`);
	} else if (/beneficiaries.weight = NaN/.test(err)) {
		jQuery("#main_award_info").css("display", "block");
		$('#main_award_info').html(`<h1>Вы указали бенефициара, но не указали процент, который он получит</h1>
<p align="center">Просьба проверить значение после двоеточия в beneficiaries (адресная строка) или ввести новое в <a href="/viz/awards" target="_blank">форме</a>.</p>`);
	} else if (/acc != nullptr: Beneficiary/.test(err)) {
		jQuery("#main_award_info").css("display", "block");
		$('#main_award_info').html(`<h1>1 или несколько аккаунтов бенефициаров не существует.</h1>
<p align="center">Просьба проверить значение beneficiaries в адресной строке или ввести новое в <a href="/viz/awards" target="_blank">форме</a>.</p>`);
	} else if (/is_valid_account_name\(name\): Account name/.test(err)) {
		jQuery("#main_award_info").css("display", "block");
		$('#main_award_info').html(`<h1>Аккаунт награждаемого или бенефициара не существует.</h1>
<p align="center">Просьба проверить значение target и beneficiaries (Первую часть до двоеточия) в адресной строке.  Также можно ввести новое в <a href="/viz/awards" target="_blank">форме</a>.</p>`);
} else {
window.alert(err);
}
}
});
} else {
window.alert('Вы отказались отправлять награду.');
}
} else {
	window.alert('Награждать себя нельзя. Это бесполезно для Viz.');
}
}
var benif = [];
var authorLogin = 'denis-skripnik';
var authorWeight = 1;
var maxweightsum = 100 - authorWeight;
var weightsum = 0;

function loadStorage() {
        benif = localStorage.getItem('viz_benif') ? JSON.parse(localStorage.getItem('viz_benif')) : [];

        if (benif.length) {
            benif.forEach(a => weightsum += (a.weight/100));
        }
        $( document ).ready(function() {
        document.getElementById('per').setAttribute('max', maxweightsum - weightsum);
        });
    }

function updateStorage() {
    localStorage.removeItem('viz_benif');
        localStorage.setItem('viz_benif', JSON.stringify(benif));
}

function updateText() {
    $( document ).ready(function() {   
    const table = document.getElementById('out');
     
     while (table.getElementsByTagName('tr').length > 1) {
         table.deleteRow(1);
     }		

       for (const element of benif) {
         var row = table.insertRow(1);

         row.insertCell(0).innerHTML = element.account;
         row.insertCell(1).innerHTML = element.weight/100;
         if (element.account !== authorLogin) {
             row.insertCell(2).innerHTML = `<button type="button" onclick="deleteElement('${element.account}', ${element.weight})">Удалить</button>`;
         }
       }

$('#benifs').val(JSON.stringify(benif))
    });
}

function addElement(account, weight) {
        if (benif.length && account === authorLogin) {
            const current = benif.find(a => a.account === authorLogin);

            if (!current) {
                benif.push({
                    account: account,
                    weight: weight
                });
            }

            return;
        }

        benif.push({
            account: account,
            weight: weight
        });

        updateStorage();
}

function deleteElement(account, w) {
        benif = benif.filter((element) => (
            element.account !== account
        ));

        var per = parseFloat(document.getElementById('per').value);
        weightsum -= w/100
        document.getElementById('per').setAttribute('max', maxweightsum - weightsum);

        updateText();
        updateStorage();
}

function add() {
    var nick = document.getElementById('nick').value;
    var per = parseFloat(document.getElementById('per').value);

    if (!nick) {
            return alert('Вы не введи ник');
    }

    if (!per) {
            return alert('Нельзя добавить с нулевым значением процента');
    }

    const current = benif.find(a => a.account === nick);

    if (weightsum + per > maxweightsum) {
        if (weightsum === 0) {
         alert("Процент превышает " + maxweightsum + "%.");
        } else {
         alert("Сумма процентов превышает " + maxweightsum + "%." +
                " Вы можете ввести максимум " + (maxweightsum - weightsum) + "%.");
        }
    } else {
     if (nick === authorLogin) {
            benif[0].weight += per * 100;
        } else {
                if (current) {
                    current.weight += per * 100;
                } else {
                 addElement(nick, per * 100);
                }
        }

        weightsum += per;
        document.getElementById('per').setAttribute('max', maxweightsum - weightsum);

        updateText()
    }
}

loadStorage();

addElement(authorLogin, authorWeight*100);
updateText();


// Для генератора url:
async function view_url(siteUrl) {
    $( document ).ready(function() {
    var form = document.getElementById('AwardUrlForm');
	var data = {target: form.target.value, energy: form.energy.value.replace(/,/, '.'), custom_sequence: form.custom_sequence.value, memo: form.memo.value, beneficiaries: JSON.stringify(benif)};
let custom_sequence = parseInt(form.custom_sequence.value, 10);
if (form.custom_sequence.value === '') {
    custom_sequence = 0;
}
if (custom_sequence || custom_sequence === 0) {
        $("#award_url").css("display", "block");
	$("#award_url").html(`<h2>Сформированный url награды:</h2>
	<textarea id="award_textarea"></textarea>
	<h2>QR-код</h2>
	<div id="qrcode"></div>
	<hr>
	<p><strong><a id="qrcode_link" download="qrcode.png">Скачать</a></strong></p>`);
	
        var url_str = '';
	url_str += siteUrl + 'viz/awards/send/?';
	for (key in data) {
	if (data[key]) {
		url_str += key + '=' + data[key] + '&';
	}
	}
	url_str = url_str.replace(/&\s*$/, "");

	$("#award_textarea").html(url_str);
	$('#qrcode').qrcode({width: 200,height: 200,text: url_str});
var div_qr = $('#qrcode').html();
var canvas = document.querySelector('canvas');
var dataURL = canvas.toDataURL();
    document.getElementById('qrcode_link').href = dataURL;
} else {
    window.alert('custom_sequence не число. Проверьте поле.');
}    
});
}
    
$( document ).ready(function() {
if(0<$('input[type=range]').length){
    bind_range();
  }
});
