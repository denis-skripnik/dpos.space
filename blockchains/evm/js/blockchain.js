const networks = {
	"80094": "Berachain mainnet",
	"998": "Hyperliquid EVM testnet",
	"168587773": "Blast Sepolia Testnet",
	"81457": "Blast mainnet",
	"8453": "Base mainnet",
	"11155111": "Ethereum Sepolia",
	"9999": "Meganet RC",
	"111000": "Siberium Testnet",
	"534352": "Scroll mainnet",
	"167005": "Taiko testnet",
	"59140": "linea Testnet",
	"7000": "ZetaChain mainnet",
	"7001": "Zetachain testnet",
	"97": "BSC Testnet",
	"1101": "Polygon zkEVM",
	"627463": "opBTC Testnet",
	"9001": "Evmos"
}

const tokens = {
	"80094": "BERA",
	"998": "HYPE",
    "168587773": "ETH",
	"81457": "ETH",
	"8453": "ETH",
	"11155111": "ETH",
	"9999": "MEGA",
	"111000": "SIBR",
	"534352": "ETH",
	"167005": "ETH",
	"59140": "ETH",
	"7000": "ZETA",
	"7001": "ZETA",
	"97": "BNB",
	"1101": "ETH",
	"627463": "opBTC",
	"9001": "EVMOS"
}

const explorers = {
	"80094": "https://berascan.com",
	"998": "https://testnet.purrsec.com",
    "168587773": "https://blast-testnet.blockscout.com",
	"81457": "https://blast.blockscout.com",
	"8453": "https://base.blockscout.com",
	"11155111": "https://eth-sepolia.blockscout.com",
	"9999": "https://scan.metagarden.io",
	"111000": "https://explorer.test.siberium.net",
	"534352": "https://blockscout.scroll.io",
	"167005": "https://explorer.hekla.taiko.xyz",
	"59140": "https://explorer.goerli.linea.build",
	"7000": "https://zetachain.blockscout.com",
	"7001": "https://zetachain-athens-3.blockscout.com",
	"97": "https://testnet.bscscan.com",
	"1101": "https://zkevm.blockscout.com",
	"627463": "https://explorer.testnet.brc20.com",
	"9001": "https://escan.live"
}

const rpcs = {
	"80094": "https://rpc.berachain.com",
    "998": "https://api.hyperliquid-testnet.xyz/evm",
	"168587773": "https://sepolia.blast.io",
	"81457": "https://rpc.ankr.com/blast",
	"8453": "https://base.llamarpc.com",
	"11155111": "https://sepolia.drpc.org",
	"9999": "https://rpc.metagarden.io",
	"111000": "https://rpc.test.siberium.net",
	"534352": "https://scroll.drpc.org",
	"167005": "https://rpc.test.taiko.xyz",
	"59140": "https://rpc.goerli.linea.build",
	"7000": "https://zeta-chain.drpc.org",
	"7001": "https://7001.rpc.thirdweb.com",
	"97": "https://endpoints.omniatech.io/v1/bsc/testnet/public",
	"1101": "https://rpc.ankr.com/polygon_zkevm",
	"627463": "https://rpc.testnet.brc20.com",
	"9001": "https://evmos.lava.build"
}


let chain_id;

var provider; // Ethers provider
let signer;
let signerAddress;

// Инициализация Web3Modal
document.addEventListener("DOMContentLoaded", () => {
    // Инициализация Web3Modal после загрузки всех компонентов
    const web3Modal = new window.Web3Modal.default({
        cacheProvider: true, // Не кешировать провайдера
        providerOptions: {
            walletconnect: {
                package: window.WalletConnectProvider.default,
                options: {
                    infuraId: "bb8171064db1495c9daa10c656d27100" // Замените на ваш Infura Project ID
                }
            },
            // Добавьте другие провайдеры здесь, если необходимо
        }
    });

    // Привязываем web3Modal к глобальной переменной, чтобы использовать его позже
    window.web3Modal = web3Modal;
});

