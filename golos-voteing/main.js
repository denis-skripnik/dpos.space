function checkWorkingNode() {
	const NODES = [
	 "wss://api.golos.blckchnd.com/ws", 
	 "wss://golos.lexa.host/ws",
	 "wss://golos.solox.world/ws"
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
	 golos.config.set("websocket", node);
	 golos.api.getDynamicGlobalPropertiesAsync()
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


var golos_login = '';
var posting_key = '';

function getUrlVars() {
    var vars = {};
    var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
        vars[key] = value;
    });
    return vars;
}

async function accountData(user) {
	const acc = await golos.api.getAccountsAsync([user]);
	const props = await golos.api.getDynamicGlobalPropertiesAsync();
	const total_vesting_fund = parseFloat(props.total_vesting_fund_steem);
	const total_vesting_shares = parseFloat(props.total_vesting_shares);
	const steem_per_vests = 1000000 * total_vesting_fund / total_vesting_shares;
	const vesting_shares = parseFloat(acc[0].vesting_shares) / 1000000 * steem_per_vests;
	const received_vesting_shares = parseFloat(acc[0].received_vesting_shares) / 1000000 * steem_per_vests;
	const delegated_vesting_shares = parseFloat(acc[0].delegated_vesting_shares) / 1000000 * steem_per_vests;
const gp = vesting_shares + received_vesting_shares - delegated_vesting_shares;
const reputation = parseInt(acc[0].reputation);
const rep = await repLog10(reputation);
return [gp, rep];
}

async function getVotes() {
	try {
var query = {
  select_tags: ['golos-votes'],
  limit: 100
};
		const getVotes = await golos.api.getDiscussionsByActiveAsync(query);
let votes_li = '';
for (let vote of getVotes) {
votes_li += `<li><a href="index.html?author=${vote.author}&id=${vote.permlink.slice(5)}" target="_blank">${vote.title}</a></li>`
}

		$("#vote_page").html(`<h2>100 последних опросов</h2>
<ol>
${votes_li}
</ol>`);
		} catch(e) {
		$("#vote_page").html(`<h2>Ошибка</h2>
	<p><strong>Вероятно, id такого опроса нет. Просьба проверить его. Либо ознакомьтесь с текстом ошибки ниже:</strong></p>
	${e}`);
	}
	}

	async function log10(str) {
    const leadingDigits = parseInt(str.substring(0, 4));
    const log = Math.log(leadingDigits) / Math.LN10 + 0.00000001
    const n = str.length - 1;
    return n + (log - parseInt(log));
}

async function repLog10(rep2) {
    if(rep2 == null) return rep2
    let rep = String(rep2)
    const neg = rep.charAt(0) === '-'
    rep = neg ? rep.substring(1) : rep

    let out = await log10(rep)
    if(isNaN(out)) out = 0
    out = Math.max(out - 9, 0); // @ -9, $0.50 earned is approx magnitude 1
    out = (neg ? -1 : 1) * out
    out = (out * 9) + 25 // 9 points per magnitude. center at 25
    // base-line 0 to darken and < 0 to auto hide (grep rephide)
    return out
}

