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


// Transfer Funds from peer to peer
export class p2p_transfer extends SmartContract {

  // Constructor, only run at deployment
  public constructor(public readonly owner: Address = Deploy.senderAddress) {
    super();
    if (!Address.isCaller(owner)) {
      throw new Error(`Sender was not the owner. Received: ${owner}`);
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

}
