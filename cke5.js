import {Encrypted_Node, SigningAccount} from '@brianebert/tss';
import {CK_Watchdog} from './editor.js';
import { CID } from 'multiformats/cid'

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
const sourceAccount = await SigningAccount.checkForWallet(queryParameters?.accountId, sourceAccountSecret);
await sourceAccount.ready;
if(sourceAccount.canSign)
  addOption('accountId', sourceAccount.id);
if(queryParameters?.accountId && queryParameters.accountId !== sourceAccount.id)
  addOption('accountId', queryParameters.accountId, true);

/*const sourceAccount = await SigningAccount.fromWallet(queryParameters.accountId);
if(await SigningAccount.canSign(sourceAccount) )
  await sourceAccount.deriveKeys(sourceAccountSecret, {asymetric: 'Asymetric', signing: 'Signing', shareKX: 'ShareKX'})
                     .catch(err => console.error(`Error deriving keys for SigningAccount ${sA.account.id}`, err));
*/

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
        const account = await SigningAccount.load(e.target.value);
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
        const hash = await SigningAccount.dataEntry(blockParameters.accountId.value, e.target.value);
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
    get: function(){
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
      configurable: true,
      enumerable: false,
    });
    this[key].init(queryParameters, this);
console.log(`initialized ${key}`);
  }
}

function PageControls(node){
  Object.defineProperty(this, 'node', {
    value: node,
    configurable: false,
    enumerable: false,
  });
  function tryToLink(name, address){
    try {
      const cid = CID.parse(address);
      this.node.pageLinks.push(name, cid);
      this.node.pageLinks.renderBeneath(document.getElementById('subPages'));
    } catch (err) {
      console.error(`caught error linking pages ${this.node.cid.toString()} and ${address} with name ${name}`, err);
    }
  }
  this.saveButton = {
    listener: {
      type: 'click',
      fn: async e => {
        const autoSave = window.watchdog.editor.plugins.get('Autosave');
        console.log(`autoSave is: `, autoSave);
        if(autoSave.state === 'waiting')
          await autoSave.save(window.watchdog.editor);
        CKE5_Page.readOnlyMode(true);
      }
    }
  };
  this.editingPage = {
    reset: function(node){
      this.el.value = node.cid.toString();
    }
  };
  this.editingRoot = {
    reset: function(node){
      this.el.value = node.cid.toString();
    }
  };
  this.oldName = {
    reset: function(node){
      this.el.value = node.name;
    }
  };
  this.newName = {
    reset: function(){
      this.el.value = '';
    }
  };
  this.pageSelect = {
    listener: {
      type: 'change',
      fn: e => CKE5_Page.openPage(node.signingAccount, e.target.value)
    }
  };
  this.homeButton = {
    reset: function(node){
      this.el.value = node.cid.toString();
    }
    listener: {
      type: 'click',
      fn: e => CKE5_Page.openPage(node.signingAccount, e.target.value)
    }
  };
  this.upButton = {
    reset: function(node){
      if(node.parents.length > 0)
        this.el.value = node.parents[0].cid.toString();
    }
    listener: {
      type: 'click',
      fn: e => CKE5_Page.openPage(node.signingAccount, e.target.value)
    }
  };
  this.editButton = {
    listener: {
      type: 'click',
      fn: e => CKE5_Page.readOnlyMode(false)
    }
  };
  this.editSelect = {
    listener: {
      type: 'change',
      fn: e => 
        Array.from(document.getElementsByClassName('pageControls'))
             .map(el => el.hidden = el.id !== e.target.value)
    }    
  };
  this.pageName = {
    reset: function(){
      this.el.value = '';
    },
    listener: {
      type: 'change',
      fn: async e => {
        if(e.target.value.length > 0){
          const page = await CKE5_Page.openPage(node.signingAccount, null, e.target.value);
          await this.mapPages(page) // keys, selectValue not needed since only will create the one option
          //document.getElementById('newPage').hidden = true
        }
      }
    }
  };
  this.linkName = {
    reset: function(){
      this.el.value = '';
    },
    listener: {
      type: 'change',
      fn: e => {
        if(e.target.value.length > 0 && this.linkAddress.value.length > 0)
          tryToLink(e.target.value, this.linkAddress.value)
      }
    }
  };
  this.linkAddress = {
    reset: function(){
      this.el.value = '';
    },
    listener: {
      type: 'change',
      fn: e => {
        if(e.target.value.length > 0 && this.linkName.value.length > 0)
          tryToLink(this.linkName.value, e.target.value)
      }
    }
  };
  this.unlinkName = {
    reset: function(){
      this.el.value = '';
    },
    listener: {
      type: 'change',
      fn: e => {
        if(e.target.value.length > 0 )
          node.pageLinks.rm(e.target.value);
      }
    }   
  };
  this.rmAddress = {
    reset: function(){
      this.el.value = '';
    },
    listener: {
      type: 'change',
        fn: e => {
        Array.from(document.getElementById('addresses')).filter(child => child.value === e.target.value).map(child => child.remove());
        // ?? CKE5_Page.blockParameters.addressInput.dispatchEvent(new Event('change'));
        CKE5_Page.rm(e.target.value);
      }
    }
  };
  Object.defineProperty(this, 'reset', {
    value: function(){
      for(const [key, value] of Object.entries(this)){
        if(Object.hasOwn(value, 'listener')){
          value.el.replaceWith(value.el.cloneNode(true));
          value.el.addEventListener(value.listener.type, value.listener.fn);
        }
        if(Object.hasOwn(value, 'reset'))
          value.reset(this.node);
      }
      return this
    },
    configurable: false,
    enumerable: false,
  });
console.log(`constructing PageControls with keys `, Object.keys(this));
  for(const key of Object.keys(this)){
    this[key].el = document.getElementById(key);      
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
console.log(`initialized ${key}`);
  }
}

