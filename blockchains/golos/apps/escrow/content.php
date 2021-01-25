<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<div id="active_auth_msg" style="display: none;"><p>Для работы с кошельком необходим активный ключ. Укажите его <a href="'.$conf['siteUrl'].'golos/accounts" target="_blank">на странице аккаунтов</a>. Если вы авторизованы, удалите аккаунт и добавьте с активным ключом; Если нет, авторизуйтесь с указанием обоих ключей.</p></div>                        
<div id="active_page">
<ul id="tabs">
			<li><a id="tabSend" data-div="tabSendWrap" href="/">Отправить</a></li>
			<li><a id="tabCP" data-div="controlPanelWrap" href="/">Панель управления</a></li>
			<li><a id="tabBoard" data-div="tabBoardWrap" href="/">Объявления</a></li>
			<li class="right last">
				<div id="switchLanguage" class="switcher">
					<a id="currentLanguage" href="#">Русский</a>
					<ul>
						<li><a href="'.$conf['siteUrl'].'golos/escrow/?l=en-EN">English</a></li>
						<li><a href="'.$conf['siteUrl'].'golos/escrow/?l=ru-RU">Русский</a></li>
					</ul>
				</div>
			</li>
		</ul>

		<div id="tabBoardWrap" class="tabWrapper" style="display: none;">
	<div id="boardSidebar">
		<a id="boardAddAd" class="btn btn-block btn-primary" href="https://golos.id/nsfw/@xtar/test" target="_blank">Добавить объявление</a>
		<div id="boardSidebarHelp">
			<p>Показываются объявления не старше 3 дней.</p>
			<p>У автора должна быть репутация не менее 50.</p>
			<p>Сортировка по репутации авторов.</p>
		</div>
	</div>
	<div id="boardBody"></div>
</div>

<div id="tabSendWrap" class="tabWrapper" style="display: none;">

<form id="formSend">

	<label id="labelReceiver">Введите логин получателя платежа:</label>
	<input id="inputSendReceiver" class="form-control" type="text" placeholder="Логин получателя">

	<label id="labelAmount">Введите сумму для отправки:</label>
	<div class="inputWithToggles">
		<input class="form-control" id="inputSendAmount" type="text" placeholder="Сумма, для переключения GOLOS/GBG кликни справа">
		<a id="aSendAmountUnit" href="#" class="inputToggle"></a>
	</div><!-- /input-group -->

	<label id="labelAgent"><span style="float: right;"></span>Выберите гаранта. Чтоб попасть в этот список, отписываемся <a href="https://golos.id/nsfw/@denis-skripnik/ru-khocheshx-statx-garantom-budx-im" target="_blank">вот тут</a>, сортировка списка по репутации гарантов:</label>
	<select id="sendAgent" class="form-control">
		<option id="selectOptionChooseAgent" value="">Выберите гаранта...</option>
	</select>

	<div id="agentFeeWrap" style="display: none;">
		<label id="labelSendFeeAmout">Комиссия:</label>
		<div class="inputWithToggles">
		<input class="form-control" disabled="disabled" id="sendFeeAmout" type="text">
		<a href="#" class="inputToggle">GOLOS</a>
		</div><!-- /input-group -->
	</div>

	<label id="labelDeadline">Укажите срок, втечение которого получатель и гарант должны дать свое согласие на совершение данной сделки. Если они не успеют этого сделать, средства автоматически вернутся на счет отправителя:</label>
	<select id="sendDeadline" class="form-control">
		<option class="selectOption3hours" value="3" selected="selected">3 часа</option>
		<option class="selectOption6hours" value="6">6 часов</option>
		<option class="selectOption12hours" value="12">12 часов</option>
		<option class="selectOption24hours" value="24">24 часа</option>
		<option class="selectOption2days" value="48">2 дня</option>
		<option class="selectOption4days" value="96">4 дня</option>
		<option class="selectOption1week" value="168">1 неделя</option>
	</select>

	<label id="labelEscrowEndDate">Укажите срок действия гаранта, по истечении которого любая из сторон сможет принять любое решение (либо забрать деньги себе, либо отправить второй стороне). Этот срок не может быть меньше предыдущего:</label>
	<select id="sendEscrowExpiration" class="form-control">
		<option class="selectOption1week" value="168">1 неделя</option>
		<option class="selectOption2week" value="336">2 недели</option>
		<option class="selectOption3week" value="504">3 недели</option>
		<option class="selectOption1month" value="730" selected="selected">1 месяц</option>
		<option class="selectOption2month" value="1460">2 месяц</option>
		<option class="selectOption6month" value="4380">6 месяцев</option>
		<option class="selectOption1year" value="8760">1 год</option>
	</select>

	<label id="labelTransactionTerms">Условия сделки (не обязательно, но крайне желательно)</label>
	<input class="form-control" id="inputSendMeta" type="text" placeholder="Будут нужны в случае возникновения спорной ситуации">

	<button form="formSend" id="buttonSendSubmit" class="btn btn-block btn-primary buttonSendSubmit">Отправить</button>

