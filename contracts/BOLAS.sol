// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

// OpenZeppelin libs
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
// UniSwap libs
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router01.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
// Dividend tracker
import "./DividendTracker/BOLASDividendTracker.sol";
// Utils
import "hardhat/console.sol";
import "./Common/StringUtils.sol";

contract BOLAS is ERC20, Ownable {
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

    // Where app fee tokens are sent to. Used for BOLAS app rewards
    address private _appsWallet;

    // Where marketing fee tokens are sent to.
    address private _marketingWallet;

    // Where liquidity tokens are sent to.
    address private _liquidityWallet;

    // This percent of a transaction will be burnt.
    uint16 private _taxBurn;

    // This percent of a transaction sent to marketing.
    uint16 private _taxMarketing;

    // This percent of a transaction will be dividend.
    uint16 private _taxDividend;

    // This percent of a transaction will be added to the liquidity pool. More details at https://github.com/Sheldenshi/ERC20Deflationary.
    uint16 private _taxLiquify;

    // This percent list of a transaction will be used for app slots.
    uint16[6] private _taxApps;

    uint16 private _totalTaxApps;

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
    bool public isAutoDividendProcessing = true;
    uint256 public gasForProcessing = 150000; // processing auto-claiming dividends

    // Return values of _getValues function.
    struct TokenFeeValues {
        // Amount of tokens for to transfer.
        uint256 amount;
        // Amount tokens charged for burning.
        uint256 burnFee;
        // Amount tokens charged for marketing.
        uint256 marketingFee;
        // Amount tokens charged for dividends.
        uint256 dividendFee;
        // Amount tokens charged to add to liquidity.
        uint256 liquifyFee;
        // Amount of tokens charged for apps.
        uint256 appFee;
        // Amount of total fee
        uint256 totalFeeIntoContract;
        // Amount tokens after fees.
        uint256 transferAmount;
    }

    // Return ETH values of _getSwapValues function.
    struct SwapingETHValues {
        // Amount ETH used for liquidity.
        uint256 liquidityETHAmount;
        // Amount ETH used for dividends.
        uint256 dividendsETHAmount;
        // Amount ETH used for marketing.
        uint256 marketingETHAmount;
    }

    /*
        Events
    */
    event Burn(address from, uint256 amount);
    event TaxBurnUpdate(uint16 previousTax, uint16 currentTax);
    event TaxDividendUpdate(uint16 previousTax, uint16 currentTax);
    event TaxMarketingUpdate(uint16 previousTax, uint16 currentTax);
    event TaxLiquifyUpdate(uint16 previousTax, uint16 currentTax);
    event TaxAppUpdate(uint8 index, uint16 previousTax, uint16 currentTax);
    event AllAppTaxUpdate(uint16[6] appFees);
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
    event ProcessedDividendTracker(
        uint256 iterations,
        uint256 claims,
        uint256 lastProcessedIndex,
        bool indexed automatic,
        uint256 gas,
        address indexed processor
    );
    event GasForProcessingUpdated(uint256 indexed newValue, uint256 indexed oldValue);
    event UpdateAppWallet(address indexed newAddress, address indexed oldAddress);
    event UpdateMarketingWallet(address indexed newAddress, address indexed oldAddress);
    event UpdateLiquidityWallet(address indexed newAddress, address indexed oldAddress);

    constructor(
        address appWallet_,
        address marketingWallet_,
        address liquidityWallet_,
        address swapRouterAddress_) ERC20("BOLAS", "BOLAS") {
        // uniswap initialization
        uniswapV2Router = IUniswapV2Router02(swapRouterAddress_);
        _uniswapV2Pair = IUniswapV2Factory(uniswapV2Router.factory()).createPair(address(this), uniswapV2Router.WETH());
        automatedMarketMakerPairs[_uniswapV2Pair] = true;
        _approve(address(this), address(uniswapV2Router), type(uint256).max);

        // enable features
        switchAutoBurn(600, true);
        switchAutoDividend(300, true);
        switchAutoSwapAndLiquify(100, 10_000_000 * 10 ** decimals(), true);
        setTaxMarketing(100);
        setAllTaxApps([uint16(0), 0, 0, 0, 0, 0]);

        // exclude this contract from fee.
        excludeAccountFromFee(address(this));
        excludeAccountFromFee(address(uniswapV2Router));

        // configure wallets
        updateAppsWallet(appWallet_);
        updateMarketingWallet(marketingWallet_);
        updateLiquidityWallet(liquidityWallet_);

        // Add initial supply to sender
        _mint(msg.sender, 160_000_000_000_000 * 10 ** decimals());
    }

    // allow the contract to receive ETH
    receive() external payable {}

    function updateDividendTracker(address dividendTrackerAddress_) external onlyOwner {
        // dividend setup
        dividendTracker = BOLASDividendTracker(payable(dividendTrackerAddress_));

        // exclude internals
        dividendTracker.excludeFromDividends(address(dividendTracker), true);
        dividendTracker.excludeFromDividends(address(this), true);
        dividendTracker.excludeFromDividends(owner(), true);
        dividendTracker.excludeFromDividends(address(uniswapV2Router), true);

        // exclude wallets
        dividendTracker.excludeFromDividends(_appsWallet, true);
        dividendTracker.excludeFromDividends(_marketingWallet, true);
        dividendTracker.excludeFromDividends(_liquidityWallet, true);
    }

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
    function taxBurn() public view returns (uint16) {
        return _taxBurn;
    }

    /**
     * @dev Returns the current marketing tax.
     */
    function taxMarketing() public view returns (uint16) {
        return _taxMarketing;
    }

    /**
     * @dev Returns the app tax of index.
     */
    function taxAppOf(uint8 index) public view returns (uint16) {
        return _taxApps[index];
    }

    /**
     * @dev Returns all app tax values
     */
    function taxApps() public view returns (uint16[6] memory) {
        return _taxApps;
    }

    /**
     * @dev Returns the current liquify tax.
     */
    function taxLiquify() public view returns (uint16) {
        return _taxLiquify;
    }

    /**
     * @dev Returns the current dividend tax.
     */
    function taxDividend() public view returns (uint16) {
        return _taxDividend;
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
        (, int256 index,,,,,,) = dividendTracker.getAccount(account);
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

    function _tryExcludeFromDividends(address addressToExclude) internal {
        if (address(dividendTracker) == address(0) || dividendTracker.isExcludedFromDividends(addressToExclude)) return;
        dividendTracker.excludeFromDividends(addressToExclude, true);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal override {
        super._transferOwnership(newOwner);
        if (address(dividendTracker) != address(0)) dividendTracker.excludeFromDividends(newOwner, true);
        excludeAccountFromFee(newOwner);
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
        require(account != address(0), "ERC20: burn from 0 address");

        uint256 accountBalance = balanceOf(account);
        require(accountBalance >= amount, "ERC20: burn amount exceeds balance");

        // Transfer from account to the burnAccount
    unchecked {
        _balances[account] = accountBalance - amount;
    }

        _totalSupply -= amount;
        _totalBurnt += amount;

        emit Burn(account, amount);
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
        _beforeTokenTransfer(sender, recipient, amount);
        if (amount == 0) {
            _transferTokens(sender, recipient, 0);
            emit Transfer(sender, recipient, amount);
            return;
        }

        // process fees
        bool takeFee =
        !_isExcludedFromFee[sender]
        && !_isExcludedFromFee[recipient]
        && automatedMarketMakerPairs[sender]
        && automatedMarketMakerPairs[recipient];
        console.log('TAKE FEE:', takeFee);
        TokenFeeValues memory values = _getFeeValues(amount, takeFee);
        if (takeFee) {
            _transferTokens(sender, address(this), values.totalFeeIntoContract);
            _burn(sender, values.burnFee);
        }

        //Swapping is only possible if sender is not pancake pair,
        if (
            takeFee
            && (sender != _uniswapV2Pair)
            && (_autoSwapAndLiquifyEnabled)
            && (!_inSwapAndLiquify)
        ) _swapContractToken();

        // send tokens to recipient
        _transferTokens(sender, recipient, values.transferAmount);
        // process swaps
        // _processTransferSwaps(sender, recipient);

        // process dividends
        _processTransferDividends(sender, recipient);

        _afterTokenTransfer(sender, recipient, amount);
        emit Transfer(sender, recipient, amount);
    }

    /**
     * @dev Simply performs a token transfer from sender to recipient
     */
    function _transferTokens(
        address sender,
        address recipient,
        uint256 amount
    ) internal {
        uint256 senderBalance = _balances[sender];
        require(senderBalance >= amount, "ERC20: transfer amount exceeds balance");
    unchecked {
        _balances[sender] = senderBalance - amount;
    }
        _balances[recipient] += amount;
    }

    function _swapContractToken() private {
        // preparation
        uint contractBalance = _balances[address(this)];
        bool overMinTokensBeforeSwap = contractBalance >= _minTokensBeforeSwap;
        if (!overMinTokensBeforeSwap) return;
        // start swapping
        _inSwapAndLiquify = true;

        uint256 totalTokensForLiquidity = _minTokensBeforeSwap * _taxLiquify / _totalSwappableTax();
        uint256 liquidityTokenHalfAsETH = totalTokensForLiquidity / 2;
        uint256 liquidityTokenHalfAsBOLAS = totalTokensForLiquidity - liquidityTokenHalfAsETH;
        uint256 totalTokensToSwap = _minTokensBeforeSwap - liquidityTokenHalfAsBOLAS;
        // Contract's current ETH balance.
        uint256 initialETHBalance = address(this).balance;
        swapTokensForEth(totalTokensToSwap);
        uint256 swappedETHAmount = address(this).balance - initialETHBalance;
        SwapingETHValues memory values = getSwappingETHValues(swappedETHAmount);

        // process adding liquidity
        addLiquidity(values.liquidityETHAmount, liquidityTokenHalfAsBOLAS);

        // process sending dividends
        sendEth(address(dividendTracker), values.dividendsETHAmount);

        // process sending marketing fee
        sendEth(_marketingWallet, values.marketingETHAmount);

        // start swapping
        _inSwapAndLiquify = false;
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

    /**
      * @dev Returns swappable total fee (all fees that should be swapped)
      * outputs 1% as 100, 1.5% as 150
     */
    function _totalSwappableTax() private view returns (uint16) {
        return _taxLiquify + _taxDividend + _taxMarketing;
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
        require(!_isExcludedFromFee[account], "Already excluded.");

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

    // Sends ETH into a specified account from this contract
    function sendEth(address account, uint256 amount) private returns (bool) {
        (bool success,) = account.call{value : amount}("");
        return success;
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
        // Add the ETH and token to LP.
        // The LP tokens will be sent to burnAccount.
        // No one will have access to them, so the liquidity will be locked forever.
        uniswapV2Router.addLiquidityETH{value : ethAmount}(
            address(this),
            tokenAmount,
            0, // slippage is unavoidable
            0, // slippage is unavoidable
            _liquidityWallet, // the LP is sent to burnAccount.
            block.timestamp + 60 * 1000
        );
    }

    /**
     * @dev Returns fees and transfer amount in tokens.
     * tXXXX stands for tokenXXXX
     * More details can be found at comments for ValuesForAmount Struct.
     */
    function _getFeeValues(uint256 amount, bool deductTransferFee) private view returns (TokenFeeValues memory) {
        TokenFeeValues memory values;
        values.amount = amount;

        if (!deductTransferFee) {
            values.transferAmount = values.amount;
        } else {
            // fee to inside the contract
            values.dividendFee = _calculateTax(values.amount, _taxDividend);
            values.liquifyFee = _calculateTax(values.amount, _taxLiquify);
            values.marketingFee = _calculateTax(values.amount, _taxMarketing);
            values.totalFeeIntoContract = values.dividendFee + values.liquifyFee + values.marketingFee;

            // fee to outside the contract
            values.burnFee = _calculateTax(values.amount, _taxBurn);
            values.appFee = _calculateTax(values.amount, _totalTaxApps);
            // amount after fee
            values.transferAmount =
            values.amount - (values.totalFeeIntoContract + values.appFee + values.burnFee);
        }

        return values;
    }

    /**
     * @dev Returns fee based on `amount` and `taxRate`
     */
    function _calculateTax(uint256 amount, uint16 tax) private pure returns (uint256) {
        return amount * tax / (10 ** 2) / (10 ** 2);
    }

    /**
     * @dev Returns swappable fee amounts in ETH.
     */
    function getSwappingETHValues(uint256 ethAmount) public view returns (SwapingETHValues memory) {
        SwapingETHValues memory values;
        uint16 totalTax = (_taxLiquify / 2) + _taxDividend + _taxMarketing;

        values.dividendsETHAmount = _calculateSwappableTax(ethAmount, _taxDividend, totalTax);
        values.marketingETHAmount = _calculateSwappableTax(ethAmount, _taxMarketing, totalTax);
        // remaining ETH is as the liquidity half
        values.liquidityETHAmount = ethAmount - (values.dividendsETHAmount + values.marketingETHAmount);

        return values;
    }

    /**
     * @dev Returns ETH swap amount based on tax & total tax
     */
    function _calculateSwappableTax(uint256 amount, uint16 tax, uint16 totalTax) private pure returns (uint256) {
        return (amount * tax) / totalTax;
    }

    /*
        Owner functions
    */

    function switchAutoBurn(uint16 taxBurn_, bool enable) public onlyOwner {
        if (!enable) {
            require(_autoBurnEnabled, "Already disabled.");
            setTaxBurn(0);
            _autoBurnEnabled = false;

            emit DisabledAutoBurn();
            return;
        }
        require(!_autoBurnEnabled, "Already enabled.");
        require(taxBurn_ > 0, "Tax must be greater than 0.");

        _autoBurnEnabled = true;
        setTaxBurn(taxBurn_);

        emit EnabledAutoBurn();
    }

    function switchAutoDividend(uint16 taxDividend_, bool enable) public onlyOwner {
        if (!enable) {
            require(_autoDividendEnabled, "Already disabled.");
            setTaxDividend(0);
            _autoDividendEnabled = false;

            emit DisabledAutoDividend();
            return;
        }
        require(!_autoDividendEnabled, "Already enabled.");
        require(taxDividend_ > 0, "Tax must be greater than 0.");

        _autoDividendEnabled = true;
        setTaxDividend(taxDividend_);

        emit EnabledAutoDividend();
    }

    function switchAutoSwapAndLiquify(uint16 taxLiquify_, uint256 minTokensBeforeSwap_, bool enable) public onlyOwner {
        if (!enable) {
            require(_autoSwapAndLiquifyEnabled, "Already disabled.");
            setTaxLiquify(0);
            _autoSwapAndLiquifyEnabled = false;
            emit DisabledAutoSwapAndLiquify();
            return;
        }

        require(!_autoSwapAndLiquifyEnabled, "Already enabled.");
        require(taxLiquify_ > 0, "Tax must be greater than 0.");

        _minTokensBeforeSwap = minTokensBeforeSwap_;
        _autoSwapAndLiquifyEnabled = true;
        setTaxLiquify(taxLiquify_);

        emit EnabledAutoSwapAndLiquify();
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
        require(minTokensBeforeSwap_ < _totalSupply, "Must be lower than current supply.");

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
    function setTaxBurn(uint16 taxBurn_) public onlyOwner {
        require(_autoBurnEnabled, "Auto burn not enabled");
        require(taxBurn_ + _taxDividend + _taxLiquify + _totalTaxApps + _taxMarketing < 10000, "Tax fee too high.");

        uint16 previousTax = _taxBurn;
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
    function setTaxDividend(uint16 taxDividend_) public onlyOwner {
        require(_autoDividendEnabled, "Auto dividend not enabled");
        require(_taxBurn + taxDividend_ + _taxLiquify + _totalTaxApps + _taxMarketing < 10000, "Tax fee too high.");

        uint16 previousTax = _taxDividend;
        _taxDividend = taxDividend_;

        emit TaxDividendUpdate(previousTax, taxDividend_);
    }

    /**
      * @dev Updates taxMarketing
      *
      * Emits a {TaxMarketingUpdate} event.
      *
      * Requirements:
      *
      * - total tax rate must be less than 100%.
      */
    function setTaxMarketing(uint16 taxMarketing_) public onlyOwner {
        require(_taxBurn + _taxDividend + _taxLiquify + _totalTaxApps + taxMarketing_ < 10000, "Tax fee too high.");

        uint16 previousTax = _taxMarketing;
        _taxMarketing = taxMarketing_;

        emit TaxMarketingUpdate(previousTax, taxMarketing_);
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
    function setTaxLiquify(uint16 taxLiquify_) public onlyOwner {
        require(_autoSwapAndLiquifyEnabled, "Auto swap and liquify not enabled");
        require(_taxBurn + _taxDividend + taxLiquify_ + _totalTaxApps + _taxMarketing < 10000, "Tax fee too high.");

        uint16 previousTax = _taxLiquify;
        _taxLiquify = taxLiquify_;

        emit TaxLiquifyUpdate(previousTax, taxLiquify_);
    }

    /**
      * @dev Updates taxApp
      *
      * Emits a {TaxAppUpdate} event.
      *
      * Requirements:
      *
      * - auto swap and app feature must be enabled.
      * - total tax rate must be less than 100%.
      */
    function setTaxApps(uint8 index, uint16 taxApp_) public onlyOwner {
        uint16 previousTax = _taxApps[index];
        _taxApps[index] = taxApp_;

        _totalTaxApps = 0;
        for (uint8 i = 0; i < 6; i++) {
            _totalTaxApps += _taxApps[i];
        }

        require(_taxBurn + _taxDividend + _taxLiquify + _totalTaxApps + _taxMarketing < 10000, "Tax fee too high.");
        emit TaxAppUpdate(index, previousTax, taxApp_);
    }

    /**
     * @dev Sets all app fees at once.
      *
      * Emits a {AllAppTaxUpdate} event.
      */
    function setAllTaxApps(
        uint16[6] memory fees
    ) public onlyOwner {
        for (uint256 i = 0; i < 6; i++) _taxApps[i] = fees[i];
        _totalTaxApps = 0;
        for (uint8 i = 0; i < 6; i++) _totalTaxApps += _taxApps[i];
        require(_taxBurn + _taxDividend + _taxLiquify + _totalTaxApps + _taxMarketing < 10000, "Tax fee too high.");
        emit AllAppTaxUpdate(_taxApps);
    }

    function updateAppsWallet(address newAddress) public onlyOwner {
        require(newAddress != address(_appsWallet), "Already set!");
        if (!_isExcludedFromFee[newAddress]) excludeAccountFromFee(newAddress);
        _tryExcludeFromDividends(newAddress);
        emit UpdateAppWallet(newAddress, address(_appsWallet));
        _appsWallet = newAddress;
    }

    function updateMarketingWallet(address newAddress) public onlyOwner {
        require(newAddress != address(_marketingWallet), "Already set!");
        if (!_isExcludedFromFee[newAddress]) excludeAccountFromFee(newAddress);
        _tryExcludeFromDividends(newAddress);
        emit UpdateMarketingWallet(newAddress, address(_marketingWallet));
        _marketingWallet = newAddress;
    }

    function updateLiquidityWallet(address newAddress) public onlyOwner {
        require(newAddress != address(_liquidityWallet), "Already set!");
        if (!_isExcludedFromFee[newAddress]) excludeAccountFromFee(newAddress);
        _tryExcludeFromDividends(newAddress);
        emit UpdateLiquidityWallet(newAddress, address(_liquidityWallet));
        _liquidityWallet = newAddress;
    }
}
