import {Encrypted_Node, SigningAccount} from '@brianebert/tss';
import {CK_Watchdog} from './editor.js';

const sourceAccountSecret = null;

  // Parse the url for Stellar account number and data entry name where document's ipfs address is saved
let queryParameters = {};
const segments = window.location.href.split('?');
if(segments.length === 2)
  var entries = segments.pop().split('&').map(pair => pair.split('='));
if(entries.reduce((acc, entry) => acc && (entry.length === 2), true))
  queryParameters = Object.fromEntries(entries);
  // did we get the right parameters in the query string?
  //if(qP === undefined || !Object.hasOwn(qP, 'readFrom')/* || !Object.hasOwn(qP, 'address') || !Object.hasOwn(qP, 'writeTo') || !Object.hasOwn(qP, 'label')*/)
    //throw new Error(`data root source must appear in url query string`)

  // create a SigningAccount, with keys if user agrees to sign
  // a transaction used as a key seed
  const sourceAccount = await SigningAccount.fromWallet(queryParameters.accountId);
  if(await SigningAccount.canSign(sourceAccount))
    await sourceAccount.deriveKeys(sourceAccountSecret, {asymetric: 'Asymetric', signing: 'Signing', shareKX: 'ShareKX'})
                       .catch(err => console.error(`Error deriving keys for SigningAccount ${sA.account.id}`, err));


function addOption(elId, value, selected=false){
  const option = document.createElement('option');
  option.label = option.value = value;
  option.selected = selected;
  document.getElementById(elId).appendChild(option);
}

