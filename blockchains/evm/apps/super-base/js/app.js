const contracts = {
	"8453": {
	  app: "0x7f6012cefbda15f86e55fcbe81deb4b69a69d43b", // Адрес контракта приложения
	  token: "0x80215590ce8972ef9d5df9a4562035493d7e4d29" // Адрес токена SUPERBASE
	}
  };
  

  const appABI = [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":false,"internalType":"bytes","name":"ipfsHash","type":"bytes"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"NewMessageLogged","type":"event"},{"inputs":[],"name":"SUPERBASE","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes","name":"ipfsHash","type":"bytes"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"addSuper","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"getAllMessages","outputs":[{"components":[{"internalType":"address","name":"sender","type":"address"},{"internalType":"bytes","name":"ipfsHash","type":"bytes"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"uint256","name":"timestamp","type":"uint256"}],"internalType":"struct SuperBaseMessages.Message[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"getUserMessages","outputs":[{"components":[{"internalType":"address","name":"sender","type":"address"},{"internalType":"bytes","name":"ipfsHash","type":"bytes"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"uint256","name":"timestamp","type":"uint256"}],"internalType":"struct SuperBaseMessages.Message[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"minAmount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"setMinAmount","outputs":[],"stateMutability":"nonpayable","type":"function"}];
  const tokenABI = [
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
                "internalType": "uint256",
                "name": "maxSupply",
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
                "name": "spender",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "value",
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
                "indexed": false,
                "internalType": "uint256",
                "name": "value",
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
                "name": "owner",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "spender",
                "type": "address"
            }
        ],
        "name": "allowance",
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
                "name": "spender",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "approve",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "account",
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
        "inputs": [],
        "name": "decimals",
        "outputs": [
            {
                "internalType": "uint8",
                "name": "",
                "type": "uint8"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "spender",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "subtractedValue",
                "type": "uint256"
            }
        ],
        "name": "decreaseAllowance",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "spender",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "addedValue",
                "type": "uint256"
            }
        ],
        "name": "increaseAllowance",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "initialSupply",
                "type": "uint256"
            },
            {
                "internalType": "address",
                "name": "to",
                "type": "address"
            }
        ],
        "name": "initialize",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
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
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "mint",
        "outputs": [],
        "stateMutability": "nonpayable",
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
        "inputs": [],
        "name": "totalSupply",
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
                "name": "to",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "transfer",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
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
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "transferFrom",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];
  
let appContract, tokenContract;
let node;

// Функция для ожидания инициализации blockchain.js
async function waitForProviderAndSigner() {
    const maxRetries = 10;
    let retryCount = 0;

    while ((typeof provider === "undefined" || typeof signer === "undefined") && retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 500));
        retryCount++;
    }

    if (typeof provider !== "undefined" && typeof signer !== "undefined") {
        return true;
    } else {
        console.error("Provider or signer is not available after waiting.");
        return false;
    }
}

async function initialize() {
    try {
        if (!provider || !signer) {
            console.error("Provider or signer is not available. Please connect your wallet.");
            return;
        }

        if (!node) {
            node = await window.Ipfs.create();
        }

        const chainId = await provider.getNetwork().then(network => network.chainId);
        if (!contracts[chainId]) {
            console.error("No contracts defined for the current network.");
            return;
        }

        appContract = new ethers.Contract(contracts[chainId].app, appABI, signer);
        tokenContract = new ethers.Contract(contracts[chainId].token, tokenABI, signer);

        document.getElementById('maxBalance').addEventListener('click', setMaxBalance);
        document.getElementById('addMessage').addEventListener('click', addAndApproveMessage);

        setInterval(loadUserMessages, 5000);
        setInterval(loadAllMessages, 5000);
        setInterval(getAndDisplayBalance, 5000);

    } catch (error) {
        console.error("Initialization error:", error);
    }
}

