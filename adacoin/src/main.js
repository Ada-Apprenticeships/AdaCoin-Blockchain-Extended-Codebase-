const SHA256 = require('crypto-js/sha256'); // looks in the node_modules folder for the library
const { v4: uuidv4 } = require('uuid'); // for details review https://www.npmjs.com/package/uuid

const fs = require('fs'); // use node's core filesystem module to interact with the os's filesystem 
const log = fs.createWriteStream('./adacoin.log', { flags: 'w+' } ); // flags: 'a' append, 'w+' write


//define the custom adacoin error messages
const ADACOIN_ERROR = {
  MISSING_CREDIT_DEBIT: { id: 'T01', description: 'transaction missing specific credit or debit type' },
  UNEXPECTED_CREDITVALUE: { id: 'T02', description: 'transaction unexpected credit value format (n.nn)' },
  UNEXPECTED_DEBITVALUE: { id: 'T03', description: 'transaction unexpected debit value format (n.nn)' },
  MISSING_ID: { id: 'T04', description: 'transaction missing transaction id' },
  INVALID_DATE: { id: 'D01', description: 'invalid iso date, dates must be: yyyy-mm-dd' },
  CHAIN_UNEXPECTEDFAIL: { id: 'C01', description: 'unexpected failure in chain' }
}


class AdaError extends Error { // create a custom error class, used to throw errors 
  constructor(adaerror, errorvalue) {
    super("AdaCoin Error"); // pass string to the parent/super class
    this.id = adaerror.id; // setup custom properties
    this.description = adaerror.description; // some extra variables to store added detail 
    this.value = errorvalue;
  }
}


class TS { // class used to provide methods and properties to deal with timestamp dates
  #now; // declare a private class variable, used to store the current system time
  constructor() { // constructors are automatically executed when the class object is instantiated
    this.#now = new Date(); // create a date object based on the current system time 
  }

