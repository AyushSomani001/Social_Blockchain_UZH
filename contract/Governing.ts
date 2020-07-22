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
interface GrantInfo extends SerializableValueObject {
  readonly message: string;
  readonly group: string;
  readonly balance: Fixed<8>;
}

// Government Contract
export class Governing extends SmartContract {
  // Accounts: mapping from account address to account information
  private readonly grants = MapStorage.for<Address, GrantInfo>();

  // Constructor, only run at deployment
  public constructor(public readonly owner: Address = Deploy.senderAddress) {
    super();
    if (!Address.isCaller(owner)) {
      throw new Error(`Sender was not the owner. Received: ${owner}`);
    }
  }

  // Get account information
  @constant
  public getGrantInfo(address: Address): GrantInfo {
    const account = this.grants.get(address);

    return (account === undefined)
      ? { message: 'Address is not set up', group: 'none', balance: -1 }
      : account;
  }

  // Send funds to specific group, equally distribute funds
  // Can be optimized (double for loop)
  public fundGroup(address: Address, group: string, amount: Fixed<8>): void {
    let count = 0;
    // Count receivers
    this.grants.forEach((grantInfo: GrantInfo) => {
      if (grantInfo.group === group) {
        count += 1;
      }
    });
    
    if (count !== 0) {
      this.grants.forEach((grantInfo: GrantInfo, addr:Address) => {
        if (grantInfo.group === group) {
          this.approveReceiveTransfer(address, addr, amount/count);
        }
      });
    }
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
  public onRevokeSendTransfer(from: Address, to: Address, amount: Fixed<0>): void {
    // do nothing
  }

  // Register to receive funds
  public setupGrantRecievers(address: Address, group: string): void {
    const account = this.grants.get(address);
    if (account !== undefined) {
      throw new Error(`Address already exists.`);
    }

    this.grants.set(address, { message: '', group, balance: 0 });
  }

  // Send funds to government
  public govCollect(from: Address, amount: Fixed<0>): boolean {
    const account = this.grants.get(from);
    if (Address.isCaller(from) && account !== undefined) {
      if (account.balance < amount) {
        throw new Error(`There isn't enough balance in the account.`);
      }
      
      // Check necessity!
      const confirmation = token.transfer(from, this.address, amount);
      if (confirmation) {
        this.grants.set(from, { ...account, balance: account.balance - amount });
      }

      return confirmation;
    }

    return false;
  }

  // Update an account's message
  public updateMessage(address: Address, message: string): boolean {
    const account = this.grants.get(address);
    if (account !== undefined && Address.isCaller(address)) {
      this.grants.set(address, { ...account, message: message });

      return true;
    }

    return false;
  }

  // Send funds to account
  private contribute(to: Address, amount: Fixed<8>): boolean {
    const account = this.grants.get(to);

    if (account === undefined) {
      throw new Error(`Invalid address.`);
    }

    this.grants.set(to, { ...account, balance: account.balance + amount });

    return true;
  }
}
