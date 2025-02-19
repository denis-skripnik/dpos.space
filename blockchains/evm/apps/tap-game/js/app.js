window.addEventListener('signerReady', checkRefCode);

const contracts = {
	"80094": "0x903c22b37FdDE80d473B0C532B454dc31af013bA",
	"999": "0x903c22b37FdDE80d473B0C532B454dc31af013bA",
"10143": "0x86cfdfaD380F0679d69e248055b93454F5977077"
};

// Вставьте ABI вашего смарт-контракта TapGame
const contractABI = [
	{
	  "inputs": [],
	  "stateMutability": "nonpayable",
	  "type": "constructor"
	},
	{
	  "anonymous": false,
	  "inputs": [
		{
		  "indexed": true,
		  "internalType": "address",
		  "name": "user",
		  "type": "address"
		},
		{
		  "indexed": false,
		  "internalType": "uint256",
		  "name": "boostId",
		  "type": "uint256"
		},
		{
		  "indexed": false,
		  "internalType": "uint256",
		  "name": "level",
		  "type": "uint256"
		}
	  ],
	  "name": "BoostPurchased",
	  "type": "event"
	},
	{
	  "anonymous": false,
	  "inputs": [
		{
		  "indexed": true,
		  "internalType": "address",
		  "name": "user",
		  "type": "address"
		},
		{
		  "indexed": false,
		  "internalType": "uint256",
		  "name": "refId",
		  "type": "uint256"
		}
	  ],
	  "name": "RefCodeSet",
	  "type": "event"
	},
	{
	  "anonymous": false,
	  "inputs": [
		{
		  "indexed": true,
		  "internalType": "address",
		  "name": "user",
		  "type": "address"
		},
		{
		  "indexed": false,
		  "internalType": "uint256",
		  "name": "pointsGained",
		  "type": "uint256"
		}
	  ],
	  "name": "Tap",
	  "type": "event"
	},
	{
	  "inputs": [
		{
		  "internalType": "address",
		  "name": "",
		  "type": "address"
		}
	  ],
	  "name": "boost1",
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
	  "name": "boost1Cost",
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
		  "internalType": "address",
		  "name": "",
		  "type": "address"
		}
	  ],
	  "name": "boost2",
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
	  "name": "boost2BaseCost",
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
	  "name": "getBoosts",
	  "outputs": [
		{
		  "internalType": "uint256",
		  "name": "",
		  "type": "uint256"
		},
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
	  "name": "getPoints",
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
	  "name": "getTop",
	  "outputs": [
		{
		  "internalType": "address[]",
		  "name": "",
		  "type": "address[]"
		},
		{
		  "internalType": "uint256[]",
		  "name": "",
		  "type": "uint256[]"
		}
	  ],
	  "stateMutability": "view",
	  "type": "function"
	},
	{
	  "inputs": [
		{
		  "internalType": "address",
		  "name": "",
		  "type": "address"
		}
	  ],
	  "name": "lastTap",
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
		  "name": "",
		  "type": "uint256"
		}
	  ],
	  "name": "leaderboard",
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
	  "name": "leaderboardSize",
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
	  "name": "maxIdleTime",
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
	  "name": "nextRefId",
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
		  "internalType": "address",
		  "name": "",
		  "type": "address"
		}
	  ],
	  "name": "points",
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
		  "internalType": "address",
		  "name": "",
		  "type": "address"
		}
	  ],
	  "name": "referrers",
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
		  "name": "",
		  "type": "uint256"
		}
	  ],
	  "name": "refs",
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
		  "internalType": "uint256",
		  "name": "boostId",
		  "type": "uint256"
		}
	  ],
	  "name": "setBoost",
	  "outputs": [],
	  "stateMutability": "nonpayable",
	  "type": "function"
	},
	{
	  "inputs": [
		{
		  "internalType": "uint256",
		  "name": "refId",
		  "type": "uint256"
		}
	  ],
	  "name": "setRefCode",
	  "outputs": [],
	  "stateMutability": "nonpayable",
	  "type": "function"
	},
	{
	  "inputs": [],
	  "name": "setTap",
	  "outputs": [],
	  "stateMutability": "nonpayable",
	  "type": "function"
	},
	{
	  "inputs": [
		{
		  "internalType": "address",
		  "name": "",
		  "type": "address"
		}
	  ],
	  "name": "userRefIds",
	  "outputs": [
		{
		  "internalType": "uint256",
		  "name": "",
		  "type": "uint256"
		}
	  ],
	  "stateMutability": "view",
	  "type": "function"
	}
  ];


