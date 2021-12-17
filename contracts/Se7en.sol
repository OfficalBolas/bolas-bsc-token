/*
 *      SSSSSSSSSSSSSSS EEEEEEEEEEEEEEEEEEEEEE77777777777777777777EEEEEEEEEEEEEEEEEEEEEENNNNNNNN        NNNNNNNN
 *    SS:::::::::::::::SE::::::::::::::::::::E7::::::::::::::::::7E::::::::::::::::::::EN:::::::N       N::::::N
 *   S:::::SSSSSS::::::SE::::::::::::::::::::E7::::::::::::::::::7E::::::::::::::::::::EN::::::::N      N::::::N
 *   S:::::S     SSSSSSSEE::::::EEEEEEEEE::::E777777777777:::::::7EE::::::EEEEEEEEE::::EN:::::::::N     N::::::N
 *   S:::::S              E:::::E       EEEEEE           7::::::7   E:::::E       EEEEEEN::::::::::N    N::::::N
 *   S:::::S              E:::::E                       7::::::7    E:::::E             N:::::::::::N   N::::::N
 *    S::::SSSS           E::::::EEEEEEEEEE            7::::::7     E::::::EEEEEEEEEE   N:::::::N::::N  N::::::N
 *     SS::::::SSSSS      E:::::::::::::::E           7::::::7      E:::::::::::::::E   N::::::N N::::N N::::::N
 *       SSS::::::::SS    E:::::::::::::::E          7::::::7       E:::::::::::::::E   N::::::N  N::::N:::::::N
 *          SSSSSS::::S   E::::::EEEEEEEEEE         7::::::7        E::::::EEEEEEEEEE   N::::::N   N:::::::::::N
 *               S:::::S  E:::::E                  7::::::7         E:::::E             N::::::N    N::::::::::N
 *               S:::::S  E:::::E       EEEEEE    7::::::7          E:::::E       EEEEEEN::::::N     N:::::::::N
 *   SSSSSSS     S:::::SEE::::::EEEEEEEE:::::E   7::::::7         EE::::::EEEEEEEE:::::EN::::::N      N::::::::N
 *   S::::::SSSSSS:::::SE::::::::::::::::::::E  7::::::7          E::::::::::::::::::::EN::::::N       N:::::::N
 *   S:::::::::::::::SS E::::::::::::::::::::E 7::::::7           E::::::::::::::::::::EN::::::N        N::::::N
 *    SSSSSSSSSSSSSSS   EEEEEEEEEEEEEEEEEEEEEE77777777            EEEEEEEEEEEEEEEEEEEEEENNNNNNNN         NNNNNNN
 *
 * https://t.me/SE7ENBSC
 * https://se7enbsc.com
 *
 */

// SPDX-License-Identifier: MIT

pragma solidity ^0.6.2;
pragma experimental ABIEncoderV2;

import "./DividendPayingToken.sol";
import "./SafeMath.sol";
import "./IterableMapping.sol";
import "./Adminable.sol";
import "./IUniswapV2Pair.sol";
import "./IUniswapV2Factory.sol";
import "./IUniswapV2Router.sol";

