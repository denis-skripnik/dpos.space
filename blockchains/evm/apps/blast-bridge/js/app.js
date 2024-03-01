const contracts = {
	"11155111": "0xc644cc19d2A9388b71dd1dEde07cFFC73237Dca8"
}

let contract;

var toAddress = contracts[chain_id];

async function sendEth() {
	toAddress = contracts[chain_id];
	const ethAmountInput = document.getElementById("eth_amount");
	const ethAmount = ethAmountInput.value;

	if (!ethAmount || ethAmount <= 0) {
		alert("Введите корректную сумму ETH");
		return;
	}

	try {
		const transaction = await signer.sendTransaction({
			to: toAddress,
			value: ethers.utils.parseEther(ethAmount),
		});

		console.log("Transaction hash:", transaction.hash);
		alert("Транзакция отправлена. Хеш: " + transaction.hash);

		// Очистить поле ввода после успешной транзакции
		ethAmountInput.value = "";
	} catch (error) {
		console.error("Error:", error.message);
		alert("Ошибка при отправке транзакции: " + error.message);
	}
}

async function setMaxAmount() {

	// Получить баланс аккаунта
	const balance = await signer.getBalance();

	// Оценить предполагаемую комиссию (может потребоваться подбирать значение в зависимости от условий сети)
	const gasPrice = await provider.getGasPrice();
	const estimatedGasLimit = 21000; // Стандартный лимит газа для перевода
	const estimatedGasCost = gasPrice.mul(estimatedGasLimit);
	const maxAmount = ethers.utils.formatEther(balance.sub(estimatedGasCost));

	// Установить максимальную сумму в поле ввода
	document.getElementById("eth_amount").value = maxAmount;
}