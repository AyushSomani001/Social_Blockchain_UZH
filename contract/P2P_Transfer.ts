// Dependencies
import {
  Address,
  constant,
  Fixed,
  LinkedSmartContract,
  SmartContract,
} from '@neo-one/smart-contract';

// Token contract
import { Token } from './Token';
const token = LinkedSmartContract.for<Token>();


// Transfer Funds from peer to peer
export class P2P_Transfer extends SmartContract {

  // Send funds by invoking token.transfer backend
  public peerTransfer(
    from: Address,
    to: ForwardedValue<Address>,
    amount: Fixed<8>
  ): boolean {
    if (!Address.isCaller(from)) {
      return false;
    }

    return confirmation = token.transfer(from, to, amount);

  }
  
}
