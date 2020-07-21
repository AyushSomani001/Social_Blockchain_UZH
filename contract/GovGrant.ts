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
export class GovGrant extends SmartContract {
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
  public getDonationInfo(source: Address): DonationInfo {
    const info = this.donations.get(source);

    return info === undefined
      ? { message: 'Address is not set up', balance: -1 }
      : info;
  }

  // Send funds
  public approveReceiveTransfer(
    amount: Fixed<8>,
    asset: Address,
    to: ForwardedValue<Address>,
  ): boolean {
    if (!Address.isCaller(asset)) {
      return false;
    }

    return this.contribute(to, amount);
  }

  // If funds don't go through
  public onRevokeSendTransfer(_from: Address, _amount: Fixed<0>, _asset: Address) {
    // do nothing
  }

  // Register to receive funds
  public setupContributions(address: Address): void {
    const info = this.donations.get(address);
    if (info !== undefined) {
      throw new Error(`This address is already setup to track contributions.`);
    }

    this.donations.set(address, { message: '', balance: 0 });
  }

  // Send funds to government
  public collect(address: Address, _amount: Fixed<0>): boolean {
    const account = this.donations.get(address);
    if (Address.isCaller(address) && account !== undefined) {
      if (account.balance < _amount) {
        throw new Error(`There isn't enough balance in the account.`);
      }
      
      const confirmation = token.transfer(this.address, address, _amount);
      if (confirmation) {
        this.donations.set(address, { ...account, balance = account.balance - _amount });
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