// Функция для подключения кошелька через Web3Modal
async function connectWallet() {
    try {
        const instance = await web3Modal.connect();
        provider = new ethers.providers.Web3Provider(instance, "any");
        signer = provider.getSigner();
        signerAddress = await signer.getAddress();
        // Обновляем отображение адреса кошелька
        updateWalletDisplay(signerAddress);
        
        // Обработчики событий изменений
        instance.on("accountsChanged", (accounts) => {
            if (accounts.length === 0) {
                disconnectWallet();
            } else {
                signerAddress = accounts[0];
                updateWalletDisplay(signerAddress);
            }
        });

        instance.on("chainChanged", (chainIdHex) => {
            chain_id = parseInt(chainIdHex, 16).toString();
            updateNetworkDisplay(chain_id); // Обновляем отображение информации о сети
        });

        instance.on("disconnect", () => {
            disconnectWallet();
        });

                // Проверяем текущую сеть после подключения
                const currentNetwork = await provider.getNetwork();
                chain_id = currentNetwork.chainId.toString(); // Обновляем chain_id
                updateNetworkDisplay(chain_id); // Обновляем отображение информации о сети
                // Устанавливаем радиокнопку, если текущая сеть есть в списке доступных
                if (networks[chain_id] && Object.keys(contracts).indexOf(chain_id) > -1) {
                    $('#networkButton').text(networks[chain_id]); // Обновляем текст кнопки
                    $(`input[type="radio"][value="${chain_id}"]`).prop('checked', true); // Отмечаем радиокнопку
                    $(':button').not('#connectWallet, #networkButton').prop('disabled', false); // Активируем кнопки
                } else {
                    $('#networkButton').text("Выбрать сеть"); // Изменяем текст кнопки
                    $(':button').not('#connectWallet, #networkButton').prop('disabled', true); // Деактивируем кнопки
                }
        
            } catch (error) {
        console.error("Ошибка подключения кошелька:", error);
    }
}

function updateWalletDisplay(address) {
    const button = document.getElementById("connectWallet");
    button.textContent = `${address.slice(0, 6)}...${address.slice(-4)}`;
    button.onclick = showWalletOptions;
}

function showWalletOptions() {
    // Создание модального окна с опциями
    const options = `
        <div id="walletOptions" role="dialog" aria-modal="true" tabindex="-1">
            <button id="closeModalButton">Закрыть</button>
            <p>Кошелёк: ${signerAddress}</p>
            <button onclick="copyAddress()" id="copyButton">Скопировать адрес</button>
            <button onclick="disconnectWallet()">Отключить</button>
        </div>`;
    
    // Вставляем модалку в тело документа
    document.body.insertAdjacentHTML("beforeend", options);

    // Устанавливаем фокус на первую кнопку модалки
    const modal = document.getElementById('walletOptions');
    const closeModalButton = modal.querySelector('#closeModalButton');
    const firstFocusableElement = modal.querySelector('#copyButton');
    if (firstFocusableElement) {
        firstFocusableElement.focus();
    }

    // Обработчик для закрытия модалки по клику на кнопку "Закрыть"
    closeModalButton.addEventListener('click', closeWalletOptions);

    // Закрытие модалки по нажатию клавиши Esc
    document.addEventListener('keydown', closeModalOnEsc);

    // Закрытие модалки по клику за пределами
    modal.addEventListener('click', function(event) {
        if (event.target === modal) {
            closeWalletOptions();
        }
    });
}

// Функция для закрытия модального окна
function closeWalletOptions() {
    const modal = document.getElementById('walletOptions');
    if (modal) {
        modal.remove(); // Удаляем модалку из DOM
    }
    // Удаляем обработчик событий на клавиатуру
    document.removeEventListener('keydown', closeModalOnEsc);
}

// Функция для закрытия модалки по клавише Esc
function closeModalOnEsc(event) {
    if (event.key === 'Escape') {
        closeWalletOptions();
    }
}

function copyAddress() {
    navigator.clipboard.writeText(signerAddress).then(() => {
        alert("Адрес скопирован!");
    });
    closeWalletOptions();
}

window.addEventListener("load", async () => {
        if (web3Modal.cachedProvider) {
        // Если кошелек был подключен, выполняем повторное подключение
        await connectWallet();
        // Проверяем текущую сеть после подключения
        const currentNetwork = await provider.getNetwork();
        chain_id = currentNetwork.chainId.toString(); // Обновляем chain_id
        updateNetworkDisplay(chain_id); // Обновляем отображение информации о сети
        window.dispatchEvent(new Event('signerReady'));

        // Устанавливаем радиокнопку, если текущая сеть есть в списке доступных
        if (networks[chain_id] && Object.keys(contracts).indexOf(chain_id) > -1) {
            $('#networkButton').text(networks[chain_id]); // Обновляем текст кнопки
            $(`input[type="radio"][value="${chain_id}"]`).prop('checked', true); // Отмечаем радиокнопку
            $(':button').not('#connectWallet, #networkButton').prop('disabled', false); // Активируем кнопки
        } else {
            $('#networkButton').text("Выбрать сеть"); // Изменяем текст кнопки
            $(':button').not('#connectWallet, #networkButton').prop('disabled', true); // Деактивируем кнопки
        }
    } else {
        $('#networkButton').text("Выбрать сеть"); // Изменяем текст кнопки при отсутствии подключения
        $(':button').not('#connectWallet, #networkButton').prop('disabled', true); // Деактивируем кнопки
    }
    addAriaAttributes();
});

// Функция для отключения кошелька
async function disconnectWallet() {
    await web3Modal.clearCachedProvider();
}