class CKE5_Page extends Encrypted_Node {
  #root; #pageControls;
  constructor(){
    super(...arguments);
    this.#root = this.cid;

    // below are elements that need listeners stripped when changing pages
    this.elIds = ['editingPage', 'editingRoot', 'pageName', 'pageSelect', 'editSelect',
                  'upButton', 'rmAddress', 'unlinkName', 'linkAddress', 'editButton',
                  'linkName', 'oldName', 'newName']; // edit instances of rmSelect 
    // element editor uses
    this.editorEl = document.querySelector('.editor');
    this.pageLinks = {
      links: {},
      onclick: e => CKE5_Page.openPage(this.signingAccount, e.target.value),
      push: function(key, value){
        if(Object.keys(this.links).includes(key) || Object.values(this.links).includes(value))
          throw new Error(`cannot set new link from ${key} or to ${value}`)
        this.links[key] = value;
      },
      renderBeneath: function(parentEl){
        parentEl.innerHTML = '';
        for(const [key, value] of Object.entries(this.links)){
          const button = document.createElement('button');
          button.addEventListener('click', this.onclick);
          button.id = `${key}SubpageButton`;
          button.value = value.toString();
          button.textContent = key;
          parentEl.appendChild(button);
        }
      },
      rm(key){
        if(Object.hasOwn(this.links, key)){
          document.getElementById(`${key}SubpageButton`).remove();
          this.links[key] = undefined;
        }
      },
      update: function(values){
        for(const [key, value] of Object.entries(this.links))
          if(value !== undefined)
            values[key] = value;
          else
            delete values[key];
      }
    };
  }

  get root(){
    return this.#root
  }

  static blockParameters;

  static async mapPages(root, keys, selectValue){
console.log(`populating page selector for ${root.name} with ${selectValue} selected.`);
    const subPageLinks = Array.from(document.getElementById('subPages').children);
    subPageLinks.map(link => link.disabled = true);
    const el = document.getElementById('pageSelect');
    el.disabled = true;
    el.innerHTML = '';
    const opts = [];
    function populateSelectOption(page, depth){
console.log(`creating page select option ${page.name}, value ${page.cid.toString()}`);
      const pageOption = document.createElement('option');
      let indent;
      for(indent=''; depth; depth--)
        indent += '**|';
      pageOption.label = indent + ' ' + page.name;
      pageOption.value = page.cid.toString();
      pageOption.selected = pageOption.value === selectValue;
      opts.unshift(pageOption);
      return Promise.resolve();
    }
    if(CKE5_Page.blockParameters.traverse.value){
      await this.traverse(root.cid, populateSelectOption, keys);
      subPageLinks.map(link => link.disabled = false);
    }
    else
      populateSelectOption(root, 0);
    for(const option of opts)
      el.append(option);
    el.disabled = false;
  }

