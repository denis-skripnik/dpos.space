<?php

//подключаем автозагрузку
require_once $_SERVER['DOCUMENT_ROOT'] . '/vendor/autoload.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/params.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/helpers.php';

//подключаем нужные пространства имён классов

use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetDiscussionsByFeedCommand;

$chain = $chain;

$connector_class = CONNECTORS_MAP[$chain];

class GetDiscussionsByLogin
{
    //Константа. используется как значение `limit` в опциях.
    //соответственно, может иметь значение до 100
    const LIMIT = 100;

    //функция, возвращающая данные всех дискуссий
    public function execute($login)
    {
        $chain = $chain;

        //получаем первые дискуссии через `tag`
        if ($chain == 'WLS' or $chain == 'steem') {
            $result = self::fetchDiscussions([
                'limit' => self::LIMIT,
                'tag' => $login
            ]);
        } else if ($chain == 'golos') {
            $result = self::fetchDiscussions([
                'limit' => self::LIMIT,
                'select_authors' => [$login]
            ]);
        }
        //если их меньше, чем лимит - значит, это всё.
        if (count($result) < self::LIMIT) {
            return $result;
        }

        //если нет - запускаем бесконечный цикл, запрашивающий по кусочкам остальную информацию
        while (true) {
            //следующий кусочек (чанк).
            //данные `author` и `permlink` берём из последней записи в `result`
            if ($chain == 'WLS' or $chain == 'steem') {
                $chunk = self::fetchDiscussions([
                    'limit' => self::LIMIT,
                    'tag' => $login,
                    'start_author' => $result[count($result) - 1]['author'],
                    'start_permlink' => $result[count($result) - 1]['permlink']
                ]);
            } else if ($chain == 'golos') {
                $chunk = self::fetchDiscussions([
                    'limit' => self::LIMIT,
                    'select_authors' => [$login],
                    'start_author' => $result[count($result) - 1]['author'],
                    'start_permlink' => $result[count($result) - 1]['permlink']
                ]);
            }
            //добавляем полученные данные в `result`.
            //из чанка убираем первый элемент - потому что он уже записан в `result`
            $result = array_merge(
                $result,
                array_slice($chunk, 1)
            );

            //если длина массива-чанка меньше лимита - значит, данные кончились.
            if (count($chunk) < self::LIMIT) {
                return $result;
            }
        }
    }

    //вспомогательная функция, просто запускает скрипт библиотеки с нужными параметрами
    private static function fetchDiscussions($options)
    {
        global $connector_class;
        $commandQuery = new CommandQueryData();
        $data = [$options];
        $commandQuery->setParams($data);
        $connector = new $connector_class();
        $command = new GetDiscussionsByFeedCommand($connector);
        $res = $command->execute($commandQuery);

        return $res['result'];
    }
}
