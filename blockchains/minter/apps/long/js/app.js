$(document).ready(function() {

    $('#max_lp').click(function() {
    let amount = $('#max_lp').html();
    $('[name=lp_tokens]').val(amount);
    $('[name=calc_percent]').val(100);
let my_share = $('[name=my_share]').val();
let get_amount = parseFloat($('#all_get_amount').html());
let result = get_amount - (get_amount * (my_share / 100));
$('#send_amount').html(result);
}); // end max LP click.

$('[name=lp_tokens]').change(function() {
    let amount = parseFloat($('[name=lp_tokens]').val());
let max = parseFloat($('#max_lp').html());
let percent = amount / max * 100;
$('[name=calc_percent]').val(percent);
let my_share = $('[name=my_share]').val();
let get_amount = parseFloat($('#all_get_amount').html());
get_amount *= percent / 100;
let result = get_amount - (get_amount * (my_share / 100));
$('#send_amount').html(result);
}); // end change LP_tokens.

$('[name=calc_percent]').change(function() {
    let percent = parseFloat($('[name=calc_percent]').val());
let max = parseFloat($('#max_lp').html());
let amount = max * (percent / 100)
$('[name=lp_tokens]').val(amount);
let my_share = $('[name=my_share]').val();
let get_amount = parseFloat($('#all_get_amount').html());
get_amount *= percent / 100;
let result = get_amount - (get_amount * (my_share / 100));
$('#send_amount').html(result);
}); // end change

$('[name=my_share]').change(function() {
    let percent = parseFloat($('[name=calc_percent]').val());
let my_share = $('[name=my_share]').val();
let get_amount = parseFloat($('#all_get_amount').html());
get_amount *= percent / 100;
let result = get_amount - (get_amount * (my_share / 100));
$('#send_amount').html(result);
}); // end change my_share
});