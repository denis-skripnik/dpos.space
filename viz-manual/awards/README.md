# awards-generator
Generation awards in Viz blockchain.
Russian version: [README_RU.md](README_RU.md).

A tool for generating awards for Viz blockchain.
## What can:
    1. Create reward URLs through a form in the form.html file.  All fields are optional.  But if you do not fill the energy field, you will spend 0.01%.  The purpose of the fields, see the subsection "Description of the parameters of the award." 
The form also has the ability to view the current energy (if the user is authorized) and how much will have to spend it to give 1 SHARES.  Below (among the fields) there is a field for entering the desired amount. 
The maximum amount is indicated in parentheses (click on it and substitute it in the field).  After entering the amount and moving to any other field, the percentage of energy in the corresponding field automatically changes: you can find out what percentage it will have to spend to get the required amount. 
Authorization is also on form.html.  Moreover, if you enter your data there or on index.html, they will remain intact.
If you did not mark the checkbox for saving the input - until the browser is closed, If noted - for a long time.  The possibility of convenient addition of beneficiaries is made.  In the absence of data in some fields, they do not appear in the url.

    2. The url generator (url.html file).  The form, of course, is convenient for ordinary users, but for developers, not so much, because in order to implement a service into applications, you need to see the url before your eyes. 
In the awards address generator, everything is very similar to the form, but the field names consist of parameters in the url and explanations, not just explanations. 
This function will allow you to decide what parameters of the award that will contain. 
For example, in memo you can place JSON with the name of the application, its id, which changes once a day, as well as the author and permlink post. 
The possibility of convenient addition of beneficiaries is made.
Is created qr-code with the url of the reward.
    3. Generate award address manually.  To begin with, these are the standard get options.  That is, the address is: index.html? Target = login & energy = 0.7 & custom_sequence = 0 & memo = thank you for everything & beneficiaries = denis-skripnik: 10, on1x: 25
But you can write like this:? Target = login And you will reward your login account with 0.01% energy  .  All other parameters will be either 0 or empty.  About what each parameter means, in the next section.

    4. You can create a form on builder.html (https://liveblogs.space/awards/builder.html) and place it in your application, which is based on html + js.  The form will be autonomous, i.e.  does not redirect to the page index.html awards-generator, but sends the award through the script builder.js. 
To work in your application (on the site, in the extension) you need to connect viz.min.js and sjcl.min.js (the last one is to encrypt and decrypt the award key posting).  When using the slider, i.e.  the slider to select the percentage of energy or the percentage of deduction to the recipient needs to connect another 1 script, but its code is registered as a result of generation. 
The first multi-line field displays an example of creating a variable target_user with the default value that you specified in the section on the recipient of the award.  Instead, it is necessary to transfer to the script of the form the login of the person to whom the reward will go, for example, VIZ the login of the author of the page on which you are going to reward or the gateway login that allows you to reward users who do not have a VIZ account.

5. History of awards: history.html. 
The result is returned as JSON. 
Parameters: account=login - login parameter (required), initiator = denis-skripnik - filtering by initiator, receiver = liveblogs - filtering by recipient, type = benefactor_award - filtering by operation type, benefactor = on1x - filtering by beneficiary, limit = 10000 - limit (Max. 10000).  Indicated in url. 
Example: history.html? account=login&Type = benefactor_award & benefactor = denis-skripnik. 
The service will allow you to read already received awards and beneficiaries.

	### Description of the parameters of the award:
First, the name of the parameter is displayed here, as in Url, and then - as in the form.
    - target.  In the form of "Who to award."  Who do you want to reward (account in the Viz blockchain).  In the example above, a non-existing "login" was taken.
- energy.  In the form of "The percentage of energy that you are willing to spend with a reward. Energy regenerates per day by 20%."  What percentage of energy you are ready to use when sending rewards.  This is an indicator displayed on viz.world (Actual) and in the API method get_accounts (At the time of the last reward / delegation SHARES).  It is restored by 20% per day.  That is, if you specify 100, you have to wait for 100% of the energy for 5 days.  From the energy expended depends on the profit of the person you are rewarding, as well as the beneficiaries, if they are indicated (more on that later).
- custom_sequence.  In the form of "Custom operation number sent by the user ..." Displayed in get_accounts.  indicates the number of operations sent to the blockchain custom.  In addition to it, there is a custom_sequence_block_num, which indicates a block of the operation corresponding to the custom_sequence.  This allows applications to determine the desired operation, and then specify its custom_sequence when sending the reward.  But in fact, in the award parameter "custom_sequence" you can add any number or 0. For example, this number in a certain application may indicate a news number in the database.
- memo.  In the form of "Note (memo)".  Any text, such as an explanation, for which the reward.  It may also contain the identification text of the application and (or) the identification of the page / post / function in the application.
- beneficiaries.  In the form of "Beneficiaries".  Beneficiaries.  Or those who still profit from the reward.  In this case, the indicated percentages are summed up.  That is, if you specify 100% of the total beneficiaries, the recipient will not receive anything.  Those.  By putting yourself as a beneficiary at 50%, you will receive half the reward.  Format: login: percentage, login2: percentage2.  Example: denis-skripnik: 25, on1x: 50 (Sends 75% to beneficiaries, and 25% to the award).
- redirect.  In the form of "Link to redirect after a successful award (optional)."  Where to redirect after a successful award.  By default, after a successful reward is sent, information is displayed with the parameters of the reward.  But if you want to redirect the reward to some url, for example, sending reward parameters to the database, you can specify it here.  "redirect" refers to the functionality of the service, and not to viz.broadcast.award.

## Main features:
    1. Locality: you can download and use.
    2. Authorization without sending to the server: Posting the key is not transmitted anywhere, but is stored in your browser, and then at your will (If you wish, you can enter your login and key each time);
    3. Flexibility: it is provided with award functionality, and also a redirect;
    4. Easy integration into applications: it is enough to know the url format.
    5. The ability to use as a rewarding other users, and to send awards to himself.
    6. The percentages are indicated as you usually write them: not 7529, but 75.29;
    7. The service itself searches for a working public node, connects to it and remembers.  If it becomes idle, looking for a new one and also remembers ...
    8. Convenience: all errors are in Russian, logins can be entered in any register (There will be no errors), Moreover, even if you leave all the fields empty, i.e.  url will be index.html, you reward yourself with 0.01% of energy.  Of course, if authorized.  This allows you to use the awards generator as flexible as possible: selecting only the fields / parameters that are needed.  For example, index.html? Energy = 10 will give you 10% reward;
    9. The possibility of using as a means of payment from the issue.  This is achieved by adding the ability to enter the amount of the reward in the parameters / fields, as well as viewing the amount that was the result.
    10. Open Source: You can modify the project as you wish.
11. Two versions: Russian and English (Folders ru and en).

## What is next?
1. Design order.

## That is all 
You can use the award-generator using the https://liveblogs.space/awards
Form: https://liveblogs.space/awards/form.html
url are: index.html? Target = denis-skripnik & energy = 10

***

Service author: Denis Skrypnyk.
Profile on viz.world: https://viz.world/@denis-skripnik/
Witness: https://viz.world/witnesses/denis-skripnik/