function BlockParameters(accountId){
  this.source = {
      init: function(){
console.log(`initializing this.source `, this);
        this.el.addEventListener('change', function(e){
console.log(`executing address selector change on this  `, this);         
          if(e.target.value === 'ipfs')
            CKE5_Page.source.url = (cid) => `https://motia.infura-ipfs.io/ipfs/${cid.toString()}`;
          else
            CKE5_Page.source.url = false;
          console.log(`have set source url to: `, CKE5_Page.source);
          if(e.target.value === 'localStorage'){
            document.getElementById('addressInput').hidden = true;
            for(const key of Object.keys(localStorage))
              addOption('address', key);
          } else {
            this.el = document.getElementById('addressInput');
            document.getElementById('address').hidden = true;
          }
          this.el.hidden = false;
        }.bind(this));
        this.el.dispatchEvent(new Event('change'));
      }
    };
  this.inKeys = {
      init: function(){
        this.el.addEventListener('change', e => {
          document.getElementById('addFrom').hidden =  e.target.value !== 'add';
          document.getElementById('address').dispatchEvent(new Event('change'));
        });
        document.getElementById('addFrom').addEventListener('change', e => addOption('inKeys', e.target.value));
      }
    };
  this.address = {
      init: function(){
        for(const el of document.getElementsByClassName('addressInputs'))
          el.addEventListener('change', e => CKE5_Page.openPage(sourceAccount, e.target.value));
      }
    };
  this.sink = {
      init: function(){
        this.el.addEventListener('change', function(e){
          if(e.target.value === 'ipfs')
            CKE5_Page.sink.url = (cid) => typeof cid === 'string' ? `https://motia.com/api/v1/ipfs/pin/add?arg=${cid}` :
                       `          https://motia.com/api/v1/ipfs/block/put?cid-codec=${CKE5_Page.codecForCID(cid).name}`;
           else
            CKE5_Page.source.url = false;
          console.log(`have set sink url to: `, CKE5_Page.sink);
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
        //delete this.value;
        // this below is the BlockParameters instance's traverse object
        Object.defineProperty(this, 'value', {
          get: function(){
            return !!parseInt(this.el.value)
          }
        });
      }
    };

  for(const key of Object.keys(this)){
    this[key].el = document.getElementById(key);
    if(Object.hasOwn(queryParameters, key))
      Array.from(this[key].el.children).map(child => child.selected = queryParameters[key] === child.value);
    Object.defineProperty(this[key], 'value', {
      get: function(){
        return this.el.value
      },
      configurable: true,
      enumerable: true,
    });
    this[key].init();
console.log(`initialized ${key}`);
  }
}

class CKE5_Page extends Encrypted_Node {
  #root;
  constructor(value, signingAccount){
console.log(`creating CKE5_Page from arguments: `, arguments);
    super(value, signingAccount);
    this.#root = this.cid;

    // below are elements that need listeners stripped when changing pages
    this.elIds = ['editingPage', 'editingRoot', 'pageName', 'pageSelect', 'editSelect',
                  'upButton', 'rmAddress', 'unlinkName', 'linkAddress',
                  'linkName']; // edit instances of rmSelect 
    // element editor uses
    this.editorEl = document.querySelector('.editor');
  }

  get root(){
    return this.#root
  }

  static blockParameters;

/*  static async addPage(e, signingAccount){
    const name = e.target.value;
    console.log(`in addPage with name ${name} and signingAccount: `, signingAccount);
    window.collab = await new CKE5_Page({colName: name, editorContents: ''}, signingAccount).write(name);
    this.refreshPageview(e)
  }*/

  static async enterPage(event, signingAccount){
    let savedEditor = false;
    if(window?.watchdog){
      const editor = window.watchdog.editor;
      const pendingActions = editor.plugins.get('PendingActions');
      if(Array.from(pendingActions).filter(pa => pa.message === 'Saving changes').length){
        console.log(`must save ${window.collab.name} before loading new page`);
        await editor.plugins.get('Autosave').save(editor);
        savedEditor = true;
      }
    }
    
    const ec25519 = signingAccount.ec25519;
    const keys = ec25519 ? {writer: ec25519.pk, reader: ec25519.sk} : null;
    window.collab = await this.fromCID(signingAccount, event.target.value, keys);
    console.log(`set window.collab to: `, window.collab);
    this.refreshPageview();
    if(savedEditor){
      const root = CKE5_Page.cache.filter(page => page.parents.length === 0).pop();
      console.log(`filtered cache for root: `, root);
      const ec25519 = root.signingAccount.ec25519;
      const keys = ec25519 ? {reader: ec25519.sk, writer: ec25519.pk} : null;
      this.populatePageSelect(root, keys, window.collab.cid.toString());
    }
  }

  static async init(keys){
console.log(`entered init() with keys: `, keys);
    const homeButton = document.getElementById('homeButton');
    homeButton.value = window.collab.cid.toString();
    homeButton.addEventListener('click', e => CKE5_Page.enterPage(e, window.collab.signingAccount));
    document.getElementById('editingRoot').value = homeButton.value;
    document.getElementById('editSelect').addEventListener('change', function(e){
      Array.from(document.getElementsByClassName('pageControls')).forEach(el => el.hidden = true);
      if(e.target.value.length)
        document.getElementById(e.target.value).hidden = false;
    })
    this.refreshPageview();
    //await this.populatePageSelect(window.collab, keys, window.collab.cid.toString());
    console.log(`cache state is: `, CKE5_Page.cache);
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
      if(this.isValidAddress(address)){
  console.log(`reading page from address ${address} with keys `, keys);
        window.collab = await this.fromCID(signingAccount, address, keys);
        //await CKE5_Page.init(keys);
      }
      else {
  console.log(`creating page ${name} using signingAccount `, signingAccount);
        window.collab = new this({colName: name}, signingAccount);
        await window.collab.ready;
  console.log(`created page ${window.collab.name} `, window.collab);
        //CKE5_Page.refreshPageview();
      }
      CKE5_Page.refreshPageview();
      window.collab.cache = this.cache; // here for debugging. Can remove later
      console.log(`${window.collab.name}'s subpage links are: `, window.collab.links);
    } catch (err) {
      console.error(`error opening ${address}`, err);
    }  
  }


  /*static pageLinkingElements(key, value){
    const button = document.createElement('button');
    const option = document.createElement('option');
    button.type = 'button';
    button.textContent = key;
    button.value = value;
    option.value = value;
    option.label = key;
    return [button, option] 
  }*/

  // populates page selector with options indented to create a site map.
  // calling .traverse() adds backlinks to parent COL_Nodes.
  static async populatePageSelect(root, keys, selectValue){
console.log(`populating page selector for ${root.name} with ${selectValue} selected.`);
    const subPageLinks = Array.from(document.getElementById('subPages').children);
    subPageLinks.forEach(link => link.disabled = true);
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
    await this.traverse(root.cid, populateSelectOption, keys);
    for(const option of opts)
      el.append(option);
    el.disabled = false;
    subPageLinks.forEach(link => link.disabled = false);
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
    console.log(`refreshing page for `, node);
    if(Object.hasOwn(window, 'watchdog'))
      window.watchdog.destroy();

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
    subpagesEl.innerHTML = '';
    //node.elements['rmSelect'].innerHTML = `<option>choose from</option>`;
    const linkKeys = Object.keys(node.links);
    if(linkKeys.length)
      for(const key of linkKeys)
        if(!key.endsWith('_last')){
          const button = document.createElement('button');
          button.value = node.links[key].toString();
          button.textContent = key; 
          button.type = 'button'; 
          //const [button, option] = this.pageLinkingElements(key, node.links[key].toString());
          //node.elements['rmSelect'].appendChild(option);
          subpagesEl.appendChild(button);
        }

    document.getElementById('editButton').addEventListener('click', e => {
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
console.log(`${node.name} is setting pageName change listener with signingAccount`, node.signingAccount);
    node.elements.pageName.addEventListener('change', e => {
console.log(`change event listener executing with window.collab.signingAccount `, window.collab.signingAccount);
      this.openPage(window.collab.signingAccount, null, e.target.value);
      document.getElementById('newPage').hidden = true
    });
    const nameInputs = Object.keys(node.elements).filter(key => key.endsWith('Name'));
console.log(`filtered ${nameInputs.length} name input elments: `, nameInputs);
    for(const input of nameInputs){
      const el = node.elements[input];
      el.addEventListener('keydown', e => el.size++);
      el.addEventListener('keyup', e => {
        el.size = el.value.length ? el.value.length : 1;
        e.target.setCustomValidity('');
        if(!e.target.reportValidity())
          e.target.setCustomValidity(`name cannot be ${e.target.value}`);
      });
    }

    /*node.elements.pageName.addEventListener('keydown', e => node.elements.pageName.size++);
    node.elements.pageName.addEventListener('keyup', e => {
      const value = node.elements.pageName.value;
      node.elements.pageName.size = value.length ? value.length : 1;
      e.target.setCustomValidity('');
      if(!e.target.reportValidity())
        e.target.setCustomValidity(`name cannot be ${e.target.value}`);
    });*/

    // set page selector to current page
    const pages = node.elements['pageSelect'].children;
    if(pages.length > 0)
      for(const page of Array.from(pages))
        page.selected = page.value === node.cid.toString();
    node.elements['pageSelect'].disabled = false;

    window.watchdog = new CK_Watchdog(
      node.editorEl, 
      () => CKE5_Page.readOnlyMode(true), 
      document.getElementById('saveButton')
    );    
    window.scroll(0,0);
  }

  /*addSubpage(evt){
    const name = evt.target.value;
    evt.target.value = ''; // ¡¡¡ must go before setting evt.target.size !!!
    evt.target.size = evt.target.placeholder.length + 1;
    console.log(`called addSubpage(${name}) on node: `, this);
    const subpage = new CKE5_Page({colName: name}, this.signingAccount);
    const ec25519 = this.signingAccount.ec25519;
    const keys = ec25519 ? {writer: ec25519.sk, reader: ec25519.pk} : null;
    return this.insert(subpage, name, keys)
      .then(root => {
        document.getElementById('editingPage').value = this.cid.toString();
        document.getElementById('editingRoot').value = root.cid.toString();
        const [button, option] = CKE5_Page.pageLinkingElements(subpage.name, subpage.cid.toString());
        button.addEventListener('click', e => CKE5_Page.enterPage(e, this.signingAccount))
        document.getElementById('subPages').appendChild(button);
        //document.getElementById('rmSelect').appendChild(option);
        //Encrypted_Node.persist(root.signingAccount,qP.label, root.cid, keys);
        return CKE5_Page.populatePageSelect(root, keys, this.cid.toString());
      })
  }*/

  // this will crash if called because rmSelect does not exist.
  rmSubpage(evt){
    const name = Array.from(evt.target.selectedOptions).pop().label;
    if(!confirm(`Are you sure you want to remove page ${name}? (and all of its subpages!`)){
      document.getElementById('rmSelect').firstElementChild.selected = true;
      return
    }
    delete this.value[name];
    // ¡¡¡remove select option last of all UI components!!!
    Array.from(document.getElementById('subPages').children).filter(but => but.value === evt.target.value).pop().remove();
    //Array.from(document.getElementById('rmSelect').children).filter(opt => opt.value === evt.target.value).pop().remove();
    document.getElementById('subpagesLabel').hidden = !document.getElementById('subPages').children.length;
    window.watchdog.editor.plugins.get('Autosave').save(window.watchdog.editor);
  }

  // do not call directly. It will be called by the Editor's autosave module.
  saveData(editor){
    console.log(`saving data for this: `, this);
    const value = Object.assign({}, this.value);
    value.editorContents = editor.getData();
    const keys = this.signingAccount.keys.writeTo('self');
console.log(`encrypting for self with keys `, keys);
    return this.update(value, keys).then(root => {
      this.#root = root.cid;
      document.getElementById('homeButton').value = root.cid.toString();
      if(this.parents.length)
        // this needs to take into account when there are more than one parent.
        document.getElementById('upButton').value = this.parents[0].cid.toString();
      //if(SigningAccount.canSign(root.signingAccount))
        //Encrypted_Node.persist(root.signingAccount,qP.label, root.cid, keys);
      document.getElementById('editingRoot').value = root.cid.toString();
      document.getElementById('editingPage').value = this.cid.toString();
      if(CKE5_Page.blockParameters.traverse)
        CKE5_Page.populatePageSelect(root, this.signingAccount.keys.readFrom('self'), this.cid.toString());
    })
  }
}

/* Now start the program running
 */
CKE5_Page.blockParameters = new BlockParameters();
CKE5_Page.blockParameters.address.el.dispatchEvent(new Event('change'))

//window.collab = await CKE5_Page.fromCID(sourceAccount, qP.address, keys);
//await CKE5_Page.init(keys);
//CKE5_Page.publishPlaintext(window.collab, keys, 'tssDoc');