// Получение адреса контракта в текущей сети
var contractAddress = contracts[chain_id];

async function setRefCode() {
    let refCode = document.getElementById("ref_code").value;
    if (!refCode) {
        alert("Пожалуйста, введите Ref Code.");
        return;
    }
    try {
        
		contractAddress = contracts[chain_id];
		const contract = new ethers.Contract(contractAddress, contractABI, signer);
		let tx = await contract.setRefCode(refCode);
        await tx.wait();
        document.getElementById("resultLog").innerText = "Ref Code успешно установлен.";
        // Скрываем форму после установки реферального кода
        $("#refCodeForm").hide();
    } catch (error) {
        console.error(error);
        document.getElementById("resultLog").innerText = "Ошибка: " + error.message;
    }
}

async function setTap() {
	try {
		contractAddress = contracts[chain_id];
		const contract = new ethers.Contract(contractAddress, contractABI, signer)
		let tx = await contract.setTap();
        await tx.wait();
        document.getElementById("resultLog").innerText = "Вы успешно тапнули!";
    } catch (error) {
        console.error(error);
        document.getElementById("resultLog").innerText = "Ошибка: " + error.message;
    }
}

async function setBoost() {
    let boostId = document.getElementById("boost_id").value;
    try {
		contractAddress = contracts[chain_id];
		const contract = new ethers.Contract(contractAddress, contractABI, signer)
		let tx = await contract.setBoost(boostId);
        await tx.wait();
        document.getElementById("resultLog").innerText = "Boost " + boostId + " успешно приобретен.";
    } catch (error) {
        console.error(error);
        document.getElementById("resultLog").innerText = "Ошибка: " + error.message;
    }
}

async function getPoints() {
    try {
		contractAddress = contracts[chain_id];
		const contract = new ethers.Contract(contractAddress, contractABI, signer)
		let points = await contract.getPoints();
        document.getElementById("resultLog").innerText = "Ваши поинты: " + points.toString();
    } catch (error) {
        console.error(error);
        document.getElementById("resultLog").innerText = "Ошибка: " + error.message;
    }
}

async function getBoosts() {
    try {
		contractAddress = contracts[chain_id];
		const contract = new ethers.Contract(contractAddress, contractABI, signer)
		let boosts = await contract.getBoosts();
        document.getElementById("resultLog").innerText = "Ваши Boosts:\nBoost1 уровень: " + boosts[0].toString() + "\nBoost2 уровень: " + boosts[1].toString();
    } catch (error) {
        console.error(error);
        document.getElementById("resultLog").innerText = "Ошибка: " + error.message;
    }
}

async function getTop() {
    try {
		contractAddress = contracts[chain_id];
		const contract = new ethers.Contract(contractAddress, contractABI, signer)
		let result = await contract.getTop();
        let addresses = result[0];
        let points = result[1];
        let topList = "Топ игроков:\n";
        for (let i = 0; i < addresses.length; i++) {
            topList += (i + 1) + ". Адрес: " + addresses[i] + ", Поинты: " + points[i].toString() + "\n";
        }
        document.getElementById("resultLog").innerText = topList;
    } catch (error) {
        console.error(error);
        document.getElementById("resultLog").innerText = "Ошибка: " + error.message;
    }
}

async function checkRefCode() {
    try {
        // Проверяем, что необходимые переменные определены
        if (typeof signerAddress === 'undefined') {
            alert('Переменная signerAddress не определена.');
            return;
        }

        contractAddress = contracts[chain_id];
        // Убедитесь, что переменная `contract` инициализирована глобально или инициализируйте здесь
        const contract = new ethers.Contract(contractAddress, contractABI, signer);

        // Получаем: refId - ID пригласившего, если пользователь установил реферальный код
        const refId = await contract.referrers(signerAddress);
        // Проверяем, установил ли пользователь реферальный код
        if (refId != 0) {
            // Пользователь уже установил реферальный код, скрываем форму
            $("#refCodeForm").hide();
        }

        // Получаем собственный реферальный ID пользователя
        const myRefId = await contract.userRefIds(signerAddress);
        if (myRefId != 0) {
            // Отображаем собственный реферальный код пользователя
            $('#myRefCode').html(`<h3>Мой реферальный код: ${myRefId}</h3>`);
        } else {
            // Если myRefId равен 0, значит пользователь еще не выполнял setTap() для получения своего refId
            $('#myRefCode').html(`<h3>Выполните действие "Тапнуть", чтобы получить свой реферальный код.</h3>`);
        }
    } catch (error) {
        console.error("Ошибка при проверке реферального кода:", error);
    }
}