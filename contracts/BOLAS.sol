// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

// OpenZeppelin libs
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
// UniSwap libs
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router01.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
// Dividend tracker
import "./DividendTracker/BOLASDividendTracker.sol";

contract BOLAS is Initializable, ERC20Upgradeable, OwnableUpgradeable, UUPSUpgradeable {

    // Keeps track of balances for address.
    mapping(address => uint256) private _balances;

    // Keeps track of which address are excluded from fee.
    mapping(address => bool) private _isExcludedFromFee;

    // store addresses that a automatic market maker pairs
    mapping(address => bool) public automatedMarketMakerPairs;

    // Liquidity pool provider router
    IUniswapV2Router02 public uniswapV2Router;

    // This Token and WETH pair contract address.
    address internal _uniswapV2Pair;

    // Where burnt tokens are sent to. This is an address that no one can have accesses to.
    address private constant burnAccount = 0x000000000000000000000000000000000000dEaD;

    // This percent of a transaction will be burnt.
    uint8 private _taxBurn;

    // This percent of a transaction will be dividend.
    uint8 private _taxDividend;

    // This percent of a transaction will be added to the liquidity pool. More details at https://github.com/Sheldenshi/ERC20Deflationary.
    uint8 private _taxLiquify;

    // ERC20 Token Standard
    uint256 private _totalSupply;

    // Total amount of tokens burnt.
    uint256 private _totalBurnt;

    // Total amount of tokens locked in the LP (this token and WETH pair).
    uint256 private _totalTokensLockedInLiquidity;

    // Total amount of ETH locked in the LP (this token and WETH pair).
    uint256 private _totalETHLockedInLiquidity;

    // A threshold for swap and liquify.
    uint256 private _minTokensBeforeSwap;

    // Whether a previous call of SwapAndLiquify process is still in process.
    bool private _inSwapAndLiquify;

    bool private _autoSwapAndLiquifyEnabled;
    bool private _autoBurnEnabled;
    bool private _autoDividendEnabled;

    // Dividend states
    BOLASDividendTracker public dividendTracker;
    bool public isAutoDividendProcessing;
    uint256 public gasForProcessing = 150000; // processing auto-claiming dividends

    // Prevent reentrancy.
    modifier lockTheSwap {
        require(!_inSwapAndLiquify, "Currently in swap and liquify.");
        _inSwapAndLiquify = true;
        _;
        _inSwapAndLiquify = false;
    }

    // Return values of _getValues function.
    struct ValuesFromAmount {
        // Amount of tokens for to transfer.
        uint256 amount;
        // Amount tokens charged for burning.
        uint256 burnFee;
        // Amount tokens charged for dividends.
        uint256 dividendFee;
        // Amount tokens charged to add to liquidity.
        uint256 liquifyFee;
        // Amount of total fee
        uint256 totalFee;
        // Amount tokens after fees.
        uint256 transferAmount;
    }

    /*
        Events
    */
    event Burn(address from, uint256 amount);
    event TaxBurnUpdate(uint8 previousTax, uint8 currentTax);
    event TaxDividendUpdate(uint8 previousTax, uint8 currentTax);
    event TaxLiquifyUpdate(uint8 previousTax, uint8 currentTax);
    event MinTokensBeforeSwapUpdated(uint256 previous, uint256 current);
    event SwapAndLiquify(
        uint256 tokensSwapped,
        uint256 ethReceived,
        uint256 tokensAddedToLiquidity
    );
    event ExcludeAccountFromFee(address account);
    event IncludeAccountInFee(address account);
    event EnabledAutoBurn();
    event EnabledAutoDividend();
    event EnabledAutoSwapAndLiquify();
    event DisabledAutoBurn();
    event DisabledAutoDividend();
    event DisabledAutoSwapAndLiquify();
    event Airdrop(uint256 amount);
    event ExcludeMultipleAccountsFromFees(address[] accounts, bool isExcluded);
    event UpdateDividendTracker(address indexed newAddress, address indexed oldAddress);
    event ProcessedDividendTracker(
        uint256 iterations,
        uint256 claims,
        uint256 lastProcessedIndex,
        bool indexed automatic,
        uint256 gas,
        address indexed processor
    );
    event GasForProcessingUpdated(uint256 indexed newValue, uint256 indexed oldValue);

    function initialize(address dividendTracker_) initializer public {
        __ERC20_init("BOLAS", "BOLAS");
        __Ownable_init();
        __UUPSUpgradeable_init();

        // exclude owner and this contract from fee.
        excludeAccountFromFee(owner());
        excludeAccountFromFee(address(this));

        // dividend
        updateDividendTracker(dividendTracker_);

        // configure fees
        enableAutoBurn(600);
        enableAutoDividend(300);
        enableAutoSwapAndLiquify(200, 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D, 1000000000000 * 10 ** decimals());

        // Add initial supply to sender
        _mint(msg.sender, 160000000000000 * 10 ** decimals());
    }

    function _authorizeUpgrade(address newImplementation)
    internal
    onlyOwner
    override
    {}

    // allow the contract to receive ETH
    receive() external payable {}

    /**
     * @dev See {IERC20-totalSupply}.
     */
    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
    }

    /**
     * @dev See {IERC20-balanceOf}.
     */
    function balanceOf(address account) public view override returns (uint256) {
        return _balances[account];
    }

    /**
     * @dev Returns the address of this token and WETH pair.
     */
    function uniswapV2Pair() public view returns (address) {
        return _uniswapV2Pair;
    }

    /**
     * @dev Returns the current burn tax.
     */
    function taxBurn() public view returns (uint8) {
        return _taxBurn;
    }

    /**
     * @dev Returns the current liquify tax.
     */
    function taxLiquify() public view returns (uint8) {
        return _taxLiquify;
    }

    /**
    * @dev Returns true if auto burn feature is enabled.
     */
    function autoBurnEnabled() public view returns (bool) {
        return _autoBurnEnabled;
    }

    /**
     * @dev Returns true if auto swap and liquify feature is enabled.
     */
    function autoSwapAndLiquifyEnabled() public view returns (bool) {
        return _autoSwapAndLiquifyEnabled;
    }

    /**
     * @dev Returns the threshold before swap and liquify.
     */
    function minTokensBeforeSwap() external view returns (uint256) {
        return _minTokensBeforeSwap;
    }

    /**
     * @dev Returns the total number of tokens burnt.
     */
    function totalBurnt() external view returns (uint256) {
        return _totalBurnt;
    }

    /**
     * @dev Returns the total number of tokens locked in the LP.
     */
    function totalTokensLockedInLiquidity() external view returns (uint256) {
        return _totalTokensLockedInLiquidity;
    }

    /**
     * @dev Returns the total number of ETH locked in the LP.
     */
    function totalETHLockedInLiquidity() external view returns (uint256) {
        return _totalETHLockedInLiquidity;
    }

    /**
     * @dev Returns whether an account is excluded from fee.
     */
    function isExcludedFromFee(address account) external view returns (bool) {
        return _isExcludedFromFee[account];
    }

    // Dividend methods
    function getLastProcessedIndex() external view returns (uint256) {
        return dividendTracker.getLastProcessedIndex();
    }

    function getNumberOfDividendTokenHolders() external view returns (uint256) {
        return dividendTracker.getNumberOfTokenHolders();
    }

    function getClaimWait() external view returns (uint256) {
        return dividendTracker.claimWait();
    }

    function getTotalDividendsDistributed() external view returns (uint256) {
        return dividendTracker.totalDividendsDistributed();
    }

    function isExcludedFromDividends(address account) public view returns (bool) {
        return dividendTracker.isExcludedFromDividends(account);
    }

    function withdrawableDividendOf(address account) external view returns (uint256) {
        return dividendTracker.withdrawableDividendOf(account);
    }

    function hasDividends(address account) external view returns (bool) {
        (,int256 index, , , , , ,) = dividendTracker.getAccount(account);
        return (index > - 1);
    }

    function getAccountDividendsInfo(address account)
    external view returns (
        address,
        int256,
        int256,
        uint256,
        uint256,
        uint256,
        uint256,
        uint256) {
        return dividendTracker.getAccount(account);
    }

    function getAccountDividendsInfoAtIndex(uint256 index)
    external view returns (
        address,
        int256,
        int256,
        uint256,
        uint256,
        uint256,
        uint256,
        uint256) {
        return dividendTracker.getAccountAtIndex(index);
    }

    function excludeFromDividends(address account, bool exclude) public onlyOwner {
        dividendTracker.excludeFromDividends(account, exclude);
    }

    function updateDividendTracker(address newAddress) public onlyOwner {
        require(newAddress != address(dividendTracker), "Tracker already has been set!");
        BOLASDividendTracker newDividendTracker = BOLASDividendTracker(payable(newAddress));
        require(newDividendTracker.owner() == address(this), "Tracker must be owned by token");
        newDividendTracker.excludeFromDividends(address(newDividendTracker), true);
        newDividendTracker.excludeFromDividends(address(this), true);
        newDividendTracker.excludeFromDividends(owner(), true);
        newDividendTracker.excludeFromDividends(burnAccount, true);
        // todo exclude fee wallets from the dividend tracker
        // newDividendTracker.excludeFromDividends(address(devAddress), true);
        emit UpdateDividendTracker(newAddress, address(dividendTracker));
        dividendTracker = newDividendTracker;
    }

    function updateGasForProcessing(uint256 newValue) external onlyOwner {
        require(newValue != gasForProcessing, "Value has been assigned!");
        emit GasForProcessingUpdated(newValue, gasForProcessing);
        gasForProcessing = newValue;
    }

    function updateClaimWait(uint256 claimWait) external onlyOwner {
        dividendTracker.updateClaimWait(claimWait);
    }

    function updateMinimumForDividends(uint256 amount) external onlyOwner {
        dividendTracker.updateMinimumForDividends(amount);
    }

    function processDividendTracker(uint256 gas) external {
        (uint256 iterations, uint256 claims, uint256 lastProcessedIndex) = dividendTracker.process(gas);
        emit ProcessedDividendTracker(iterations, claims, lastProcessedIndex, false, gas, tx.origin);
    }

    function claim() external {
        dividendTracker.processAccount(payable(msg.sender));
    }

    function switchAutoDividendProcessing(bool enabled) external onlyOwner {
        require(enabled != isAutoDividendProcessing, "already has been set!");
        isAutoDividendProcessing = enabled;
    }

    /** @dev Creates `amount` tokens and assigns them to `account`, increasing
     * the total supply.
     *
     * Emits a {Transfer} event with `from` set to the zero address.
     *
     * Requirements:
     *
     * - `account` cannot be the zero address.
     */
    function _mint(address account, uint256 amount) internal override {
        require(account != address(0), "ERC20: mint to the zero address");

        _beforeTokenTransfer(address(0), account, amount);

        _totalSupply += amount;
        _balances[account] += amount;
        emit Transfer(address(0), account, amount);

        _afterTokenTransfer(address(0), account, amount);
    }

    /**
     * @dev Destroys `amount` tokens from `account`, reducing the
     * total supply.
     *
     * Emits a {Burn} event indicating the amount burnt.
     * Emits a {Transfer} event with `to` set to the burn address.
     *
     * Requirements:
     *
     * - `account` cannot be the zero address.
     * - `account` must have at least `amount` tokens.
     */

    function _burn(address account, uint256 amount) internal override {
        require(account != burnAccount, "ERC20: burn from the burn address");

        uint256 accountBalance = balanceOf(account);
        require(accountBalance >= amount, "ERC20: burn amount exceeds balance");

        // Transfer from account to the burnAccount
    unchecked {
        _balances[account] = accountBalance - amount;
    }
        _balances[burnAccount] += amount;

        _totalSupply -= amount;
        _totalBurnt += amount;

        emit Burn(account, amount);
        emit Transfer(account, burnAccount, amount);
    }

    /**
     * @dev Moves tokens `amount` from `sender` to `recipient`.
     *
     * This is internal function is equivalent to {transfer}, and can be used to
     * e.g. implement automatic token fees, slashing mechanisms, etc.
     *
     * Emits a {Transfer} event.
     *
     * Requirements:
     *
     * - `sender` cannot be the zero address.
     * - `recipient` cannot be the zero address.
     * - `sender` must have a balance of at least `amount`.
     */
    function _transfer(address sender, address recipient, uint256 amount) internal override {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");

        if (amount == 0) {
            super._transfer(sender, recipient, 0);
            return;
        }

        // process fees
        bool takeFee = !_isExcludedFromFee[sender];
        ValuesFromAmount memory values = _getValues(amount, takeFee);
        if (takeFee) {
            super._transfer(sender, address(this), values.totalFee);
        }

        // send tokens to recipient
        super._transfer(sender, recipient, values.transferAmount);

        // process swaps
        _processTransferSwaps(sender);

        // process dividends
        _processTransferDividends(sender, recipient);
    }

    function _processTransferDividends(address sender, address recipient) internal {
        uint256 fromBalance = balanceOf(sender);
        uint256 toBalance = balanceOf(recipient);

        dividendTracker.setBalance(payable(sender), fromBalance);
        dividendTracker.setBalance(payable(recipient), toBalance);

        if (!_inSwapAndLiquify && isAutoDividendProcessing) {
            uint256 gas = gasForProcessing;

            try dividendTracker.process(gas) returns (uint256 iterations, uint256 claims, uint256 lastProcessedIndex) {
                emit ProcessedDividendTracker(iterations, claims, lastProcessedIndex, true, gas, tx.origin);
            } catch {}
        }
    }

    function _processTransferSwaps(address sender) internal {
        if (!_inSwapAndLiquify && _autoSwapAndLiquifyEnabled) {
            uint256 contractTokenBalance = balanceOf(address(this));
            // whether the current contract balances makes the threshold to swap and liquify.
            bool overMinTokensBeforeSwap = contractTokenBalance >= _minTokensBeforeSwap;

            if (overMinTokensBeforeSwap && !automatedMarketMakerPairs[sender]) {
                _inSwapAndLiquify = true;
                // todo implement swapping
                // swapAndSend(contractTokenBalance);
                _inSwapAndLiquify = false;
            }
        }
    }

    /**
      * @dev Performs all the functionalities that are enabled.
      */
    function _afterTokenTransfer(ValuesFromAmount memory values) internal {
        // Burn
        if (_autoBurnEnabled) {
            _balances[address(this)] += values.burnFee;
            _burn(address(this), values.burnFee);
        }

        // Dividend
        if (_autoDividendEnabled) {
        }

        // Add to liquidity pool
        if (_autoSwapAndLiquifyEnabled) {
            // add liquidity fee to this contract.
            _balances[address(this)] += values.liquifyFee;

            uint256 contractBalance = _balances[address(this)];

            // whether the current contract balances makes the threshold to swap and liquify.
            bool overMinTokensBeforeSwap = contractBalance >= _minTokensBeforeSwap;

            if (overMinTokensBeforeSwap &&
                !_inSwapAndLiquify &&
                _msgSender() != _uniswapV2Pair &&
                _autoSwapAndLiquifyEnabled
            )
            {
                swapAndLiquify(contractBalance);
            }
        }

    }

    /**
     * @dev Excludes an account from fee.
      *
      * Emits a {ExcludeAccountFromFee} event.
      *
      * Requirements:
      *
      * - `account` is included in fee.
      */
    function excludeAccountFromFee(address account) internal {
        require(!_isExcludedFromFee[account], "Account is already excluded.");

        _isExcludedFromFee[account] = true;

        emit ExcludeAccountFromFee(account);
    }

    /**
     * @dev Excludes multiple accounts from fee.
      *
      * Emits a {ExcludeMultipleAccountsFromFees} event.
      */
    function excludeMultipleAccountsFromFees(
        address[] calldata accounts,
        bool excluded
    ) public onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) {
            _isExcludedFromFee[accounts[i]] = excluded;
        }

        emit ExcludeMultipleAccountsFromFees(accounts, excluded);
    }

    /**
      * @dev Includes an account from fee.
      *
      * Emits a {IncludeAccountFromFee} event.
      *
      * Requirements:
      *
      * - `account` is excluded in fee.
      */
    function includeAccountInFee(address account) internal {
        require(_isExcludedFromFee[account], "Account is already included.");

        _isExcludedFromFee[account] = false;

        emit IncludeAccountInFee(account);
    }

    /**
     * @dev Swap half of contract's token balance for ETH,
     * and pair it up with the other half to add to the
     * liquidity pool.
     *
     * Emits {SwapAndLiquify} event indicating the amount of tokens swapped to eth,
     * the amount of ETH added to the LP, and the amount of tokens added to the LP.
     */
    function swapAndLiquify(uint256 contractBalance) private lockTheSwap {
        // Split the contract balance into two halves.
        uint256 tokensToSwap = contractBalance / 2;
        uint256 tokensAddToLiquidity = contractBalance - tokensToSwap;

        // Contract's current ETH balance.
        uint256 initialBalance = address(this).balance;

        // Swap half of the tokens to ETH.
        swapTokensForEth(tokensToSwap);

        // Figure out the exact amount of tokens received from swapping.
        uint256 ethAddToLiquify = address(this).balance - initialBalance;

        // Add to the LP of this token and WETH pair (half ETH and half this token).
        addLiquidity(ethAddToLiquify, tokensAddToLiquidity);

        _totalETHLockedInLiquidity += address(this).balance - initialBalance;
        _totalTokensLockedInLiquidity += contractBalance - balanceOf(address(this));

        emit SwapAndLiquify(tokensToSwap, ethAddToLiquify, tokensAddToLiquidity);
    }

    /**
     * @dev Swap `amount` tokens for ETH.
     *
     * Emits {Transfer} event. From this contract to the token and WETH Pair.
     */
    function swapTokensForEth(uint256 amount) private {
        // Generate the uniswap pair path of token -> weth
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = uniswapV2Router.WETH();

        _approve(address(this), address(uniswapV2Router), amount);


        // Swap tokens to ETH
        uniswapV2Router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            amount,
            0,
            path,
            address(this), // this contract will receive the eth that were swapped from the token
            block.timestamp + 60 * 1000
        );
    }

    /**
     * @dev Add `ethAmount` of ETH and `tokenAmount` of tokens to the LP.
     * Depends on the current rate for the pair between this token and WETH,
     * `ethAmount` and `tokenAmount` might not match perfectly.
     * Dust(leftover) ETH or token will be refunded to this contract
     * (usually very small quantity).
     *
     * Emits {Transfer} event. From this contract to the token and WETH Pai.
     */
    function addLiquidity(uint256 ethAmount, uint256 tokenAmount) private {
        _approve(address(this), address(uniswapV2Router), tokenAmount);

        // Add the ETH and token to LP.
        // The LP tokens will be sent to burnAccount.
        // No one will have access to them, so the liquidity will be locked forever.
        uniswapV2Router.addLiquidityETH{value : ethAmount}(
            address(this),
            tokenAmount,
            0, // slippage is unavoidable
            0, // slippage is unavoidable
            burnAccount, // the LP is sent to burnAccount.
            block.timestamp + 60 * 1000
        );
    }

    /**
     * @dev Returns fees and transfer amount in tokens.
     * tXXXX stands for tokenXXXX
     * More details can be found at comments for ValuesForAmount Struct.
     */
    function _getValues(uint256 amount, bool deductTransferFee) private view returns (ValuesFromAmount memory) {
        ValuesFromAmount memory values;
        values.amount = amount;

        if (deductTransferFee) {
            values.transferAmount = values.amount;
        } else {
            // calculate fee
            values.burnFee = _calculateTax(values.amount, _taxBurn);
            values.dividendFee = _calculateTax(values.amount, _taxDividend);
            values.liquifyFee = _calculateTax(values.amount, _taxLiquify);
            values.totalFee = values.burnFee + values.dividendFee + values.liquifyFee;

            // amount after fee
            values.transferAmount = values.amount - values.totalFee;
        }

        return values;
    }

    /**
     * @dev Returns fee based on `amount` and `taxRate`
     */
    function _calculateTax(uint256 amount, uint8 tax) private pure returns (uint256) {
        return amount * tax / (10 ** 2) / (10 ** 2);
    }

    /*
        Owner functions
    */

    /**
     * @dev Enables the auto burn feature.
     * Burn transaction amount * `taxBurn_` amount of tokens each transaction when enabled.
     *
     * Emits a {EnabledAutoBurn} event.
     *
     * Requirements:
     *
     * - auto burn feature mush be disabled.
     * - tax must be greater than 0.
     */
    function enableAutoBurn(uint8 taxBurn_) public onlyOwner {
        require(!_autoBurnEnabled, "Auto burn feature is already enabled.");
        require(taxBurn_ > 0, "Tax must be greater than 0.");

        _autoBurnEnabled = true;
        setTaxBurn(taxBurn_);

        emit EnabledAutoBurn();
    }

    /**
     * @dev Enables the auto dividend feature.
     * Dividend transaction amount * `taxDividend_` amount of tokens each transaction when enabled.
     *
     * Emits a {EnabledAutoDividend} event.
     *
     * Requirements:
     *
     * - auto dividend feature mush be disabled.
     * - tax must be greater than 0.
     */
    function enableAutoDividend(uint8 taxDividend_) public onlyOwner {
        require(!_autoDividendEnabled, "Auto dividend feature is already enabled.");
        require(taxDividend_ > 0, "Tax must be greater than 0.");

        _autoDividendEnabled = true;
        setTaxDividend(taxDividend_);

        emit EnabledAutoDividend();
    }

    /**
      * @dev Enables the auto swap and liquify feature.
      * Swaps half of transaction amount * `taxLiquify_` amount of tokens
      * to ETH and pair with the other half of tokens to the LP each transaction when enabled.
      *
      * Emits a {EnabledAutoSwapAndLiquify} event.
      *
      * Requirements:
      *
      * - auto swap and liquify feature mush be disabled.
      * - tax must be greater than 0.
      */
    function enableAutoSwapAndLiquify(uint8 taxLiquify_, address routerAddress, uint256 minTokensBeforeSwap_) public onlyOwner {
        require(!_autoSwapAndLiquifyEnabled, "Auto swap and liquify feature is already enabled.");
        require(taxLiquify_ > 0, "Tax must be greater than 0.");

        _minTokensBeforeSwap = minTokensBeforeSwap_;

        // init Router
        IUniswapV2Router02 _uniswapV2Router = IUniswapV2Router02(routerAddress);

        _uniswapV2Pair = IUniswapV2Factory(_uniswapV2Router.factory()).getPair(address(this), _uniswapV2Router.WETH());

        if (_uniswapV2Pair == address(0)) {
            _uniswapV2Pair = IUniswapV2Factory(_uniswapV2Router.factory())
            .createPair(address(this), _uniswapV2Router.WETH());
        }
        // add pair to automatedMarketMakerPairs
        automatedMarketMakerPairs[_uniswapV2Pair] = true;

        // save router in the contract
        uniswapV2Router = _uniswapV2Router;

        /*
        // exclude uniswapV2Router from paying fees.
        excludeAccountFromFee(address(_uniswapV2Router));
        // exclude WETH and this Token Pair from paying fees.
        excludeAccountFromFee(_uniswapV2Pair);
        */

        // enable
        _autoSwapAndLiquifyEnabled = true;
        setTaxLiquify(taxLiquify_);

        emit EnabledAutoSwapAndLiquify();
    }

    /**
     * @dev Disables the auto burn feature.
     *
     * Emits a {DisabledAutoBurn} event.
     *
     * Requirements:
     *
     * - auto burn feature mush be enabled.
     */
    function disableAutoBurn() public onlyOwner {
        require(_autoBurnEnabled, "Auto burn feature is already disabled.");

        setTaxBurn(0);
        _autoBurnEnabled = false;

        emit DisabledAutoBurn();
    }

    /**
     * @dev Disables the auto dividend feature.
     *
     * Emits a {DisabledAutoDividend} event.
     *
     * Requirements:
     *
     * - auto dividend feature mush be enabled.
     */
    function disableAutoDividend() public onlyOwner {
        require(_autoDividendEnabled, "Auto dividend feature is already disabled.");

        setTaxDividend(0);
        _autoDividendEnabled = false;

        emit DisabledAutoDividend();
    }

    /**
      * @dev Disables the auto swap and liquify feature.
      *
      * Emits a {DisabledAutoSwapAndLiquify} event.
      *
      * Requirements:
      *
      * - auto swap and liquify feature mush be enabled.
      */
    function disableAutoSwapAndLiquify() public onlyOwner {
        require(_autoSwapAndLiquifyEnabled, "Auto swap and liquify feature is already disabled.");

        setTaxLiquify(0);
        _autoSwapAndLiquifyEnabled = false;

        emit DisabledAutoSwapAndLiquify();
    }

    /**
     * @dev Updates `_minTokensBeforeSwap`
      *
      * Emits a {MinTokensBeforeSwap} event.
      *
      * Requirements:
      *
      * - `minTokensBeforeSwap_` must be less than _currentSupply.
      */
    function setMinTokensBeforeSwap(uint256 minTokensBeforeSwap_) public onlyOwner {
        require(minTokensBeforeSwap_ < _totalSupply, "minTokensBeforeSwap must be lower than current supply.");

        uint256 previous = _minTokensBeforeSwap;
        _minTokensBeforeSwap = minTokensBeforeSwap_;

        emit MinTokensBeforeSwapUpdated(previous, _minTokensBeforeSwap);
    }

    /**
      * @dev Updates taxBurn
      *
      * Emits a {TaxBurnUpdate} event.
      *
      * Requirements:
      *
      * - auto burn feature must be enabled.
      * - total tax rate must be less than 100%.
      */
    function setTaxBurn(uint8 taxBurn_) public onlyOwner {
        require(_autoBurnEnabled, "Auto burn feature must be enabled. Try the EnableAutoBurn function.");
        require(taxBurn_ + _taxDividend + _taxLiquify < 10000, "Tax fee too high.");

        uint8 previousTax = _taxBurn;
        _taxBurn = taxBurn_;

        emit TaxBurnUpdate(previousTax, taxBurn_);
    }

    /**
      * @dev Updates taxDividend
      *
      * Emits a {TaxDividendUpdate} event.
      *
      * Requirements:
      *
      * - auto dividend feature must be enabled.
      * - total tax rate must be less than 100%.
      */
    function setTaxDividend(uint8 taxDividend_) public onlyOwner {
        require(_autoDividendEnabled, "Auto dividend feature must be enabled. Try the EnableAutoDividend function.");
        require(_taxBurn + taxDividend_ + _taxLiquify < 10000, "Tax fee too high.");

        uint8 previousTax = _taxDividend;
        _taxDividend = taxDividend_;

        emit TaxDividendUpdate(previousTax, taxDividend_);
    }

    /**
      * @dev Updates taxLiquify
      *
      * Emits a {TaxLiquifyUpdate} event.
      *
      * Requirements:
      *
      * - auto swap and liquify feature must be enabled.
      * - total tax rate must be less than 100%.
      */
    function setTaxLiquify(uint8 taxLiquify_) public onlyOwner {
        require(_autoSwapAndLiquifyEnabled, "Auto swap and liquify feature must be enabled. Try the EnableAutoSwapAndLiquify function.");
        require(_taxBurn + _taxDividend + taxLiquify_ < 10000, "Tax fee too high.");

        uint8 previousTax = _taxLiquify;
        _taxLiquify = taxLiquify_;

        emit TaxLiquifyUpdate(previousTax, taxLiquify_);
    }
}
