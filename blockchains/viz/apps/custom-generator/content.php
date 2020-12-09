<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<div class="container-before">
<p>
    <label>
        <span>ID формы *</span> <br> <br>
        <input type="text" name="form-id" id="form-id">
    </label>
</p>
</div>
<div class="container">
<form class="form" id="js-form">
    <p class="ui-sortable-handle">
        <label>
            <span>Ваше имя</span>
            <a href="#" class="gen-edit">редактировать</a>, <a href="#" class="gen-delete">удалить</a>
            <br>
            <input type="text" name="name" value=""> <br>
            <a href="#" class="gen-newfield">новое поле</a>, <a href="#" class="gen-newlevel">новый уровень</a> <br>
        </label>
    </p>
    <p>
        <label>
            <span>О вас</span>
            <a href="#" class="gen-edit">редактировать</a>, <a href="#" class="gen-delete">удалить</a>
            <br>
            <textarea name="about"  cols="30" rows="5"></textarea> <br>
            <a href="#" class="gen-newfield">новое поле</a>, <a href="#" class="gen-newlevel">новый уровень</a> <br>
        </label>
    </p>
    <fieldset data-name="name">
        <legend>Типа Уровень 2</legend>
        <p>
            <label>
                <span>Ваше имя</span>
                <a href="#" class="gen-edit">редактировать</a>, <a href="#" class="gen-delete">удалить</a>
                <br>
                <input type="text" name="level2[name]" value=""> <br>
                <a href="#" class="gen-newfield">новое поле</a>, <a href="#" class="gen-newlevel">новый уровень</a> <br>
            </label>
        </p>
        <p>
            <label>
                <span>О вас</span>
                <a href="#" class="gen-edit">редактировать</a>, <a href="#" class="gen-delete">удалить</a>
                <br>
                <textarea name="level2[about]"  cols="30" rows="5"></textarea> <br>
                <a href="#" class="gen-newfield">новое поле</a>, <a href="#" class="gen-newlevel">новый уровень</a> <br>
            </label>
        </p>
    </fieldset>
    <br>
    <fieldset>
        <legend>Типа  тоже Уровень 2</legend>
        <p>
            <label>
                <span>Ваше имя</span>
                <a href="#" class="gen-edit">редактировать</a>, <a href="#" class="gen-delete">удалить</a>
                <br>
                <input type="text" name="level2[name]" value=""> <br>
                <a href="#" class="gen-newfield">новое поле</a>, <a href="#" class="gen-newlevel">новый уровень</a> <br>
            </label>
        </p>
        <fieldset>
            <legend>Типа Уровень 3</legend>
            <p>
                <label>
                    <span>Ваше имя</span>
                    <a href="#" class="gen-edit">редактировать</a>, <a href="#" class="gen-delete">удалить</a>
                    <br>
                    <input type="text" name="level2[name]" value=""> <br>
                    <a href="#" class="gen-newfield">новое поле</a>, <a href="#" class="gen-newlevel">новый уровень</a> <br>
                </label>
            </p>
            <p>
                <label>
                    <span>О вас</span>
                    <a href="#" class="gen-edit">редактировать</a>, <a href="#" class="gen-delete">удалить</a>
                    <br>
                    <textarea name="level2[about]"  cols="30" rows="5"></textarea> <br>
                    <a href="#" class="gen-newfield">новое поле</a>, <a href="#" class="gen-newlevel">новый уровень</a> <br>
                </label>
            </p>
        </fieldset>
    </fieldset>
</form>
<p><label for="myOwnTemplate">Вставить свой шаблон<label>
    <span></p></span>
<p><textarea name="myOwnTemplate"  cols="30" rows="10" ></textarea></p>
</div>
<div class="buttons">
<p>
    <a href="#" class="get-resultForm">Получить код формы на сайт</a>
</p>
<p>
    <a href="#" class="get-JSON">Получить JSON текущей формы</a>
</p>
<p>
    <a href="#" class="set-JSON">Вставить свой JSON</a>
</p>
<p>
    <a href="#" class="get-demo">Открыть получившуюся форму</a>
