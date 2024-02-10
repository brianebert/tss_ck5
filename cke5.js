import {Encrypted_Node} from '@brianebert/tss';
import {PageControls, setPageClass} from './pagecon.js';
import {CK_Editor} from './editor.js';

//const HASH_SLICE = 10;


class CKE5_Page extends Encrypted_Node {
  #bottomBar; #editorEl;
  constructor(){
    super(...arguments);
    // element editor uses
    this.#editorEl = document.querySelector('.editor');
    this.pageLinks = {
      // floats links from page source for editing
      // links property is added in CKE5_Page.refreshPaveview
      onclick: e => CKE5_Page.openPage(this.signingAccount, e.target.value),
      push: function(key, value){
        if(Object.keys(this.links).includes(key) || Object.values(this.links).includes(value))
          throw new Error(`cannot set new link from ${key} or to ${value}`)
        this.links[key] = value;
      },
      render: function(){
        const parentEl = document.getElementById('subPages');
        parentEl.innerHTML = '';
        for(const [key, value] of Object.entries(this.links)){
  console.log(`processing link ${key}`);
          if(!key.endsWith('_last')){ // no link to last revision
            const button = document.createElement('button');
            button.addEventListener('click', this.onclick);
            button.id = `${key}SubpageButton`;
            button.value = value.toString();
            button.textContent = key;
            parentEl.appendChild(button);
          }
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
          return values
      }
    };
  }

  get bottomBar(){
    return this.#bottomBar
  }

  static set params(params){
    this.blockParameters = params;
  }

  static async mapPages(root, keys, selectValue){
console.log(`populating page selector for ${root.name} with ${selectValue} selected.`);
    const subPageLinks = Array.from(document.getElementById('subPages').children);
    subPageLinks.map(link => link.disabled = true);
    const el = root.bottomBar.pageSelect.el;
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
    if(this.blockParameters.traverse.value)
      await this.traverse(root.cid, populateSelectOption, keys);
    else
      populateSelectOption(root, 0);
    subPageLinks.map(link => link.disabled = false);
    for(const option of opts)
      el.append(option);
    el.disabled = false;
  }

  static async openPage(signingAccount, address=null, name=''){
  console.log(`entered openPage() with name ${name}, address ${address} signingAccount `, signingAccount);
    // save old page if necessary
    if(window?.editor){  
      const editor = window.editor;
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
      var keys = await signingAccount.keys.readFrom(this.blockParameters.inKeys.value);
    }
    if(window?.collab && window.collab?.bottomBar)
      window.collab.bottomBar.abortControler.abort(); // strip event listeners from page control elements
    try {
      if(address){
  console.log(`reading page from address ${address} with keys `, keys);
        window.collab = await this.fromCID(signingAccount, address, keys);
      }
      else { // open welcome page
  console.log(`creating page ${name} using signingAccount `, signingAccount);
        const prompt0 = `<h1>Welcome!</h1><p>to get started, enter or choose "<span style="color:hsl(0, 0%, 60%);">Document Address</span>`;
        const prompt1 = `" at the upper left then click "<b>read</b>," or click "<b>Edit Document</b>" on the lower right</p>`;
        const prompt2 = `<p>This page will not be saved unless you edit it!</p>`;
        window.collab = new this({colName: name, editorContents: prompt0 + prompt1 + prompt2}, signingAccount);
        await window.collab.ready;
  console.log(`created page ${window.collab.name} `, window.collab);
      }
      await this.refreshPageview(window.collab);
      // the next two lines for debugging
      const subPages = Object.fromEntries(Object.entries(window.collab.links).map(([key, cid]) => [key, cid.toString()]));
      console.log(`${window.collab.name}'s subpage links are: `, subPages);
      return window.collab
    } catch (err) {
      console.error(`error opening ${address}`, err);
    }  
  }

  static lockId = Symbol();
  static readOnlyMode(bool){
    console.log(`entered readOnlyMode(${bool}) window.collab: `, window?.collab);
    console.log(`and window.editor: `, window.editor);
    const editor = window.editor;
    const bB = window.collab.bottomBar;
    bB.editSelect.el.children[0].selected = true;
    Array.from(document.getElementsByClassName('documentEdits')).map(el => el.hidden = true);
    bool ? editor.enableReadOnlyMode(this.lockId) : editor.disableReadOnlyMode(this.lockId);
    document.getElementById('subPages').hidden = bB.editButton.el.hidden = !bool;
    bB.editSelect.el.hidden = bB.saveButton.el.disabled = bool;
  }

  static async refreshPageview(node){
    console.log(`refreshing page for `, node);
    node.#bottomBar = new PageControls(node);
    if(Object.hasOwn(window, 'editor'))
      window.editor.destroy();
    node.#editorEl.innerHTML = node.value.editorContents;
    window.editor = await new CK_Editor(node.#editorEl, node.#bottomBar.saveButton.el);
    node.pageLinks.links = node.links;
    node.pageLinks.render();
    this.readOnlyMode(true);
    if(!this.blockParameters.traverse.value){
      this.blockParameters.copyIt.el.value = node.cid.toString();
console.log(`have set value ${this.blockParameters.copyIt.el.value} on `, this.blockParameters.copyIt.el);
      await this.mapPages(node);
    }
    else // this.blockParameters.traverse.value = true
      if(node.parents.length === 0){
        node.#bottomBar.editingRoot.reset(node); // there are no listeners on editingRoot
        node.#bottomBar.homeButton.reset(node); // calling reset() operates homeButton AbortController
        this.blockParameters.copyIt.el.value = node.cid.toString();
console.log(`have set value ${this.blockParameters.copyIt.el.value} on `, this.blockParameters.copyIt.el);
        await this.mapPages(node, await node.signingAccount.keys.readFrom(this.blockParameters.inKeys.value), node.cid.toString());
      }
    window.scroll(0,0);    
  }

  static startAutosave(node){
    // Any comment will trigger CKEditor5 autosave and is stripped too!
    window.editor.setData('<!-- -->' + window.editor.getData());
    //node.ephemeral = true; GETTING RID OF ephemeral nodes
  }

  // do not call directly. It will be called by the Editor's autosave module.
  async saveData(editor){
    console.log(`saving data for this: `, this);
    let value = Object.assign({}, this.value);
    if(this.#bottomBar.newName.value.length > 0)
      value.colName = this.#bottomBar.newName.value;
    value = this.pageLinks.update(value);
    value.editorContents = editor.getData();
    const keys = await this.signingAccount.keys.writeTo(CKE5_Page.blockParameters.inKeys.value);
console.log(`encrypting for ${CKE5_Page.blockParameters.inKeys.value} with keys `, keys);
    return this.update(value, keys).then(async root => {
console.log(`${this.name} bubbled up to ${root.name}`, root);
      this.#bottomBar.editingPage.reset(this);
      this.#bottomBar.editingRoot.reset(root);
      this.#bottomBar.homeButton.reset(root);
      CKE5_Page.blockParameters.copyIt.el.value = this.cid.toString();
      await CKE5_Page.mapPages(root, await root.signingAccount.keys.readFrom(CKE5_Page.blockParameters.inKeys.value), this.cid.toString());
      //await CKE5_Page.persist(root, keys);
    })
  }
}
setPageClass(CKE5_Page);
window.CKE5_Page = CKE5_Page; // delete this after debug
export {CKE5_Page};