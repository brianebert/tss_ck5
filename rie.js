// Rich Ipfs Editor

import {CKE5_Page} from './cke5.js';


// just in case you find a good way to pass this in
const sourceAccountSecret = null;

  // Parse the url for Stellar account number and data entry name where document's ipfs address is saved
let queryParameters = {}; let entries = [];
const segments = window.location.href.split('?');
if(segments.length === 2)
  entries = segments.pop().split('&').map(pair => pair.split('='));
// check you've parsed key=value pairs
if(entries.reduce((acc, entry) => acc && (entry.length === 2), true))
  // then make Object from them
  queryParameters = Object.fromEntries(entries);

if(!Object.keys(queryParameters).length && segments.length === 2)
  throw new Error(`could not parse urlencoded parameters from entries `, entries)

// create a SigningAccount, with keys if user agrees to sign
// a transaction signature is used as the key seed
const sourceAccount = await CKE5_Page.SigningAccount.checkForWallet(queryParameters?.accountId, sourceAccountSecret);
await sourceAccount.ready;
if(sourceAccount.canSign)
  addOption('accountId', sourceAccount.id);
if(queryParameters?.accountId && queryParameters.accountId !== sourceAccount.id)
  addOption('accountId', queryParameters.accountId, true);

// addOption is a utility function for constructing option lists for the ui
function addOption(elId, value, selected=false, label=true){
  const option = document.createElement('option');
  option.label = label && value.length > 2*7+3 ? `${value.slice(0,7)}...${value.slice(-7)}` : value;
  option.value = value;
  option.selected = selected;
  document.getElementById(elId).appendChild(option);
}

function BlockParameters(queryParameters){
  this.source = {
      init: function(queryParameters, blockParameters){
        this.el.addEventListener('change', function(e){
          console.log(`have set source to ${e.target.value}`);
          document.getElementById('addresses').innerHTML = '';
          if(e.target.value === 'localStorage'){
            for(const key of Object.keys(localStorage))
              addOption('addresses', key, false, false);
            CKE5_Page.source.url = false;          
          }
          else if(e.target.value === 'ipfs')
            CKE5_Page.source.url = (cid) => `https://motia.infura-ipfs.io/ipfs/${cid.toString()}/`;
          else
            console.error(`oops, didn't expect to be here`);
        })
      }
    };
  this.inKeys = {
      init: function(){
        this.el.addEventListener('change', e => {
          document.getElementById('addFrom').hidden =  e.target.value !== 'add';
          document.getElementById('addressInput').dispatchEvent(new Event('change'));
        });
        document.getElementById('addFrom').addEventListener('change', e => addOption('inKeys', e.target.value));
      }
    };
  this.addressInput = {
      init: function(queryParameters, blockParameters){
        this.el.addEventListener('change', () => blockParameters.dataEntryLabel.el.value = '');
        blockParameters.source.el.dispatchEvent(new Event('change'));
      }
    };
  this.sink = {
      init: function(){
        this.el.addEventListener('change', function(e){
          if(e.target.value === 'ipfs')
            CKE5_Page.sink.url = (cid) => typeof cid === 'string' ? `https://motia.com/api/v1/ipfs/pin/add?arg=${cid}` :
                       `          https://motia.com/api/v1/ipfs/block/put?cid-codec=${CKE5_Page.codecForCID(cid).name}`;
           else
            CKE5_Page.sink.url = false;
          console.log(`have set sink url to: `, CKE5_Page.sink.url);
        })
      }
    };
  this.outKeys = {
      init: function(){
        this.el.addEventListener('change', e => {
          document.getElementById('addTo').hidden = e.target.value !== 'add';
        });
        document.getElementById('addTo').addEventListener('change', e => addOption('outKeys', e.target.value));
      }
    };
  this.traverse = {
      init: function(){
        Object.defineProperty(this, 'value', {
          get: function(){
            return !!parseInt(this.el.value)
          }
        });
      }
    };
  this.accountId = {
    init: async function(){
      this.el.addEventListener('change', async function(e){
        const account = await CKE5_Page.SigningAccount.load(e.target.value);
        document.getElementById('dataEntries').innerHTML = '';
        for(const key of Object.keys(account.data))
          addOption('dataEntries', key, false, false);      
      });
    }
  };
  this.dataEntryLabel = {
    init: function(queryParameters, blockParameters){
      if(queryParameters?.dataEntryLabel)
        this.el.value = queryParameters.dataEntryLabel;
      this.el.placeholder = `name of hash`;
      this.el.addEventListener('change', async function(e){
        const hash = await CKE5_Page.SigningAccount.dataEntry(blockParameters.accountId.value, e.target.value);
        console.log(`read hash ${hash} from account ${blockParameters.accountId.value} label ${e.target.value}`);
        blockParameters.addressInput.el.value = hash;
      });
    }
  };
  this.nameIt = {
    init: function(queryParameters, blockParameters){
      this.el.addEventListener('change', async function(e){
        Array.from(document.getElementsByClassName('hashName')).map(function(el){
          el.hidden = !parseInt(e.target.value);
        })
        if(!!parseInt(e.target.value))
          blockParameters.accountId.el.dispatchEvent(new Event('change'));
        console.log(`blockParameters is `, blockParameters);
      });
      Object.defineProperty(this, 'value', {
        get: function(){
          return !!parseInt(this.el.value)
        }
      });
    }
  };
  this.readIt = {
    init: function(queryParameters, blockParameters){
      this.el.addEventListener('click', function(e){
        CKE5_Page.openPage(sourceAccount, blockParameters.addressInput.value);
        //blockParameters.dataEntryLabel.el.value = '';
        //blockParameters.addressInput.el.value = '';
      })
    }
  };
  Object.defineProperty(this, 'persistAll', {
    get: () => {
      console.log(`persist all of this? `, this);
      const {source, inKeys, sink, outKeys} = this;
      return sink.value !== source.value || inKeys.value !== outKeys.value
    }
  });

  for(const key of Object.keys(this)){
    this[key].el = document.getElementById(key);
    if(Object.hasOwn(queryParameters, key))
      Array.from(this[key].el.children).map(child => child.selected = queryParameters[key] === child.value);
    Object.defineProperty(this[key], 'value', {
      get: function(){
        return this.el.value
      },
      set: function(value){
        return this.el.value = value
      },
      configurable: true,
      enumerable: false,
    });
    this[key].init(queryParameters, this);
console.log(`initialized ${key}`);
  }
}

CKE5_Page.topBar = new BlockParameters(queryParameters);