$(document).ready(function() {
    //Значения переменных по-умолчанию
    // 1. Процент энергии
    var energy = "2%";
    $("#energy_value").val(energy);
    //2. Сумма награды
    var amount = "1.000";
    $("#f_sum_value").val(amount);
    //3. Номер Custom операции
    var custom_sequence = "0";
    $("#custom_sequence_value").val(custom_sequence);

    //4. memo:
    var memo = "Заметка";
    $("#f_memo_value").val(memo);
    //5. Приложение-бенефициар
    var b_app = "denis-skripnik";
    $("#f_b_login").val(b_app);

    generate();
    $('.form_update').change(function() {
        generate();
    });
    $("#sortable").sortable({ change: generate() });
    $("#slider").slider({
        value: energy.replace(/\D+/g,""),
        min: 0,
        max: 105,
        step: 5,
        slide: function( event, ui ) {
            $("#f_procent_value").val($(this).slider( "value" )+"%");
        },
        stop: function( event, ui ) {
            generate();
        }
    });
});

function generate() {

    src_connect = false;
    $("#result form").html("");
    $("#pre_code").html("<div id=\"awards_auth_form\">\r\n<form id=\"auth_form\" action=\"index.html\" method=\"GET\"><p class=\"auth_title\"><strong>Пожалуйста авторизируйтесь</strong></p><input type=\"text\" id=\"this_login\" name=\"viz_login\" placeholder=\"Ваш логин\"><br><input type=\"password\" name=\"posting\" id=\"this_posting\" placeholder=\"Приватный regular ключ\"><br><input type=\"submit\" value=\"Войти\"></form>\r\n</div>");
    $("#pre_code").append("<div id=\"awards_send_form\">\r\n<form id=\"send_awards_form\"></form>\r\n</div>");
    var energy_type;
    //target
    if ($('input[name=target]').is(':checked')) {
        $("#result #awards_send_form form").append($("#target_value").attr("data-title") + "<br><input type=\"text\" name=\"target\" id=\"target\" value=\"" + $("#target_value").val() + "\"><br>");
        $("#pre_code #awards_send_form form").append("\r\n" + $("#target_value").attr("data-title") + "<br>\r\n<input type=\"text\" name=\"target\" id=\"target\" value=\"" + $("#target_value").val() + "\"><br>\r\n");
    } else {
        $("#result #awards_send_form form").append("<input type=\"hidden\" name=\"target\" id=\"target\"  value=\"" + $("#target_value").val() + "\">");
        $("#pre_code #awards_send_form form").append("<input type=\"hidden\" name=\"target\" id=\"target\"  value=\"" + $("#target_value").val() + "\">\r\n");
    }
    //energy
    if ($('input[name=pay_method]:checked').val() == "procent") {
        energy_type = "procent";
        if ($('input[name=energy_view]:checked').val() == "field") {
            $("#result form").append("Процент энергии:<br><input type=\"text\" id=\"temp_energy\" value=\""+ $("#energy_value").val() + "\"><br>");
            $("#result form").append("<input type=\"hidden\" name=\"energy\" id=\"send_energy\" value=\""+ $("#energy_value").val().replace(/[^0-9]/g, '') + "\">");
            $("#result form").append("<script>$(\"#temp_energy\").keyup(function(){100<$(this).val().replace(/[^0-9]/g,\"\")&&($(this).val(\"100%\"),alert(\"Значение не может превышать 100%\")),$(\"#send_energy\").val($(this).val().replace(/[^0-9]/g,\"\"))});");
            $("#pre_code #awards_send_form form").append("Процент энергии:<br><input type=\"text\" id=\"temp_energy\" value=\""+ $("#energy_value").val() + "\"><br>\r\n");
            $("#pre_code #awards_send_form form").append("<input type=\"hidden\" name=\"energy\" id=\"send_energy\" value=\""+ $("#energy_value").val().replace(/[^0-9]/g, '') + "\">\r\n");
        } else if ($('input[name=energy_view]:checked').val() == "slider")  {
            $("#result form").append("Процент энергии:<br><div id=\"slider_energy\"></div>");
            $("#result form").append("<input type=\"text\" id=\"energy_slider_value\"  value=\"" + $("#energy_value").val() + "\"><br>");
            $("#result form").append("<input type=\"hidden\" name=\"energy\" id=\"send_energy\" value=\""+ $("#energy_value").val() + "\">");
            $("#slider_energy").slider({
                value: $("#energy_value").val().replace(/\D+/g,""),
                min: 0,
                max: 101,
                step: 1,
                slide: function( event, ui ) {
                    $("#energy_slider_value").val($(this).slider( "value" )+"%");
                    $("#send_energy").val($(this).slider( "value" ));
                },
                stop: function( event, ui ) {
                    if ($('input[name=energy_notification]').is(':checked') && ($(this).slider( "value" ) > 20)) {
                        alert($("#energy_notification_text").val());
                    }
                }
            });
            if ($('input[name=energy_notification]').is(':checked')) {
                stop_slider = ",stop:function(e,i){20<$(this).slider(\"value\")&&alert('" + $("#energy_notification_text").val() + "')}";
                stop_slider_1 = "if (20<+this.value){alert('" + $("#energy_notification_text").val() + "')}";
            } else {
                stop_slider = "";
                stop_slider_1 = "";
            }
            $("#result form").append("<script>$(\"#energy_slider_value\").keyup(function(){$(this).val().replace(/[^0-9]/g,\"\")<101?$(\"#slider_energy\").slider(\"value\",$(this).val().replace(/[^0-9]/g,\"\")):($(this).val(\"100%\"),alert(\"Значение не может превышать 100%\"))});");

$("#pre_code #awards_send_form form").append("Процент энергии:<br>\r\n");
$("#pre_code #awards_send_form form").append("<input type=\"text\" id=\"energy_slider_value\" value=\"" + $("#energy_value").val() + "\"><br>\r\n");
$("#pre_code #awards_send_form form").append('<input type="range" style="width:100%" name="slider_energy_1" id="slider_energy_1" min="1" max="100" step="1" value="'+$("#energy_value").val().replace(/\D+/g,"")+'"><br>');
$("#pre_code #awards_send_form form").append("<input type=\"hidden\" name=\"energy\" id=\"send_energy\" value=\""+ $("#energy_value").val().replace(/[^0-9]/g, '') + "\">\r\n");
            src_connect = true;

            $("#pre_code").append("\r\n<script>document.getElementById('slider_energy_1').addEventListener('input', function(){document.getElementById('energy_slider_value').value = this.value+'%'; document.getElementById('send_energy').value = this.value;},false);document.getElementById('slider_energy_1').addEventListener('change', function(){"+stop_slider_1+"}, false)");
        }
    } else if ($('input[name=pay_method]:checked').val() == "amount") {
        energy_type = "amount";
        $("#result form").append("Сумма награды:<br><input type=\"text\" name=\"payout\" value=\""+ $("#f_sum_value").val() + "\"><span id=\"max_payout\"></span><br>");
        $("#pre_code #awards_send_form form").append("Сумма награды:<br><input type=\"text\" name=\"payout\" value=\""+ $("#f_sum_value").val() + "\"><span id=\"max_payout\"></span><br>\r\n");
    }
    //custom_sequence
    if ($('input[name=custom_sequence]').is(':checked')) {
        $("#result form").append($("#custom_sequence_value").attr("data-title") + "<br><input type=\"text\" name=\"custom_sequence\" value=\"" + $("#custom_sequence_value").val() + "\"><br>");
        $("#pre_code #awards_send_form form").append($("#custom_sequence_value").attr("data-title") + "<br><input type=\"text\" name=\"custom_sequence\" value=\"" + $("#custom_sequence_value").val() + "\"><br>\r\n");
    }
    else {
        $("#result form").append(/*$("#custom_sequence_value").attr("data-title") + */"<input type=\"hidden\" name=\"custom_sequence\" value=\"" + $("#custom_sequence_value").val() + "\">");
        $("#pre_code #awards_send_form form").append(/*$("#custom_sequence_value").attr("data-title") + */"<input type=\"hidden\" name=\"custom_sequence\" value=\"" + $("#custom_sequence_value").val() + "\">\r\n");
    }
    //memo
    if ($('input[name=f_memo]').is(':checked')) {
        if ($('input[name=note_mode]:checked').val() == "one") {
            $("#result form").append($("#f_memo_value").attr("data-title") + "<br><input type=\"text\" name=\"memo\" value=\"" + $("#f_memo_value").val() + "\"><br>");
            $("#pre_code #awards_send_form form").append($("#f_memo_value").attr("data-title") + "<br><input type=\"text\" name=\"memo\" value=\"" + $("#f_memo_value").val() + "\"><br>\r\n");
        } else {
            $("#result form").append($("#f_memo_value").attr("data-title") + "<br><textarea name=\"memo\" cols=\"22\" rows=4>" + $("#f_memo_value").val() + "</textarea><br>");
            $("#pre_code #awards_send_form form").append($("#f_memo_value").attr("data-title") + "<br><textarea name=\"memo\" cols=\"22\" rows=4>" + $("#f_memo_value").val() + "</textarea><br>\r\n");
        }
    } else {
            $("#result form").append(/*$("#f_memo_value").attr("data-title") + */"<input type=\"hidden\" name=\"memo\" value=\"" + $("#f_memo_value").val() + "\">");
            $("#pre_code #awards_send_form form").append(/*$("#f_memo_value").attr("data-title") + */"<input type=\"hidden\" name=\"memo\" value=\"" + $("#f_memo_value").val() + "\">\r\n");
    }
    //benef_login и benef_procent
    var beneficiaries;
    if ($('input[name=f_b]').is(':checked')) {
        beneficiaries = $("#f_b_login").val() + ":" +  $("#f_b_procent").val();
    }
    //benef_login и benef_procent
    if ($('input[name=f_b_user]').is(':checked')) {
        if ($('input[name=user_procent]:checked').val() == "fix") {
            $("#user_procent_default").css("display","block");
            $("#user_procent_manual").css("display","none");
            if (beneficiaries) {
                beneficiaries += "," + $("#f_b_username").val() + ":" + $("#f_b_procent_value").val();
            } else {
                beneficiaries = $("#f_b_username").val() + ":" + $("#f_b_procent_value").val();
            }
            if ($('input[name=f_b_user]').is(':checked') && (beneficiaries)) {
                $("#result form").append("<input type=\"hidden\" name=\"beneficiaries\" id=\"beneficiaries\" value=\"" + beneficiaries + "\">");
                $("#pre_code #awards_send_form form").append("<input type=\"hidden\" name=\"beneficiaries\" id=\"beneficiaries\" value=\"" + beneficiaries + "\">\r\n");
            }
        } else if ($('input[name=user_procent]:checked').val() == "manual") {
            $("#user_procent_default").css("display","none");
            $("#user_procent_manual").css("display","block");

            if ($('input[name=user_procent_view]:checked').val() == "field") {
                energy_back_max = (parseInt($('#f_b_procent_maxvalue').val()));
                $("#result form").append("Процент возврата пользователю<br><input type=\"text\" name=\"enegry_back\" id=\"enegry_back\" value=\"\" data-max="+(energy_back_max)+"><br>");
                $("#pre_code #awards_send_form form").append("Процент возврата пользователю<br><input type=\"text\" name=\"enegry_back\" id=\"enegry_back\" value=\"\" data-max="+(energy_back_max)+"><br>\r\n");

            } else {
                slider_max = (parseInt($('#f_b_procent_maxvalue').val())+parseInt(1));
                $("#result form").append("<br>Процент возврата пользователю<br><div id=\"enegry_back_slider\"></div><input type=\"text\" id=\"enegry_back\" value=\"1%\"><br>");
                $("#pre_code #awards_send_form form").append("<br>Процент возврата пользователю<br><div id=\"enegry_back_slider\"></div><input type=\"text\" id=\"enegry_back\" value=\"1%\"><br>\r\n");
                $("#pre_code #awards_send_form form").append('<input type="range" style="width:100%" name="enegry_back_slider_1" id="enegry_back_slider_1" min="1" max="'+(slider_max-1)+'" step="1" value="1"><br>\r\n');

                $("#enegry_back_slider").slider({
                    value: 1,
                    min: 0,
                    max: slider_max,
                    step: 1,
                    slide: function( event, ui ) {
                        $("#enegry_back").val($(this).slider( "value" )+"%");
                    },
                    stop: function( event, ui ) {
                        $("#beneficiaries").val($("#temp_beneficiaries").val() + $("#enegry_back").val().replace(/\D+/g,""));
                    }
                });
                console.log(slider_max);
                $("#result form").append("<script>$(\"#enegry_back\").keyup(function(){$(this).val().replace(/[^0-9]/g,\"\")<" + (parseInt($("#f_b_procent_maxvalue").val().replace(/\D+/g,""))+parseInt(1)) +"?$(\"#enegry_back_slider\").slider(\"value\",$(this).val().replace(/[^0-9]/g,\"\")):($(this).val(\"" + parseInt($("#f_b_procent_maxvalue").val().replace(/\D+/g,"")) +"%\"),alert(\"Значение не может превышать " + parseInt($("#f_b_procent_maxvalue").val().replace(/\D+/g,"")) +"%\"))});");
                if (src_connect == false) {
                    // $("#pre_code").append("\r\n<script src=\"https://code.jquery.com/ui/1.12.1/jquery-ui.js\">");
                }
                $("#pre_code").append("\r\n<script>document.getElementById('enegry_back_slider_1').oninput = function(){document.getElementById('enegry_back').value = this.value + '%'; }; document.getElementById('enegry_back_slider_1').onchange = function(){document.getElementById('beneficiaries').value = document.getElementById('temp_beneficiaries').value + document.getElementById('enegry_back').value.replace(/[^0-9]/g, ''); };");
            }
            if (beneficiaries) {
                beneficiaries += "," + $("#f_b_username").val();
            } else {
                beneficiaries = $("#f_b_username").val();
            }
            $("#result form").append("<input type=\"hidden\" id=\"temp_beneficiaries\" value=\"" + beneficiaries + ":" + "\">");
            $("#pre_code #awards_send_form form").append("<input type=\"hidden\" id=\"temp_beneficiaries\" value=\"" + beneficiaries + ":" + "\">\r\n");
            if (beneficiaries) {
                $("#result form").append("<input type=\"hidden\" name=\"beneficiaries\" id=\"beneficiaries\" value=\"" + beneficiaries + ":" + $("#enegry_back").val().replace(/\D+/g,"") + "\">");
                $("#pre_code #awards_send_form form").append("<input type=\"hidden\" name=\"beneficiaries\" id=\"beneficiaries\" value=\"" + beneficiaries + ":" + $("#enegry_back").val().replace(/\D+/g,"") + "\">\r\n");
            }
        }
    } else {
        if (beneficiaries) {
            $("#result form").append("Параметры бенефициарских отчислений<br><input type=\"hidden\" name=\"beneficiaries\" id=\"beneficiaries\" value=\"" + beneficiaries + "\">");
            $("#pre_code #awards_send_form form").append("Параметры бенефициарских отчислений<br><input type=\"hidden\" name=\"beneficiaries\" id=\"beneficiaries\" value=\"" + beneficiaries + "\">\r\n");
        }
    }
    //redirect
    if ($('input[name=url_mode]:checked').val() == "redirect") {
        $("#result form").append("<input type=\"hidden\" name=\"redirect\" id=\"redirect\" value=\"" + $("#f_url_value").val() + "\">");
        $("#pre_code #awards_send_form form").append("<input type=\"hidden\" name=\"redirect\" id=\"redirect\" value=\"" + $("#f_url_value").val() + "\">\r\n");
    }

    $("#result form").append("<input type=\"submit\" value=\"Отправить\">");
    $("#pre_code #awards_send_form form").append("<input type=\"submit\" value=\"Отправить\">\r\n");
    $("#pre_code").append(`
<div id="main_award_info" style="display: none;"><h4>Результат</h4>
<p id="viz_result_short_msg"></p>
<ul id="long_viz_result" style="display:none;"><li>Направление: <span id="viz_award_target"></span></li>
<li>Затрачиваемый процент энергии: <span id="viz_award_energy"></span>%</li>
<li>Примерная награда в соц. капитал: <span id="viz_award_payout"></span></li>
<li>Осталось энергии на момент последней награды: <span id="account_energy"></span></li>
</ul>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/sjcl/1.0.8/sjcl.min.js" type="text/javascript"></script>
<script src="https://cdn.jsdelivr.net/npm/viz-js-lib@latest/dist/viz.min.js" type="text/javascript"></script>
<script src="builder.js"></script>`);
}
//Проверка отображения
$('.pay_method').change(function() {
console.log('test');
    if ($(this).val() == "procent") {
        $("#procent_details").css("display","block");
        $("#amount_details").css("display","none");
    } else {
        $("#procent_details").css("display","none");
        $("#amount_details").css("display","block");
    }
});
$('.note_mode').change(function() {
    if ($(this).val() == "one") {
        $("#note_field").html("<input class=\"form_update\" data-title=\"Заметка (memo)\" type=\"text\" id=\"f_memo_value\" value=\"\">");
    } else {
        $("#note_field").html("<textarea class=\"form_update\" data-title=\"Заметка (memo)\"id=\"f_memo_value\"></textarea>");
    }
});