contract SE7EN is ERC20, Adminable {
    using SafeMath for uint256;

    IUniswapV2Router02 public uniswapV2Router;
    address public immutable uniswapV2Pair;

    bool private swapping;

    Se7enDividendTracker public dividendTracker;

    address public liquidityWallet;

    // Some helpers
    uint8 private _decimals = 18;
    uint256 private _decimals256 = 10 ** uint256(_decimals);
    uint256 private constant _oneHunnid = 10 ** 2; // used for percentages
    uint256 private constant _oneHour = 60 * 60; // one hour in seconds
    uint256 private constant _oneDay = _oneHour * 24; // one day in seconds

    uint256 private _totalSupply = 1 * 10 ** 9 * _decimals256; // 1 billion
    uint256 public maxWalletAmount = (2 * _totalSupply) / _oneHunnid; // Max Wallet: 2%
    uint256 public maxSellTransactionAmount = 1 * 10 ** 6 * _decimals256; // 1 million
    uint256 public swapTokensAtAmount = 2 * 10 ** 5 * _decimals256; // 200 thousand
    bool public canSwapForLiquidityAndDividendsOnBuys = false;
    bool public isLargeFeeBlocksSells = true;
    bool public isSwapForLiquifyAndDividendsEnabled = true;

    // use by default 300,000 gas to process auto-claiming dividends
    uint256 public gasForProcessing = 3 * 10 ** 5; // 300 thousand

    /*   Fixed Sale and Starting Conditions  */

    bool public fixStartingConditions = false;

    // timestamp for when the token can be traded freely on PanackeSwap
    uint256 public tradingEnabledTimestamp = 1624579200; // Default: Date and time (GMT): Friday, June 25, 2021 0:00:00

    address public fixedSaleWallet;

    // timestamp for when purchases on the fixed-sale are available to early participants
    uint256 public fixedSaleStartTimestamp = 1624579200; // Default: Date and time (GMT): Friday, June 25, 2021 0:00:00

    // the fixed-sale will be open to the public 24 hour after fixedSaleStartTimestamp,
    // or after 107 buys, whichever comes first.
    uint256 public fixedSaleEarlyParticipantDuration = _oneDay;
    uint256 public fixedSaleEarlyParticipantBuysThreshold = 107;

    // track number of buys. once this reaches fixedSaleEarlyParticipantBuysThreshold,
    // the fixed-sale will be open to the public even if it's still in the first 10 minutes
    uint256 public numberOfFixedSaleBuys;
    // track who has bought
    mapping(address => bool) public fixedSaleBuyers;

    /******************/

    // exlcude from fees and max transaction amount
    mapping(address => bool) private _isExcludedFromFees;

    // addresses that can make transfers before presale is over
    mapping(address => bool) private canTransferBeforeTradingIsEnabled;

    mapping(address => bool) public fixedSaleEarlyParticipants;

    // store addresses that a automatic market maker pairs. Any transfer *to* these addresses
    // could be subject to a maximum transfer amount
    mapping(address => bool) public automatedMarketMakerPairs;

    // Fee pair for reward/liquidity (uint16 to pack)
    struct FeePair {
        uint16 rewardBuyFee;
        uint16 liquidityBuyFee;
        uint16 rewardSellFee;
        uint16 liquiditySellFee;
    }

    uint256 public referenceTimeStamp = 868233600; // Date and time (GMT): Monday, July 7, 1997 0:00:00

    // Fees of the week from Monday to Saturday
    FeePair[6] public unholyDayFee;
    // Fees of Sunday from Midnight to Midnight
    FeePair[24] public holyDayFee;

    event UpdateDividendTracker(
        address indexed newAddress,
        address indexed oldAddress
    );

    event UpdateUniswapV2Router(
        address indexed newAddress,
        address indexed oldAddress
    );

    event ExcludeFromFees(address indexed account, bool isExcluded);
    event ExcludeMultipleAccountsFromFees(address[] accounts, bool isExcluded);

    event FixedSaleEarlyParticipantsAdded(address[] participants);

    event SetAutomatedMarketMakerPair(address indexed pair, bool indexed value);

    event LiquidityWalletUpdated(
        address indexed newLiquidityWallet,
        address indexed oldLiquidityWallet
    );

    event GasForProcessingUpdated(
        uint256 indexed newValue,
        uint256 indexed oldValue
    );

    event FixedSaleBuy(
        address indexed account,
        uint256 indexed amount,
        bool indexed earlyParticipant,
        uint256 numberOfBuyers
    );

    event SwapAndLiquify(
        uint256 tokensSwapped,
        uint256 ethReceived,
        uint256 tokensIntoLiqudity
    );

    event SendDividends(uint256 tokensSwapped, uint256 amount);

    event ProcessedDividendTracker(
        uint256 iterations,
        uint256 claims,
        uint256 lastProcessedIndex,
        bool indexed automatic,
        uint256 gas,
        address indexed processor
    );

    // Fee related events
    event FeesPaid(address indexed from, uint256 value);
    event SetHolyDayFee(
        uint16 hourIndex,
        uint16 rewardBuy,
        uint16 liqBuy,
        uint16 rewardSell,
        uint16 liqSell
    );
    event SetUnholyDayFee(
        uint16 dayIndex,
        uint16 rewardBuy,
        uint16 liqBuy,
        uint16 rewardSell,
        uint16 liqSell
    );

    constructor() public ERC20("Se7en", "SE7EN") {
        // Defaults: Buy fees decrease throughout the week, Sell fees too high to sell
        _setUnholyDayFee(0, 1000, 500, 5000, 5000);
        // Monday
        _setUnholyDayFee(1, 980, 480, 5000, 5000);
        // Tuesday
        _setUnholyDayFee(2, 960, 460, 5000, 5000);
        // Wednesday
        _setUnholyDayFee(3, 940, 440, 5000, 5000);
        // Thursday
        _setUnholyDayFee(4, 920, 420, 5000, 5000);
        // Friday
        _setUnholyDayFee(5, 900, 400, 5000, 5000);
        // Saturday

        // Default: Buy fees fixed, Sell fees decrease through Sunday
        _setHolyDayFee(0, 900, 400, 2100, 1100);
        // Sunday 00:00
        _setHolyDayFee(1, 900, 400, 2090, 1090);
        // Sunday 01:00
        _setHolyDayFee(2, 900, 400, 2080, 1080);
        // Sunday 02:00
        _setHolyDayFee(3, 900, 400, 2070, 1070);
        // Sunday 03:00
        _setHolyDayFee(4, 900, 400, 2060, 1060);
        // Sunday 04:00
        _setHolyDayFee(5, 900, 400, 2050, 1050);
        // Sunday 05:00
        _setHolyDayFee(6, 900, 400, 2040, 1040);
        // Sunday 06:00
        _setHolyDayFee(7, 900, 400, 2030, 1030);
        // Sunday 07:00
        _setHolyDayFee(8, 900, 400, 2020, 1020);
        // Sunday 08:00
        _setHolyDayFee(9, 900, 400, 2010, 1010);
        // Sunday 09:00
        _setHolyDayFee(10, 900, 400, 2000, 1000);
        // Sunday 10:00
        _setHolyDayFee(11, 900, 400, 1990, 990);
        // Sunday 11:00
        _setHolyDayFee(12, 900, 400, 1980, 980);
        // Sunday 12:00
        _setHolyDayFee(13, 900, 400, 1970, 970);
        // Sunday 13:00
        _setHolyDayFee(14, 900, 400, 1960, 960);
        // Sunday 14:00
        _setHolyDayFee(15, 900, 400, 1950, 950);
        // Sunday 15:00
        _setHolyDayFee(16, 900, 400, 1940, 940);
        // Sunday 16:00
        _setHolyDayFee(17, 900, 400, 1930, 930);
        // Sunday 17:00
        _setHolyDayFee(18, 900, 400, 1920, 920);
        // Sunday 18:00
        _setHolyDayFee(19, 900, 400, 1910, 910);
        // Sunday 19:00
        _setHolyDayFee(20, 900, 400, 1900, 900);
        // Sunday 20:00
        _setHolyDayFee(21, 900, 400, 1890, 890);
        // Sunday 21:00
        _setHolyDayFee(22, 900, 400, 1880, 880);
        // Sunday 22:00
        _setHolyDayFee(23, 900, 400, 1870, 870);
        // Sunday 23:00

        dividendTracker = new Se7enDividendTracker();

        liquidityWallet = owner();

        IUniswapV2Router02 _uniswapV2Router = IUniswapV2Router02(
            0x10ED43C718714eb63d5aA57B78B54704E256024E
        );
        // Create a uniswap pair for this new token
        address _uniswapV2Pair = IUniswapV2Factory(_uniswapV2Router.factory())
        .createPair(address(this), _uniswapV2Router.WETH());

        uniswapV2Router = _uniswapV2Router;
        uniswapV2Pair = _uniswapV2Pair;

        _setAutomatedMarketMakerPair(_uniswapV2Pair, true);

        address _fixedSaleWallet = 0x4Fc4bFeDc5c82644514fACF716C7F888a0C73cCc;
        fixedSaleWallet = _fixedSaleWallet;

        // exclude from receiving dividends
        dividendTracker.excludeFromDividends(address(dividendTracker));
        dividendTracker.excludeFromDividends(address(this));
        dividendTracker.excludeFromDividends(owner());
        dividendTracker.excludeFromDividends(address(_uniswapV2Router));
        dividendTracker.excludeFromDividends(_fixedSaleWallet);

        // exclude from paying fees, having max transaction amount, or having max wallet size
        excludeFromFees(liquidityWallet, true);
        excludeFromFees(address(this), true);

        // enable owner and fixed-sale wallet to send tokens before presales are over
        canTransferBeforeTradingIsEnabled[owner()] = true;
        canTransferBeforeTradingIsEnabled[_fixedSaleWallet] = true;

        /*
            _mint is an internal function in ERC20.sol that is only called here,
            and CANNOT be called ever again
        */
        _mint(owner(), _totalSupply);
    }

    receive() external payable {}

    function updateDividendTracker(address newAddress) public onlyAdmin(1) {
        require(
            newAddress != address(dividendTracker),
            "Se7en: The dividend tracker already has that address"
        );

        Se7enDividendTracker newDividendTracker = Se7enDividendTracker(
            payable(newAddress)
        );

        require(
            newDividendTracker.owner() == address(this),
            "Se7en: The new dividend tracker must be owned by the Se7en token contract"
        );

        newDividendTracker.excludeFromDividends(address(newDividendTracker));
        newDividendTracker.excludeFromDividends(address(this));
        newDividendTracker.excludeFromDividends(owner());
        newDividendTracker.excludeFromDividends(address(uniswapV2Router));

        emit UpdateDividendTracker(newAddress, address(dividendTracker));

        dividendTracker = newDividendTracker;
    }

    function updateUniswapV2Router(address newAddress) public onlyAdmin(1) {
        require(
            newAddress != address(uniswapV2Router),
            "Se7en: The router already has that address"
        );
        emit UpdateUniswapV2Router(newAddress, address(uniswapV2Router));
        uniswapV2Router = IUniswapV2Router02(newAddress);
    }

    function excludeFromFees(address account, bool excluded)
    public
    onlyAdmin(2)
    {
        require(
            _isExcludedFromFees[account] != excluded,
            "Se7en: Account is already the value of 'excluded'"
        );
        _isExcludedFromFees[account] = excluded;

        emit ExcludeFromFees(account, excluded);
    }

    function excludeMultipleAccountsFromFees(
        address[] calldata accounts,
        bool excluded
    ) public onlyAdmin(2) {
        for (uint256 i = 0; i < accounts.length; i++) {
            _isExcludedFromFees[accounts[i]] = excluded;
        }

        emit ExcludeMultipleAccountsFromFees(accounts, excluded);
    }

    function addFixedSaleEarlyParticipants(address[] calldata accounts)
    external
    onlyAdmin(2)
    {
        for (uint256 i = 0; i < accounts.length; i++) {
            fixedSaleEarlyParticipants[accounts[i]] = true;
        }

        emit FixedSaleEarlyParticipantsAdded(accounts);
    }

    function setAutomatedMarketMakerPair(address pair, bool value)
    public
    onlyAdmin(1)
    {
        require(
            pair != uniswapV2Pair,
            "Se7en: The PancakeSwap pair cannot be removed from automatedMarketMakerPairs"
        );

        _setAutomatedMarketMakerPair(pair, value);
    }

    function _setAutomatedMarketMakerPair(address pair, bool value) private {
        require(
            automatedMarketMakerPairs[pair] != value,
            "Se7en: Automated market maker pair is already set to that value"
        );
        automatedMarketMakerPairs[pair] = value;

        if (value) {
            dividendTracker.excludeFromDividends(pair);
        }

        emit SetAutomatedMarketMakerPair(pair, value);
    }

    function updateLiquidityWallet(address newLiquidityWallet)
    public
    onlyAdmin(1)
    {
        require(
            newLiquidityWallet != liquidityWallet,
            "Se7en: The liquidity wallet is already this address"
        );
        excludeFromFees(newLiquidityWallet, true);
        emit LiquidityWalletUpdated(newLiquidityWallet, liquidityWallet);
        liquidityWallet = newLiquidityWallet;
    }

    function updateGasForProcessing(uint256 newValue) public onlyAdmin(4) {
        require(
            newValue >= 200000 && newValue <= 500000,
            "Se7en: gasForProcessing must be between 200,000 and 500,000"
        );
        require(
            newValue != gasForProcessing,
            "Se7en: Cannot update gasForProcessing to same value"
        );
        emit GasForProcessingUpdated(newValue, gasForProcessing);
        gasForProcessing = newValue;
    }

    function updateClaimWait(uint256 claimWait) external onlyAdmin(4) {
        dividendTracker.updateClaimWait(claimWait);
    }

    function getClaimWait() external view returns (uint256) {
        return dividendTracker.claimWait();
    }

    function getTotalDividendsDistributed() external view returns (uint256) {
        return dividendTracker.totalDividendsDistributed();
    }

    function isExcludedFromFees(address account) public view returns (bool) {
        return _isExcludedFromFees[account];
    }

    function withdrawableDividendOf(address account)
    public
    view
    returns (uint256)
    {
        return dividendTracker.withdrawableDividendOf(account);
    }

    function dividendTokenBalanceOf(address account)
    public
    view
    returns (uint256)
    {
        return dividendTracker.balanceOf(account);
    }

    function getAccountDividendsInfo(address account)
    external
    view
    returns (
        address,
        int256,
        int256,
        uint256,
        uint256,
        uint256,
        uint256,
        uint256
    )
    {
        return dividendTracker.getAccount(account);
    }

    function getAccountDividendsInfoAtIndex(uint256 index)
    external
    view
    returns (
        address,
        int256,
        int256,
        uint256,
        uint256,
        uint256,
        uint256,
        uint256
    )
    {
        return dividendTracker.getAccountAtIndex(index);
    }

    function processDividendTracker(uint256 gas) external {
        (
        uint256 iterations,
        uint256 claims,
        uint256 lastProcessedIndex
        ) = dividendTracker.process(gas);
        emit ProcessedDividendTracker(
            iterations,
            claims,
            lastProcessedIndex,
            false,
            gas,
            tx.origin
        );
    }

    function claim() external {
        dividendTracker.processAccount(msg.sender, false);
    }

    function getLastProcessedIndex() external view returns (uint256) {
        return dividendTracker.getLastProcessedIndex();
    }

    function getNumberOfDividendTokenHolders() external view returns (uint256) {
        return dividendTracker.getNumberOfTokenHolders();
    }

    function _getTradingIsEnabled() internal view returns (bool) {
        return block.timestamp >= tradingEnabledTimestamp;
    }

    function _earlyParticipantSellDate() internal view returns (uint256) {
        return tradingEnabledTimestamp.add(_oneDay * 2);
    }

    function _canEarlyParticipantSell() internal view returns (bool) {
        return block.timestamp >= _earlyParticipantSellDate();
    }

    function getTradingIsEnabled() public view returns (bool) {
        return _getTradingIsEnabled();
    }

    function canEarlyParticipantSell() public view returns (bool) {
        return _canEarlyParticipantSell();
    }

    function earlyParticipantSellDate() public view returns (uint256) {
        return _earlyParticipantSellDate();
    }

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        require(from != address(0), "ERC20: transfer from the zero address");
        require(to != address(0), "ERC20: transfer to the zero address");

        bool tradingIsEnabled = _getTradingIsEnabled();

        // only early participant addresses can make transfers after the fixed-sale has started
        // and before the public presale is over
        if (!tradingIsEnabled) {
            require(
                canTransferBeforeTradingIsEnabled[from],
                "Se7en: This account cannot send tokens until trading is enabled"
            );
        }

        if (amount == 0) {
            super._transfer(from, to, 0);
            return;
        }

        bool isFixedSaleBuy = from == fixedSaleWallet && to != owner();

        // the fixed-sale can only send tokens to the owner or early participants of the fixed sale in the first 10 minutes,
        // or 600 transactions, whichever is first.
        if (isFixedSaleBuy) {
            require(
                block.timestamp >= fixedSaleStartTimestamp,
                "Se7en: The fixed-sale has not started yet."
            );

            bool openToEveryone = block.timestamp.sub(
                fixedSaleStartTimestamp
            ) >=
            fixedSaleEarlyParticipantDuration ||
            numberOfFixedSaleBuys >= fixedSaleEarlyParticipantBuysThreshold;

            if (!openToEveryone) {
                require(
                    fixedSaleEarlyParticipants[to],
                    "Se7en: The fixed-sale is only available to certain participants at the start"
                );
            }

            if (!fixedSaleBuyers[to]) {
                fixedSaleBuyers[to] = true;
                numberOfFixedSaleBuys = numberOfFixedSaleBuys.add(1);
            }

            emit FixedSaleBuy(
                to,
                amount,
                fixedSaleEarlyParticipants[to],
                numberOfFixedSaleBuys
            );
        }

        // early participant cannot sell during the first two days
        if (
            !swapping &&
        tradingIsEnabled &&
        !_canEarlyParticipantSell() &&
        automatedMarketMakerPairs[to] // sells only by detecting transfer to automated market maker pair
        ) {
            require(
                !fixedSaleEarlyParticipants[from],
                "Se7en: The fixed-sale participants must wait 2 days to sell"
            );
        }

        // check max sell transaction
        if (
            !swapping &&
        tradingIsEnabled &&
        automatedMarketMakerPairs[to] && // sells only by detecting transfer to automated market maker pair
        from != address(uniswapV2Router) && // router -> pair is removing liquidity which shouldn't have max
        !_isExcludedFromFees[to] // no max for those excluded from fees
        ) {
            require(
                amount <= maxSellTransactionAmount,
                "Sell transfer amount exceeds the maxSellTransactionAmount."
            );
        }

        // check max wallet size
        if (
            !swapping &&
        tradingIsEnabled &&
        to != address(0xdead) && // no max wallet size for burn
        !automatedMarketMakerPairs[to] && // no max wallet size for market makers
        !_isExcludedFromFees[to] // excluded from fees also excluded from max wallet size
        ) {
            uint256 contractBalanceRecepient = balanceOf(to);
            require(
                contractBalanceRecepient + amount <= maxWalletAmount,
                "Exceeds maximum wallet token amount."
            );
        }

        (uint256 totalFees, uint256 liquidityFee) = _getCurrentFees(from, to);

        if (
            !swapping &&
        tradingIsEnabled &&
        automatedMarketMakerPairs[to] && // sells only by detecting transfer to automated market maker pair
        from != address(uniswapV2Router) && // router -> pair is removing liquidity which shouldn't be restricted
        isLargeFeeBlocksSells // fail safe
        ) {
            // This is where we block sells (i.e. fees are too high to sell)
            require(totalFees < 9000, "Sell not possible at this time");
        }

        uint256 contractTokenBalance = balanceOf(address(this));
        bool canSwap = contractTokenBalance >= swapTokensAtAmount;

        if (tradingIsEnabled && canSwap) {
            _swapLiquifyAndDividend(
                from,
                to,
                canSwapForLiquidityAndDividendsOnBuys, // Default: Do not swap on buys. I hope this is fixed in PCS someday.
                true, // Do swap on sells
                swapTokensAtAmount, // Use the same number every time
                totalFees,
                liquidityFee
            );
        }

        bool takeFee = !isFixedSaleBuy && tradingIsEnabled && !swapping;

        // if any account belongs to _isExcludedFromFee account then remove the fee
        if (_isExcludedFromFees[from] || _isExcludedFromFees[to]) {
            takeFee = false;
        }

        if (takeFee) {
            uint256 fees = amount.mul(totalFees).div(_oneHunnid).div(
                _oneHunnid
            );
            // extra div to remove extra decimals places (fees as 100 for 1%)

            amount = amount.sub(fees);

            super._transfer(from, address(this), fees);
            emit FeesPaid(from, totalFees);
        }

        super._transfer(from, to, amount);

        try
        dividendTracker.setBalance(payable(from), balanceOf(from))
        {} catch {}
        try dividendTracker.setBalance(payable(to), balanceOf(to)) {} catch {}

        if (!swapping) {
            uint256 gas = gasForProcessing;

            try dividendTracker.process(gas) returns (
                uint256 iterations,
                uint256 claims,
                uint256 lastProcessedIndex
            ) {
                emit ProcessedDividendTracker(
                    iterations,
                    claims,
                    lastProcessedIndex,
                    true,
                    gas,
                    tx.origin
                );
            } catch {}
        }
    }

    // Manually trigger swap for liquify and dividend
    function swapLiquifyAndDividend(
        address fauxAddress, // just to allow swap to happen
        uint256 rewardFee,
        uint256 liquidityFee,
        uint256 tokensToSwapAndSell
    ) external onlyAdmin(4) {
        _swapLiquifyAndDividend(
            fauxAddress,
            fauxAddress,
            true,
            true,
            tokensToSwapAndSell,
            rewardFee.add(liquidityFee),
            liquidityFee
        );
    }

    function _swapLiquifyAndDividend(
        address from,
        address to,
        bool canSwapOnBuys,
        bool canSwapOnSells,
        uint256 tokensToSwapAndSell,
        uint256 totalFees,
        uint256 liquidityFee
    ) internal {
        if (
            isSwapForLiquifyAndDividendsEnabled &&
            !swapping &&
            (canSwapOnSells || !automatedMarketMakerPairs[to]) &&
            (canSwapOnBuys || !automatedMarketMakerPairs[from]) &&
            from != liquidityWallet &&
            to != liquidityWallet
        ) {
            swapping = true;

            uint256 swapTokens = tokensToSwapAndSell.mul(liquidityFee).div(
                totalFees
            );
            swapAndLiquify(swapTokens);

            uint256 sellTokens = tokensToSwapAndSell.sub(swapTokens);
            swapAndSendDividends(sellTokens);

            swapping = false;
        }
    }

    function swapAndLiquify(uint256 tokens) private {
        // split the contract balance into halves
        uint256 half = tokens.div(2);
        uint256 otherHalf = tokens.sub(half);

        // capture the contract's current ETH balance.
        // this is so that we can capture exactly the amount of ETH that the
        // swap creates, and not make the liquidity event include any ETH that
        // has been manually sent to the contract
        uint256 initialBalance = address(this).balance;

        // swap tokens for ETH
        swapTokensForEth(half);
        // <- this breaks the ETH -> HATE swap when swap+liquify is triggered

        // how much ETH did we just swap into?
        uint256 newBalance = address(this).balance.sub(initialBalance);

        // add liquidity to uniswap
        addLiquidity(otherHalf, newBalance);

        emit SwapAndLiquify(half, newBalance, otherHalf);
    }

    function swapTokensForEth(uint256 tokenAmount) private {
        // generate the uniswap pair path of token -> weth
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = uniswapV2Router.WETH();

        _approve(address(this), address(uniswapV2Router), tokenAmount);

        // make the swap
        uniswapV2Router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            tokenAmount,
            0, // accept any amount of ETH
            path,
            address(this),
            block.timestamp
        );
    }

    function addLiquidity(uint256 tokenAmount, uint256 ethAmount) private {
        // approve token transfer to cover all possible scenarios
        _approve(address(this), address(uniswapV2Router), tokenAmount);

        // add the liquidity
        uniswapV2Router.addLiquidityETH{value : ethAmount}(
            address(this),
            tokenAmount,
            0, // slippage is unavoidable
            0, // slippage is unavoidable
            liquidityWallet,
            block.timestamp
        );
    }

    function swapAndSendDividends(uint256 tokens) private {
        swapTokensForEth(tokens);
        uint256 dividends = address(this).balance;
        (bool success,) = address(dividendTracker).call{value : dividends}("");

        if (success) {
            emit SendDividends(tokens, dividends);
        }
    }

    function _getFees(
        uint256 timestamp,
        address from,
        address to
    ) internal view returns (uint256 totalFees, uint256 liquidityFee) {
        bool isAMMSell = automatedMarketMakerPairs[to];
        bool isAMMBuy = automatedMarketMakerPairs[from];

        if (isAMMBuy || isAMMSell) {
            // referenceTimeStamp = 868233600; // Date and time (GMT): Monday, July 7, 1997 0:00:00
            require(
                timestamp > referenceTimeStamp,
                "Cannot view data before referenceTimeStamp"
            );
            uint256 absTimeDiffSec = timestamp.sub(referenceTimeStamp);
            uint256 absTimeDiffHours = absTimeDiffSec.div(60).div(60);
            uint256 absTimeDiffDays = absTimeDiffHours.div(24);
            uint256 dayIndex = absTimeDiffDays % 7;

            FeePair memory feePair;
            if (dayIndex < 6) {
                // it's an unholy day
                feePair = unholyDayFee[dayIndex];
            } else {
                // it's the holy day
                uint256 hourIndex = absTimeDiffHours % 24;
                feePair = holyDayFee[hourIndex];
            }

            if (isAMMBuy) {
                (totalFees, liquidityFee) = (
                feePair.rewardBuyFee + feePair.liquidityBuyFee,
                feePair.liquidityBuyFee
                );
            }

            if (isAMMSell) {
                (totalFees, liquidityFee) = (
                feePair.rewardSellFee + feePair.liquiditySellFee,
                feePair.liquiditySellFee
                );
            }
        } else {
            // Transfers have 2% fee
            (totalFees, liquidityFee) = (200, 100);
        }
    }

    function _getCurrentFees(address from, address to)
    internal
    view
    returns (uint256 totalFees, uint256 liquidityFee)
    {
        (totalFees, liquidityFee) = _getFees(block.timestamp, from, to);
    }

    function _setUnholyDayFee(
        uint16 dayIndex,
        uint16 rewardBuy,
        uint16 liqBuy,
        uint16 rewardSell,
        uint16 liqSell
    ) internal {
        FeePair memory current;
        current.rewardBuyFee = rewardBuy;
        current.liquidityBuyFee = liqBuy;
        current.rewardSellFee = rewardSell;
        current.liquiditySellFee = liqSell;
        unholyDayFee[dayIndex] = current;
        emit SetUnholyDayFee(dayIndex, rewardBuy, liqBuy, rewardSell, liqSell);
    }

    function _setHolyDayFee(
        uint16 hourIndex,
        uint16 rewardBuy,
        uint16 liqBuy,
        uint16 rewardSell,
        uint16 liqSell
    ) internal {
        FeePair memory current;
        current.rewardBuyFee = rewardBuy;
        current.liquidityBuyFee = liqBuy;
        current.rewardSellFee = rewardSell;
        current.liquiditySellFee = liqSell;
        holyDayFee[hourIndex] = current;
        emit SetHolyDayFee(hourIndex, rewardBuy, liqBuy, rewardSell, liqSell);
    }

    function getCurrentFees(address from, address to)
    external
    view
    returns (uint256 totalFees, uint256 liquidityFee)
    {
        (totalFees, liquidityFee) = _getCurrentFees(from, to);
    }

    function getFees(
        uint256 timestamp,
        address from,
        address to
    ) external view returns (uint256 totalFees, uint256 liquidityFee) {
        (totalFees, liquidityFee) = _getFees(timestamp, from, to);
    }

    function getAllHolyDayFees()
    external
    view
    returns (FeePair[24] memory pairs)
    {
        return holyDayFee;
    }

    function getAllUnholyDayFees()
    external
    view
    returns (FeePair[6] memory pairs)
    {
        return unholyDayFee;
    }

    function setUnholyDayFee(
        uint16 dayIndex,
        uint16 rewardBuy,
        uint16 liqBuy,
        uint16 rewardSell,
        uint16 liqSell
    ) external onlyAdmin(2) {
        _setUnholyDayFee(dayIndex, rewardBuy, liqBuy, rewardSell, liqSell);
    }

    function setHolyDayFee(
        uint16 hourIndex,
        uint16 rewardBuy,
        uint16 liqBuy,
        uint16 rewardSell,
        uint16 liqSell
    ) external onlyAdmin(2) {
        _setHolyDayFee(hourIndex, rewardBuy, liqBuy, rewardSell, liqSell);
    }

    function setUnholyDayFee(FeePair[6] calldata pairs) external onlyAdmin(2) {
        FeePair memory pair;
        for (uint8 i = 0; i < pairs.length; i++) {
            pair = pairs[i];
            _setUnholyDayFee(
                i,
                pair.rewardBuyFee,
                pair.liquidityBuyFee,
                pair.rewardSellFee,
                pair.liquiditySellFee
            );
        }
    }

    function setHolyDayFee(FeePair[24] calldata pairs) external onlyAdmin(2) {
        FeePair memory pair;
        for (uint8 i = 0; i < pairs.length; i++) {
            pair = pairs[i];
            _setHolyDayFee(
                i,
                pair.rewardBuyFee,
                pair.liquidityBuyFee,
                pair.rewardSellFee,
                pair.liquiditySellFee
            );
        }
    }

    function setStartingConditions(
        uint256 _fixedSaleEarlyParticipantDuration,
        uint256 _fixedSaleEarlyParticipantBuysThreshold,
        uint256 _fixedSaleStartTimestamp,
        uint256 _tradingEnabledTimestamp,
        address _fixedSaleWallet
    ) external onlyAdmin(2) {
        require(
            !fixStartingConditions,
            "The starting conditions are fixed forever."
        );
        fixedSaleEarlyParticipantDuration = _fixedSaleEarlyParticipantDuration;
        fixedSaleEarlyParticipantBuysThreshold = _fixedSaleEarlyParticipantBuysThreshold;
        fixedSaleStartTimestamp = _fixedSaleStartTimestamp;
        tradingEnabledTimestamp = _tradingEnabledTimestamp;

        // Only process updates
        if (
            fixedSaleWallet != _fixedSaleWallet &&
            _fixedSaleWallet != address(0)
        ) {
            // Note each time a new fixedSaleWallet is set it will be excluded from dividends

            // remove old wallet from transfer before trading enabled
            canTransferBeforeTradingIsEnabled[fixedSaleWallet] = false;

            // Update new fixed sale wallet
            fixedSaleWallet = _fixedSaleWallet;

            // exclude from receiving dividends
            try
            dividendTracker.excludeFromDividends(_fixedSaleWallet)
            {} catch {}

            // enable owner and fixed-sale wallet to send tokens before presales are over
            canTransferBeforeTradingIsEnabled[_fixedSaleWallet] = true;
        }
    }

    function setFixStartingConditions() external onlyAdmin(2) {
        // Can only call this once
        fixStartingConditions = true;
    }

    function setCanSwapForLiquidityAndDividendsOnBuys(bool _canSwap)
    external
    onlyAdmin(2)
    {
        canSwapForLiquidityAndDividendsOnBuys = _canSwap;
    }

    function setIsLargeFeeBlocksSells(bool _isLargeFeeBlocksSells)
    external
    onlyAdmin(2)
    {
        isLargeFeeBlocksSells = _isLargeFeeBlocksSells;
    }

    function setIsSwapForLiquifyAndDividendsEnabled(
        bool _isSwapForLiquifyAndDividendsEnabled
    ) external onlyAdmin(2) {
        isSwapForLiquifyAndDividendsEnabled = _isSwapForLiquifyAndDividendsEnabled;
    }

    function setSwapTokensAtAmount(uint256 _swapTokensAtAmount)
    external
    onlyAdmin(2)
    {
        swapTokensAtAmount = _swapTokensAtAmount;
    }
}

