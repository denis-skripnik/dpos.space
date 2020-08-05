<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
//подключаем автозагрузку
require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/helpers.php';

//подключаем нужные пространства имён классов
use GrapheneNodeClient\Commands\Single;
use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetDiscussionsByBlogCommand;


class GetDiscussionsByLogin
{
    //Константа. используется как значение `limit` в опциях.
    //соответственно, может иметь значение до 100
    const LIMIT = 100;
    //функция, возвращающая данные всех дискуссий
    public function execute($login)
    {
		//получаем первые дискуссии через `tag`
        $result = self::fetchDiscussions([
            'limit' => self::LIMIT,
            'tag' => $login
        ]);
        //если их меньше, чем лимит - значит, это всё.
        if (count($result) < self::LIMIT) return $result;

        //если нет - запускаем бесконечный цикл, запрашивающий по кусочкам остальную информацию
        while (true)
        {
            //следующий кусочек (чанк).
            //данные `author` и `permlink` берём из последней записи в `result`
			$chunk = self::fetchDiscussions([
                'limit' => self::LIMIT,
                'tag' => $login,
                'start_author' => $result[count($result) - 1]['author'],
                'start_permlink' => $result[count($result) - 1]['permlink']
            ]);
			            //добавляем полученные данные в `result`.
            //из чанка убираем первый элемент - потому что он уже записан в `result`
            $result = array_merge(
                $result,
                array_slice($chunk, 1)
            );

            //если длина массива-чанка меньше лимита - значит, данные кончились.
            if (count($chunk) < self::LIMIT) return $result;
        }
    }

    //вспомогательная функция, просто запускает скрипт библиотеки с нужными параметрами
    private static function fetchDiscussions($options)
    {
        $connector_class = CONNECTORS_MAP['steem'];
        $commandQuery = new CommandQueryData();
        $method_data = [$options];
        $commandQuery->setParams($method_data);
$connector = new $connector_class();
        $command = new GetDiscussionsByBlogCommand($connector);
        $res = $command->execute($commandQuery);

        return $res['result'];
    }
}
