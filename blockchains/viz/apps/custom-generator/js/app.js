    var generatedObject = {};
    !function($){
    $(document).ready(function(){
        var html = getForm(getExampleObj());
        $('.cj_container').empty().html(html);
        $('form, fieldset').sortable();
        setEvents();
        function setEvents(){
            // сохранение значения "form-id"
            !function(){
                if (localStorage.getItem('builder_form_id') === null) {
                    localStorage.setItem('builder_form_id', '');
                }
                $('#form-id').val(localStorage.getItem('builder_form_id'));
                $('#form-id').on('keyup', function(e){
                    localStorage.setItem('builder_form_id', e.target.value);
                });
            }();
            $(".cj_container").on('click', '.gen-delete', function(){
                $(this).closest('p').remove();
            });
            $(".cj_container").on('click', '.gen-level-delete', function(){
                $(this).closest('fieldset').remove();
                // $(this).closest('fieldset').remove();
            });
            $(".modal-wrapper").on('click', '.modal-overlay, .modal-cancel', function(e){
                e.preventDefault();
                $(this).closest('.modal-visible').removeClass('modal-visible');
                $('#cj_main').css('overflow', 'initial')
            });
            // кнопки создания и удаления полей и уровней
            var $parent = null;
            $(document).on('click', '.gen-edit', function(e){
                e.preventDefault();
                $('.modal-field').addClass('modal-visible').find('input:first').focus();
                $('#cj_main').css('overflow', 'hidden')
                $parent = $(this).closest('p');
                info = readNodes([$parent[0]])[0];
                modalSetDefaults('.modal-field', info, 'edit');
            });
            $(document).on('click', '.gen-newfield', function(e){
                e.preventDefault();
                $('.modal-field').addClass('modal-visible').find('input:first').focus();
                $('#cj_main').css('overflow', 'hidden');
                var $this = $(this);

                if ($this.is('.newfield-outer')) {
                    $parent = $this.closest('fieldset');
                } else {
                    $parent = $this.closest('p');
                }

                modalSetDefaults('.modal-field');
            });
            $(document).on('click', '.gen-newarray', function(e){
                e.preventDefault();
                $('.modal-array').addClass('modal-visible').find('input:first').focus();
                $('#cj_main').css('overflow', 'hidden');
                var $this = $(this);

                if ($this.is('.newfield-outer')) {
                    $parent = $this.closest('fieldset');
                } else {
                    $parent = $this.closest('p');
                }

                modalSetDefaults('.modal-array');
            });
            $(document).on('click', '.gen-newvalue', function(e){
                e.preventDefault();
                $('.modal-array-value').addClass('modal-visible').find('input:first').focus();
                $('#cj_main').css('overflow', 'hidden');
                var $this = $(this);
                $parent = $this.closest('p');
                modalSetDefaults('.modal-array-value');
            });
            $(document).on('click', '.gen-level-edit', function(e){
                e.preventDefault();
                $('.modal-level').addClass('modal-visible').find('input:first').focus();
                $('#cj_main').css('overflow', 'hidden');
                $parent = $(this).closest('fieldset');
                info = readNodes([$parent[0]])[0];
                modalSetDefaults('.modal-level', info, 'edit');
            });
            $(document).on('click', '.gen-array-edit', function(e){
                e.preventDefault();
                $('.modal-array').addClass('modal-visible').find('input:first').focus();
                $('#cj_main').css('overflow', 'hidden');
                $parent = $(this).closest('fieldset');
                info = readNodes([$parent[0]])[0];
                modalSetDefaults('.modal-array', info, 'edit');
            });
            $(document).on('click', '.gen-newlevel', function(e){
                e.preventDefault();
                $('.modal-level').addClass('modal-visible').find('input:first').focus();
                $('#cj_main').css('overflow', 'hidden')
                if ($(this).is('.newlevel-outer')){
                    $parent = $(this).closest('fieldset');
                } else {
                    $parent = $(this).closest('p');
                }
                modalSetDefaults('.modal-level');
            });
            $(".modal-wrapper").on('submit', 'form', function(e){
                e.preventDefault();
            });
            $(".modal-wrapper").on('click', '.level.edit', function(e){
                var $this = $(this);
                var $form = $(this).closest('form');
                var form = $form[0];

                var oldName = $parent.attr('data-name');
                var newName = form.name.value;

                $parent.find('.gen-controls').remove();

                // замена имен в цепочке вложенности
                var level = $parent.parents('fieldset').length;
                $($parent.find('[name*="'+oldName+'"]').get().reverse()).each(function(){
                    var $this = $(this);
                    if (level === 0) {
                        $this.attr( 'name', $this.attr('name').replace(oldName, newName) )
                    } else {
                        $this.attr(  'name', $this.attr('name').replace('['+oldName+']', '['+newName+']')  )
                    }
                });

                $parent.replaceWith(
                    getFormParts(
                        [
                            {
                                type: 'level',
                                label: form.label.value,
                                name: newName,
                                values: readNodes($parent.find('>p,>fieldset').toArray())
                            },
                        ]
                    )
                );
                $('.modal-visible').removeClass('modal-visible');
                $('#cj_main').css('overflow', 'initial')
            });
            $(".modal-wrapper").on('click', '.level.add', function(e){
                var $this = $(this);
                var $form = $(this).closest('form');
                var form = $form[0];

                var oldName = $parent.attr('data-name');

                var label = form.label.value
                var name = form.name.value

                if (!name) {
                    return;
                }

                $parent.after(
                    getFieldsetStart({
                        type: 'level',
                        label: label,
                        name: name,
                    }) + getFieldsetEnd()
                );
                $('.modal-visible').removeClass('modal-visible');
                $('#cj_main').css('overflow', 'initial')
            });
            $(".modal-wrapper").on('click', '.field.edit', function(e){
                var $this = $(this);
                var $form = $(this).closest('form');
                var form = $form[0];

                var label = form.label.value;
                var isTextarea = form.istextarea.value === "1" ? true : false;
                var name = form.name.value;
                var defaultValue = form.defaultvalue.value;

                if (!name) {
                    return;
                }

                $parent.replaceWith(
                    getField({
                        type: 'field',
                        label: label,
                        isTextarea: isTextarea,
                        name: name,
                        defaultValue: defaultValue,
                    })
                );
                $('.modal-visible').removeClass('modal-visible');
                $('#cj_main').css('overflow', 'initial')
            });
            $(".modal-wrapper").on('click', '.field.add', function(e){
                var $this = $(this);
                var $form = $(this).closest('form');
                var form = $form[0];

                if (!form.name.value) {
                    return;
                }

                var label = form.label.value;
                var isTextarea = form.istextarea.value === "1" ? true : false;
                var defaultValue = form.defaultvalue.value;
                var namechain = $parent.parents('fieldset').toArray().reverse().map(function(val){
                    return val.dataset.name;
                });
                namechain.push(form.name.value);
                namechain = namechain.map(function(val, ind){
                    if (ind) {
                        return '[' + val + ']';
                    }
                    return val;
                }).join('');

                $parent.after(
                    getField({
                        type: 'field',
                        label: label,
                        isTextarea: isTextarea,
                        name: namechain,
                        defaultValue: defaultValue,
                    })
                );
                $('.modal-visible').removeClass('modal-visible');
                $('#cj_main').css('overflow', 'initial')
            });
            // тут еще ничего не менял:
            $(".modal-wrapper").on('click', '.array.edit', function(e){
                var $this = $(this);
                var $form = $(this).closest('form');
                var form = $form[0];

                var label = form.label.value;
                var name = form.name.value;

                if (!name) {
                    return;
                }


                var oldName = $parent.attr('data-name');
                var newName = name;
                var level = $parent.parents('fieldset').length;

                $($parent.find('[name*="'+oldName+'"]').get()).each(function(){
                    var $this = $(this);
                    if (level === 0) {
                        $this.attr( 'name', $this.attr('name').replace(oldName, newName) )
                    } else {
                        $this.attr(  'name', $this.attr('name').replace('['+oldName+']', '['+newName+']')  )
                    }
                });

                $parent.replaceWith(
                    getArrayStart({
                        type: 'array',
                        name: name,
                        label: label,
                        values: $parent.find('.arrayValueWrapper input').toArray().map(function(item){
                            return {
                                type: 'array-value',
                                namechain: item.name,
                                value: item.value,
                            };
                        })
                    }) + getArrayEnd()
                );

                $('.modal-visible').removeClass('modal-visible');
                $('#cj_main').css('overflow', 'initial')
            });
            $(".modal-wrapper").on('click', '.array.add', function(e){
                var $this = $(this);
                var $form = $(this).closest('form');
                var form = $form[0];

                var oldName = $parent.attr('data-name');

                var label = form.label.value
                var name = form.name.value

                if (!name) {
                    return;
                }

                $parent.after(
                    getArrayStart({
                        type: 'array',
                        label: label,
                        name: name,
                        values: [],
                    }) + getArrayEnd()
                );
                $('.modal-visible').removeClass('modal-visible');
                $('#cj_main').css('overflow', 'initial')
            });
            $(".modal-wrapper").on('click', '.array-value.add', function(e){
                var $this = $(this);
                var $form = $(this).closest('form');
                var form = $form[0];

                var oldName = $parent.attr('data-name');

                var value = form.value.value

                if (!value) {
                    return;
                }

                var namechain = $parent.parents('fieldset').toArray().reverse().map(function(val){
                    return val.dataset.name;
                });
                namechain.push('');
                namechain = namechain.map(function(val, ind){
                    if (ind) {
                        return '[' + val + ']';
                    }
                    return val;
                }).join('');

                $parent.after(
                    getArrayValue({
                        type: 'array-value',
                        value: value,
                        namechain: namechain,
                    })
                );
                $('.modal-visible').removeClass('modal-visible');
                $('#cj_main').css('overflow', 'initial')
            });
            // получить итоговую форму
            $('.get-resultForm').click(function(){
                if (!$('#form-id').val()) {
                    alert('Введите id формы');
                    return;
                }
                var operation = '';
                if (!$('#form-operation').val()) {
                    alert('Введите название операции');
                    return;
                } else {
                    operation = $('#form-operation').val();
                }
                var $clearNewCloneOfForm = $('#js-form').clone().find('.gen-controls').remove().end();
                var object = readForm($clearNewCloneOfForm);
                var result = generateResultForm(object, operation);
                $('.modal-getResultHTML').addClass('modal-visible')
                $('#cj_main').css('overflow', 'hidden')
                $("[name='ta-get-form']").val('').val(result).focus();
            });
            $('.get-JSON').click(function(){
                var $clearNewCloneOfForm = $('#js-form').clone().find('.gen-controls').remove().end();
                var json = JSON.stringify(readForm($clearNewCloneOfForm));
                $('.modal-getJSON').addClass('modal-visible')
                $('#cj_main').css('overflow', 'hidden')
                $("[name='ta-get-json']").val('').val(json).focus();
            });
            $('.set-JSON').click(function(){
                $('.modal-setJSON').addClass('modal-visible')
                $('#cj_main').css('overflow', 'hidden')
                $('[name="ta-set-json"]').focus();
            });
            $('.get-demo').click(function(){
                if (!$('#form-id').val()) {
                    alert('Введите id формы');
                    return;
                }
                let operation = '';
                if (!$('#form-operation').val()) {
                    alert('Введите название операции');
                    return;
                } else {
                    operation = $('#form-operation').val();
                }
                $('.modal-getDemo').addClass('modal-visible')
                $('#cj_main').css('overflow', 'hidden')
                var $clearNewCloneOfForm = $('#js-form').clone().find('.gen-controls').remove().end();
                var object = readForm($clearNewCloneOfForm);
                var result = generateResultForm(object, operation);
                var formId = $('.result-demo').empty().html(result).find('form').attr('id');
            });
            $('.ta-set-json-ready').click(function(e){
                e.preventDefault();
                try {
                    var json = JSON.parse($("[name='ta-set-json']").val());
                } catch (e) {
                    alert('Невалидный JSON');
                    return;
                }
                $('.modal-setJSON').removeClass('modal-visible');
                $('#cj_main').css('overflow', 'initial')
                var html = getForm(json);
                $('.cj_container').empty().html(html);
            });
        }
        function modalSetDefaults(modal, info, edit){
            info = info || {};
            var $form = $(modal).find('form');
            var form = $form[0];
            form.label && (form.label.value = info.label || '');
            form.name && (form.name.value = info.name || '');
            form.defaultvalue && (form.defaultvalue.value = info.defaultValue || '');
            form.value && (form.value.value = info.value || '');
            form.istextarea && (form.istextarea.value = info.isTextarea ? 1 : 0);
            var $button = $form.find('.modal-ready');

            // расстановка классов для кнопки внутри модалки
            if (edit) {
                $button.addClass('edit').removeClass('add')
            } else {
                $button.addClass('add').removeClass('edit')
            }

            if (~modal.search('field')) {
                $button.addClass('field').removeClass('level').removeClass('array').removeClass('array-value')
            }
            else if (~modal.search('level')) {
                $button.addClass('level').removeClass('field').removeClass('array').removeClass('array-value')
            }
            // не менять местами условия array-value и array, иначе потом хрен найдешь ошибку
            else if (~modal.search('array-value')) {
                $button.addClass('array-value').removeClass('array').removeClass('field').removeClass('level')
            }
            else if (~modal.search('array')) {
                $button.addClass('array').removeClass('field').removeClass('level').removeClass('array-value')
            }
        }
        function postHandle(){
        }
        function readNodes(nodes){
            return nodes.map(function(current){
                var $this = $(current);
                if ($this.is('p')) {
                    return {
                        type: 'field',
                        label: $this.find('span').text().trim(),
                        name: $this.find('[name]').attr('name'),
                        isTextarea: $this.find('[name]').is('textarea'),
                        defaultValue: $this.find('[name]').val(),
                    };
                }
                else if ($this.is('[data-type="array"]')) {
                    return {
                        type: 'array',
                        label: $this.find('span').text().trim(),
                        name: $this.attr('data-name'),
                        values: $this.find('.arrayValueWrapper input').toArray().map(function(item){
                            return {
                                type: 'array-value',
                                namechain: item.name,
                                value: item.value,
                            };
                        })
                    };
                }
                else {
                    return {
                        type: 'level',
                        name: $this.attr('data-name'),
                        label: $this.find('legend:first').find('span').text().trim(),
                        values: readNodes($this.find('>p,>fieldset').toArray())
                    }
                }
            })
        }
        function readForm($parent){
            return readNodes($parent.find('>p,>fieldset').toArray());
        }
        function getForm(arr){
            var html = '';
            html += '<form id="js-form" class="ui-sortable">';
            html += '<p class="gen-controls"><a href="#" class="gen-newfield">новое поле</a>, <a href="#" class="gen-newlevel">новый уровень</a>, <a href="#" class="gen-newarray">новый массив</a> <br></p>';
            html += getFormParts(arr);
            html += '</form>';
            return html;
        }
        function getFormParts(arr) {

            return arr.map(function(item) {
                if (item.type == 'field') {
                    return getField(item);
                }
                else if (item.type == 'array') {
                    return getArrayStart(item) + getArrayEnd();
                }
                else if (item.type == 'level') {
                    return getFieldsetStart(item) + getFormParts(item.values) + getFieldsetEnd();
                }
            }).join('\n');
        }
        function getField(obj){
            var result = '' +
            '<p class="ui-sortable-handle">'+
                '<label>'+
                    '<span>'+obj.label+'</span>: '+
                    '<a href="#" class="gen-edit">редактировать</a>, <a href="#" class="gen-delete">удалить</a>'+
                    '<br><br>';
                    if (obj.isTextarea) {
                        result += '' +
                        '<textarea name="'+obj.name+'" cols="30" rows="3">'+obj.defaultValue+'</textarea> <br>';
                    } else {
                        result += '' +
                        '<input type="text" name="'+obj.name+'" value="'+obj.defaultValue+'"> <br>';
                    }
                    result += '' +
                    '<a href="#" class="gen-newfield">новое поле</a>, <a href="#" class="gen-newlevel">новый уровень</a>, <a href="#" class="gen-newarray">новый массив</a> <br>'+
                '</label>'+
            '</p>';
            return result;
        }
        function getFieldsetStart(obj) {
            return ''+
            '<fieldset data-name="'+obj.name+'">' +
                '<legend><span>'+obj.label+'</span> <a href="#" class="gen-level-delete">удалить</a>, <a href="#" class="gen-level-edit">редактировать</a> </legend>'+
                '<p class="gen-controls"><a href="#" class="gen-newfield">новое поле</a>, <a href="#" class="gen-newlevel">новый уровень</a>, <a href="#" class="gen-newarray">новый массив</a> <br></p>';
        }
        function getFieldsetEnd(){
            return ''+
            '<p class="gen-controls"><a href="#" class="gen-newfield newfield-outer">новое поле снаружи</a>, <a href="#" class="gen-newlevel newlevel-outer">новый уровень снаружи</a> <br></p>'+
            '</fieldset>';
        }
        function getArrayStart(obj) {
            return ''+
            '<fieldset data-name="'+obj.name+'" data-type="array">' +
                '<legend>Массив значений <span>'+obj.label+'</span> <a href="#" class="gen-level-delete">удалить</a>, <a href="#" class="gen-array-edit">редактировать</a> </legend>' +
                '<p class="gen-controls"><a href="#" class="gen-newvalue">новое значение</a><br></p>' +
                obj.values.map(function(i) {
                    return getArrayValue(i);
                }).join('');
        }
        function getArrayEnd(){
            return ''+
            '<p class="gen-controls"><a href="#" class="gen-newfield newfield-outer">новое поле снаружи</a>, <a href="#" class="gen-newlevel newlevel-outer">новый уровень снаружи</a>, <a href="#" class="gen-newarray newarray-outer">новый массив снаружи</a> <br></p>'+
            '</fieldset>';
        }
        function getArrayValue(obj){
            var result = '' +
            '<p class="ui-sortable-handle arrayValueWrapper">'+
                '<input type="text" name="'+obj.namechain+'" value="'+obj.value+'">' +
                ' <a href="#" class="gen-delete">удалить</a>'+
                '<br>'+
                '<a href="#" class="gen-newvalue">новое значение</a>'
            '</p>';
            return result;
        }
        function getExampleObj(){
            return [{"type":"level","name":"a","label":"a","values":[{"type":"level","name":"b","label":"b","values":[{"type":"array","label":"c","name":"c","values":[{"type":"array-value","namechain":"a[b][c][]","value":"1"},{"type":"array-value","namechain":"a[b][c][]","value":"2"}]}]}]}];
        }
        function getExampleObj2(){
            return JSON.parse('[{"type":"field","label":"asdf","name":"field","isTextarea":false,"defaultValue":"value"},{"type":"level","name":"level1","label":"level1","values":[{"type":"field","label":"inner1","name":"level1[inner1]","isTextarea":false,"defaultValue":""},{"type":"level","name":"level2edited","label":"level2edited","values":[{"type":"field","label":"inner2","name":"level1[level2edited][inner2edited]","isTextarea":false,"defaultValue":"inner2"}]}]}]');
        }
        function randomInteger(min, max) {
            return min + Math.floor(Math.random() * (max + 1 - min));
        }
        function checkLogin(formId){
            if (localStorage.getItem('viz_login') && localStorage.getItem('vizPostingKey')) {
                viz_login = localStorage.getItem('viz_login');
                posting_key = sjcl.decrypt(viz_login + '_postingKey', localStorage.getItem('vizPostingKey'));
                if ($("#temp_beneficiaries").length > 0) {
                    $("#temp_beneficiaries").val($("#temp_beneficiaries").val().replace('user_login', viz_login));
                }
                if ($("#beneficiaries").length > 0) {
                    $("#beneficiaries").val($("#beneficiaries").val().replace('user_login', viz_login));
                }
            } else if (sessionStorage.getItem('viz_login') && sessionStorage.getItem('vizPostingKey')) {
                viz_login = sessionStorage.getItem('viz_login');
                posting_key = sjcl.decrypt(viz_login + '_postingKey', sessionStorage.getItem('vizPostingKey'));
                if ($("#temp_beneficiaries").length > 0) {
                    $("#temp_beneficiaries").val($("#temp_beneficiaries").val().replace('user_login', viz_login));
                }
                if ($("#beneficiaries").length > 0) {
                    $("#beneficiaries").val($("#beneficiaries").val().replace('user_login', viz_login));
                }
            } else {
                $("#"+formId).css("display","none");
                if ($("#sortable").length > 0) {
                } else {
                    $("#"+formId).after("<form id=\"auth_form\" action=\"index.html\" method=\"GET\"><p class=\"auth_title\"><strong>Пожалуйста авторизируйтесь</strong></p><input type=\"text\" id=\"this_login\" name=\"viz_login\" placeholder=\"Ваш логин\"><br><input type=\"password\" name=\"posting\" id=\"this_posting\" placeholder=\"Приватный regular (регулярный) ключ\"><br><input type=\"submit\" value=\"Войти\"></form>");
                    $("#auth_form").submit(function(e){
                        e.preventDefault();
                        AuthForm(formId);
                    });
                }
            }
        }
        async function AuthForm(formId) {
            let login = document.getElementById('this_login').value;
            let posting = document.getElementById('this_posting').value;

            if (localStorage.getItem('vizPostingKey')) {
                var isPostingKey = sjcl.decrypt(login + '_postingKey', localStorage.getItem('vizPostingKey'));
            } else if (sessionStorage.getItem('vizPostingKey')) {
                var isPostingKey = sjcl.decrypt(login + '_postingKey', sessionStorage.getItem('vizPostingKey'));
            } else {
                var isPostingKey = posting;
            }

            var resultIsPostingWif = viz.auth.isWif(isPostingKey);
            if (resultIsPostingWif === true) {
                const account_approve = await viz.api.getAccountsAsync([login]);
                const public_wif = viz.auth.wifToPublic(isPostingKey);
                let posting_public_keys = [];
                if (account_approve.length > 0) {
                    for (key of account_approve[0].regular_authority.key_auths) {
                        posting_public_keys.push(key[0]);
                    }
                } else {
                    window.alert('Вероятно, аккаунт не существует. Просьба проверить введённый логин.');
                }
                if (posting_public_keys.includes(public_wif)) {
                    localStorage.setItem('viz_login', login);
                    localStorage.setItem('vizPostingKey', sjcl.encrypt(login + '_postingKey', posting));
                    sessionStorage.setItem('viz_login', login);
                    sessionStorage.setItem('vizPostingKey', sjcl.encrypt(login + '_postingKey', posting));

                    viz_login = login;
                    posting_key = isPostingKey;
                } else if (account_approve.length === 0) {
                    window.alert('Аккаунт не существует. Пожалуйста, проверьте его');
                } else {
                    window.alert('Regular ключ не соответствует пренадлежащему аккаунту.');
                }
            } else {
                window.alert('Regular ключ имеет неверный формат. Пожалуйста, попробуйте ещё раз.');
            }
            if (!viz_login && !posting_key) {
                alert("Не удалось авторизироваться с текущей парой логин/ключ");
            } else {
                document.getElementById(formId) && (document.getElementById(formId).style.display = "block");
                document.getElementById("auth_form").remove();
            }
        }
        function generateResultFormParts(arr){
            return arr.map(function(obj){
                if (obj.type=='field') {
                    return generateResultFormField(obj)
                }
                if (obj.type=='array') {
                    return generateResultFormArray(obj)
                }
                if (obj.type=='level') {
                    return generateResultFormLevelStart(obj) + generateResultFormParts(obj.values) + generateResultFormLevelEnd();
                }
            }).join('\n');
        }
        function generateResultFormField(obj){
            result = '' +
            '<p>\n' +
                '<label>\n' +
                    obj.label + '<br>\n';
                    if (obj.isTextarea) {
                        result += '' +
                        '<textarea name="'+obj.name+'" cols="30" rows="3">'+obj.defaultValue+'</textarea> <br>\n';
                    } else {
                        result += '' +
                        '<input type="text" name="'+obj.name+'" value="'+obj.defaultValue+'"> <br>\n';
                    }
                    result += '' +
                '</label>\n'+
            '</p>\n';
            return result;
        }
        function generateResultFormArray(obj){
            result = '';
            for (key in obj.values) {
                var currentObj = obj.values[key];
                result += '' +
                '<input type="hidden" name="'+currentObj.namechain+'" value="'+currentObj.value+'">\n';
            }
            return result;
        }
        function generateResultFormLevelStart(obj){
            return ''+
            '<fieldset>\n' +
                '<legend>'+obj.label+'</legend>\n';
        }
        function generateResultFormLevelEnd(){
            return ''+
            '</fieldset>\n';
        }
        function generateResultForm(arr, op){
            var id = localStorage.getItem('builder_form_id');
            var vizScript = document.createElement('script');
            vizScript.setAttribute("src", 'https://cdn.jsdelivr.net/npm/viz-js-lib@latest/dist/viz.min.js');
            var sjclScript = document.createElement('script');
            sjclScript.setAttribute("src", 'https://cdnjs.cloudflare.com/ajax/libs/sjcl/1.0.8/sjcl.min.js');
            // var serializeScript = document.createElement('script');
            // serializeScript.setAttribute("src", 'https://cdn.jsdelivr.net/npm/serialize-js@1.1.0/index.min.js');
            var eventScript = document.createElement('script');
            eventScript.innerHTML = '!'+window.generatedFormScript.toString()+'()';
            // window.generatedFormScript = null;

            return ''+
            sjclScript.outerHTML+'\n'+
            vizScript.outerHTML+'\n'+
            // serializeScript.outerHTML+'\n'+
            '<form id="'+id+'" class="generated-form">' + '\n' +
            generateResultFormParts(arr) + '\n' +
            '<input type="hidden" name="viz_json_operation_name" id="viz_json_operation_name" value="' + op + '">' + '\n' +
            '<p><button>Отправить</button></p>' + '\n' +
            '</form>' + '\n' +
            eventScript.outerHTML.split('<br>').join('\n');
        }
        window.generatedFormScript=function(){function e(e){if(localStorage.getItem("viz_login")&&localStorage.getItem("vizPostingKey"))viz_login=localStorage.getItem("viz_login"),posting_key=sjcl.decrypt(viz_login+"_postingKey",localStorage.getItem("vizPostingKey"));else if(sessionStorage.getItem("viz_login")&&sessionStorage.getItem("vizPostingKey"))viz_login=sessionStorage.getItem("viz_login"),posting_key=sjcl.decrypt(viz_login+"_postingKey",sessionStorage.getItem("vizPostingKey"));else{document.getElementById(e)&&(document.getElementById(e).style.display="none");var t=document.createElement("div");t.innerHTML='<form id="auth_form" action="index.html" method="GET"><p class="auth_title"><strong>Пожалуйста авторизируйтесь</strong></p><p><input type="text" id="this_login" name="viz_login" placeholder="Ваш логин"></p><p><input type="password" name="posting" id="this_posting" placeholder="Приватный regular (регулярный) ключ"></p><p><input type="submit" value="Войти"></p></form>',document.getElementById(e).parentNode.insertAdjacentElement("beforeend",t),document.getElementById("auth_form").onsubmit=function(t){t.preventDefault(),async function(e){let t=document.getElementById("this_login").value,o=document.getElementById("this_posting").value;if(localStorage.getItem("vizPostingKey"))var n=sjcl.decrypt(t+"_postingKey",localStorage.getItem("vizPostingKey"));else if(sessionStorage.getItem("vizPostingKey"))var n=sjcl.decrypt(t+"_postingKey",sessionStorage.getItem("vizPostingKey"));else var n=o;if(!0===viz.auth.isWif(n)){const e=await viz.api.getAccountsAsync([t]),s=viz.auth.wifToPublic(n);let i=[];if(e.length>0)for(key of e[0].regular_authority.key_auths)i.push(key[0]);else window.alert("Вероятно, аккаунт не существует. Просьба проверить введённый логин.");i.includes(s)?(localStorage.setItem("viz_login",t),localStorage.setItem("vizPostingKey",sjcl.encrypt(t+"_postingKey",o)),sessionStorage.setItem("viz_login",t),sessionStorage.setItem("vizPostingKey",sjcl.encrypt(t+"_postingKey",o)),viz_login=t,posting_key=n):0===e.length?window.alert("Аккаунт не существует. Пожалуйста, проверьте его"):window.alert("regular ключ не соответствует пренадлежащему аккаунту.")}else window.alert("Regular ключ имеет неверный формат. Пожалуйста, попробуйте ещё раз.");viz_login||posting_key?(document.getElementById(e)&&(document.getElementById(e).style.display="block"),document.getElementById("auth_form").remove()):alert("Не удалось авторизироваться с текущей парой логин/ключ")}(e)}}}var t=document.querySelector(".generated-form").id;document.querySelector(".generated-form").querySelector("button").disabled=!0;setTimeout(function o(){window.hasOwnProperty("viz")?(console.log("done"),function(){const e=["wss://viz.lexai.host/ws","wss://solox.world/ws"];let t=localStorage.getItem("viz_node")||e[0];const o=Math.max(e.indexOf(t),0),n=o=>{o>=e.length&&(o=0),0>=e.length?alert("no working nodes found"):(t=e[o],viz.config.set("websocket",t),viz.api.getDynamicGlobalPropertiesAsync().then(e=>{console.log("found working node",t),localStorage.setItem("viz_node",t)}).catch(e=>{console.log("connection error",t,e),n(o+1)}))};n(o)}(),e(t),document.querySelector(".generated-form").querySelector("button").disabled=!1):(console.log("wait"),setTimeout(o,50))},0);document.querySelector(".generated-form").onsubmit=function(e){e.preventDefault(),this.querySelector("button").disabled=!0;var t=new XMLHttpRequest;t.open("POST","https://dpos.space/blockchains/viz/apps/custom-generator/json_encode.php"),t.setRequestHeader("Content-Type","application/x-www-form-urlencoded"),t.onload=function(){200===t.status?(console.log(t.responseText),toArr=JSON.parse(t.responseText),result_json=JSON.stringify([document.querySelector(`#viz_json_operation_name`).value,toArr]),viz.broadcast.custom(posting_key,[],[viz_login],document.querySelector(".generated-form").id,result_json,function(e,t){e?alert("Ошибка: "+e):(alert("Ок. custom отправлен"),console.log(t)),document.querySelector(".generated-form").querySelector("button").disabled=!1})):alert("Request failed.  Returned status of "+t.status)},t.send(function(e){for(var t=[],o=0;o<e.elements.length;o++){var n=e.elements[o];if(n.name&&!n.disabled&&"file"!==n.type&&"reset"!==n.type&&"submit"!==n.type&&"button"!==n.type)if("select-multiple"===n.type)for(var s=0;s<n.options.length;s++)n.options[s].selected&&t.push(encodeURIComponent(n.name)+"="+encodeURIComponent(n.options[s].value));else("checkbox"!==n.type&&"radio"!==n.type||n.checked)&&t.push(encodeURIComponent(n.name)+"="+encodeURIComponent(n.value))}return t.join("&")}(document.querySelector(".generated-form")))}};
        /*
        window.generatedFormScript = function(){
            function serialize(e) {
                for (var n = [], t = 0; t < e.elements.length; t++) {
                    var o = e.elements[t];
                    if (o.name && !o.disabled && "file" !== o.type && "reset" !== o.type && "submit" !== o.type && "button" !== o.type)
                        if ("select-multiple" === o.type)
                            for (var p = 0; p < o.options.length; p++) o.options[p].selected && n.push(encodeURIComponent(o.name) + "=" + encodeURIComponent(o.options[p].value));
                        else("checkbox" !== o.type && "radio" !== o.type || o.checked) && n.push(encodeURIComponent(o.name) + "=" + encodeURIComponent(o.value))
                }
                return n.join("&")
            }

            function checkLogin(formId){
                if (localStorage.getItem('viz_login') && localStorage.getItem('vizPostingKey')) {
                    viz_login = localStorage.getItem('vizlogin');
                    posting_key = sjcl.decrypt(viz_login + '_postingKey', localStorage.getItem('vizPostingKey'));
                } else if (sessionStorage.getItem('viz_login') && sessionStorage.getItem('vizPostingKey')) {
                    viz_login = sessionStorage.getItem('viz_login');
                    posting_key = sjcl.decrypt(viz_login + '_postingKey', sessionStorage.getItem('vizPostingKey'));
                } else {
                    document.getElementById(formId) && (document.getElementById(formId).style.display = "none");
                        var authform = document.createElement('div');
                        authform.innerHTML = '<form id="auth_form" action="index.html" method="GET">'+
                        '<p class="auth_title"><strong>Пожалуйста авторизируйтесь</strong></p>'+
                        '<p><input type="text" id="this_login" name="viz_login" placeholder="Ваш логин"></p>'+
                        '<p><input type="password" name="posting" id="this_posting" placeholder="Приватный regular (регулярный) ключ"></p>'+
                        '<p><input type="submit" value="Войти"></p>'+
                        '</form>';
                        document.getElementById(formId).parentNode.insertAdjacentElement('beforeend', authform);
                        document.getElementById("auth_form").onsubmit = function(e){
                            e.preventDefault();
                            AuthForm(formId);
                        }
                }
            }
            async function AuthForm(formId) {
                let login = document.getElementById('this_login').value;
                let posting = document.getElementById('this_posting').value;

                if (localStorage.getItem('vizPostingKey')) {
                    var isPostingKey = sjcl.decrypt(login + '_postingKey', localStorage.getItem('vizPostingKey'));
                } else if (sessionStorage.getItem('vizPostingKey')) {
                    var isPostingKey = sjcl.decrypt(login + '_postingKey', sessionStorage.getItem('vizPostingKey'));
                } else {
                    var isPostingKey = posting;
                }

                var resultIsPostingWif = viz.auth.isWif(isPostingKey);
                if (resultIsPostingWif === true) {
                    const account_approve = await viz.api.getAccountsAsync([login]);
                    const public_wif = viz.auth.wifToPublic(isPostingKey);
                    let posting_public_keys = [];
                    if (account_approve.length > 0) {
                        for (key of account_approve[0].regular_authority.key_auths) {
                            posting_public_keys.push(key[0]);
                        }
                    } else {
                        window.alert('Вероятно, аккаунт не существует. Просьба проверить введённый логин.');
                    }
                    if (posting_public_keys.includes(public_wif)) {
                        localStorage.setItem('viz_login', login);
                        localStorage.setItem('vizPostingKey', sjcl.encrypt(login + '_postingKey', posting));
                        sessionStorage.setItem('viz_login', login);
                        sessionStorage.setItem('vizPostingKey', sjcl.encrypt(login + '_postingKey', posting));

                        viz_login = login;
                        posting_key = isPostingKey;
                    } else if (account_approve.length === 0) {
                        window.alert('Аккаунт не существует. Пожалуйста, проверьте его');
                    } else {
                        window.alert('Regular ключ не соответствует пренадлежащему аккаунту.');
                    }
                } else {
                    window.alert('Regular ключ имеет неверный формат. Пожалуйста, попробуйте ещё раз.');
                }
                if (!viz_login && !posting_key) {
                    alert("Не удалось авторизироваться с текущей парой логин/ключ");
                } else {
                    document.getElementById(formId) && (document.getElementById(formId).style.display = "block");
                    document.getElementById("auth_form").remove();
                }
            }
            var formId = document.querySelector('.generated-form').id;
            var timeoutR = setTimeout(function checkViz(){
                if (window.hasOwnProperty('viz')) {
                    console.log('done');
                    checkLogin(formId);
                } else {
                    console.log('wait');
                    timeoutR = setTimeout(checkViz, 50);
                }
            }, 0);
            document.querySelector('.generated-form').onsubmit = function(e){
                e.preventDefault();
                var xhr = new XMLHttpRequest();
                xhr.open('POST', 'json_encode.php');
                xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
                xhr.onload = function() {
                    if (xhr.status !== 200) {
                        alert('Request failed.  Returned status of ' + xhr.status);
                        return;
                    }
                    console.log(xhr.responseText);
                            if(current_user.type && current_user.type === 'vizonator') {
			sendToVizonator('custom', {"protocol_id":document.querySelector(".generated-form").id,"json":xhr.responseText})
  return;
        }
                    viz.broadcast.custom(posting_key, [], [viz_login], document.querySelector(".generated-form").id, xhr.responseText, function(err, result) {
                        if (!err) {
                            alert('Ок. custom отправлен')
                            console.log(result);
                        } else {
                            alert('Ошибка: '+err)
                        }
                    });
                };
                xhr.send(serialize(document.querySelector('.generated-form')));
            }
        }*/
    });
    }(jQuery);