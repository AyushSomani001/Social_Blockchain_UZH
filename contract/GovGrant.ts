// Dependencies
import {
  Address,
  constant,
  Deploy,
  Fixed,
  ForwardedValue,
  LinkedSmartContract,
  MapStorage,
  SerializableValueObject,
  SmartContract,
} from '@neo-one/smart-contract';

// Token contract
import { Token } from './Token';
const token = LinkedSmartContract.for<Token>();

// Account Data Type
interface DonationInfo extends SerializableValueObject {
  readonly message: string;
  readonly balance: Fixed<8>;
}

// Government Contract
export class Government extends SmartContract {
  // Accounts: mapping from account address to account information
  private readonly donations = MapStorage.for<Address, DonationInfo>();

  // Constructor, only run at deployment
  public constructor(public readonly owner: Address = Deploy.senderAddress) {
    super();
    if (!Address.isCaller(owner)) {
      throw new Error(`Sender was not the owner. Received: ${owner}`);
    }
  }

  // Get account information
  @constant
  public getDonationInfo(address: Address): DonationInfo {
    const account = this.donations.get(address);

    return (account === undefined)
      ? { message: 'Address is not set up', balance: -1 }
      : account;
  }

  // Send funds
  public approveReceiveTransfer(
    from: Address,
    to: ForwardedValue<Address>,
    amount: Fixed<8>
  ): boolean {
    if (!Address.isCaller(from)) {
      return false;
    }

    return this.contribute(to, amount);
  }

  // If funds don't go through
  public onRevokeSendTransfer(from: Address, to: Address, amount: Fixed<0>) {
    // do nothing
  }

  // Register to receive funds
  public setupContributions(address: Address): void {
    const account = this.donations.get(address);
    if (account !== undefined) {
      throw new Error(`This address is already setup to track contributions.`);
    }

    this.donations.set(address, { message: '', balance: 0 });
  }

  // Send funds to government
  public govCollect(to: Address, amount: Fixed<0>): boolean {
    const account = this.donations.get(address);
    if (Address.isCaller(address) && account !== undefined) {
      if (account.balance < amount) {
        throw new Error(`There isn't enough balance in the account.`);
      }
      
      const confirmation = token.transfer(this.address, address, amount);
      if (confirmation) {
        this.donations.set(address, { ...account, balance = account.balance - amount });
      }

      return confirmation;
    }

    return false;
  }

  // Update an account's message
  public updateMessage(address: Address, message: string): boolean {
    const account = this.donations.get(address);
    if (account !== undefined && Address.isCaller(address)) {
      this.donations.set(address, { ...account, message });

      return true;
    }

    return false;
  }

  // Send funds to account
  private contribute(to: Address, amount: Fixed<8>): boolean {
    const balances = this.donations.get(to);

    if (balances === undefined) {
      throw new Error(`That address hasn't been setup to receive contributions yet.`);
    }

    this.donations.set(to, {
      message: balances.message,
      balance: balances.balance + amount,
    });

    return true;
  }
}