</form>

	<div id="sendError" style="display: none;"></div>
	<div id="step2" style="display: none;">Sent ok: <a href="#" class="sentLink"></a></div>
</div>
<div id="controlPanelWrap" class="tabWrapper" style="display: none;">

	<div id="errorTransactionNotFound" class="escrow_hidden">
		<strong>Ошибка!</strong> Активный ордер с данным ID не найден в блокчейне.
	</div>

	<table id="escrowData">
		<tr>
			<td id="tdTransactionId">id транзакции</td>
			<td>
				<span class="transactionId wordLoading">Загрузка...</span>
			</td>
		</tr>		
		<tr>
			<td id="tdSender">Отправитель</td>
			<td>
				<p><span class="transactionFrom wordLoading">Загрузка...</span></p>
				<div class="waitingForApproval escrow_hidden">
					<div id="actionSenderWaitingForApproval">
						Отправитель ожидает, пока получатель и гарант дадут свое согласие на совершение данной сделки. Если до <span class="transactionDeadline"></span> хоть одна из сторон не согласится, средства автоматически вернутся отправителю.
					</div>
				</div>
				<div class="approvalRecieved escrow_hidden">
					<p id="actionSenderApprovalReceived">Отправитель может либо отправить средства получателю, либо оспорить сделку:</p>
					<button data-form="startDisputForm" data-nick="from" class="btn buttonStartDispute">Оспорить сделку</button>
					<button data-form="releaseForm" data-nick="from" class="release btn btn-primary buttonSendFundsToReceiver">Отправить средства получателю</button>
				</div>
				<div class="disputeInitiated escrow_hidden">
					<div id="actionSenderWaitingEscrow">
						Отправитель ожидает принятия решения гарантом.
					</div>
				</div>
				<div class="escrowExpired escrow_hidden">
					<p id="actionSenderEscrowExpired">Срок действия гаранта истёк</p>
					<button data-form="expiredForm" data-nick="from" class="btn buttonTakeFunds">Забрать средства себе</button>
					<button data-form="releaseForm" data-nick="from" class="release btn btn-primary buttonSendFundsToReceiver">Отправить средства получателю</button>
				</div>
			</td>
		</tr>
		<tr>
			<td id="tdReceiver">Получатель</td>
			<td>
				<p><span class="transactionTo wordLoading">Загрузка...</span></p>
				<div class="waitingForApprovalTo escrow_hidden">
					<p id="actionReceiverWaitingForApproval">Получатель должен решить, согласен он с условиями сделки или нет:</p>
					<button data-form="approveForm" data-answer="0" data-nick="to" class="approve btn buttonDisapproveDeal">Не согласен</button>
					<button data-form="approveForm" data-answer="1" data-nick="to" class="approve btn btn-primary buttonApproveDeal">Согласен</button>
				</div>
				<div class="approvalRecieved escrow_hidden">
					<p id="actionReceiverApprovalReceived">Получатель может либо вернуть средства отправителю, либо оспорить сделку:</p>
					<button data-form="startDisputForm" data-nick="to" class="btn buttonStartDispute">Оспорить сделку</button>
					<button data-form="releaseForm" data-nick="to" class="release btn btn-success buttonSendFundsToSender">Вернуть средства отправителю</button>
				</div>
				<div id="actionReceiverWaitingEscrow" class="disputeInitiated escrow_hidden">
					Получатель ожидает принятия решения гарантом.
				</div>
				<div class="escrowExpired escrow_hidden">
					<p id="actionReceiverEscrowExpired">Срок действия гаранта истёк</p>
					<button data-form="expiredForm" data-nick="to" class="btn buttonTakeFunds">Забрать средства себе</button>
					<button data-form="releaseForm" data-nick="to" class="release btn btn-primary buttonSendFundsToSender">Вернуть средства отправителю</button>
				</div>
			</td>
		</tr>
		<tr>
			<td id="tdAmount">Сумма</td>
			<td>
				<span class="transactionMoney wordLoading">Загрузка...</span>
			</td>
		</tr>
		<tr>
			<td id="tdAgent">Гарант</td>
			<td>
				<p><span class="transactionAgent wordLoading">Загрузка...</span></p>
				<div class="waitingForApprovalAgent escrow_hidden">
					<p id="agentWaitingForApproval">Гарант должен решить, согласен он с условиями сделки или нет:</p>
					<button data-form="approveForm" data-answer="0" data-nick="agent" class="approve btn buttonDisapproveDeal">Не согласен</button>
					<button data-form="approveForm" data-answer="1" data-nick="agent" class="approve btn btn-primary buttonApproveDeal">Согласен</button>
				</div>
				<div id="agentApprovalRecieved" class="approvalRecieved escrow_hidden">
					Пока нет спорной ситуации, гарант ничего не делает.
				</div>
				<div class="disputeInitiated escrow_hidden">
					<button data-form="escrowForm" data-answer="escrowFrom" data-nick="agent" class="approve btn btn-primary buttonSendFundsToSender">Вернуть средства отправителю</button>
					<button data-form="escrowForm" data-answer="escrowTo" data-nick="agent" class="approve btn btn-primary buttonSendFundsToReceiver">Отправить средства получателю</button>
				</div>
				<div id="agentEscrowExpired" class="escrowExpired escrow_hidden">
					Срок действия гаранта истёк. Теперь любая из сторон может принять любое решение.
				</div>
			</td>
		</tr>
		<tr>
			<td id="tdEscrowFee">Комиссия гаранта</td>
			<td>
				<span class="transactionFee wordLoading">Загрузка...</span>
			</td>
		</tr>
		<tr>
			<td id="tdDeadlineDate">Дата и время закрытия сделки</td>
			<td>
				<span class="transactionDate wordLoading">Загрузка...</span>
			</td>
		</tr>
		<tr>
			<td id="tdCurrentDate">Текущая дата и время в блокчейне</td>
			<td>
				<span class="transactionDateCurrent wordLoading">Загрузка...</span>
			</td>
		</tr>
		<tr>
			<td id="tdMeta">Условия сделки</td>
			<td><span class="transactionMeta wordLoading">Загрузка...</span></td>
		</tr>
	</table>

	<div id="sendTransaction" style="display: none;">

		<label id="labelAction">Действие</label>
		<select disabled="disabled" class="form-control" id="transactionType">
			<option id="actionApproveForm" value="approveForm">Дать согласие (или отказ) на условия сделки</option>
			<option id="actionReleaseForm" value="releaseForm">Отправить деньги получателю</option>
			<option id="actionCancelForm" value="cancelForm">Отменить сделку и отправить деньги отправителю</option>
			<option id="actionStartDisputeForm" value="startDisputForm">Оспорить сделку</option>
			<option id="actionEscrowForm" value="escrowForm">Гарант решит, кому отправить средства</option>
			<option id="actionExpiredForm" value="expiredForm">Срок действия гаранта истек, забираю средства себе</option>
		</select>

		<form id="approveForm" style="display: block;">
			<label>
				<input id="approveYes" name="yesNo" type="radio" value="1"> <span id="actionApproveFormYes">Да, с условиями согласен, продолжить сделку</span>
			</label>
			<label>
				<input id="approveNo" name="yesNo" type="radio" value="0"> <span id="actionApproveFormNo">Нет, с условиями не согласен, отменить сделку</span>
			</label>
			<button form="approveForm" class="btn btn-block btn-primary buttonSendSubmit">Отправить</button>
		</form>

		<form id="releaseForm">
			<button form="releaseForm" class="btn btn-block btn-primary buttonSendFundsToReceiver">Отправить средства получателю</button>
		</form>

		<form id="expiredForm">
			<button form="expiredForm" class="btn btn-block btn-primary buttonTakeFunds">Забрать средства себе</button>
		</form>

		<form id="cancelForm">
			<button form="cancelForm" class="btn btn-block btn-primary buttonSendFundsToSender">Отправить средства отправителю</button>
		</form>

		<form id="startDisputForm">
			<button form="startDisputForm" class="btn btn-block btn-primary buttonStartDispute">Оспорить сделку</button>
		</form>

		<form id="escrowForm">
			<div class="radio">
				<label>
					<input id="escrowFrom" name="escrowAnswer" type="radio" value="escrowFrom"> <span class="buttonSendFundsToSender">Вернуть средства отправителю</span>
				</label>
			</div>
			<div class="radio">
				<label>
					<input id="escrowTo" name="escrowAnswer" type="radio" value="escrowTo"> <span class="buttonSendFundsToReceiver">Отправить средства получателю</span>
				</label>
			</div>
			<button form="escrowForm" class="btn btn-block btn-primary buttonSendSubmit">Отправить</button>
		</form>
</div>
'; ?>