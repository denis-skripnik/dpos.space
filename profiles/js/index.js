// константы - названия чейнов
var STEEM_CHAIN = 'steem';
var GOLOS_CHAIN = 'golos';
var viz_CHAIN   = 'viz';
var WLS_CHAIN   = 'WLS';

var BACKUP_SERVICE = 'backup';
var CALC_SERVICE = 'calc';
var POST_SERVICE = 'post';
var LOSER_SERVICE = 'loser-game';
var SERVICES_WITHOUT_USERNAME = [
    BACKUP_SERVICE,
    CALC_SERVICE,
    POST_SERVICE,
    LOSER_SERVICE,
  ];

var START_MODE = 'start';
var NEXT_MODE = 'next';
var PREVIOUS_MODE = 'previous';

var getParams = () => {
  const [, service, user, chain] = location.pathname.split('/');

  return {
    service,
    user,
    chain,
    'array_url': [service, user, chain],
  };
};

// функция получает название чейна, а отдаёт обработчик клика по соответствующей кнопке
var getSelectChainHandler = chain => {
  return () => {
    const arrayUrl = getParams()['array_url'];

    const service = arrayUrl[0];


    let redirect;
    if (SERVICES_WITHOUT_USERNAME.includes(service)) {
      redirect = `/${service}/${chain}`;
    } else if (arrayUrl[2]) {
      const user = arrayUrl[1];
      redirect = `/${service}/${user}/${chain}`;
    } else {
      return;
    }

    history.pushState('', '', redirect);
$.ajax({
   url:redirect, 
   success:function(result){
      document.write(result);
      document.close();
   }
});

  }
};

$(document).ready(() => {
  // установка обработчиков на кнопки чейнов
  $("#chains1").click(getSelectChainHandler(STEEM_CHAIN));
  $("#chains2").click(getSelectChainHandler(GOLOS_CHAIN));
  $("#chains3").click(getSelectChainHandler(viz_CHAIN));
  $("#chains4").click(getSelectChainHandler(WLS_CHAIN));
});

// здесь будем хранить списки стартовых значений для каждого таба
var paginationParams = {
  trx: [],
  author_rewards: [],
  curator_rewards: [],
  'b_rewards': [],
  followers: [],
  delegat: [],
  replyse: [],
  'posts_with_payment': [],
};

var page = 1;

var getLoad = (tabName, columnId, nextButtonText, previousButtonText) => {
  return (mode) => {
    const params = getParams();
    switch (mode) {
      case START_MODE: {
        page = 1;
        break;
      }
      case NEXT_MODE: {
        page++;
        params.start = paginationParams[tabName][page - 2];
        break;
      }
      case PREVIOUS_MODE: {
        page--;
        if (page !== 1) {
          params.start = paginationParams[tabName][page - 2];
        }

        break;
      }
    }

    $.get(`/profiles/tabs/${tabName}.php`, params, function(res) {

      console.dir(res);

      $(`#${columnId}`).html(res.content);

      // если страница не первая, нужна кнопка шага назад
      if (page !== 1) {
        const previousButtonId = `previous_${tabName}`;
        $(`#${columnId}`).append(`<button id="${previousButtonId}">${previousButtonText}</button>`);
        $(`#${previousButtonId}`).click(() => {
          getLoad(tabName, columnId, nextButtonText, previousButtonText)(PREVIOUS_MODE);
        });
      }

      // если есть следующая страница, нужна кнопка шага вперёд
      if (res.nextIsExists) {
        paginationParams[tabName][page - 1] = res.next;

        const nextButtonId = `next_${tabName}`;
        $(`#${columnId}`).append(`<button id="${nextButtonId}" style="float: right">${nextButtonText}</button>`);

        $(`#${nextButtonId}`).click(() => {
          getLoad(tabName, columnId, nextButtonText, previousButtonText)(NEXT_MODE);
        });
      }

      // если это первая страница, а данных больше нет - показываем сообщение об этом
      if (page === 1 && ! res.nextIsExists) {
        $(`#${columnId}`).append('<span>Последняя страница с данными</span>');
      }

      $('table#rewards-ol, table#delegat-ol').attr('start', page * 50 - 49);
    }, 'json');
  }
};

$("#tab1").click(function() {

  $.get("/profiles/tabs/userinfo.php", getParams(), function(res) {
    $("#tab_content1").html(res);
  })

});
$("#tab2").click(function(){

  getLoad('trx', 'tab_content2', 'Следующие 20', 'Предыдущие 20')(START_MODE);

});
$("#tab3").click(function(){

  getLoad('author_rewards', 'tab_content3', 'Следующие 10', 'Предыдущие 10')(START_MODE);

});

$("#tab4").click(function(){

  getLoad('curator_rewards', 'tab_content4', 'Следующие 20', 'Предыдущие 20')(START_MODE);

});
$("#tab5").click(function(){

  getLoad('b_rewards', 'tab_content5', 'Следующие 5', 'Предыдущие 5')(START_MODE);

});
$("#tab6").click(function(){

  getLoad('followers', 'tab_content6', 'Следующие 50', 'Предыдущие 50')(START_MODE);

});
$("#tab7").click(function(){

  getLoad('delegat', 'tab_content7', 'Следующие 10', 'Предыдущие 10')(START_MODE);

});
$("#tab8").click(function(){

  getLoad('replyse', 'tab_content8', 'Следующие 50', 'Предыдущие 50')(START_MODE);

});
$("#tab9").click(function(){

  $.get("/profiles/tabs/blog-posts.php", getParams(), function(res) {
    $("#tab_content9").html(res);
  });

});


$("#tab10").click(function(){

  getLoad('posts_with_payment', 'tab_content10', 'Следующие 50', 'Предыдущие 50')(START_MODE);

});

function bind_range(){
	$('input[type=range]').each(function(i){
		if(typeof $(this).attr('data-fixed') !== 'undefined'){
			let fixed_name=$(this).attr('data-fixed');
			let fixed_min=parseInt($(this).attr('min'));
			let fixed_max=parseInt($(this).attr('max'));
			$(this).unbind('change');
			$(this).bind('change',function(){
				if($(this).is(':focus')){
					$('input[name='+fixed_name+']').val($(this).val());
				}
			});
			$('input[name='+fixed_name+']').unbind('change');
			$('input[name='+fixed_name+']').bind('change',function(){
				let fixed_name=$(this).attr('data-fixed');
				let val=parseInt($(this).val());
				if(val>fixed_max){
					val=fixed_max;
				}
				if(val<fixed_min){
					val=fixed_min;
				}
				$(this).val(val);
				$('input[name='+fixed_name+']').val($(this).val());
			});
		}
	});
}