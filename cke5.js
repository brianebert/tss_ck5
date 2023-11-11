import {SigningAccount, COL_Node} from "@brianebert/tss";

const GREEN_BACKGROUND = '#ccffcc';
const RED_BACKGROUND = '#ffcccc';

// creates an editor with a CK watchdog wrapped around it. Calls a beforeUnload listener to prevent loss of data
class CK_Watchdog {
  constructor(el, setEditorState, saveButton){
    function handleEditorError( error ) { // from ckeditor demo
      console.error( 'Oops, something went wrong!' );
      console.error( 'Please, report the following error on https://github.com/ckeditor/ckeditor5/issues with the build id and the error stack trace:' );
      console.warn( 'Build id: 5idtv2qgr0lp-96kg0aobkl70' );
      console.error( error );
    };

    // This block came from CKSource nearly verbatim
    const wd = new window.CKSource.EditorWatchdog();
    wd.setCreator( ( element, config ) => 
      window.CKSource.Editor.create( element, config )
                            .then(editor => 
                              CK_Watchdog.displayStatus(editor, saveButton)
                            )
    );
    wd.setDestructor( editor => editor.destroy());      
    wd.on( 'error', handleEditorError );   
    wd.create( el, {licenseKey: '', width: '80%'}).catch( handleEditorError ).then(setEditorState);
    return wd
  }

  // saves content immediately if user declines to leave page
  static beforeUnloadListener(e){
    e.preventDefault();
    e.returnValue = '';
    const editor = window.watchdog.editor;
    const pendingActions = editor.plugins.get( 'PendingActions' );
    if(Array.from(pendingActions).filter(el => el.message === 'Saving changes').length)
      return editor.plugins.get('Autosave').save(editor)      
  }

  // Update the "Status: Saving..." information.
  static displayStatus( editor, saveButton) {
    const toolbarElement = editor.ui.view.toolbar.element;
    const pendingActions = editor.plugins.get( 'PendingActions' );
    //const saveButton = document.getElementById('saveButton');

    editor.on( 'change:isReadOnly', ( evt, propertyName, isReadOnly ) => {
      if ( isReadOnly ) {
        toolbarElement.style.display = 'none';
      } else {
        toolbarElement.style.display = 'flex';
      }
    });
    pendingActions.on( 'change:hasAny', ( evt, propertyName, newValue ) => {
      if ( newValue ) {
        console.log(`detected editor content change at: ${new Date()}`);
        window.addEventListener('beforeunload', CK_Watchdog.beforeUnloadListener, {capture: true});
        saveButton.style.background = RED_BACKGROUND;
        saveButton.disabled = false
      } else {
        window.removeEventListener('beforeunload', CK_Watchdog.beforeUnloadListener, {capture: true});      
        saveButton.style.background = GREEN_BACKGROUND;
        saveButton.disabled = true
      }
    });
    return editor
  }  
}

// combines SigningAccount keys with COL_Node
class Encrypted_Node extends COL_Node {
  #dataRootLabel; #signingAccount; #status;
  constructor(value, signingAccount, dataRootLabel=null){
    if(!signingAccount instanceof SigningAccount)
      throw new Error(`called Encrypted_Node constructor with signingAccount = `, signingAccount)
    super(value);
    this.#signingAccount = signingAccount;
    this.#status = Promise.resolve();
    if(dataRootLabel)
      this.#dataRootLabel = dataRootLabel;
  }

  get signingAccount(){
    return this.#signingAccount
  }

  static async fromCID(account, cid, keys=null){
    if(!account instanceof SigningAccount)
      throw new Error(`Must call Encrypted_Node.fromCID with a SigningAccount`)
    return this.read(cid, keys).then(async instance => {
        instance.#signingAccount = account;
        await instance.ready;
        return instance
      })
  }

