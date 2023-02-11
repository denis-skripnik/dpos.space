async function calculateVestingSharesForDonation(donationAmount, numberOfDays) {
  const props = await golos.api.getDynamicGlobalPropertiesAsync();
 
  const dailyEmission = parseFloat(props.accumulative_emission_per_day);
  const total_vesting_fund_steem = parseFloat(props.total_vesting_fund_steem);

  const totalEmission = dailyEmission * numberOfDays;
  const shareOfEmission = donationAmount / totalEmission;
  const vestingShares = shareOfEmission * total_vesting_fund_steem;

// Вычисляем мин. СГ для эмиссии:
const chainProps = await golos.api.getChainPropertiesAsync();
const medianPrice = await golos.api.getCurrentMedianHistoryPriceAsync();
const base = parseFloat(medianPrice.base.split(' ')[0]);
const minGolosPowerToEmission = parseFloat(chainProps.min_golos_power_to_emission);
const min_gp = minGolosPowerToEmission / base;
  let isMinGP = 'Вы будете получать эмиссию при данной Силе Голоса.';
  if (vestingShares < min_gp) isMinGP = `К сожалению этой суммы недостаточно для получения эмиссии. на данный момент. Минимальная СГ для эмиссии = ${min_gp.toFixed(6)} СГ.`;
  return {donate_gp: vestingShares.toFixed(6), is_min_gp: isMinGP};
}


async function selectUIA() {
    let res;
try {
    res = await golos.api.getAssetsAsync('', [], '', '', '');
for (let token of res) {
    let ticker = token.supply.split(' ')[1];
    const tokensSelect = document.getElementById("tokens_select");

const option = document.createElement("option");
option.text = ticker;
option.value = ticker;
tokensSelect.add(option);
}
} catch (err) {
    console.error('err', err);
}
}

async function calcDonates(donator, time, from) {
    let sum = 0;
    let limit = 2000;
    let done = false;
    while (!done) {
      let res;
      try {
        res = await golos.api.getAccountHistoryAsync(
          donator,
          from,
          limit,
          { select_ops: ["donate"] }
        );
      } catch (err) {
        console.error("err", err);
        return sum;
      }
  
      for (let i = res.length - 1; i >= 0; i--) {
        const op = res[i][1].op;
        const timestamp = new Date(res[i][1].timestamp + "Z").getTime();
        const daysAgo = (Date.now() - timestamp) / (24 * 60 * 60 * 1000);
                if (daysAgo > time) {
          done = true;
          break;
        }
        if (op[1].from !== donator) continue;
        sum += parseFloat(op[1].amount.split(" ")[0]);
      }
  
      from = res[res.length - 1][0] - 1;
  
      if (res.length < limit) {
        done = true;
      }
    }
  
    return sum;
  }
  
  document.addEventListener('DOMContentLoaded', function() {
    if (typeof golos_login !== 'undefined') document.getElementsByName('select_donates_login')[0].value = golos_login;
    
    const calcDonatesButton = document.getElementById('calc_donates');
    calcDonatesButton.addEventListener('click', async function() {
      const donatorInput = document.getElementsByName('select_donates_login')[0];
      if (!donatorInput || !donatorInput.value) {
        console.error('Invalid donator input');
        return;
      }
      const donator = donatorInput.value;

      const timeInput = document.getElementsByName('select_donates_time')[0];
            if (!timeInput || !timeInput.value) {
              console.error('Invalid time input');
              return;
            }
            const time = Number(timeInput.value);
          
            const tokenInput = document.getElementsByName('select_donates_token')[0];
            if (!tokenInput || !tokenInput.value) {
              console.error('Invalid token input');
              return;
            }
            const token = tokenInput.value;
            
            if (!donator) {
              console.error('Invalid golos login');
              return;
            }
          
            const sum = await calcDonates(donator, time, -1);
                        document.getElementById('sun_donates').innerHTML = `Сумма: ${sum} ${token}`;
                        const gp_for_donates = await calculateVestingSharesForDonation(sum, time);
                        document.getElementById('gp_for_donates').innerHTML = `<p>Для донатов на данную сумму за ${time} дней необходимо ${gp_for_donates.donate_gp} СГ.</p>
<p>${gp_for_donates.is_min_gp}</p>`
          });
          selectUIA();
        });