  static async openPage(signingAccount, address=null, name=''){
  console.log(`entered openPage() with name ${name}, address ${address} signingAccount `, signingAccount);
    // save old page if necessary
    if(window?.watchdog){
      const editor = window.watchdog.editor;
      const pendingActions = editor.plugins.get('PendingActions');
      if(Array.from(pendingActions).filter(pa => pa.message === 'Saving changes').length){
        console.log(`must save ${window.collab.name} before loading new page`);
        await editor.plugins.get('Autosave').save(editor);
      }
    }
    // make keys
    switch(this.blockParameters.inKeys.value){
    case 'plaintext':
      var keys = null;
      break;
    case 'add':
      const other = document.getElementById('addFrom');
      addOption('inKeys', other.value, true);
      var keys = await signingAccount.keys.readFrom(other.value);
      break;
    default:
      var keys = await signingAccount.keys.readFrom(this.blockParameters.inKeys.value)
    }
    
    try {
      if(address){
  console.log(`reading page from address ${address} with keys `, keys);
        window.collab = await this.fromCID(signingAccount, address, keys);
      }
      else {
  console.log(`creating page ${name} using signingAccount `, signingAccount);
        window.collab = new this({colName: name}, signingAccount);
        await window.collab.ready;
  console.log(`created page ${window.collab.name} `, window.collab);
      }
      CKE5_Page.refreshPageview();
      window.collab.cache = this.cache; // here for debugging. Can remove later
      console.log(`${window.collab.name}'s subpage links are: `, window.collab.links);
      return window.collab
    } catch (err) {
      console.error(`error opening ${address}`, err);
    }  
  }

  static lockId = Symbol();
  static readOnlyMode(bool){
    console.log(`window.collab is: `, window?.collab);
    const editor = window.watchdog.editor;
    const pageSelectLabel = bool ? 'Reading Page: ' : 'Editing Page: ';
    bool ? editor.enableReadOnlyMode(this.lockId) : editor.disableReadOnlyMode(this.lockId);
    Array.from(document.getElementsByClassName('pageControls')).forEach(el => el.hidden = true);
    document.getElementById('editSelect').hidden = bool
    document.getElementById('pageSelectLabel').textContent = pageSelectLabel;
    document.getElementById('saveButton').disabled = bool;
    document.getElementById('editButton').hidden = !bool;
  }

