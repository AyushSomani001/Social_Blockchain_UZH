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
import { Token } from './Token';

const token = LinkedSmartContract.for<Token>();

interface DonationInfo extends SerializableValueObject {
  readonly message: string;
  readonly balance: Fixed<8>;
}

export class GovGrant extends SmartContract {
  private readonly donations = MapStorage.for<Address /*receiver*/, DonationInfo>();

  public constructor(public readonly owner: Address = Deploy.senderAddress) {
    super();
    if (!Address.isCaller(owner)) {
      throw new Error(`Sender was not the owner. Received: ${owner}`);
    }
  }

  // Meta Donation Info Getter
  @constant
  public getDonationInfo(source: Address): DonationInfo {
    const info = this.donations.get(source);

    return info === undefined
      ? { message: 'Address is not set up', balance: -1 }
      : info;
  }

  // One interface functions
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

  public onRevokeSendTransfer(_from: Address, _amount: Fixed<0>, _asset: Address) {
    // do nothing
  }

  // add your address to allow contributions to be tracked (global donation message optional)
  public setupContributions(address: Address): void {
    const info = this.donations.get(address);
    if (info !== undefined) {
      throw new Error(`This address is already setup to track contributions.`);
    }

    this.donations.set(address, { message: '', balance: 0 });
  }

  // Government collects the token based on the public transport far the citizen redeems.
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

  public updateMessage(address: Address, message: string): boolean {
    const account = this.donations.get(address);
    if (account !== undefined && Address.isCaller(address)) {
      this.donations.set(address, { ...account, message });

      return true;
    }

    return false;
  }

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