  static async fromSigningAccount(account, dataRootLabel, keys=null){
    const root = await SigningAccount.dataEntry(account.account.id, dataRootLabel);
    console.log(`looked up data root: ${root.toString()}`)
    if(root.length === 0){
      var node = new this({colName: dataRootLabel}, account, dataRootLabel);
      await node.ready;
    }
    else {
      var node = await this.fromCID(account, root.toString(), keys);
      node.#dataRootLabel = dataRootLabel;
    }
    return node
  }

  static async persist(account, label, value){
    return account.setDataEntry(label, value);
  }

  // linking plaintext depends upon depth first COL_Node.traverse()
  static async publishPlaintext(root, keys, docName=null){
    const context = this;
    const ptLinks = {}; // .cid of encrypted graph keys plaintext node.cid.toString()
    async function publishBlock(node){
      const ptValue = Object.assign({}, node.value);
      for(const link of Object.keys(node.links))
        if(!link.endsWith('_last'))
          ptValue[link] = ptLinks[node.links[link]];
      const ptNode = await new context(ptValue, node.signingAccount, node.name).write(node.name, null, false);
      ptLinks[node.cid.toString()] = ptNode.cid.toString();
    }
    const ptRoot = await this.traverse(root.cid, publishBlock, keys);
    console.log(`have published plaintext document at ${ptLinks[ptRoot.cid.toString()]}`)
    await this.persist(root.signingAccount, docName, ptLinks[ptRoot.cid.toString()]);
    console.log(`${root.signingAccount.account.id} has set ${docName} to ${ptLinks[ptRoot.cid.toString()]}`)
  }
}