contract Se7enDividendTracker is DividendPayingToken, Adminable {
    using SafeMath for uint256;
    using SafeMathInt for int256;
    using IterableMapping for IterableMapping.Map;

    IterableMapping.Map private tokenHoldersMap;
    uint256 public lastProcessedIndex;

    mapping(address => bool) public excludedFromDividends;

    mapping(address => uint256) public lastClaimTimes;

    uint256 public claimWait;
    uint256 public minimumTokenBalanceForDividends;

    event ExcludeFromDividends(address indexed account);
    event ClaimWaitUpdated(uint256 indexed newValue, uint256 indexed oldValue);

    event Claim(
        address indexed account,
        uint256 amount,
        bool indexed automatic
    );

    constructor()
    public
    DividendPayingToken("Se7en_Dividend_Tracker", "Se7en_Dividend_Tracker")
    {
        claimWait = 3600;
        minimumTokenBalanceForDividends = 10000 * (10 ** 18);
        //must hold 10000+ tokens
    }

    function _transfer(
        address,
        address,
        uint256
    ) internal override {
        require(false, "Se7en_Dividend_Tracker: No transfers allowed");
    }

    function withdrawDividend() public override {
        require(
            false,
            "Se7en_Dividend_Tracker: withdrawDividend disabled. Use the 'claim' function on the main Se7en contract."
        );
    }

    // Once excluded you cannot be included again
    function excludeFromDividends(address account) external onlyAdmin(2) {
        require(!excludedFromDividends[account]);
        excludedFromDividends[account] = true;

        _setBalance(account, 0);
        tokenHoldersMap.remove(account);

        emit ExcludeFromDividends(account);
    }

    function updateClaimWait(uint256 newClaimWait) external onlyAdmin(2) {
        require(
            newClaimWait >= 3600 && newClaimWait <= 86400,
            "Se7en_Dividend_Tracker: claimWait must be updated to between 1 and 24 hours"
        );
        require(
            newClaimWait != claimWait,
            "Se7en_Dividend_Tracker: Cannot update claimWait to same value"
        );
        emit ClaimWaitUpdated(newClaimWait, claimWait);
        claimWait = newClaimWait;
    }

    // We will mostly likely not use this unless major growth
    function setMinimumTokenBalanceForDividends(
        uint256 _minimumTokenBalanceForDividends
    ) external onlyAdmin(2) {
        minimumTokenBalanceForDividends = _minimumTokenBalanceForDividends;
    }

    function getLastProcessedIndex() external view returns (uint256) {
        return lastProcessedIndex;
    }

    function getNumberOfTokenHolders() external view returns (uint256) {
        return tokenHoldersMap.keys.length;
    }

    function getAccount(address _account)
    public
    view
    returns (
        address account,
        int256 index,
        int256 iterationsUntilProcessed,
        uint256 withdrawableDividends,
        uint256 totalDividends,
        uint256 lastClaimTime,
        uint256 nextClaimTime,
        uint256 secondsUntilAutoClaimAvailable
    )
    {
        account = _account;

        index = tokenHoldersMap.getIndexOfKey(account);

        iterationsUntilProcessed = - 1;

        if (index >= 0) {
            if (uint256(index) > lastProcessedIndex) {
                iterationsUntilProcessed = index.sub(
                    int256(lastProcessedIndex)
                );
            } else {
                uint256 processesUntilEndOfArray = tokenHoldersMap.keys.length >
                lastProcessedIndex
                ? tokenHoldersMap.keys.length.sub(lastProcessedIndex)
                : 0;

                iterationsUntilProcessed = index.add(
                    int256(processesUntilEndOfArray)
                );
            }
        }

        withdrawableDividends = withdrawableDividendOf(account);
        totalDividends = accumulativeDividendOf(account);

        lastClaimTime = lastClaimTimes[account];

        nextClaimTime = lastClaimTime > 0 ? lastClaimTime.add(claimWait) : 0;

        secondsUntilAutoClaimAvailable = nextClaimTime > block.timestamp
        ? nextClaimTime.sub(block.timestamp)
        : 0;
    }

    function getAccountAtIndex(uint256 index)
    public
    view
    returns (
        address,
        int256,
        int256,
        uint256,
        uint256,
        uint256,
        uint256,
        uint256
    )
    {
        if (index >= tokenHoldersMap.size()) {
            return (
            0x0000000000000000000000000000000000000000,
            - 1,
            - 1,
            0,
            0,
            0,
            0,
            0
            );
        }

        address account = tokenHoldersMap.getKeyAtIndex(index);

        return getAccount(account);
    }

    function canAutoClaim(uint256 lastClaimTime) private view returns (bool) {
        if (lastClaimTime > block.timestamp) {
            return false;
        }

        return block.timestamp.sub(lastClaimTime) >= claimWait;
    }

    function setBalance(address payable account, uint256 newBalance)
    external
    onlyAdmin(2)
    {
        if (excludedFromDividends[account]) {
            return;
        }

        if (newBalance >= minimumTokenBalanceForDividends) {
            _setBalance(account, newBalance);
            tokenHoldersMap.set(account, newBalance);
        } else {
            _setBalance(account, 0);
            tokenHoldersMap.remove(account);
        }

        processAccount(account, true);
    }

    function process(uint256 gas)
    public
    returns (
        uint256,
        uint256,
        uint256
    )
    {
        uint256 numberOfTokenHolders = tokenHoldersMap.keys.length;

        if (numberOfTokenHolders == 0) {
            return (0, 0, lastProcessedIndex);
        }

        uint256 _lastProcessedIndex = lastProcessedIndex;

        uint256 gasUsed = 0;

        uint256 gasLeft = gasleft();

        uint256 iterations = 0;
        uint256 claims = 0;

        while (gasUsed < gas && iterations < numberOfTokenHolders) {
            _lastProcessedIndex++;

            if (_lastProcessedIndex >= tokenHoldersMap.keys.length) {
                _lastProcessedIndex = 0;
            }

            address account = tokenHoldersMap.keys[_lastProcessedIndex];

            if (canAutoClaim(lastClaimTimes[account])) {
                if (processAccount(payable(account), true)) {
                    claims++;
                }
            }

            iterations++;

            uint256 newGasLeft = gasleft();

            if (gasLeft > newGasLeft) {
                gasUsed = gasUsed.add(gasLeft.sub(newGasLeft));
            }

            gasLeft = newGasLeft;
        }

        lastProcessedIndex = _lastProcessedIndex;

        return (iterations, claims, lastProcessedIndex);
    }

    function processAccount(address payable account, bool automatic)
    public
    onlyAdmin(2)
    returns (bool)
    {
        uint256 amount = _withdrawDividendOfUser(account);

        if (amount > 0) {
            lastClaimTimes[account] = block.timestamp;
            emit Claim(account, amount, automatic);
            return true;
        }

        return false;
    }
}