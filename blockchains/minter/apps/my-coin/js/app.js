async function loadBalances() {
    let tokens = await getBalance(sender.address);
        let balances_list = '';
        for (let token of tokens) {
if (token.type === 'token') {
    let amount = parseFloat(token.amount);
    balances_list += `<option value="${token.coin}" data-max="${amount}">${token.coin}</option>`;
}
        }
    $('[name=tokens]').html(balances_list);
    }

$(document).ready(async function() {
    if (seed) {
        await loadBalances();
      }
    
    $('[name=type]').change(async function() {
let type = $('[name=type]').val();
if (type.indexOf('COIN') > -1) {
    $('#for_coin').css('display', 'block');
    $('#for_token').css('display', 'none');
} else {
    $('#for_coin').css('display', 'none');
    $('#for_token').css('display', 'block');
}
});

$("#max_token_burn").click(async function(){
    let token = $('[name=tokens]').val();
    $('#action_burn_amount').val(new Number(parseFloat($('#max_burn_amount').html())).toFixed(3));
  });

  let select = $("[name=tokens] option:selected");
  let token = $(select).val();
    let max = select.data('max');
    $('.burn_modal_token').html(token);
    $('#max_burn_amount').html(max);

    $('[name=tokens]').change(async function() {
        let token = $(this).val();
        let max = $("[name=tokens] option:selected").data('max');
        $('.burn_modal_token').html(token);
        $('.burn_modal_token').html(token);
        $('#max_burn_amount').html(max);
      });

});