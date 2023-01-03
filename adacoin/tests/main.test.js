// get access to the required classes, methods, functions, properties
const { ADACOIN_ERROR, AdaError, TS, isvalidcurrency, Block, Chain } = require('../src/main.js'); 

describe('1. Block Class Scenario ....', () => {
  
  test('1.1 Test Case Block...', () => {
    let adacoin_block = new Block( '2023-1-2', { credit: '25.50', tid: 'A0001' });
    
    expect (adacoin_block).toBeInstanceOf(Block);
    expect (adacoin_block.ts).toBe('2023-1-2');
    expect (adacoin_block.tid).toBe('A0001');
    expect (adacoin_block.debitvalue).toEqual(0);
    expect (adacoin_block.creditvalue).toEqual(25.50);
    
    expect (adacoin_block.validtimestamp()).toBe(true);
    expect (adacoin_block.validtransaction()).toBe(true);

    //expect(() => adacoin_block.validtimestamp()).toThrow(AdaError);    
  });

  test('1.2 Test Case Chain...', () => {
    let adacoin_wallet = new Chain (); // create a new chain instance

    expect (adacoin_wallet).toBeInstanceOf(Chain);
    expect(() => adacoin_wallet.addblock( new Block( '2022-1-19', { credit: '25.50', tid: 'A0001' }) ) // add credit transaction
      .toThrow(AdaError));
    expect(() => adacoin_wallet.addblock( new Block( '2022-1-20', { debit: '5.50', tid: 'A0002' }) ) // add credit transaction
      .toThrow(AdaError));
    expect(() => adacoin_wallet.addblock( new Block( '2022-1-21', { credit: '25.50', tid: 'A0003' }) ) // add credit transaction
      .toThrow(AdaError));
    expect (adacoin_wallet.isvalid()).toBe(true);
    expect (adacoin_wallet.balance()).toBe('£0.00');
       
  });
  
});

 