class CKE5_Page extends Encrypted_Node {
  constructor(args){
    super(args);
    // these are the elements that need listeners stripped when changing pages
    this.elIds = ['editingPage', 'pageName', 'pageSelect', 'rmSelect', 'upButton'];
    this.editorEl = document.querySelector('.editor');
  }

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
    this.refreshPageview(event);
    if(savedEditor){
      const root = CKE5_Page.cache.filter(page => page.parents.length === 0).pop();
      console.log(`filtered cache for root: `, root);
      const ec25519 = root.signingAccount.ec25519;
      const keys = ec25519 ? {reader: ec25519.sk, writer: ec25519.pk} : null;
      this.populatePageSelect(root, keys, window.collab.cid.toString());
    }
  }

  static async init(keys){
    const homeButton = document.getElementById('homeButton');
    homeButton.value = window.collab.cid.toString();
    homeButton.addEventListener('click', e => CKE5_Page.enterPage(e, window.collab.signingAccount));
    document.getElementById('editingRoot').value = homeButton.value;
    this.refreshPageview();
    await this.populatePageSelect(window.collab, keys, window.collab.cid.toString());
    console.log(`cache state is: `, CKE5_Page.cache);
  }

  static pageLinkingElements(key, value){
    const button = document.createElement('button');
    const option = document.createElement('option');
    button.type = 'button';
    button.textContent = key;
    button.value = value;
    option.value = value;
    option.label = key;
    return [button, option] 
  }

  // populates page selector with options indented to create a site map.
  // calling .traverse() adds backlinks to parent COL_Nodes.
  static async populatePageSelect(root, keys, selectValue){
    const el = document.getElementById('pageSelect');
    el.disabled = true;
    el.innerHTML = '';
    const opts = [];
    function populateSelectOption(page, depth){
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
  }

  static readOnlyMode(lockId, bool){
    console.log(`window.collab is: `, window?.collab);
    const editor = window.watchdog.editor;
    const pageSelectLabel = bool ? 'Reading Page: ' : 'Editing Page: ';
    bool ? editor.enableReadOnlyMode(lockId) : editor.disableReadOnlyMode(lockId);
    Array.from(document.getElementsByClassName('pageControls')).forEach(el => el.hidden = bool);
    document.getElementById('pageSelectLabel').textContent = pageSelectLabel;
    document.getElementById('editButton').hidden = !bool;
  }

  static refreshPageview(event=null){
    const node = window.collab;
    console.log(`refreshing page for `, node);
    if(Object.hasOwn(window, 'watchdog'))
      window.watchdog.destroy();

    node.elements = [];
    for(const elId of node.elIds){
      // strip listeners from elements of UI
      const el = document.getElementById(elId);
      el.replaceWith(node.elements[elId] = el.cloneNode(true));
    }

    // populate editor contents and "Page Address" of UI
    if(Object.hasOwn(node.data, 'editorContents')){
      node.elements.editingPage.value = node.cid.toString();
      node.editorEl.innerHTML = node.data.editorContents;
    } else {
      node.elements.editingPage.value = '';
      node.editorEl.innerHTML = '';
    }

    const subpagesEl = document.getElementById('subPages');
    if(!!node.parents.length){
      document.getElementById('homeButton').disabled = false;
      node.elements['upButton'].addEventListener('click', e => 
        CKE5_Page.enterPage(e, node.signingAccount)
      );
      node.elements['upButton'].value = node.parents[0].cid.toString();
      node.elements['upButton'].disabled = false;
    } else {
      document.getElementById('homeButton').disabled = true;
      node.elements['upButton'].disabled = true;
    }

    subpagesEl.innerHTML = '';
    node.elements['rmSelect'].innerHTML = `<option>select page</option>`;
    const linkKeys = Object.keys(node.links);
    if(linkKeys.length)
      for(const key of linkKeys)
        if(!key.endsWith('_last')){
          const [button, option] = this.pageLinkingElements(key, node.links[key].toString());
          node.elements['rmSelect'].appendChild(option);
          subpagesEl.appendChild(button);
        }

    const lockId = Symbol();
    document.getElementById('editButton').addEventListener('click', e => CKE5_Page.readOnlyMode(lockId, false));
    document.getElementById('saveButton').addEventListener('click', e => 
      window.watchdog.editor.plugins.get('Autosave').save(window.watchdog.editor).then(() => 
        this.readOnlyMode(lockId, true)
      )
    );
    document.getElementById('subpagesLabel').hidden = !subpagesEl.children.length;
    for(let i = 0; i < subpagesEl.children.length; i++)
      subpagesEl.children[i].addEventListener('click', e => CKE5_Page.enterPage(e, node.signingAccount));

    node.elements.pageSelect.addEventListener('change', e => CKE5_Page.enterPage(e, node.signingAccount));
    node.elements.rmSelect.addEventListener('change', e => node.rmSubpage(e));
    node.elements.pageName.addEventListener('change', e => node.addSubpage(e));
    node.elements.pageName.addEventListener('keydown', e => node.elements.pageName.size++);
    node.elements.pageName.addEventListener('keyup', e => {
      const value = node.elements.pageName.value;
      node.elements.pageName.size = value.length ? value.length : 1;
      e.target.setCustomValidity('');
      if(!e.target.reportValidity())
        e.target.setCustomValidity(`name cannot be ${e.target.value}`);
    });

    // set page selector to current page
    const pages = node.elements['pageSelect'].children;
    if(pages.length > 0)
      for(const page of Array.from(pages))
        page.selected = page.value === node.cid.toString();
    node.elements['pageSelect'].disabled = false;

    window.watchdog = new CK_Watchdog(
      node.editorEl, 
      () => CKE5_Page.readOnlyMode(lockId, true), 
      document.getElementById('saveButton')
    );    
    window.scroll(0,0);
  }

  static updateEditingAddresses(page, root){
    document.getElementById('editingPage').value = page;
    document.getElementById('editingRoot').value = root;
  }

  addSubpage(evt){
    const name = evt.target.value;
    evt.target.value = ''; // ¡¡¡ must go before setting evt.target.size !!!
    evt.target.size = evt.target.placeholder.length + 1;
    console.log(`called addSubpage(${name}) on node: `, this);
    const subpage = new CKE5_Page({colName: name}, this.signingAccount);
    const ec25519 = this.signingAccount.ec25519;
    const keys = ec25519 ? {writer: ec25519.sk, reader: ec25519.pk} : null;
    return this.insert(subpage, name, keys)
      .then(root => {
        CKE5_Page.updateEditingAddresses(this.cid.toString(), root.cid.toString());
        const [button, option] = CKE5_Page.pageLinkingElements(subpage.name, subpage.cid.toString());
        button.addEventListener('click', e => CKE5_Page.enterPage(e, this.signingAccount))
        document.getElementById('subPages').appendChild(button);
        document.getElementById('rmSelect').appendChild(option);
        return CKE5_Page.populatePageSelect(root, keys, this.cid.toString());
      })
  }

  rmSubpage(evt){
    const name = Array.from(evt.target.selectedOptions).pop().label;
    if(!confirm(`Are you sure you want to remove page ${name}? (and all of its subpages!`)){
      document.getElementById('rmSelect').firstElementChild.selected = true;
      return
    }
    delete this.value[name];
    // ¡¡¡remove select option last of all UI components!!!
    Array.from(document.getElementById('subPages').children).filter(but => but.value === evt.target.value).pop().remove();
    Array.from(document.getElementById('rmSelect').children).filter(opt => opt.value === evt.target.value).pop().remove();
    document.getElementById('subpagesLabel').hidden = !document.getElementById('subPages').children.length;
    window.watchdog.editor.plugins.get('Autosave').save(window.watchdog.editor);
  }

  // do not call directly. It will be called by the Editor's autosave module.
  saveData(editor){
    const value = Object.assign({}, this.value);
    value.editorContents = editor.getData();
    const keys = this.signingAccount.ec25519;
    return this.update(value, keys ? {writer: keys.sk, reader: keys.pk} : null).then(root => {
      document.getElementById('homeButton').value = root.cid.toString();
      if(this.parents.length)
        document.getElementById('upButton').value = this.parents[0].cid.toString();
      const ec25519 = root.signingAccount.ec25519;
      const keys = ec25519 ? {writer: ec25519.pk, reader: ec25519.sk} : null;
      if(root.signingAccount.ed25519) 
        Encrypted_Node.persist(root.signingAccount,root.name, root.cid.toString());
      document.getElementById('editingRoot').value = root.cid.toString();
      document.getElementById('editingPage').value = this.cid.toString();
      CKE5_Page.populatePageSelect(root, keys, this.cid.toString());
    })
  }
}

