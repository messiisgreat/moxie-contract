import { task, types } from 'hardhat/config'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { askConfirm, getTokenLockManagerOrFail, isValidAddressOrFail, prettyEnv, waitTransaction } from './create'
import consola from 'consola'
import { formatEther, parseEther } from 'ethers/lib/utils'
import { ethers, getNamedAccounts } from 'hardhat'

const logger = consola.create({})

task('manager-setup-auth', 'Setup default authorized functions in the manager')
  .addParam('targetAddress', 'Target address for function calls')
  .addParam('signatures', 'function signatures to authorize', [], types.json)
  .addParam('managerName', 'Name of the token lock manager deployment', 'MoxieTokenLockManager')
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    // Get contracts
    const manager = await getTokenLockManagerOrFail(hre, taskArgs.managerName)

    const signers = await hre.ethers.getSigners()
    const ownerSigner = signers[1]

    logger.info('Setting up authorized functions...')
    logger.log(`> MoxieTokenLockManager: ${manager.address}`)
    logger.log(`> TargetAddress: ${taskArgs.targetAddress}`)
    logger.log(`> Signatures: ${taskArgs.signatures}`)

    // Prepare
    logger.log(await prettyEnv(hre))

    // Validations
    isValidAddressOrFail(taskArgs.targetAddress)

    //Setup authorized functions
    // const signatures1 = [
    //   'placeSellOrders(uint256,uint96[],uint96[],bytes32[],bytes)',
    //   'claimFromParticipantOrder(uint256,bytes32[])',
    //   'cancelSellOrders(uint256,bytes32[])',
    // ]
    // logger.log(`> Signatures1: ${signatures1}`)
    const signatures = taskArgs.signatures

    if (await askConfirm()) {
     // Setup authorized functions
      logger.info('Setup authorized functions...')
      const targets = Array(signatures.length).fill(taskArgs.targetAddress)
      const tx1 = await manager.connect(ownerSigner).setAuthFunctionCallMany(signatures, targets)
      await waitTransaction(tx1)
      logger.success('Done!\n')

      // Setup authorized token destinations
      logger.info('Setup authorized destinations...')
      const tx2 = await manager.connect(ownerSigner).addTokenDestination(taskArgs.targetAddress)
      await waitTransaction(tx2)
    }
  })

task('manager-deposit', 'Deposit fund into the manager')
  .addParam('amount', 'Amount to deposit in MOXIE')
  .addParam('managerName', 'Name of the token lock manager deployment', 'MoxieTokenLockManager')
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    // Get contracts
    const manager = await getTokenLockManagerOrFail(hre, taskArgs.managerName)

    // Get the address who owns MOXIE tokens
    const privateKey = process.env.TEMPORARY_MOXIE_HOLDING_WALLET_PRIVATE_KEY
    const wallet = new hre.ethers.Wallet(privateKey, hre.ethers.provider)

    // Prepare
    logger.log(await prettyEnv(hre))

    const tokenAddress = await manager.token()

    logger.info('Using:')
    logger.log(`> MoxieToken: ${tokenAddress}`)
    logger.log(`> MoxieTokenLockMasterCopy: ${await manager.masterCopy()}`)
    logger.log(`> MoxieTokenLockManager: ${manager.address}`)

    // Deposit funds
    logger.log(`You are depositing ${taskArgs.amount} into ${manager.address}...`)
    if (await askConfirm()) {
      const weiAmount = parseEther(taskArgs.amount)

      logger.log('Approve...')
      const MOXIE = await hre.ethers.getContractAt('ERC20', tokenAddress)
      const tx1 = await MOXIE.connect(wallet).approve(manager.address, weiAmount)
      await waitTransaction(tx1)

      logger.log('Deposit...')
      const tx2 = await manager.connect(wallet).deposit(weiAmount)
      await waitTransaction(tx2)
    }
  })

task('manager-withdraw', 'Withdraw fund from the manager')
  .addParam('amount', 'Amount to deposit in MOXIE')
  .addParam('managerName', 'Name of the token lock manager deployment', 'MoxieTokenLockManager')
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    // Get contracts
    const manager = await getTokenLockManagerOrFail(hre, taskArgs.managerName)

    const accounts = await hre.ethers.getSigners()

    // Prepare
    logger.log(await prettyEnv(hre))

    const tokenAddress = await manager.token()

    logger.info('Using:')
    logger.log(`> MoxieToken: ${tokenAddress}`)
    logger.log(`> MoxieTokenLockMasterCopy: ${await manager.masterCopy()}`)
    logger.log(`> MoxieTokenLockManager: ${manager.address}`)

    // Withdraw funds
    logger.log(`You are withdrawing ${taskArgs.amount} from ${manager.address}...`)
    if (await askConfirm()) {
      const weiAmount = parseEther(taskArgs.amount)

      logger.log('Withdraw...')
      const tx = await manager.connect(accounts[1]).withdraw(weiAmount)
      await waitTransaction(tx)
    }
  })

