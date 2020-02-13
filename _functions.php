<?php
// Расчёт стоимости апвота:
function upvote_payout($el) {
 global $chain;
 global $RewardFund_mass;
 global $all_shares;
 global $charge;
 global $feed_mass;
 global $mass3;
 global $datas;
 global $volume;
 global $last_vote_time;
global $tvfs;
global $tvsh;
global $sp;
if ($chain == 'WLS' or $chain == 'viz') {
    $recent = $RewardFund_mass['recent_claims'];
    $rewa = $RewardFund_mass['reward_balance'];
    $primerr = $all_shares / $recent;
    $brimerr = ($primerr * $rewa) * 100000;
    $wqaaa = ($brimerr /100) * ($charge);
    $dasdas = round($wqaaa, 3);
    $fixx = round($brimerr, 3);
    } else if ($chain == 'golos') {
    $base = (float)$feed_mass["current_median_history"]["base"];
        $quote = (float)$feed_mass["current_median_history"]["quote"];
       $median_price = round($base/$quote, 3);
        $total_vesting_fund_steem = (float)$mass3["total_vesting_fund_steem"];
        $total_vesting_shares = (float)$mass3["total_vesting_shares"];
        $total_reward_fund_steem = (float)$mass3["total_reward_fund_steem"];
        $total_reward_shares2 = (int)$mass3["total_reward_shares2"];
        $golos_per_vests = $total_vesting_fund_steem / $total_vesting_shares;
    
    $NOW = strptime("%Y-%m-%dT%H:%M:%S", $mass3["time"]);
       $account["GOLOS"] = (float)$datas["balance"];
        $account["GBG"] = $datas["sbd_balance"];
    $account["golos_power"] = round($all_shares * $golos_per_vests, 3);
    $vesting_shares = (int)1e6 * $account["golos_power"] / $golos_per_vests;
    
    if ($chain == 'golos') {
    $max_vote_denom = $mass3["vote_regeneration_per_day"] * (5 * 60 * 60 * 24) / (60 * 60 * 24);
    } else {
    $max_vote_denom = $mass3["vote_power_reserve_rate"] * (5 * 60 * 60 * 24) / (60 * 60 * 24);
    }
    $used_power = (int)($charge*100 + $max_vote_denom - 1) / $max_vote_denom;
    $fixx_used_power = (int)(10000 + $max_vote_denom - 1) / $max_vote_denom;
    $rshares = (($vesting_shares * $used_power) / 10000);
    $account["rshares"] = round($rshares);
    $fixxrshares = (($vesting_shares * $fixx_used_power) / 10000);
    $account["fixx_rshares"] = round($fixxrshares);
    $value_golos = round($account["rshares"] * $total_reward_fund_steem / $total_reward_shares2, 3);
    $value_gbg = round($value_golos * $median_price, 3);
    
    $dasdas_golos = $value_golos;
    $dasdas_gbg = $value_gbg;
    $fixx_golos = round($account["fixx_rshares"] * $total_reward_fund_steem / $total_reward_shares2, 3);
    $fixx_gbg = round($fixx_golos * $median_price, 3);
    } else if ($chain == 'steem') {
    $steem_a = $tvfs / $tvsh;
    $steem_n = 100; // vote_vait;
    $steem_r = $sp / $steem_a;
    $steem_m2 = 100 * $charge * (100 * $steem_n) / 10000;
    $steem_m = ($steem_m2 + 49) / 50;
    $fixx_steem_m2 = 100 * 100 * (100 * $steem_n) / 10000;
    $fixx_steem_m = ($fixx_steem_m2 + 49) / 50;
    $rewa = $RewardFund_mass['reward_balance'];
    $recent = $RewardFund_mass['recent_claims'];
    $steem_i = $rewa / $recent;
    $base = (float)$feed_mass["current_median_history"]["base"];
        $quote = (float)$feed_mass["current_median_history"]["quote"];
    $median_price = round($base/$quote, 2);
    $dasdas_golos = round($steem_r * $steem_m * 100 * $steem_i, 3);
    $dasdas_gbg = round($steem_r * $steem_m * 100 * $steem_i * $median_price, 3);
    $fixx_golos = round($steem_r * $fixx_steem_m * 100 * $steem_i, 3);
    $fixx_gbg = round($steem_r * $fixx_steem_m * 100 * $steem_i * $median_price, 3);
    }
    $map_arr=array(
  'dasdas_golos' => ($dasdas_golos ?? $dasdas_golos ?? ""),
  'dasdas_gbg' => ($dasdas_gbg ?? $dasdas_gbg ?? ""),
  'fixx_golos' => ($fixx_golos ?? $fixx_golos ?? ""),
  'fixx_gbg' => ($fixx_gbg ?? $fixx_gbg ?? ""),
  'dasdas' => ($dasdas ?? $dasdas ?? ""),
  'fixx' => ($fixx ?? $fixx ?? "")
 );
        return $map_arr[$el];
    }
