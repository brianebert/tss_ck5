import {Encrypted_Node, SigningAccount} from '@brianebert/tss';
import {CK_Watchdog} from './editor.js';


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
console.log(`entered init() with keys: `, keys);
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
    const subPageLinks = Array.from(document.getElementById('subPages').children);
    subPageLinks.forEach(link => link.disabled = true);
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
    subPageLinks.forEach(link => link.disabled = false);
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
    if(Object.hasOwn(node.value, 'editorContents')){
      node.elements.editingPage.value = node.cid.toString();
      node.editorEl.innerHTML = node.value.editorContents;
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
        document.getElementById('editingPage').value = this.cid.toString();
        document.getElementById('editingRoot').value = root.cid.toString();
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
      let keys = ec25519 ? {writer: ec25519.sk, reader: ec25519.pk} : null;
      if(SigningAccount.canSign(root.signingAccount))
        Encrypted_Node.persist(root.signingAccount,qP.label, root.cid, keys);
      document.getElementById('editingRoot').value = root.cid.toString();
      document.getElementById('editingPage').value = this.cid.toString();
      keys = ec25519 ? {writer: ec25519.pk, reader: ec25519.sk} : null;
      CKE5_Page.populatePageSelect(root, keys, this.cid.toString());
    })
  }
}

/* Now start the program running
 */

// Parse the url for Stellar account number and data entry name where document's ipfs address is saved
const segments = window.location.href.split('?');
const qP = Object.fromEntries(segments.pop().split('&').map(pair => pair.split('=')));
// did we get the right parameters in the query string?
if(qP === undefined || !Object.hasOwn(qP, 'readFrom') || !Object.hasOwn(qP, 'writeTo') || !Object.hasOwn(qP, 'label'))
  throw new Error(`data root source, sink, and label must appear in url query string`)
if(qP.writeTo !== 'localStorage')
  CKE5_Page.sink.url = (cid) => `https://motia.com/api/v1/ipfs/block/put?cid-codec=${CKE5_Page.codecForCID(cid).name}`;
if(qP.readFrom !== 'localStorage')
  CKE5_Page.source.url = (cid) => `https://motia.infura-ipfs.io/ipfs/${cid.toString()}`;
// create a SigningAccount, with keys if user agrees to sign
// a transaction used as a key seed
let sA = await SigningAccount.fromWallet()
if(!!sA) {
  await sA.deriveKeys(null, {asymetric: 'Asymetric', signing: 'Signing', shareKX: 'ShareKX'})
          .catch(err => console.error(`Error deriving keys for SigningAccount ${sA.account.id}`, err));
  if(sA.id === qP.readFrom || qP.readFrom === 'localStorage')
    var sourceAccount = sA;
}
if(!sourceAccount)
  try {
    var sourceAccount = new SigningAccount(qP.readFrom)
  } catch(err) {
    console.error(`error creating readFrom account with id: ${qP.readFrom} `, err);
    throw new Error(`do not know where to readFrom: ${qP.readFrom}`)
  }

// revisions have been encrypted. You are probably reading plaintext.
const keys = sourceAccount.ec25519 ? {writer: sA.ec25519.pk, reader: sA.ec25519.sk} : null;

window.collab = await CKE5_Page.fromSigningAccount(sourceAccount, qP.label, keys);
await CKE5_Page.init(keys);
//CKE5_Page.publishPlaintext(window.collab, keys, 'tssDoc');