async function getVoteResult(author, id) {
	try {
		const getContent = await golos.api.getContentAsync(author, id, 0);
			const get_results = await golos.api.getContentRepliesAsync(author, id, -1);
let variants = [];

for (let variant of get_results) {
				if (variant.permlink.indexOf('-variant-') !== -1) {
					let vote_gp_count = 0;
let vote_rep_count = 0;
					for (let vote of variant.active_votes) {
	const user_data = await accountData(vote.voter);
	const gp = user_data[0];
	const reputation = user_data[1];
	vote_gp_count += gp;
	vote_rep_count += reputation;
}
variants.push({variant: variant.body, gp: vote_gp_count, rep: vote_rep_count});
}
			}



let percent100_gp = 0;
let percent100_rep = 0;
for (variant of variants) {
	percent100_gp += parseFloat(variant.gp);
	percent100_rep += parseFloat(variant.rep);
}

let results_percent = [];
let results_gp = '';
let results_rep = '';
for (variant of variants) {
const result_gp_num = percent100_gp/variant.gp;
const result_gp_per = 100/result_gp_num;
const result_rep_num = percent100_rep/variant.rep;
const result_rep_per = 100/result_rep_num;
results_gp += `<tr>
<td>${variant.variant}</td>
<td>${result_gp_per.toFixed(2)}%</td>
</tr>`;
results_rep += `<tr>
<td>${variant.variant}</td>
<td>${result_rep_per.toFixed(2)}%</td>
</tr>`;
results_percent.push({variant: variant.variant, gp: result_gp_per, rep: result_rep_per})
}

const count_variants = results_percent.length;
let results_all_percent = '';
for (let i = 0; i < count_variants; i++) {
const sum_percents = results_percent[i].gp + results_percent[i].rep;
const math_percent = sum_percents/2;
results_all_percent += `<tr>
<td>${results_percent[i].variant}</td>
<td>${math_percent.toFixed(2)}%</td>
</tr>`;
}

let results_gp_str = `<hr>
<h2>Результаты голосования по СГ участников:</h2>
<hr>
<table>
<thead>
<tr>
<th>Вариант</th>
<th>%</th>
</tr>
</thead><tbody>
${results_gp}
</tbody></table>`;

let results_rep_str = `<hr>
<h2>Результаты голосования по репутации (рейтингу) участников:</h2>
<hr>
<table>
<thead>
<tr>
<th>Вариант</th>
<th>%</th>
</tr>
</thead><tbody>
${results_rep}
</tbody></table>`;

let results_all_str = `<hr>
<h2>Результаты голосования и по СГ, и по репутации (рейтингу) участников (Среднее значение процента каждого варианта):</h2>
<hr>
<table>
<thead>
<tr>
<th>Вариант</th>
<th>%</th>
</tr>
</thead><tbody>
${results_all_percent}
</tbody></table>`;

		$("#vote_page").html(`<h1>Результаты опроса ${getContent.title}</h1>
		<ul><li>Id: ${getUrlVars()['id']}</li>
	<li>Автор: ${author}</li></ul>
${results_gp_str}

${results_rep_str}

${results_all_str}
`);
	} catch(e) {
		$("#vote_page").html(`<h2>Ошибка</h2>
	<p><strong>Вероятно, id такого опроса нет. Просьба проверить его. Либо ознакомьтесь с текстом ошибки ниже:</strong></p>
	${e}`);
	}
	}
	

async function getVote(golos_login, posting_key, author, id) {
	try {
	const getContent = await golos.api.getContentAsync(author, id, 0);
			if (getContent.cashout_time !== "1969-12-31T23:59:59") {
				const get_results = await golos.api.getContentRepliesAsync(author, id, 0);
console.log();
				var radio_buttons = '';
get_results.forEach(async function(variant) {
if (variant.permlink.indexOf('-variant-') > -1) {
	radio_buttons += `<input type="radio" name="variants" value="${variant.permlink}"> ${variant.body}<br>`
}
});

var vote_id = id.slice(5);

	$("#vote_page").html(`<h2>${getContent.title}</h2>
	<ul><li>Id: ${getUrlVars()['id']}</li>
<li>Автор: ${author}</li></ul>
<h3>Проголосуйте ниже</h3>
<p><strong>Чтобы проголосовать ещё раз просто выберите другой вариант и нажмите на "Голосовать".</strong></p>
<form>
<p><label>Выберите вариант ответа и нажмите на кнопку "Голосовать</label></p>
<p>${radio_buttons}</p>
<p><input type="button" value="Голосовать" onclick="sendVoteAnswer(golos_login, posting_key, getUrlVars()['author'], this.form.variants.value)"></p>
<div id="result_block"></div>
</form>
<p><strong><a href="result.html?author=${author}&id=${vote_id}" target="_blank">Результаты опроса</a></strong></p>
`);
} else {
	$("#vote_page").html(`<p><strong>Ошибка: Срок голосования прошёл</strong></p>`);
}
} catch(e) {
	$("#vote_page").html(`<h2>Ошибка</h2>
<p><strong>Вероятно, id такого опроса нет. Просьба проверить его. Либо ознакомьтесь с текстом ошибки ниже:</strong></p>
${e}`);
}
}

async function actionResult(msg) {
$("#result_block").html(msg);
}

async function sendVoteAnswer(golos_login, posting_key, author, variant_permlink) {
try {
const res = golos.broadcast.voteAsync(posting_key, golos_login, author, variant_permlink, 10000);
await actionResult(`<p><strong><font color="read">Ваш ответ добавлен успешно.</font></strong></p>`);
} catch(e) {
	await actionResult(`Ошибка:
` + e);
}
}