task('manager-balance', 'Get current manager balance')
  .addParam('managerName', 'Name of the token lock manager deployment', 'MoxieTokenLockManager')
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    // Get contracts
    const manager = await getTokenLockManagerOrFail(hre, taskArgs.managerName)

    // Prepare
    logger.log(await prettyEnv(hre))

    const tokenAddress = await manager.token()
    const managerOwnerAddress = await manager.owner()

    logger.info('Using:')
    logger.log(`> MoxieToken: ${tokenAddress}`)
    logger.log(`> MoxieTokenLockMasterCopy: ${await manager.masterCopy()}`)
    logger.log(`> MoxieTokenLockManager: ${manager.address} owner: ${managerOwnerAddress}`)

    const MOXIE = await hre.ethers.getContractAt('ERC20', tokenAddress)
    const balance = await MOXIE.balanceOf(manager.address)
    logger.log('Current Manager balance is ', formatEther(balance))
  })

task('manager-transfer-ownership', 'Transfer ownership of the manager')
  .addParam('owner', 'Address of the new owner')
  .addParam('managerName', 'Name of the token lock manager deployment', 'MoxieTokenLockManager')
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const manager = await getTokenLockManagerOrFail(hre, taskArgs.managerName)

    // Validate current owner
    const tokenLockManagerOwner = await manager.owner()
    const signers = await hre.ethers.getSigners();
    const  deployer = signers[1];
    if (tokenLockManagerOwner !== deployer.address) {
      logger.error('Only the owner can transfer ownership')
      process.exit(1)
    }

    logger.info(`Manager address: ${manager.address}}`)
    logger.info(`Current owner: ${tokenLockManagerOwner}`)
    logger.info(`New owner: ${taskArgs.owner}`)

    if (!(await askConfirm())) {
      logger.log('Cancelled')
      process.exit(1)
    }

    // Transfer ownership
    await manager.connect(deployer).transferOwnership(taskArgs.owner)
  })

  task('set-token-manager', 'Set Token Manager contract address')  
  .addParam('tokenManagerAddress', 'Address of the Token Manager contract')
  .addParam('managerName', 'Name of the token lock manager deployment', 'MoxieTokenLockManager')
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const manager = await getTokenLockManagerOrFail(hre, taskArgs.managerName)

    // Validate current owner
    const tokenLockManagerOwner = await manager.owner()
    const signers = await hre.ethers.getSigners()
    const ownerSigner = signers[1]
    if (tokenLockManagerOwner !== ownerSigner.address) {
      logger.error('Only the owner can transfer ownership')
      process.exit(1)
    }

    logger.info(`Manager address: ${manager.address}}`)
    logger.info(`Token Lock Manager Address: ${taskArgs.tokenManagerAddress}`)

    if (!(await askConfirm())) {
      logger.log('Cancelled')
      process.exit(1)
    }

    await manager.connect(ownerSigner).setTokenManager(taskArgs.tokenManagerAddress)
    logger.info(`Token Lock Manager is set`)
  })

  task('add-subject-token-destination', 'Add subject token destination address')  
  .addParam('protocolContractAddress', 'Address of the protocol contract')
  .addParam('managerName', 'Name of the token lock manager deployment', 'MoxieTokenLockManager')
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const manager = await getTokenLockManagerOrFail(hre, taskArgs.managerName)

    // Validate current owner
    const tokenLockManagerOwner = await manager.owner()
    const signers = await hre.ethers.getSigners()
    const ownerSigner = signers[1]
    if (tokenLockManagerOwner !== ownerSigner.address) {
      logger.error('Only the owner can transfer ownership')
      process.exit(1)
    }

    logger.info(`Manager address: ${manager.address}}`)
    logger.info(`Protocol contract Address: ${taskArgs.protocolContractAddress}`)

    if (!(await askConfirm())) {
      logger.log('Cancelled')
      process.exit(1)
    }

    await manager.connect(ownerSigner).addSubjectTokenDestination(taskArgs.protocolContractAddress)
    logger.info(`Protocol contract address is whitelisted in token lock manager`)
  })
