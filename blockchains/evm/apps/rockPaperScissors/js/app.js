const contracts = {
	"80085": "0x5C38198fcDb7e5e685f419c5A7f892007ff9641f",
	"168587773": "0x389C942d852dD1831583101897F798608C16Cf5e",
	"9999": "0xc5076e7470e7bb1B16A84142F79F6fCbA83fb9fD",
	"167005": "0x73C9F6e1B870a9447E329a3d6D20360D56988A0f",
	"111000":  "0xE42bdd2AE5A7A9BAB6496D479a2c0C0E737ba2e3",
	"84531": "0xce1e3733c981f19f340a6eefe8f6031ccd880c39",
	"59140": "0xe03e74a3ffac37da8389deed05cd0fd826aa472b",
	"97": "0xa18ee4748d26b6c254c67e32465c04c0b5a0c82f",
	"7001": "0x20543ab6d8a90abb0b9402bf1e83858979bbce94"
}

const contractABI = [
	{
		"inputs": [],
		"stateMutability": "payable",
		"type": "constructor"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "address",
				"name": "player",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "option",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "contractOption",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "int8",
				"name": "result",
				"type": "int8"
			}
		],
		"name": "Gamed",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "uint8",
				"name": "_option",
				"type": "uint8"
			}
		],
		"name": "selectRPS",
		"outputs": [
			{
				"internalType": "int8",
				"name": "",
				"type": "int8"
			}
		],
		"stateMutability": "payable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "withdraw",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"stateMutability": "payable",
		"type": "receive"
	}
]

let contract;
let game_variant = ['Rock', 'Scissors', 'Paper'];

const event = "Gamed";

var contractAddress = contracts[chain_id];

  async function runGame(){
	let _option = parseInt(document.getElementById("game_item").value);
	let amountInEth = document.getElementById("amountInEth").value;
    
	let amountInWei = ethers.utils.parseEther(amountInEth.toString())
	contractAddress = contracts[chain_id];
	const contract = new ethers.Contract(contractAddress, contractABI, signer)

    let resultOfGame = await contract.selectRPS(_option, {value: amountInWei});
    const res = await resultOfGame.wait();
    console.log(res);
    
	await handleEvent();
}

async function handleEvent(){
	contractAddress = contracts[chain_id];
	const contract = new ethers.Contract(contractAddress, contractABI, signer)
	let queryResult =  await contract.queryFilter('Gamed', await provider.getBlockNumber() - 5000, await provider.getBlockNumber());
    let queryResultRecent = queryResult[queryResult.length-1]
    let amount = await queryResultRecent.args.amount.toString();
	let player = await queryResultRecent.args.player.toString();
    let option = await queryResultRecent.args.option.toString();
    let contractOption = await queryResultRecent.args.contractOption.toString();
	let result = await queryResultRecent.args.result.toString();
	let status = 'выигрышь 🎉';
if (result == 0) {
    status = 'Ничья: 50% от суммы ставки будет возвращено.'
} else if (result == -1) {
    status = 'Проигрышь 😥';
}

    let resultLogs = `
    Сумма ставки: ${ethers.utils.formatEther(amount.toString())} ${tokens[chain_id]}, 
    Игрок: ${player}, 
    игрок выбрал: ${game_variant[option]}, 
    Выбор смартконтракта: ${game_variant[contractOption]},
    Результат: ${status}`;
    console.log(resultLogs);

    let resultLog = document.getElementById("resultLog");
    resultLog.innerText = resultLogs;
    
}