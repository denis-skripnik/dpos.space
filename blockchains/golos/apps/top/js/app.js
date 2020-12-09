async function main() {
    let assets = await golos.api.getAssetsAsync('');
let tokens = '';
    if (assets && assets.length > 0) {
    for (let asset of assets) {
let name = asset.supply.split(' ')[1];
        tokens += `<li><a href="/golos/top/${name}">${name}</a></li>`;
    }
}
                $('#uia_assets_users').html(tokens);
}
    main();