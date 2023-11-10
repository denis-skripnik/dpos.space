const networks = {
	"9999": "Meganet RC",
	"111000": "Siberium Testnet",
	"534352": "Scroll mainnet",
	"167005": "Taiko testnet",
	"84531": "Base goerli",
	"59140": "linea Testnet",
	"7001": "Zetachain testnet",
	"97": "BSC Testnet",
	"1101": "Polygon zkEVM",
	"9001": "Evmos"
}

const tokens = {
	"9999": "MEGA",
	"111000": "SIBR",
	"534352": "ETH",
	"167005": "ETH",
	"84531": "ETH",
	"59140": "ETH",
	"7001": "ZETA",
	"97": "BNB",
	"1101": "ETH",
	"9001": "EVMOS"
}

const explorers = {
	"9999": "https://scan.metagarden.io",
	"111000": "https://explorer.test.siberium.net",
	"534352": "https://blockscout.scroll.io",
	"167005": "https://explorer.test.taiko.xyz",
	"84531": "https://goerli.basescan.org",
	"59140": "https://explorer.goerli.linea.build",
	"7001": "https://explorer.zetachain.com",
	"97": "https://testnet.bscscan.com",
	"1101": "https://zkevm.polygonscan.com",
	"9001": "https://escan.live"
}

var chain_id = "9999";

var provider = new ethers.providers.Web3Provider(window.ethereum, "any")
let signer;
let signerAddress;

provider.send("eth_requestAccounts", []).then(()=>{
    provider.listAccounts().then( async (accounts) => {
        signer = provider.getSigner(accounts[0]); //account in metamask
        signerAddress = await signer.getAddress();
    }
    )
}
)


const checkNetwork = async (targetNetworkId) => {
	if (window.ethereum) {
	  const currentChainId = await window.ethereum.request({
		method: 'eth_chainId',
	  });

	  // return true if network id is the same
	  if (currentChainId == targetNetworkId) return true;
	  // return false is network id is different
	  return false;
	}
  };

  const switchNetwork = async (chainId) => {
	chain_id = chainId.toString();
	const targetNetworkId = ethers.utils.hexValue(chainId);
	const network_status = await checkNetwork(targetNetworkId);
	if (network_status === true) return;
await window.ethereum.request({
	  method: 'wallet_switchEthereumChain',
	  params: [{ chainId: targetNetworkId }],
	});
	provider = new ethers.providers.Web3Provider(window.ethereum, chainId)
  };

  function spoiler(elem, group){
	style = document.getElementById(elem).style;
	if(document.querySelector("#" + elem).classList.contains(group) && style.display === 'none') {
		$('.' + group).hide();
	}

	style.display = (style.display == 'block') ? 'none' : 'block';
}

function generateNetworksForm(ids) {
	let form = '';
	for (let id of ids) {
		form += `<label for="id${id}">${networks[id]}</label>
<input type="radio" name="network" id="id${id}" onclick="switchNetwork(${id})" value="${networks[id]}">
`;
	}
	return form;
}

$(document).ready(function() {
	if (typeof contracts !== 'undefined') $('#selectNetwork').html(generateNetworksForm(Object.keys(contracts)));
	$(':button').prop('disabled', true);

	$('input[type=radio][name=network]').change(function() {
		if (document.getElementById("nativeToken") !== null) document.getElementById('nativeToken').innerHTML = tokens[chain_id]
		if (document.getElementById("smartContractAddress") !== null) document.getElementById('smartContractAddress').innerHTML = contracts[chain_id]
		if (document.getElementById("faucetBlock") !== null && chain_id !== '3333') 	document.getElementById('faucetBlock').style.display = 'none';
		$(':button').prop('disabled', false);
	}) // end change.
})