// Функция для добавления атрибутов aria к Web3Modal элементам
function addAriaAttributes() {
    // Найти элемент с ID WEB3_CONNECT_MODAL_ID и добавить aria-атрибуты
    const modalElement = document.querySelector("#WEB3_CONNECT_MODAL_ID");
    if (modalElement) {
        modalElement.setAttribute("role", "dialog");
        modalElement.setAttribute("aria-modal", "true");
        modalElement.setAttribute("tabindex", "-1");
    }
}

// Функция для проверки текущей сети
const checkNetwork = async (targetNetworkId) => {
    if (provider) {
        const currentNetwork = await provider.getNetwork();
        return currentNetwork.chainId === parseInt(targetNetworkId, 16);
    }
    return false;
};

// Функция для смены сети
const switchNetwork = async (chainId) => {
    try {
        const targetNetworkId = ethers.utils.hexValue(chainId);
        const network_status = await checkNetwork(targetNetworkId);
        
        // Если сеть уже выбрана, просто выходим
        if (network_status === true) return;

        // Попытка переключиться на сеть
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: targetNetworkId }],
        });
        
        // Обновляем провайдер и chain_id
        provider = new ethers.providers.Web3Provider(window.ethereum, chainId);
        chain_id = chainId; 
        updateNetworkDisplay(chain_id); 
        $('#networkButton').text(networks[chain_id] || "Выбрать сеть"); 

    } catch (error) {
        // Если ошибка связана с отсутствием сети, запрашиваем её добавление
        if (error.code === 4902) { // Код ошибки для несуществующей сети
            try {
                // Запрашиваем добавление сети
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: targetNetworkId,
                        chainName: networks[chainId],
                        nativeCurrency: {
                            name: tokens[chainId],
                            symbol: tokens[chainId], // Символ токена
                            decimals: 18 // Десятичные знаки
                        },
                        rpcUrls: [rpcs[chainId]], // URL RPC для сети
                        blockExplorerUrls: [explorers[chainId]] // URL обозревателя блоков
                    }]
                });

                // После добавления сети, пробуем переключиться на неё снова
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: targetNetworkId }],
                });

                // Обновляем провайдер и chain_id
                provider = new ethers.providers.Web3Provider(window.ethereum, chainId);
                chain_id = chainId; 
                updateNetworkDisplay(chain_id); 
                $('#networkButton').text(networks[chain_id] || "Выбрать сеть"); 

            } catch (addError) {
                console.error("Ошибка при добавлении сети:", addError);
                alert("Не удалось добавить сеть. Пожалуйста, проверьте данные и попробуйте снова.");
            }
        } else {
            console.error("Ошибка при смене сети:", error);
            alert("Не удалось сменить сеть. Пожалуйста, проверьте данные и попробуйте снова.");
        }
    }
};



// Функция для переключения отображения элементов (spoiler)
function spoiler(elem, group){
    let style = document.getElementById(elem).style;
    if(document.querySelector("#" + elem).classList.contains(group) && style.display === 'none') {
        $('.' + group).hide();
    }

    style.display = (style.display == 'block') ? 'none' : 'block';
}

function generateNetworksForm(ids) {
    let form = '';
    for (let id of ids) {
        form += `
            <label for="id${id}">
                <input type="radio" name="network" id="id${id}" onclick="switchNetwork(${id})" value="${id}">
                ${networks[id]}
            </label>
        `;
    }
    return form;
}

$(document).ready(function() {
    if (typeof contracts !== 'undefined') {
        $('#selectNetwork').html(generateNetworksForm(Object.keys(contracts)));
    }
    
    $('#networkButton').click(function() {
        const isExpanded = $(this).attr('aria-expanded') === 'true';
        $(this).attr('aria-expanded', !isExpanded);
        $('#networkList').toggle(!isExpanded);
    });

    // Обновляем состояние при изменении сети
    $('input[type=radio][name=network]').change(function() {
        updateNetworkDisplay(this.value);
        $('#networkButton').text(networks[this.value]); // Обновляем текст кнопки
        $(':button').prop('disabled', false); // Убедитесь, что кнопка активна при изменении
    });
});

function updateNetworkDisplay(selectedNetworkId) {
    if (document.getElementById("nativeToken") !== null) {
        document.getElementById('nativeToken').innerHTML = tokens[selectedNetworkId] || '';
    }
    if (document.getElementById("smartContractAddress") !== null) {
        document.getElementById('smartContractAddress').innerHTML = contracts[selectedNetworkId] || '';
    }
    if (document.getElementById("chain_name") !== null) {
        document.getElementById("chain_name").innerHTML = networks[selectedNetworkId] || '';
    }
    if (document.getElementById("faucetBlock") !== null && selectedNetworkId !== '3333') {
        document.getElementById('faucetBlock').style.display = 'none';
    }
}