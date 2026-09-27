# Wallet UX 31 inventory

Covered wallet modal families:

- Golos: transfer/power, delegation/withdraw, rewards, donate, UIA main/TIP transfer/donate/withdraw, invites. UIA/TIP `step` follows the selected balance precision.
- VIZ: transfer, SHARES power/delegation/withdraw, rewards and invites.
- Hive/Steem: transfer, power/delegation/withdraw, rewards and savings; liquid/debt selector preserves HIVE/HBD and STEEM/SBD.
- Minter: send/delegate plus the existing coin/liquidity/hub monetary fields; wallet recipient uses the derived `Mx…` address.
- Decimal: send/delegate/convert/token/NFT monetary fields; convert precision follows `fromDecimals`; wallet recipient uses the derived `d0…` address.

Shared behavior:

- Visible monetary fields are enhanced to native `type=number`, non-negative `min`, and chain/token `step`; balance prefills remove asset labels.
- Recipient-like wallet fields get a keyboard-accessible `Мне` button filled from authorized wallet state, never the viewed route profile.
- Form submission restores the selected asset symbol without changing the visible human number. Fixed-decimal chain strings are padded with string operations and reject excess precision rather than rounding through floating point.
- Existing Golos/Hive/Steem power conversion functions remain the submit boundary for СГ/HP/SP; VIZ SHARES remains six decimals.

Not covered intentionally: hidden network-owned reward values, validator IDs, swap asset selectors (`from`/`to` are token identifiers, not recipients), non-wallet donate/manage/calculator routes, and real transaction broadcast.
