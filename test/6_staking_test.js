const testHelpers = require('./helpers/test_helpers');
const {assertFailure, assertBigNumberEqual, tokenToRaw} = require("./helpers/test_utils");
let token;

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
        let stake_amount = 100;
        // Get init balance of user
        balance = await token.balanceOf(owner)

        // Stake the amount, notice the FROM parameter which specifes what the msg.sender address will be

        const res = await token.stake(stake_amount, {from: owner});
        // Assert on the emittedevent using truffleassert
        // This will capture the event and inside the event callback we can use assert on the values returned
        const stakedLog = res.logs.find(element => element.event.match('Staked'))
        assert.strictEqual(stakedLog.args.amount.toNumber(), stake_amount, "Stake amount in event was not correct")
        assert.strictEqual(stakedLog.args.index.toNumber(), 1, "Stake index was not correct")

        // Stake again on owner because we want hasStake test to assert summary
        const res2 = await token.stake(stake_amount, {from: owner});
        // Assert on the emittedevent using truffleassert
        // This will capture the event and inside the event callback we can use assert on the values returned
        const stakedLog2 = res2.logs.find(element => element.event.match('Staked'))
        assert.strictEqual(stakedLog2.args.amount.toNumber(), stake_amount, "Stake amount in event was not correct")
        assert.strictEqual(stakedLog2.args.index.toNumber(), 1, "Stake index was not correct")
    });

    it("cannot stake more than owning", async () => {
        await assertFailure(() => token.stake(1000000000, {from: accounts[2]}));
    });
    it("new stakeholder should have increased index", async () => {
        let stake_amount = 100;
        const res = await token.stake(stake_amount, {from: accounts[1]});
        // Assert on the emittedevent using truffleassert
        // This will capture the event and inside the event callback we can use assert on the values returned
        const stakedLog = res.logs.find(element => element.event.match('Staked'))
        assert.strictEqual(stakedLog.args.amount.toNumber(), stake_amount, "Stake amount in event was not correct")
        assert.strictEqual(stakedLog.args.index.toNumber(), 2, "Stake index was not correct")
    })
})