/* Now start the program running
 */

// First parse the url for Stellar account number and data entry name
const segments = window.location.href.split('?');
const qP = Object.fromEntries(segments.pop().split('&').map(pair => pair.split('=')));
// did we get the right parameters in the query string?
if(qP === undefined || !Object.hasOwn(qP, 'account') || !Object.hasOwn(qP, 'label'))
  throw new Error(`data root account and label must appear in url query string`)

// create a SigningAccount, with keys if user agrees to sign
// a transaction used as a key seed
let sA = await SigningAccount.fromWallet();
if(sA && sA.account.id === qP.account)
  await sA.deriveKeys(null, {asymetric: 'Asymetric', signing: 'Signing', shareKX: 'ShareKX'})
            .catch(err => {// found the authoring account but could't derive keys
                console.error(`Error deriving keys for SigningAccount ${sA.account.id}`, err);
                sA = new SigningAccount(qP.account);
            });
else
  sA = new SigningAccount(qP.account);

// revisions have been encrypted. You are probably reading plaintext.
const keys = sA.ec25519 ? {writer: sA.ec25519.pk, reader: sA.ec25519.sk} : null;
window.collab = await CKE5_Page.fromSigningAccount(sA, qP.label, keys);
await CKE5_Page.init(keys);
CKE5_Page.publishPlaintext(window.collab, keys, 'tssDoc');
