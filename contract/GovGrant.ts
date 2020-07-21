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

//TODO Not needed
interface ContributionInfo extends SerializableValueObject {
  readonly amount: Fixed<8>;
  readonly message: string;
}

//TODO Grant info without current Balance
interface DonationInfo extends SerializableValueObject {
  readonly message: string;
  readonly balance: Fixed<8>;
  readonly currentBalance: Fixed<8>;
}

export class GovGrant extends SmartContract {
  private readonly contributions = MapStorage.for<[Address /*receiver*/, Address /*contributor*/], ContributionInfo>();
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
      ? { message: 'Address is not set up', balance: -1, currentBalance: -1 }
      : info;
  }

  // Donation Contributor Getter
  @constant
  public getContributionInfo(source: Address, contributor: Address): ContributionInfo {
    const info = this.contributions.get([source, contributor]);

    return info === undefined ? { amount: -1, message: '' } : info;
  }

  // One interface functions
  public approveReceiveTransfer(
    from: Address,
    amount: Fixed<8>,
    asset: Address,
    to: ForwardedValue<Address>,
    message: ForwardedValue<string>,
  ): boolean {
    if (!Address.isCaller(asset)) {
      return false;
    }

    return this.contribute(from, to, amount, message);
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

    this.donations.set(address, { message: '', balance: 0, currentBalance: 0});
  }

  // Government collects the token based on the public transport far the citizen redeems.
  public collect(address: Address, _amount: Fixed<0>): boolean {
    const account = this.donations.get(address);
    if (account.balance < _amount) {
      throw new Error(`There isn't enough balance in the account.`);
    }
    if (Address.isCaller(address) && account !== undefined) {
      const confirmation = token.transfer(this.address, address, _amount);
      if (confirmation) {
        this.donations.set(address, { ...account, currentBalance: account.currentBalance - _amount });
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

  public updateContributorMessage(source: Address, contributor: Address, message: string): boolean {
    const account = this.contributions.get([source, contributor]);
    if (account !== undefined && Address.isCaller(contributor)) {
      this.contributions.set([source, contributor], { amount: account.amount, message });

      return true;
    }

    return false;
  }

  private contribute(from: Address, to: Address, amount: Fixed<8>, messageIn: string): boolean {
    const balances = this.donations.get(to);

    if (balances === undefined) {
      throw new Error(`That address hasn't been setup to receive contributions yet.`);
    }

    const contributor = this.contributions.get([to, from]);
    const message = messageIn === '' ? (contributor === undefined ? '' : contributor.message) : messageIn;
    const contribBalance = contributor === undefined ? amount : contributor.amount + amount;

    this.donations.set(to, {
      message: balances.message,
      balance: balances.balance + amount,
      currentBalance: balances.currentBalance + amount,
    });
    this.contributions.set([to, from], { amount: contribBalance, message });

    return true;
  }
}
