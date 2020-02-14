const golos = require("golos-js")
const bdb = require("./balancesdb");
let express = require('express');
let app = express();
golos.config.set("websocket","wss://api.golos.blckchnd.com/ws");

function compareBalance(a, b)
{
	if(a.balance > b.balance)
	{
		return -1;
	}
else{
		return 1;
	}
}

function compareSBDBalance(a, b)
{
	if(a.sbd_balance > b.sbd_balance)
	{
		return -1;
	}
else{
		return 1;
	}
}

function compareVesting(a, b)
{
	if(a.vests > b.vests)
	{
		return -1;
	}
else{
		return 1;
	}
}

async function run() {
try {
	let curr_acc = "";
	let gests = [];
	let sum_vests = 0;
	let sum_balance = 0;
	let sum_sbd_balance = 0;
	
	let k = 0;
try {
	while(1) {
		//if(k++ > 10) break;

		console.error("curr", curr_acc, Object.keys(gests).length);
		const accs = await golos.api.lookupAccountsAsync(curr_acc, 100);
		if (accs[0] === curr_acc) {
			accs.splice(0, 1);
		}
		if(accs.length == 0) {
			break;
		}

		let balances = await golos.api.getAccountsAsync(accs);

		for(let b of balances) {
			gests.push({name: b.name,
				vests: parseFloat(b.vesting_shares.split(" ")[0]),
				balance: parseFloat(b.balance.split(" ")[0]),
				sbd_balance: parseFloat(b.sbd_balance.split(" ")[0]),
			});
			curr_acc = b.name;
			sum_vests += parseFloat(b.vesting_shares.split(" ")[0]);
			sum_balance += parseFloat(b.balance.split(" ")[0]);
			sum_sbd_balance += parseFloat(b.sbd_balance.split(" ")[0]);
		}

	}
} catch (e) {
console.error(e);
process.exit(1);
}
	const params = await golos.api.getDynamicGlobalPropertiesAsync();

	const {total_vesting_fund_steem, total_vesting_shares} = params;

	const total_golos = parseFloat(total_vesting_fund_steem.split(" ")[0]);
	const total_vests = parseFloat(total_vesting_shares.split(" ")[0]);

	const vpg = total_vests / total_golos;
	let balance_names = [...gests];
	balance_names.sort(compareBalance);
	let sbd_names = [...gests];
	sbd_names.sort(compareSBDBalance);
	let vests_names = [...gests];
	vests_names.sort(compareVesting);

	let i_balance = 1;
	let i_sbd = 1;
	let i_vests = 1;
	let balances_top = [];
	let sbd_top = [];
	let vests_top = [];
let top_array = [];
	for(let name of balance_names) {
		if (i_balance <= 100) {
	balances_top.push({login: name.name, balance: (name.balance).toFixed(3) + " GOLOS", balance_percent: (name.balance * 100 / sum_balance).toFixed(3) + "%", sbd_balance: (name.sbd_balance).toFixed(3) + " GBG", sbd_balance_percent: (name.sbd_balance * 100 / sum_sbd_balance).toFixed(3) + "%", mgests: (name.vests/1000000).toFixed(3) + " MGESTS", gp: (name.vests / vpg).toFixed(3) + " GP", gests_percent: (name.vests * 100 / total_vests).toFixed(2) + "%"});
} else {
break;
}
	i_balance++
}
top_array.push({name: 'balance', data: balances_top});
for(let name of sbd_names) {
	if (i_sbd <= 100) {
		sbd_top.push({login: name.name, sbd_balance: (name.sbd_balance).toFixed(3) + " GBG", sbd_balance_percent: (name.sbd_balance * 100 / sum_sbd_balance).toFixed(3) + "%", balance: (name.balance).toFixed(3) + " GOLOS", balance_percent: (name.balance * 100 / sum_balance).toFixed(3) + "%", mgests: (name.vests/1000000).toFixed(3) + " MGESTS", gp: (name.vests / vpg).toFixed(3) + " GP", gests_percent: (name.vests * 100 / total_vests).toFixed(2) + "%"});
	} else {
	break;
	}
		i_sbd++
	}
	top_array.push({name: "sbd_balance", data: sbd_top});
	for(let name of vests_names) {
		if (i_vests <= 100) {
vests_top.push({login: name.name, mgests: (name.vests/1000000).toFixed(3) + " MGESTS", gp: (name.vests / vpg).toFixed(3) + " GP", gests_percent: (name.vests * 100 / total_vests).toFixed(2) + "%", balance: (name.balance).toFixed(3) + " GOLOS", balance_percent: (name.balance * 100 / sum_balance).toFixed(3) + "%", sbd_balance: (name.sbd_balance).toFixed(3) + " GBG", sbd_balance_percent: (name.sbd_balance * 100 / sum_sbd_balance).toFixed(3) + "%"});
		} else {
		break;
		}
			i_vests++
		}
		top_array.push({name: 'vests', data: vests_top});

for (let top of top_array) {
	await bdb.updateTop(top.name, top.data);
}
} catch (e) {
console.log(e);
}
}

setInterval(run, 5400000)

app.get('/golos-top/', async function (req, res) {
let token = req.query.token;
if (token === 'GBG') {
    let data = await bdb.getTop('sbd_balance');
    res.send(data);
} else if (token === 'GOLOS') {
    let data = await bdb.getTop('balance');
    res.send(data);
} else if (token === 'GP') {
    let data = await bdb.getTop('vests');
    res.send(data);
}
});
app.listen(3100, function () {
});