// Функция для получения и отображения баланса токенов SUPERBASE
async function getAndDisplayBalance() {
    try {
        const userAddress = await signer.getAddress();
        const balance = await tokenContract.balanceOf(userAddress);
        const formattedBalance = ethers.utils.formatUnits(balance, 18);
        document.getElementById('maxBalance').textContent = `${formattedBalance} SUPERBASE`;
    } catch (error) {
        console.error("Error fetching balance:", error);
        document.getElementById('maxBalance').textContent = "Unable to fetch balance";
    }
}

// Функция для установки максимального баланса
function setMaxBalance() {
    const maxBalance = document.getElementById('maxBalance').innerHTML;
    document.getElementById('amount').value = parseFloat(maxBalance);
}

// Объединённая функция для approve и добавления сообщения
async function addAndApproveMessage() {
    const amountInput = document.getElementById('amount').value;
    const messageInput = document.getElementById('message').value;

    if (!amountInput || amountInput <= 0 || !messageInput) {
        alert("Пожалуйста, введите корректную сумму и сообщение");
        return;
    }

    const amount = ethers.utils.parseUnits(amountInput, 18);

    try {
        const chainId = await signer.getChainId();
        const approveTx = await tokenContract.approve(contracts[chainId].app, amount);
        alert(`Транзакция Approve отправлена. Хеш: ${approveTx.hash}`);
        await approveTx.wait();
        console.log("Approve подтверждён");

        const fileAdded = await node.add({
            path: `${Date.now()}.txt`,
            content: messageInput
        });

        const cid = window.Multiformats.CID.parse(fileAdded.cid.toString());
        const cidBytes = cid.bytes;
        const encodedHex = ethers.utils.hexlify(cidBytes);

        const addTx = await appContract.addSuper(encodedHex, amount);
        alert(`Сообщение добавлено. Транзакция отправлена. Хеш: ${addTx.hash}`);
        await addTx.wait();
        console.log("Сообщение успешно добавлено");

        await getAndDisplayBalance();
        await loadUserMessages();
        await loadAllMessages();

    } catch (error) {
        console.error("Ошибка при добавлении сообщения:", error);
        alert(`Ошибка: ${error.message}`);
    }
}

// Функция для загрузки сообщений пользователя
async function loadUserMessages() {
    const userAddress = await signer.getAddress();
    const userMessages = await appContract.getUserMessages(userAddress);
    renderMessages(userMessages, "userMessagesTable");
}

// Функция для загрузки всех сообщений
async function loadAllMessages() {
    const allMessages = await appContract.getAllMessages();
    renderMessages(allMessages, "allMessagesTable");
}

// Функция для отображения сообщений
async function renderMessages(messages, tableId) {
    const table = document.getElementById(tableId);
    table.innerHTML = '';

    for (const msg of messages) {
        const row = table.insertRow();
        const cell1 = row.insertCell(0);
        const cell2 = row.insertCell(1);
        const cell3 = row.insertCell(2);
        const cell4 = row.insertCell(3);

        cell1.textContent = msg.sender;
        cell2.textContent = ethers.utils.formatUnits(msg.amount, 18);

        try {
            const cidBytes = ethers.utils.arrayify(msg.ipfsHash);
            const cid = window.Multiformats.CID.decode(cidBytes);
            const cidString = cid.toString();
            cell3.textContent = cidString;

            let data = '';
            for await (const chunk of node.cat(cidString)) {
                data += new TextDecoder().decode(chunk);
            }
            cell4.textContent = data;
        } catch (error) {
            console.error("Ошибка при обработке IPFS хеша:", error);
            cell3.textContent = "Ошибка";
            cell4.textContent = "Не удалось загрузить сообщение";
        }
    }
}

// Вызов функции ожидания и инициализация приложения
window.addEventListener("load", async () => {
    const providerReady = await waitForProviderAndSigner();
    if (providerReady) {
        await initialize();
    }
});
