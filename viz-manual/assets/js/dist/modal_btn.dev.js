"use strict";

$('.btnNext').click(function () {
  $('.nav-tabs .active').parent().next('li').find('a').trigger('click');
  newFunction();
});
$('.btnPrevious').click(function () {
  $('.nav-tabs .active').parent().prev('li').find('a').trigger('click');
  newFunction();
});

function newFunction() {
  $.each($('.nav-tabs .active'), function () {
    history.replaceState(null, null, '/');
    var newAdress = document.location.href + this.id;
    history.pushState(this.id, '', newAdress);
  });
}

;