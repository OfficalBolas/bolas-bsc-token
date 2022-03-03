// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

/**
* @notice Stakeable is a contract who is ment to be inherited by other contract that wants Staking capabilities
*/
contract Stakeable {

    /**
     * @dev
     */
    uint256 public apy7Days = 200;
    uint256 public apy30Days = 500;
    uint256 public apy90Days = 1000;
    uint256 public apy365Days = 2000;
    /**
     * @notice Constructor since this contract is not ment to be used without inheritance
     * push once to stakeholders for it to work proplerly
     */
    constructor() {
        // This push is needed so we avoid index 0 causing bug of index-1
        stakeholders.push();
    }
    /**
     * @notice
     * A stake struct is used to represent the way we store stakes,
     * A Stake will contain the users address, the amount staked and a timestamp,
     * Since which is when the stake was made
     */
    struct Stake {
        address user;
        uint256 amount;
        uint256 since;
        uint256 duration_sec;
        // This claimable field is new and used to tell how big of a reward is currently available
        uint256 claimable;
        bool locked;
    }
    /**
    * @notice Stakeholder is a staker that has active stakes
     */
    struct Stakeholder {
        address user;
        Stake[] address_stakes;

    }
    /**
    * @notice
     * StakingSummary is a struct that is used to contain all stakes performed by a certain account
     */
    struct StakingSummary {
        uint256 total_amount;
        Stake[] stakes;
    }

    /**
    * @dev
    *   This is a array where we store all Stakes that are performed on the Contract
    *   The stakes for each address are stored at a certain index, the index can be found using the stakes mapping
    */
    Stakeholder[] internal stakeholders;
    /**
    * @dev
    * stakes is used to keep track of the INDEX for the stakers in the stakes array
     */
    mapping(address => uint256) internal stakes;
    /**
    * @dev Staked event is triggered whenever a user stakes tokens, address is indexed to make it filterable
     */
    event Staked(address indexed user, uint256 amount, uint256 index, uint256 timestamp);

    /**
    * @dev _addStakeholder takes care of adding a stakeholder to the stakeholders array
     */

    function _addStakeholder(address staker) internal returns (uint256){
        // Push a empty item to the Array to make space for our new stakeholder
        stakeholders.push();
        // Calculate the index of the last item in the array by Len-1
        uint256 userIndex = stakeholders.length - 1;
        // Assign the address to the new index
        stakeholders[userIndex].user = staker;
        // Add index to the stakeHolders
        stakes[staker] = userIndex;
        return userIndex;
    }

    /**
    * @dev
    * _Stake is used to make a stake for an sender. It will remove the amount staked from the stakers account and place those tokens inside a stake container
    * StakeID
    */
    function _stake(uint256 _amount, uint256 _durationSec) internal {
        // Simple check so that user does not stake 0
        require(_amount > 0, "Cannot stake nothing");
        require(_durationSec >= 7 days, "Stake duration must be at least one day");


        // Mappings in solidity creates all values, but empty, so we can just check the address
        uint256 index = stakes[msg.sender];
        // block.timestamp = timestamp of the current block in seconds since the epoch
        uint256 timestamp = block.timestamp;
        // See if the staker already has a staked index or if its the first time
        if (index == 0) {
            // This stakeholder stakes for the first time
            // We need to add him to the stakeHolders and also map it into the Index of the stakes
            // The index returned will be the index of the stakeholder in the stakeholders array
            index = _addStakeholder(msg.sender);
        }

        // Use the index to push a new Stake
        // push a newly created Stake with the current block timestamp.
        stakeholders[index].address_stakes.push(Stake(msg.sender, _amount, timestamp, _durationSec, 0, false));
        // Emit an event that the stake has occured
        emit Staked(msg.sender, _amount, index, timestamp);
    }
    /**
     * @notice
     * calculateStakeReward is used to calculate how much a user should be rewarded for their stakes
     * and the duration the stake has been active
     */
    function calculateStakeReward(Stake memory _current_stake) internal view returns (uint256){
        // First calculate how long the stake has been active
        // Use current seconds since epoch - the seconds since epoch the stake was made
        // The output will be duration in SECONDS ,
        // We will reward the user 0.1% per Hour So thats 0.1% per 3600 seconds
        // the alghoritm is  seconds = block.timestamp - stake seconds (block.timestap - _stake.since)
        // hours = Seconds / 3600 (seconds /3600) 3600 is an variable in Solidity names hours
        // we then multiply each token by the hours staked , then divide by the rewardPerHour rate
        uint256 apyPercent;
        if (_current_stake.duration_sec >= 365 days) {
            apyPercent = apy365Days;
        } else if (_current_stake.duration_sec >= 90 days) {
            apyPercent = apy90Days;
        } else if (_current_stake.duration_sec >= 30 days) {
            apyPercent = apy30Days;
        } else {
            apyPercent = apy7Days;
        }

        return apyPercent * ((block.timestamp - _current_stake.since) * _current_stake.amount) / (1000 * 365 days);
    }

    function isStakeLocked(Stake memory _current_stake) internal view returns (bool){
        return block.timestamp - _current_stake.since < _current_stake.duration_sec;
    }

    /**
 * @notice
     * withdrawStake takes in an amount and a index of the stake and will remove tokens from that stake
     * Notice index of the stake is the users stake counter, starting at 0 for the first stake
     * Will return the amount to MINT onto the acount
     * Will also calculateStakeReward and reset timer
    */
    function _withdrawStake(uint256 amount, uint256 index) internal returns (uint256){
        // Grab user_index which is the index to use to grab the Stake[]
        uint256 user_index = stakes[msg.sender];
        Stake memory current_stake = stakeholders[user_index].address_stakes[index];
        require(current_stake.amount >= amount, "Staking: Cannot withdraw more than you have staked");
        require(!isStakeLocked(current_stake), "Staking: This stake is locked");

        // Calculate available Reward first before we start modifying data
        uint256 reward = calculateStakeReward(current_stake);
        // Remove by subtracting the money unstaked
        current_stake.amount = current_stake.amount - amount;
        // If stake is empty, 0, then remove it from the array of stakes
        if (current_stake.amount == 0) {
            delete stakeholders[user_index].address_stakes[index];
        } else {
            // If not empty then replace the value of it
            stakeholders[user_index].address_stakes[index].amount = current_stake.amount;
            // Reset timer of stake
            stakeholders[user_index].address_stakes[index].since = block.timestamp;
        }

        return amount + reward;

    }

    /**
    * @notice
     * hasStake is used to check if a account has stakes and the total amount along with all the seperate stakes
     */
    function hasStake(address _staker) public view returns (StakingSummary memory){
        // totalStakeAmount is used to count total staked amount of the address
        uint256 totalStakeAmount;
        // Keep a summary in memory since we need to calculate this
        StakingSummary memory summary = StakingSummary(0, stakeholders[stakes[_staker]].address_stakes);
        // Itterate all stakes and grab amount of stakes
        for (uint256 s = 0; s < summary.stakes.length; s += 1) {
            uint256 availableReward = calculateStakeReward(summary.stakes[s]);
            summary.stakes[s].claimable = availableReward;
            summary.stakes[s].locked = isStakeLocked(summary.stakes[s]);
            totalStakeAmount = totalStakeAmount + summary.stakes[s].amount;
        }
        // Assign calculate amount to summary
        summary.total_amount = totalStakeAmount;
        return summary;
    }
}