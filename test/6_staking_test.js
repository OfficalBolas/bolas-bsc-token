const testHelpers = require('./helpers/test_helpers');
const {
    assertFailure,
    assertBigNumberEqual,
    tokenToRaw,
    bigNumber,
    assertBigNumberEqualApprox
} = require("./helpers/test_utils");
const {staking} = require("../config/token_config");
let token;

const DAY_SECONDS = 60 * 60 * 24;
const WEEK_SECONDS = DAY_SECONDS * 7;

contract('BOLAS STAKING TEST', (accounts) => {
    before(async () => {
        token = await testHelpers.reinitializeToken(accounts, 10_000, false);
        await testHelpers.setupLiquidity(token, accounts);
    });

    it('creation: should create an initial balance of 10000 for the creator', async () => {
        const balance = await token.balanceOf(accounts[1])
        assertBigNumberEqual(balance, tokenToRaw(10000))
    })
    it("Staking 100x2", async () => {
        // Stake 100 is used to stake 100 tokens twice and see that stake is added correctly and money burned
        let owner = accounts[0];
        // Set owner, user and a stake_amount
        let stake_amount = tokenToRaw(100);
        // Get init balance of user
        balance = await token.balanceOf(owner)

        // Stake the amount, notice the FROM parameter which specifes what the msg.sender address will be

        const res = await token.stake(stake_amount, DAY_SECONDS * 7, {from: owner});
        // Assert on the emittedevent using truffleassert
        // This will capture the event and inside the event callback we can use assert on the values returned
        const stakedLog = res.logs.find(element => element.event.match('Staked'))
        assertBigNumberEqual(stakedLog.args.amount, stake_amount, "Stake amount in event was not correct")
        assertBigNumberEqual(stakedLog.args.index.toNumber(), 1, "Stake index was not correct")

        // Stake again on owner because we want hasStake test to assert summary
        const res2 = await token.stake(stake_amount, DAY_SECONDS * 7, {from: owner});
        // Assert on the emittedevent using truffleassert
        // This will capture the event and inside the event callback we can use assert on the values returned
        const stakedLog2 = res2.logs.find(element => element.event.match('Staked'))
        assertBigNumberEqual(stakedLog2.args.amount, stake_amount, "Stake amount in event was not correct")
        assertBigNumberEqual(stakedLog2.args.index, 1, "Stake index was not correct")
    });
    it("Staked users are properly tracked", async () => {
        const result0 = await token.hasStake(accounts[0], {from: accounts[0]});
        const result2 = await token.hasStake(accounts[2], {from: accounts[0]});
        assertBigNumberEqual(result0[0].toString(), tokenToRaw(200), "Stake amount not correct")
        assertBigNumberEqual(result2[0].toString(), tokenToRaw(0), "Stake amount not correct")
    });

    it("cannot stake more than owning", async () => {
        await assertFailure(() => token.stake(1000000000, DAY_SECONDS * 7, {from: accounts[2]}));
    });

    it("New stakeholder should have increased index", async () => {
        let stake_amount = tokenToRaw(100);
        const res = await token.stake(stake_amount, DAY_SECONDS * 7, {from: accounts[1]});
        // Assert on the emittedevent using truffleassert
        // This will capture the event and inside the event callback we can use assert on the values returned
        const stakedLog = res.logs.find(element => element.event.match('Staked'))
        assertBigNumberEqual(stakedLog.args.amount, stake_amount, "Stake amount in event was not correct")
        assertBigNumberEqual(stakedLog.args.index, 2, "Stake index was not correct")
    })

    it("Staked users can withdraw", async () => {
        await testHelpers.timeTravelDays(7);
        await token.withdrawStake(tokenToRaw(40), 0, {from: accounts[1]});
        const result1 = await token.hasStake(accounts[1], {from: accounts[1]});
        assertBigNumberEqual(result1[0], tokenToRaw(60), "Stake amount not correct")
    });

    it("Checking withdrawable reward after 4 days", async () => {
        const delayDays = 4;

        token = await testHelpers.reinitializeToken(accounts, 10_000, false);

        const stake_amount = tokenToRaw(100);
        await token.stake(stake_amount, DAY_SECONDS * 7, {from: accounts[1]});
        await testHelpers.timeTravelDays(delayDays);
        const result1 = await token.hasStake(accounts[1], {from: accounts[1]});
        const claimableReward = result1['stakes'][0]['claimable'];
        const isLocked = result1['stakes'][0]['locked'];
        assertBigNumberEqualApprox(claimableReward, bigNumber(stake_amount).mul(bigNumber(delayDays / 365).mul(staking.apy7Days)))
        assert.ok(isLocked);
    });

    it("Checking withdrawable reward after 4 days", async () => {
        const delayDays = 4;

        token = await testHelpers.reinitializeToken(accounts, 10_000, false);

        const stake_amount = tokenToRaw(100);
        await token.stake(stake_amount, DAY_SECONDS * 7, {from: accounts[1]});
        await testHelpers.timeTravelDays(delayDays);
        const result1 = await token.hasStake(accounts[1], {from: accounts[1]});
        const claimableReward = result1['stakes'][0]['claimable'];
        assertBigNumberEqualApprox(claimableReward, bigNumber(stake_amount).mul(bigNumber(delayDays / 365).mul(staking.apy7Days)))
    });

    it("Stake locking works", async () => {
        const result1 = await token.hasStake(accounts[1], {from: accounts[1]});
        const isLocked1 = result1['stakes'][0]['locked'];
        assert.ok(isLocked1);

        await testHelpers.timeTravelDays(3);
        const result2 = await token.hasStake(accounts[1], {from: accounts[1]});
        const isLocked2 = result2['stakes'][0]['locked'];
        assert.ok(!isLocked2);
    });

    it("Time based rewards work", async () => {
        const delayDays = 4;
        token = await testHelpers.reinitializeToken(accounts, 10_000, false);

        const stake_amount = tokenToRaw(100);
        await token.stake(stake_amount, DAY_SECONDS * 7, {from: accounts[1]});
        await token.stake(stake_amount, DAY_SECONDS * 30, {from: accounts[1]});
        await token.stake(stake_amount, DAY_SECONDS * 90, {from: accounts[1]});
        await token.stake(stake_amount, DAY_SECONDS * 365, {from: accounts[1]});

        await testHelpers.timeTravelDays(delayDays);
        const stakeData = (await token.hasStake(accounts[1], {from: accounts[1]}))['stakes'];
        assertBigNumberEqualApprox(stakeData[0]['claimable'], bigNumber(stake_amount).mul(bigNumber(delayDays / 365).mul(staking.apy7Days)))
        assertBigNumberEqualApprox(stakeData[1]['claimable'], bigNumber(stake_amount).mul(bigNumber(delayDays / 365).mul(staking.apy30Days)))
        assertBigNumberEqualApprox(stakeData[2]['claimable'], bigNumber(stake_amount).mul(bigNumber(delayDays / 365).mul(staking.apy90Days)))
        assertBigNumberEqualApprox(stakeData[3]['claimable'], bigNumber(stake_amount).mul(bigNumber(delayDays / 365).mul(staking.apy365Days)))
    });
})