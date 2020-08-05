<?php

require_once $_SERVER['DOCUMENT_ROOT'] . '/vendor/autoload.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/helpers.php';

use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetDiscussionsByBlogCommand;

class DiscussionsByBlog
{
    CONST LIMIT_MAX = 100;

    static public function get($user, $limit, $startAuthor = null, $startPermlink = null)
    {
        $createdMaxDatetime = static::getCreatedMaxDatetime();

        $posts = [];
        $newStartAuthor = null;
        $newStartPermlink = null;
        $newLastPost = null;
        while (count($posts) !== $limit && is_null($newStartAuthor)) {
            if (count($posts) !== 0 || !is_null($newLastPost)) {
                $postLast = count($posts) !== 0 ? array_pop($posts) : $newLastPost;

                $startAuthor = $postLast['author'];
                $startPermlink = $postLast['permlink'];
            }

            $chunk = static::getChunk($user, static::LIMIT_MAX, $startAuthor, $startPermlink);
            $result = $chunk['result'];

            foreach ($result as $post) {
                if ($post['created'] >= $createdMaxDatetime) {
                    continue;
                }

                if (count($posts) === $limit) {
                    $newStartAuthor = $post['author'];
                    $newStartPermlink = $post['permlink'];
                    break;
                }

                $posts[] = $post;
            }

            if (count($result) < static::LIMIT_MAX) {
                break;
            }

            // если среди постов нет ни одного нужного, запомним последний
            if (count($posts) === 0) {
                $newLastPost = $result[static::LIMIT_MAX - 1];
            }
        }

        return [$posts, $newStartAuthor, $newStartPermlink];
    }

    static private function getCreatedMaxDatetime()
    {
        $paymentDays = 7;
        $createdMaxDatetimeInSeconds = time() - $paymentDays * 24 * 60 * 60;
        $createdMaxDatetime = date('Y-m-d\TH:i:s', $createdMaxDatetimeInSeconds);

        return $createdMaxDatetime;
    }

    static private function getChunk($user, $limit, $startAuthor = null, $startPermlink = null)
    {
        $data = [['limit' => $limit]];

            $data[0]['tag'] = $user;

        $needStartParams = !is_null($startAuthor);
        if ($needStartParams) {
            $data[0]['start_author'] = $startAuthor;
            $data[0]['start_permlink'] = $startPermlink;
        }

        $commandQuery = new CommandQueryData();
        $commandQuery->setParams($data);

        $connector_class = CONNECTORS_MAP['steem'];
        $connector = new $connector_class();

        $command = new GetDiscussionsByBlogCommand($connector);

        $result = $command->execute($commandQuery);

        return $result;
    }
}