  //return today's date in ISO format (month requires +1 as jan starts with 0 otherwise)
  get today() { return [ this.#now.getFullYear(), (this.#now.getMonth() + 1), this.#now.getDate() ].join('-'); }
  
  isdatevalid(isodate) { // return true or false depending on whether the passed iso date is a valid date
    if (isNaN(Date.parse(isodate))) {
      log.write(`timestamp validation: ${ADACOIN_ERROR.INVALID_DATE.description}, ${isodate}\n`); // update the log record
      throw new AdaError(ADACOIN_ERROR.INVALID_DATE, isodate); // throw immediately returns so no need to return
    }
    return true; //if passed date can't be parsed (convered to a number) then its not a valid date 
  }
  
  dayssince(isodate) {
    //returns an error or the number of days between the isodate and 'today'; negative values are in the future
    try { this.isdatevalid(isodate); } // try and catch
    catch(e) { throw new AdaError(ADACOIN_ERROR.INVALID_DATE, isodate); } // throw immediately returns so no need to return 
    
    let ms = new Date(this.today) - new Date(isodate); //milliseconds (ms) elapsed between dates
    return (((ms / 1000) / 60) / 60) / 24 ; //ms -> seconds -> mins -> hours -> days; returns difference as days
  }
}


const isvalidcurrency = (value) => { // example arrow function 
  // returns true or false based on the value being in the format [-]dd.dd
  // [abc] = range either a, b, c
  // {n} = example n instances
  // * = 0 or more instances
  // + = 1 or more instances
  // ? = 0 or 1 instance
  // \ = escape following character
  // \d = digit
  // https://cheatography.com/davechild/cheat-sheets/regular-expressions/  
  // let regex_numberpattern = /^[+-]?\d+(\.\d+)?$/; //signed, digits (1 or more), decimal point multiple digits
  let regex_numberpattern = /^\d+\.\d{2}$/; // unsigned, digits (1 or more), decimal point multiple digits 
  if(regex_numberpattern.test( value )) return true; // if the format is as expected
  return false; // unexpected format
}


class Block { // blocks are used to support account transactions, chains contain multiple blocks
  constructor(ts, transaction) { // constructors are automatically executed when the class object is instantiated  
    this.ts = ts; // indicates the time stamp when the block was created
    this.transaction = transaction; // holds information to be stored, e.g. details of transaction, how much money transferred, sender, recipient
    this.p_hash = 0; // holds the hash value of the 'previous' block; essential to ensure integrity, initialise as 0
    
    // we also need to include a hash for this block
    this.hash = this.calculatehash(); // lets automatically execute our calculate hash function and store the result
    log.write(`block (${this.ts}) ${this.transaction} instantiated\n`); // update the log record
  }

  calculatehash() { // returns a calculated hash based on the stored values
    return SHA256( this.ts + JSON.stringify(this.transaction) + this.phash ).toString(); // return a string rather than an object
  }

  get phash() { return this.p_hash; } // fyi, 'getters (get)' creates a property rather than a function, meaning we dont need to include round brakets 
  set phash(hash) { this.p_hash = hash; } // fyi, 'setters (set)' creates a property rather than a function, see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/set
  
  get tid() { // return the tid - fyi, 'get' creates a property rather than a function, meaning we dont need to include round brakets 
    return this.transaction.tid;
  }
  
  get creditvalue() { // return the credit value property
    if(this.transaction.credit === undefined) return 0; // if not available return 0
    return Number(this.transaction.credit); // return a numeric value for the transaction
  }

  get debitvalue() { // return the debit value property
    if(this.transaction.debit === undefined) return 0; // if not available return 0
    return Number(this.transaction.debit); // return a numeric value for the transaction
  }
  
  validtimestamp() { // check the timestamp's valid status
    let ts = new TS(); // create a new instance of the timestamp object from the class
    if(!ts.isdatevalid(this.ts)) return false; // is the timestamp in a valid format
    if(ts.dayssince(this.ts) < 0) return false; // is the timestamp range valid (future is negative)
    if(ts.dayssince(this.ts) > 180) return false; // is the timestamp range valid (past is positive)
    return true;
  }

  validtransaction() {
    // check transaction has either a valid credit or debit property value and includes an id 
    if(!(this.transaction.hasOwnProperty('tid'))) { // do we have a transaction id property
      log.write(`block (${this.ts}): ${ADACOIN_ERROR.MISSING_ID.description}\n`); // update the log record
      throw new AdaError(ADACOIN_ERROR.MISSING_ID, this.transaction.tid); // throw immediately returns so no need to return 
    }
    
    if(!(this.transaction.hasOwnProperty('credit') || this.transaction.hasOwnProperty('debit')) ){ // do we have an expected property  
      log.write(`block (${this.ts}): ${ADACOIN_ERROR.MISSING_CREDIT_DEBIT.description}\n`); // update the log record
      throw new AdaError(ADACOIN_ERROR.MISSING_CREDIT_DEBIT); // throw immediately returns so no need to return
    }

    if(this.transaction.hasOwnProperty('credit')) { // if we have a credit property      
      if(!(isvalidcurrency(this.transaction.credit))) { // if so, do we have valid currency value (n.nn)
        log.write(`block (${this.ts}): ${ADACOIN_ERROR.UNEXPECTED_CREDITVALUE.description} - ${this.transaction.credit} \n`);
        throw new AdaError(ADACOIN_ERROR.UNEXPECTED_CREDITVALUE, this.transaction.credit); // throw immediately returns so no need to return
      } 
    }

    if(this.transaction.hasOwnProperty('debit')) { // if we have a debit property      
      if(!(isvalidcurrency(this.transaction.debit))) { // if so, do we have valid currency value (n.nn)
        log.write(`block (${this.ts}): ${ADACOIN_ERROR.UNEXPECTED_DEBITVALUE.description} - ${this.transaction.debit} \n`);
        throw new AdaError(ADACOIN_ERROR.UNEXPECTED_DEBITVALUE, this.transaction.debit); // throw immediately returns so no need to return
      } 
    }
    
    return true; // return a default true state, if we get here we should be good to go
  }  
}


class Chain { // chains are used to hold blocks; blocks are used to support account transactions
  constructor() {
    this.chain = [ this.genesisblock() ]; 
  }

  genesisblock() { // returns a new genesis block, the required starting block
    return new Block('1/1/1970', 'Genesis Block'); //ts, data
  }

  lastblock() { // gets the length of the chain and uses that to return the last block (object)
    return this.chain[this.chain.length - 1];
  }

  balance() { // returns the total balance held in the chain
    // we need to iterated through the entire chain and incorporate the values of each transaction
    let credit = 0, debit = 0; //initialise default credit and debit values
    for( const b of this.chain ) { // lets iterate through the entire chain don'f forget all invalid values return 0
      credit += b.creditvalue; // update the running credit value
      debit += b.debitvalue; // update the running debit value 
    }
    //prepare a formatted uk currency value
    let amount = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(credit - debit);
    log.write(`block (${this.ts}): balance ${amount} \n`);    
    return amount; // return a formatted uk currency value
  }

  rebuild() { //iterate through the chain rebuilding the hashs so that the chain is valid
  }
  
  addblock(newblock) { // returns true or false depending on whether the block was added; additional blocks should be fully verified as valid
    try { newblock.validtransaction(); } // is the transaction data valid (properties and values)
    catch(e) { // the try failed, for some reason an error was returned
      log.write(`addblock transaction: ${ e.message }: ${ e.id }, ${ e.description }, got: ${ e.value }`);
      return false; 
    }

    try { newblock.validtimestamp(); } // is the block's timestamp valid (iso format)
    catch(e) {
      log.write(`addblock timestamp: ${ e.message }: ${ e.id }, ${ e.description }, got: ${ e.value }`);
      return false;
    }
 
    newblock.phash = this.lastblock().hash; // record the previous block hash in the new block (helps secure the chain's integrity)
    newblock.hash = newblock.calculatehash(); // calculate the hash value for the newblock (helping secure data integrity)

    // push the new block in to the chain - not normally this simple in 'real-life' blockchain
    if ((this.chain.length + 1) !== this.chain.push( newblock )) { // 'push' returns the update length
      log.write(`block (${this.ts}): ${ADACOIN_ERROR.CHAIN_UNEXPECTEDFAIL.description} - ${this.transaction.tid} \n`);
      throw new AdaError(ADACOIN_ERROR.CHAIN_UNEXPECTEDFAIL, this.transaction.tid); // throw immediately returns so no need to re
    }

    // quick test to demonstrate differences between accessing via reference and value 
    //newblock.phash = "xxx"; // change the current newblock's previous hash
    //this.chain[this.chain.length -1].phash = "yyy"; // change the newblock version pushed to the array
    // we can see that changing one changes them both despite being different
    //console.log(`newblock phash: ${ newblock.phash }`);
    //console.log(`last block added phash: ${ this.lastblock().phash }`);
    
    return true; // block has been added to the chain
      
  }

  isvalid() {
    // returns true or false depending on whether the entire chain is valid
    for( let b = 1; b < this.chain.length; b++ ) { // lets iterate through the entire chain (not including the genesis (0) block)
      const current = this.chain[ b ]; // the current block being iterated
      const previous = this.chain[ b - 1 ]; // the previous iterated block

      // check stored hash against a calculated version; should be the same if no change       
      if( current.hash !== current.calculatehash() ) { // are they different?
        return false; // if the stored and calculated hashes are different, the transaction has been altered
      }

      // check the stored previous hash with the actual previous hash
      if( current.phash !== previous.hash ) { // are they a match?
        return false; // if the previously stored hash and actual previous hash are different, the link has been altered
      }      
    }
    
    // if we are here, we've iterated through the entire chain and all good
    return true;
  }
  
}


// let adacoin_block = new Block( '2022-1-29', { credit: '25.50', tid: uuidv4() }); // create a new block instance
// console.log(`block ts: ${ adacoin_block.ts }`);
// console.log(`block tid: ${ adacoin_block.tid }`);
// console.log(`block debit value: ${ adacoin_block.debitvalue }`);
// console.log(`block credit value: ${ adacoin_block.creditvalue }`);
// try { console.log(`block validate ts: ${ adacoin_block.validtimestamp() }`); }
// catch(e) { console.log( e.id + ", " + e.description + ", " + e.value); }

// try { console.log(`block validate transaction: ${ adacoin_block.validtransaction() }`); }
// catch(e) { console.log( e.id + ", " + e.description + ", " + e.value); }
// console.log(adacoin_block);



// let adacoin_wallet = new Chain (); // create a new chain instance
// try { adacoin_wallet.addblock( new Block( '2022-1-19', { credit: '25.50', tid: uuidv4() }) ) } // add credit transaction
// catch(e) { console.log(`Failed to add block to chain`) } // catch any thrown error

// try { adacoin_wallet.addblock( new Block( '2022-1-20', { debit: '6.99', tid: uuidv4() }) ) } // add debit transaction
// catch(e) { console.log(`Failed to add block to chain`) } // catch any thrown error

// try { adacoin_wallet.addblock( new Block( '2022-1-21', { credit: '5.45', tid: uuidv4() }) ) } // add credit transaction
// catch(e) { console.log(`Failed to add block to chain`) } // catch any thrown error

// console.log(`wallet valid: ${ adacoin_wallet.isvalid() }`); // use template literals or template strings for format string
// console.log(`wallet balance: ${ adacoin_wallet.balance() }`);
// console.log(adacoin_wallet);


module.exports = { ADACOIN_ERROR, AdaError, TS, isvalidcurrency, Block, Chain }; // expose (export) the selected functions and classes