</p>
</div>
<div class="modal-wrapper">
<div class="modal modal-field">
    <div class="modal-overlay"></div>
    <div class="modal-content-inner">
        <h3></h3>
        <form class="form">
            <p>
                <label>Заголовок поля
                    <br><input type="text" name="label" required>
                </label>
            </p>
            <p>
                <label>Имя поля <small>(только латинские буквы и тире)</small>
                    <br><input type="text" name="name" required>
                </label>
            </p>
            <p>
                <label>Значение по умолчанию
                    <br><input type="text" name="defaultvalue">
                </label>
            </p>
            <p>
                <label>
                    <input type="radio" name="istextarea" value="0" checked> Однострочное текстовое поле
                </label>
                <label>
                    <input type="radio" name="istextarea" value="1"> Многострочное
                </label>
            </p>
            <p>
                <button class="modal-ready">Готово</button>
                <a class="modal-cancel" href="#">Закрыть</a>
            </p>
        </form>
    </div>
</div>
<div class="modal modal-array">
    <div class="modal-overlay"></div>
    <div class="modal-content-inner">
        <h3></h3>
        <form class="form">
            <p>
                <label>Заголовок массива
                    <br><input type="text" name="label" required>
                </label>
            </p>
            <p>
                <label>Имя массива <small>(только латинские буквы и тире)</small>
                    <br><input type="text" name="name" required>
                </label>
            </p>
            <p>
                <button class="modal-ready">Готово</button>
                <a class="modal-cancel" href="#">Закрыть</a>
            </p>
        </form>
    </div>
</div>
<div class="modal modal-array-value">
    <div class="modal-overlay"></div>
    <div class="modal-content-inner">
        <h3></h3>
        <form class="form">
            <p>
                <label>Значение
                    <br><input type="text" name="value" required>
                </label>
            </p>
            <p>
                <button class="modal-ready">Готово</button>
                <a class="modal-cancel" href="#">Закрыть</a>
            </p>
        </form>
    </div>
</div>
<div class="modal modal-level">
    <div class="modal-overlay"></div>
    <div class="modal-content-inner">
        <h3></h3>
        <form class="form">
            <p>
                <label>Заголовок уровня
                    <br><input type="text" name="label" required>
                </label>
            </p>
            <p>
                <label>Имя уровня <small>(только латинские буквы и тире)</small>
                    <br><input type="text" name="name" required>
                </label>
            </p>
            <p>
                <button class="modal-ready">Готово</button>
                <a class="modal-cancel" href="#">Закрыть</a>
            </p>
        </form>
    </div>
</div>
<div class="modal modal-getJSON">
    <div class="modal-overlay"></div>
    <div class="modal-content-inner">
        <h3>Получить код JSON</h3>
        <form class="form">
            <p>
                <textarea name="ta-get-json"  cols="30" rows="10"></textarea>
            </p>
            <p>
                <a class="modal-cancel" href="#">Закрыть</a>
            </p>
        </form>
    </div>
</div>
<div class="modal modal-setJSON">
    <div class="modal-overlay"></div>
    <div class="modal-content-inner">
        <h3>Свой JSON</h3>
        <form class="form">
            <p>
                <textarea name="ta-set-json"  cols="30" rows="10"></textarea>
            </p>
            <p>
                <button class="ta-set-json-ready">Готово</button>
                <a class="modal-cancel" href="#">Закрыть</a>
            </p>
        </form>
    </div>
</div>
<div class="modal modal-getResultHTML">
    <div class="modal-overlay"></div>
    <div class="modal-content-inner">
        <h3>Получить код формы</h3>
        <form class="form">
            <p>
                <textarea name="ta-get-form"  cols="30" rows="10"></textarea>
            </p>
            <p>
                <a class="modal-cancel" href="#">Закрыть</a>
            </p>
        </form>
    </div>
</div>
<div class="modal modal-getDemo">
    <div class="modal-overlay"></div>
    <div class="modal-content-inner">
        <h3>Открыть получившуюся форму</h3>
        <div class="result-demo"></div>
        <p>
            <a class="modal-cancel" href="#">Закрыть</a>
        </p>
    </div>
</div>
</div>
'; ?>