  static refreshPageview(){
    const node = window.collab;
    node.#pageControls = new PageControls(node).reset();
    console.log(`refreshing page for `, node);
    if(Object.hasOwn(window, 'watchdog'))
      window.watchdog.destroy();
/*
    node.elements = [];
    for(const elId of node.elIds){
      // strip listeners from elements of UI
      const el = document.getElementById(elId);
console.log(`calling replaceWith() on element id ${elId}`);
      el.replaceWith(node.elements[elId] = el.cloneNode(true));
    }

    // populate editor contents and "Page Address" of UI
    if(Object.hasOwn(node.value, 'editorContents')){
      node.elements.editingRoot.value = node.root.toString();
      node.elements.editingPage.value = node.cid.toString();
      node.editorEl.innerHTML = node.value.editorContents;
    } else {
      node.elements.editingPage.value = '';
      node.elements.editingRoot.value = '';
      node.editorEl.innerHTML = '';
    }

    if(!!node.parents.length){
      document.getElementById('homeButton').disabled = false;
      node.elements['upButton'].addEventListener('click', e => 
        CKE5_Page.openPage(node.signingAccount, e.target.value)
      );
      node.elements['upButton'].value = node.parents[0].cid.toString();
      node.elements['upButton'].disabled = false;
    } else {
      document.getElementById('homeButton').disabled = true;
      node.elements['upButton'].disabled = true;
    }

    const subpagesEl = document.getElementById('subPages');
    for(const [key, value] of Object.entries(node.links))
      if(!key.endsWith('_last'))
        node.pageLinks.push(key, value);
    node.pageLinks.renderBeneath(subpagesEl);



    node.elements.editButton.addEventListener('click', e => {
      console.log(`clicked editButton`);
      return CKE5_Page.readOnlyMode(false)
    });
    document.getElementById('saveButton').addEventListener('click', async e => {
      const autoSave = window.watchdog.editor.plugins.get('Autosave');
      console.log(`autoSave is: `, autoSave);
      if(autoSave.state === 'waiting')
        await autoSave.save(window.watchdog.editor);
      this.readOnlyMode(true);
    });
    document.getElementById('subpagesLabel').hidden = !subpagesEl.children.length;
    for(let i = 0; i < subpagesEl.children.length; i++)
      subpagesEl.children[i].addEventListener('click', e => CKE5_Page.openPage(node.signingAccount, e.target.value));

    node.elements.pageSelect.addEventListener('change', e => CKE5_Page.openPage(node.signingAccount, e.target.value));
    //node.elements.rmSelect.addEventListener('change', e => node.rmSubpage(e));
    node.elements.editSelect.addEventListener('change', e => {
      Array.from(document.getElementsByClassName('pageControls')).map(el => el.hidden = el.id !== e.target.value)
    })

    node.elements.pageName.addEventListener('change', async e => {
      if(e.target.value.length > 0){
        const page = await this.openPage(node.signingAccount, null, e.target.value);
        await this.mapPages(page) // keys, selectValue not needed since only will create the one option
        //document.getElementById('newPage').hidden = true
      }
    });

    function linkPage(node){
      const nameEl = node.elements.linkName;
      const addressEl = node.elements.linkAddress;

      return (e) => {
        const name = nameEl.value;
        const address = addressEl.value;
        if(address.length > 0 && name.length > 0 && !Object.hasOwn(node.pageLinks.links, name))
          try {
            const cid = CID.parse(address);
            node.pageLinks.push(name, cid);
            node.pageLinks.renderBeneath(subpagesEl);
          } catch (err) {
            console.error(`caught error linking pages ${node.cid.toString()} and ${address} with name ${name}`, err);
          }
      }
    }

    node.elements.linkName.addEventListener('change', linkPage(node));
    node.elements.linkAddress.addEventListener('change', linkPage(node));

    node.elements.unlinkName.addEventListener('change', e => {
      if(e.target.value in node.pageLinks.links)
        node.pageLinks.rm(e.target.value);
    })

    node.elements.rmAddress.addEventListener('change', e => {
      Array.from(document.getElementById('addresses')).filter(child => child.value === e.target.value).map(child => child.remove());
      CKE5_Page.blockParameters.addressInput.dispatchEvent(new Event('change'));
      this.rm(e.target.value);
    });

    node.elements.newName.addEventListener('change', e => {
      if(e.target.value.length > 0 && e.target.value !== node.name)
        this.startAutosave();
    });

    const nameInputs = Array.from(document.getElementsByClassName('nameInput'));
console.log(`filtered ${nameInputs.length} name input elments: `, nameInputs);
    for(const el of nameInputs){
      el.addEventListener('keydown', e => el.size++);
      el.addEventListener('keyup', e => {
        el.size = el.value.length ? el.value.length : 4;
        e.target.setCustomValidity('');
        if(!e.target.reportValidity())
          e.target.setCustomValidity(`name cannot be ${e.target.value}`);
      });
    }

    // set page selector to current page
    const pages = node.elements['pageSelect'].children;
    if(pages.length > 0)
      for(const page of Array.from(pages))
        page.selected = page.value === node.cid.toString();
    node.elements['pageSelect'].disabled = false;
*/
    window.watchdog = new CK_Watchdog(
      node.editorEl, 
      () => CKE5_Page.readOnlyMode(true), 
      document.getElementById('saveButton')
    );    
    window.scroll(0,0);
  }

  static startAutosave(){
    // Any comment will trigger CKEditor5 autosave and is stripped too!
    window.watchdog.editor.setData('<!-- -->' + window.watchdog.editor.getData())
  }

  // do not call directly. It will be called by the Editor's autosave module.
  async saveData(editor){
    console.log(`saving data for this: `, this);
    const value = Object.assign({}, this.value);
    const newColName = document.getElementById('newName').value
    if(newColName.length > 0)
      value.colName = newColName;
    this.pageLinks.update(value);
    value.editorContents = editor.getData();
    const keys = await this.signingAccount.keys.writeTo('self');
console.log(`encrypting for self with keys `, keys);
    return this.update(value, keys).then(async root => {
      this.#root = root;
      document.getElementById('homeButton').value = root.cid.toString();
      document.getElementById('editingRoot').value = root.cid.toString();
      document.getElementById('editingPage').value = this.cid.toString();
      if(this.parents.length)
        // this needs to take into account when there are more than one parent.
        document.getElementById('upButton').value = this.parents[0].cid.toString();
      CKE5_Page.persist(root, keys);
      CKE5_Page.mapPages(
        root, await this.signingAccount.keys.readFrom('self'), 
        this.cid.toString()
      );
    })
  }
}

/* Now start the program running
 */

CKE5_Page.blockParameters = new BlockParameters(queryParameters);
//CKE5_Page.blockParameters.addressInput.el.value = document.getElementById('addresses').children[0].value;
//CKE5_Page.blockParameters.addressInput.el.dispatchEvent(new Event('change'))

//CKE5_Page.publishPlaintext(window.collab, keys, 'tssDoc');