function voteAuth() {
			let login = $('#this_login').val();
			let posting = $('#this_posting').val();
var isSavePosting = document.getElementById('isSavePosting');
			if (isSavePosting.checked) {
		localStorage.setItem('login', login);
			localStorage.setItem('PostingKey', sjcl.encrypt(login + '_postingKey', posting));
			} else {
				sessionStorage.setItem('login', login);
				sessionStorage.setItem('PostingKey', sjcl.encrypt(login + '_postingKey', posting));
			}
			if (localStorage.getItem('PostingKey')) {
		var isPostingKey = sjcl.decrypt(login + '_postingKey', localStorage.getItem('PostingKey'));
			} else if (sessionStorage.getItem('PostingKey')) {
				var isPostingKey = sjcl.decrypt(login + '_postingKey', sessionStorage.getItem('PostingKey'));
	} else {
var isPostingKey = posting;
}

			var resultIsPostingWif = golos.auth.isWif(isPostingKey);
console.log(resultIsPostingWif);
			if (resultIsPostingWif === true) {
golos_login = login;
			posting_key = isPostingKey;
} else {
window.alert('Постинг ключ имеет неверный формат. Пожалуйста, попробуйте ещё раз.');
}

if (!golos_login && !posting_key) {
		$('#delete_posting_key').css("display", "none");
		$('#unblock_form').css("display", "block");
		$("#new_vote").css("display", "none");
	} else {
		$('#unblock_form').css("display", "none");
		$("#new_vote").css("display", "block");
		$('#delete_posting_key').css("display", "block");
	jQuery("#delete_posting_key").html('<p align="center"><a onclick="localStorage.removeItem(\'login\'\); localStorage.removeItem(\'PostingKey\'\);     location.reload();">Выйти</a></p>');
}
			} // end voteAuth

			var vote_element = [];

			function updateText() {
				document.getElementById('out').innerHTML = 'Итоговый список: ' + JSON.stringify(vote_element);
			}
			
			function add() {
				var variant = document.getElementById('variant').value;
			
		 vote_element.push(variant);
		 
					updateText()
				}
			
			vote_element.push(variant);
			updateText();
			
			updateText();
			
		 


			// Для формы создания опроса:
async function voteFormSend() {
	var form = document.getElementById('vote_user_form');
var data = {title: form.title.value, description: form.descr.value, variants: vote_element};
var variants = vote_element;

if (localStorage.getItem('login') && localStorage.getItem('PostingKey')) {
    golos_login = localStorage.getItem('login');
posting_key = sjcl.decrypt(golos_login + '_postingKey', localStorage.getItem('PostingKey'));
} else if (sessionStorage.getItem('login') && sessionStorage.getItem('PostingKey')) {
golos_login = sessionStorage.getItem('login');
posting_key = sjcl.decrypt(golos_login + '_postingKey', sessionStorage.getItem('PostingKey'));
}

var permlink = "vote-" + parseInt(new Date().getTime()/1000);
var id = permlink.slice(5);

var descr = data.description;
descr += `
## Варианты:
`;
vote_element.forEach(async function(var_el) {
	descr += `- ${var_el}
`;
});
descr += `
## Способы голосования:
1. Выбрав комментарий с вариантом ответа, который вас устраивает, а затем проголосовав за него, поставив апвот;
2. Перейдя по ссылке https://dpos.space/golos-voteing?author=${golos_login}&id=${id}`;

if (golos_login.length > 0 && posting_key.length > 0) {
	var json = {tags: ['golos-votes', 'ru--opros', 'vote', 'votes']};
	const benecs = [{account: 'denis-skripnik', weight:1000}];
	try {
let operations = [
['comment', {'parent_author':'','parent_permlink':'golos-votes','author':golos_login,'permlink':permlink,'title':data.title,'body':descr,'json_metadata':JSON.stringify(json)}],['comment_options',{'author':golos_login,'permlink':permlink,'max_accepted_payout':'1000000.000 GBG','percent_steem_dollars':10000,'allow_votes':true,'allow_curation_rewards':true,'extensions':[[0,{'beneficiaries':benecs}]]}]];

var variants_count = 0;
for (let variant of variants) {
	variants_count += 1;
const variant_permlink = permlink + '-variant-' + variants_count;
	operations.push(['comment', {'parent_author':golos_login,'parent_permlink':permlink,'author':golos_login,'permlink':variant_permlink,'title':'','body':variant,'json_metadata':JSON.stringify(json)}],['comment_options',{'author':golos_login,'permlink':variant_permlink,'max_accepted_payout':'1000000.000 GBG','percent_steem_dollars':10000,'allow_votes':true,'allow_curation_rewards':true,'extensions':[[0,{'beneficiaries':benecs}]]}]);
}

const result = golos.broadcast.sendAsync({extensions: [], operations}, [posting_key]);
await actionResult(`<p><strong>Опрос создан успешно.</strong></p>
<p align="center"><a href="/golos-voteing?author=${golos_login}&id=${id}/" target="_blank">Перейти к опросу</a></p>`);
} catch(e) {
	await actionResult(`Ошибка:
` + e);
}
} else {
window.alert('Ошибка: вы не авторизованы.');
}
}