$('.url_mode').change(function() {
    if ($(this).val() == "redirect") {
        $("#url_redirect").css("display","block");
    } else {
        $("#url_redirect").css("display","none");
    }
});
$('#f_b_procent').change(function() {
    check_100()
});
$('#f_b_procent_value').change(function() {
    check_100()
});
$('#f_b_procent_maxvalue').change(function() {
    check_100()
});



function check_100() {
    console.log("!");
    if (((parseInt($('#f_b_procent').val().replace(/\D+/g,"")) + parseInt($('#f_b_procent_value').val().replace(/\D+/g,""))) > 100) || ((parseInt($('#f_b_procent').val().replace(/\D+/g,"")) + parseInt($('#f_b_procent_maxvalue').val().replace(/\D+/g,""))) > 100)) {
        alert("Сумма процентов отчисления не может превышать 100%!");
    }
}

function get_code() {
    generate();
    $("#head_code").val("<script>var target_user = \""+ $("#target_value").val()+ "\"<\/script>");
    $("#final_code").val($("#pre_code").html());
}


$("#energy_slider_value").keyup(function() {
    if ($(this).val().replace(/[^0-9]/g, '') < 101) {
        $("#slider_energy").slider("value", $(this).val().replace(/[^0-9]/g, ''));
    } else {
        $(this).val("100%");
        alert("Значение не может превышать 100%")
    }
});
$("#enegry_back").keyup(function() {
    if ($(this).val().replace(/[^0-9]/g, '') < 101) {
        $("#enegry_back_slider").slider("value", $(this).val().replace(/[^0-9]/g, ''));
    } else {
        $(this).val("100%");
        alert("Значение не может превышать 100%")
    }
});
$("#temp_energy").keyup(function() {
    if ($(this).val().replace(/[^0-9]/g, '') > 100) {
        $(this).val("100%");
        alert("Значение не может превышать 100%");
    }
    $("#temp_energy").val($(this).val());
});