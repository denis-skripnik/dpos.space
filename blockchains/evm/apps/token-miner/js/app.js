const contracts = {
	"9999": "0xC7E932d75f9C317c8900D4c21187b6a1961CFe55",
	"167005": "0x7CD36Ca6eCB350FA776d55b7F204B4B6489E9e6E",
	"84531": "0x20543ab6d8a90abb0b9402bf1e83858979bbce94",
	"534353": "0x5c900a3A5ECffcd7cceC923BD3a9f357234bc2b5",
	"59140": "0x4bf80511218bcd0dae7c845fe73901916ef80519",
	"7001": "0xcc10645534c0601c03f0a06d56071db67207aeda",
	"1101": "0xc7e932d75f9c317c8900d4c21187b6a1961cfe55",
	"9001": "0xf4f212ebd63864726e6a666b1b6d9368e38086c7"
}

const contractABI = [
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "minerAddress",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "creatorAddress",
				"type": "address"
			}
		],
		"name": "MinerCreated",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "name",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "symbol",
				"type": "string"
			},
			{
				"internalType": "address",
				"name": "rewardTokenAddress",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "firstPrice",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "increment",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "totalDays",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "rewardPerDay",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "totalMiners",
				"type": "uint256"
			}
		],
		"name": "createMiner",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	}
]; // abi.

const minerAbi = [
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "name",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "symbol",
				"type": "string"
			},
			{
				"internalType": "address",
				"name": "rewardTokenAddress",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "firstPrice",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "increment",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "totalDays",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "rewardPerDay",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "totalMiners",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "owner",
				"type": "address"
			}
		],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "owner",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "approved",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "Approval",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "owner",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "operator",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "bool",
				"name": "approved",
				"type": "bool"
			}
		],
		"name": "ApprovalForAll",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "from",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "Transfer",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "approve",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "owner",
				"type": "address"
			}
		],
		"name": "balanceOf",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "getApproved",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getPrice",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getRewards",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "owner",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "operator",
				"type": "address"
			}
		],
		"name": "isApprovedForAll",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "mint",
		"outputs": [],
		"stateMutability": "payable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "name",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "ownerOf",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "from",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "safeTransferFrom",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "from",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			},
			{
				"internalType": "bytes",
				"name": "data",
				"type": "bytes"
			}
		],
		"name": "safeTransferFrom",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "operator",
				"type": "address"
			},
			{
				"internalType": "bool",
				"name": "approved",
				"type": "bool"
			}
		],
		"name": "setApprovalForAll",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes4",
				"name": "interfaceId",
				"type": "bytes4"
			}
		],
		"name": "supportsInterface",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "symbol",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "tokenURI",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "from",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "transferFrom",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "withdraw",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	}
]; // Token ABI.

let contract;

  async function createMiner(){
	contract = new ethers.Contract(
		contractAddress,
		contractABI,
		signer
	)

	let name = document.getElementById("name").value;
	let symbol = document.getElementById("symbol").value;
	symbol = symbol.toUpperCase();
	let rewardTokenAddress = document.getElementById("rewardTokenAddress").value;
	let fearstPriceInETH = document.getElementById("firstPrice").value;
	let increment = parseInt(document.getElementById("increment").value);
	let totalDays = parseInt(document.getElementById("totalDays").value);
	let rewardPerDayInETH = document.getElementById("rewardPerDay").value;
	let totalMiners = parseInt(document.getElementById("totalMiners").value);
	let fearstPriceInWei = ethers.utils.parseEther(fearstPriceInETH.toString())
	let rewardPerDayInWEI = ethers.utils.parseEther(rewardPerDayInETH.toString())
	contractAddress = contracts[chain_id];
	const contract = new ethers.Contract(contractAddress, contractABI, signer)

    let result = await contract.createMiner(name, symbol, rewardTokenAddress, fearstPriceInWei, increment, totalDays, rewardPerDayInWEI, totalMiners);
    const res = await result.wait();
    console.log(res);
if (typeof res.events[0] === 'undefined') return;
	let tokenAddress = res.events[0].args[0];
	let resultLog = document.getElementById("resultLog");
    resultLog.innerHTML = `<h3>Майнер был создан.</h3>
<p>Адрес: ${tokenAddress}:<br>
<a href="${explorers[chain_id]}/address/${tokenAddress}" target="_blank">Блок-эксплорер</a>, <a href="/evm/token-miners#address=${tokenAddress}" target="_blank">Переходите к минту и получайте награды</a></p>`;
}

async function mintMiner() {
	const tokenAddress = getParameterByName("address");
  
	const tokenContract = new ethers.Contract(tokenAddress, minerAbi, signer);
	const price = await tokenContract.getPrice();
	tokenContract.mint({value: price})
	  .then(() => {
		window.alert("Minted ", "miner");
	  })
	  .catch((error) => {
		window.alert(JSON.stringify(error));
	  });
  }
  
  async function getRewards() {
	const tokenAddress = getParameterByName("address");
  
	const tokenContract = new ethers.Contract(tokenAddress, minerAbi, signer);
	tokenContract.getRewards()
	  .then(() => {
		window.alert("The rewards are collected!");
	  })
	  .catch((error) => {
		window.alert(JSON.stringify(error));
	  });
  }

  function getParameterByName(name) {
	const urlParams = new URLSearchParams(window.location.hash.substring(1));
	return urlParams.get(name) || "";
  }
  