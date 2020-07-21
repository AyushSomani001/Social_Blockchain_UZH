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
  message: string;
  group: string;
  balance: Fixed<8>;
}

// Government Contract
export class Government extends SmartContract {
  
  // Accounts: mapping from account address to account information
  private grants = MapStorage.for<Address, GrantInfo>();
  private acc = {"", "", 0}; 
  private count = 0; 

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
      ? { message: 'Address is not set up', 'none', balance: -1 }
      : account;
  }

  // Send funds to specific group, equally distribute funds
  // Can be optimized (double for loop)
  public fundGroup(address: Address, group: string, amount: Fixed<8>): void {
    count = 0;
    // Count receivers
    for (let addr in grants) {
      acc = this.grants.get(addr);
      if (acc.group === group) {
        count += 1;
      }
    }
    if (count !== 0) {
      for (let addr in grants) {
        acc = this.grants.get(addr);
        if (acc.group === group) {
          approveReceiveTransfer(address, addr, amount/count);
        }
      }
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
  public setupContributions(address: Address, group: string): void {
    const account = this.grants.get(address);
    if (account !== undefined) {
      throw new Error(`Address already exists.`);
    }

    this.grants.set(address, { message: '', , group, balance: 0 });
  }

  // Send funds to government
  public govCollect(to: Address, amount: Fixed<0>): boolean {
    const account = this.grants.get(address);
    if (Address.isCaller(address) && account !== undefined) {
      if (account.balance < amount) {
        throw new Error(`There isn't enough balance in the account.`);
      }
      
      const confirmation = token.transfer(this.address, address, amount);
      if (confirmation) {
        this.grants.set(address, { ...account, balance = account.balance - amount });
      }

      return confirmation;
    }

    return false;
  }

  // Update an account's message
  public updateMessage(address: Address, message: string): boolean {
    const account = this.grants.get(address);
    if (account !== undefined && Address.isCaller(address)) {
      this.grants.set(address, { ...account, message });

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

    this.grants.set(to, { ...account, balance = account.balance + amount });

    return true;
  }
}
