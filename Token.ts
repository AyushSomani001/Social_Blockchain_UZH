import {
  Address, Blockchain,
  constant,
  createEventNotifier,
  Deploy,
  Fixed, Hash256, Integer,
  MapStorage, receive,
  SmartContract,
} from '@neo-one/smart-contract';

const notifyTransfer = createEventNotifier<Address | undefined, Address | undefined, Fixed<8>>(
  'transfer',
  'from',
  'to',
  'amount',
);

export class Token extends SmartContract {
  public readonly name = 'Eon';
  public readonly symbol = 'EON';
  public readonly decimals = 8;
  private readonly balances = MapStorage.for<Address, Fixed<8>>();
  private mutableSupply: Fixed<8> = 0;
  private mutableRemaining: Fixed<8> = 10_000_000_000_00000000;

  public constructor(
    public readonly owner: Address = Deploy.senderAddress,
    public readonly icoStartTimeSeconds: Integer = Blockchain.currentBlockTime + 60 * 60,
    public readonly icoDurationSeconds: Integer = 86400,
    ) {
    super();
    if (!Address.isCaller(owner)) {
      throw new Error('Sender is not the owner.');
    }
  }

  @constant
  public get totalSupply(): Fixed<8> {
    return this.mutableSupply;
  }

  @constant
  public balanceOf(address: Address): Fixed<8> {
    const balance = this.balances.get(address);

    return balance === undefined ? 0 : balance;
  }

  public transfer(from: Address, to: Address, amount: Fixed<8>): true {
    if (amount < 0) {
      throw new Error(`Amount must be greater than 0: ${amount}`);
    }

    if (!Address.isCaller(from)) {
      throw new Error('The from Address did not approve the operation.');
    }

    const fromBalance = this.balanceOf(from);
    if (fromBalance < amount) {
      throw new Error('The from balance is insufficient.');
    }

    const toBalance = this.balanceOf(to);
    this.balances.set(from, fromBalance - amount);
    this.balances.set(to, toBalance + amount);
    notifyTransfer(from, to, amount);

    return true;
  }

  @receive
  public mintTokens(): boolean {
    if (!this.hasStarted()) {
      throw new Error(`ICO hasn\'t started yet.`);
    }
    if (this.hasEnded()) {
      throw new Error(`ICO has ended.`);
    }

    const { references } = Blockchain.currentTransaction;
    if (references.length === 0) {
      throw new Error('Blockchain reference failed');
    }
    const sender = references[0].address;

    let amount = 0;
    // tslint:disable-next-line no-loop-statement
    for (const output of Blockchain.currentTransaction.outputs) {
      if (output.address.equals(this.address)) {
        if (!output.asset.equals(Hash256.NEO)) {
          throw new Error('Expecting only NEO to be sent to the contact');
        }

        amount += output.value;
      }
    }

    if (amount > this.remaining) {
      throw new Error(`Amount is greater than remaining tokens. Amount: ${amount}. Remaining: ${this.remaining}`);
    }

    this.mutableRemaining -= amount;
    this.issue(sender, amount);

    return true;
  }

  private issue(addr: Address, amount: Fixed<8>): void {
    this.balances.set(addr, this.balanceOf(addr) + amount);
    this.mutableSupply += amount;
    notifyTransfer(undefined, addr, amount);
  }

  @constant
  public get remaining(): Fixed<8> {
    return this.mutableRemaining;
  }

  private hasStarted(): boolean {
    return Blockchain.currentBlockTime >= this.icoStartTimeSeconds;
  }

  private hasEnded(): boolean {
    return Blockchain.currentBlockTime > this.icoStartTimeSeconds + this.icoDurationSeconds;
  }
}
