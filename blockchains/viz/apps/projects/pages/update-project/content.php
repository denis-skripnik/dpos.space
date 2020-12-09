<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
$content = '<h2>Страницы сервиса</h2>
<table><tr><th><a href="'.$conf['siteUrl'].'viz/projects/catalog">Добавить проект</a></th>
<th><a href="'.$conf['siteUrl'].'viz/projects/catalog">Каталог проектов</a></th>
<th><a href="'.$conf['siteUrl'].'viz/projects/tasks">Задачи</a></th>
<th><a href="'.$conf['siteUrl'].'viz/projects/new-task">Добавить задачу</a></th>
</tr></table>
<div id="auth_msg" style="display: none;"><p>Вы не авторизовались. Просьба сделать это <a href="'.$conf['siteUrl'].'viz/accounts" target="_blank">здесь</a></p></div>
<div id="posting_page">
<h2>Обновите данные о проекте</h2>
<form class="form">';
$filter['creator'] =$_GET['creator'];
$filter['name'] = urlencode($_GET['name']);
$html = file_get_contents('http://138.201.91.11:3100/viz-api?service=viz-projects&type=projects&filter='.json_encode($filter, JSON_FORCE_OBJECT).'&page=1');
$pro = json_decode($html, true);
if ($pro && count($pro) > 0) {
$project = $pro[0];
$content .= '<p><a id="moderation_link" href="'.$conf['siteUrl'].'viz/projects/admin?type=project&creator='.$_GET['creator'].'&name='.$_GET['name'].'" target="_blank">Модерировать</a></p>
<div id="project_author"><h3>Автор: <a href="'.$conf['siteUrl'].'viz/profiles/'.$project['creator'].'" target="_blank"><span id="project_login">'.$project['creator'].'</span></a></h3>';
$fields = ['name' => 'Название', 'description' => 'Описание', 'image_link' => 'Изображение', 'type' => 'Тип', 'category' => 'Категория', 'dev_status' => 'Статус разработки', 'command' => 'Команда (логины через запятую)', 'site' => 'Сайт', 'github' => 'Github'];
foreach($fields as $name => $description) {
if ($name === 'type') {
    $content .= '<p><select name="type" placeholder="Тип проекта">
        <option value="" disabled selected>Выберите тип проекта</option>
    ';
    $html = file_get_contents('http://138.201.91.11:3100/viz-api?service=viz-projects&type=types');
    $types = json_decode($html, true);
    if ($types && count($types) > 0) {
        foreach($types as $type) {
            if ($project['type'] === $type['name']) {
                $content .= '<option selected value="'.$type['name'].'">'.$type['name'].'</option>';
            } else {
                $content .= '<option value="'.$type['name'].'">'.$type['name'].'</option>';
            }
        }
    }
    $content .= '</select></p>
';
} else if ($name === 'category') {
    $content .= '<p><select name="category" placeholder="Категория">
        <option value="" disabled selected>Выберите категорию проекта</option>
';
    $html = file_get_contents('http://138.201.91.11:3100/viz-api?service=viz-projects&type=categories');
    $categories = json_decode($html, true);
    if ($categories && count($categories) > 0) {
        foreach($categories as $category) {
if ($project['category'] === $category['name']) {
    $content .= '<option value="'.$category['name'].'" selected>'.$category['name'].'</option>';
} else {
                $content .= '<option value="'.$category['name'].'">'.$category['name'].'</option>';
}
        }
    }
    $content .= '</select></p>
';
} else if ($name === 'dev_status') {
    $content .= '<p><select name="dev_status" placeholder="Статус разработки">
        <option value="" disabled selected>Выберите статус разработки</option>';
if ($project['dev_status'] === 'test') {
    $content .= '<option value="test" selected>Тестовая версия</option>';
} else {
    $content .= '<option value="test">Тестовая версия</option>';
}
if ($project['dev_status'] === 'stable') {
    $content .= '<option value="stable" selected>Стабильная версия</option>';
} else {
    $content .= '<option value="stable">Стабильная версия</option>';
}
$content .= '</select></p>
';
} else if ($name === 'command') {
    $content .= '<p><input type="text" name="'.$name.'" value="'.implode(',', $project[$name]).'" placeholder="'.$description.'"></p>
';
} else {
    $content .= '<p><input type="text" name="'.$name.'" value="'.$project[$name].'" placeholder="'.$description.'"></p>
';
}
}
$content .= '<p><input type="button" value="Изменить" onclick="sendCustom(`update_project`, {creator: `'.$project['creator'].'`, name: `'.$project['name'].'`, new_name: this.form.name.value, description: this.form.description.value, image_link: this.form.image_link.value, type: this.form.type.value, category: this.form.category.value, dev_status: this.form.dev_status.value, command: this.form.command.value.split(`,`), site: this.form.site.value, github: this.form.github.value})"></p>
</div>
<script>
if ($(`#project_login`).html() === viz_login) {
    $(`#project_author`).css(`display`, `block`);
    } else {
        $(`#project_author`).css(`display`, `none`);
    }
    if (viz_login === `viz-projects`) {
$(`#moderation_link`).css(`display`, `inline`);
    } else {
        $(`#moderation_link`).css(`display`, `none`);
    }
    </script>';
} else {
    $content .= '<p>Проект не найден.</p>';
}
$content .= '</form>
</div>';
return $content;
?>